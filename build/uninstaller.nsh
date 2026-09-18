!macro customUnInstall
  MessageBox MB_YESNO "Do you also want to completely delete all app data (main database, settings)?" /SD IDNO IDNO Skipped
  
  RMDir /r "\"
  RMDir /r "\"
  RMDir /r "\fatema-electronics-pos"
  
  Goto done
  
  Skipped:
  
  done:
!macroend