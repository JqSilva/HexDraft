import psutil
import os
import subprocess
import time
import datetime
import pygetwindow as gw

# === CONFIGURACIÓN DE PRODUCCIÓN ===
PROYECTO_DIR = r"D:\Documentos\HexDraft"
LOL_PROCESS = "LeagueClientUx.exe"
BRAVE_PATH = r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
APP_URL = "http://localhost:4321/draft"
APP_TITLE = "HexDraft" 
LOG_FILE = os.path.join(PROYECTO_DIR, "guard_status.log")

class HexDraftGuard:
    def __init__(self):
        self.server_active = False

    def write_log(self, message):
        """Escribe logs en un archivo para debuguear en modo invisible."""
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{now}] {message}\n")
        except: pass

    def is_lol_active(self):
        for proc in psutil.process_iter(['name']):
            try:
                if proc.info['name'] == LOL_PROCESS:
                    return True
            except: continue
        return False

    def start_services(self):
        self.write_log("LoL detectado. Iniciando servicios...")
        try:
            # Iniciar Servidor Astro 
            subprocess.Popen(
                ["node", "dist/server/entry.mjs"],
                cwd=PROYECTO_DIR,
                shell=True,
                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
            )
            time.sleep(8) # Espera a que Astro levante el puerto
            
            # Abrir Interfaz en Brave (Modo App)
            subprocess.Popen([BRAVE_PATH, f"--app={APP_URL}"])
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