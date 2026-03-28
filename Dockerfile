# Build stage — install all deps, compile TS, and bundle frontend
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json webpack.config.cjs ./
COPY src/ src/
COPY public/ public/

RUN npx tsc -p tsconfig.build.json && \
    npx webpack --config webpack.config.cjs --mode production

# Production deps only
RUN rm -rf node_modules && npm ci --omit=dev

# Runtime stage — distroless
FROM gcr.io/distroless/nodejs24-debian13

WORKDIR /app

COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/dist/ dist/
COPY --from=build /app/public/ public/

EXPOSE 3000

CMD ["dist/server.js"]
