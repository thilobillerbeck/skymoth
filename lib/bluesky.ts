import { AtpAgent, AppBskyFeedPost, RichText, BlobRef, AtpSessionData, AtpSessionEvent } from "@atproto/api"
import { Entity } from "megalodon"
import { fetchImageToBytes, logSchedulerEvent, mastodonHtmlToText, splitTextBluesky } from "./utils";
import sharp from "sharp";
import { Attachment } from "megalodon/lib/src/entities/attachment";
import { db } from "./db";
import { JsonObject } from "@prisma/client/runtime/library";
import { Prisma } from '@prisma/client'


export async function intiBlueskyAgent(url: string, handle: string, password: string, user: any) {
    let session: AtpSessionData | undefined = undefined
    session = user.blueskySession as unknown as AtpSessionData

    const agent = new AtpAgent({
        service: url,
        persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
            logSchedulerEvent(user.name, user.mastodonInstance.url, "SESSION_PERSIST", `${evt}`)
            db.user.update({
                where: {
                    id: user.id
                },
                data: {
                    blueskySession: sess as unknown as JsonObject,
                    blueskySessionEvent: evt
                }
            }).then(() => {
                logSchedulerEvent(user.name, user.mastodonInstance.url, "AGENT", "session persisted")
            }).catch((err) => {
                logSchedulerEvent(user.name, user.mastodonInstance.url, "AGENT", "could not persist session")
                console.error(err)
            })
        },
    })

    if (session) {
        const res = await agent.resumeSession(session)
        
        if (res.success) {
            logSchedulerEvent(user.name, user.mastodonInstance.url, "AGENT", "resuming session")
            return agent
        } else {
            logSchedulerEvent(user.name, user.mastodonInstance.url, "AGENT", "could not resume session")
        }
    } else {
        logSchedulerEvent(user.name, user.mastodonInstance.url, "AGENT", "no session found")
    }
    
    await agent.login({ identifier: handle, password: password })

    return agent
}

export async function generateBlueskyPostsFromMastodon(status: Entity.Status, client: AtpAgent): Promise<Array<AppBskyFeedPost.Record>> {
    let posts: Array<AppBskyFeedPost.Record> = []
    const conv = mastodonHtmlToText(status.content);
    const split = splitTextBluesky(conv);

    for(const [idx, text] of split.entries()) {
        let post = await generateBlueskyPostFromMastodon(text, client, idx === 0 ? status.media_attachments : undefined)
        if (post) {
            posts.push(post)
        }
    }

    return posts
}

export async function generateBlueskyPostFromMastodon(content: string, client: AtpAgent, media_attachments?: Array<Attachment>): Promise<AppBskyFeedPost.Record | undefined> {
    const rt = new RichText({
        text: content,
    })

    await rt.detectFacets(client)

    let post: AppBskyFeedPost.Record = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
    }

    if (media_attachments) {
        const media_attachmentsFiltered = media_attachments.filter((media) => media.type === 'image')

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
                        .resize({ height: 1080 })
                        .jpeg({
                            quality: 40,
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
    }

    if(AppBskyFeedPost.isRecord(post)) {
        const res = AppBskyFeedPost.validateRecord(post);
        if (res.success) {
            return post;
        } else {
            console.log(res)
        }
    }
    return undefined
}