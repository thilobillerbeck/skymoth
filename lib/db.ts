import { ReplyRef } from '@atproto/api/dist/client/types/app/bsky/feed/post';
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
    const user = await db.user.findFirst({
        where: {
            id: userId
        }
    })
    if (!user) return
    if (user?.lastTootTime > postTime) return
    return await db.user.update({
        where: {
            id: userId
        },
        data: {
            lastTootTime: postTime
        }
    })
}

export async function storeRepostRecord(userId: string, tootId: string, repRef: ReplyRef) {
    return await db.repost.create({
        data: {
            userId: userId,
            tootId: tootId,
            bsParentCid: repRef.parent.cid,
            bsRootCid: repRef.root.cid,
            bsRootUri: repRef.root.uri,
            bsParentUri: repRef.parent.uri
        },
    })
}

export async function findParentToot(userId: string, tootId: string): Promise<ReplyRef | null> {
    const repost = await db.repost.findFirst({
        where: {
            userId: userId,
            tootId: tootId
        }
    })

    if (!repost) return null

    const repRef: ReplyRef = {
        root: {
            cid: repost.bsRootCid,
            uri: repost.bsRootUri
        },
        parent: {
            cid: repost.bsParentCid,
            uri: repost.bsParentUri
        }
    }

    return repRef
}