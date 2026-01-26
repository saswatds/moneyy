# Setting Up the Private Managed Service Repository

This guide explains how to create a separate private repository for your paid managed service using Clerk authentication.

## Architecture Overview

**Open Source Repo (`moneyy`)**
- Core auth infrastructure (shared)
- Passkey/WebAuthn implementation
- All application features
- Self-hosted, single-user mode

**Private Repo (`moneyy-managed`)**
- Imports core auth from `moneyy`
- Clerk authentication provider
- Multi-user support
- Your paid SaaS service

## Step-by-Step Setup

### 1. Create Private Repository

```bash
# Create new private repo
mkdir moneyy-managed
cd moneyy-managed
git init
gh repo create moneyy-managed --private --source=. --remote=origin
```

### 2. Initialize Go Module

```go.mod
module github.com/yourusername/moneyy-managed

go 1.24

require (
    github.com/yourusername/moneyy v0.0.0  // Replace with actual version/commit
    github.com/clerk/clerk-sdk-go/v2 v2.5.1
    github.com/go-chi/chi/v5 v5.0.0
    github.com/lib/pq v1.10.9
    // ... other dependencies
)
```

### 3. Repository Structure

```
moneyy-managed/
├── cmd/
│   └── server/
│       ├── main.go                 # Server with Clerk provider
│       └── auth.go                 # Initialize Clerk provider
├── internal/
│   └── auth/
│       └── clerk/
│           ├── provider.go         # Clerk AuthProvider implementation
│           └── handlers.go         # Clerk-specific endpoints (if needed)
├── frontend/                       # Your frontend (can import moneyy frontend)
│   └── src/
│       ├── components/
│       │   └── auth/
│       │       └── ClerkAuthProvider.tsx
│       └── App.tsx                 # With Clerk integration
├── migrations/                     # Symlink or copy from moneyy
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── .env.example
└── README.md
```

### 4. Implement Clerk Provider

**internal/auth/clerk/provider.go**

```go
package clerk

import (
    "context"
    "database/sql"
    "fmt"
    "log"
    "net/http"
    "os"

    // Import from open source repo
    "github.com/yourusername/moneyy/internal/auth"

    "github.com/clerk/clerk-sdk-go/v2"
    "github.com/clerk/clerk-sdk-go/v2/jwt"
    "github.com/go-chi/chi/v5"
)

type ClerkAuthProvider struct {
    db          *sql.DB
    secretKey   string
    userRepo    *auth.UserRepository
    sessionRepo *auth.SessionRepository
}

func NewClerkAuthProvider(db *sql.DB) (*ClerkAuthProvider, error) {
    secretKey := os.Getenv("CLERK_SECRET_KEY")
    if secretKey == "" {
        return nil, fmt.Errorf("CLERK_SECRET_KEY environment variable is required")
    }

    clerk.SetKey(secretKey)

    return &ClerkAuthProvider{
        db:          db,
        secretKey:   secretKey,
        userRepo:    auth.NewUserRepository(db),
        sessionRepo: auth.NewSessionRepository(db),
    }, nil
}

func (p *ClerkAuthProvider) Initialize(ctx context.Context) error {
    log.Println("Clerk authentication initialized")
    return nil
}

func (p *ClerkAuthProvider) VerifyToken(ctx context.Context, token string) (string, error) {
    // Verify Clerk JWT
    claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
        Token: token,
    })
    if err != nil {
        return "", fmt.Errorf("invalid Clerk token: %w", err)
    }

    // Sync user to local database
    user, err := p.syncUser(ctx, claims)
    if err != nil {
        return "", fmt.Errorf("failed to sync user: %w", err)
    }

    return user.ID, nil
}

func (p *ClerkAuthProvider) syncUser(ctx context.Context, claims *jwt.Claims) (*auth.User, error) {
    user, err := p.userRepo.GetByClerkID(ctx, claims.Subject)
    if err == sql.ErrNoRows {
        // Extract email from claims
        email := ""
        if claims.Extra != nil {
            if emailVal, ok := claims.Extra["email"].(string); ok {
                email = emailVal
            }
        }

        if email == "" {
            return nil, fmt.Errorf("no email found in Clerk claims")
        }

        // Create new user
        name := ""
        if claims.Extra != nil {
            if firstName, ok := claims.Extra["first_name"].(string); ok {
                name = firstName
                if lastName, ok := claims.Extra["last_name"].(string); ok {
                    name = firstName + " " + lastName
                }
            }
        }

        user = &auth.User{
            Email:       email,
            Name:        name,
            ClerkUserID: claims.Subject,
        }

        err = p.userRepo.Create(ctx, user)
        if err != nil {
            return nil, fmt.Errorf("failed to create user: %w", err)
        }

        log.Printf("Created new user from Clerk: %s (%s)", user.Email, user.ID)
    } else if err != nil {
        return nil, err
    }

    return user, nil
}

func (p *ClerkAuthProvider) GetAuthMode() string {
    return "clerk"
}

func (p *ClerkAuthProvider) RegisterRoutes(r chi.Router) {
    // Clerk handles auth on frontend
    r.Get("/status", p.handleStatus)
}

func (p *ClerkAuthProvider) handleStatus(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"mode":"clerk","provider":"clerk"}`))
}
```

**cmd/server/auth.go**

```go
package main

import (
    "database/sql"

    "github.com/yourusername/moneyy/internal/auth"
    "github.com/yourusername/moneyy-managed/internal/auth/clerk"
)

func initializeAuthProvider(db *sql.DB) (auth.AuthProvider, error) {
    return clerk.NewClerkAuthProvider(db)
}
```

**cmd/server/main.go**

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"

    // Import from open source repo
    "github.com/yourusername/moneyy/internal/auth"
    "github.com/yourusername/moneyy/internal/database"
    "github.com/yourusername/moneyy/internal/env"
    "github.com/yourusername/moneyy/internal/logger"
    "github.com/yourusername/moneyy/internal/server"

    // Import all service packages from moneyy
    "github.com/yourusername/moneyy/internal/account"
    "github.com/yourusername/moneyy/internal/balance"
    // ... etc

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    "github.com/go-chi/cors"
)

func main() {
    // Same as moneyy/cmd/server/main.go
    // But uses Clerk auth provider from this repo

    env.MustLoad()
    logger.Init()
    logger.Info("Starting Money Managed Service")

    // ... same database and service setup ...

    // Initialize Clerk auth provider
    authProvider, err := initializeAuthProvider(db)
    if err != nil {
        log.Fatalf("Failed to initialize auth: %v", err)
    }

    err = authProvider.Initialize(context.Background())
    if err != nil {
        log.Fatalf("Failed to initialize auth provider: %v", err)
    }

    logger.Info("Authentication initialized", "mode", authProvider.GetAuthMode())

    // ... same routing setup as moneyy ...
}
```

### 5. Environment Variables

**.env.example**

```bash
# Managed Service Configuration (Clerk Authentication)

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=moneyy_managed
DB_SSLMODE=disable

# Server
SERVER_PORT=4000
CORS_ORIGINS=http://localhost:5173

# Clerk Authentication (REQUIRED)
CLERK_SECRET_KEY=sk_live_your-clerk-secret-key
CLERK_PUBLISHABLE_KEY=pk_live_your-clerk-publishable-key

# Encryption
ENC_MASTER_KEY=your-encryption-key-here
```

### 6. Frontend Integration

**frontend/src/App.tsx**

```tsx
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { DashboardLayout } from './components/layout/DashboardLayout';
// ... other imports

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SignedIn>
            <Routes>
              <Route path="/" element={<DashboardLayout />}>
                {/* All your routes */}
              </Route>
            </Routes>
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
```

**frontend/src/lib/api-client.ts**

```tsx
import { useAuth } from '@clerk/clerk-react';

// Update ApiClient to get token from Clerk
class ApiClient {
  private getToken: () => Promise<string | null>;

  constructor() {
    this.getToken = async () => {
      const { getToken } = useAuth();
      return await getToken();
    };
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // ... rest of ApiClient methods
}
```

### 7. Build & Deploy

**Dockerfile**

```dockerfile
# Copy from moneyy Dockerfile but without BUILD_TAGS
# Uses go.mod to import moneyy packages

FROM golang:1.24-alpine AS api-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# ... rest same as moneyy
```

**Makefile**

```makefile
build:
	CGO_ENABLED=0 go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

docker-build:
	docker build -t moneyy-managed:latest .

deploy:
	# Your deployment commands for the paid service
```

## Using the Open Source Repo

### Option 1: Go Modules (Recommended)

Reference the open source repo via Go modules:

```bash
# In moneyy-managed
go get github.com/yourusername/moneyy@main
```

### Option 2: Git Submodule

Use the open source repo as a submodule:

```bash
git submodule add https://github.com/yourusername/moneyy vendor/moneyy
```

### Option 3: Vendor

Copy core packages into your vendor directory (less maintainable).

## Benefits of This Architecture

✅ **Clean separation**: Open source users never see Clerk code
✅ **Code reuse**: Share core auth, services, and logic
✅ **Independent deployment**: Deploy managed service separately
✅ **Easy updates**: Pull changes from open source repo
✅ **Different pricing**: Paid managed vs free self-hosted
✅ **Custom features**: Add paid-only features to managed repo

## Migration Path

When pulling updates from the open source repo:

```bash
# In moneyy-managed
go get -u github.com/yourusername/moneyy@latest
go mod tidy
```

Test that auth integration still works, then deploy.

## Security Considerations

1. **Never commit Clerk keys** to git
2. **Use different databases** for dev/staging/prod
3. **Enable Clerk production checks** in production
4. **Set up proper CORS** for your domain
5. **Use HTTPS** in production
6. **Monitor Clerk usage** and billing

## Next Steps

1. Create the private repo
2. Set up Clerk application at https://dashboard.clerk.com
3. Implement Clerk provider using code above
4. Test locally with Clerk dev keys
5. Deploy to your infrastructure
6. Set up billing/subscriptions (Stripe, etc.)
