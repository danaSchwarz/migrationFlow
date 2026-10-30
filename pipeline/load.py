"""Load the Abel & Cohen flow estimates into Postgres. Safe to run repeatedly."""

import os
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
DATA_DIR = Path(__file__).parent / "data"
SOURCE_VERSION = "abel_cohen_v8"
METHODS = ["sd_drop_neg", "sd_rev_neg", "mig_rate", "da_min_open", "da_min_closed", "da_pb_closed"]


def read_countries() -> pd.DataFrame:
    # utf-8-sig strips the byte order mark at the start of the file
    countries = pd.read_csv(DATA_DIR / "country_list.csv", encoding="utf-8-sig")
    return countries.rename(columns={"iso3c": "iso3"})[["iso3", "name"]]


def read_flows() -> pd.DataFrame:
    flows = pd.read_csv(DATA_DIR / "bilat_mig.csv")
    flows = flows[flows["orig"] != flows["dest"]]  # same-country rows are always 0
    flows = flows.melt(
        id_vars=["year0", "orig", "dest"],
        value_vars=METHODS,
        var_name="method",
        value_name="value",
    )
    flows["source_version"] = SOURCE_VERSION
    return flows[["source_version", "method", "year0", "orig", "dest", "value"]]


def connect() -> psycopg.Connection:
    load_dotenv(ROOT / ".env")
    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        dbname=os.environ["POSTGRES_DB"],
    )


def main() -> None:
    countries = read_countries()
    flows = read_flows()

    with connect() as conn, conn.cursor() as cur:
        # Countries: insert new ones, update names of existing ones (keeps lat/lon)
        cur.executemany(
            """
            insert into countries (iso3, name) values (%s, %s)
            on conflict (iso3) do update set name = excluded.name
            """,
            countries.itertuples(index=False),
        )

        cur.execute("delete from flows where source_version = %s", (SOURCE_VERSION,))
        with cur.copy(
            "copy flows (source_version, method, year0, orig, dest, value) from stdin"
        ) as copy:
            for row in flows.itertuples(index=False):
                copy.write_row(row)

        cur.execute("select count(*) from flows where source_version = %s", (SOURCE_VERSION,))
        print(f"countries: {len(countries)}, flows loaded: {cur.fetchone()[0]:,}")


if __name__ == "__main__":
    main()
