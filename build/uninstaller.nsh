; Runs inside electron-builder's uninstaller, before the program files go.
;
; Windows leaves a program's data alone when the program is removed, and so
; does Electron: the shop's database, settings and local backups live in
; %APPDATA%\<app name>, not in Program Files. That is why a reinstall found
; the old data. Reinstalling to fix a problem must never wipe a shop's books,
; so the data stays unless the person removing the app says otherwise here.
;
; The names come from electron-builder: APP_FILENAME is the product name,
; APP_PACKAGE_NAME the package.json name, and Electron may have used either
; for its folder. They must be written as NSIS variables and defines - a
; previous version of this file had lost them, leaving RMDir /r "\", which
; is the root of the drive.
!macro customUnInstall
  ; An upgrade runs the old uninstaller with --updated. Never ask then.
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
      "Also delete all shop data (database, settings and local backups)?$\r$\n$\r$\nChoose No to keep the data for a future install." \
      /SD IDNO IDNO keepData

    ; The database is open for as long as the app runs, and a file that is
    ; open cannot be deleted: a first version of this ran straight after the
    ; app was closed, cleared the caches, and left shop.db behind because its
    ; handle had not been released yet. So the app is stopped here if it is
    ; still up, and the delete is retried for a while until the folder is
    ; really empty.
    !ifmacrodef FIND_PROCESS
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 == 0
        !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1
        Sleep 1500
      ${endif}
    !endif

    ; Electron keeps data per user even for an all-users install.
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}

    StrCpy $R9 0
    ${Do}
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
      !endif
      IntOp $R9 $R9 + 1

      ${IfNot} ${FileExists} "$APPDATA\${APP_FILENAME}\*.*"
      !ifdef APP_PACKAGE_NAME
      ${AndIfNot} ${FileExists} "$APPDATA\${APP_PACKAGE_NAME}\*.*"
      !endif
        ${ExitDo}
      ${EndIf}
      Sleep 1000
    ${LoopUntil} $R9 >= 15

    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}

    keepData:
  ${endIf}
!macroend
