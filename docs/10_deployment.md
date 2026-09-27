# 10 — Production Deployment & Operations Guide

## Overview
This document outlines production readiness, deployment options, health monitoring, and scaling guidelines for the **XAUUSD SMC Quant Platform**.

---

## 1. Prerequisites
- **Node.js**: v18.17.0+ or v20+
- **Python**: v3.10+ (with `venv` and `pip`)
- **System**: Linux / Debian / Ubuntu / Containerized Cloud Run
- **Memory**: Minimum 1GB RAM (2GB recommended for VectorBT / DuckDB in-memory analytics)

---

## 2. Environment Variables Configuration
Configure the following keys in your `.env` or cloud secret manager:
```ini
# Server configuration
PORT=3000
NODE_ENV=production

# Python Microservice (Optional)
PYTHON_SERVICE_URL=http://127.0.0.1:8000

# Telegram Automated Alerts
TELEGRAM_BOT_TOKEN=your_verified_bot_token
TELEGRAM_CHAT_ID=your_target_channel_id

# Economic Data (FRED)
FRED_API_KEY=your_registered_fred_api_key
```

---

## 3. Production Build & Run Sequence
```bash
# 1. Clean build artifacts
rm -rf dist build

# 2. Build React frontend bundle & Node server
npm run build

# 3. Launch production server
npm start
```

---

## 4. Health Check & Monitoring
The server exposes an automated health probe at:
```http
GET /health
```

### Expected Response:
```json
{
  "status": "ok",
  "database": "connected",
  "tvRelay": "connected",
  "uptime": 1420
}
```
Health monitoring tools (Kubernetes probes, Cloud Run uptime checks, Datadog) should query `/health` every 15-30 seconds.
