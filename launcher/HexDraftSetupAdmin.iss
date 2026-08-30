; Script de Inno Setup para HexDraft (Administrador)
; Este script toma todo el contenido de la carpeta "release/HexDraft" y genera el instalador final para el Administrador.

[Setup]
AppId={{928F6DFD-C3A5-470E-9023-CD2A5C1E7202}}
AppName=HexDraft Admin
AppVersion=3.0.5
AppVerName=HexDraft 3.0.5 (Admin)
VersionInfoVersion=3.0.5
AppPublisher=HexDraft
AppPublisherURL=https://github.com/JqSilva/HexDraft-Launcher
AppSupportURL=https://github.com/JqSilva/HexDraft-Launcher
AppUpdatesURL=https://github.com/JqSilva/HexDraft-Launcher/releases
DefaultDirName={autopf}\HexDraft
DisableProgramGroupPage=yes
OutputDir=..\dist-installer
OutputBaseFilename=HexDraft-Setup-Admin-3.0.5
SetupIconFile=D:\Documentos\HexDraft\public\app-icon.ico
UninstallDisplayIcon={app}\public\app-icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern dark
PrivilegesRequired=lowest
AppMutex=Global\HexDraft_App_Mutex_928F6DFD
CloseApplications=yes
SetupLogging=yes
AppComments=Herramienta de análisis de draft en tiempo real para League of Legends (Administrador)
AppContact=support@hexdraft.cl

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Iniciar HexDraft automáticamente al iniciar sesión en Windows"; GroupDescription: "Configuración de inicio:"; Flags: checkedonce

[Files]
; Copiar todos los archivos generados en el directorio de lanzamiento
Source: "..\release\HexDraft\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\release\HexDraft\data\config-admin.json"; DestDir: "{app}\data"; DestName: "config.json"; Flags: ignoreversion

[Icons]
; Acceso directo al lanzador directo principal
Name: "{autoprograms}\HexDraft"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\launcher\app-hexdraft.py"""; IconFilename: "{app}\public\app-icon.ico"
Name: "{autodesktop}\HexDraft"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\launcher\app-hexdraft.py"""; IconFilename: "{app}\public\app-icon.ico"; Tasks: desktopicon

; Acceso directo opcional para el monitor en segundo plano
Name: "{autoprograms}\HexDraft Monitor"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\launcher\automatizador-hexdraft.py"""; IconFilename: "{app}\public\app-icon.ico"

; Acceso directo para detener el servicio
Name: "{autoprograms}\Detener HexDraft"; Filename: "{app}\Detener-HexDraft.bat"

; Acceso directo de inicio automático (Startup) - Ejecuta el monitor en segundo plano
Name: "{userstartup}\HexDraft"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\launcher\automatizador-hexdraft.py"""; IconFilename: "{app}\public\app-icon.ico"; Tasks: startup

[Run]
; Opción para ejecutar la aplicación al finalizar la instalación
Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\launcher\automatizador-hexdraft.py"""; Description: "{cm:LaunchProgram,HexDraft}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Detener servicios de HexDraft al desinstalar
Filename: "{app}\Detener-HexDraft.bat"; Flags: runhidden
