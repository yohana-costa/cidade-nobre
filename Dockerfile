# Imagem unica com dois alvos para a VPS (docker-compose.yml):
#   api -> Express + Prisma (aplica as migrations ao subir)
#   web -> nginx com o site estatico, repassando /api para a API
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# o postinstall roda prisma generate, entao o schema precisa estar aqui antes do npm ci
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# compila backend/src, api/ e prisma/seed.ts em build/ (mesma estrutura de pastas)
RUN npx tsc -p tsconfig.json --noEmit false --outDir build && npm run build

FROM node:20-bookworm-slim AS api
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/build ./build
COPY docker/entrypoint.sh ./entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["sh", "./entrypoint.sh"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
