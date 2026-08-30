import os
import re
import json

def parse_version(v_str):
    """Parsea una cadena de version a una tupla de enteros para su comparacion logica."""
    if not v_str:
        return (0, 0, 0)
    clean = re.sub(r"[^\d.]", "", str(v_str))
    try:
        parts = [int(x) for x in clean.split(".") if x.isdigit()]
        while len(parts) < 3:
            parts.append(0)
        return tuple(parts)
    except Exception:
        return (0, 0, 0)

def obtener_version_actual(proyecto_dir=None):
    """Busca y retorna la version mas alta detectada entre los archivos del proyecto."""
    if not proyecto_dir:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        proyecto_dir = os.path.dirname(script_dir) if os.path.basename(script_dir) == "launcher" else script_dir

    versiones = []

    # 1. src/config/version.ts
    version_ts = os.path.join(proyecto_dir, "src", "config", "version.ts")
    if os.path.exists(version_ts):
        try:
            with open(version_ts, "r", encoding="utf-8") as f:
                content = f.read()
                match = re.search(r"APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]", content)
                if match:
                    versiones.append(match.group(1))
        except Exception:
            pass

    # 2. package.json
    package_json = os.path.join(proyecto_dir, "package.json")
    if os.path.exists(package_json):
        try:
            with open(package_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "version" in data and data["version"]:
                    versiones.append(str(data["version"]))
        except Exception:
            pass

    # 3. launcher/HexDraftSetup.iss y HexDraftSetupAdmin.iss
    for iss_name in ["HexDraftSetup.iss", "HexDraftSetupAdmin.iss"]:
        iss_path = os.path.join(proyecto_dir, "launcher", iss_name)
        if os.path.exists(iss_path):
            try:
                with open(iss_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip().startswith("AppVersion="):
                            parts = line.split("=", 1)
                            if len(parts) > 1:
                                match = re.search(r"(\d+\.\d+\.\d+)", parts[1])
                                if match:
                                    versiones.append(match.group(1))
            except Exception:
                pass

    # 4. dist-installer/
    dist_dir = os.path.join(proyecto_dir, "dist-installer")
    if os.path.exists(dist_dir):
        try:
            for file in os.listdir(dist_dir):
                if file.endswith(".exe") and "Setup" in file:
                    match = re.search(r"(\d+\.\d+\.\d+)", file)
                    if match:
                        versiones.append(match.group(1))
        except Exception:
            pass

    if not versiones:
        return "2.5.2"

    max_ver_str = "1.0.0"
    max_ver_tuple = (0, 0, 0)
    for v in versiones:
        v_tuple = parse_version(v)
        if v_tuple > max_ver_tuple:
            max_ver_tuple = v_tuple
            max_ver_str = v

    return max_ver_str

def actualizar_archivo_iss(ruta_iss, nueva_version, es_admin=False):
    """Actualiza las directivas de version en un archivo de script Inno Setup (.iss)."""
    if not os.path.exists(ruta_iss):
        print(f"[WARN] No se encuentra el archivo .iss: {ruta_iss}")
        return False

    try:
        with open(ruta_iss, "r", encoding="utf-8") as f:
            contenido = f.read()

        contenido = re.sub(r"^(AppVersion=).*$", f"\\g<1>{nueva_version}", contenido, flags=re.MULTILINE)

        if es_admin:
            contenido = re.sub(r"^(AppVerName=).*$", f"\\g<1>HexDraft {nueva_version} (Admin)", contenido, flags=re.MULTILINE)
            contenido = re.sub(r"^(OutputBaseFilename=).*$", f"\\g<1>HexDraft-Setup-Admin-{nueva_version}", contenido, flags=re.MULTILINE)
        else:
            contenido = re.sub(r"^(AppVerName=).*$", f"\\g<1>HexDraft {nueva_version}", contenido, flags=re.MULTILINE)
            contenido = re.sub(r"^(OutputBaseFilename=).*$", f"\\g<1>HexDraft-Setup-{nueva_version}", contenido, flags=re.MULTILINE)

        contenido = re.sub(r"^(VersionInfoVersion=).*$", f"\\g<1>{nueva_version}", contenido, flags=re.MULTILINE)

        with open(ruta_iss, "w", encoding="utf-8", newline="\r\n") as f:
            f.write(contenido)
        print(f"  [OK] Actualizado {os.path.basename(ruta_iss)} -> {nueva_version}")
        return True
    except Exception as e:
        print(f"  [ERROR] No se pudo escribir en {ruta_iss}: {e}")
        return False

def sincronizar_version_proyecto(nueva_version, proyecto_dir=None):
    """Sincroniza la nueva version en todos los archivos pertinentes del proyecto."""
    if not nueva_version:
        return False

    if not proyecto_dir:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        proyecto_dir = os.path.dirname(script_dir) if os.path.basename(script_dir) == "launcher" else script_dir

    print(f"\n>>> Sincronizando version '{nueva_version}' en todos los componentes del proyecto...")

    # 1. package.json
    package_json_path = os.path.join(proyecto_dir, "package.json")
    if os.path.exists(package_json_path):
        try:
            with open(package_json_path, "r", encoding="utf-8") as f:
                pkg_data = json.load(f)
            pkg_data["version"] = nueva_version
            with open(package_json_path, "w", encoding="utf-8", newline="\n") as f:
                json.dump(pkg_data, f, indent=2)
                f.write("\n")
            print(f"  [OK] package.json -> {nueva_version}")
        except Exception as e:
            print(f"  [ERROR] Fallo al actualizar package.json: {e}")

    # 2. package-lock.json
    lock_json_path = os.path.join(proyecto_dir, "package-lock.json")
    if os.path.exists(lock_json_path):
        try:
            with open(lock_json_path, "r", encoding="utf-8") as f:
                lock_data = json.load(f)
            lock_data["version"] = nueva_version
            if "packages" in lock_data and "" in lock_data["packages"]:
                lock_data["packages"][""]["version"] = nueva_version
            with open(lock_json_path, "w", encoding="utf-8", newline="\n") as f:
                json.dump(lock_data, f, indent=2)
                f.write("\n")
            print(f"  [OK] package-lock.json -> {nueva_version}")
        except Exception as e:
            print(f"  [WARN] Fallo al actualizar package-lock.json: {e}")

    # 3. src/config/version.ts
    version_ts_path = os.path.join(proyecto_dir, "src", "config", "version.ts")
    if os.path.exists(version_ts_path):
        try:
            with open(version_ts_path, "r", encoding="utf-8") as f:
                content = f.read()
            new_content = re.sub(
                r"export const APP_VERSION = ['\"].*?['\"];",
                f"export const APP_VERSION = '{nueva_version}';",
                content
            )
            with open(version_ts_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(new_content)
            print(f"  [OK] src/config/version.ts -> {nueva_version}")
        except Exception as e:
            print(f"  [ERROR] Fallo al actualizar src/config/version.ts: {e}")

    # 4. launcher/HexDraftSetup.iss
    iss_normal = os.path.join(proyecto_dir, "launcher", "HexDraftSetup.iss")
    actualizar_archivo_iss(iss_normal, nueva_version, es_admin=False)

    # 5. launcher/HexDraftSetupAdmin.iss
    iss_admin = os.path.join(proyecto_dir, "launcher", "HexDraftSetupAdmin.iss")
    actualizar_archivo_iss(iss_admin, nueva_version, es_admin=True)

    print(f"[OK] Sincronizacion de version {nueva_version} finalizada.\n")
    return True

def limpiar_instaladores_locales_antiguos(version_actual, proyecto_dir=None):
    """Elimina todos los instaladores en dist-installer que pertenezcan a versiones anteriores."""
    if not proyecto_dir:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        proyecto_dir = os.path.dirname(script_dir) if os.path.basename(script_dir) == "launcher" else script_dir

    dist_dir = os.path.join(proyecto_dir, "dist-installer")
    if not os.path.exists(dist_dir):
        return []

    eliminados = []
    for file in os.listdir(dist_dir):
        if file.endswith(".exe") and "Setup" in file:
            match = re.search(r"(\d+\.\d+\.\d+)", file)
            if match:
                ver_archivo = match.group(1)
                if parse_version(ver_archivo) < parse_version(version_actual):
                    filepath = os.path.join(dist_dir, file)
                    try:
                        os.remove(filepath)
                        eliminados.append(file)
                        print(f"  [DELETE LOCAL] Eliminado instalador antiguo: {file}")
                    except Exception as e:
                        print(f"  [WARN] No se pudo eliminar {file}: {e}")
    return eliminados
