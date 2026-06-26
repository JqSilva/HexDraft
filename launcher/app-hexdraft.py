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
MUTEX_NAME = "Global\\HexDraft_App_Direct_Mutex_928F6DFD"

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

LOCAL_APP_DATA = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
LOG_DIR = os.path.join(LOCAL_APP_DATA, "HexDraft")
LOG_FILE = os.path.join(LOG_DIR, "hexdraft-app.log")

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
    """Garantiza que solo corra una instancia de esta versión directa a la vez."""
    global _mutex_holder
    try:
        _mutex_holder = ctypes.windll.kernel32.CreateMutexW(None, True, MUTEX_NAME)
        err = ctypes.windll.kernel32.GetLastError()
        if err == 183:  # ERROR_ALREADY_EXISTS
            return False
    except Exception as e:
        write_log(f"Error al adquirir mutex: {e}")
    return True

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

def is_window_active_by_title_pattern(title_pattern):
    """Busca ventanas cuyos títulos coinciden con el patrón regex indicado usando APIs nativas de Windows."""
    found = [False]
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
        
        WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        
        user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
        user32.EnumWindows.restype = wintypes.BOOL

        compiled_regex = re.compile(title_pattern)
        
        def enum_windows_callback(hwnd, lparam):
            try:
                # Filtrar ventanas del Explorador de Windows
                class_buffer = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, class_buffer, 256)
                if class_buffer.value in ["CabinetWClass", "ExploreWClass"]:
                    return True

                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buffer = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buffer, length + 1)
                    if compiled_regex.match(buffer.value):
                        found[0] = True
                        return False  # Detener enumeración al encontrar
            except Exception as e:
                pass
            return True
            
        # Mantener una referencia local al callback para evitar que sea recolectado por el GC durante la llamada
        callback_ref = WNDENUMPROC(enum_windows_callback)
        user32.EnumWindows(callback_ref, 0)
    except Exception as e:
        write_log(f"Error en is_window_active_by_title_pattern: {e}")
    return found[0]

node_process = None

def start_services(node_path):
    global node_process
    try:
        node_log_file = os.path.join(LOG_DIR, "node_app_error.log")
        write_log(f"Iniciando servicios en modo directo... Node path: {node_path}")
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
        write_log(f"Proceso Node directo iniciado con PID {node_process.pid}")
        time.sleep(4)  # Esperar a que el servidor web local esté listo
        
        # Levantar la ventana del navegador en modo app
        cmd = get_browser_command(APP_URL)
        if cmd:
            write_log(f"Abriendo navegador en modo app: {cmd}")
            subprocess.Popen(cmd)
        else:
            write_log("Abriendo navegador con fallback (webbrowser)")
    except Exception as e:
        write_log(f"Error crítico al iniciar servicios directos: {e}")

def stop_services():
    global node_process
    try:
        if node_process:
            write_log(f"Terminando proceso Node directo (PID: {node_process.pid})...")
            node_process.terminate()
            node_process.wait(timeout=3)
            write_log("Proceso Node terminado correctamente.")
    except Exception as e:
        write_log(f"Error deteniendo Node de forma ordenada: {e}")
        if node_process:
            try:
                write_log("Forzando cierre (kill) de Node directo...")
                node_process.kill()
            except Exception as e_kill:
                write_log(f"Error al forzar cierre de Node: {e_kill}")
    node_process = None

def main():
    write_log("=== MONITOR MODO APP DIRECTO INICIADO ===")
    write_log(f"Directorio del proyecto: {PROYECTO_DIR}")
    
    # Si la ventana ya está activa (por ejemplo, abierta por el monitor en segundo plano), salimos
    pattern = r"^(HexDraft|HexDraft \| .*)$"
    if is_window_active_by_title_pattern(pattern):
        write_log("La ventana de HexDraft ya está activa. No es necesario abrir otra instancia. Saliendo.")
        sys.exit(0)

    if not acquire_mutex():
        write_log("Mutex ya en uso. Otra instancia de HexDraftApp ya se está ejecutando. Saliendo.")
        sys.exit(0)

    node_path = os.path.join(PROYECTO_DIR, "bin", "node.exe")
    if not os.path.exists(node_path):
        node_path = os.path.join(PROYECTO_DIR, "node.exe")
    if not os.path.exists(node_path):
        node_path = "node"

    write_log(f"Ruta de Node resuelta: {node_path}")

    # Arrancar servicios de inmediato
    start_services(node_path)

    # Esperar hasta que el usuario cierre el navegador de HexDraft
    time.sleep(5)  # Tiempo de gracia para permitir que se dibuje la ventana

    while True:
        try:
            # Comprobar si el proceso de node murió
            if node_process and node_process.poll() is not None:
                write_log("El proceso de Node se cerró inesperadamente. Saliendo.")
                break

            # Comprobar si el navegador se cerró
            if not is_window_active_by_title_pattern(pattern):
                write_log("Ventana de HexDraft no detectada activa. Deteniendo servicios...")
                break

            time.sleep(2)
        except KeyboardInterrupt:
            write_log("Interrupción de teclado detectada.")
            break
        except Exception as e:
            write_log(f"Error en bucle de monitoreo: {e}")
            time.sleep(5)

    stop_services()
    write_log("=== MONITOR MODO APP DIRECTO FINALIZADO ===")

if __name__ == "__main__":
    main()
