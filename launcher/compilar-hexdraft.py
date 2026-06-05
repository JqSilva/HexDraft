import os
import subprocess
import sys
import importlib.util
import shutil

# --- CONFIGURACIÓN ---
NOMBRE_SCRIPT = "automatizador-hexdraft.py"
NOMBRE_EXE = "HexDraftGuard"
DEPENDENCIAS_PY = ["psutil", "pygetwindow", "pyinstaller"]
# Cambia ".next" por "dist" o "build" según lo que use tu proyecto Node
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
                # Usamos npm ci para respetar el lockfile y evitar ataques de suministro
                subprocess.run(["npm", "ci"], shell=True, check=True)
            except subprocess.CalledProcessError:
                print("[ERROR] 'npm ci' falló. Asegúrate de que package-lock.json sea válido.")
                return False
        else:
            print("[WARN] No se encontró package-lock.json. Usando 'npm install' como respaldo...")
            subprocess.run(["npm", "install"], shell=True, check=True)

    # 2. Verificar si hace falta el build de Node
    if not os.path.exists(CARPETA_BUILD_NODE):
        print(f"[WARN] Carpeta {CARPETA_BUILD_NODE} no encontrada. Compilando proyecto...")
        try:
            subprocess.run(["npm", "run", "build"], shell=True, check=True)
            print("[OK] Build de Node finalizado.")
        except subprocess.CalledProcessError:
            print("[ERROR] al ejecutar npm run build.")
            return False
    else:
        print(f"[OK] Carpeta {CARPETA_BUILD_NODE} detectada.")
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
    print(f"\n>>> Generando ejecutable único {NOMBRE_EXE}...")
    output_dir = "dist-exe"
    icon_path = os.path.join("public", "favicon.ico")
    
    # Usamos sys.executable para asegurar que use el mismo python
    command = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole", "--onefile",
        f"--name={NOMBRE_EXE}",
        f"--distpath={output_dir}",
        f"--icon={icon_path}" if os.path.exists(icon_path) else "",
        "--clean", "--noconfirm",
        NOMBRE_SCRIPT
    ]
    # Limpiar filtros vacíos
    command = [c for c in command if c]

    try:
        subprocess.run(command, check=True)
        exe_path = os.path.abspath(os.path.join(output_dir, f"{NOMBRE_EXE}.exe"))
        if os.path.exists(exe_path):
            configurar_persistencia(exe_path)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] en PyInstaller: {e}")

def configurar_persistencia(path):
    task_name = "HexDraft_Guard_System"
    print(f"\n>>> Configurando inicio automático...")
    persistence_cmd = ["schtasks", "/Create", "/TN", task_name, "/TR", f'"{path}"', "/SC", "ONLOGON", "/RL", "HIGHEST", "/F"]
    result = subprocess.run(persistence_cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"[OK] EXITO: {NOMBRE_EXE} se iniciará con Windows.")
    else:
        print(f"[WARN] Ejecuta como ADMINISTRADOR para activar el inicio automático.")

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