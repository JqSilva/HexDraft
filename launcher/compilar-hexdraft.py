import os
import subprocess
import sys
import importlib.util
import shutil
import re
import urllib.request
import zipfile
import json
import time
import argparse

# --- CONFIGURACIÓN ---
# Nos aseguramos de estar en la raíz del proyecto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROYECTO_DIR = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) == "launcher" else SCRIPT_DIR
os.chdir(PROYECTO_DIR)

try:
    from .version_manager import (
        obtener_version_actual,
        sincronizar_version_proyecto,
        actualizar_archivo_iss,
        limpiar_instaladores_locales_antiguos,
        parse_version
    )
    from .publish_installer import (
        subir_instaladores_a_github,
        eliminar_releases_antiguas,
        list_local_installers
    )
except ImportError:
    from version_manager import (
        obtener_version_actual,
        sincronizar_version_proyecto,
        actualizar_archivo_iss,
        limpiar_instaladores_locales_antiguos,
        parse_version
    )
    from publish_installer import (
        subir_instaladores_a_github,
        eliminar_releases_antiguas,
        list_local_installers
    )

NOMBRE_SCRIPT = os.path.join("launcher", "automatizador-hexdraft.py")
NOMBRE_EXE = "HexDraft"
DEPENDENCIAS_PY = []
CARPETA_BUILD_NODE = "dist" 

def preparar_entorno_node():
    """Verifica si Node esta listo y compila de forma segura."""
    print("\n>>> Verificando entorno Node.js y compilando frontend Astro...")
    
    if not shutil.which("npm"):
        print("[ERROR] npm no esta instalado. Instala Node.js antes de continuar.")
        return False

    # 1. Verificar node_modules y package-lock.json
    if not os.path.exists("node_modules"):
        if os.path.exists("package-lock.json"):
            print("[WARN] node_modules no encontrado. Ejecutando 'npm ci' (instalacion segura)...")
            try:
                subprocess.run(["npm", "ci"], shell=True, check=True)
            except subprocess.CalledProcessError:
                print("[ERROR] 'npm ci' fallo. Asegurate de que package-lock.json sea valido.")
                return False
        else:
            print("[WARN] No se encontro package-lock.json. Usando 'npm install' como respaldo...")
            subprocess.run(["npm", "install"], shell=True, check=True)

    # 2. Limpiar y compilar el proyecto Astro
    if os.path.exists(CARPETA_BUILD_NODE):
        try:
            shutil.rmtree(CARPETA_BUILD_NODE)
        except Exception as e:
            print(f"[WARN] No se pudo eliminar la carpeta temporal {CARPETA_BUILD_NODE}: {e}")

    try:
        subprocess.run(["npm", "run", "build"], shell=True, check=True)
        print("[OK] Build de Node finalizado.")
    except subprocess.CalledProcessError:
        if os.path.exists(CARPETA_BUILD_NODE) and len(os.listdir(CARPETA_BUILD_NODE)) > 0:
            print("[WARN] 'npm run build' reporto advertencias, pero la carpeta 'dist' se genero con exito. Continuando...")
        else:
            print("[ERROR] al ejecutar npm run build y no se encontro la carpeta 'dist'.")
            return False
    return True

def verificar_dependencias_python():
    print("\n>>> Verificando dependencias de Python...")
    
    en_entorno_virtual = (
        sys.prefix != sys.base_prefix 
        or "VIRTUAL_ENV" in os.environ
    )
    
    usa_uv = shutil.which("uv") is not None
    if usa_uv:
        print("[INFO] Se detecto 'uv'. Se usara para la gestion de paquetes.")

    for dep in DEPENDENCIAS_PY:
        nombre_modulo = "PyInstaller" if dep.lower() == "pyinstaller" else dep
        spec = importlib.util.find_spec(nombre_modulo)
        
        if spec is None:
            print(f"[WARN] {dep} no detectado. Instalando...")
            
            if usa_uv:
                if en_entorno_virtual:
                    comando = ["uv", "pip", "install", dep]
                else:
                    comando = ["uv", "pip", "install", "--system", dep]
            else:
                comando = [sys.executable, "-m", "pip", "install", dep]
                if sys.version_info >= (3, 11) and not en_entorno_virtual:
                    comando.append("--break-system-packages")
            
            try:
                subprocess.check_call(comando)
                print(f"[OK] {dep} instalado correctamente.")
            except subprocess.CalledProcessError as e:
                print(f"[ERROR] No se pudo instalar la dependencia {dep}: {e}")
                sys.exit(1)
        else:
            print(f"[OK] {dep} detectada.")

def descargar_python_embed(destino_zip):
    url = "https://www.python.org/ftp/python/3.12.1/python-3.12.1-embed-amd64.zip"
    print(f"\n>>> Descargando Python Embebido desde {url}...")
    os.makedirs(os.path.dirname(destino_zip), exist_ok=True)
    try:
        def reporthook(count, block_size, total_size):
            if total_size > 0:
                percent = int(count * block_size * 100 / total_size)
                percent = min(100, percent)
                sys.stdout.write(f"\rProgreso: {percent}%")
                sys.stdout.flush()
        
        urllib.request.urlretrieve(url, destino_zip, reporthook)
        print("\n[OK] Descarga completa.")
        return True
    except Exception as e:
        print(f"\n[ERROR] No se pudo descargar Python Embebido: {e}")
        return False

def build_python():
    release_dir = os.path.abspath("release/HexDraft")
    os.makedirs(release_dir, exist_ok=True)
    
    # Eliminar ejecutables antiguos de PyInstaller para evitar bloqueos
    for exe_name in ["HexDraft.exe", "HexDraftApp.exe"]:
        exe_path = os.path.join(release_dir, exe_name)
        if os.path.exists(exe_path):
            try:
                os.remove(exe_path)
                print(f"Eliminado ejecutable antiguo de PyInstaller: {exe_name}")
            except Exception as e:
                print(f"[WARN] No se pudo eliminar el ejecutable antiguo {exe_name}: {e}")
                
    internal_dir = os.path.join(release_dir, "_internal")
    if os.path.exists(internal_dir):
        try:
            shutil.rmtree(internal_dir)
            print("Eliminada carpeta antiguo _internal de PyInstaller")
        except Exception as e:
            print(f"[WARN] No se pudo eliminar la carpeta antiguo _internal: {e}")
    
    # 1. Resolver el zip embebido
    cache_dir = os.path.abspath("build")
    zip_path = os.path.join(cache_dir, "python-embed.zip")
    
    if not os.path.exists(zip_path):
        if not descargar_python_embed(zip_path):
            print("[ERROR] Error critico al obtener Python Embebido.")
            return

    # 2. Descomprimir Python Embebido en release/HexDraft/python
    python_dest = os.path.join(release_dir, "python")
    if os.path.exists(python_dest):
        shutil.rmtree(python_dest)
    os.makedirs(python_dest, exist_ok=True)
    
    print(f"Extrayendo Python Embebido en: {python_dest}...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(python_dest)
        print("[OK] Python Embebido extraido.")
    except Exception as e:
        print(f"[ERROR] No se pudo extraer Python Embebido: {e}")
        return

    # 3. Copiar scripts de Python a release/HexDraft/launcher
    launcher_dest = os.path.join(release_dir, "launcher")
    os.makedirs(launcher_dest, exist_ok=True)
    
    print("Copiando scripts de Python...")
    scripts = ["automatizador-hexdraft.py", "app-hexdraft.py"]
    for script in scripts:
        src = os.path.join("launcher", script)
        dest = os.path.join(launcher_dest, script)
        shutil.copy2(src, dest)
        print(f"  Copiado: {script}")

    # 4. Copiar todos los recursos requeridos para el lanzamiento
    copiar_recursos_release(release_dir)
    print(f"\n[OK] Carpeta de lanzamiento lista en: {release_dir}")

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
            print(f"[WARN] No se pudo leer el archivo .env: {e}")
    return env_vars

def copiar_recursos_release(release_dir):
    print("\n>>> Preparando y copiando recursos adicionales a la carpeta de lanzamiento...")
    
    # 1. Copiar node.exe
    if os.path.exists("node.exe"):
        print("Copiando node.exe portable...")
        shutil.copy2("node.exe", os.path.join(release_dir, "node.exe"))
    else:
        print("[WARN] node.exe portable no encontrado en la raiz.")

    # 2. Copiar dist/
    if os.path.exists("dist"):
        print("Copiando carpeta dist (Astro server)...")
        target_dist = os.path.join(release_dir, "dist")
        if os.path.exists(target_dist):
            shutil.rmtree(target_dist)
        shutil.copytree("dist", target_dist)
    else:
        print("[ERROR] Carpeta dist no encontrada.")

    # 3. Copiar src/lib/data/ (JSON files)
    src_data_dir = os.path.join("src", "lib", "data")
    if os.path.exists(src_data_dir):
        print("Copiando archivos JSON de src/lib/data...")
        target_data = os.path.join(release_dir, "src", "lib", "data")
        os.makedirs(target_data, exist_ok=True)
        for file in os.listdir(src_data_dir):
            if file.endswith(".json"):
                shutil.copy2(os.path.join(src_data_dir, file), os.path.join(target_data, file))
    else:
        print("[WARN] Carpeta src/lib/data no encontrada.")

    # 4. Copiar archivos de public/
    print("Copiando recursos de public...")
    target_public = os.path.join(release_dir, "public")
    if os.path.exists(target_public):
        shutil.rmtree(target_public)
    os.makedirs(target_public, exist_ok=True)
    
    archivos_public = ["app-icon.ico", "app-icon.svg", "favicon.svg", "app-icon.png"]
    for archivo in archivos_public:
        src_path = os.path.join("public", archivo)
        dest_path = os.path.join(target_public, archivo)
        if os.path.exists(src_path):
            shutil.copy2(src_path, dest_path)
            print(f"  Copiado: {archivo}")
        else:
            print(f"  [WARN] No se encontro {src_path}")

    # 5. Copiar Detener-HexDraft.bat
    bat_path = os.path.join("launcher", "Detener-HexDraft.bat")
    if os.path.exists(bat_path):
        print("Copiando Detener-HexDraft.bat...")
        shutil.copy2(bat_path, os.path.join(release_dir, "Detener-HexDraft.bat"))

    # 6. Copiar y procesar configuraciones en release/HexDraft/data/
    print("Preparando archivos de configuracion (data/)...")
    release_data_dir = os.path.join(release_dir, "data")
    os.makedirs(release_data_dir, exist_ok=True)
    
    user_config_src = os.path.join("launcher", "config-user.json")
    user_config_dest = os.path.join(release_data_dir, "config-user.json")
    if os.path.exists(user_config_src):
        shutil.copy2(user_config_src, user_config_dest)
        print("  Copiado config-user.json")
        
    admin_config_src = os.path.join("launcher", "config-admin.json")
    admin_config_dest = os.path.join(release_data_dir, "config-admin.json")
    if os.path.exists(admin_config_src):
        try:
            with open(admin_config_src, "r", encoding="utf-8") as f:
                config_admin = json.load(f)
            
            env_vars = load_env(".env")
            token = env_vars.get("GITHUB_LAUNCHER_TOKEN", "")
            
            if token:
                config_admin["github_token"] = token
                print("  [OK] Token GITHUB_LAUNCHER_TOKEN inyectado en config-admin.json de release.")
            else:
                print("  [WARN] No se encontro GITHUB_LAUNCHER_TOKEN en .env.")
                
            with open(admin_config_dest, "w", encoding="utf-8") as f:
                json.dump(config_admin, f, indent=2)
            print("  Escrito config-admin.json procesado en release")
        except Exception as e:
            print(f"  [ERROR] Al procesar config-admin.json: {e}")
            shutil.copy2(admin_config_src, admin_config_dest)

def buscar_iscc():
    """Busca el ejecutable de Inno Setup (ISCC.exe)."""
    iscc_path = shutil.which("iscc") or shutil.which("ISCC.exe")
    if iscc_path:
        return iscc_path
        
    rutas_comunes = [
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
        r"C:\Program Files (x86)\Inno Setup 5\ISCC.exe",
    ]
    for r in rutas_comunes:
        if os.path.exists(r):
            return r
            
    return None

def ejecutar_iscc(ruta_iss):
    """Ejecuta el compilador de Inno Setup sobre el script indicado."""
    iscc = buscar_iscc()
    if not iscc:
        print("[ERROR] No se encontro el compilador de Inno Setup (ISCC.exe).")
        return False
        
    print(f"\n>>> Compilando instalador para {os.path.basename(ruta_iss)}...")
    for intento in range(1, 4):
        try:
            result = subprocess.run([iscc, ruta_iss], check=True)
            return result.returncode == 0
        except subprocess.CalledProcessError as e:
            print(f"[WARN] La compilacion con Inno Setup fallo (intento {intento}/3): {e}")
            if intento < 3:
                print("Reintentando en 3 segundos...")
                time.sleep(3)
            else:
                print(f"[ERROR] La compilacion fallo tras 3 intentos.")
                return False
        except Exception as e:
            print(f"[ERROR] Ocurrio un error al ejecutar ISCC: {e}")
            return False

def procesar_instaladores_inno(nueva_version, compilar_normal=True, compilar_admin=True):
    """Genera los instaladores Inno Setup seleccionados."""
    if not nueva_version or (not compilar_normal and not compilar_admin):
        return []

    iscc_exe = buscar_iscc()
    if not iscc_exe:
        print("\n[WARN] No se encontro 'ISCC.exe'. Los archivos .iss fueron actualizados pero no se compilo el .exe.")
        return []
    
    print("\n=============================================")
    print("       GENERANDO INSTALADORES INNO SETUP     ")
    print("=============================================")
    
    archivos_generados = []
    dist_dir = os.path.join(PROYECTO_DIR, "dist-installer")

    if compilar_normal:
        iss_normal = os.path.join("launcher", "HexDraftSetup.iss")
        if actualizar_archivo_iss(iss_normal, nueva_version, es_admin=False):
            if ejecutar_iscc(iss_normal):
                exe_name = f"HexDraft-Setup-{nueva_version}.exe"
                archivos_generados.append((exe_name, os.path.join(dist_dir, exe_name)))
                
    if compilar_admin:
        if compilar_normal:
            time.sleep(2)
        iss_admin = os.path.join("launcher", "HexDraftSetupAdmin.iss")
        if actualizar_archivo_iss(iss_admin, nueva_version, es_admin=True):
            if ejecutar_iscc(iss_admin):
                exe_name = f"HexDraft-Setup-Admin-{nueva_version}.exe"
                archivos_generados.append((exe_name, os.path.join(dist_dir, exe_name)))

    return archivos_generados

def main():
    parser = argparse.ArgumentParser(description="Compilador integral y orquestador de release de HexDraft.")
    parser.add_argument("--version", "-v", help="Nueva version de la aplicacion (ejemplo: 2.6.4)")
    parser.add_argument("--installer", "-i", choices=["normal", "admin", "both", "none"], default="both", help="Tipo de instalador a generar (por defecto both)")
    parser.add_argument("--publish", "-p", action="store_true", help="Publicar a GitHub Releases el instalador de usuario")
    parser.add_argument("--clean-local", action="store_true", default=True, help="Limpiar instaladores antiguos en dist-installer")
    parser.add_argument("--yes", "-y", action="store_true", help="Ejecutar flujo predeterminado sin pausas interactivas")
    args = parser.parse_args()

    # 1. Asegurar dependencias de Python
    verificar_dependencias_python()
    
    version_sugerida = obtener_version_actual(PROYECTO_DIR)

    # Si se especificaron flags completos por CLI o modo no interactivo
    if args.version and (args.yes or args.publish):
        nueva_version = args.version
        compilar_normal = args.installer in ["normal", "both"]
        compilar_admin = args.installer in ["admin", "both"]
        limpiar_locales = args.clean_local
        publicar_github = args.publish
    else:
        # Modo interactivo amigable
        print("\n=======================================================")
        print("      PIPELINE DE COMPILACION Y RELEASE - HEXDRAFT     ")
        print("=======================================================\n")
        
        version_input = input(f"Ingresa la version para HexDraft [{version_sugerida}]: ").strip()
        nueva_version = version_input if version_input else version_sugerida
        
        print("\nSelecciona el flujo que deseas ejecutar:")
        print("1) Workflow Predeterminado: Compilar Ambos (User + Admin) -> Limpiar Locales -> Publicar User en GitHub y Limpiar Releases Antiguas [Por defecto / Enter]")
        print("2) Solo compilar ambos instaladores y limpiar locales (Sin publicar a GitHub)")
        print("3) Compilacion personalizada (Elegir instalador o saltar pasos)")
        print("4) Salir")
        
        opcion = input("\nElige una opcion [1-4, por defecto 1]: ").strip()
        if not opcion:
            opcion = "1"
            
        if opcion == "1":
            compilar_normal = True
            compilar_admin = True
            publicar_github = True
            
            # Pregunta de confirmacion para eliminar versiones locales antiguas
            limp_input = input("\n¿Eliminar instaladores locales antiguos de dist-installer? (Y/n) [Y]: ").strip().lower()
            limpiar_locales = (limp_input != "n")
            
        elif opcion == "2":
            compilar_normal = True
            compilar_admin = True
            publicar_github = False
            
            limp_input = input("\n¿Eliminar instaladores locales antiguos de dist-installer? (Y/n) [Y]: ").strip().lower()
            limpiar_locales = (limp_input != "n")
            
        elif opcion == "3":
            print("\nTipo de instalador a compilar:")
            print("1) Solo instalador Normal (User)")
            print("2) Solo instalador Administrador (Admin)")
            print("3) Ambos instaladores (Normal y Admin)")
            print("4) Ninguno (Solo preparar build de Node y Python)")
            
            sel_inst = input("Elige opcion [1-4, por defecto 3]: ").strip()
            if sel_inst == "1":
                compilar_normal, compilar_admin = True, False
            elif sel_inst == "2":
                compilar_normal, compilar_admin = False, True
            elif sel_inst == "4":
                compilar_normal, compilar_admin = False, False
            else:
                compilar_normal, compilar_admin = True, True
                
            limp_input = input("\n¿Eliminar instaladores locales antiguos de dist-installer? (Y/n) [Y]: ").strip().lower()
            limpiar_locales = (limp_input != "n")
            
            pub_input = input("¿Deseas publicar el instalador de usuario a GitHub Releases al finalizar? (s/n) [n]: ").strip().lower()
            publicar_github = (pub_input == "s")
            
        else:
            print("\nOperacion cancelada.")
            return

    # 2. Sincronizar version en TODOS los archivos del proyecto antes de compilar
    if nueva_version:
        sincronizar_version_proyecto(nueva_version, PROYECTO_DIR)

    # 3. Compilacion de Node/Astro y empaquetado de Python
    if not preparar_entorno_node():
        print("[ERROR] Fallo la compilacion de Node/Astro.")
        sys.exit(1)
        
    if os.path.exists(NOMBRE_SCRIPT):
        build_python()
    else:
        print(f"[ERROR] No se encuentra {NOMBRE_SCRIPT}.")
        sys.exit(1)

    # 4. Generar instaladores Inno Setup
    archivos_generados = []
    if compilar_normal or compilar_admin:
        archivos_generados = procesar_instaladores_inno(nueva_version, compilar_normal, compilar_admin)

    # 5. Limpieza de versiones locales antiguas en dist-installer
    if limpiar_locales:
        print(f"\n>>> Limpiando instaladores locales antiguos en dist-installer (conservando version {nueva_version})...")
        eliminados = limpiar_instaladores_locales_antiguos(nueva_version, PROYECTO_DIR)
        if eliminados:
            print(f"[OK] Se eliminaron {len(eliminados)} instalador(es) local(es) antiguo(s).")
        else:
            print("[INFO] No se encontraron instaladores locales antiguos para eliminar.")

    # 6. Publicacion automatica en GitHub Releases si fue seleccionada (solo instalador de usuario)
    if publicar_github:
        print("\n=======================================================")
        print("      PUBLICACION AUTOMATICA A GITHUB RELEASES         ")
        print("=======================================================\n")
        
        # Filtramos para subir unicamente el instalador de usuario
        user_installer_path = os.path.join(PROYECTO_DIR, "dist-installer", f"HexDraft-Setup-{nueva_version}.exe")
        archivos_a_subir = None
        if os.path.exists(user_installer_path):
            archivos_a_subir = [(f"HexDraft-Setup-{nueva_version}.exe", user_installer_path)]
            
        subir_instaladores_a_github(
            version=nueva_version,
            files_to_upload=archivos_a_subir,
            solo_user=True,
            limpiar_anteriores=True
        )

    print("\n=======================================================")
    print(f"[OK] Pipeline completado con exito para HexDraft v{nueva_version}")
    print("=======================================================\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[CANCEL] Proceso cancelado por el usuario.")
        sys.exit(0)