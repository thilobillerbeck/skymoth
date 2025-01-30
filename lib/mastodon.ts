import { type MegalodonInterface, Mastodon } from "megalodon";
import type { Status } from "megalodon/lib/src/entities/status";
import type { Constraint } from "./constraint";
import { convert } from "html-to-text";

export function initMastodonAgent() {
	return new Mastodon(
		"mastodon",
		process.env.MASTODON_URL!,
		process.env.MSTODON_TOKEN!,
	);
}

export async function getUserIdFromMastodonHandle(
	handle: string,
	client: MegalodonInterface,
) {
	const a = await client.searchAccount(handle);
	const a_data = a.data;
	return a_data[0].id;
}

function verifyThread(
	uid: string,
	status: Status,
	searchSpace: Status[],
	relayVisibility: string[],
	initialCall = false,
): boolean {
	if (!status) return false;
	if (
		status.in_reply_to_account_id === uid &&
		(status.visibility === "unlisted" ||
			relayVisibility.includes(status.visibility))
	) {
		return verifyThread(
			uid,
			searchSpace.find((s) => s.id === status.in_reply_to_id)!,
			searchSpace,
			relayVisibility,
			false,
		);
	} else if (
		!status.in_reply_to_account_id &&
		!initialCall &&
		status.visibility === "public"
	) {
		return true;
	} else {
		return false;
	}
}

export async function getNewToots(
	client: Mastodon,
	uid: string,
	lastTootTime: Date,
	constraint: Constraint,
	relayVisibility: string[],
) {
	const statuses = await client.getAccountStatuses(uid, {
		limit: 50,
		exclude_reblogs: true,
		exclude_replies: false,
		only_media: false,
	});
	const statuses_data = await statuses.data;
	const statuses_filtered = statuses_data.filter((status) => {
		const newPost = new Date(status.created_at) > lastTootTime;
		const isInVisibilityScope = relayVisibility.includes(status.visibility);
		const isNotMention = status.mentions.length === 0;
		const text = convert(status.content ?? "", {
			wordwrap: false,
			preserveNewlines: false,
		});
		const regex = new RegExp(`${constraint.relayMarker}`, "m");
		const containsMarker = text.match(regex) !== null;
		const isSelfFaved = status.favourited;

		if (constraint.relayCriteria === "favedBySelf" && !isSelfFaved) {
			return false;
		}

		if (constraint.relayCriteria === "containsMarker" && !containsMarker) {
			return false;
		}

		if (constraint.relayCriteria === "notContainsMarker" && containsMarker) {
			return false;
		}

		// due to the way some mastodon clients handle threads, we need to check if the status may be a thread
		const isThread = verifyThread(
			uid,
			status,
			statuses_data,
			relayVisibility,
			true,
		);

		return newPost && (isInVisibilityScope || isThread) && isNotMention;
	});

	return statuses_filtered;
}
