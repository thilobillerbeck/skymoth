import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler"
import taskMastodonToBluesky from "./mastodonToBluesky"
import { parentPort } from 'worker_threads'


const job = new SimpleIntervalJob({
    seconds: parseInt(process.env.POLL_INTERVAL ?? '60'),
    runImmediately: true
}, new AsyncTask(
    'taskMastodonToBluesky',
    taskMastodonToBluesky
))

const scheduler = new ToadScheduler()
scheduler.addSimpleIntervalJob(job)

parentPort?.postMessage('started')