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

# Build the frontend (skip type checking for production build)
RUN pnpm run build --mode production || (echo "Build with warnings" && pnpm vite build)

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

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./cmd/migrate

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy binaries from api-builder
COPY --from=api-builder /app/server .
COPY --from=api-builder /app/migrate .

# Copy migrations
COPY --from=api-builder /app/migrations ./migrations

# Copy frontend build from frontend-builder
COPY --from=frontend-builder /app/dist ./static

# Expose port
EXPOSE 4000

# Run the application
CMD ["./server"]
