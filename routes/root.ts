import { intiBlueskyAgent } from './../lib/bluesky'
import { authenticateJWT } from './../lib/utils'
import { db } from './../lib/db'
import { FastifyInstance } from 'fastify'

export const routesRoot = async (app: FastifyInstance, options: Object) => {
    app.get('/', { onRequest: [authenticateJWT] }, async (req, res) => {
        const user = await db.user.findFirst({ where: { id: req.user.id } })

        return res.view("index", {
            userName: req.user.mastodonHandle,
            instance: req.user.instance,
            blueskyHandle: user?.blueskyHandle,
            blueskyPDS: user?.blueskyPDS,
            hasBlueskyToken: user?.blueskyToken ? true : false,
            pollingInterval: parseInt(process.env.POLL_INTERVAL ?? '60')
        })
    })

    app.post<{
        Body: {
            blueskyHandle: string,
            blueskyToken: string,
            blueskyPDS: string
        }
    }>('/', { onRequest: [authenticateJWT] }, async (req, res) => {
        const user = await db.user.findFirst({ where: { id: req.user.id }, include: { mastodonInstance: true } })

        let response_data: any = {
            err: undefined,
            userName: req.user.mastodonHandle,
            instance: req.user.instance,
            pollingInterval: parseInt(process.env.POLL_INTERVAL ?? '60')
        };

        const passwordRegex = new RegExp(/^(?:[a-zA-Z0-9]{4}-){3}[a-zA-Z0-9]{4}$/);
        const passwordValid = passwordRegex.test(req.body.blueskyToken)

        if (!passwordValid) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Bluesky Token'
        })

        const handleRegex = new RegExp(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/);
        const handleValid = handleRegex.test(req.body.blueskyHandle)

        if (!handleValid) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Bluesky Handle'
        })

        const agent = await intiBlueskyAgent(req.body.blueskyPDS, req.body.blueskyHandle, req.body.blueskyToken, user).catch((err) => {
            console.error(err)
            return res.status(400).view("index", {
                ...response_data,
                err: 'Could not authenticate to Bluesky'
            })
        })

        await db.user.update({
            where: {
                id: req.user.id
            },
            data: {
                blueskyHandle: req.body.blueskyHandle,
                blueskyToken: req.body.blueskyToken,
                blueskyPDS: req.body.blueskyPDS,
            }
        })

        response_data = {
            ...response_data,
            blueskyHandle: user?.blueskyHandle,
            blueskyPDS: user?.blueskyPDS,
            hasBlueskyToken: user?.blueskyToken ? true : false
        }

        return res.redirect('/')
    })

    app.get('/privacy', async (req, res) => {
        return res.view("privacy", {})
    })
}