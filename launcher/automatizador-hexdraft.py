import os
import sys
import subprocess
import time
import ctypes
import json
import re
import datetime

# === CONFIGURACIÓN ===
APP_URL = "http://localhost:4321/dashboard"
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

# Resolver directorio de logs seguro (AppData/Local/HexDraft)
LOCAL_APP_DATA = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
LOG_DIR = os.path.join(LOCAL_APP_DATA, "HexDraft")
LOG_FILE = os.path.join(LOG_DIR, "hexdraft.log")

def write_log(message):
    """Escribe un mensaje de log con marca de tiempo en la ruta segura de AppData."""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{now}] {message}\n")
    except Exception:
        pass

_mutex_holder = None

def acquire_mutex():
    """Garantiza que solo corra una instancia del monitor a la vez."""
    global _mutex_holder
    try:
        _mutex_holder = ctypes.windll.kernel32.CreateMutexW(None, True, MUTEX_NAME)
        err = ctypes.windll.kernel32.GetLastError()
        if err == 183:  # ERROR_ALREADY_EXISTS
            return False
    except Exception as e:
        write_log(f"Error al adquirir mutex: {e}")
    return True

def get_lol_path():
    """Lee la ruta de instalación de League of Legends configurada o busca en rutas y unidades alternativas."""
    path_val = None
    config_path = os.path.join(PROYECTO_DIR, 'hexdraft-config.json')
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'lolPath' in data:
                    path_val = data['lolPath']
        except Exception as e:
            write_log(f"Error leyendo hexdraft-config.json: {e}")
            
    if path_val and not os.path.exists(path_val):
        path_val = None

    if not path_val:
        # Probar ruta por defecto
        default_path = 'C:\\Riot Games\\League of Legends\\lockfile'
        if os.path.exists(default_path):
            path_val = default_path
        else:
            # Buscar en otras unidades comunes
            for drive in ['D', 'E', 'F', 'G', 'H', 'B']:
                alt_path = f"{drive}:\\Riot Games\\League of Legends\\lockfile"
                if os.path.exists(alt_path):
                    write_log(f"Ruta alternativa de LoL encontrada: {alt_path}")
                    path_val = alt_path
                    break

    if not path_val:
        path_val = 'C:\\Riot Games\\League of Legends\\lockfile'

    # Normalizar para asegurar que apunte al archivo 'lockfile'
    clean_path = path_val.strip()
    if clean_path and not clean_path.lower().endswith('lockfile'):
        clean_path = os.path.join(clean_path, 'lockfile')
        
    return clean_path

def is_lol_active():
    """Determina si el juego está activo mediante el archivo lockfile."""
    lockfile_path = get_lol_path()
    return os.path.isfile(lockfile_path)

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

def close_window_by_title_pattern(title_pattern):
    """Busca ventanas cuyos títulos coinciden con el patrón regex indicado usando APIs nativas de Windows y les envía WM_CLOSE."""
    try:
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        
        # Declarar tipos explícitos para evitar crashes en sistemas de 64 bits y truncamientos de punteros
        user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        user32.GetWindowTextLengthW.restype = ctypes.c_int
        
        user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        user32.GetWindowTextW.restype = ctypes.c_int
        
        user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        user32.GetClassNameW.restype = ctypes.c_int
        
        user32.PostMessageW.argtypes = [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
        user32.PostMessageW.restype = wintypes.BOOL
        
        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        
        user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
        user32.EnumWindows.restype = wintypes.BOOL

        compiled_regex = re.compile(title_pattern)
        
        def enum_windows_callback(hwnd, lparam):
            try:
                # Filtrar ventanas del Explorador de Windows para no cerrarlas accidentalmente
                class_buffer = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, class_buffer, 256)
                if class_buffer.value in ["CabinetWClass", "ExploreWClass"]:
                    return True

                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buffer = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buffer, length + 1)
                    # Comparar usando expresión regular para tolerar títulos dinámicos
                    if compiled_regex.match(buffer.value):
                        write_log(f"Cerrando ventana encontrada: '{buffer.value}' (Clase: {class_buffer.value})")
                        # Enviar mensaje WM_CLOSE (0x0010)
                        user32.PostMessageW(hwnd, 0x0010, 0, 0)
            except Exception as e:
                write_log(f"Error en callback de EnumWindows: {e}")
            return True
            
        # Mantener una referencia local al callback para evitar que sea recolectado por el GC durante la llamada
        callback_ref = WNDENUMPROC(enum_windows_callback)
        user32.EnumWindows(callback_ref, 0)
    except Exception as e:
        write_log(f"Error en close_window_by_title_pattern: {e}")

node_process = None

def start_services(node_path):
    global node_process
    try:
        node_log_file = os.path.join(LOG_DIR, "node_error.log")
        write_log(f"Iniciando servicios... Node path: {node_path}")
        try:
            node_log = open(node_log_file, "w", encoding="utf-8")
        except Exception as e:
            write_log(f"No se pudo crear archivo de log de node: {e}")
            node_log = subprocess.DEVNULL

        # Iniciar node en segundo plano oculto
        node_process = subprocess.Popen(
            [node_path, "--experimental-sqlite", "dist/server/entry.mjs"],
            cwd=PROYECTO_DIR,
            stdout=node_log,
            stderr=node_log,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        write_log(f"Proceso Node iniciado con PID {node_process.pid}")
        time.sleep(5)  # Esperar a que el servidor web local esté listo
        
        # Levantar la ventana del navegador en modo app
        cmd = get_browser_command(APP_URL)
        if cmd:
            write_log(f"Abriendo navegador: {cmd}")
            subprocess.Popen(cmd)
        else:
            write_log("Abriendo navegador con fallback (webbrowser)")
    except Exception as e:
        write_log(f"Error crítico al iniciar servicios: {e}")

def stop_services():
    global node_process
    try:
        # 1. Cerrar la ventana del navegador (coincide con títulos exactos y dinámicos)
        pattern = r"^(HexDraft|HexDraft \| .*)$"
        write_log("Cerrando ventanas de HexDraft...")
        close_window_by_title_pattern(pattern)
        
        # 2. Terminar el servidor local
        if node_process:
            write_log(f"Terminando proceso Node (PID: {node_process.pid})...")
            node_process.terminate()
            node_process.wait(timeout=3)
            write_log("Proceso Node terminado correctamente.")
    except Exception as e:
        write_log(f"Error deteniendo servicios de Node de forma ordenada: {e}")
        if node_process:
            try:
                write_log("Forzando cierre (kill) de Node...")
                node_process.kill()
            except Exception as e_kill:
                write_log(f"Error al forzar cierre de Node: {e_kill}")
    node_process = None

def main():
    write_log("=== MONITOR INICIADO EN SEGUNDO PLANO ===")
    write_log(f"Directorio del proyecto: {PROYECTO_DIR}")
    write_log(f"Directorio de logs: {LOG_DIR}")
    
    if not acquire_mutex():
        write_log("Mutex ya en uso. Otra instancia de HexDraft se está ejecutando. Saliendo.")
        sys.exit(0)

    node_path = os.path.join(PROYECTO_DIR, "bin", "node.exe")
    if not os.path.exists(node_path):
        node_path = os.path.join(PROYECTO_DIR, "node.exe")
    if not os.path.exists(node_path):
        node_path = "node"

    write_log(f"Ruta de Node resuelta: {node_path}")
    write_log(f"Ruta de League of Legends (lockfile) configurada: {get_lol_path()}")

    server_active = False

    while True:
        try:
            lol_on = is_lol_active()
            if lol_on and not server_active:
                write_log("League of Legends detectado activo. Iniciando servicios...")
                start_services(node_path)
                server_active = True
                time.sleep(30)
            elif not lol_on and server_active:
                write_log("League of Legends ya no está activo. Deteniendo servicios...")
                stop_services()
                server_active = False
                time.sleep(10)
            
            interval = 8 if not server_active else 20
            time.sleep(interval)
        except Exception as e:
            write_log(f"Error en bucle del monitor: {e}")
            time.sleep(20)

if __name__ == "__main__":
    main()