FROM node:20-alpine AS base

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy root monorepo files and package manifests
COPY package*.json ./
COPY packages/database/package*.json ./packages/database/
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci

# Copy database schema and generate Prisma client
COPY packages/database ./packages/database
RUN npx --prefix packages/database prisma generate --schema=packages/database/prisma/schema.prisma

# Copy API source and build
COPY apps/api ./apps/api
RUN npm --workspace=@hrms/api run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/database ./packages/database
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/package*.json ./apps/api/
COPY --from=base /app/package*.json ./

# Ensure uploads directories exist
RUN mkdir -p /app/uploads/attendance /app/uploads/avatars

EXPOSE 4000

# Run prisma db push before starting API to ensure schema is synced
CMD ["sh", "-c", "npx --prefix packages/database prisma db push --skip-generate --schema=packages/database/prisma/schema.prisma && node apps/api/dist/main.js"]
