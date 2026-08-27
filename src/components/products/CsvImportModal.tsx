import React, { useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, X, FileSpreadsheet } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [csvText, setCsvText] = useState('');
  const [report, setReport] = useState<{
    validCount: number;
    totalCount: number;
    errors: string[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'barcode,name,name_bn,category_name,brand,unit,cost_price_taka,sell_price_taka,stock_qty,low_stock_threshold\n' +
      'BC-1001,Piston Ring Set,পিস্টন রিং,Engine Parts,Mahle,set,1200,1800,20,5\n' +
      'BC-1002,Spark Plug BP6EY,স্পার্ক প্লাগ,Electrical,NGK,pcs,180,280,50,10\n' +
      ',Brake Pad Front,ব্রেক প্যাড,Brakes,Bosch,set,850,1350,15,3\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'mechanical_parts_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvLines = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      rows.push({
        barcode: row.barcode || null,
        name: row.name || '',
        name_bn: row.name_bn || null,
        category_name: row.category_name || null,
        brand: row.brand || null,
        unit: row.unit || 'pcs',
        cost_price_taka: parseFloat(row.cost_price_taka) || 0,
        sell_price_taka: parseFloat(row.sell_price_taka) || 0,
        stock_qty: parseInt(row.stock_qty, 10) || 0,
        low_stock_threshold: parseInt(row.low_stock_threshold, 10) || 5,
      });
    }

    return rows;
  };

  const handleDryRun = async () => {
    if (!window.api || !csvText.trim()) return;
    const parsedRows = parseCsvLines(csvText);
    if (parsedRows.length === 0) {
      setError('No valid rows found in CSV data.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.products.bulkImport({
        mode: 'dry_run',
        rows: parsedRows,
      });
      setReport({
        validCount: res.validRowsCount || 0,
        totalCount: res.totalRows || 0,
        errors: res.errors || [],
      });
    } catch (err: any) {
      setError(err.message || 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!window.api || !csvText.trim()) return;
    const parsedRows = parseCsvLines(csvText);

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.products.bulkImport({
        mode: 'commit',
        rows: parsedRows,
      });
      if (res.success) {
        toast.success(`Successfully imported ${res.imported} products in one transaction!`);
        onSuccess();
      } else {
        setReport({
          validCount: 0,
          totalCount: parsedRows.length,
          errors: res.errors || [],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-muted-teal-50 text-muted-teal-700 rounded-xl border border-muted-teal-200 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Bulk Product CSV Import</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">Dry-run validation + All-or-Nothing atomic transaction</p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-jungle-teal-600 font-semibold">Paste CSV Data or use the standard template:</span>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-xs text-azure-mist-800 hover:text-azure-mist-950 font-bold flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>
        </div>

        <textarea
          rows={7}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setReport(null);
          }}
          placeholder="barcode,name,name_bn,category_name,brand,unit,cost_price_taka,sell_price_taka,stock_qty,low_stock_threshold&#10;BC-1001,Piston Ring Set,পিস্টন রিং,Engine Parts,Mahle,set,1200,1800,20,5"
          className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl p-3 text-xs font-mono text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
        />

        {report && (
          <div className="p-3.5 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-jungle-teal-800">Dry-Run Validation Report:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                  report.errors.length === 0
                    ? 'bg-muted-teal-100 text-muted-teal-900 border border-muted-teal-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {report.errors.length === 0 ? '✓ Ready to Commit' : '⚠️ Errors Found'}
              </span>
            </div>

            <div className="text-[11px] text-jungle-teal-600">
              Valid Rows: <strong className="text-jungle-teal-900">{report.validCount}</strong> of {report.totalCount}
            </div>

            {report.errors.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1 text-rose-700 font-mono text-[10.5px]">
                {report.errors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDryRun}
            disabled={loading || !csvText.trim()}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 border border-jungle-teal-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            {loading ? 'Validating...' : '1. Test / Dry Run'}
          </button>

          <button
            type="button"
            onClick={handleCommit}
            disabled={loading || !report || report.errors.length > 0}
            className="px-5 py-2 bg-muted-teal-700 hover:bg-muted-teal-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors disabled:opacity-40"
          >
            <Upload className="w-4 h-4" />
            <span>2. Commit & Import All</span>
          </button>
        </div>
      </div>
    </div>
  );
};
