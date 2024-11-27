import { FastifyInstance } from "fastify";
import { Mastodon } from 'megalodon'
import { authenticateJWT, domainToUrl, genCallBackUrl, validateDomain } from './../lib/utils'
import { db, getInstanceByDomain, getUserByMastodonUid } from './../lib/db'
import { AtpSessionData } from "@atproto/api";

export const routesUser = async (app: FastifyInstance, options: Object) => {
    app.get('/login', async (req, res) => {
        return res.view("login", {});
    })

    app.get('/logout', async (req, res) => {
        return res.clearCookie('token').redirect('/login')
    })

    app.post('/account/delete', { onRequest: [authenticateJWT] }, async (req, res) => {
        await db.user.delete({
            where: {
                id: req.user.id
            }
        })
        return res.clearCookie('token').redirect('/login')
    })

    app.get('/account/downloadData', { onRequest: [authenticateJWT] }, async (req, res) => {
        let user = await db.user.findFirst(
            {
                where: { id: req.user.id },
                select: {
                    mastodonInstance: {
                        select: {
                            url: true,
                        }
                    },
                    createdAt: true,
                    updatedAt: true,
                    mastodonUid: true,
                    mastodonToken: false,
                    name: true,
                    lastTootTime: true,
                    blueskyHandle: true,
                    blueskyToken: false,
                    blueskySession: true,
                    blueskyPDS: true,
                }
            })

            if(user.blueskySession) {
                const blueskySession = user?.blueskySession as unknown as AtpSessionData

                user.blueskySession = {
                    handle: blueskySession?.handle,
                    did: blueskySession?.did,
                    email: blueskySession?.email,
                    emailConfirmed: blueskySession?.emailConfirmed,
                    emailAuthFactor: blueskySession?.emailAuthFactor,
                    active: blueskySession?.active,
                    status: blueskySession?.status,
                }
            }

            
        res.header('Content-Disposition', `attachment; filename=skymoth-userdata-${user?.name}.json`)
        res.send(user).type('application/json').code(200).redirect('/')
    })

    app.get<{
        Querystring: {
            instance: string
        }
    }>('/auth', async (req, res) => {
        let instanceDomain: string = req.query.instance || "mastodon.social"
        instanceDomain = instanceDomain.toLowerCase().replace(/https?:\/\//, "").replace("/", "")

        if(!validateDomain(instanceDomain)) {
            return res.status(400).view("login", {
                err: 'Invalid instance domain'
            })
        }

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

        const instance = await getInstanceByDomain(atob(id))

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
                domain: process.env.APP_DOMAIN,
                path: '/',
                secure: false,
                httpOnly: true
            })
            .redirect('/')
    })
}