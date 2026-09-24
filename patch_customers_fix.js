const fs = require('fs');
let c = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');

c = c.replace(
  /deviceId,\s*now,\s*now\s*\);/,
  "deviceId, now, now, data.initialDuePaisa || 0\n        );"
);

fs.writeFileSync('electron/ipc/routes/customers.ts', c);
