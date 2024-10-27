import { MegalodonInterface, Mastodon } from 'megalodon'
import { Status } from 'megalodon/lib/src/entities/status';

export function initMastodonAgent() {
    return new Mastodon('mastodon',
    process.env.MASTODON_URL!,
    process.env.MSTODON_TOKEN!)
}

export async function getUserIdFromMastodonHandle(handle: string, client: MegalodonInterface) {
    const a = await client.searchAccount(handle);
    const a_data = a.data;
    return a_data[0].id;
}

function verifyThread(uid: string, status: Status, searchSpace: Status[], initialCall: boolean = false): boolean {
    if (status.in_reply_to_account_id === uid && (
        status.visibility === 'unlisted' || status.visibility === 'public'
    )) {
        return verifyThread(
            uid,
            searchSpace.find((s) => s.id === status.in_reply_to_id),
            searchSpace,
            false
        )
    } else if (!status.in_reply_to_account_id && !initialCall && status.visibility === 'public') {
        return true
    } else {
        return false
    }
}

export async function getNewToots(client: Mastodon, uid: string, lastTootTime: Date) {
    const statusses = await client.getAccountStatuses(uid, {
        limit: 50,
        exclude_reblogs: true,
        exclude_replies: false,
        only_media: false
    });
    const statusses_data = await statusses.data;
    const statusses_filtered = statusses_data.filter((status) => {
        const newPost = new Date(status.created_at) > lastTootTime;
        const isPublic = status.visibility === 'public';
        const isNotMention = status.mentions.length === 0;

        // due to the way some mastodon clients handle threads, we need to check if the status may be a thread
        const isThread = verifyThread(uid, status, statusses_data, true);      

        return newPost && (isPublic || isThread) && isNotMention;
    });

    return statusses_filtered;
}