FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependencies
COPY package*.json ./
COPY packages/database/package*.json ./packages/database/
COPY apps/web/package*.json ./apps/web/

RUN npm ci

# Copy web source
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_API_URL=https://api-hr.superbeeaeronautics.com/api
ARG NEXT_PUBLIC_WS_URL=https://api-hr.superbeeaeronautics.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Build web application
RUN npm --workspace=@hrms/web run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/web/package*.json ./apps/web/
COPY --from=base /app/package*.json ./

USER nextjs

EXPOSE 3000

CMD ["npx", "next", "start", "apps/web", "-p", "3000"]
