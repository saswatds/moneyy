# Money App - Docker-Based Development

A complete personal finance management application running entirely in Docker containers.

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (includes Docker Compose V2)
- That's it! No need for Go, Node, or PostgreSQL locally

> **Note**: This project uses Docker Compose V2 (`docker compose` command, not `docker-compose`). Make sure you have Docker Desktop or Docker CLI with Compose plugin installed.

### First Time Setup

```bash
# 1. Clone the repository
git clone <your-repo>
cd money

# 2. Run setup (creates .env file)
make setup

# 3. Edit .env with your credentials
# - Set DB_PASSWORD
# - Set ENC_MASTER_KEY (32 character string)

# 4. Start the entire stack
make dev
```

That's it! The application will be available at:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:4000
- **Database**: localhost:5432

## 📋 Available Commands

Run `make` or `make help` to see all available commands.

### Essential Commands

```bash
make dev              # Start entire stack (database + API + frontend)
make stop             # Stop all services
make logs             # View logs from all services
make status           # Check status of all containers
make health           # Health check for all services
```

### Development Commands

```bash
make api-logs         # View API logs only
make frontend-logs    # View frontend logs only
make db-logs          # View database logs
make shell            # Open shell in API container
make restart          # Restart all services
```

### Database Commands

```bash
make migrate          # Run database migrations
make db-shell DB=account  # Connect to specific database
make backup           # Backup all databases
make restore FILE=<backup-file>  # Restore from backup
```

### Build Commands

```bash
make build            # Build production images
make rebuild          # Rebuild everything from scratch
make clean            # Remove all containers and volumes
```

## 🏗️ Architecture

### Development Stack
- **PostgreSQL 16**: 7 databases (account, balance, currency, holdings, projections, sync, transaction)
- **Go API Server**: Runs with hot reload (Air)
- **React Frontend**: Runs with Vite dev server and hot module replacement
- **Docker Volumes**: Persistent data and Go module caching

### Services

```
money-postgres    → PostgreSQL database container
money-api         → Go API server with hot reload
money-frontend    → React frontend with hot reload
money-migrate     → One-time migration runner
```

## 🔥 Hot Reload

**Both API and Frontend have hot reload enabled!**

- **API**: Uses Air for hot reload
  - Edit any Go file → API automatically rebuilds and restarts
  - Build cache persists in Docker volumes for fast rebuilds

- **Frontend**: Uses Vite's HMR
  - Edit any React/TypeScript file → instant updates in browser
  - No page refresh needed

## 📊 Monitoring

### Check Service Status
```bash
make status
```

### View Logs
```bash
# All services
make logs

# Specific service
make api-logs
make frontend-logs
make db-logs
```

### Health Checks
```bash
make health
```

Output example:
```
  Database:  ✓ Healthy
  API:       ✓ Healthy
  Frontend:  ✓ Healthy
```

## 🗄️ Database Management

### Connect to Database
```bash
# Open psql shell for specific database
make db-shell DB=account
make db-shell DB=balance
# etc.
```

### Run Migrations
```bash
make migrate
```

### Backup & Restore
```bash
# Create backup
make backup
# Creates file: backups/backup_20260125_120000.sql

# Restore from backup
make restore FILE=backups/backup_20260125_120000.sql
```

## 🐛 Debugging

### Access API Container
```bash
make shell
# Now you're inside the container
# Run go commands, check files, etc.
```

### Check Specific Service
```bash
# Start only API
make api

# Start only frontend
make frontend

# Start only database
make db
```

### View Specific Logs
```bash
# API logs in real-time
docker compose logs -f api

# Check last 100 lines
docker compose logs --tail=100 api
```

## 🏭 Production Deployment

### Build Production Images
```bash
make build
```

### Deploy with Production Compose
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Environment Variables for Production
Create `.env.prod`:
```bash
# Database
DB_HOST=your-production-db.example.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-secure-password

# Encryption
ENC_MASTER_KEY=your-32-character-encryption-key

# Server
LOG_LEVEL=info
LOG_FORMAT=json

# URLs
API_PORT=4000
API_URL=https://api.yourdomain.com
FRONTEND_PORT=80
```

Then deploy:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

## 🧹 Cleanup

### Remove Containers (Keep Data)
```bash
make stop
```

### Remove Everything (Including Data)
```bash
make clean
# ⚠️ This removes all data! Backup first with: make backup
```

### Start Fresh
```bash
make rebuild
# Stops everything, removes volumes, rebuilds, and starts
```

## 🔧 Troubleshooting

### Containers Won't Start
```bash
# Check Docker is running
docker ps

# Check logs for errors
make logs

# Rebuild everything
make rebuild
```

### Database Connection Issues
```bash
# Check database is running
make status

# Check database health
make health

# View database logs
make db-logs

# Connect to database directly
make db-shell DB=account
```

### API Not Responding
```bash
# Check API logs
make api-logs

# Restart API only
docker compose restart api

# Rebuild API
docker compose up -d --build api
```

### Port Already in Use
Edit `.env` and change ports:
```bash
DB_PORT=5433  # Instead of 5432
```

Then:
```bash
make restart
```

## 📁 Project Structure

```
money/
├── cmd/
│   ├── server/         # API server entry point
│   └── migrate/        # Migration tool
├── internal/
│   ├── account/        # Account service
│   ├── balance/        # Balance service
│   ├── currency/       # Currency service
│   ├── holdings/       # Holdings service
│   ├── projections/    # Projections service
│   ├── sync/           # Sync service
│   ├── transaction/    # Transaction service
│   ├── database/       # Database manager
│   ├── config/         # Configuration
│   ├── logger/         # Logging
│   └── server/         # HTTP server and handlers
├── frontend/           # React frontend
├── migrations/         # Database migrations
├── scripts/            # Setup scripts
├── docker-compose.yml  # Development compose
├── docker-compose.prod.yml  # Production compose
├── Dockerfile.dev      # Development Dockerfile
├── Dockerfile          # Production Dockerfile
├── Makefile            # All commands
└── .env                # Environment variables
```

## 🎯 Development Workflow

1. **Start development**:
   ```bash
   make dev
   ```

2. **Edit code**:
   - API changes: Edit Go files → Auto-reloads
   - Frontend changes: Edit React files → Instant HMR

3. **View logs**:
   ```bash
   make logs
   ```

4. **Test changes**:
   ```bash
   make test
   ```

5. **Stop when done**:
   ```bash
   make stop
   ```

## 🆘 Getting Help

Run `make` or `make help` to see all available commands.

For issues:
1. Check `make status`
2. Check `make logs`
3. Try `make restart`
4. If stuck, `make rebuild`

## 📝 License

MIT
