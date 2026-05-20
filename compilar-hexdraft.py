import os
import subprocess
import sys
import importlib.util
import shutil

# --- CONFIGURACIÓN ---
NOMBRE_SCRIPT = "automatizador-hexdraft.py"
NOMBRE_EXE = "HexDraftGuard"
DEPENDENCIAS = ["psutil", "pygetwindow", "pyinstaller"]

def verificar_dependencias():
    print(">>> Verificando dependencias...")
    for dep in DEPENDENCIAS:
        if dep == "pyinstaller":
            if shutil.which(dep) is None:
                 subprocess.check_call([sys.executable, "-m", "pip", "install", dep])
            else:
                print(f"✅ {dep} detectada.")
        else:
            spec = importlib.util.find_spec(dep)
            if spec is None:
                print(f"⚠️  Instalando {dep}...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", dep])
            else:
                print(f"✅ {dep} detectado.")

def build():
    print(f"\n>>> Generando ejecutable único en carpeta independiente...")
    
    # Definimos una carpeta de salida distinta para el EXE
    output_dir = "dist-exe" 
    icon_path = os.path.join("public", "favicon.ico")

    command = [
        "pyinstaller",
        "--noconsole",
        "--onefile",
        f"--name={NOMBRE_EXE}",
        f"--distpath={output_dir}", # Redirige el EXE final aquí 
        f"--icon={icon_path}",
        "--clean",
        "--noconfirm",
        NOMBRE_SCRIPT
    ]


    try:
        subprocess.run(command, check=True)
        print("\n✅ Compilación exitosa.")
        
        # Actualizamos la ruta para la persistencia
        exe_path = os.path.abspath(os.path.join(output_dir, f"{NOMBRE_EXE}.exe")) 
        
        if os.path.exists(exe_path):
            configurar_persistencia(exe_path)
        else:
            print("❌ Error: No se encontró el archivo generado.")
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Error en PyInstaller: {e}")


def configurar_persistencia(path):
    task_name = "HexDraft_Guard_System"
    print(f">>> Configurando inicio automático con Windows...")
    
    # Creamos la tarea para que inicie al loguearse el usuario
    # /RL HIGHEST permite que corra con privilegios si es necesario
    persistence_cmd = [
        "schtasks", "/Create", "/TN", task_name,
        "/TR", f'"{path}"', "/SC", "ONLOGON", "/RL", "HIGHEST", "/F"
    ]
    
    try:
        result = subprocess.run(persistence_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ ÉXITO: {NOMBRE_EXE} se iniciará automáticamente con Windows.")
        else:
            print(f"⚠️  No se pudo crear la tarea automática.")
            print(f"Detalle: {result.stderr.strip()}")
            print("👉 Ejecuta este script como ADMINISTRADOR para activar esta función.")
    except Exception as e:
        print(f"❌ Error en persistencia: {e}")

if __name__ == "__main__":
    verificar_dependencias()
    if not os.path.exists(NOMBRE_SCRIPT):
        print(f"❌ No se encuentra {NOMBRE_SCRIPT}.")
    else:
        build()