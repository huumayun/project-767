const fs = require('fs');
const { generateInvoicePdf } = require('./dist-electron/services/invoicePdf.js');

const dummyData = {
  shopName: "M/S. Fatema Electronics",
  shopAddress: "Kapotakkho Market, Monirampur, Jashore",
  shopPhone: "01726-116817",
  invoiceFooter: "Thanks for shopping!",
  invoiceNo: "123456789",
  date: new Date().toISOString(),
  cashierName: "Admin",
  customerName: "Imran Vai",
  customerPhone: "01700000000",
  customerAddress: "Jashore",
  items: [
    { name: "Nat", qty: 1, unitPricePaisa: 1000, discountPaisa: 0, totalPaisa: 1000 },
    { name: "Scale", qty: 1, unitPricePaisa: 300000, discountPaisa: 0, totalPaisa: 300000 },
  ],
  subtotalPaisa: 301000,
  discountPaisa: 0,
  totalPaisa: 301000,
  payments: [{ method: "cash", amountPaisa: 50000 }],
  totalPaidPaisa: 50000,
  changePaisa: 0,
  duePaisa: 251000,
  
  customerPreviousDuePaisa: 200000,
  previousDuePaidPaisa: 50000,
  customerRemainingDuePaisa: 150000
};

generateInvoicePdf(dummyData, '80mm').then(base64Data => {
  let base64 = base64Data;
  if (base64.includes('base64,')) {
    base64 = base64.split('base64,')[1];
  }
  
  const artifactDir = 'C:/Users/humay/.gemini/antigravity/brain/2abbc168-518e-450e-81b0-9d543156e884';
  const outPath = artifactDir + '/preview_80mm.pdf';
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  console.log('PDF saved to ' + outPath);
}).catch(e => {
  console.error(e);
});
