#!/usr/bin/env python3
"""Fetch the per-role pro pick rankings shown on probuildstats.com/top-picks."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PAGE_URL = "https://probuildstats.com/top-picks"
API_URL = "https://u.gg/api"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "Chrome/128.0.0.0 Safari/537.36"
)
ROLE_TO_LANE = {
    "top": "TOP",
    "jungle": "JUNGLE",
    "mid": "MIDDLE",
    "adc": "BOTTOM",
    "supp": "UTILITY",
}

QUERY = """query TopProChampionPicks($version: String) {
  getTopProChampionPicks(version: $version) {
    championId
    pickRate
    role
    winRate
  }
}"""


class TitleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.parts.append(data)


def request_bytes(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> bytes:
    request = Request(url, data=data, headers=headers or {}, method="POST" if data is not None else "GET")
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} al consultar {url}")
        return response.read()


def fetch_patch() -> str:
    page_html = request_bytes(PAGE_URL, headers={"User-Agent": USER_AGENT}).decode("utf-8", "replace")
    parser = TitleParser()
    parser.feed(page_html)
    title = html.unescape(" ".join(parser.parts))
    match = re.search(r"\bPatch\s+(\d+\.\d+)\b", title, re.IGNORECASE)
    if not match:
        raise RuntimeError(f"No encontré el parche en el título de Probuildstats: {title!r}")
    return match.group(1)


def fetch_records(patch: str) -> list[dict]:
    request_body = json.dumps({
        "operationName": "TopProChampionPicks",
        "variables": {"version": patch.replace(".", "_")},
        "query": QUERY,
    }).encode("utf-8")
    payload = json.loads(request_bytes(API_URL, data=request_body, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://probuildstats.com",
        "Referer": PAGE_URL,
    }).decode("utf-8"))
    records = payload.get("data", {}).get("getTopProChampionPicks")
    if not isinstance(records, list) or not records:
        raise RuntimeError(f"La respuesta no contiene getTopProChampionPicks: {payload!r}")
    return records


def build_snapshot(patch: str, records: list[dict], previous: dict | None = None) -> dict:
    grouped: dict[str, list[tuple[int, dict]]] = {lane: [] for lane in ROLE_TO_LANE.values()}
    seen: dict[str, set[int]] = {lane: set() for lane in ROLE_TO_LANE.values()}

    for source_index, record in enumerate(records):
        role = str(record.get("role", "")).lower()
        lane = ROLE_TO_LANE.get(role)
        champ_id = record.get("championId")
        pick_rate = record.get("pickRate")
        win_rate = record.get("winRate")
        if not lane or not isinstance(champ_id, int) or champ_id <= 0:
            continue
        if not isinstance(pick_rate, (int, float)) or not 0 <= pick_rate <= 1:
            continue
        if not isinstance(win_rate, (int, float)) or not 0 <= win_rate <= 1:
            continue
        if champ_id in seen[lane]:
            continue
        seen[lane].add(champ_id)
        grouped[lane].append((source_index, record))

    # The site orders each position by pick frequency; stable sorting preserves its
    # own ordering when two champions have identical pick rates.
    roles: dict[str, list[dict[str, int]]] = {}
    for lane, lane_records in grouped.items():
        lane_records.sort(key=lambda item: (-float(item[1]["pickRate"]), item[0]))
        selected = lane_records[:20]
        if len(selected) != 20:
            raise RuntimeError(f"La posición {lane} solo devolvió {len(selected)} campeones; esperaba 20.")
        roles[lane] = [
            {"championId": int(record["championId"]), "rank": rank}
            for rank, (_source_index, record) in enumerate(selected, start=1)
        ]

    canonical_data = json.dumps({"patch": patch, "roles": roles}, sort_keys=True, separators=(",", ":"))
    version = hashlib.sha256(canonical_data.encode("utf-8")).hexdigest()
    if previous and previous.get("version") == version:
        updated_at = previous.get("updatedAt") or datetime.now(timezone.utc).isoformat(timespec="seconds")
    else:
        updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    return {
        "schemaVersion": 1,
        "source": PAGE_URL,
        "patch": patch,
        "updatedAt": updated_at,
        "version": version,
        "roles": roles,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Actualiza el snapshot top 20 de Probuildstats por posición.")
    parser.add_argument(
        "--output",
        default="src/lib/data/probuildstats-top-picks.json",
        help="Ruta del JSON de salida",
    )
    args = parser.parse_args()
    output_path = Path(args.output)

    try:
        patch = fetch_patch()
        records = fetch_records(patch)
        previous = None
        if output_path.exists():
            try:
                previous = json.loads(output_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                previous = None
        snapshot = build_snapshot(patch, records, previous)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (HTTPError, URLError, TimeoutError, OSError, RuntimeError, ValueError) as exc:
        print(f"No se pudo actualizar el snapshot de Probuildstats: {exc}")
        return 1

    print(f"Snapshot {snapshot['version'][:12]} del parche {snapshot['patch']} escrito en {output_path}")
    for lane, champs in snapshot["roles"].items():
        print(f"{lane}: {len(champs)} campeones")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
