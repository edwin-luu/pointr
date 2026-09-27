ARG APP

FROM node:24-alpine AS build
ARG APP
WORKDIR /repo
COPY . .
RUN npm ci && npm run build -w ${APP}

FROM nginx:alpine
ARG APP
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/${APP}/dist /usr/share/nginx/html
EXPOSE 80
