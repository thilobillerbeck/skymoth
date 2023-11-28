import { BskyAgent, AppBskyFeedPost, RichText, BlobRef } from "@atproto/api"
import { Entity } from "megalodon"
import { fetchImageToBytes, mastodonHtmlToText } from "./utils";
import sharp from "sharp";

export async function intiBlueskyAgent(url: string, handle: string, password: string) {
    const agent = new BskyAgent({
        service: url
    })

    await agent.login({ identifier: handle, password: password })
    return agent
}

export async function generateBueskyPostFromMastodon(status: Entity.Status, client: BskyAgent): Promise<AppBskyFeedPost.Record | undefined> {
    const rt = new RichText({
        text: mastodonHtmlToText(status.content),
    })

    await rt.detectFacets(client)

    let post: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
    }

    const media_attachmentsFiltered = status.media_attachments.filter((media) => media.type === 'image')

    if (media_attachmentsFiltered.length > 0 && client) {
        const images: {
            image: BlobRef,
            alt: string
        }[] = [];
        for (const media of media_attachmentsFiltered) {
            const {arrayBuffer, mimeType} = await fetchImageToBytes(media.url)
            let arr = new Uint8Array(arrayBuffer)

            if (arr.length > 1000000) {
                const result = await sharp(arrayBuffer)
                    .jpeg({
                        quality: 50
                    })
                    .toBuffer()

                arr = new Uint8Array(result.buffer)
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
            console.log(res)
        }
    }
}