const fs = require('fs');
let c = fs.readFileSync('src/components/customers/CustomerFormModal.tsx', 'utf8');

c = c.replace(
  /const \[note, setNote\] = useState\(''\);/,
  "const [note, setNote] = useState('');\n  const [initialDue, setInitialDue] = useState('');"
);

c = c.replace(
  /setNote\(customer\.note \|\| ''\);/,
  "setNote(customer.note || '');\n      setInitialDue(customer.initial_due_paisa ? String(customer.initial_due_paisa / 100) : '');"
);

c = c.replace(
  /setNote\(''\);/,
  "setNote('');\n      setInitialDue('');"
);

c = c.replace(
  /const created = await window\.api\.customers\.create\(\{([\s\S]+?)\}\);/,
  `const created = await window.api.customers.create({$1  initialDuePaisa: initialDue ? Math.round(parseFloat(initialDue) * 100) : 0,\n        });`
);

const inputJSX = `
          {!customer && (
            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Previous Due Amount (Tk)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={initialDue}
                onChange={(e) => setInitialDue(e.target.value)}
                placeholder="0"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
              />
              <p className="text-xs text-jungle-teal-500 mt-1">Leave empty if there is no previous due.</p>
            </div>
          )}
`;

c = c.replace(
  /<\/form>/,
  inputJSX + '          <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">'
);
// Wait, the replace string above might be wrong because I am replacing </form> which is at the end.
// Let's insert it before the buttons div.
c = fs.readFileSync('src/components/customers/CustomerFormModal.tsx', 'utf8');
c = c.replace(
  /const \[note, setNote\] = useState\(''\);/,
  "const [note, setNote] = useState('');\n  const [initialDue, setInitialDue] = useState('');"
);
c = c.replace(
  /setNote\(customer\.note \|\| ''\);/,
  "setNote(customer.note || '');\n      setInitialDue(customer.initial_due_paisa ? String(customer.initial_due_paisa / 100) : '');"
);
c = c.replace(
  /setNote\(''\);/,
  "setNote('');\n      setInitialDue('');"
);
c = c.replace(
  /const created = await window\.api\.customers\.create\(\{([\s\S]+?)\}\);/,
  `const created = await window.api.customers.create({$1  initialDuePaisa: initialDue ? Math.round(parseFloat(initialDue) * 100) : 0,\n        });`
);

c = c.replace(
  /<div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">/,
  inputJSX + '\n          <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">'
);

fs.writeFileSync('src/components/customers/CustomerFormModal.tsx', c);
