# Build from the repository root: docker build -f backend/Dockerfile .
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
# database/setup.js resolves dependencies from ../backend, so keep this layout
COPY database /app/database
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
