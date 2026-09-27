FROM node:24-alpine
WORKDIR /app
COPY hub/server.ts ./
COPY hub/public ./public
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.ts"]
