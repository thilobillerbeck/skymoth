import { BskyAgent, AppBskyFeedPost, RichText } from "@atproto/api"
import { Entity } from "megalodon"
import { fetchImageToBytes, htmlToText } from "./utils"
import { ImagePool } from '@squoosh/lib';
import { cpus } from 'os';
const imagePool = new ImagePool(cpus().length);

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
                const image = imagePool.ingestImage(arrayBuffer);
                image.preprocess({
                    resize: {
                        width: 1920
                    }
                });
                const result = await image.encode({
                    mozjpeg: {
                        quality: 75
                    }
                });
                arr = result.mozjpeg.binary
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