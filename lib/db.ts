import { PrismaClient } from "@prisma/client";
export const db = new PrismaClient();

export async function getUserByMastodonUid(userId: string, instanceId: string) {
    return await db.user.findFirst({
        where: {
            mastodonUid: userId,
            mastodonInstanceId: instanceId
        }
    });
}

export async function getInstanceByDomain(url: string) {
    return await db.mastodonInstance.findFirst({
        where: {
            url: url
        }
    })
}

export async function updateLastPostTime(userId: string, postTime: Date) {
    return await db.user.update({
        where: {
            id: userId
        },
        data: {
            lastTootTime: postTime
        }
    })
}