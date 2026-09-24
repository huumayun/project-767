const fs = require('fs');
let c = fs.readFileSync('src/components/products/ProductsView.tsx', 'utf8');

c = c.replace(/Upload, Download, Download,/g, 'Upload, Download,');

fs.writeFileSync('src/components/products/ProductsView.tsx', c);
