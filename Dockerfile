FROM node:20 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
RUN git rev-parse HEAD > .git-rev
RUN pnpm install --frozen-lockfile
RUN pnpm run tailwind:build
RUN pnpm run generate
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/.git-rev /app/.git-rev
ENV NODE_ENV=production
EXPOSE 3000
ENV ADDRESS=0.0.0.0 PORT=3000
CMD [ "pnpm", "start" ]