"""Download the Abel & Cohen bilateral migration flow files (v8) and verify them."""

import hashlib
import sys
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent / "data"

FILES = {
    "bilat_mig.csv": {
        "url": "https://ndownloader.figshare.com/files/53235671",
        "md5": "e5f4a0079a8102aaacb120eb00b5256b",
    },
    "country_list.csv": {
        "url": "https://ndownloader.figshare.com/files/53236088",
        "md5": None,  # not published
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
