import { Mastodon } from "megalodon";
import { generateBueskyPostFromMastodon } from "../lib/bluesky";
import { Status } from "megalodon/lib/src/entities/status";
import { BskyAgent } from "@atproto/api";

async function test() {
    const userClient = new Mastodon("https://mastodon.social")
    const statusses = await userClient.getAccountStatuses("110859409687534722")

    const agent = new BskyAgent({
        service: "https://bsky.social"
    })

    for (const s of statusses.data) {
        const status = await generateBueskyPostFromMastodon(s, agent)
        console.log(status)
    }


}

test()