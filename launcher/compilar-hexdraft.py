import os
import subprocess
import sys
import importlib.util
import shutil

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

    # 2. Limpiar y compilar el proyecto Astro para asegurar que empaquetamos los cambios más recientes
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
    for dep in DEPENDENCIAS_PY:
        spec = importlib.util.find_spec(dep) if dep != "pyinstaller" else shutil.which("pyinstaller")
        if spec is None:
            print(f"[WARN] Instalando {dep}...")
            comando = [sys.executable, "-m", "pip", "install", dep]
            if sys.version_info >= (3, 11):
                comando.append("--break-system-packages")
            subprocess.check_call(comando)
        else:
            print(f"[OK] {dep} detectada.")

def build_python():
    print(f"\n>>> Generando ejecutable {NOMBRE_EXE} en modo carpeta (onedir)...")
    temp_dist_dir = os.path.abspath("build/pyinstaller_temp")
    release_dir = os.path.abspath("release/HexDraft")
    os.makedirs(release_dir, exist_ok=True)
    icon_path = os.path.join("public", "favicon.ico")
    
    # Usamos sys.executable para asegurar que use el mismo python
    command = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole", "--onedir",
        f"--name={NOMBRE_EXE}",
        f"--distpath={temp_dist_dir}",
        f"--icon={icon_path}" if os.path.exists(icon_path) else "",
        "--clean", "--noconfirm",
        NOMBRE_SCRIPT
    ]
    command = [c for c in command if c]

    try:
        # Ejecutar PyInstaller en la carpeta temporal build/pyinstaller_temp/HexDraft
        subprocess.run(command, check=True)
        print(f"[OK] PyInstaller finalizado correctamente.")
        
        # Mover los archivos de PyInstaller directamente a la raíz de release/HexDraft
        pyinstaller_out = os.path.join(temp_dist_dir, NOMBRE_EXE)
        
        # 1. Copiar HexDraft.exe
        exe_src = os.path.join(pyinstaller_out, f"{NOMBRE_EXE}.exe")
        exe_dest = os.path.join(release_dir, f"{NOMBRE_EXE}.exe")
        print(f"Copiando {NOMBRE_EXE}.exe a la raíz de release...")
        shutil.copy2(exe_src, exe_dest)
        
        # 2. Copiar carpeta _internal
        internal_src = os.path.join(pyinstaller_out, "_internal")
        internal_dest = os.path.join(release_dir, "_internal")
        if os.path.exists(internal_dest):
            shutil.rmtree(internal_dest)
        print("Copiando dependencias (_internal) a la raíz de release...")
        shutil.copytree(internal_src, internal_dest)
        
        # 3. Limpiar carpeta temporal de compilación
        try:
            shutil.rmtree(temp_dist_dir)
        except Exception as e:
            print(f"[WARN] No se pudo limpiar la carpeta temporal {temp_dist_dir}: {e}")
        
        # 4. Copiar todos los recursos requeridos para el lanzamiento
        copiar_recursos_release(release_dir)
        print(f"\n[OK] Carpeta de lanzamiento lista en: {release_dir}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] en PyInstaller: {e}")

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

    # 4. Copiar public/
    if os.path.exists("public"):
        print("Copiando carpeta public...")
        target_public = os.path.join(release_dir, "public")
        if os.path.exists(target_public):
            shutil.rmtree(target_public)
        shutil.copytree("public", target_public)

    # 5. Copiar Detener-HexDraft.bat
    bat_path = os.path.join("launcher", "Detener-HexDraft.bat")
    if os.path.exists(bat_path):
        print("Copiando Detener-HexDraft.bat...")
        shutil.copy2(bat_path, os.path.join(release_dir, "Detener-HexDraft.bat"))



if __name__ == "__main__":
    # 1. Asegurar dependencias de Python para que este script corra
    verificar_dependencias_python()
    
    # 2. Asegurar que el proyecto Node esté compilado
    if preparar_entorno_node():
        # 3. Compilar el script de Python a EXE
        if os.path.exists(NOMBRE_SCRIPT):
            build_python()
        else:
            print(f"[ERROR] No se encuentra {NOMBRE_SCRIPT}.")