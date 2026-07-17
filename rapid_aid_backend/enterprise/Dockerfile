# Dockerfile for Rapid Aid 3.0 Node.js API server
FROM node:20-alpine

# Set non-root environment variables
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Install package dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/
COPY index.js ./

# Expose server port
EXPOSE 8080

# Health check setup
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "index.js"]
