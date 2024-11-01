import { Mastodon } from "megalodon";
import { domainToUrl, logSchedulerEvent } from "../utils";
import {
  db,
} from "../db";

export default async function cleanupJob() {
  console.log("Running scheduled job: verify instance app credentials...");

  const users = await db.user.findMany({
    include: {
      mastodonInstance: true,
    },
  });

  users.forEach((user) => {
    const userClient = new Mastodon(
      domainToUrl(user.mastodonInstance.url),
      user.mastodonToken
    );

    userClient.verifyAppCredentials().then((response) => {
      logSchedulerEvent(
        user.name,
        user.mastodonInstance.url,
        "CREDENTIAL_CHECK",
        `${response.status}: ${response.statusText}`
      );
    }).catch((error) => {
      logSchedulerEvent(
        user.name,
        user.mastodonInstance.url,
        "CREDENTIAL_CHECK",
        `${(error as Response).status}: ${(error as Response).statusText}`
      );

      if((error as Response).status === 401) {
        logSchedulerEvent(
          user.name,
          user.mastodonInstance.url,
          "CREDENTIAL_CHECK",
          "Deleting user due to invalid credentials"
        );
        db.user.delete({
          where: {
            id: user.id,
          },
        }).then((res) => {
          logSchedulerEvent(
            user.name,
            user.mastodonInstance.url,
            "CREDENTIAL_CHECK",
            "User deleted"
          );
        }).catch((err) => {
          logSchedulerEvent(
            user.name,
            user.mastodonInstance.url,
            "CREDENTIAL_CHECK",
            "Could not delete user"
          );
          console.error(err);
        });
      }
    });
  });

  const instances = await db.mastodonInstance.findMany({
    include: {
      _count: {
        select: {
          users: true,
        },
      }
    }
  })

  instances.forEach((instance) => {
    logSchedulerEvent(
      "SYSTEM",
      instance.url,
      "INSTANCE_USERS",
      `${instance._count.users
      } users`
    );
    
    if (instance._count.users === 0) {
      logSchedulerEvent(
        "SYSTEM",
        instance.url,
        "INSTANCE_USERS",
        "Deleting instance due to no users"
      );

      db.mastodonInstance.delete({
        where: {
          id: instance.id,
        },
      }).then((res) => {
        logSchedulerEvent(
          "SYSTEM",
          instance.url,
          "INSTANCE_USERS",
          "Instance deleted"
        );
      }).catch((err) => {
        logSchedulerEvent(
          "SYSTEM",
          instance.url,
          "INSTANCE_USERS",
          "Could not delete instance"
        );
        console.error(err);
      });
    }
  });
}
