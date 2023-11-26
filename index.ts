import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyView from '@fastify/view'
const { Liquid } = require("liquidjs");
import path from 'path'
import fastifyFormbody from '@fastify/formbody'
import fastifyJwt from '@fastify/jwt'
import fastifySchedule from '@fastify/schedule'
import { routesRoot } from './routes/root';
import { routesUser } from './routes/user';

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

app.register(routesRoot)
app.register(routesUser)

app.listen({ host: ADDRESS, port: parseInt(PORT, 10) }, function (err, address) {
    if (err) {
        app.log.error(err)
        process.exit(1)
    }
})

app.ready().then(() => {
    Bun.spawn(["bun", "run", "scheduler"],{
        stdout: "inherit",
    });
})