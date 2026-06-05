' HexDraftGuard.vbs
' Monitor en segundo plano para iniciar Astro Server cuando LoL esté abierto (sin falsos positivos de antivirus)
Dim objWMIService, colProcesses, objProcess
Dim WshShell, fso, scriptDir, nodePath, serverCmd, browserCmd
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtener la ruta del script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Crear acceso directo con icono si no existe
Dim shortcutPath, shortcut
shortcutPath = scriptDir & "\Iniciar HexDraft.lnk"
If Not fso.FileExists(shortcutPath) Then
    On Error Resume Next
    Set shortcut = WshShell.CreateShortcut(shortcutPath)
    shortcut.TargetPath = "wscript.exe"
    shortcut.Arguments = """" & scriptDir & "\HexDraftGuard.vbs"""
    shortcut.WorkingDirectory = scriptDir
    If fso.FileExists(scriptDir & "\public\favicon.ico") Then
        shortcut.IconLocation = scriptDir & "\public\favicon.ico"
    ElseIf fso.FileExists(scriptDir & "\favicon.ico") Then
        shortcut.IconLocation = scriptDir & "\favicon.ico"
    End If
    shortcut.Save
    On Error GoTo 0
End If

' Ruta del node.exe portable o global (sin comillas externas)
If fso.FileExists(scriptDir & "\node.exe") Then
    nodePath = scriptDir & "\node.exe"
Else
    nodePath = "node"
End If

Dim serverActive
serverActive = False

Do
    Dim lolActive
    lolActive = False
    
    ' Consultar procesos activos con WMI
    Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
    Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where Name = 'LeagueClientUx.exe'")
    
    If colProcesses.Count > 0 Then
        lolActive = True
    End If
    
    If lolActive And Not serverActive Then
        ' Iniciar Astro Server en segundo plano mediante un wrapper de PowerShell (.NET Process)
        ' Usamos UseShellExecute = true y WindowStyle = Hidden para evitar propagar el show-state oculto (SW_HIDE) a Chrome/Puppeteer
        Dim psCommand
        psCommand = "powershell -NoProfile -WindowStyle Hidden -Command ""$p = New-Object System.Diagnostics.Process; $p.StartInfo.FileName = '" & nodePath & "'; $p.StartInfo.Arguments = 'dist/server/entry.mjs'; $p.StartInfo.WorkingDirectory = '" & scriptDir & "'; $p.StartInfo.WindowStyle = 'Hidden'; $p.StartInfo.UseShellExecute = $true; $p.Start()"""
        WshShell.Run psCommand, 0, False
        Wscript.Sleep 6000 ' Esperar 6 segundos a que levante el servidor
        
        ' Buscar navegador compatible para modo app
        Dim browserPath, launchCmd
        browserPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
        If fso.FileExists(browserPath) Then
            launchCmd = """" & browserPath & """ --app=http://localhost:4321/draft"
        Else
            browserPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
            If fso.FileExists(browserPath) Then
                launchCmd = """" & browserPath & """ --app=http://localhost:4321/draft"
            Else
                launchCmd = "cmd /c start http://localhost:4321/draft"
            End If
        End If
        
        WshShell.Run launchCmd, 0, False
        serverActive = True
        
    ElseIf Not lolActive And serverActive Then
        ' Detener node.exe (matar los procesos correspondientes)
        WshShell.Run "taskkill /f /im node.exe", 0, True
        serverActive = False
    End If
    
    ' Esperar 15 segundos antes de volver a verificar
    Wscript.Sleep 15000
Loop
