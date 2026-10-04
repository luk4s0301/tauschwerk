FROM node:24-alpine
ARG BUILD_VERSION
ARG BUILD_ARCH
LABEL io.hass.version="$BUILD_VERSION" io.hass.type="addon" io.hass.arch="$BUILD_ARCH"
WORKDIR /app
COPY package.json server.mjs server-policy.mjs core.mjs online.mjs online-parser.mjs remote.mjs device-images.mjs market-value.mjs online-search.mjs online-sources.mjs online-catalogs.mjs catalog.json ./
COPY public/ ./public/
ENV TAUSCHWERK_HOME_ASSISTANT=1 TAUSCHWERK_DATA=/data
EXPOSE 8099
CMD ["node", "server.mjs"]
