import { Mastodon } from 'megalodon'
import { getLatestToot, getNewToots } from '../mastodon'
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
        let posts = await getNewToots(userClient, user.mastodonUid, user.lastTootTime)

        if(posts.length === 0) {
            app.log.info({
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
            console.log('new posts')
            const postBsky = await generateBueskyPostFromMastodon(post, blueskyClient)
            blueskyClient.post(postBsky).then((res) => {
                console.log(res)
            }).catch((err) => {
                console.log(err)
            })
            await updateLastPostTime(user.id, new Date(post.created_at))
            console.log(postBsky)
        })
    })
}