# Сборка: docker build --build-arg NEXT_PUBLIC_BUILD_REF=$(git rev-parse --short HEAD) -t scheduler .
# Запуск: см. `.env.example` (раздел Production) — нужен volume для SQLite или отдельный DATABASE_URL.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_BUILD_REF=unknown
ENV NEXT_PUBLIC_BUILD_REF=$NEXT_PUBLIC_BUILD_REF
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Moscow
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma engine на Alpine (OpenSSL 3 — базовые библиотеки)
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY next.config.ts ./
COPY scripts/docker-entrypoint.sh scripts/prisma-sqlite-migrate.sh ./scripts/
RUN chmod +x ./scripts/docker-entrypoint.sh ./scripts/prisma-sqlite-migrate.sh

EXPOSE 3000
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
