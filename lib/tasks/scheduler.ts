import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler"
import taskMastodonToBluesky from "./mastodonToBluesky"
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import cleanupJob from "./cleanup";
import { client } from './../db';

client.connect()

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

const job = new SimpleIntervalJob({
    seconds: parseInt(process.env.POLL_INTERVAL ?? '60'),
    runImmediately: true
}, new AsyncTask(
    'taskMastodonToBluesky',
    taskMastodonToBluesky
))

const cleanup = new SimpleIntervalJob({
    seconds: 60 * 60,
    runImmediately: true
}, new AsyncTask(
    'cleanupJob',
    cleanupJob
))

const scheduler = new ToadScheduler()
scheduler.addSimpleIntervalJob(job)
scheduler.addSimpleIntervalJob(cleanup)