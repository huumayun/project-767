const fs = require('fs');
let c = fs.readFileSync('src/components/products/ProductsView.tsx', 'utf8');

const exportFunction = `
  const handleExportCsv = async () => {
    try {
      if (!window.api) return;
      const allProducts = await window.api.products.list();
      
      const headers = ['barcode', 'name', 'name_bn', 'category_name', 'brand', 'unit', 'cost_price_taka', 'sell_price_taka', 'stock_qty', 'low_stock_threshold'];
      
      const escapeCsv = (str) => {
        if (str == null) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const rows = allProducts.map(p => [
        escapeCsv(p.barcode),
        escapeCsv(p.name),
        escapeCsv(p.name_bn),
        escapeCsv(p.category_name),
        escapeCsv(p.brand),
        escapeCsv(p.unit || 'pcs'),
        (p.cost_price_paisa / 100).toFixed(2),
        (p.sell_price_paisa / 100).toFixed(2),
        p.stock_qty,
        p.low_stock_threshold
      ].join(','));
      
      const csvContent = [headers.join(','), ...rows].join('\\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', \`fatema_electronics_products_\${dateStr}.csv\`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Products exported successfully!');
    } catch (err) {
      console.error('Failed to export CSV:', err);
      toast.error('Failed to export products.');
    }
  };
`;

c = c.replace(
  /(\s+)return \(\s+<div className="h-full flex-1 flex flex-col/,
  (match, p1) => p1 + exportFunction + match
);

const exportButton = `
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-azure-mist-100 hover:bg-azure-mist-200 text-azure-mist-800 rounded-xl text-[11px] font-bold flex items-center gap-1 border border-azure-mist-300 shadow-xs transition-colors"
                title="Download all products as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
`;

c = c.replace(
  /(\s+<button[\s\S]+?onClick=\{[^}]*setShowCsvModal\(true\)[^}]*\}(?:.|\n)+?<\/button>)/,
  (match, p1) => p1 + '\n' + exportButton
);

c = c.replace(
  /import \{([\s\S]+?)Upload,([\s\S]+?)\} from 'lucide-react';/,
  "import {$1Upload, Download,$2} from 'lucide-react';"
);

fs.writeFileSync('src/components/products/ProductsView.tsx', c);
