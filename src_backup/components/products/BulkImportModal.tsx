import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { BulkImportResult } from '../../types/ipc';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [dryRunResult, setDryRunResult] = useState<BulkImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadSampleCsv = () => {
    const headers = 'barcode,name,name_bn,category_name,brand,unit,cost_price_taka,sell_price_taka,stock_qty,low_stock_threshold\n';
    const row1 = '8901001,Bearing 6204-RS,বিয়ারিং ৬২০৪,Bearings,SKF,pcs,250.00,350.00,50,10\n';
    const row2 = '8901002,V-Belt B52,ভি বেল্ট,Belts,Gates,pcs,180.00,260.00,30,5\n';
    const row3 = ',Oil Filter Heavy Duty,,Filters,Bosch,pcs,450.00,600.00,15,3\n';

    const blob = new Blob([headers + row1 + row2 + row3], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      return {
        barcode: obj.barcode || null,
        name: obj.name || '',
        name_bn: obj.name_bn || null,
        category_name: obj.category_name || null,
        brand: obj.brand || null,
        unit: obj.unit || 'pcs',
        cost_price_taka: parseFloat(obj.cost_price_taka || '0') || 0,
        sell_price_taka: parseFloat(obj.sell_price_taka || '0') || 0,
        stock_qty: parseInt(obj.stock_qty || '0', 10) || 0,
        low_stock_threshold: parseInt(obj.low_stock_threshold || '5', 10) || 5,
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      const rows = parseCsv(content);
      setParsedRows(rows);
      setDryRunResult(null);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCsvText(val);
    const rows = parseCsv(val);
    setParsedRows(rows);
    setDryRunResult(null);
    setError(null);
  };

  const handleDryRun = async () => {
    if (parsedRows.length === 0) {
      setError('No valid CSV rows parsed. Please select a file or paste CSV content.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.products.bulkImport({
        mode: 'dry_run',
        rows: parsedRows,
      });
      setDryRunResult(res);
    } catch (err: any) {
      setError(err.message || 'Dry-run validation error');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (parsedRows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.products.bulkImport({
        mode: 'commit',
        rows: parsedRows,
      });
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setDryRunResult(res);
        setError('Commit failed due to validation errors.');
      }
    } catch (err: any) {
      setError(err.message || 'Bulk import commit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-900 border border-jungle-teal-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl text-jungle-teal-100 my-8">
        <div className="flex items-center justify-between border-b border-jungle-teal-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted-teal-600/10 text-muted-teal-400 rounded-lg border border-muted-teal-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk CSV / Excel Product Import</h2>
              <p className="text-xs text-jungle-teal-400">Dry-run validation report & single-transaction commit (up to 1,000+ items)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-jungle-teal-400 hover:text-white rounded-lg hover:bg-jungle-teal-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between bg-jungle-teal-950 p-3 rounded-lg border border-jungle-teal-800">
            <div>
              <span className="font-semibold text-jungle-teal-200">1. Download CSV Template</span>
              <p className="text-jungle-teal-400 text-[11px]">Includes all required columns: barcode, name, prices, category, unit, stock</p>
            </div>
            <button
              onClick={downloadSampleCsv}
              className="px-3 py-1.5 bg-jungle-teal-800 hover:bg-jungle-teal-700 text-azure-mist-400 border border-jungle-teal-700 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>
          </div>

          <div>
            <label className="block text-jungle-teal-400 font-medium mb-1">
              2. Choose CSV File or Paste Raw CSV Text
            </label>
            <div className="flex gap-3 mb-2">
              <label className="cursor-pointer bg-jungle-teal-800 hover:bg-jungle-teal-700 text-jungle-teal-200 border border-jungle-teal-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5 text-muted-teal-400" />
                Select CSV File
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
              <span className="text-jungle-teal-500 flex items-center">
                {parsedRows.length > 0 ? `${parsedRows.length} rows detected` : 'No file loaded'}
              </span>
            </div>

            <textarea
              rows={5}
              value={csvText}
              onChange={handleTextChange}
              placeholder="Or paste CSV data here..."
              className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg p-3 text-jungle-teal-200 font-mono text-[11px] focus:outline-hidden focus:border-azure-mist-600"
            />
          </div>

          {/* Dry Run Verification Box */}
          {dryRunResult && (
            <div className={`p-4 rounded-lg border text-xs ${
              dryRunResult.success
                ? 'bg-muted-teal-950/30 border-muted-teal-900/80 text-muted-teal-300'
                : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm mb-2">
                {dryRunResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-muted-teal-400" />
                    Dry-Run Validation Passed: {dryRunResult.validRowsCount} rows ready for import
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Validation Errors Found ({dryRunResult.errors.length})
                  </>
                )}
              </div>

              {dryRunResult.errors.length > 0 && (
                <ul className="list-disc list-inside space-y-1 max-h-40 overflow-y-auto text-[11px] font-mono text-rose-300/90 pt-1 border-t border-rose-800/50">
                  {dryRunResult.errors.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-jungle-teal-800">
            <button
              type="button"
              onClick={handleDryRun}
              disabled={loading || parsedRows.length === 0}
              className="px-4 py-2 bg-jungle-teal-800 hover:bg-jungle-teal-700 text-azure-mist-300 border border-jungle-teal-700 rounded-lg font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Run Dry-Run Check
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-jungle-teal-800 bg-jungle-teal-900 hover:bg-jungle-teal-800 text-jungle-teal-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={loading || parsedRows.length === 0 || (dryRunResult !== null && !dryRunResult.success)}
                className="px-5 py-2 rounded-lg bg-muted-teal-700 hover:bg-muted-teal-600 text-white font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-muted-teal-700/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading ? 'Importing...' : `Commit Import (${parsedRows.length} Items)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
