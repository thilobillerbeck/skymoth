import { convert } from 'html-to-text';
import { parse } from 'node-html-parser';

export function mastodonHtmlToText(html: string) {
    const root = parse(html)
    const invisibles = root.querySelectorAll('.invisible, .ellipsis')
    for (const invisible of invisibles) {
        invisible.remove()
    }

    const hashtags = root.querySelectorAll('a[rel="tag"]')
    for (const hashtag of hashtags) {
        hashtag.replaceWith(`<span> ${hashtag.text} </span>`)
        hashtag.remove()
    }

    root.removeWhitespace()

    return convert(root.toString(), {
        wordwrap: false,
    });
}

export async function fetchImageToBytes(url: string) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type');
    return {arrayBuffer, mimeType};
}

export function domainToUrl(domain: string) {
    return `https://${domain}`
}

export function genCallBackUrl(instanceDomain: string) {
    if (process.env.NODE_ENV == 'development') {
        const { ADDRESS = 'localhost', PORT = '3000' } = process.env;
        return `http://${ADDRESS}:${PORT}/auth/callback/${btoa(instanceDomain)}`
    }
    return `${process.env.APP_URL}/auth/callback/${btoa(instanceDomain)}`
}

export const authenticateJWT = async (req: any, res: any) => {
    try {
        await req.jwtVerify()
    } catch (err) {
        res.redirect('/login')
    }
}

export function splitTextBluesky(text: string) {
    let res = []
    let letterCount = 0
    let chunks = []
    for(const word of text.split(" ")) {
        letterCount += word.length + 1 // +1 for space
        if(letterCount >= 300) {
            res.push(chunks.join(' '))
            chunks = []
            letterCount = word.length
        }
        chunks.push(word)
    }
    res.push(chunks.join(' '))
    return res
}

export function logSchedulerEvent(username: string, instance: string, action: string, msg: string) {
    // create log entry with tabbed columns
    console.log(`${username}:${instance} \t| ${action} \t| ${msg}`)
}

// due to the read after write system of bluesky, we need to wait a bit before fetching the post
export function getBlueskyApiWaittime(): number {
    return process.env.BLUESKY_API_WAITTIME ? parseInt(process.env.BLUESKY_API_WAITTIME) : 5000
}

export function printInfo() {
    console.log(`Waiting time between posts in one run is set to: ${getBlueskyApiWaittime()}`)
}

export function checkValidHttpsUrl(rwaUrl: string): boolean {
    try {
        const url = new URL(rwaUrl);
        return url.protocol === 'https:';
    } catch (err) {
        return false;
    }
}
