; =====================================================================
; Saveo - Inno Setup 6 Windows Installer Script
; Creates modern, non-admin (per-user) Windows Setup executable
; Integrates with Start Menu, Windows Search, Desktop, and Windows Settings
; =====================================================================

#define MyAppName "Saveo"
#ifndef MyAppVersion
#define MyAppVersion "1.4.16"
#endif
#define MyAppPublisher "Saveo"
#define MyAppURL "https://github.com/ProTechPh/Saveo"
#define MyAppExeName "Saveo.exe"

[Setup]
; Unique GUID for Saveo to manage clean updates and upgrades
AppId={{E6F74D28-941A-4835-A8F2-721248BC78DE}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases

; Per-User Installation: Installs to %LOCALAPPDATA%\Programs without Administrator/UAC prompt
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableProgramGroupPage=yes
DisableStartupPrompt=yes
PrivilegesRequired=lowest

; Output file name and destination
OutputDir=dist
OutputBaseFilename=Saveo-Setup
SetupIconFile=Saveo.ico

; Compression settings (optimal for fast extraction and small download size)
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

; Uninstaller configuration for Windows Settings (Add or Remove Programs)
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startmenuicon"; Description: "Create Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Copy all compiled files and folders from dist\Saveo
Source: "dist\Saveo\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "Saveo.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\Saveo.ico"; Tasks: startmenuicon
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\Saveo.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
