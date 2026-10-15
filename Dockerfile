# Multi-stage Dockerfile for a Vite + React app (production)
# Build stage
FROM node:22-alpine AS builder

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy rest of sources
COPY . .

# Build the app
RUN npm run build

# Production stage: serve with nginx
FROM nginx:stable-alpine AS production

# Remove default nginx static
RUN rm -rf /usr/share/nginx/html/*

# Copy build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config to enable SPA fallback
RUN rm /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx nginx.conf security-headers.inc /etc/nginx/conf.d/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

