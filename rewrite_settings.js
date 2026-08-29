const fs = require('fs');
let code = fs.readFileSync('src/components/settings/SettingsView.tsx', 'utf-8');

const newHandleSave = \
  const handleSaveSection = async (sectionName: string, data: Record<string, any>) => {
    if (!window.api || !isOwner) return;

    setLoading(true);
    setError(null);
    try {
      await window.api.settings.update(data);
      toast.success(\\\\\\ saved successfully.\\\);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
      toast.error(err.message || 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };
\;

code = code.replace(
    '  const handleSave = async (e: React.FormEvent) => {', 
    newHandleSave + '\\n  const handleSave = async (e: React.FormEvent) => {'
);

// Regex matching the old handleSave logic
code = code.replace(/  const handleSave = async \\(e: React\.FormEvent\\) => \\{[\\s\\S]*?^  };\n/m, '');

// Remove the sticky global save button
code = code.replace(/\\s*<div className="sticky bottom-0[\\s\\S]*?<\\/button>\\s*<\\/div>/, '');

// Change <form> wrapping the sections to <div>
code = code.replace('<form onSubmit={handleSave} className="text-ui-sm">', '<div className="text-ui-sm space-y-6">');
code = code.replace('</form>', '</div>');

// Change the big grid-cols-2 wrapper to single col if it is there
code = code.replace('<div className="grid grid-cols-1 min-[1150px]:grid-cols-2 gap-5 items-start">', '<div className="grid grid-cols-1 min-[1150px]:grid-cols-2 gap-6 items-start">');

const storeBtn = \
          <div className="flex justify-end pt-2 mt-4 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={() => handleSaveSection('Store Profile', { shop_name: shopName.trim(), shop_address: shopAddress.trim(), shop_phone: shopPhone.trim(), invoice_footer: invoiceFooter.trim() })}
              disabled={loading}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </div>\;
code = code.replace('        </div>\\n\\n        {/* Keyboard Shortcuts Card */}', storeBtn + '\\n\\n        {/* Keyboard Shortcuts Card */}');

const printerBtn = \
          <div className="flex justify-end pt-2 mt-4 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={() => handleSaveSection('Printer & Device Config', { default_invoice_layout: defaultInvoiceLayout, device_id_prefix: deviceIdPrefix.trim() || 'REG01' })}
              disabled={loading}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>Save Printer Config</span>
            </button>
          </div>
        </div>\;
code = code.replace('        </div>\\n\\n        {/* Security & Inactivity Lock Card */}', printerBtn + '\\n\\n        {/* Security & Inactivity Lock Card */}');

const securityBtn = \
          <div className="flex justify-end pt-2 mt-4 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={() => handleSaveSection('Security & Session Policies', { idle_lock_minutes: parseInt(idleLockMinutes, 10) || 15, inventory_valuation_method: inventoryValuationMethod, enable_shifts: enableShifts })}
              disabled={loading}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>Save Policies</span>
            </button>
          </div>
        </div>\;
code = code.replace('        </div>\\n\\n        {/* Demo Data & Database Reset Tools */}', securityBtn + '\\n\\n        {/* Demo Data & Database Reset Tools */}');

fs.writeFileSync('src/components/settings/SettingsView.tsx', code, 'utf-8');
console.log("Rewrite complete");
