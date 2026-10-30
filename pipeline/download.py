"""Download the source files (Abel & Cohen flows v8, Natural Earth v5.1.2) and verify them."""

import hashlib
import sys
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent / "data"
NATURAL_EARTH = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson"

FILES = {
    "bilat_mig.csv": {
        "url": "https://ndownloader.figshare.com/files/53235671",
        "md5": "e5f4a0079a8102aaacb120eb00b5256b",
    },
    "country_list.csv": {
        "url": "https://ndownloader.figshare.com/files/53236088",
        "md5": None,  # not published
    },
    # Natural Earth, pinned to a release tag; used for country label points (lat/lon)
    "ne_10m_admin_0_countries.geojson": {
        "url": f"{NATURAL_EARTH}/ne_10m_admin_0_countries.geojson",
        "md5": "33d2b3758f0b60dc3600961df4fff2ff",
    },
    # Splits off overseas territories (e.g. Réunion, Guadeloupe) that the countries file merges
    "ne_10m_admin_0_map_units.geojson": {
        "url": f"{NATURAL_EARTH}/ne_10m_admin_0_map_units.geojson",
        "md5": "2664b923a2e3d39943069a1b5a02dc7d",
    },
}


def md5_of(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(name: str, url: str, expected_md5: str | None) -> None:
    target = DATA_DIR / name
    if target.exists() and expected_md5 and md5_of(target) == expected_md5:
        print(f"{name}: already downloaded")
        return

    print(f"{name}: downloading...")
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    target.write_bytes(response.content)

    if expected_md5:
        actual = md5_of(target)
        if actual != expected_md5:
            target.unlink()
            sys.exit(f"{name}: MD5 mismatch (expected {expected_md5}, got {actual})")
        print(f"{name}: MD5 ok")
    print(f"{name}: saved ({target.stat().st_size:,} bytes)")


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    for name, info in FILES.items():
        download(name, info["url"], info["md5"])


if __name__ == "__main__":
    main()
