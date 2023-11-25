import { Mastodon } from 'megalodon'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyView from '@fastify/view'
const { Liquid } = require("liquidjs");
import path from 'path'
import fastifyFormbody from '@fastify/formbody'
import fastifyJwt from '@fastify/jwt'
import fastifySchedule from '@fastify/schedule'
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { intiBlueskyAgent } from './lib/bluesky'
import { authenticateJWT, domainToUrl, genCallBackUrl } from './lib/utils'
import { db, getInstanceByDomain, getUserByMastodonUid } from './lib/db'
import taskMastodonToBluesky from './lib/tasks/mastodonToBluesky';

const { ADDRESS = 'localhost', PORT = '3000' } = process.env;

declare module "@fastify/jwt" {
    interface FastifyJWT {
        user: {
            id: string,
            mastodonHandle: string,
            token: string,
            instance: string,
        }
    }
}

export const app = Fastify({
    logger: true
})

app.register(fastifyCookie)
app.register(fastifyFormbody)
app.register(fastifyView, {
    engine: {
        liquid: new Liquid({
            root: path.join(import.meta.dir, "views"),
            extname: ".liquid",
        })
    },
    root: path.join(import.meta.dir, "views"),
    production: false,
    maxCache: 0,
    options: {
        noCache: true,
    },
});

app.register(require('@fastify/static'), {
    root: path.join(import.meta.dir, 'public'),
})

app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'this_shoudl_not_be_used_in_production',
    cookie: {
        cookieName: 'token',
        signed: false,
    }
})

app.register(fastifySchedule)

app.get('/', { onRequest: [authenticateJWT] }, async (req, res) => {
    const user = await db.user.findFirst({ where: { id: req.user.id } })

    return res.view("index", {
        userName: req.user.mastodonHandle,
        instance: req.user.instance,
        blueskyHandle: user?.blueskyHandle,
        hasBlueskyToken: user?.blueskyToken ? true : false
    })
})

app.post<{
    Body: {
        blueskyHandle: string,
        blueskyToken: string
    }
}>('/', { onRequest: [authenticateJWT] }, async (req, res) => {
    const user = await db.user.findFirst({ where: { id: req.user.id } })

    let response_data = {
        err: undefined,
        userName: req.user.mastodonHandle,
        instance: req.user.instance,
        blueskyHandle: user?.blueskyHandle,
        hasBlueskyToken: user?.blueskyToken ? true : false
    };

    const passwordRegex = new RegExp(/^(?:[a-zA-Z0-9]{4}-){3}[a-zA-Z0-9]{4}$/);
    const passwordValid = passwordRegex.test(req.body.blueskyToken)

    if (!passwordValid) res.status(400).view("index", {
        ...response_data,
        err: 'Invalid Bluesky Token'
    })

    const handleRegex = new RegExp(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/);
    const handleValid = handleRegex.test(req.body.blueskyHandle)

    if (!handleValid) res.status(400).view("index", {
        ...response_data,
        err: 'Invalid Bluesky Handle'
    })

    const agent = await intiBlueskyAgent('https://bsky.social', req.body.blueskyHandle, req.body.blueskyToken).catch((err) => {
        console.log(err)
        res.status(400).view("index", {
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
            blueskyToken: req.body.blueskyToken
        }
    })

    return res.redirect('/')
})

app.get('/login', async (req, res) => {
    return res.view("login", {});
})

app.get('/logout', async (req, res) => {
    return res.clearCookie('token').redirect('/login')
})

app.get<{
    Querystring: {
        instance: string
    }
}>('/auth', async (req, res) => {
    let instanceDomain: string = req.query.instance || "mastodon.social"
    instanceDomain = instanceDomain.toLowerCase().replace(/https?:\/\//, "")
    const url = domainToUrl(instanceDomain)
    let client = new Mastodon(url)

    let knownInstance = await getInstanceByDomain(instanceDomain)

    if (knownInstance) {
        console.log("--- INSTANCE ALREADY REGISTERED ---")
    } else {
        console.log("--- INSTANCE NOT REGISTERED ---")
        const appData = await client.createApp(process.env.APP_ID ?? "skymoth-test", {
            scopes: ["read"],
            redirect_uris: genCallBackUrl(instanceDomain)
        })

        knownInstance = await db.mastodonInstance.create({
            data: {
                url: instanceDomain,
                urlEncoded: btoa(instanceDomain),
                applicationId: appData.client_id,
                applicationSecret: appData.client_secret
            }
        })
    }

    const authUrl = await client.generateAuthUrl(knownInstance.applicationId, knownInstance.applicationSecret, {
        scope: ["read"],
        redirect_uri: genCallBackUrl(instanceDomain)
    })
    return res.redirect(authUrl)
})

app.get<{
    Params: {
        id: string
    },
    Querystring: {
        code: string
    }
}>('/auth/callback/:id', async (req, res) => {
    const { id } = req.params;

    const instance = await getInstanceByDomain(atob(id)).catch((err) => {
        console.log(err)
        res.status(400).view("login", {
            err: 'A problem occured while authenticating to the instance via token'
        })
    })

    if (instance == null) {
        return res.status(400).view("login", {
            err: 'A problem occured while authenticating to the instance via token'
        })
    }

    let client = new Mastodon(domainToUrl(instance.url))

    const token = await client.fetchAccessToken(instance.applicationId, instance.applicationSecret, req.query.code, genCallBackUrl(instance.url));

    const userClient = new Mastodon(domainToUrl(instance.url), token.access_token)
    const verifiedCredentials = await userClient.verifyAccountCredentials();

    let user = await getUserByMastodonUid(verifiedCredentials.data.id, instance.id)

    if (!user) {
        user = await db.user.create({
            data: {
                mastodonInstance: {
                    connect: {
                        id: instance.id
                    }
                },
                mastodonUid: verifiedCredentials.data.id,
                mastodonToken: token.access_token,
                name: verifiedCredentials.data.username,
                lastTootTime: new Date()
            }
        })
    } else {
        console.log('updating user')

        user = await db.user.update({
            where: {
                id: user.id
            },
            data: {
                mastodonToken: token.access_token,
                name: verifiedCredentials.data.username,
            }
        })
    }

    const jwt = app.jwt.sign({
        id: user.id,
        mastodonHandle: verifiedCredentials.data.username,
        token: token,
        instance: instance.url,
    })

    return res
        .setCookie('token', jwt, {
            domain: Bun.env.APP_DOMAIN,
            path: '/',
            secure: false,
            httpOnly: true
        })
        .redirect('/')
})

app.listen({ host: ADDRESS, port: parseInt(PORT, 10) }, function (err, address) {
    if (err) {
        app.log.error(err)
        process.exit(1)
    }
})

app.ready().then(() => {
    const job = new SimpleIntervalJob({ seconds: parseInt(process.env.POLL_INTERVAL ?? '60'), }, new AsyncTask(
        'taskMastodonToBluesky',
        taskMastodonToBluesky
    ))
    app.scheduler.addSimpleIntervalJob(job)
})