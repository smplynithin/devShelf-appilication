# ── Stage 1: Builder ──────────────────────────────────────
# Full Python image to install dependencies
FROM python:3.12-slim AS builder

# Set working directory inside container
WORKDIR /app

# Copy requirements first (before app code)
# Docker caches each layer — if requirements.txt hasn't changed
# it won't reinstall packages on every build (saves time)
COPY requirements.txt .

# Install dependencies into a separate folder /install
# This keeps the final image clean
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: Runtime ──────────────────────────────────────
# Fresh slim image — no build tools, smaller and more secure
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy your actual application code
COPY app/ ./app/

# 8000 is the port FastAPI/uvicorn runs on
EXPOSE 8000

# Command to start the server
# main:app         → file app/main.py, variable named app
# host 0.0.0.0     → listen on all interfaces (not just localhost)
# reload           → auto-restart when code changes (dev only)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

