import os
import sys
import subprocess
import time
import webbrowser
import ctypes
import json

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

_mutex_holder = None

def acquire_mutex():
    """Garantiza que solo corra una instancia del monitor a la vez."""
    global _mutex_holder
    try:
        _mutex_holder = ctypes.windll.kernel32.CreateMutexW(None, True, MUTEX_NAME)
        err = ctypes.windll.kernel32.GetLastError()
        if err == 183:  # ERROR_ALREADY_EXISTS
            return False
    except Exception:
        pass
    return True

def get_lol_path():
    """Lee la ruta configurada en el hexdraft-config.json."""
    config_path = os.path.join(PROYECTO_DIR, 'hexdraft-config.json')
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'lolPath' in data:
                    return data['lolPath']
        except Exception:
            pass
    return 'C:\\Riot Games\\League of Legends\\lockfile'

def is_lol_active():
    """Verifica si LoL está abierto comprobando si existe su lockfile."""
    lockfile_path = get_lol_path()
    return os.path.exists(lockfile_path)

node_process = None

def start_services(node_path):
    global node_process
    try:
        # Iniciar node ocultando la consola (CREATE_NO_WINDOW)
        node_process = subprocess.Popen(
            [node_path, "--experimental-sqlite", "dist/server/entry.mjs"],
            cwd=PROYECTO_DIR,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        time.sleep(5)  # Esperar a que el servidor web local esté listo
        webbrowser.open(APP_URL)
    except Exception:
        pass

def stop_services():
    global node_process
    if node_process:
        try:
            # Terminar limpiamente el proceso hijo que iniciamos
            node_process.terminate()
            node_process.wait(timeout=3)
        except Exception:
            try:
                node_process.kill()
            except Exception:
                pass
        node_process = None

def main():
    if not acquire_mutex():
        sys.exit(0)

    node_path = os.path.join(PROYECTO_DIR, "bin", "node.exe")
    if not os.path.exists(node_path):
        node_path = os.path.join(PROYECTO_DIR, "node.exe")
    if not os.path.exists(node_path):
        node_path = "node"

    server_active = False

    while True:
        try:
            lol_on = is_lol_active()
            if lol_on and not server_active:
                start_services(node_path)
                server_active = True
                # Esperar 30 segundos tras arrancar para estabilizar
                time.sleep(30)
            elif not lol_on and server_active:
                stop_services()
                server_active = False
                time.sleep(10)
            
            # Chequear cada 8 segundos si no está activo, o cada 20 si ya está activo
            interval = 8 if not server_active else 20
            time.sleep(interval)
        except Exception:
            time.sleep(20)

if __name__ == "__main__":
    main()