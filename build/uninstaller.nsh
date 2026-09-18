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

    ; Electron keeps data per user even for an all-users install.
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}
    RMDir /r "$APPDATA\${APP_FILENAME}"
    !ifdef APP_PRODUCT_FILENAME
      RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
    !endif
    !ifdef APP_PACKAGE_NAME
      RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !endif
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}

    keepData:
  ${endIf}
!macroend
