import os
import sys
import subprocess
import time
import webbrowser
import ctypes

# === CONFIGURACIÓN ===
APP_URL = "http://localhost:4321/draft"
MUTEX_NAME = "Global\\HexDraft_App_Mutex_928F6DFD"

# Resolver directorio de ejecución
if getattr(sys, 'frozen', False):
    exe_dir = os.path.dirname(sys.executable)
    if not os.path.exists(os.path.join(exe_dir, "dist")) and os.path.exists(os.path.join(os.path.dirname(exe_dir), "dist")):
        PROYECTO_DIR = os.path.dirname(exe_dir)
    else:
        PROYECTO_DIR = exe_dir
else:
    PROYECTO_DIR = os.path.dirname(os.path.abspath(__file__))
    if os.path.basename(PROYECTO_DIR) == "launcher":
        PROYECTO_DIR = os.path.dirname(PROYECTO_DIR)

# Mantener la referencia global del mutex para evitar que el recolector de basura lo libere
_mutex_holder = None

def acquire_mutex():
    """Intenta crear un named mutex para garantizar instancia única."""
    global _mutex_holder
    try:
        # CreateMutexW de la API de Windows
        _mutex_holder = ctypes.windll.kernel32.CreateMutexW(None, True, MUTEX_NAME)
        err = ctypes.windll.kernel32.GetLastError()
        if err == 183:  # ERROR_ALREADY_EXISTS
            return False
    except Exception:
        # Failsafe si ocurre un problema al invocar la API
        pass
    return True

def main():
    # 1. Verificar si ya hay otra instancia activa
    if not acquire_mutex():
        print("==================================================")
        print("⚠️  ADVERTENCIA: HexDraft ya se está ejecutando.")
        print("   Solo se permite una instancia activa a la vez.")
        print("==================================================")
        time.sleep(3)
        sys.exit(0)

    print("==================================================")
    print("                LAUNCHER HEXDRAFT                 ")
    print("==================================================")
    print(f"[*] Carpeta de trabajo: {PROYECTO_DIR}")
    
    # 2. Localizar node.exe portable o de sistema
    node_path = os.path.join(PROYECTO_DIR, "bin", "node.exe")
    if not os.path.exists(node_path):
        node_path = os.path.join(PROYECTO_DIR, "node.exe")
    if not os.path.exists(node_path):
        node_path = "node"
        
    print(f"[*] Iniciando servidor local con: {node_path}")
    
    # 3. Lanzar servidor Astro en la misma sesión de consola
    try:
        node_process = subprocess.Popen(
            [node_path, "--experimental-sqlite", "dist/server/entry.mjs"],
            cwd=PROYECTO_DIR
        )
    except Exception as e:
        print(f"\n[ERROR] No se pudo iniciar el servidor backend: {e}")
        print("Asegúrate de que node.exe se encuentra en el directorio.")
        input("\nPresiona ENTER para salir...")
        sys.exit(1)
        
    print("[*] Levantando el servidor local...")
    time.sleep(3)
    
    # 4. Abrir la interfaz en el navegador por defecto
    print(f"[*] Abriendo aplicación en el navegador: {APP_URL}")
    webbrowser.open(APP_URL)
    
    print("\n==================================================")
    print("          ¡HEXDRAFT SE ESTÁ EJECUTANDO!           ")
    print("==================================================")
    print(" -> El servidor local está activo en segundo plano.")
    print(" -> Puedes minimizar esta ventana mientras juegas.")
    print(" -> Para cerrar la aplicación, CIERRA esta ventana.")
    print("==================================================\n")
    
    try:
        # Esperar a que el proceso termine (o que el usuario cierre la consola)
        node_process.wait()
    except KeyboardInterrupt:
        print("\n[*] Deteniendo servicios de forma ordenada...")
        node_process.terminate()
        try:
            node_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            node_process.kill()

if __name__ == "__main__":
    main()