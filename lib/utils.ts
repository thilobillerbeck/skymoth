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
		return `http://${ADDRESS}:${PORT}/auth/callback/${btoa(instanceDomain)}`;
	}
	return `${process.env.APP_URL}/auth/callback/${btoa(instanceDomain)}`;
}

export const authenticateJWT = async (
	req: { jwtVerify: () => unknown },
	res: { redirect: (arg0: string) => void },
) => {
	try {
		await req.jwtVerify();
	} catch (err) {
		res.redirect("/login");
	}
};

export function splitTextBluesky(
	text: string,
	spoiler: string,
	numbering: boolean,
	numberingScale = 1,
): string[] {
	const numberingLength = numbering ? 4 + numberingScale * 2 : 0;

	let res = [];
	let letterCount = 0;
	let chunks = [];

	if (text.length <= 300 - spoiler.length) {
		return [`${spoiler}${text}`];
	}

	for (const word of text.split(" ")) {
		letterCount += word.length + 1; // +1 for space
		if (letterCount >= 300 - numberingLength - spoiler.length) {
			res.push(chunks.join(" "));
			chunks = [];
			letterCount = word.length;
		}
		chunks.push(word);
	}
	res.push(chunks.join(" "));
	res = res.map(
		(r, i) => `${spoiler}${r}${numbering ? ` [${i + 1}/${res.length}]` : ""}`,
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
	} catch (err) {
		return false;
	}
}
