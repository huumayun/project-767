const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'electron/ipc/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
    
    // Look for db.prepare(...).run(...)
    // This regex isn't perfect but handles basic template strings
    const runRegex = /db\.prepare\(\s*`([^`]+)`\s*\)\.run\(([^)]*)\)/g;
    let match;
    while ((match = runRegex.exec(content)) !== null) {
        const sql = match[1];
        const argsStr = match[2];
        const numParams = (sql.match(/\?/g) || []).length;
        
        // Count args roughly by splitting by comma
        // Handle parentheses and nested calls roughly
        let argsCount = 0;
        if (argsStr.trim().length > 0) {
            let depth = 0;
            argsCount = 1;
            for (let i = 0; i < argsStr.length; i++) {
                if (argsStr[i] === '(' || argsStr[i] === '[' || argsStr[i] === '{') depth++;
                else if (argsStr[i] === ')' || argsStr[i] === ']' || argsStr[i] === '}') depth--;
                else if (argsStr[i] === ',' && depth === 0) argsCount++;
            }
        }

        if (numParams !== argsCount) {
            console.log(`[${file}] Mismatch! SQL has ${numParams} '?', but run() has ${argsCount} args.\nSQL snippet: ${sql.trim().split('\n')[0]}\nArgs: ${argsStr}`);
        }
    }
}
