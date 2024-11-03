import { getBlueskyOauthClient } from './../lib/bluesky'
import { FastifyInstance } from 'fastify'

export const routesBsky = async (app: FastifyInstance, options: Object) => {
    app.get('/bsky/client-metadata.json', async (req, res) => {
        return res.send(getBlueskyOauthClient().clientMetadata)
    })

    app.get('/bsky/auth', async (req, res) => {
        const handle = '' // TODO

        const url = await getBlueskyOauthClient().authorize(handle, {})

        res.redirect(url.toString())
    })
}