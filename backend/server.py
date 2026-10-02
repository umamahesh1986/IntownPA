"""IntownPA FastAPI application entrypoint."""
import os
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import client
import routes_auth, routes_customer, routes_pa, routes_admin, routes_common, routes_payment
from seed import seed_all

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("intownpa")

app = FastAPI(title="IntownPA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"app": "IntownPA", "status": "ok", "tagline": "You Can't Go? Send IntownPA."}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


app.include_router(routes_auth.router)
app.include_router(routes_customer.router)
app.include_router(routes_pa.router)
app.include_router(routes_admin.router)
app.include_router(routes_payment.router)
app.include_router(routes_common.router)


@app.on_event("startup")
async def on_startup():
    try:
        await seed_all()
        logger.info("Seed data ensured.")
    except Exception as e:
        logger.exception("Seeding failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
