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

def parse_version(v_str):
    """Parsea una cadena de versión a una tupla de enteros para su comparación lógica."""
    clean = re.sub(r"[^\d.]", "", v_str)
    try:
        return tuple(int(x) for x in clean.split(".") if x.isdigit())
    except Exception:
        return (0, 0, 0)

def get_outdated_local_installers(dist_installer_dir):
    """Filtra y retorna la lista de instaladores locales desactualizados (menores a las versiones locales más recientes)."""
    local_files = list_local_installers(dist_installer_dir)
    max_normal_ver = (0, 0, 0)
    max_admin_ver = (0, 0, 0)
    
    for filename in local_files:
        match = re.search(r"(\d+\.\d+\.\d+)", filename)
        if not match:
            continue
        ver_tuple = parse_version(match.group(1))
        if "Admin" in filename:
            if ver_tuple > max_admin_ver:
                max_admin_ver = ver_tuple
        else:
            if ver_tuple > max_normal_ver:
                max_normal_ver = ver_tuple
                
    outdated = []
    for filename in local_files:
        match = re.search(r"(\d+\.\d+\.\d+)", filename)
        if not match:
            continue
        ver_tuple = parse_version(match.group(1))
        
        if "Admin" in filename:
            if ver_tuple < max_admin_ver:
                outdated.append(filename)
        else:
            if ver_tuple < max_normal_ver:
                outdated.append(filename)
    return outdated, max_normal_ver, max_admin_ver

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
        print(f"❌ Error al consultar releases en GitHub: {e}")
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

def main():
    print("\n\n\n====================================================")
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
    
    while True:
        print("\nElige una acción:")
        print("1) Subir instalador(es) a GitHub")
        print("2) Eliminar versiones (releases) antiguas")
        print("3) Eliminar Instaladores antiguos")
        print("4) Salir")
        
        opcion_menu = input("Elige una opción (1/2/3/4 - Por defecto [1]): ").strip()
        if not opcion_menu:
            opcion_menu = "1"
            
        if opcion_menu == "1":
            # --- SUBIR INSTALADORES ---
            current_ver = detect_version()
            print(f"\nVersion mas reciente detectada: {current_ver}")
            
            dist_installer_dir = os.path.join(PROYECTO_DIR, "dist-installer")
            local_files = list_local_installers(dist_installer_dir)
            
            if not local_files:
                print(f"\n[ERROR] No se encontraron instaladores ejecutables en '{dist_installer_dir}'.")
                print("Por favor, genera primero el instalador correspondiente con Inno Setup.")
                continue
                
            print("Instaladores disponibles:")
            for i, filename in enumerate(local_files, 1):
                filepath = os.path.join(dist_installer_dir, filename)
                size_mb = os.path.getsize(filepath) / 1024 / 1024
                print(f" {i}) {filename} ({size_mb:.2f} MB)")
            print(f" {len(local_files) + 1}) Todos")
            print(f" {len(local_files) + 2}) Volver")
            
            seleccion = input(f"Elige el instalador que deseas subir (1-{len(local_files) + 2} - Por defecto [1]): ").strip()
            if not seleccion:
                seleccion = "1"
                
            if not seleccion.isdigit():
                print("[ERROR] Selección inválida.")
                continue
                
            idx = int(seleccion)
            if idx == len(local_files) + 2:
                continue  # Volver
                
            files_to_upload = []
            if idx == len(local_files) + 1:
                # Todos
                for filename in local_files:
                    filepath = os.path.join(dist_installer_dir, filename)
                    files_to_upload.append((filename, filepath))
            elif 1 <= idx <= len(local_files):
                filename = local_files[idx - 1]
                filepath = os.path.join(dist_installer_dir, filename)
                files_to_upload.append((filename, filepath))
            else:
                print("[ERROR] Selección fuera de rango.")
                continue
                
            # Extraer versión del primer archivo
            version = current_ver
            first_filename = files_to_upload[0][0]
            match = re.search(r"(\d+\.\d+\.\d+)", first_filename)
            if match:
                version = match.group(1)
            
            print(f"\n[INFO] Versión identificada para la release: {version}")
            
            # Consultar/Crear la Release en GitHub
            tag_name = f"v{version}"
            latest_url = f"https://api.github.com/repos/{github_repo}/releases/tags/{tag_name}"
            
            req_check = urllib.request.Request(latest_url)
            req_check.add_header("Authorization", f"token {github_token}")
            req_check.add_header("Accept", "application/vnd.github.v3+json")
            req_check.add_header("User-Agent", "HexDraft-Publisher-Python")
            
            release_data = None
            try:
                print(f"Consultando release para el tag '{tag_name}' en GitHub...")
                with urllib.request.urlopen(req_check) as response:
                    release_data = json.loads(response.read().decode("utf-8"))
                    print(f"[API] Release '{tag_name}' encontrada. Se utilizará la existente.")
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    print(f"[API] La release '{tag_name}' no existe. Creando una nueva...")
                else:
                    print(f"[ERROR] al consultar la release ({e.code}): {e.read().decode('utf-8')}")
                    continue
            except Exception as e:
                print(f"[ERROR] de conexión: {e}")
                continue
                
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
                    continue
                except Exception as e:
                    print(f"[ERROR] al crear la release: {e}")
                    continue
                    
            # Subir los archivos seleccionados como assets
            upload_url_template = release_data["upload_url"]
            upload_base_url = upload_url_template.split("{")[0]
            existing_assets = release_data.get("assets", [])
            
            print("\nIniciando subida de assets a GitHub...")
            for name, path in files_to_upload:
                # Verificar si el asset ya existe y borrarlo
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
            
        elif opcion_menu == "2":
            # --- ELIMINAR RELEASES ANTIGUAS ---
            current_ver = detect_version()
            print(f"\nVersion mas reciente detectada: {current_ver}")
            
            releases = get_releases(github_repo, github_token)
            if not releases:
                print("\n[INFO] No se encontraron releases en GitHub.")
                continue
                
            print("Releases encontradas en GitHub:")
            for i, rel in enumerate(releases, 1):
                tag = rel.get("tag_name", "Desconocido")
                name = rel.get("name", "Sin nombre")
                assets_count = len(rel.get("assets", []))
                print(f" {i}) {tag} - {name} ({assets_count} assets)")
                
            print(f" {len(releases) + 1}) Eliminar TODAS las anteriores a la versión actual")
            print(f" {len(releases) + 2}) Volver")
            
            sel_del = input(f"Elige la release que deseas eliminar por completo (1-{len(releases) + 2}): ").strip()
            if not sel_del:
                continue
                
            if not sel_del.isdigit():
                print("[ERROR] Selección inválida.")
                continue
                
            idx_del = int(sel_del)
            if idx_del == len(releases) + 2:
                continue  # Volver
                
            if idx_del == len(releases) + 1:
                # Determinar la versión más reciente en GitHub para cada tipo de instalador
                max_normal_ver = (0, 0, 0)
                max_normal_tag = None
                max_admin_ver = (0, 0, 0)
                max_admin_tag = None
                
                for rel in releases:
                    tag = rel.get("tag_name", "")
                    assets = rel.get("assets", [])
                    
                    for asset in assets:
                        name = asset.get("name", "")
                        match = re.search(r"(\d+\.\d+\.\d+)", name)
                        if not match:
                            continue
                        ver_tuple = parse_version(match.group(1))
                        
                        if "Admin" in name:
                            if ver_tuple > max_admin_ver:
                                max_admin_ver = ver_tuple
                                max_admin_tag = tag
                        else:
                            if ver_tuple > max_normal_ver:
                                max_normal_ver = ver_tuple
                                max_normal_tag = tag
                                
                print(f"\n[INFO] Versión más reciente de Instalador Normal en GitHub: {max_normal_tag or 'Ninguna'}")
                print(f"[INFO] Versión más reciente de Instalador Admin en GitHub: {max_admin_tag or 'Ninguna'}")
                
                confirm = input("⚠️ ¿Estás completamente seguro de eliminar TODAS las releases de GitHub anteriores (exceptuando las más recientes de cada tipo)? (s/n): ").strip().lower()
                if confirm == "s":
                    # Eliminar de GitHub
                    for rel in releases:
                        tag = rel.get("tag_name", "")
                        if tag == max_normal_tag or tag == max_admin_tag:
                            print(f"[CONSERVAR] Conservando release '{tag}' por ser la más reciente de su tipo.")
                            continue
                        delete_release(github_repo, github_token, rel["id"], tag)
                continue
                
            if 1 <= idx_del <= len(releases):
                target_rel = releases[idx_del - 1]
                tag = target_rel.get("tag_name", "")
                confirm = input(f"⚠️ ¿Estás 100% seguro de que deseas eliminar permanentemente la release '{tag}' y su tag en Git de GitHub? (s/n): ").strip().lower()
                if confirm == "s":
                    # Eliminar de GitHub
                    delete_release(github_repo, github_token, target_rel["id"], tag)
            else:
                print("[ERROR] Opción inválida.")
                
        elif opcion_menu == "3":
            # --- ELIMINAR INSTALADORES LOCALES ANTIGUOS ---
            current_ver = detect_version()
            print(f"\nVersion mas reciente detectada: {current_ver}")
            
            dist_installer_dir = os.path.join(PROYECTO_DIR, "dist-installer")
            outdated_files, max_local_normal, max_local_admin = get_outdated_local_installers(dist_installer_dir)
            
            if not outdated_files:
                print("\n[INFO] No se detectaron instaladores desactualizados en dist-installer.")
                print(f"  (Las versiones locales más recientes son Normal: {'.'.join(map(str, max_local_normal))} y Admin: {'.'.join(map(str, max_local_admin))})")
                continue
                
            print(f"\nInstaladores desactualizados detectados en \\dist-installer:")
            for i, filename in enumerate(outdated_files, 1):
                filepath = os.path.join(dist_installer_dir, filename)
                size_mb = os.path.getsize(filepath) / 1024 / 1024
                print(f" {i}) {filename} ({size_mb:.2f} MB)")
            print(f" {len(outdated_files) + 1}) Todos")
            print(f" {len(outdated_files) + 2}) Volver")
            
            seleccion = input(f"Elige el instalador local que deseas eliminar (1-{len(outdated_files) + 2} - Por defecto [1]): ").strip()
            if not seleccion:
                seleccion = "1"
                
            if not seleccion.isdigit():
                print("[ERROR] Selección inválida.")
                continue
                
            idx = int(seleccion)
            if idx == len(outdated_files) + 2:
                continue  # Volver
                
            files_to_delete = []
            if idx == len(outdated_files) + 1:
                # Todos
                files_to_delete = outdated_files
            elif 1 <= idx <= len(outdated_files):
                files_to_delete = [outdated_files[idx - 1]]
            else:
                print("[ERROR] Selección fuera de rango.")
                continue
                
            confirm = input(f"⚠️ ¿Estás seguro de eliminar permanentemente los {len(files_to_delete)} instalador(es) local(es) seleccionado(s)? (s/n): ").strip().lower()
            if confirm == "s":
                for filename in files_to_delete:
                    filepath = os.path.join(dist_installer_dir, filename)
                    try:
                        os.remove(filepath)
                        print(f"  [DELETE LOCAL] Archivo '{filename}' eliminado.")
                    except Exception as e:
                        print(f"  [WARN] No se pudo eliminar archivo local '{filename}': {e}")
            
        elif opcion_menu == "4":
            print("\n¡Proceso finalizado!")
            break
        else:
            print("[ERROR] Opción inválida.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[CANCEL] Proceso cancelado por el usuario.")
        sys.exit(0)
