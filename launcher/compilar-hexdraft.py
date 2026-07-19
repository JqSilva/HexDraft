import os
import subprocess
import sys
import importlib.util
import shutil
import re

# --- CONFIGURACIÓN ---
# Nos aseguramos de estar en la raíz del proyecto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROYECTO_DIR = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) == "launcher" else SCRIPT_DIR
os.chdir(PROYECTO_DIR)

NOMBRE_SCRIPT = os.path.join("launcher", "automatizador-hexdraft.py")
NOMBRE_EXE = "HexDraft"
DEPENDENCIAS_PY = ["pyinstaller"]
CARPETA_BUILD_NODE = "dist" 

def preparar_entorno_node():
    """Verifica si Node está listo y compila de forma segura."""
    print("\n>>> Verificando entorno Node.js...")
    
    if not shutil.which("npm"):
        print("[ERROR] npm no está instalado. Instala Node.js antes de continuar.")
        return False

    # 1. Verificar node_modules y package-lock.json
    if not os.path.exists("node_modules"):
        if os.path.exists("package-lock.json"):
            print("[WARN] node_modules no encontrado. Ejecutando 'npm ci' (instalación segura)...")
            try:
                subprocess.run(["npm", "ci"], shell=True, check=True)
            except subprocess.CalledProcessError:
                print("[ERROR] 'npm ci' falló. Asegúrate de que package-lock.json sea válido.")
                return False
        else:
            print("[WARN] No se encontró package-lock.json. Usando 'npm install' como respaldo...")
            subprocess.run(["npm", "install"], shell=True, check=True)

    # 3. Limpiar y compilar el proyecto Astro para asegurar que empaquetamos los cambios más recientes
    print("Limpiando compilación anterior y compilando proyecto Astro...")
    if os.path.exists(CARPETA_BUILD_NODE):
        try:
            shutil.rmtree(CARPETA_BUILD_NODE)
        except Exception as e:
            print(f"[WARN] No se pudo eliminar la carpeta temporal {CARPETA_BUILD_NODE}: {e}")

    try:
        subprocess.run(["npm", "run", "build"], shell=True, check=True)
        print("[OK] Build de Node finalizado.")
    except subprocess.CalledProcessError:
        print("[ERROR] al ejecutar npm run build.")
        return False
    return True


def verificar_dependencias_python():
    print("\n>>> Verificando dependencias de Python...")
    
    # Detectar si estamos dentro de un entorno virtual (.venv)
    en_entorno_virtual = (
        sys.prefix != sys.base_prefix 
        or "VIRTUAL_ENV" in os.environ
    )
    
    # Detectamos si 'uv' está disponible
    usa_uv = shutil.which("uv") is not None
    if usa_uv:
        print("[INFO] Se detectó 'uv'. Se usará para la gestión de paquetes.")

    for dep in DEPENDENCIAS_PY:
        # CORRECCIÓN: PyInstaller se registra en Python como "PyInstaller" (con mayúsculas)
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

def build_python():
    temp_dist_dir = os.path.abspath("build/pyinstaller_temp")
    release_dir = os.path.abspath("release/HexDraft")
    os.makedirs(release_dir, exist_ok=True)
    icon_path = os.path.join("public", "app-icon.ico")
    
    # 1. COMPILAR LAUNCHER EN SEGUNDO PLANO (HexDraft.exe)
    print(f"\n>>> Generando ejecutable HexDraft (Segundo Plano) en modo carpeta (onedir)...")
    script_bg = os.path.join("launcher", "automatizador-hexdraft.py")
    command_bg = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole", "--onedir",
        "--name=HexDraft",
        f"--distpath={temp_dist_dir}",
        f"--icon={icon_path}" if os.path.exists(icon_path) else "",
        "--clean", "--noconfirm",
        script_bg
    ]
    command_bg = [c for c in command_bg if c]

    try:
        subprocess.run(command_bg, check=True)
        print(f"[OK] PyInstaller finalizado para HexDraft.exe.")
        
        # Mover HexDraft.exe
        shutil.copy2(
            os.path.join(temp_dist_dir, "HexDraft", "HexDraft.exe"),
            os.path.join(release_dir, "HexDraft.exe")
        )
        
        # Mover carpeta _internal
        internal_src = os.path.join(temp_dist_dir, "HexDraft", "_internal")
        internal_dest = os.path.join(release_dir, "_internal")
        if os.path.exists(internal_dest):
            shutil.rmtree(internal_dest)
        shutil.copytree(internal_src, internal_dest)
        print("[OK] Copiado HexDraft.exe y _internal a release.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] en PyInstaller para HexDraft: {e}")
        return

    # 2. COMPILAR LAUNCHER DIRECTO (HexDraftApp.exe)
    print(f"\n>>> Generando ejecutable HexDraftApp (Directo) en modo carpeta (onedir)...")
    script_dir = os.path.join("launcher", "app-hexdraft.py")
    command_dir = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole", "--onedir",
        "--name=HexDraftApp",
        f"--distpath={temp_dist_dir}",
        f"--icon={icon_path}" if os.path.exists(icon_path) else "",
        "--clean", "--noconfirm",
        script_dir
    ]
    command_dir = [c for c in command_dir if c]

    try:
        subprocess.run(command_dir, check=True)
        print(f"[OK] PyInstaller finalizado para HexDraftApp.exe.")
        
        # Mover HexDraftApp.exe
        shutil.copy2(
            os.path.join(temp_dist_dir, "HexDraftApp", "HexDraftApp.exe"),
            os.path.join(release_dir, "HexDraftApp.exe")
        )
        
        # Fusionar cualquier dependencia nueva en _internal
        internal_app_src = os.path.join(temp_dist_dir, "HexDraftApp", "_internal")
        if os.path.exists(internal_app_src):
            print("Fusionando carpetas _internal para soportar ambos ejecutables...")
            for item in os.listdir(internal_app_src):
                s = os.path.join(internal_app_src, item)
                d = os.path.join(internal_dest, item)
                if os.path.isdir(s):
                    if not os.path.exists(d):
                        shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
        
        print("[OK] Copiado HexDraftApp.exe y fusionado _internal a release.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] en PyInstaller para HexDraftApp: {e}")
        return

    # 3. Limpiar carpeta temporal de compilación
    try:
        shutil.rmtree(temp_dist_dir)
    except Exception as e:
        print(f"[WARN] No se pudo limpiar la carpeta temporal {temp_dist_dir}: {e}")
        
    # 4. Copiar todos los recursos requeridos para el lanzamiento
    copiar_recursos_release(release_dir)
    print(f"\n[OK] Carpeta de lanzamiento lista en: {release_dir}")

def copiar_recursos_release(release_dir):
    print("\n>>> Preparando y copiando recursos adicionales a la carpeta de lanzamiento...")
    
    # 1. Copiar node.exe
    if os.path.exists("node.exe"):
        print("Copiando node.exe portable...")
        shutil.copy2("node.exe", os.path.join(release_dir, "node.exe"))
    else:
        print("[WARN] node.exe portable no encontrado en la raíz.")

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

    # 4. Copiar archivos de public/ (solo los iconos activos para producción)
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
            print(f"  [WARN] No se encontró {src_path}")

    # 5. Copiar Detener-HexDraft.bat
    bat_path = os.path.join("launcher", "Detener-HexDraft.bat")
    if os.path.exists(bat_path):
        print("Copiando Detener-HexDraft.bat...")
        shutil.copy2(bat_path, os.path.join(release_dir, "Detener-HexDraft.bat"))


def obtener_version_actual():
    """Intenta extraer la versión configurada actualmente en HexDraftSetup.iss."""
    iss_path = os.path.join("launcher", "HexDraftSetup.iss")
    if os.path.exists(iss_path):
        try:
            with open(iss_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("AppVersion="):
                        return line.split("=")[1].strip()
        except Exception:
            pass
    return "2.1.0"


def actualizar_archivo_iss(ruta_iss, nueva_version, es_admin=False):
    """Actualiza la versión y el nombre del ejecutable de salida en un archivo .iss."""
    if not os.path.exists(ruta_iss):
        print(f"[ERROR] No se encuentra el archivo: {ruta_iss}")
        return False
    
    print(f"Actualizando {ruta_iss} a la versión {nueva_version}...")
    try:
        with open(ruta_iss, "r", encoding="utf-8") as f:
            contenido = f.read()

        # Reemplazar directivas de versión
        contenido = re.sub(r"^(AppVersion=).*$", f"\\g<1>{nueva_version}", contenido, flags=re.MULTILINE)
        
        # Reemplazar AppVerName
        if es_admin:
            contenido = re.sub(r"^(AppVerName=).*$", f"\\g<1>HexDraft {nueva_version} (Admin)", contenido, flags=re.MULTILINE)
            contenido = re.sub(r"^(OutputBaseFilename=).*$", f"\\g<1>HexDraft-Setup-Admin-{nueva_version}", contenido, flags=re.MULTILINE)
        else:
            contenido = re.sub(r"^(AppVerName=).*$", f"\\g<1>HexDraft {nueva_version}", contenido, flags=re.MULTILINE)
            contenido = re.sub(r"^(OutputBaseFilename=).*$", f"\\g<1>HexDraft-Setup-{nueva_version}", contenido, flags=re.MULTILINE)
            
        contenido = re.sub(r"^(VersionInfoVersion=).*$", f"\\g<1>{nueva_version}", contenido, flags=re.MULTILINE)

        with open(ruta_iss, "w", encoding="utf-8", newline="\r\n") as f:
            f.write(contenido)
        return True
    except Exception as e:
        print(f"[ERROR] No se pudo escribir en {ruta_iss}: {e}")
        return False


def buscar_iscc():
    """Busca el ejecutable de Inno Setup (ISCC.exe)."""
    # 1. Intentar en el PATH
    iscc_path = shutil.which("iscc") or shutil.which("ISCC.exe")
    if iscc_path:
        return iscc_path
        
    # 2. Rutas comunes en Windows
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
        print("[ERROR] No se encontró el compilador de Inno Setup (ISCC.exe).")
        print("Por favor, asegúrate de tener Inno Setup instalado o agrega su ruta al PATH.")
        return False
        
    print(f"\n>>> Compilando instalador para {os.path.basename(ruta_iss)}...")
    try:
        result = subprocess.run([iscc, ruta_iss], check=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] La compilación con Inno Setup falló: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Ocurrió un error al ejecutar ISCC: {e}")
        return False


def obtener_configuracion_instaladores():
    """Pregunta los datos de configuración al inicio del script."""
    print("\n=============================================")
    print("      CONFIGURACIÓN DE INSTALADORES INNO      ")
    print("=============================================")
    
    version_sugerida = obtener_version_actual()
    version_input = input(f"Ingresa la versión para los instaladores [{version_sugerida}]: ").strip()
    nueva_version = version_input if version_input else version_sugerida
    
    print("\nSelecciona qué instalador deseas compilar al finalizar el build:")
    print("1) Solo instalador Normal")
    print("2) Solo instalador Administrador (Admin)")
    print("3) Ambos instaladores (Normal y Admin)")
    print("4) Ninguno / Omitir creación de instaladores")
    
    opcion = input("Elige una opción [1-4]: ").strip()
    
    if opcion not in ["1", "2", "3"]:
        return None, None
        
    compilar_normal = opcion in ["1", "3"]
    compilar_admin = opcion in ["2", "3"]
    
    # Comprobar la existencia del compilador de inmediato para avisar al usuario
    iscc_exe = buscar_iscc()
    if not iscc_exe:
        print("\n[ADVERTENCIA] No se encontró 'ISCC.exe' en las rutas por defecto ni en el PATH.")
        print("Los archivos .iss serán actualizados con la nueva versión, pero no se generará el ejecutable final.")
        confirmar = input("¿Deseas continuar de todas formas y actualizar los archivos .iss? (s/n): ").strip().lower()
        if confirmar != 's':
            return None, None
            
    return nueva_version, (compilar_normal, compilar_admin)


def procesar_instaladores_inno(nueva_version, opciones):
    """Genera los instaladores según las opciones configuradas al inicio."""
    if not nueva_version or not opciones:
        return

    compilar_normal, compilar_admin = opciones
    iscc_exe = buscar_iscc()
    
    print("\n=============================================")
    print("       GENERANDO INSTALADORES INNO SETUP     ")
    print("=============================================")
    
    # 1. Actualizar e Iniciar compilación
    if compilar_normal:
        iss_normal = os.path.join("launcher", "HexDraftSetup.iss")
        if actualizar_archivo_iss(iss_normal, nueva_version, es_admin=False):
            if iscc_exe:
                ejecutar_iscc(iss_normal)
                
    if compilar_admin:
        iss_admin = os.path.join("launcher", "HexDraftSetupAdmin.iss")
        if actualizar_archivo_iss(iss_admin, nueva_version, es_admin=True):
            if iscc_exe:
                ejecutar_iscc(iss_admin)

    print("\n>>> Proceso de instaladores finalizado.")


if __name__ == "__main__":
    # 1. Asegurar dependencias de Python para que este script corra
    verificar_dependencias_python()
    
    # 2. Configurar la versión e instaladores a generar de forma interactiva AL INICIO
    nueva_version, opciones_instaladores = obtener_configuracion_instaladores()
    
    # 3. Asegurar que el proyecto Node esté compilado
    if preparar_entorno_node():
        # 4. Compilar el script de Python a EXE
        if os.path.exists(NOMBRE_SCRIPT):
            build_python()
            # 5. Generar los instaladores al final de forma automatizada (sin interrupción)
            if opciones_instaladores:
                procesar_instaladores_inno(nueva_version, opciones_instaladores)
        else:
            print(f"[ERROR] No se encuentra {NOMBRE_SCRIPT}.")