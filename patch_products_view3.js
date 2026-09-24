const fs = require('fs');
let c = fs.readFileSync('src/components/products/ProductsView.tsx', 'utf8');

const exportButton = `
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-azure-mist-100 hover:bg-azure-mist-200 text-azure-mist-800 rounded-xl text-xs font-bold flex items-center gap-1 border border-azure-mist-300 shadow-xs transition-colors"
                title="Download all products as CSV"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV</span>
              </button>
`;

const searchStr = '<span>Bulk CSV</span>\r\n              </button>';
const insertStr = searchStr + '\n' + exportButton;
c = c.replace(searchStr, insertStr);

const searchStr2 = '<span>Bulk CSV</span>\n              </button>';
const insertStr2 = searchStr2 + '\n' + exportButton;
c = c.replace(searchStr2, insertStr2);

fs.writeFileSync('src/components/products/ProductsView.tsx', c);
