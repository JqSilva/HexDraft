import psutil
import os
import subprocess
import time
import datetime
import sys
import pygetwindow as gw

# === CONFIGURACIÓN DE PRODUCCIÓN ===
PROYECTO_DIR = r"D:\Documentos\HexDraft"
LOL_PROCESS = "LeagueClientUx.exe"
BRAVE_PATH = r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
APP_URL = "http://localhost:4321/draft"
APP_TITLE = "HexDraft" 


if getattr(sys, 'frozen', False):
    PROYECTO_DIR = os.path.dirname(sys.executable)
else:
    PROYECTO_DIR = os.path.dirname(os.path.abspath(__file__))

LOG_FILE = os.path.join(PROYECTO_DIR, "guard_status.log")

class HexDraftGuard:
    def __init__(self):
        self.server_active = False

    def write_log(self, message):
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            # Aseguramos que la carpeta contenedora exista
            log_dir = os.path.dirname(LOG_FILE)
            if log_dir and not os.path.exists(log_dir):
                os.makedirs(log_dir, exist_ok=True)
                
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{now}] {message}\n")
                
        except Exception as e:
            print(f"Error escribiendo log en {LOG_FILE}: {e}")

    def is_lol_active(self):
        for proc in psutil.process_iter(['name']):
            try:
                if proc.info['name'] == LOL_PROCESS:
                    return True
            except: continue
        return False

    def get_browser_command(self, url):
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
        
        # 3. Intentar Edge (soporta --app para modo ventana)
        edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        if os.path.exists(edge):
            return [edge, f"--app={url}"]
        
        # 4. Fallback al navegador predeterminado
        import webbrowser
        webbrowser.open(url)
        return None

    def start_services(self):
        self.write_log("LoL detectado. Iniciando servicios...")
        try:
            # Detectar si hay un node.exe portable en la carpeta bin/ o en la carpeta raíz
            node_path = os.path.join(PROYECTO_DIR, "bin", "node.exe")
            if not os.path.exists(node_path):
                node_path = os.path.join(PROYECTO_DIR, "node.exe")
            if not os.path.exists(node_path):
                node_path = "node" # Usar el node global del sistema
                
            self.write_log(f"Iniciando Astro Server usando: {node_path}")
            
            # Iniciar Servidor Astro 
            subprocess.Popen(
                [node_path, "dist/server/entry.mjs"],
                cwd=PROYECTO_DIR,
                shell=True,
                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
            )
            time.sleep(8) # Espera a que Astro levante el puerto
            
            # Abrir Interfaz en el navegador detectado
            cmd = self.get_browser_command(APP_URL)
            if cmd:
                subprocess.Popen(cmd)
            self.server_active = True
        except Exception as e:
            self.write_log(f"Error al iniciar: {e}")

    def stop_services(self):
        self.write_log("LoL cerrado. Limpiando entorno...")
        
       
        for v in gw.getAllWindows():
            if v.title == APP_TITLE:
                try:
                    v.close()
                    self.write_log(f"Ventana '{v.title}' cerrada.")
                except: pass

        
        for proc in psutil.process_iter(['name', 'cwd']):
            try:
                if proc.info['name'] and "node.exe" in proc.info['name'].lower():
                    if proc.info['cwd'] and os.path.normpath(proc.info['cwd']) == os.path.normpath(PROYECTO_DIR):
                        proc.kill()
                        self.write_log(f"Proceso Node (PID: {proc.pid}) eliminado.")
            except: continue
        
        self.server_active = False
        self.write_log("Monitor en espera.")

def main():
    guard = HexDraftGuard()
    guard.write_log("=== MONITOR INICIADO EN SEGUNDO PLANO ===")
    
    while True:
        try:
            lol_on = guard.is_lol_active()
            if lol_on and not guard.server_active:
                guard.start_services()
                time.sleep(30)
            elif not lol_on and guard.server_active:
                guard.stop_services()
            
            interval = 20 if not guard.server_active else 45
            time.sleep(interval)
        except Exception as e:
            guard.write_log(f"Error crítico en bucle: {e}")
            time.sleep(60)
        
        

if __name__ == "__main__":
    main()