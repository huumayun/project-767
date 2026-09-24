const fs = require('fs');

let c = fs.readFileSync('src/components/products/CsvImportModal.tsx', 'utf8');

const fileUploadLogic = `
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        setCsvText(text);
        setReport(null);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };
`;

c = c.replace(
  /const parseCsvLines =/,
  fileUploadLogic + '\n  const parseCsvLines ='
);

const uploadButtonUI = `
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-2 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-md font-bold flex items-center gap-1 border border-jungle-teal-300 transition-colors"
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
              className="text-xs text-azure-mist-800 hover:text-azure-mist-950 font-bold flex items-center gap-1 ml-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>
`;

c = c.replace(
  /<button\s+type="button"\s+onClick=\{handleDownloadTemplate\}(?:.|\n)+?<\/button>/,
  uploadButtonUI
);

// We need React.useRef, let's just make sure it's available or imported.
// It's probably already `import React, { useState } from 'react';`
c = c.replace(
  /import React, \{ useState \} from 'react';/,
  "import React, { useState, useRef } from 'react';"
);
// Or if it's just `import { useState } from 'react';`
if (!c.includes('useRef')) {
  c = c.replace(
    /import \{([\s\S]+?)\} from 'react';/,
    "import { useRef, $1 } from 'react';"
  );
}

fs.writeFileSync('src/components/products/CsvImportModal.tsx', c);
