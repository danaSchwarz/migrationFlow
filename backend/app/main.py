"""Read-only API serving the precomputed migration flows."""

import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel

from .db import pool

SOURCE_VERSION = "abel_cohen_v8"
DEFAULT_METHOD = "da_pb_closed"
Method = Literal["sd_drop_neg", "sd_rev_neg", "mig_rate", "da_min_open", "da_min_closed", "da_pb_closed"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(title="Migration Flows API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["GET"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


class Country(BaseModel):
    iso3: str
    name: str
    lat: float
    lon: float


class Flow(BaseModel):
    year0: int
    orig: str
    dest: str
    value: float  # people per 5-year period


class Meta(BaseModel):
    source_version: str
    periods: list[int]
    methods: list[str]
    default_method: str


@app.get("/api/health")
def health() -> dict:
    with pool.connection() as conn:
        conn.execute("select 1")
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> Meta:
    with pool.connection() as conn:
        periods = conn.execute(
            "select distinct year0 from flows where source_version = %s order by year0",
            (SOURCE_VERSION,),
        ).fetchall()
    return Meta(
        source_version=SOURCE_VERSION,
        periods=[row["year0"] for row in periods],
        methods=list(Method.__args__),
        default_method=DEFAULT_METHOD,
    )


@app.get("/api/countries")
def countries() -> list[Country]:
    with pool.connection() as conn:
        return conn.execute("select iso3, name, lat, lon from countries order by iso3").fetchall()


@app.get("/api/flows")
def flows(
    method: Method = DEFAULT_METHOD,
    year0: int | None = Query(None, description="Start year of the 5-year period; omit for all"),
    min_value: float = Query(0, ge=0, description="Only flows larger than this"),
) -> list[Flow]:
    with pool.connection() as conn:
        return conn.execute(
            """
            select year0, orig, dest, value
            from flows
            where source_version = %(source_version)s
              and method = %(method)s
              and (%(year0)s::smallint is null or year0 = %(year0)s)
              and value > %(min_value)s
            order by year0, value desc
            """,
            {"source_version": SOURCE_VERSION, "method": method, "year0": year0, "min_value": min_value},
        ).fetchall()
