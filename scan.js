const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'electron/ipc/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

let errors = 0;

for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
    
    // Find all db.prepare(`...`)
    const prepareRegex = /db\.prepare\(\s*`([^`]+)`\s*\)/g;
    let match;
    while ((match = prepareRegex.exec(content)) !== null) {
        const sql = match[1];
        const numParams = (sql.match(/\?/g) || []).length;
        
        // Find .run( or .all( or .get( right after
        // This is a bit tricky because they might be assigned to a variable.
        // Let's just print the SQL and number of ? for now if it's an INSERT or UPDATE
        if (sql.trim().toUpperCase().startsWith('INSERT') || sql.trim().toUpperCase().startsWith('UPDATE')) {
            // console.log(`[${file}] ${numParams} params in:\n${sql.trim().split('\n')[0]}...`);
        }
    }
}
console.log('Done scanning.');
