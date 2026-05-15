import os
import subprocess
import sys
import importlib.util

# --- CONFIGURACIÓN ---
NOMBRE_SCRIPT = "automatizador-hexdraft.py"
NOMBRE_EXE = "HexDraftGuard"
DEPENDENCIAS = ["psutil", "pygetwindow", "pyinstaller"]

def verificar_dependencias():
    print(">>> Verificando dependencias...")
    for dep in DEPENDENCIAS:
        spec = importlib.util.find_spec(dep)
        if spec is None:
            print(f"⚠️  Instalando {dep}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", dep])
        else:
            print(f"✅ {dep} detectado.")

def build():
    print(f"\n>>> Generando ejecutable único: {NOMBRE_EXE}.exe")
    
    # --onefile crea un solo archivo en /dist (más limpio para producción)
    # --noconsole evita que se abra la ventana negra de CMD al iniciar
    command = [
        "pyinstaller",
        "--noconsole",
        "--onefile",
        f"--name={NOMBRE_EXE}",
        "--clean",
        "--noconfirm",
        NOMBRE_SCRIPT
    ]

    try:
        subprocess.run(command, check=True)
        print("\n✅ Compilación exitosa.")
        
        # Ruta al EXE único
        exe_path = os.path.abspath(os.path.join("dist", f"{NOMBRE_EXE}.exe"))
        
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