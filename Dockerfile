FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/ai-rag/package.json packages/ai-rag/package.json
COPY packages/cms-ai/package.json packages/cms-ai/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec tsc -p tsconfig.json && mkdir -p /app/.data/uploads && chown -R node:node /app/.data
USER node
EXPOSE 3001
CMD ["node","dist/apps/api/src/main.js"]
