#!/bin/sh
# Runs automatically as part of the official nginx image's own entrypoint mechanism (any
# executable *.sh file under /docker-entrypoint.d/ runs before nginx starts). Renders
# config.js.template into the served root from this container's own environment, so one built
# image is configured per deployment rather than rebuilt per environment — see
# src/config/appConfig.ts for why the app reads window.__APP_CONFIG__ instead of a Vite
# build-time value.
set -eu

: "${APP_API_BASE_URL:?APP_API_BASE_URL must be set}"
: "${APP_OIDC_ISSUER_URL:?APP_OIDC_ISSUER_URL must be set}"
: "${APP_OIDC_CLIENT_ID:?APP_OIDC_CLIENT_ID must be set}"
: "${APP_OIDC_AUDIENCE:?APP_OIDC_AUDIENCE must be set}"

envsubst '${APP_API_BASE_URL} ${APP_OIDC_ISSUER_URL} ${APP_OIDC_CLIENT_ID} ${APP_OIDC_AUDIENCE}' \
  < /etc/nginx/app-config/config.js.template \
  > /usr/share/nginx/html/config.js
