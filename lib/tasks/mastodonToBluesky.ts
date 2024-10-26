import { Mastodon } from "megalodon";
import { getNewToots } from "../mastodon";
import { generateBlueskyPostsFromMastodon, intiBlueskyAgent } from "../bluesky";
import { domainToUrl, logSchedulerEvent } from "../utils";
import {
  db,
  updateLastPostTime,
  storeRepostRecord,
  findParentToot,
} from "../db";
import { ReplyRef } from "@atproto/api/dist/client/types/app/bsky/feed/post";

export default async function taskMastodonToBluesky() {
  console.log("Running scheduled job: reposting to bluesky...");

  const users = await db.user.findMany({
    include: {
      mastodonInstance: true,
    },
  });

  users.forEach(async (user) => {
    if (!user.blueskyHandle || !user.blueskyToken) {
      logSchedulerEvent(
        user.name,
        user.mastodonInstance.url,
        "CREDENTIAL_CHECK",
        "no bluesky creds"
      );
      return;
    }

    const userClient = new Mastodon(
      domainToUrl(user.mastodonInstance.url),
      user.mastodonToken
    );
    let posts = await getNewToots(
      userClient,
      user.mastodonUid,
      user.lastTootTime
    );

    if (posts.length === 0) {
      logSchedulerEvent(
        user.name,
        user.mastodonInstance.url,
        "REPOSTER",
        "no new posts"
      );
      return;
    }

    const blueskyClient = await intiBlueskyAgent(
      "https://bsky.social",
      user.blueskyHandle,
      user.blueskyToken,
      user
    );

    if (blueskyClient === undefined) {
      return;
    }

    posts = posts.reverse();

    for (const post of posts) {
      try {
        logSchedulerEvent(
          user.name,
          user.mastodonInstance.url,
          "REPOSTER",
          `posting ${post.id}`
        );
        const postsBsky = await generateBlueskyPostsFromMastodon(
          post,
          blueskyClient
        );

        if (postsBsky.length === 0) return;

        let repRef: ReplyRef = {
          root: undefined!,
          parent: undefined!,
        };

        /*
                    if(post.in_reply_to_id) {
                        const repostRef = await findParentToot(user.id, post.in_reply_to_id);
                        if (repostRef) {
                            console.log("FOUND REPLY REF", repostRef)
                            repRef = repostRef;
                        }
                    }
                    */

        for (const postBsky of postsBsky) {
          if (repRef.parent !== undefined) postBsky.reply = repRef;

          let result = await blueskyClient.post(postBsky);

          if (repRef.root === undefined) repRef.root = result;
          repRef.parent = result;
        }

        await storeRepostRecord(user.id, post.id, repRef);
        await updateLastPostTime(user.id, new Date(post.created_at));
      } catch (err) {
        logSchedulerEvent(
          user.name,
          user.mastodonInstance.url,
          "REPOSTER",
          "could not repost"
        );
        console.error(err);
      }
    }
  });
}
