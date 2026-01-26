# Docker-Based Development - Quick Start Guide

## ✨ What You Get

A **complete Docker-based development environment** where everything runs in containers:
- ✅ No Go installation needed
- ✅ No Node.js installation needed
- ✅ No PostgreSQL installation needed
- ✅ Hot reload for both API and Frontend
- ✅ Database migrations run automatically
- ✅ One command to start everything

## 🚀 First Time Setup (2 minutes)

### Step 1: Prerequisites
Only need Docker installed:
```bash
# Check Docker is installed
docker --version
docker compose version
```

> **Note**: We use Docker Compose V2 (`docker compose`). It's included in Docker Desktop and modern Docker installations.

### Step 2: Setup Environment
```bash
# Create .env file
make setup

# Edit .env with your credentials
nano .env
```

Set these two values in .env:
```bash
DB_PASSWORD=your_password_here
ENC_MASTER_KEY=your_32_character_encryption_key
```

### Step 3: Start Everything
```bash
make dev
```

That's it! Wait ~30 seconds for everything to start.

## 🎯 What Just Happened?

The `make dev` command started 4 Docker containers:

1. **PostgreSQL** - Database server with 7 databases
2. **API** - Go server with hot reload (Air)
3. **Frontend** - React app with Vite HMR
4. **Migrate** - Runs migrations automatically

## 🌐 Access Your App

After `make dev` completes:

- **Frontend**: Open http://localhost:5173
- **API**: Open http://localhost:4000/health
- **Database**: Connect with any PostgreSQL client to localhost:5432

## 🔥 Hot Reload Demo

### Test API Hot Reload
1. Edit any Go file in `internal/`
2. Save the file
3. Watch the logs: `make api-logs`
4. See "Building..." → "Running..."
5. API automatically restarted!

### Test Frontend Hot Reload
1. Edit any file in `frontend/src/`
2. Save the file
3. Browser updates instantly (no refresh needed)

## 📋 Essential Commands

```bash
make dev          # Start everything
make stop         # Stop everything
make logs         # View all logs
make status       # Check what's running
make health       # Health check all services
```

## 🗄️ Working with Database

### Connect to Database
```bash
# Connect to account database
make db-shell DB=account

# Now you're in psql
\dt              # List tables
\d accounts      # Describe table
SELECT * FROM accounts LIMIT 10;
\q               # Quit
```

### Run Migrations
```bash
make migrate
```

### Backup Database
```bash
make backup
# Creates: backups/backup_20260125_120000.sql
```

## 🐛 Common Issues

### Port Already in Use
```bash
# Edit .env and change the port
DB_PORT=5433

# Restart
make restart
```

### Container Won't Start
```bash
# Check logs
make logs

# Rebuild from scratch
make rebuild
```

### Reset Everything
```bash
# Stop and remove all data
make clean

# Start fresh
make dev
```

## 🎓 Development Workflow

### Daily Development
```bash
# Morning: Start the stack
make dev

# Check it's running
make health

# View logs if needed
make logs

# Afternoon: Made changes? Just save files
# - Go files → API auto-reloads
# - React files → Browser updates instantly

# Evening: Stop when done
make stop
```

### Working on API
```bash
# Start stack
make dev

# Open shell in API container
make shell

# Now you can run Go commands:
go test ./internal/account
go build ./cmd/server
```

### Working on Database
```bash
# Connect to database
make db-shell DB=account

# Run queries directly
SELECT * FROM accounts;

# Exit
\q
```

## 🔍 Monitoring

### Check All Services
```bash
make status
```

Example output:
```
NAME              STATUS       PORTS
money-postgres    Up (healthy) 0.0.0.0:5432->5432/tcp
money-api         Up (healthy) 0.0.0.0:4000->4000/tcp
money-frontend    Up           0.0.0.0:5173->5173/tcp
```

### View Logs
```bash
# All services
make logs

# Just API
make api-logs

# Just Frontend
make frontend-logs

# Just Database
make db-logs
```

### Health Check
```bash
make health
```

Example output:
```
  Database:  ✓ Healthy
  API:       ✓ Healthy
  Frontend:  ✓ Healthy
```

## 📚 Next Steps

- See `README.md` for complete documentation
- See `MIGRATION.md` for migration details
- Run `make` to see all available commands

## 💡 Pro Tips

1. **Keep it Running**: Leave `make dev` running while developing. Hot reload handles everything.

2. **Use Multiple Terminals**:
   - Terminal 1: `make dev` (main process)
   - Terminal 2: `make logs` (view logs)
   - Terminal 3: `make shell` (run commands)

3. **Quick Health Check**: Run `make health` anytime to verify everything is working.

4. **Database Work**: Use `make db-shell DB=<name>` to quickly jump into any database.

5. **Clean Start**: If things feel weird, `make rebuild` resets everything.

## 🆘 Get Help

Something not working?

1. Check status: `make status`
2. View logs: `make logs`
3. Try restart: `make restart`
4. Last resort: `make rebuild`

Still stuck? Check the full docs in `README.md`.

---

**Happy coding! 🚀**
