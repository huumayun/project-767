const fs = require('fs');
let lines = fs.readFileSync('electron/services/invoicePdf.ts', 'utf8').split(/\r?\n/);

const thermalStart = lines.findIndex(l => l.includes('// Customer Balance Summary (Thermal)'));

// Find where the columns array ends for the totals block
const totalsEndIndex = lines.findIndex((l, i) => i > thermalStart && l.includes('margin: [0, 0, 0, 6],'));

// We want to extract the thermal block
const thermalBlockLines = lines.slice(thermalStart, totalsEndIndex - 1); // up to `} : {},`

// Then we want to insert it AFTER the totals block ends
// So, the structure currently is:
/*
              layout: 'noBorders',
            },
              // Customer Balance Summary (Thermal)
            data.customer... ? {
               ...
            } : {},
          ],
          margin: [0, 0, 0, 6],
        },
*/

// We want it to be:
/*
              layout: 'noBorders',
            },
          ],
          margin: [0, 0, 0, 6],
        },
        // Customer Balance Summary (Thermal)
        !isThermal ? {} : data.customer... ? {
           ...
        } : {},
*/

let c = fs.readFileSync('electron/services/invoicePdf.ts', 'utf8');
const search = `              },
              // Customer Balance Summary (Thermal)`;
const replace = `              },
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
