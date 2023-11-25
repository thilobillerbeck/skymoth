FROM oven/bun:1 as base
WORKDIR /usr/src/app
COPY . .
COPY --from=node:18 /usr/local/bin/node /usr/local/bin/node
RUN bun install
RUN bun run tailwind:build
RUN bunx prisma generate
ENV NODE_ENV=production
EXPOSE 3000
ENV ADDRESS=0.0.0.0 PORT=3000
ENTRYPOINT [ "bun", "run", "start" ]