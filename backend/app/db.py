import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv(Path(__file__).parent.parent.parent / ".env")


def conninfo() -> str:
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"user={os.environ['POSTGRES_USER']} "
        f"password={os.environ['POSTGRES_PASSWORD']} "
        f"dbname={os.environ['POSTGRES_DB']}"
    )


# Opened and closed by the app's lifespan in main.py
pool = ConnectionPool(conninfo(), kwargs={"row_factory": dict_row}, open=False)
