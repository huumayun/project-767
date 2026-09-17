const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// 1. Start Vite Dev Server
console.log('🚀 Starting Vite development server...');
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const vite = spawn(npxCmd, ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

function checkViteReady(url, timeout = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          clearInterval(interval);
          resolve(true);
        }
      }).on('error', () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error('Vite dev server failed to start within timeout.'));
        }
      });
    }, 400);
  });
}

async function start() {
  try {
    console.log('⏳ Waiting for Vite on http://127.0.0.1:5173 ...');
    await checkViteReady('http://127.0.0.1:5173');
    console.log('✓ Vite server ready!');

    // First compile electron typescript
    console.log('⚙️ Compiling Electron TypeScript...');
    const tsc = spawn(npxCmd, ['tsc', '-p', 'tsconfig.electron.json'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    tsc.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ TypeScript compilation failed.');
        process.exit(1);
      }

      console.log('🖥️ Launching Electron Desktop Window...');
      const electron = spawn(npxCmd, ['electron', '.'], {
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
        },
        cwd: path.resolve(__dirname, '..'),
      });

      electron.on('close', (exitCode) => {
        console.log('Electron closed. Stopping dev server...');
        vite.kill();
        process.exit(exitCode || 0);
      });
    });
  } catch (err) {
    console.error('Error launching dev environment:', err);
    vite.kill();
    process.exit(1);
  }
}

start();
