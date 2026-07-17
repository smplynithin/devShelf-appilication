# DevShelf — Complete Journey Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Phase 1 — Backend Foundation](#phase-1)
5. [Phase 2 — Frontend and Nginx](#phase-2)
6. [Phase 3 — Production Deployment](#phase-3)
7. [Docker Concepts Learned](#docker-concepts)
8. [Challenges and Fixes](#challenges)
9. [Key Learnings](#key-learnings)
10. [Future Roadmap](#future-roadmap)

---

## Project Overview

DevShelf is a personal developer bookmark and code snippet manager.
Built to demonstrate production-grade Docker skills including multi-stage builds,
custom networks, named volumes, healthchecks, Redis caching, and Nginx reverse proxy.

**What it does:**
- Save URLs with title, notes, and tags
- Save reusable code snippets with syntax highlighting
- Search everything instantly (Redis cached)
- Delete items instantly

---

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────┐  frontend-net
│  Nginx + React (port 80/443)        │
│  Serves React UI                    │
│  Routes /api/* → Backend            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐  backend-net
│  FastAPI Backend                    │
│  All business logic                 │
│  CRUD for bookmarks and snippets    │
│  Redis cache → PostgreSQL fallback  │
└──────────┬──────────────────┬───────┘
           │                  │
┌──────────▼──────┐  ┌────────▼───────┐
│  PostgreSQL     │  │  Redis         │
│  Stores all     │  │  Caches search │
│  data forever   │  │  results 5min  │
│  Named volume   │  │  Named volume  │
└─────────────────┘  └────────────────┘
```

**Network Isolation:**
```
frontend-net → Nginx talks to Backend only
backend-net  → Backend talks to PostgreSQL and Redis only
PostgreSQL and Redis are invisible to internet
Only port 80 and 443 exposed to internet
```

**Request Flow Example (search "docker"):**
```
1. You type "docker" in React search bar
2. React sends GET /api/bookmarks/search?q=docker to Nginx
3. Nginx forwards to FastAPI backend
4. FastAPI checks Redis → cache HIT? return instantly
                        → cache MISS? query PostgreSQL
5. Store result in Redis with 5min TTL
6. Return results to React
7. React renders results
```

---

## Tech Stack

| Layer     | Technology         | Container Name     |
|-----------|--------------------|--------------------|
| Frontend  | React + Vite       | devshelf-frontend  |
| Proxy     | Nginx              | devshelf-frontend  |
| Backend   | FastAPI (Python)   | devshelf-backend   |
| Database  | PostgreSQL 15      | devshelf-db        |
| Cache     | Redis 7            | devshelf-cache     |

---

## Phase 1 — Backend Foundation

### Goal
Get PostgreSQL + Redis + FastAPI running via Docker Compose.
Test every API endpoint. Verify Redis caching. Verify data persistence.

### Folder Structure
```
devshelf/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       └── routes/
│           ├── __init__.py
│           ├── bookmarks.py
│           └── snippets.py
├── frontend/
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env
└── .gitignore
```

### File Explanations

**`.env`**
```
POSTGRES_USER=devshelf         → DB username PostgreSQL creates on first boot
POSTGRES_PASSWORD=devshelf123  → password for app user AND superuser
POSTGRES_DB=devshelf           → database name to create
DATABASE_URL=postgresql://devshelf:devshelf123@db:5432/devshelf
                               → full connection string for FastAPI
                               → "db" = container name, Docker resolves to IP
REDIS_URL=redis://cache:6379   → Redis connection string
                               → "cache" = container name
ENVIRONMENT=development        → controls app behavior
```

**`requirements.txt`**
```
fastapi==0.111.0    → web framework
uvicorn==0.29.0     → server that runs FastAPI
sqlalchemy==2.0.30  → ORM, talks to PostgreSQL
psycopg2-binary     → actual PostgreSQL driver
redis==5.0.4        → Redis client
python-dotenv       → reads .env file
pydantic==2.7.1     → validates request/response data
```

**`database.py`**
```python
# Creates connection to PostgreSQL
# engine = actual connection pool
# pool_pre_ping = auto reconnect if DB restarts
# SessionLocal = factory that creates DB sessions
# get_db() = gives each API request its own session, closes after
```

**`models.py`**
```python
# Defines database tables as Python classes
# SQLAlchemy converts these to real PostgreSQL tables
# Bookmark table → id, title, url, notes, tags[], created_at
# Snippet table  → id, title, language, code, tags[], created_at
# UUID primary keys → better than 1,2,3 for distributed systems
# ARRAY(String) → PostgreSQL native array column for tags
```

**`schemas.py`**
```python
# Defines API request and response shapes
# BookmarkCreate  → what API expects when creating (no id/created_at)
# BookmarkResponse → what API returns (includes id and created_at)
# Pydantic validates all incoming data automatically
# Config from_attributes=True → reads from SQLAlchemy objects
```

**`routes/bookmarks.py` and `routes/snippets.py`**
```
POST   /api/bookmarks/        → create, saves to PostgreSQL, clears Redis cache
GET    /api/bookmarks/        → list all, optional ?tag= filter
GET    /api/bookmarks/search  → search with Redis cache
                                cache HIT  → return from Redis instantly
                                cache MISS → query PostgreSQL, store in Redis 5min
GET    /api/bookmarks/{id}    → get one by UUID
DELETE /api/bookmarks/{id}    → delete, clears Redis cache
```

**`main.py`**
```python
# FastAPI app entry point
# Base.metadata.create_all() → creates tables on startup (safe to run repeatedly)
# CORSMiddleware → allows React (port 3000) to call backend (port 8000)
# include_router → registers bookmark and snippet routes under /api prefix
# /health endpoint → Docker and load balancers call this to verify app is alive
```

**`backend/Dockerfile`**
```dockerfile
# Multi-stage build
# Stage 1 (builder): python:3.12-slim
#   → installs all pip dependencies into /install folder
# Stage 2 (runtime): fresh python:3.12-slim
#   → copies only installed packages from builder
#   → copies app code
#   → no build tools in final image = smaller and more secure
# CMD uvicorn with --reload = auto restart on code changes (dev only)
```

**`docker-compose.yml` (Development)**
```yaml
db:
  image: postgres:15-alpine      # official image, no Dockerfile needed
  env_file: .env                 # reads POSTGRES_* variables
  restart: always                # auto restart on crash or codespace restart
  volumes:
    - postgres-data:/var/lib/postgresql/data  # named volume, survives restart
  healthcheck:
    test: pg_isready             # checks if PostgreSQL accepts connections
    interval: 10s
    retries: 5
  networks:
    - backend-net                # isolated, not reachable from internet

cache:
  image: redis:7-alpine
  healthcheck:
    test: redis-cli ping         # PONG = healthy
  networks:
    - backend-net

backend:
  build: ./backend               # builds from Dockerfile
  depends_on:
    db: condition: service_healthy    # waits for db healthcheck to pass
    cache: condition: service_healthy # waits for cache healthcheck to pass
  volumes:
    - ./backend/app:/app/app     # bind mount: local code synced to container
                                 # uvicorn --reload picks up changes instantly
  networks:
    - backend-net
    - frontend-net
```

### Phase 1 Testing

```bash
# Health check
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"devshelf-backend"}

# Create bookmark
curl -X POST http://localhost:8000/api/bookmarks/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Docker Docs","url":"https://docs.docker.com","tags":["docker"]}'

# Search (first hit = cache MISS)
curl "http://localhost:8000/api/bookmarks/search?q=docker"

# Search (second hit = cache HIT, Redis serves it)
curl "http://localhost:8000/api/bookmarks/search?q=docker"

# Verify Redis cached it
docker exec devshelf-cache redis-cli keys "*"
# Expected: search:bookmarks:docker

# Persistence test
docker compose down         # stop containers (volumes safe)
docker compose up -d        # restart
curl http://localhost:8000/api/bookmarks/
# Expected: data still there ✅
```

### Phase 1 Checklist
```
✅ PostgreSQL running and healthy
✅ Redis running and healthy
✅ FastAPI backend running
✅ Create bookmark works
✅ Create snippet works
✅ Get all bookmarks works
✅ Search works
✅ Redis caching works (cache miss → hit proven)
✅ Data persists after container restart
✅ Committed to GitHub
```

---

## Phase 2 — Frontend and Nginx

### Goal
Build React frontend served by Nginx.
Wire everything together — browser to Nginx to FastAPI to DB.
Test full stack end to end.

### New Files Added
```
frontend/
├── Dockerfile          → multi-stage: Node builds React, Nginx serves it
├── package.json        → React dependencies
├── vite.config.js      → Vite build configuration
├── index.html          → HTML entry point
├── nginx.conf          → copied here for build context
└── src/
    ├── main.jsx        → React entry point, mounts App
    ├── App.jsx         → main component, all state and API calls
    └── components/
        ├── SearchBar.jsx    → controlled search input
        ├── BookmarkCard.jsx → displays one bookmark
        └── SnippetCard.jsx  → displays one snippet with code block
```

### File Explanations

**`frontend/Dockerfile` (Multi-stage)**
```dockerfile
# Stage 1 (builder): node:20-alpine
#   COPY package.json first → Docker caches npm install layer
#   if package.json unchanged → npm install skipped on rebuild
#   RUN npm run build → compiles React to static HTML/CSS/JS in /app/dist

# Stage 2 (runtime): nginx:alpine
#   COPY --from=builder /app/dist /usr/share/nginx/html
#   No Node.js in production image
#   Final image ~25MB vs 600MB+ with Node
#   COPY nginx.conf → custom routing rules
```

**`nginx/nginx.conf`**
```nginx
upstream backend {
  server backend:8000;  # "backend" = container name, Docker resolves to IP
}

server {
  listen 80;

  location / {
    root /usr/share/nginx/html;  # serve React static files
    try_files $uri $uri/ /index.html;  # fallback for React Router
                                        # without this, page refresh = 404
  }

  location /api/ {
    proxy_pass http://backend;   # forward all /api/* to FastAPI container
    proxy_set_header Host $host; # pass original headers to backend
  }
}
```

**`App.jsx` Key Concepts**
```javascript
// useState → stores data that changes (bookmarks, snippets, search query)
// useEffect with [] → runs once on component load (fetch initial data)
// useEffect with [query] → runs when search changes (debounced search)
// Debouncing → wait 500ms after user stops typing before calling API
//              prevents API call on every keystroke
// axios baseURL: '/api' → all calls go to /api/...
//                         Nginx routes these to backend container
// Promise.all → runs both bookmark and snippet search simultaneously
//               faster than running sequentially
```

**Updated `docker-compose.yml`**
```yaml
# Key changes from Phase 1:
# backend → removed port 8000 (no longer directly accessible)
# backend → added frontend-net (so Nginx can reach it)
# frontend → new service
#   build: ./frontend (multi-stage build)
#   ports: 80:80 (only exposed port in entire stack)
#   networks: frontend-net only

# Two networks:
# frontend-net → Nginx ↔ Backend
# backend-net  → Backend ↔ PostgreSQL ↔ Redis
```

### Network Isolation After Phase 2
```
Before Phase 2:              After Phase 2:
────────────────             ────────────────────
Port 8000 exposed            Port 8000 NOT exposed
Backend directly reachable   Backend hidden behind Nginx
                             Only port 80 exposed
                             Single entry point ✅
```

### Phase 2 Testing
```bash
# All tests via port 80 (through Nginx), not 8000 directly
curl http://localhost/health
curl http://localhost/api/bookmarks/
curl -X POST http://localhost/api/bookmarks/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","url":"https://test.com","tags":["test"]}'

# Open browser → port 80
# Test: create bookmark → appears in list ✅
# Test: create snippet → appears in snippets tab ✅
# Test: search → filters results ✅
# Test: delete → disappears instantly ✅
```

### Phase 2 Checklist
```
✅ React frontend built via multi-stage Dockerfile
✅ Nginx serving React static files
✅ Nginx routing /api/* → FastAPI backend
✅ Create bookmark works through UI
✅ Create snippet works through UI
✅ Search works with debouncing
✅ Delete works instantly
✅ All 4 containers running together
✅ Backend no longer directly accessible
✅ Committed to GitHub
```

---

## Phase 3 — Production Deployment

### Goal
Deploy to AWS EC2, connect domain, configure HTTPS.

### Steps
```
Step 1  → Prepare production docker-compose.prod.yml
Step 2  → Launch EC2 instance (t2.micro, Ubuntu 22.04)
Step 3  → Configure Security Groups (port 22, 80, 443)
Step 4  → SSH into EC2
Step 5  → Install Docker on EC2
Step 6  → Clone repo on EC2
Step 7  → Set up .env on EC2
Step 8  → Run docker compose -f docker-compose.prod.yml up -d
Step 9  → Verify app on EC2 public IP
Step 10 → Point Namecheap domain to EC2 IP (A record)
Step 11 → Configure SSL via Let's Encrypt (Certbot)
Step 12 → Final test on live domain with HTTPS
Step 13 → Git commit Phase 3
```

### Dev vs Prod Compose Differences
```
Development:                      Production:
─────────────────────────         ─────────────────────────
build: ./backend                  image: devshelf-backend:latest
bind mount for hot reload         NO bind mount (code in image)
port 8000 exposed                 port 8000 NOT exposed
port 80 only                      port 80 AND 443
```

---

## Docker Concepts Learned

### 1. Images vs Containers
```
Image  = blueprint (read only, like a class)
Container = running instance (like an object)
One image → many containers
```

### 2. Multi-stage Builds
```
Stage 1 (heavy) → installs tools, builds artifacts
Stage 2 (light) → copies only what's needed to run
Result: smaller, more secure production image

Backend:  builder (pip install) → runtime (just packages + code)
Frontend: builder (npm build)   → runtime (nginx + dist files)
```

### 3. Named Volumes vs Bind Mounts
```
Named Volume:
→ Docker manages the path
→ Lives at /var/lib/docker/volumes/
→ Used for data that must persist (PostgreSQL, Redis)
→ Survives docker compose down
→ Deleted only with docker compose down -v

Bind Mount:
→ You specify the path
→ Syncs local folder to container in real time
→ Used for development hot reload
→ Not used in production
```

### 4. Custom Networks
```
bridge network → containers talk to each other by service name
                 Docker auto-resolves names to IPs

frontend-net → Nginx ↔ Backend
backend-net  → Backend ↔ PostgreSQL ↔ Redis

Isolation → PostgreSQL and Redis unreachable from internet
            Backend unreachable from internet directly
            Only Nginx port 80/443 exposed
```

### 5. Healthchecks
```
test      → command to run inside container
interval  → how often to run (10s)
timeout   → fail if no response in Ns (5s)
retries   → mark unhealthy after N failures (5)

States: starting → healthy → unhealthy

PostgreSQL: pg_isready -U devshelf
Redis:      redis-cli ping (expects PONG)

Used with depends_on condition: service_healthy
→ backend starts only AFTER db and cache are healthy
→ prevents "connection refused" on startup
```

### 6. Environment Variables
```
.env file → never commit to GitHub
.env.example → always commit, documents required variables

Variables flow:
.env → docker-compose env_file → container environment
                                → PostgreSQL reads POSTGRES_*
                                → FastAPI reads DATABASE_URL, REDIS_URL
```

### 7. Nginx as Reverse Proxy
```
Single entry point for all traffic
Routes based on URL path:
  /api/* → backend container (FastAPI)
  /*     → frontend files (React)

Benefits:
→ Backend hidden from internet
→ SSL termination at one place
→ Load balancing (future)
→ Rate limiting (future)
```

### 8. Redis Caching Pattern
```
Request comes in for search:q=docker
    ↓
Check Redis: key "search:bookmarks:docker" exists?
    ├── HIT  → return cached JSON instantly (skip DB)
    └── MISS → query PostgreSQL
                    ↓
               store result in Redis (TTL 300s)
                    ↓
               return result

Cache invalidation:
→ On create/delete → clear all search:* keys
→ TTL 300s → auto expire after 5 minutes
```

### 9. docker compose Commands
```
docker compose up --build    → build images and start containers
docker compose up -d         → start in background (detached)
docker compose down          → stop and remove containers (volumes safe)
docker compose down -v       → stop and remove containers AND volumes ❌
docker compose logs -f       → follow live logs
docker compose ps            → list running services
docker exec -it <name> bash  → go inside container
```

---

## Challenges and Fixes

### Challenge 1 — tags DEFAULT wrong syntax
```
Error:   tags VARCHAR[] DEFAULT '''{}'''
Cause:   Wrong SQL syntax in models.py
         Used server_default="'{}'" instead of server_default="{}"
Fix:     Changed both Bookmark and Snippet tags column
         server_default="{}"
DevOps lesson: Read stack trace carefully
               Error points to exact file and line
```

### Challenge 2 — ARRAY.contains() not implemented
```
Error:   NotImplementedError: ARRAY.contains() not implemented
Cause:   Used generic SQLAlchemy ARRAY instead of
         PostgreSQL-specific ARRAY for array operations
Fix:     Changed contains() to any() for array search
         from sqlalchemy.dialects.postgresql import ARRAY
DevOps lesson: Know which dialect your DB uses
               Generic ORM methods don't always work
               with database-specific column types
```

### Challenge 3 — nginx.conf not found in build context
```
Error:   COPY nginx.conf /etc/nginx/conf.d/default.conf: not found
Cause:   Dockerfile build context = ./frontend folder
         Docker can ONLY see files inside build context
         nginx.conf was in ./nginx/ not ./frontend/
Fix:     cp nginx/nginx.conf frontend/nginx.conf
DevOps lesson: Build context is the boundary
               Files outside context are invisible to Dockerfile
               Always check what's inside your build context folder
```

### Challenge 4 — Git push rejected
```
Error:   Updates were rejected because remote contains work
Cause:   GitHub repo had existing commits (README)
         Local repo had different commit history
Fix:     git pull origin main --rebase
         git push --force (personal repo only)
DevOps lesson: Always git pull before pushing
               --force only on personal branches
               Never force push to shared team branches
```

### Challenge 5 — version attribute obsolete warning
```
Warning: version attribute is obsolete in docker-compose.yml
Cause:   Modern Docker Compose v2 doesn't need version field
Fix:     Removed first line "version: '3.9'" from compose file
DevOps lesson: Docker Compose v2 is the standard now
               version field was for v1 compatibility
```

---

## Key Learnings

### DevOps Mindset
```
1. Logs first, assumptions never
   → docker logs <container> --tail 20
   → always read the full error before fixing

2. Test at every layer
   → container running? → docker ps
   → service healthy?   → healthcheck status
   → API working?       → curl endpoint
   → data persisted?    → compose down → up → curl

3. Stateless containers, stateful volumes
   → containers are disposable
   → data lives in volumes or external services
   → container dying = normal, data dying = disaster

4. Network isolation is security
   → expose only what needs to be exposed
   → DB and cache should never be internet-facing
   → single entry point (Nginx) = easier to secure

5. Environment separation
   → dev and prod use same code, different config
   → .env controls behavior
   → never hardcode values in code
```

### Interview-Ready Answers

**"Explain your Docker architecture"**
```
"Four containers connected via two isolated bridge networks.
Nginx on frontend-net handles all incoming traffic on port 80,
routing API calls to FastAPI and serving React static files.
FastAPI on backend-net connects to PostgreSQL for persistence
and Redis for caching search results with a 5-minute TTL.
PostgreSQL and Redis are completely isolated — unreachable
from the internet. Data persists in named volumes on the host."
```

**"How does your caching work?"**
```
"Search requests first check Redis using a key like
search:bookmarks:docker. Cache hit returns instantly,
skipping the database entirely. Cache miss queries PostgreSQL,
stores the result in Redis with a 300-second TTL, then returns.
On any create or delete operation we invalidate all search
cache keys to prevent stale data."
```

**"What's a multi-stage build and why use it?"**
```
"Multi-stage build uses multiple FROM instructions in one Dockerfile.
Earlier stages handle heavy work like installing build tools
and compiling code. The final stage copies only the artifacts
needed to run — no build tools, no source dependencies.
Our frontend goes from 600MB Node image to 25MB Nginx image.
Smaller image means faster pulls, less attack surface,
and lower storage costs."
```

---

## Future Roadmap

### Immediate Next Steps (Phase 3 completion)
```
→ Deploy to EC2 (t2.micro, Ubuntu 22.04)
→ Configure Security Groups (22, 80, 443)
→ Install Docker on EC2
→ Clone repo, set .env, docker compose up
→ Point Namecheap domain (A record → EC2 IP)
→ SSL via Let's Encrypt (Certbot)
→ Live on your domain with HTTPS
```

### AWS Migration (After Phase 3)
```
→ Move PostgreSQL → AWS RDS
   Change DATABASE_URL to RDS endpoint
   Zero code changes, only .env change
   Automated backups, Multi-AZ, no volume management

→ Move Redis → AWS ElastiCache
   Change REDIS_URL to ElastiCache endpoint
   Same pattern as RDS migration

→ Store files → S3
   Add file upload to bookmarks
   FastAPI streams directly to S3
   Lambda triggered on S3 upload for thumbnail generation
   Container holds zero files, fully stateless
```

### CI/CD Pipeline (GitHub Actions)
```
Code push to GitHub
      ↓
GitHub Actions triggers
      ↓
Run tests
      ↓
Build Docker images
      ↓
Push to ECR (AWS container registry)
      ↓
SSH into EC2, pull new images
      ↓
docker compose up -d --pull always
      ↓
New version live automatically
```

### Kubernetes (EKS) Migration
```
Current Docker Compose concepts → Kubernetes equivalents:
─────────────────────────────────────────────────────────
container          → Pod
docker-compose.yml → Deployment YAML
networks           → Services
volumes            → PersistentVolumeClaims
healthcheck        → readinessProbe + livenessProbe
depends_on         → initContainers
.env               → ConfigMap + Secrets
restart: always    → ReplicaSet (automatic)
port mapping       → Service + Ingress
```

### Monitoring Stack (Prometheus + Grafana)
```
→ Add Prometheus container
→ Expose /metrics endpoint in FastAPI
→ Grafana dashboards:
   request rate, error rate, response time
   DB connection pool usage
   Redis cache hit/miss ratio
→ Loki for log aggregation
→ Alerting for downtime
```

### Security Hardening
```
→ AWS Secrets Manager for all credentials
→ Non-root user in Dockerfiles
→ Read-only filesystem for containers
→ Docker image vulnerability scanning
→ HTTPS only (redirect HTTP to HTTPS)
→ Rate limiting in Nginx
→ WAF (Web Application Firewall)
```

---

## Quick Reference — Commands

```bash
# Start development
docker compose up --build

# Start background
docker compose up -d

# Stop (keep volumes)
docker compose down

# View logs
docker compose logs -f
docker logs devshelf-backend --tail 20

# Go inside container
docker exec -it devshelf-backend bash
docker exec -it devshelf-db psql -U devshelf -d devshelf
docker exec -it devshelf-cache redis-cli

# Check Redis cache
docker exec devshelf-cache redis-cli keys "*"
docker exec devshelf-cache redis-cli get "search:bookmarks:docker"

# Check volumes
docker volume ls
docker volume inspect devshelf_postgres-data

# Check networks
docker network ls
docker network inspect devshelf_backend-net

# Git workflow
git add .
git commit -m "meaningful message"
git push origin main
```

---

*Document last updated: Phase 2 complete, Phase 3 in progress*
*Goal: Live on domain with HTTPS by end of Phase 3*
