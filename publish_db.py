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

# Calcular SHA256 y tamaño
print("Calculando SHA256 y tamaño de hexdraft.db...")
sha256 = hashlib.sha256()
size_bytes = os.path.getsize(db_path)

with open(db_path, "rb") as f:
    for chunk in iter(lambda: f.read(4096), b""):
        sha256.update(chunk)
checksum = sha256.hexdigest()
print(f"Checksum SHA256: {checksum}")
print(f"Tamaño: {size_bytes / 1024 / 1024:.2f} MB")

# 3. Leer versión del parche actual (patch)
patch = "-"
meta_path = os.path.join(PROYECTO_DIR, "src", "lib", "data", "meta-cache.json")
if os.path.exists(meta_path):
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            patch = meta.get("version", "-")
            print(f"  [OK] Parche detectado en meta-cache.json: {patch}")
    except Exception as e:
        print(f"  [WARN] Error leyendo meta-cache.json: {e}")

if patch == "-":
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM config WHERE key = 'last_sync_version'")
        row = cursor.fetchone()
        if row:
            patch = row[0]
            print(f"  [OK] Parche detectado en base de datos SQLite: {patch}")
        conn.close()
    except Exception as e:
        print(f"  [WARN] No se pudo leer el parche desde la base de datos: {e}")

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

manifest = {
    "patch": patch,
    "lastUpdate": last_update,
    "version": new_version,
    "checksum": checksum,
    "size": size_bytes
}

# 5. Crear la nueva GitHub Release
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

# 6. Subir hexdraft.db como asset binario
upload_url = upload_url_template.split("{")[0] + "?name=hexdraft.db"
print("Subiendo hexdraft.db a la release de GitHub (esto puede tomar un momento)...")

try:
    with open(db_path, "rb") as f:
        file_data = f.read()

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

# 7. Guardar el manifest en data/db-version.json local
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
