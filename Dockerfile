FROM node:20 AS base
ARG GIT_TAG
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack disable && npm install -g pnpm@latest
COPY . /app
WORKDIR /app
RUN if [ -n "$GIT_TAG" ]; then \
      VERSION="$GIT_TAG ($(git rev-parse --short HEAD))"; \
    else \
      VERSION="$(git describe --tags --abbrev=0) ($(git rev-parse --short HEAD))"; \
    fi && \
    echo $VERSION > .git-rev
RUN rm -rf .git

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
EXPOSE 3000
ENV ADDRESS=0.0.0.0 PORT=3000
CMD [ "pnpm", "start" ]