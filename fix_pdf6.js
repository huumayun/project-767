const fs = require('fs');
let c = fs.readFileSync('electron/services/invoicePdf.ts', 'utf8');

const search = `              },
              layout: 'noBorders',
            },
              // Customer Balance Summary (Thermal)`;

const replace = `              },
              layout: 'noBorders',
            },
          ],
          margin: [0, 0, 0, 6],
        },
        // Customer Balance Summary (Thermal)
        !isThermal ? {} :`;

c = c.replace(search, replace);

const search2 = `              } : {},
            ],
            margin: [0, 0, 0, 6],
          },`;

const replace2 = `              } : {},`;

c = c.replace(search2, replace2);

fs.writeFileSync('electron/services/invoicePdf.ts', c);
