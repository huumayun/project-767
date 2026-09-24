const fs = require('fs');

// Fix `.gitignore`
let gitignore = fs.readFileSync('.gitignore', 'utf8');
if (!gitignore.includes('client_secret')) {
  gitignore += '\nclient_secret_*.json\n';
  fs.writeFileSync('.gitignore', gitignore);
}

// Fix `customers.ts`
let c = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');
c = c.replace(
  /note: z\.string\(\)\.optional\(\)\.nullable\(\),/,
  'note: z.string().optional().nullable(),\n          initialDuePaisa: z.number().optional().default(0),'
);
fs.writeFileSync('electron/ipc/routes/customers.ts', c);
