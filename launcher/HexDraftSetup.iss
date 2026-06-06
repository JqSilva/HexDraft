; Script de Inno Setup para HexDraft
; Este script toma todo el contenido de la carpeta "release/HexDraft" y genera el instalador final.

[Setup]
AppId={{928F6DFD-C3A5-470E-9023-CD2A5C1E7202}}
AppName=HexDraft
AppVersion=1.0.0
AppPublisher=HexDraft
DefaultDirName={autopf}\HexDraft
DisableProgramGroupPage=yes
OutputDir=..\dist-installer
OutputBaseFilename=HexDraft_Setup
SetupIconFile=..\public\favicon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern dark
PrivilegesRequired=lowest

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Iniciar HexDraft automáticamente al iniciar sesión en Windows"; GroupDescription: "Configuración de inicio:"; Flags: checkedonce

[Files]
; Copiar todos los archivos generados en el directorio de lanzamiento
Source: "..\release\HexDraft\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Acceso directo al monitor/launcher principal
Name: "{autoprograms}\HexDraft"; Filename: "{app}\HexDraft.exe"; IconFilename: "{app}\public\favicon.ico"
Name: "{autodesktop}\HexDraft"; Filename: "{app}\HexDraft.exe"; IconFilename: "{app}\public\favicon.ico"; Tasks: desktopicon

; Acceso directo para detener el servicio
Name: "{autoprograms}\Detener HexDraft"; Filename: "{app}\Detener-HexDraft.bat"

; Acceso directo de inicio automático (Startup)
Name: "{userstartup}\HexDraft"; Filename: "{app}\HexDraft.exe"; IconFilename: "{app}\public\favicon.ico"; Tasks: startup

[Run]
; Opción para ejecutar la aplicación al finalizar la instalación
Filename: "{app}\HexDraft.exe"; Description: "{cm:LaunchProgram,HexDraft}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Detener servicios de HexDraft al desinstalar
Filename: "{app}\Detener-HexDraft.bat"; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  // Detener ejecuciones previas de la aplicación y Node para evitar archivos bloqueados al sobreescribir
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM HexDraft.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM node.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;
