# Migration Flows Globe – Handoff

## How to work with me
- I write all the code myself. Guide me: explain what's needed, review my code,
  answer questions. Don't write full implementations unless I ask.
- Keep answers short. Ask before making assumptions.
- I'm a junior full-stack dev (Python/FastAPI, .NET, React/TypeScript, PostgreSQL/Supabase).

## Project
Portfolio project: an interactive globe showing global migration between countries
like a wind map, with particle streams from origin to destination, animated over time.
All migration regardless of cause, drawn the same way. Country to country, 1990 → today.
Must be deployed online and work on mobile.

Full plan doc: https://claude.ai/code/artifact/5e9d3765-633a-44e7-b958-78609826fea3

## UX decisions
- Drag rotates the globe, pinch/scroll zooms. Rotating never changes time.
- Time ring: a dial around the globe; counterclockwise = forward, clockwise = back.
- Plays continuously by default (pause, slower, faster). At the end it fades out and
  restarts; a visible seam on the ring marks where the years meet.
- Particles always flow origin → destination, even when scrubbing backwards.
  The year is always shown.
- Mobile-first: thumb-friendly ring, tap for details (no hover), fewer particles on phones.

## Stack (decided)
- Pipeline: Python + pandas (calculations happen here, not in the API)
- DB: PostgreSQL in Docker
- Backend: FastAPI (read-only, serves precomputed flows)
- Frontend: React + TypeScript + deck.gl

## Build order
1. Docker + Postgres  ← CURRENT STEP
2. Schema + upload script for Abel & Cohen data
3. FastAPI endpoint: flows per period
4. Globe with streams, time ring, loop. Test on mobile early.
5. Deploy first version
6. Derive 2020–2024 flows from UN DESA migrant stocks (migest method)
7. Smooth 5-year periods with UNHCR, OECD, Eurostat, CBP, Frontex (timing only, no extra volume: avoid double counting)
8. Later: global events as timeline markers

## Data source 1: Abel & Cohen bilateral flow estimates
- File: bilat_mig.csv, v8 (March 2025, based on UN DESA IMS2024)
  https://ndownloader.figshare.com/files/53235671
  MD5: e5f4a0079a8102aaacb120eb00b5256b
- Country names: country_list.csv
  https://ndownloader.figshare.com/files/53236088 (columns not documented yet; check them)
- License: CC BY 4.0 (credit in the app)
- 9.7 MB, 313,736 rows, one per origin-destination pair per 5-year period
- Columns: year0 (1990…2015), orig, dest (ISO3 codes), plus 6 method columns:
  sd_drop_neg, sd_rev_neg, mig_rate, da_min_open, da_min_closed, da_pb_closed
- Default method: da_pb_closed (best in the authors' validation). Store all 6 to
  allow comparing or toggling in the UI.
- Values = people per 5-year period (divide by 5 for yearly). These are minimum
  estimates: moves out and back within a period don't appear.
- About half the flows are zero; keeping them is fine, filter in queries.
- Ends 2015–2020; no 2020–2024 period yet.
- No coordinates: need a country centroid table (e.g. Natural Earth); some small
  territories may need manual mapping.

## Planned schema
- countries (iso3 PK, name, lat, lon)
- flows (year0, orig → countries.iso3, dest → countries.iso3, method, value, source_version)

## Upload script plan
- Download, verify MD5
- pandas melt: 6 method columns → rows
- Load with Postgres COPY (not row inserts)
- Idempotent: delete existing rows for that source_version before loading

## Docker compose (step 1)
- postgres:16 (pinned version), env vars from .env (in .gitignore)
- port 5432, named volume for /var/lib/postgresql/data
- optional: pg_isready healthcheck
- optional: SQL init script mounted into /docker-entrypoint-initdb.d/
  (alternative: Alembic migrations)

## Open questions
- Default view globe or flat map?
- Loop length (seconds per year)?
- Start the loop at 1990 or earlier?
- Project name