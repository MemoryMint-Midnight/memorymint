FROM node:22-slim

WORKDIR /app

# Copy package files from midnight/ root (shared deps)
COPY ../package.json ../package-lock.json* ./

RUN npm ci --omit=dev

# Copy compiled service output
COPY dist/ ./dist/

EXPOSE 4000

CMD ["node", "dist/index.js"]
