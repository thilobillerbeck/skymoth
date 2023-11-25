import { BskyAgent, AppBskyFeedPost, RichText } from "@atproto/api"
import { Entity } from "megalodon"
import { fetchImageToBytes, htmlToText } from "./utils"
import Jimp from "jimp";

export async function intiBlueskyAgent(url: string, handle: string, password: string) {
    const agent = new BskyAgent({
        service: url
    })
    await agent.login({ identifier: handle, password: password })
    return agent
}

export async function generateBueskyPostFromMastodon(status: Entity.Status, client: BskyAgent): Promise<Partial<AppBskyFeedPost.Record> & Omit<AppBskyFeedPost.Record, "createdAt">> {
    const rt = new RichText({
        text: htmlToText(status.content)
    })

    let post: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
    }

    const media_attachmentsFiltered = status.media_attachments.filter((media) => media.type === 'image')

    if (media_attachmentsFiltered.length > 0) {
        let images = [];
        for (const media of media_attachmentsFiltered) {
            const {arrayBuffer, mimeType} = await fetchImageToBytes(media.url)
            let arr = new Uint8Array(arrayBuffer)

            if (arr.length > 1000000) {
                const jimpBuffer = await Jimp.read(Buffer.from(arr));
                const buffer = await jimpBuffer
                    .resize(1920, Jimp.AUTO)
                    .quality(50)
                    .getBufferAsync(Jimp.MIME_JPEG);
                arr = new Uint8Array(buffer);
            }

            const res = await client.uploadBlob(arr, {
                encoding: mimeType!
            })

            images.push({
                image: res.data.blob,
                alt: media.description ? media.description : '',
            });
        }

        post = {
            ...post,
            embed: {
                $type: 'app.bsky.embed.images',
                images: images
            }
        };
    }


    if(AppBskyFeedPost.isRecord(post)) {
        const res = AppBskyFeedPost.validateRecord(post);
        if (res.success) {
            return post;
        } else {
            console.log(res.error)
        }
    }
}