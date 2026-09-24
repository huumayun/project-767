const fs = require('fs');
let c = fs.readFileSync('src/components/products/ProductsView.tsx', 'utf8');

c = c.replace(
  /const escapeCsv = \(str\) => \{/,
  "const escapeCsv = (str: any) => {"
);

fs.writeFileSync('src/components/products/ProductsView.tsx', c);
