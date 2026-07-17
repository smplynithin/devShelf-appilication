import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routes import bookmarks_router, snippets_router
from prometheus_fastapi_instrumentator import Instrumentator

# Create all tables in PostgreSQL on startup
# If tables already exist, this does nothing (safe to run repeatedly)
Base.metadata.create_all(bind=engine)

# Create the FastAPI app instance
app = FastAPI(
    title="DevShelf API",
    description="Personal developer bookmark and snippet manager",
    version="1.0.0"
)
Instrumentator().instrument(app).expose(app)
# CORS = Cross Origin Resource Sharing
# Without this, your React frontend (port 3000) cannot call
# the FastAPI backend (port 8000) — browser blocks it
# allow_origins=["*"] means accept requests from any origin
# In production you'd restrict this to your actual domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
# All bookmark routes → /api/bookmarks/...
# All snippet routes  → /api/snippets/...
app.include_router(bookmarks_router, prefix="/api")
app.include_router(snippets_router, prefix="/api")

# Health check endpoint
# Docker and load balancers call this to verify app is alive
# Returns 200 OK if running
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "devshelf-backend"}

# Root endpoint
@app.get("/")
def root():
    return {"message": "DevShelf API", "docs": "/docs"}
