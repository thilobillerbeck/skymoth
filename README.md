<p align="center">
  <img src="public/images/logo.svg" width="256">
</p>

# Skymoth - Toots to the Sky

Skymoth is an open source service which allows you to share the content you post on Mastodon over to Bluesky. This allows you to stay in touch with your followers on both platforms.

## Features

- Reposting toots over to Bluesky in a regular interval
- Reposting text (and handle threads)
- Reposting (multiple) images with alt descriptions

## Migrating from <= v0.3.2 to > v0.4.0

With v0.4.0 Drizzle will be the new ORM of choice. Thus Prisma and its migration tracking table
will be dropped accordingly. To make the upgrading process go smoothly, Skymoth checks if all migrations
from Prisma have been applied before migrating. If you have an instance running on a version below v0.3.2 
upgrade to v0.3.2 first before upgrading to v0.4.0 and above.

Additionally, Drizzle will execute its migrations automatically on app startup, so there is no need to run `pnpm migrate`
after an update.

## Development

For development using [Cachix Devenv](https://devenv.sh/) is strongly advised.
After setting up, you can just enter this projects shell just run:

```bash
pnpm install
```

Don't worry, if set up correctly the development shell you are in should contain all development tools needed for this project.

```bash
devenv up
```

## FAQ

### Is this free to use?
Yes, I will set up some kind of donation system to help keep this project and the infrastructure alive. But you can use this completely free without paying anything.

### Can I host this myself?
Yes, this project can be indeed selfhosted, though this is not designed with selfhosting in mind. Though I would kindly ask you to keep your instances private to avoid confusion with this project and its infrastructure.

### *@()#$* - Something went wrong!
I know, social networks are big and complicated and handling content from a federated network is even more so. Since this is a one man show at the moment, please be patient if errors occur or the infrastructure has problems. You can be assured I'll do my best to fix stuff as quickly as I can.