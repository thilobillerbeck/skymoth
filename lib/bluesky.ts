import { BskyAgent, AppBskyFeedPost, RichText } from "@atproto/api"
import { Entity } from "megalodon"
import { fetchImageToBytes, htmlToText } from "./utils"

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
            const arr = new Uint8Array(arrayBuffer)

            if (arr.length > 1000000) {
                console.log(`Image too large: ${media.url}`)
                continue;
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