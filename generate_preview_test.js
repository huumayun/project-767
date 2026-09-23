const fs = require('fs');
const { generateInvoicePdf } = require('./dist-electron/services/invoicePdf.js');

const dummyData = {
  shopName: "M/S. Fatema Electronics",
  shopAddress: "Dhaka",
  invoiceFooter: "Thanks",
  invoiceNo: "INV-260922-0009",
  date: new Date().toISOString(),
  cashierName: "Admin",
  customerName: "uytuyt",
  items: [
    { name: "ytuytu", qty: 3, unitPricePaisa: 89000, discountPaisa: 0, totalPaisa: 267000 },
  ],
  subtotalPaisa: 267000,
  discountPaisa: 0,
  totalPaisa: 267000,
  payments: [{ method: "cash", amountPaisa: 287000 }],
  totalPaidPaisa: 287000,
  changePaisa: 0,
  duePaisa: 0,
  
  customerPreviousDuePaisa: 0,
  previousDuePaidPaisa: 20000,
  customerRemainingDuePaisa: -20000
};

generateInvoicePdf(dummyData, 'a4').then(base64Data => {
  let base64 = base64Data;
  if (base64.includes('base64,')) {
    base64 = base64.split('base64,')[1];
  }
  
  const artifactDir = 'C:/Users/humay/.gemini/antigravity/brain/2abbc168-518e-450e-81b0-9d543156e884';
  const outPath = artifactDir + '/preview_a4_test.pdf';
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  console.log('PDF saved');
}).catch(e => {
  console.error(e);
});
