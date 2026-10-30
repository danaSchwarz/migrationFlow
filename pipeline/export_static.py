"""Export the data the frontend needs as JSON files, for hosting without the API (GitHub Pages).

Writes the same responses the API gives for /api/countries and /api/flows?min_value=1000,
so the frontend can read either one. Run after load.py.
"""

import json

from load import ROOT, SOURCE_VERSION, connect

OUT_DIR = ROOT / "frontend" / "public" / "data"
METHOD = "da_pb_closed"
MIN_VALUE = 1000  # must match MIN_FLOW in frontend/src/App.tsx


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        countries = conn.execute("select iso3, name, lat, lon from countries order by iso3").fetchall()
        flows = conn.execute(
            """
            select year0, orig, dest, value
            from flows
            where source_version = %s and method = %s and value > %s
            order by year0, value desc
            """,
            (SOURCE_VERSION, METHOD, MIN_VALUE),
        ).fetchall()

    files = {
        "countries.json": [{"iso3": i, "name": n, "lat": lat, "lon": lon} for i, n, lat, lon in countries],
        # Rounded to whole people: same numbers, much smaller file
        "flows.json": [{"year0": y, "orig": o, "dest": d, "value": round(v)} for y, o, d, v in flows],
    }
    for name, rows in files.items():
        path = OUT_DIR / name
        # ensure_ascii=False keeps names like "Côte d’Ivoire" readable
        path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{name}: {len(rows):,} rows, {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
