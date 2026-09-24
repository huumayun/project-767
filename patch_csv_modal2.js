const fs = require('fs');

let c = fs.readFileSync('src/components/products/CsvImportModal.tsx', 'utf8');

const uploadButtonUI = `
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-2.5 py-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg font-bold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select CSV File</span>
            </button>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-xs text-azure-mist-800 hover:text-azure-mist-950 font-bold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>
`;

// Replace the entire <button> that triggers handleDownloadTemplate
const startIdx = c.indexOf('<button');
const endIdx = c.indexOf('</button>', c.indexOf('handleDownloadTemplate')) + 9;

if (startIdx !== -1 && endIdx !== -1) {
  // wait, finding the exact button is safer by string splitting
  const parts = c.split('<button\n            type="button"\n            onClick={handleDownloadTemplate}');
  if (parts.length === 2) {
    const end = parts[1].indexOf('</button>') + 9;
    c = parts[0] + uploadButtonUI + parts[1].substring(end);
  } else {
    // try inline
    const parts2 = c.split('<button\r\n            type="button"\r\n            onClick={handleDownloadTemplate}');
    if (parts2.length === 2) {
        const end = parts2[1].indexOf('</button>') + 9;
        c = parts2[0] + uploadButtonUI + parts2[1].substring(end);
    }
  }
}

fs.writeFileSync('src/components/products/CsvImportModal.tsx', c);
