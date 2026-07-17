# ── Stage 1: Builder ──────────────────────────────────────
# Node.js image to install dependencies and build React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json first
# Docker cache trick: if package.json unchanged → skip npm install
COPY package.json .

# Install all dependencies
RUN npm install

# Copy rest of the source code
COPY . .

# Build React app → outputs to /app/dist/
RUN npm run build


# ── Stage 2: Runtime ──────────────────────────────────────
# Nginx serves the built static files
# No Node.js in production → smaller and more secure image
FROM nginx:alpine

# Copy built React files from builder stage into Nginx's serve folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]