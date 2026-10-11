#!/usr/bin/env python3
"""Fetch the per-role pro pick rankings shown on probuildstats.com/top-picks."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PAGE_URL = "https://probuildstats.com/top-picks"
API_URL = "https://u.gg/api"
DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

API_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Content-Type": "application/json",
    "Origin": "https://probuildstats.com",
    "Referer": "https://probuildstats.com/top-picks",
    "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
}

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


def request_bytes_curl(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> bytes:
    curl_path = shutil.which("curl")
    if not curl_path:
        raise RuntimeError("curl no está disponible en el entorno")

    cmd = [curl_path, "-sS", "-L", "--compressed"]
    if data is not None:
        cmd.extend(["-X", "POST", "--data-binary", data.decode("utf-8")])
    for key, value in (headers or {}).items():
        cmd.extend(["-H", f"{key}: {value}"])
    cmd.append(url)

    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0:
        err_msg = proc.stderr.decode("utf-8", "replace").strip()
        raise RuntimeError(f"curl falló con código {proc.returncode}: {err_msg}")
    return proc.stdout


def request_bytes(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> bytes:
    effective_headers = dict(headers or {})
    request = Request(url, data=data, headers=effective_headers, method="POST" if data is not None else "GET")
    try:
        with urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status} al consultar {url}")
            return response.read()
    except (HTTPError, URLError) as err:
        # Si urllib fue bloqueado (ej. HTTP 403 por WAF de Cloudflare en runners), reintentar con curl si está disponible
        if shutil.which("curl"):
            try:
                return request_bytes_curl(url, data=data, headers=effective_headers)
            except Exception as curl_err:
                raise RuntimeError(f"Fallo en urllib ({err}) y en fallback curl ({curl_err}) al consultar {url}") from err
        raise RuntimeError(f"HTTP error al consultar {url}: {err}") from err


def to_short_patch(full_version: str) -> str:
    clean = str(full_version).strip().strip('"\'')
    parts = clean.split(".")
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[1]}"
    raise ValueError(f"Versión de parche no válida: {full_version}")


def fetch_patch_candidates() -> tuple[str, str | None]:
    """Obtiene el parche actual y opcionalmente el anterior usando DDragon o fallback de Probuildstats."""
    # 1. Intentar Riot DataDragon (oficial, CDN abierta, sin protecciones WAF Cloudflare)
    try:
        raw_versions = json.loads(request_bytes(DDRAGON_VERSIONS_URL, headers={"Accept": "application/json"}).decode("utf-8"))
        if isinstance(raw_versions, list) and raw_versions:
            current = to_short_patch(raw_versions[0])
            previous = to_short_patch(raw_versions[1]) if len(raw_versions) > 1 else None
            return current, previous
    except Exception as e:
        print(f"[WARN] No se pudo obtener el parche desde DataDragon: {e}")

    # 2. Fallback a Probuildstats HTML
    try:
        page_html = request_bytes(PAGE_URL, headers=BROWSER_HEADERS).decode("utf-8", "replace")
        parser = TitleParser()
        parser.feed(page_html)
        title = html.unescape(" ".join(parser.parts))
        match = re.search(r"\bPatch\s+(\d+\.\d+)\b", title, re.IGNORECASE)
        if match:
            return match.group(1), None
    except Exception as e:
        print(f"[WARN] No se pudo obtener el parche desde Probuildstats HTML: {e}")

    raise RuntimeError("No se pudo determinar el parche actual desde ninguna fuente (DataDragon ni Probuildstats)")


def fetch_records_for_patch(patch: str) -> list[dict]:
    request_body = json.dumps({
        "operationName": "TopProChampionPicks",
        "variables": {"version": patch.replace(".", "_")},
        "query": QUERY,
    }).encode("utf-8")
    payload = json.loads(request_bytes(API_URL, data=request_body, headers=API_HEADERS).decode("utf-8"))
    records = payload.get("data", {}).get("getTopProChampionPicks")
    if isinstance(records, list):
        return records
    return []


def fetch_records(current_patch: str, fallback_patch: str | None = None) -> tuple[str, list[dict]]:
    records = fetch_records_for_patch(current_patch)
    if records:
        return current_patch, records

    if fallback_patch and fallback_patch != current_patch:
        print(f"[INFO] Parche {current_patch} sin registros de pro picks todavía. Reintentando con parche anterior {fallback_patch}...")
        records = fetch_records_for_patch(fallback_patch)
        if records:
            return fallback_patch, records

    raise RuntimeError(f"La API de U.GG no devolvió registros válidos para el parche {current_patch}" + (f" ni {fallback_patch}" if fallback_patch else ""))


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
        current_patch, fallback_patch = fetch_patch_candidates()
        resolved_patch, records = fetch_records(current_patch, fallback_patch)
        previous = None
        if output_path.exists():
            try:
                previous = json.loads(output_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                previous = None
        snapshot = build_snapshot(resolved_patch, records, previous)
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

