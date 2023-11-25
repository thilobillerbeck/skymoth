import { Mastodon } from 'megalodon'
import { getLatestToot } from '../mastodon'
import { generateBueskyPostFromMastodon, intiBlueskyAgent } from '../bluesky'
import { domainToUrl } from '../utils'
import { db, updateLastPostTime } from '../db'
import { app } from '../..'

export default async function taskMastodonToBluesky() {
    const users = await db.user.findMany({
        include: {
            mastodonInstance: true
        }
    })

    users.forEach(async (user) => {
        if (!user.blueskyHandle || !user.blueskyToken) {
            app.log.info({
                scheduledJob: 'reposter',
                status: 'no bluesky creds',
                user: user.name,
                instance: user.mastodonInstance.url
            })
            return
        }
        const userClient = new Mastodon(domainToUrl(user.mastodonInstance.url), user.mastodonToken)
        const post = await getLatestToot(userClient, user.mastodonUid)

        console.log(post)

        if (!post) {
            app.log.info({
                scheduledJob: 'reposter',
                status: 'no posts',
                user: user.name,
                instance: user.mastodonInstance.url
            })
            return
        }
        const lastPostDate = new Date(user.lastTootTime)
        const postDate = new Date(post.created_at)

        if (postDate <= lastPostDate) {
            app.log.info({
                scheduledJob: 'reposter',
                status: 'no new posts',
                user: user.name,
                instance: user.mastodonInstance.url
            })
        } else {
            console.log('new posts')
            const blueskyClient = await intiBlueskyAgent('https://bsky.social', user.blueskyHandle, user.blueskyToken)
            const postBsky = await generateBueskyPostFromMastodon(post, blueskyClient)
            blueskyClient.post(postBsky).then((res) => {
                console.log(res)
            }).catch((err) => {
                console.log(err)
            })
            await updateLastPostTime(user.id, postDate)
            console.log(postBsky)
        }
    })
}