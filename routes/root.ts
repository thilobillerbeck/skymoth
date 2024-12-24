import { intiBlueskyAgent, validateBlueskyAppPassword, validateBlueskyCredentials, validateBlueskyHandle } from './../lib/bluesky'
import { authenticateJWT, checkValidHttpsUrl } from './../lib/utils'
import { db } from './../lib/db'
import { FastifyInstance } from 'fastify'
import { StatusVisibility } from '@prisma/client'

export const routesRoot = async (app: FastifyInstance, options: Object) => {
    app.get('/', { onRequest: [authenticateJWT] }, async (req, res) => {
        const user = await db.user.findFirst({ where: { id: req.user.id } })

        return res.view("index", {
            userName: req.user.mastodonHandle,
            instance: req.user.instance,
            blueskyHandle: user?.blueskyHandle,
            blueskyPDS: user?.blueskyPDS,
            hasBlueskyToken: user?.blueskyToken ? true : false,
            pollingInterval: parseInt(process.env.POLL_INTERVAL ?? '60'),
            relayCriteria: user?.relayCriteria,
            relayMarker: user?.relayMarker,
            relayVisibility: user?.relayVisibility,
        })
    })

    app.post<{
        Body: {
            blueskyHandle: string,
            blueskyToken: string,
            blueskyPDS: string
        }
    }>('/settings/blueskyCreds', { onRequest: [authenticateJWT] }, async (req, res) => {
        const user = await db.user.findFirst({ where: { id: req.user.id }, include: { mastodonInstance: true } })

        let response_data: any = {
            err: undefined,
            blueskyPDS: req.body.blueskyPDS,
            userName: req.user.mastodonHandle,
            instance: req.user.instance,
            relayCriteria: user?.relayCriteria,
            relayMarker: user?.relayMarker,
            pollingInterval: parseInt(process.env.POLL_INTERVAL ?? '60')
        };

        if (!validateBlueskyAppPassword(req.body.blueskyToken)) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Bluesky App Password'
        })

        if (!validateBlueskyHandle(req.body.blueskyHandle)) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Bluesky Handle'
        })

        if(!checkValidHttpsUrl(req.body.blueskyPDS)) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Bluesky PDS'
        })

        if(!(await validateBlueskyCredentials(req.body.blueskyPDS, req.body.blueskyHandle, req.body.blueskyToken))) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Bluesky Credentials, could not authenticate'
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

        return res.redirect('/')
    })

    app.post<{
        Body: {
            relayCriteria: any,
            relayMarker: string,
            relayVisibility: StatusVisibility[]
        }
    }>('/settings/repost', { onRequest: [authenticateJWT] }, async (req, res) => {
        const user = await db.user.findFirst({ where: { id: req.user.id }, include: { mastodonInstance: true } })

        let response_data: any = {
            err: undefined,
            blueskyPDS: user?.blueskyPDS,
            userName: req.user.mastodonHandle,
            instance: req.user.instance,
            relayCriteria: user?.relayCriteria,
            relayMarker: user?.relayMarker,
            pollingInterval: parseInt(process.env.POLL_INTERVAL ?? '60')
        };

        if(req.body.relayVisibility === undefined) return res.status(400).view("index", {
            ...response_data,
            err: 'Invalid Relay Visibility'
        })
        
        const relayVisibility = !Array.isArray(req.body.relayVisibility) ? [req.body.relayVisibility] : req.body.relayVisibility;

        console.log(relayVisibility)

        await db.user.update({
            where: {
                id: req.user.id
            },
            data: {
                relayCriteria: req.body.relayCriteria,
                relayMarker: req.body.relayMarker,
                relayVisibility: relayVisibility
            }
        })

        return res.redirect('/')
    })

    app.get('/privacy', async (req, res) => {
        return res.view("privacy", {})
    })
}