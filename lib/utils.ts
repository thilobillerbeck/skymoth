import { convert } from "html-to-text";
import { parse } from "node-html-parser";
import logger from "./logger";

export function mastodonHtmlToText(html: string) {
	const root = parse(html);
	const invisibles = root.querySelectorAll(".invisible, .ellipsis");
	for (const invisible of invisibles) {
		invisible.remove();
	}

	const hashtags = root.querySelectorAll('a[rel="tag"]');
	for (const hashtag of hashtags) {
		hashtag.replaceWith(`<span> ${hashtag.text} </span>`);
		hashtag.remove();
	}

	const links = root.querySelectorAll("a");
	for (const link of links) {
		link.replaceWith(`<span> ${link.attributes.href} </span>`);
		link.remove();
	}

	root.removeWhitespace();

	return convert(root.toString(), {
		wordwrap: false,
	});
}

export async function fetchImageToBytes(url: string) {
	const response = await fetch(url);
	const arrayBuffer = await response.arrayBuffer();
	const mimeType = response.headers.get("content-type");
	return { arrayBuffer, mimeType };
}

export function domainToUrl(domain: string) {
	return `https://${domain}`;
}

export function validateDomain(domain: string) {
	return domain.match(
		/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/g,
	);
}

export function genCallBackUrl(instanceDomain: string) {
	if (process.env.NODE_ENV === "development") {
		const { ADDRESS = "localhost", PORT = "3000" } = process.env;
		return `http://${ADDRESS}:${PORT}/auth/callback/${Buffer.from(instanceDomain).toString("base64")}`;
	}
	return `${process.env.APP_URL}/auth/callback/${Buffer.from(instanceDomain).toString("base64")}`;
}

export const authenticateJWT = async (
	req: { jwtVerify: () => unknown },
	res: { redirect: (arg0: string) => void },
) => {
	try {
		await req.jwtVerify();
	} catch (_err) {
		res.redirect("/login");
	}
};

/**
 * Splits a long text into multiple posts for Bluesky, optionally adding numbering.
 * @param text The main text to split.
 * @param spoiler A spoiler prefix to add to each chunk.
 * @param postLink A link to append to the end of the text.
 * @param numbering If true, adds numbering (e.g., [1/3]) to each chunk.
 * @param numberingThreshold Minimum number of chunks required before numbering is applied (default: 1, so numbering is always applied if `numbering` is true).
 * @returns An array of post-ready strings.
 */
export function splitTextBluesky(
	text: string,
	spoiler: string,
	postLink: string,
	numbering: boolean,
	numberingThreshold = 1, // default: always number if 'numbering' is true
): string[] {
	const MAX_LENGTH = 300;
	const numberingScale = Math.ceil(text.length / 3000);
	const numberingLength = numbering ? 4 + numberingScale * 2 : 0;
	const chunkLength = MAX_LENGTH - numberingLength - spoiler.length;

	// If the text fits in one chunk, return as a single post
	if (text.length <= chunkLength - postLink.length) {
		return [`${spoiler}${text}${text && postLink ? "\n\n" : ""}${postLink}`];
	}

	// if text starts and ends with a line break, remove them
	if (text.startsWith("\n")) text = text.slice(1);
	if (text.endsWith("\n")) text = text.slice(0, -1);

	const modifiedText = text + postLink;
	let res: string[] = [];
	let start = 0;

	while (start < modifiedText.length) {
		const end = Math.min(start + chunkLength, modifiedText.length);
		const chunk = modifiedText.slice(start, end);

		// Try to split at line break
		let splitIdx = chunk.lastIndexOf("\n");
		if (splitIdx === -1) splitIdx = chunk.lastIndexOf("\r");
		// Try to split at period
		if (splitIdx === -1) splitIdx = chunk.lastIndexOf(".");
		// Try to split at other punctuation
		if (splitIdx === -1) splitIdx = chunk.search(/[!?,;:](?!.*[!?,;:])/);
		// Try to split at space (prefer splitting at a space before splitting in the middle of a word)
		if (splitIdx === -1) splitIdx = chunk.lastIndexOf(" ");
		// If no good split point, split at max length
		if (splitIdx === -1 || splitIdx < 20) splitIdx = chunk.length;

		const part = chunk.slice(0, splitIdx + 1).trim();
		res.push(part);
		start += part.length;
		// Skip any whitespace at the start of the next chunk
		while (/\s/.test(modifiedText[start])) start++;
	}

	// Only apply numbering if enabled and the number of posts meets/exceeds the threshold
	const shouldNumber = numbering && res.length >= numberingThreshold;
	res = res.map(
		(r, i) =>
			`${spoiler}${r}${shouldNumber ? ` [${i + 1}/${res.length}]` : ""}`,
	);
	return res;
}

export function logSchedulerEvent(
	username: string,
	instance: string,
	action: string,
	msg: string,
) {
	// create log entry with tabbed columns
	logger.info(`${username}:${instance} \t| ${action} \t| ${msg}`);
}

// due to the read after write system of bluesky, we need to wait a bit before fetching the post
export function getBlueskyApiWaittime(): number {
	return process.env.BLUESKY_API_WAITTIME
		? Number.parseInt(process.env.BLUESKY_API_WAITTIME)
		: 5000;
}

export function printInfo() {
	logger.info(
		`Waiting time between posts in one run is set to: ${getBlueskyApiWaittime()}`,
	);
}

export function checkValidHttpsUrl(rwaUrl: string): boolean {
	try {
		const url = new URL(rwaUrl);
		return url.protocol === "https:";
	} catch (_err) {
		return false;
	}
}
