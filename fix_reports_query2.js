const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/reports.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /date\(p\.created_at, '\+6 hours'\)/g,
  "COALESCE(date(p.created_at, 'localtime'), substr(p.created_at, 1, 10))"
);

content = content.replace(
  /date\(s\.created_at, '\+6 hours'\)/g,
  "COALESCE(date(s.created_at, 'localtime'), substr(s.created_at, 1, 10))"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed localDaySql in getSalesReport');
