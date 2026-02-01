# =============================================================================
# Moneyy - Single Production Docker Image
# =============================================================================
# Build: docker build -t moneyy .
# Run:   docker run -p 4000:4000 -v moneyy-data:/app/data -e ENC_MASTER_KEY=... moneyy
# =============================================================================

# Frontend build stage
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy frontend package files
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build argument for API URL
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend
RUN pnpm run build --mode production

# API build stage
FROM golang:1.24-alpine AS api-builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with proper architecture detection
# Using pure Go SQLite driver (modernc.org/sqlite) - no CGO needed
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -a -installsuffix cgo -o server ./cmd/server

# Final stage - minimal production image
FROM alpine:3.19

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user for security
RUN addgroup -g 1000 moneyy && \
    adduser -u 1000 -G moneyy -s /bin/sh -D moneyy

# Set working directory
WORKDIR /app

# Copy binary from api-builder
COPY --from=api-builder /app/server .

# Copy migrations
COPY --from=api-builder /app/migrations ./migrations

# Copy frontend build from frontend-builder
COPY --from=frontend-builder /app/dist ./static

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R moneyy:moneyy /app

# Switch to non-root user
USER moneyy

# Environment defaults
ENV DB_PATH=/app/data/moneyy.db \
    SERVER_PORT=4000 \
    LOG_LEVEL=info \
    LOG_FORMAT=json

# Volume for persistent SQLite data
VOLUME ["/app/data"]

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:4000/api/health || exit 1

# Run the application
CMD ["./server"]
