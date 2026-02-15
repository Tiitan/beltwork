FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace @beltwork/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 5173
CMD ["npm", "run", "preview", "--workspace", "@beltwork/web", "--", "--host", "0.0.0.0", "--port", "5173"]
