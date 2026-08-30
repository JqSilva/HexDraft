import os
import sys
import json
import hashlib
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Asegurar estar en el directorio raíz del script
PROYECTO_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROYECTO_DIR)

def load_env(env_path):
    """Carga variables de entorno de forma manual desde un archivo .env local."""
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip()
    return env_vars

print(">>> Iniciando publicación de base de datos a GitHub...")

ENV_PATH = os.path.join(PROYECTO_DIR, ".env")
env = load_env(ENV_PATH)

# Intentar obtener el token de .env primero
github_token = env.get("GITHUB_LAUNCHER_TOKEN") or env.get("GITHUB_TOKEN")
github_repo = None

# 1. Intentar cargar config.json
config_path = os.path.join(PROYECTO_DIR, "data", "config.json")
if os.path.exists(config_path):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            if not github_token:
                github_token = config.get("github_token")
            github_repo = config.get("github_repo")
            print(f"  [OK] Configuración cargada desde data/config.json (Modo: {config.get('mode')})")
    except Exception as e:
        print(f"  [WARN] Error leyendo data/config.json: {e}")

# Fallbacks de entorno del sistema
if not github_token:
    github_token = os.environ.get("GITHUB_LAUNCHER_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if github_token:
        print("  [OK] Usando GITHUB_TOKEN desde variable de entorno del sistema.")

if not github_repo:
    github_repo = "JqSilva/HexDraft-Releases" # Fallback por defecto

if not github_token:
    print("[ERROR] No se encontró token de GitHub. Configura 'github_token' en data/config.json, define la variable en .env o la variable de entorno GITHUB_TOKEN.")
    sys.exit(1)

# 2. Validar hexdraft.db
db_path = os.path.join(PROYECTO_DIR, "hexdraft.db")
if not os.path.exists(db_path):
    print(f"[ERROR] No se encontró el archivo de base de datos local en: {db_path}")
    sys.exit(1)

# 3. Leer el parche real de los datos sincronizados
def patch_key(value):
    try:
        return tuple(int(part) for part in str(value).split("."))
    except (TypeError, ValueError):
        return tuple()

def is_valid_patch(value):
    return bool(value and str(value).strip() not in {"-", "0"} and patch_key(value))

patch_candidates = []
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM config WHERE key IN ('last_sync_version', 'last_lane_sync_version')")
    for (value,) in cursor.fetchall():
        if is_valid_patch(value):
            patch_candidates.append(str(value).strip())

    cursor.execute("SELECT DISTINCT patch FROM builds WHERE patch IS NOT NULL AND patch <> ''")
    for (value,) in cursor.fetchall():
        if is_valid_patch(value):
            patch_candidates.append(str(value).strip())
    conn.close()
except Exception as e:
    print(f"  [WARN] No se pudo leer el parche desde la base de datos: {e}")

if patch_candidates:
    patch = max(patch_candidates, key=patch_key)
    print(f"  [OK] Parche detectado en datos persistidos: {patch}")
else:
    patch = "-"
    print("  [WARN] No se encontró un parche válido en SQLite; se publicará como '-'.")

# 4. Obtener última release remota para calcular versión incremental
print("Consultando última versión publicada en GitHub...")
latest_url = f"https://api.github.com/repos/{github_repo}/releases/latest"
req = urllib.request.Request(latest_url)
req.add_header("Authorization", f"token {github_token}")
req.add_header("Accept", "application/vnd.github.v3+json")
req.add_header("User-Agent", "HexDraft-Publisher-Python")

latest_version = 0
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        body_text = data.get("body", "")
        remote_manifest = None
        try:
            remote_manifest = json.loads(body_text)
        except Exception:
            import re
            match = re.search(r"\{.*?\}", body_text, re.DOTALL)
            if match:
                try: remote_manifest = json.loads(match.group(0))
                except Exception: pass
        if remote_manifest and "version" in remote_manifest:
            latest_version = int(remote_manifest["version"])
            print(f"  [API] Última versión publicada detectada: v{latest_version}")
except urllib.error.HTTPError as e:
    if e.code == 404:
        print("  [API] No se encontraron publicaciones previas en GitHub. Iniciando desde v0.")
    else:
        print(f"  [WARN] Error consultando API de GitHub ({e.code}). Se asume v0.")
except Exception as e:
    print(f"  [WARN] Error consultando versión remota anterior: {e}. Se asume v0.")

new_version = latest_version + 1
last_update = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# 5. Cargar archivo hexdraft.db en memoria y calcular SHA256 único
print("Cargando hexdraft.db en memoria y calculando SHA256...")
try:
    with open(db_path, "rb") as f:
        file_data = f.read()
except Exception as e:
    print(f"[ERROR] al leer archivo hexdraft.db: {e}")
    sys.exit(1)

checksum = hashlib.sha256(file_data).hexdigest()
size_bytes = len(file_data)
print(f"Checksum SHA256: {checksum}")
print(f"Tamaño: {size_bytes / 1024 / 1024:.2f} MB")

manifest = {
    "patch": patch,
    "lastUpdate": last_update,
    "version": new_version,
    "checksum": checksum,
    "size": size_bytes
}

# 6. Crear la nueva GitHub Release
print(f"Creando nueva release en GitHub: v{new_version} (Parche {patch})...")
create_url = f"https://api.github.com/repos/{github_repo}/releases"
create_data = json.dumps({
    "tag_name": f"db-v{new_version}",
    "name": f"v{new_version} - Parche {patch}",
    "body": json.dumps(manifest, indent=2),
    "draft": False,
    "prerelease": False
}).encode("utf-8")

req_create = urllib.request.Request(create_url, data=create_data, method="POST")
req_create.add_header("Authorization", f"token {github_token}")
req_create.add_header("Content-Type", "application/json")
req_create.add_header("User-Agent", "HexDraft-Publisher-Python")

try:
    with urllib.request.urlopen(req_create) as response:
        release_data = json.loads(response.read().decode("utf-8"))
        upload_url_template = release_data["upload_url"]
        html_url = release_data["html_url"]
        print(f"  [OK] Release creada con éxito. URL: {html_url}")
except urllib.error.HTTPError as e:
    print(f"  [ERROR] al crear release en GitHub ({e.code}): {e.read().decode('utf-8')}")
    sys.exit(1)
except Exception as e:
    print(f"  [ERROR] al crear release en GitHub: {e}")
    sys.exit(1)

# 7. Subir hexdraft.db como asset binario (usando los mismos bytes leídos en memoria)
upload_url = upload_url_template.split("{")[0] + "?name=hexdraft.db"
print("Subiendo hexdraft.db a la release de GitHub (esto puede tomar un momento)...")

try:
    req_upload = urllib.request.Request(upload_url, data=file_data, method="POST")
    req_upload.add_header("Authorization", f"token {github_token}")
    req_upload.add_header("Content-Type", "application/octet-stream")
    req_upload.add_header("Content-Length", str(len(file_data)))
    req_upload.add_header("User-Agent", "HexDraft-Publisher-Python")

    with urllib.request.urlopen(req_upload) as response:
        print("  [OK] Base de datos SQLite subida con éxito como asset de la release.")
except urllib.error.HTTPError as e:
    print(f"  [ERROR] al subir asset ({e.code}): {e.read().decode('utf-8')}")
    sys.exit(1)
except Exception as e:
    print(f"  [ERROR] al subir asset: {e}")
    sys.exit(1)

# 8. Eliminar releases anteriores y sus tags para mantener solo la última release activa
print("Limpiando releases y tags anteriores en GitHub...")
current_release_id = release_data.get("id")

list_releases_url = f"https://api.github.com/repos/{github_repo}/releases"
req_list = urllib.request.Request(list_releases_url)
req_list.add_header("Authorization", f"token {github_token}")
req_list.add_header("Accept", "application/vnd.github.v3+json")
req_list.add_header("User-Agent", "HexDraft-Publisher-Python")

try:
    with urllib.request.urlopen(req_list) as response:
        all_releases = json.loads(response.read().decode("utf-8"))

    if isinstance(all_releases, list):
        old_releases = [r for r in all_releases if r.get("id") != current_release_id]
        print(f"  [INFO] Se encontraron {len(old_releases)} releases anteriores para eliminar.")

        for old in old_releases:
            old_id = old.get("id")
            old_tag = old.get("tag_name")
            old_name = old.get("name", f"ID {old_id}")

            # a. Eliminar release
            if old_id:
                try:
                    del_rel_url = f"https://api.github.com/repos/{github_repo}/releases/{old_id}"
                    req_del_rel = urllib.request.Request(del_rel_url, method="DELETE")
                    req_del_rel.add_header("Authorization", f"token {github_token}")
                    req_del_rel.add_header("Accept", "application/vnd.github.v3+json")
                    req_del_rel.add_header("User-Agent", "HexDraft-Publisher-Python")
                    with urllib.request.urlopen(req_del_rel) as _:
                        pass
                    print(f"  [OK] Release '{old_name}' (ID: {old_id}) eliminada.")
                except urllib.error.HTTPError as e:
                    print(f"  [WARN] No se pudo eliminar release '{old_name}' ({e.code}): {e}")
                except Exception as e:
                    print(f"  [WARN] Error eliminando release '{old_name}': {e}")

            # b. Eliminar tag asociado
            if old_tag:
                try:
                    del_tag_url = f"https://api.github.com/repos/{github_repo}/git/refs/tags/{old_tag}"
                    req_del_tag = urllib.request.Request(del_tag_url, method="DELETE")
                    req_del_tag.add_header("Authorization", f"token {github_token}")
                    req_del_tag.add_header("Accept", "application/vnd.github.v3+json")
                    req_del_tag.add_header("User-Agent", "HexDraft-Publisher-Python")
                    with urllib.request.urlopen(req_del_tag) as _:
                        pass
                    print(f"  [OK] Tag '{old_tag}' eliminado.")
                except urllib.error.HTTPError as e:
                    print(f"  [WARN] No se pudo eliminar tag '{old_tag}' ({e.code}): {e}")
                except Exception as e:
                    print(f"  [WARN] Error eliminando tag '{old_tag}': {e}")
except urllib.error.HTTPError as e:
    print(f"  [WARN] Error al listar releases para limpieza ({e.code}): {e}")
except Exception as e:
    print(f"  [WARN] Error durante el proceso de limpieza de releases anteriores: {e}")

# 9. Guardar el manifest en data/db-version.json local
try:
    db_version_dir = os.path.dirname(config_path)
    if not os.path.exists(db_version_dir):
        os.makedirs(db_version_dir, exist_ok=True)
    db_version_path = os.path.join(db_version_dir, "db-version.json")
    with open(db_version_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        print(f"  [OK] Manifest local guardado en: {db_version_path}")
except Exception as e:
    print(f"  [WARN] Error guardando el manifest local: {e}")

print("[FINISH] ¡Proceso de publicación finalizado con éxito!")
