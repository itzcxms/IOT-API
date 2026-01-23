FROM node:10.20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY --chown=node:node . .
EXPOSE 3005
CMD ["node", "server.js"]