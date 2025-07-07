FROM node:22 AS base

# Install git
RUN apt-get update && apt-get install -y git

# Clone your repo
ARG GIT_BRANCH=main
WORKDIR /app
RUN git clone --depth=1 --branch $GIT_BRANCH https://github.com/StraySignal/skymoth.git .

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack disable && npm install --ignore-scripts -g pnpm@latest

# Optional: generate version file
RUN VERSION="$(git describe --tags --abbrev=0 2>/dev/null || echo dev) ($(git rev-parse --short HEAD))" && \
    echo $VERSION > .git-rev && rm -rf .git

# Now continue your build
FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
RUN pnpm install --frozen-lockfile
RUN pnpm run tailwind:build
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/.git-rev /app/dist/.git-rev

ENV NODE_ENV=production
ENV ADDRESS=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["pnpm", "start"]
