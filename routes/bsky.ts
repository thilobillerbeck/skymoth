import { Agent } from '@atproto/api'
import { getBlueskyOauthClient } from './../lib/bluesky'
import { FastifyInstance } from 'fastify'
import { authenticateJWT } from '../lib/utils'
import { db } from '../lib/db'

export const routesBsky = async (app: FastifyInstance, options: Object) => {
    app.get('/bsky/client-metadata.json', async (req, res) => {
        return res.send(getBlueskyOauthClient(null).clientMetadata)
    })

    app.get('/bsky/auth', { onRequest: [authenticateJWT] }, async (req, res) => {
        const handle = '' // TODO

        const url = await getBlueskyOauthClient(req.user.id).authorize(handle, {})

        res.redirect(url.toString())
    })

    app.get('/bsky/callback', { onRequest: [authenticateJWT] }, async (req, res) => {
        const params = new URLSearchParams(req.url.split('?')[1])

        const { session, state } = await getBlueskyOauthClient(req.user.id).callback(params)

        const agent = new Agent(session)

        res.send(agent.did)
    })

    app.get('/bsky/test', { onRequest: [authenticateJWT] }, async (req, res) => {
        const user = await db.user.findFirst({ where: { id: req.user.id }, select: { blueskySessionOauth: true } })

        const session = await getBlueskyOauthClient(req.user.id).restore(user.blueskySessionOauth.key)

        const agent = new Agent(session)

        const timeline = await agent.getTimeline({})

        res.send(timeline)
    })
}