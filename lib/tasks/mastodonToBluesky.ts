import { Mastodon } from 'megalodon'
import { getNewToots } from '../mastodon'
import { generateBlueskyPostsFromMastodon, intiBlueskyAgent } from '../bluesky'
import { domainToUrl } from '../utils'
import { db, updateLastPostTime } from '../db'
import { ReplyRef } from '@atproto/api/dist/client/types/app/bsky/feed/post'

export default async function taskMastodonToBluesky() {
    const users = await db.user.findMany({
        include: {
            mastodonInstance: true
        }
    })

    users.forEach(async (user) => {
        try {
            if (!user.blueskyHandle || !user.blueskyToken) {
                console.log({
                    scheduledJob: 'reposter',
                    status: 'no bluesky creds',
                    user: user.name,
                    instance: user.mastodonInstance.url
                })
                return
            }
            const userClient = new Mastodon(domainToUrl(user.mastodonInstance.url), user.mastodonToken)
            let posts = await getNewToots(userClient, user.mastodonUid, user.lastTootTime)

            if(posts.length === 0) {
                console.log({
                    scheduledJob: 'reposter',
                    status: 'no new posts',
                    user: user.name,
                    instance: user.mastodonInstance.url
                })
                return
            }

            const blueskyClient = await intiBlueskyAgent('https://bsky.social', user.blueskyHandle, user.blueskyToken)

            posts = posts.reverse()

            posts.forEach(async (post) => {
                console.log({
                    scheduledJob: 'reposter',
                    status: `posting ${post.id}`,
                    user: user.name,
                    instance: user.mastodonInstance.url
                })
                const postsBsky = await generateBlueskyPostsFromMastodon(post, blueskyClient)

                if (postsBsky.length === 0) return

                let repRef: ReplyRef = {
                    root: undefined!,
                    parent: undefined!
                }

                for (const postBsky of postsBsky) {
                    if (repRef.parent !== undefined) postBsky.reply = repRef;

                    let result = await blueskyClient.post(postBsky);
                    console.log(result)

                    if (repRef.root === undefined) repRef.root = result;
                    repRef.parent = result;
                }

                await updateLastPostTime(user.id, new Date(post.created_at))
            })
        } catch (e) {
            console.log({
                scheduledJob: 'reposter',
                status: 'error',
                user: user.name,
                instance: user.mastodonInstance.url,
                error: e
            })
        }
    })
}