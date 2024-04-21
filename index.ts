import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyView from '@fastify/view'
const { Liquid } = require("liquidjs");
import fastifyFormbody from '@fastify/formbody'
import fastifyJwt from '@fastify/jwt'
import { routesRoot } from './routes/root';
import { routesUser } from './routes/user';
import { join } from 'path'
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from "@sentry/profiling-node";

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

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            nodeProfilingIntegration(),
        ],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
    });
}

app.register(fastifyCookie)
app.register(fastifyFormbody)
app.register(fastifyView, {
    engine: {
        liquid: new Liquid({
            root: join(__dirname, "views"),
            extname: ".liquid",
        })
    },
    root: join(__dirname, "views"),
    production: false,
    maxCache: 0,
    options: {
        noCache: true,
    },
});

app.register(require('@fastify/static'), {
    root: join(__dirname, 'public'),
})

app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'this_shoudl_not_be_used_in_production',
    cookie: {
        cookieName: 'token',
        signed: false,
    }
})

app.register(routesRoot)
app.register(routesUser)

app.listen({ host: ADDRESS, port: parseInt(PORT, 10) }, function (err, address) {
    if (err) {
        app.log.error(err)
    }
})