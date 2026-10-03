#!/usr/bin/env python3
"""
========================================================================================
GOLD DESK QUANT — PHASE 2: FASTAPI SERVICE & REDIS PUBLISHER
========================================================================================
- GET /levels/gc1              : Returns Latest KeyLevels JSON
- GET /health                  : Health Check
- Background Scheduler (APScheduler): Runs Extraction every 15 mins (on 15m Close)
- Redis Publisher: Pushes Full Report to Channel `futures:levels` + Cache Key `futures:levels:latest`
========================================================================================
"""

from __future__ import annotations
import os
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import json
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional

# Optional redis import with graceful fallback
try:
    import redis.asyncio as redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    redis = None

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from pydantic import BaseModel

# Local Imports
try:
    from shared.types import KeyLevel
except ImportError:
    from futures_levels.py.level_extractor import KeyLevel

from futures_levels.py.level_extractor import FuturesLevelExtractor

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG & STATE
# ──────────────────────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_KEY = "futures:levels:latest"
PUB_CHANNEL = "futures:levels"
EXTRACTION_INTERVAL_MIN = 15

logger = logging.getLogger("FuturesAPI")
logger.setLevel(logging.INFO)

extractor = FuturesLevelExtractor()
redis_client = None
scheduler = AsyncIOScheduler(timezone="UTC")
latest_levels: List[KeyLevel] = []
last_extraction_ts: int = 0

# ──────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ──────────────────────────────────────────────────────────────────────────────

class LevelsReport(BaseModel):
    symbol: str = "GC1!"
    current_price: float
    generated_at: int
    levels: List[KeyLevel]
    nearest_resistance: Optional[KeyLevel] = None
    nearest_support: Optional[KeyLevel] = None
    pivot_zone: Optional[KeyLevel] = None

# ──────────────────────────────────────────────────────────────────────────────
# CORE LOGIC
# ──────────────────────────────────────────────────────────────────────────────

async def run_extraction_job():
    """The scheduled job: Extract -> Cache -> Publish."""
    global latest_levels, last_extraction_ts
    try:
        logger.info("⏰ Scheduled Extraction Started for COMEX:GC1!...")
        levels = extractor.run_extraction()
        
        if not levels:
            logger.warning("Extraction returned 0 levels.")
            return

        latest_levels = levels
        last_extraction_ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        
        report = LevelsReport(
            current_price=extractor.current_price,
            generated_at=last_extraction_ts,
            levels=levels,
            nearest_resistance=next((l for l in levels if l.type in ("RESISTANCE", "PIVOT_ZONE") and l.price > extractor.current_price and l.is_fresh), None),
            nearest_support=next((l for l in levels if l.type in ("SUPPORT", "PIVOT_ZONE") and l.price < extractor.current_price and l.is_fresh), None),
            pivot_zone=next((l for l in levels if l.type == "PIVOT_ZONE" and l.zone_low < extractor.current_price < l.zone_high), None)
        )

        if redis_client:
            try:
                await redis_client.set(CACHE_KEY, report.model_dump_json(), ex=1200) # 20 min TTL
                await redis_client.publish(PUB_CHANNEL, report.model_dump_json())
                logger.info(f"✅ Published {len(levels)} levels to Redis (Cache + Channel)")
            except Exception as re:
                logger.warn(f"Redis publish note: {re}")
        else:
            logger.info(f"✅ Cached {len(levels)} levels in-memory (Redis offline)")
            
    except Exception as e:
        logger.error(f"Extraction Job Failed: {e}", exc_info=True)

# ──────────────────────────────────────────────────────────────────────────────
# FASTAPI LIFESPAN & ROUTES
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client, scheduler
    # Startup
    if HAS_REDIS:
        try:
            redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            await asyncio.wait_for(redis_client.ping(), timeout=2.0)
            logger.info("✅ Redis Connected")
        except Exception as e:
            logger.warn(f"Redis connection skipped: {e}")
            redis_client = None
    
    # Initial Run
    await run_extraction_job()
    
    # Scheduler: Run at minute 1, 16, 31, 46 (after 15m candle close buffer)
    scheduler.add_job(
        run_extraction_job, 
        CronTrigger(minute="1,16,31,46", timezone="UTC"), 
        id="extract_levels", 
        replace_existing=True
    )
    scheduler.start()
    logger.info("⏰ Scheduler Started (Every 15 mins at :01, :16, :31, :46 UTC)")
    
    yield
    
    # Shutdown
    try:
        scheduler.shutdown()
        if redis_client:
            await redis_client.close()
    except Exception:
        pass
    logger.info("🛑 Shutdown Complete")

app = FastAPI(title="Gold Desk Futures Levels Engine", lifespan=lifespan)

@app.get("/health")
async def health():
    return {
        "status": "ok", 
        "last_extraction": last_extraction_ts, 
        "levels_cached": len(latest_levels)
    }

@app.get("/levels/gc1", response_model=LevelsReport)
async def get_levels():
    if not latest_levels:
        if redis_client:
            cached = await redis_client.get(CACHE_KEY)
            if cached:
                return JSONResponse(content=json.loads(cached))
        raise HTTPException(status_code=503, detail="Levels not ready yet. Extraction may be running.")
    
    return LevelsReport(
        current_price=extractor.current_price,
        generated_at=last_extraction_ts,
        levels=latest_levels,
        nearest_resistance=next((l for l in latest_levels if l.type in ("RESISTANCE", "PIVOT_ZONE") and l.price > extractor.current_price and l.is_fresh), None),
        nearest_support=next((l for l in latest_levels if l.type in ("SUPPORT", "PIVOT_ZONE") and l.price < extractor.current_price and l.is_fresh), None),
        pivot_zone=next((l for l in latest_levels if l.type == "PIVOT_ZONE" and l.zone_low < extractor.current_price < l.zone_high), None)
    )

if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    uvicorn.run("futures_levels.py.api:app", host="0.0.0.0", port=8002, reload=False)
