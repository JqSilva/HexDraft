import os
import sys
import json
import re
import argparse
import urllib.request
import urllib.error

# Resolver directorio raiz del proyecto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROYECTO_DIR = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) == "launcher" else SCRIPT_DIR
ENV_PATH = os.path.join(PROYECTO_DIR, ".env")

try:
    from .version_manager import parse_version, obtener_version_actual
except ImportError:
    from version_manager import parse_version, obtener_version_actual

def load_env(env_path):
    """Carga variables de entorno de forma manual desde un archivo .env local."""
    env_vars = {}
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        env_vars[key.strip()] = val.strip()
        except Exception as e:
            print(f"[WARN] Error al leer archivo .env: {e}")
    return env_vars

def resolver_github_token(proyecto_dir=None):
    """Resuelve el token de GitHub desde .env, data/config.json o variables de entorno del sistema."""
    if not proyecto_dir:
        proyecto_dir = PROYECTO_DIR

    env = load_env(os.path.join(proyecto_dir, ".env"))
    token = env.get("GITHUB_LAUNCHER_TOKEN") or env.get("GITHUB_TOKEN")

    if not token:
        config_path = os.path.join(proyecto_dir, "data", "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                    token = config_data.get("github_token")
            except Exception:
                pass

    if not token:
        token = os.environ.get("GITHUB_LAUNCHER_TOKEN") or os.environ.get("GITHUB_TOKEN")

    return token

def list_local_installers(dist_installer_dir):
    """Retorna una lista ordenada de instaladores ejecutables encontrados localmente."""
    if not os.path.exists(dist_installer_dir):
        return []
    files = []
    for file in os.listdir(dist_installer_dir):
        if file.endswith(".exe") and "Setup" in file:
            files.append(file)
    return sorted(files)

def get_releases(github_repo, github_token):
    """Consulta la lista de todas las releases en el repositorio de GitHub."""
    url = f"https://api.github.com/repos/{github_repo}/releases"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"token {github_token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "HexDraft-Publisher-Python")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"[ERROR] Error al consultar releases en GitHub: {e}")
        return []

def delete_release(github_repo, github_token, release_id, tag_name):
    """Elimina permanentemente una release y su tag git asociado de GitHub."""
    # 1. Eliminar release
    url_release = f"https://api.github.com/repos/{github_repo}/releases/{release_id}"
    req_release = urllib.request.Request(url_release, method="DELETE")
    req_release.add_header("Authorization", f"token {github_token}")
    req_release.add_header("User-Agent", "HexDraft-Publisher-Python")
    try:
        with urllib.request.urlopen(req_release) as response:
            print(f"  [DELETE] Release '{tag_name}' (ID: {release_id}) eliminada de GitHub.")
    except Exception as e:
        print(f"  [WARN] No se pudo eliminar la release '{tag_name}': {e}")

    # 2. Eliminar referencia del tag git
    url_tag = f"https://api.github.com/repos/{github_repo}/git/refs/tags/{tag_name}"
    req_tag = urllib.request.Request(url_tag, method="DELETE")
    req_tag.add_header("Authorization", f"token {github_token}")
    req_tag.add_header("User-Agent", "HexDraft-Publisher-Python")
    try:
        with urllib.request.urlopen(req_tag) as response:
            print(f"  [DELETE] Tag git '{tag_name}' eliminado del repositorio remoto.")
    except Exception as e:
        print(f"  [INFO] Tag git '{tag_name}' no se pudo eliminar o ya estaba borrado.")

def eliminar_releases_antiguas(github_repo, github_token, tag_actual_a_conservar):
    """Elimina todas las releases y tags anteriores en GitHub, conservando la version actual."""
    print(f"\n>>> Limpiando releases anteriores en GitHub (conservando '{tag_actual_a_conservar}')...")
    releases = get_releases(github_repo, github_token)
    if not releases:
        print("[INFO] No se encontraron releases previas.")
        return

    eliminadas = 0
    for rel in releases:
        tag = rel.get("tag_name", "")
        if tag and tag != tag_actual_a_conservar:
            delete_release(github_repo, github_token, rel.get("id"), tag)
            eliminadas += 1

    if eliminadas > 0:
        print(f"[OK] Se eliminaron {eliminadas} release(s) antigua(s) en GitHub.")
    else:
        print("[INFO] No habia releases antiguas para eliminar.")

def subir_archivos_release(github_repo, github_token, version, files_to_upload):
    """Crea o actualiza una release en GitHub y sube los archivos de instalador especificados."""
    if not files_to_upload:
        print("[WARN] No hay archivos seleccionados para subir.")
        return False

    tag_name = f"v{version}"
    latest_url = f"https://api.github.com/repos/{github_repo}/releases/tags/{tag_name}"
    
    req_check = urllib.request.Request(latest_url)
    req_check.add_header("Authorization", f"token {github_token}")
    req_check.add_header("Accept", "application/vnd.github.v3+json")
    req_check.add_header("User-Agent", "HexDraft-Publisher-Python")
    
    release_data = None
    try:
        print(f"\n>>> Consultando release para el tag '{tag_name}' en GitHub ({github_repo})...")
        with urllib.request.urlopen(req_check) as response:
            release_data = json.loads(response.read().decode("utf-8"))
            print(f"[API] Release '{tag_name}' encontrada. Se utilizara la existente.")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"[API] La release '{tag_name}' no existe. Creando una nueva...")
        else:
            print(f"[ERROR] al consultar la release ({e.code}): {e.read().decode('utf-8')}")
            return False
    except Exception as e:
        print(f"[ERROR] de conexion: {e}")
        return False
        
    # Crear release si no existe
    if not release_data:
        body_text = (
            f"HexDraft Version {version}\n\n"
            "Descarga el instalador correspondiente:\n\n"
            f"- Instalador de Usuario (HexDraft-Setup-{version}.exe): Se instala en el perfil del usuario actual sin requerir permisos de administrador."
        )
        
        create_url = f"https://api.github.com/repos/{github_repo}/releases"
        create_payload = json.dumps({
            "tag_name": tag_name,
            "name": f"HexDraft Version {version}",
            "body": body_text,
            "draft": False,
            "prerelease": False
        }).encode("utf-8")
        
        req_create = urllib.request.Request(create_url, data=create_payload, method="POST")
        req_create.add_header("Authorization", f"token {github_token}")
        req_create.add_header("Content-Type", "application/json")
        req_create.add_header("User-Agent", "HexDraft-Publisher-Python")
        
        try:
            with urllib.request.urlopen(req_create) as response:
                release_data = json.loads(response.read().decode("utf-8"))
                print(f"[OK] Nueva release '{tag_name}' creada con exito. URL: {release_data['html_url']}")
        except urllib.error.HTTPError as e:
            print(f"[ERROR] al crear la release ({e.code}): {e.read().decode('utf-8')}")
            return False
        except Exception as e:
            print(f"[ERROR] al crear la release: {e}")
            return False
            
    upload_url_template = release_data["upload_url"]
    upload_base_url = upload_url_template.split("{")[0]
    existing_assets = release_data.get("assets", [])
    
    print("\n>>> Iniciando subida de assets a GitHub...")
    for name, path in files_to_upload:
        if not os.path.exists(path):
            print(f"[ERROR] No se encuentra el archivo local: {path}")
            continue

        # Verificar si el asset ya existe y borrarlo
        for asset in existing_assets:
            if asset["name"] == name:
                asset_id = asset["id"]
                print(f"[INFO] El asset '{name}' ya existe en la release (ID: {asset_id}). Eliminando version previa...")
                delete_url = f"https://api.github.com/repos/{github_repo}/releases/assets/{asset_id}"
                req_delete = urllib.request.Request(delete_url, method="DELETE")
                req_delete.add_header("Authorization", f"token {github_token}")
                req_delete.add_header("User-Agent", "HexDraft-Publisher-Python")
                try:
                    with urllib.request.urlopen(req_delete) as response:
                        print(f"  [DELETE] Asset '{name}' anterior eliminado.")
                except Exception as e:
                    print(f"  [WARN] Advertencia al eliminar asset existente '{name}': {e}")
                    
        # Subir el archivo nuevo
        upload_url = f"{upload_base_url}?name={name}"
        size_bytes = os.path.getsize(path)
        print(f"[UPLOAD] Subiendo '{name}' ({size_bytes / 1024 / 1024:.2f} MB)...")
        
        try:
            with open(path, "rb") as f:
                file_data = f.read()
                
            req_upload = urllib.request.Request(upload_url, data=file_data, method="POST")
            req_upload.add_header("Authorization", f"token {github_token}")
            req_upload.add_header("Content-Type", "application/octet-stream")
            req_upload.add_header("Content-Length", str(size_bytes))
            req_upload.add_header("User-Agent", "HexDraft-Publisher-Python")
            
            with urllib.request.urlopen(req_upload) as response:
                print(f"  [OK] Asset '{name}' subido con exito.")
        except urllib.error.HTTPError as e:
            print(f"  [ERROR] al subir asset '{name}' ({e.code}): {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"  [ERROR] al subir asset '{name}': {e}")
            
    print("\n[FINISH] Proceso de publicacion de assets completado.")
    print(f"[URL] Release disponible en: {release_data['html_url']}\n")
    return True

def subir_instaladores_a_github(version=None, files_to_upload=None, repo=None, token=None, solo_user=True, limpiar_anteriores=True):
    """Punto de entrada programatico para subir instalador(es) a GitHub y opcionalmente limpiar versiones previas."""
    github_repo = repo or "JqSilva/HexDraft-Launcher"
    github_token = token or resolver_github_token(PROYECTO_DIR)

    if not github_token:
        print("[ERROR] No se encontro token de GitHub en .env, data/config.json ni variables de entorno.")
        return False

    if not version:
        version = obtener_version_actual(PROYECTO_DIR)

    dist_installer_dir = os.path.join(PROYECTO_DIR, "dist-installer")

    if files_to_upload is None:
        local_files = list_local_installers(dist_installer_dir)
        files_to_upload = []
        for filename in local_files:
            if version in filename:
                if solo_user and "Admin" in filename:
                    continue
                filepath = os.path.join(dist_installer_dir, filename)
                files_to_upload.append((filename, filepath))
        
        # Fallback si no coinciden por nombre exacto con la version
        if not files_to_upload and local_files:
            for filename in local_files:
                if solo_user and "Admin" in filename:
                    continue
                filepath = os.path.join(dist_installer_dir, filename)
                files_to_upload.append((filename, filepath))

    if not files_to_upload:
        print(f"[ERROR] No se encontraron instaladores en '{dist_installer_dir}' para la version {version}.")
        return False

    exito = subir_archivos_release(github_repo, github_token, version, files_to_upload)

    if exito and limpiar_anteriores:
        eliminar_releases_antiguas(github_repo, github_token, f"v{version}")

    return exito

def main():
    parser = argparse.ArgumentParser(description="Publicador de instaladores HexDraft a GitHub Releases")
    parser.add_argument("--version", "-v", help="Version de la release a publicar")
    parser.add_argument("--include-admin", action="store_true", help="Incluir instalador de Administrador (por defecto solo sube User)")
    parser.add_argument("--no-clean", action="store_true", help="No eliminar releases antiguas de GitHub")
    parser.add_argument("--repo", default="JqSilva/HexDraft-Launcher", help="Repositorio de GitHub destino")
    args = parser.parse_args()

    print("\n====================================================")
    print(">>> Publicador de instaladores de HexDraft a GitHub >>>")
    print("====================================================\n")
    
    github_token = resolver_github_token(PROYECTO_DIR)
    if not github_token:
        print("[ERROR] No se encontro token de GitHub en .env, data/config.json ni variables de entorno.")
        sys.exit(1)
        
    github_repo = args.repo
    
    # Si se paso la version por argumento CLI
    if args.version:
        subir_instaladores_a_github(
            version=args.version,
            repo=github_repo,
            token=github_token,
            solo_user=not args.include_admin,
            limpiar_anteriores=not args.no_clean
        )
        return

    while True:
        print("\nElige una accion:")
        print("1) Workflow Predeterminado: Subir instalador User (Normal) y limpiar releases antiguas en GitHub [Por defecto / Enter]")
        print("2) Subir instaladores personalizados (Elegir archivos especificos)")
        print("3) Solo eliminar releases antiguas en GitHub")
        print("4) Salir")
        
        opcion_menu = input("Elige una opcion [1-4, por defecto 1]: ").strip()
        if not opcion_menu:
            opcion_menu = "1"
            
        if opcion_menu == "1":
            current_ver = obtener_version_actual(PROYECTO_DIR)
            print(f"\nVersion mas reciente detectada: {current_ver}")
            subir_instaladores_a_github(
                version=current_ver,
                repo=github_repo,
                token=github_token,
                solo_user=True,
                limpiar_anteriores=True
            )
            
        elif opcion_menu == "2":
            current_ver = obtener_version_actual(PROYECTO_DIR)
            print(f"\nVersion mas reciente detectada: {current_ver}")
            
            dist_installer_dir = os.path.join(PROYECTO_DIR, "dist-installer")
            local_files = list_local_installers(dist_installer_dir)
            
            if not local_files:
                print(f"\n[ERROR] No se encontraron instaladores ejecutables en '{dist_installer_dir}'.")
                continue
                
            print("Instaladores disponibles:")
            for i, filename in enumerate(local_files, 1):
                filepath = os.path.join(dist_installer_dir, filename)
                size_mb = os.path.getsize(filepath) / 1024 / 1024
                print(f" {i}) {filename} ({size_mb:.2f} MB)")
            print(f" {len(local_files) + 1}) Todos")
            print(f" {len(local_files) + 2}) Volver")
            
            seleccion = input(f"Elige el instalador que deseas subir (1-{len(local_files) + 2}): ").strip()
            if not seleccion or not seleccion.isdigit():
                continue
                
            idx = int(seleccion)
            if idx == len(local_files) + 2:
                continue
                
            files_to_upload = []
            if idx == len(local_files) + 1:
                for filename in local_files:
                    filepath = os.path.join(dist_installer_dir, filename)
                    files_to_upload.append((filename, filepath))
            elif 1 <= idx <= len(local_files):
                filename = local_files[idx - 1]
                filepath = os.path.join(dist_installer_dir, filename)
                files_to_upload.append((filename, filepath))
            else:
                continue
                
            version = current_ver
            match = re.search(r"(\d+\.\d+\.\d+)", files_to_upload[0][0])
            if match:
                version = match.group(1)
            
            subir_archivos_release(github_repo, github_token, version, files_to_upload)
            
        elif opcion_menu == "3":
            current_ver = obtener_version_actual(PROYECTO_DIR)
            eliminar_releases_antiguas(github_repo, github_token, f"v{current_ver}")
            
        elif opcion_menu == "4":
            print("\nProceso finalizado.")
            break

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[CANCEL] Proceso cancelado por el usuario.")
        sys.exit(0)
