import os
import sys
import subprocess
import time
import ctypes
import json

# === CONFIGURACIÓN ===
APP_URL = "http://localhost:4321/draft"
APP_TITLE = "HexDraft"
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
    """Lee la ruta de instalación de League of Legends configurada."""
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
    """Determina si el juego está activo mediante el archivo lockfile."""
    lockfile_path = get_lol_path()
    return os.path.exists(lockfile_path)

def get_browser_command(url):
    """Encuentra un navegador compatible y devuelve el comando para iniciarlo en modo --app."""
    # 1. Intentar Brave
    brave = r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
    if os.path.exists(brave):
        return [brave, f"--app={url}"]
    
    # 2. Intentar Chrome
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    ]
    for path in chrome_paths:
        if os.path.exists(path):
            return [path, f"--app={url}"]
    
    # 3. Intentar Edge
    edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if os.path.exists(edge):
        return [edge, f"--app={url}"]
    
    # 4. Fallback al navegador predeterminado (modo pestaña normal)
    import webbrowser
    webbrowser.open(url)
    return None

def close_window_by_title(target_title):
    """Busca ventanas con el título indicado usando APIs nativas de Windows y les envía WM_CLOSE."""
    try:
        user32 = ctypes.windll.user32
        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        
        def enum_windows_callback(hwnd, lparam):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buffer = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buffer, length + 1)
                # Si contiene el título objetivo
                if target_title in buffer.value:
                    # Enviar mensaje WM_CLOSE (0x0010)
                    user32.PostMessageW(hwnd, 0x0010, 0, 0)
            return True
            
        user32.EnumWindows(WNDENUMPROC(enum_windows_callback), 0)
    except Exception:
        pass

node_process = None

def start_services(node_path):
    global node_process
    try:
        # Iniciar node en segundo plano oculto
        node_process = subprocess.Popen(
            [node_path, "--experimental-sqlite", "dist/server/entry.mjs"],
            cwd=PROYECTO_DIR,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        time.sleep(5)  # Esperar a que el servidor web local esté listo
        
        # Levantar la ventana del navegador en modo app
        cmd = get_browser_command(APP_URL)
        if cmd:
            subprocess.Popen(cmd)
    except Exception:
        pass

def stop_services():
    global node_process
    try:
        # 1. Cerrar la ventana del navegador
        close_window_by_title(APP_TITLE)
        
        # 2. Terminar el servidor local
        if node_process:
            node_process.terminate()
            node_process.wait(timeout=3)
    except Exception:
        if node_process:
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
                time.sleep(30)
            elif not lol_on and server_active:
                stop_services()
                server_active = False
                time.sleep(10)
            
            interval = 8 if not server_active else 20
            time.sleep(interval)
        except Exception:
            time.sleep(20)

if __name__ == "__main__":
    main()