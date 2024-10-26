import { MegalodonInterface, Mastodon } from 'megalodon'

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

export async function getNewToots(client: Mastodon, uid: string, lastTootTime: Date) {
    const statusses = await client.getAccountStatuses(uid, {
        limit: 50,
        exclude_reblogs: true,
        exclude_replies: false,
        only_media: false
    });
    const statusses_data = await statusses.data;
    const statusses_filtered = statusses_data.filter((status) => {
        return (status.visibility === 'public') &&
            (status.mentions.length === 0) &&
            (new Date(status.created_at) > lastTootTime);
    });
    return statusses_filtered;
}