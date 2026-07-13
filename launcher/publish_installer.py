import os
import sys
import json
import re
import urllib.request
import urllib.error

# --- CONFIGURACIÓN ---
# Resolver directorio raíz del proyecto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROYECTO_DIR = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) == "launcher" else SCRIPT_DIR
ENV_PATH = os.path.join(PROYECTO_DIR, ".env")

def load_env(env_path):
    """Carga variables de entorno de forma manual desde un archivo .env local."""
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                # Ignorar comentarios y líneas vacías
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip()
    return env_vars

def detect_version():
    """Busca la versión configurada en launcher/HexDraftSetup.iss."""
    iss_path = os.path.join(PROYECTO_DIR, "launcher", "HexDraftSetup.iss")
    if os.path.exists(iss_path):
        try:
            with open(iss_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("AppVerName="):
                        parts = line.split("=")
                        if len(parts) > 1:
                            match = re.search(r"(\d+\.\d+\.\d+)", parts[1])
                            if match:
                                return match.group(1)
                    elif line.startswith("VersionInfoVersion="):
                        parts = line.split("=")
                        if len(parts) > 1:
                            match = re.search(r"(\d+\.\d+\.\d+)", parts[1])
                            if match:
                                return match.group(1)
        except Exception as e:
            print(f"⚠️ Advertencia al leer HexDraftSetup.iss: {e}")
    return "1.3.0"  # fallback por defecto

def main():
    print("====================================================")
    print(">>> Publicador de instaladores de HexDraft a GitHub >>>")
    print("====================================================\n")
    
    # 1. Cargar Token
    env = load_env(ENV_PATH)
    github_token = env.get("GITHUB_LAUNCHER_TOKEN")
    
    # Fallback 1: data/config.json
    if not github_token:
        config_path = os.path.join(PROYECTO_DIR, "data", "config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                    github_token = config_data.get("github_token")
                    if github_token:
                        print("[INFO] Usando token de GitHub desde data/config.json")
            except Exception as e:
                print(f"[WARN] Error leyendo data/config.json: {e}")
                
    # Fallback 2: variables de entorno
    if not github_token:
        github_token = os.environ.get("GITHUB_LAUNCHER_TOKEN") or os.environ.get("GITHUB_TOKEN")
        
    if not github_token:
        print("[ERROR] No se encontró token de GitHub en .env, data/config.json ni variables de entorno.")
        print("Por favor, asegúrate de configurarlo.")
        sys.exit(1)
        
    github_repo = "JqSilva/HexDraft-Launcher"
    
    # 2. Detectar y solicitar versión
    default_version = detect_version()
    print(f"Versión detectada en script de Inno Setup: {default_version}")
    version = input(f"Introduce la versión a publicar (Por defecto [{default_version}]): ").strip()
    if not version:
        version = default_version
        
    # 3. Selección de instalador a subir
    print("\nSelecciona qué instalador(es) deseas subir:")
    print("1) Solo Instalador de Usuario (Normal)")
    print("2) Solo Instalador de Administrador (Admin)")
    print("3) Ambos instaladores (Normal y Admin)")
    
    opcion = input("Elige una opción (1/2/3 - Por defecto [3]): ").strip()
    if not opcion:
        opcion = "3"
        
    dist_installer_dir = os.path.join(PROYECTO_DIR, "dist-installer")
    user_installer_name = f"HexDraft-Setup-{version}.exe"
    admin_installer_name = f"HexDraft-Setup-Admin-{version}.exe"
    
    user_installer_path = os.path.join(dist_installer_dir, user_installer_name)
    admin_installer_path = os.path.join(dist_installer_dir, admin_installer_name)
    
    files_to_upload = []
    if opcion == "1":
        files_to_upload.append((user_installer_name, user_installer_path))
    elif opcion == "2":
        files_to_upload.append((admin_installer_name, admin_installer_path))
    elif opcion == "3":
        files_to_upload.append((user_installer_name, user_installer_path))
        files_to_upload.append((admin_installer_name, admin_installer_path))
    else:
        print("[ERROR] Opción inválida.")
        sys.exit(1)
        
    # Validar existencia local de los archivos seleccionados
    print("\nVerificando archivos locales...")
    for name, path in files_to_upload:
        if os.path.exists(path):
            size_mb = os.path.getsize(path) / 1024 / 1024
            print(f"  [OK] Encontrado: {name} ({size_mb:.2f} MB)")
        else:
            print(f"  [ERROR] No se encuentra {name} en {dist_installer_dir}")
            print("  Por favor, genera primero el instalador correspondiente con Inno Setup.")
            sys.exit(1)
            
    # 4. Consultar o crear la Release en GitHub
    tag_name = f"v{version}"
    latest_url = f"https://api.github.com/repos/{github_repo}/releases/tags/{tag_name}"
    
    req_check = urllib.request.Request(latest_url)
    req_check.add_header("Authorization", f"token {github_token}")
    req_check.add_header("Accept", "application/vnd.github.v3+json")
    req_check.add_header("User-Agent", "HexDraft-Publisher-Python")
    
    release_data = None
    try:
        print(f"\nConsultando release para el tag '{tag_name}' en GitHub...")
        with urllib.request.urlopen(req_check) as response:
            release_data = json.loads(response.read().decode("utf-8"))
            print(f"[API] Release '{tag_name}' encontrada. Se utilizará la existente.")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"[API] La release '{tag_name}' no existe. Creando una nueva...")
        else:
            print(f"[ERROR] al consultar la release ({e.code}): {e.read().decode('utf-8')}")
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] de conexión: {e}")
        sys.exit(1)
        
    # Crear release si no existe
    if not release_data:
        body_text = (
            f"HexDraft Versión {version}\n\n"
            "Descarga el instalador correspondiente:\n\n"
            f"    Instalador de Usuario (HexDraft-Setup-{version}.exe): Se instala en el perfil del usuario actual sin requerir permisos de administrador.\n"
            f"    Instalador de Administrador (HexDraft-Setup-Admin-{version}.exe): Se instala a nivel de sistema para todos los usuarios (requiere permisos de administrador)."
        )
        
        create_url = f"https://api.github.com/repos/{github_repo}/releases"
        create_payload = json.dumps({
            "tag_name": tag_name,
            "name": f"HexDraft Versión {version}",
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
                print(f"[OK] Nueva release '{tag_name}' creada con éxito. URL: {release_data['html_url']}")
        except urllib.error.HTTPError as e:
            print(f"[ERROR] al crear la release ({e.code}): {e.read().decode('utf-8')}")
            sys.exit(1)
        except Exception as e:
            print(f"[ERROR] al crear la release: {e}")
            sys.exit(1)
            
    # 5. Subir los archivos seleccionados como assets
    upload_url_template = release_data["upload_url"]
    upload_base_url = upload_url_template.split("{")[0]
    existing_assets = release_data.get("assets", [])
    
    print("\nIniciando subida de assets a GitHub...")
    for name, path in files_to_upload:
        # Verificar si el asset ya existe y borrarlo para evitar conflictos
        for asset in existing_assets:
            if asset["name"] == name:
                asset_id = asset["id"]
                print(f"[INFO] El asset '{name}' ya existe en la release (ID: {asset_id}). Eliminándolo...")
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
                print(f"  [OK] Asset '{name}' subido con éxito.")
        except urllib.error.HTTPError as e:
            print(f"  [ERROR] al subir asset '{name}' ({e.code}): {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"  [ERROR] al subir asset '{name}': {e}")
            
    print("\n[FINISH] Proceso de publicación completado.")
    print(f"[URL] Puedes ver el resultado en: {release_data['html_url']}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[CANCEL] Proceso cancelado por el usuario.")
        sys.exit(0)
