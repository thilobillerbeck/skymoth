import generator, { Entity, MegalodonInterface, WebSocketInterface } from 'megalodon'

export async function initMastodonAgent() {
    return generator('mastodon', process.env.MASTODON_URL!, process.env.MSTODON_TOKEN!)
}

export async function getUserIdFromMastodonHandle(handle: string, client: MegalodonInterface) {
    const a = await client.searchAccount(handle);
    const a_data = await a.data;
    return a_data[0].id;
}

export function filterStatusses(status: any) {
    return (status.visibility === 'public') &&
        (status.mentions.length === 0);
}

export function filterStatussesDate(status: any) {
    return (status.visibility === 'public') &&
        (status.mentions.length === 0) &&
        (new Date(status.created_at));
}

export async function getLatestToot(client: MegalodonInterface, uid: string) {
    const statusses = await client.getAccountStatuses(uid, {
        exclude_reblogs: true,
        exclude_replies: true,
        limit: 50
    });
    const statusses_data = await statusses.data;
    const statusses_filtered = statusses_data.filter(filterStatusses);
    return statusses_filtered[0];
}

export async function getNewToots(client: MegalodonInterface, uid: string, lastTootTime: Date) {
    const statusses = await client.getAccountStatuses(uid, {
        exclude_reblogs: true,
        exclude_replies: true,
        limit: 50
    });
    const statusses_data = await statusses.data;
    const statusses_filtered = statusses_data.filter((status) => {
        return (status.visibility === 'public') &&
            (status.mentions.length === 0) &&
            (new Date(status.created_at) > lastTootTime);
    });
    return statusses_filtered;
}