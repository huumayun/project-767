import { BrowserWindow, app } from 'electron';

export function setupSecurityPolicies(win: BrowserWindow) {
  // Navigation restriction - deny new windows/popups
  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Prevent unexpected webview or iframe navigation
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Disable DevTools in production
  if (app.isPackaged) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
  }
}
