 # Build stage
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build frontend
ENV VITE_API_URL=/api
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY server.js .
COPY src/services ./src/services
COPY src/utils ./src/utils
COPY prometheus.yml /etc/prometheus/prometheus.yml

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]