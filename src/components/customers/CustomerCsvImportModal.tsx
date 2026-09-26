import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, X, FileSpreadsheet } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface CustomerCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerCsvImportModal: React.FC<CustomerCsvImportModalProps> = ({
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

  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'name,phone,address,note,due_taka\n' +
      'Rahim Mia,01700000001,Dhaka,Regular Customer,500\n' +
      'Karim Store,01800000002,Chittagong,,0\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'fatema_electronics_customers_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    e.target.value = '';
  };

  const parseCsvLines = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: any[] = [];

    // Simple CSV parser that handles quotes
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      let values = [];
      let inQuote = false;
      let currentValue = '';
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' && line[j+1] === '"') {
          currentValue += '"';
          j++; // skip next quote
        } else if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      rows.push({
        name: row.name || '',
        phone: row.phone || null,
        address: row.address || null,
        note: row.note || null,
        due_taka: parseFloat(row.due || row.due_taka) || 0,
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
    setError(null);
    try {
      const res = await window.api.customers.bulkImport({
        mode: 'dry_run',
        rows: parsedRows,
      });
      setReport({
        validCount: res.validRowsCount || 0,
        totalCount: res.totalRows || parsedRows.length,
        errors: res.errors || [],
      });
      if (res.validRows && res.validRows.length > 0) {
        setPreviewRows(res.validRows);
      } else {
        setPreviewRows([]);
      }
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    }
  };

  const handleCommit = async () => {
    if (!window.api || !csvText.trim()) return;
    const parsedRows = parseCsvLines(csvText);

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.customers.bulkImport({
        mode: 'commit',
        rows: parsedRows,
      });
      if (res.success) {
        toast.success(`Successfully imported ${res.imported} customers!`);
        onSuccess();
      } else {
        setReport({
          validCount: res.validRowsCount || 0,
          totalCount: res.totalRows || parsedRows.length,
          errors: res.errors || [],
        });
      }
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-jungle-teal-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jungle-teal-100/50 bg-jungle-teal-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-jungle-teal-100 rounded-lg text-jungle-teal-700">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-jungle-teal-950">Bulk Customer Import</h2>
              <p className="text-sm text-jungle-teal-600/80">Import customers via CSV file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-jungle-teal-400 hover:text-jungle-teal-600 hover:bg-jungle-teal-100/50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl p-4">
            <h3 className="font-semibold text-jungle-teal-900 mb-2">Instructions</h3>
            <ul className="list-disc list-inside text-sm text-jungle-teal-700 space-y-1">
              <li>Required column: <strong>name</strong></li>
              <li>Optional columns: <strong>phone, address, note, due_taka</strong></li>
              <li>Customers with duplicate phone numbers (already in database) will be skipped.</li>
            </ul>
            <button
              onClick={handleDownloadTemplate}
              className="mt-4 px-4 py-2 bg-white text-jungle-teal-700 border border-jungle-teal-300 rounded-lg text-sm font-semibold hover:bg-jungle-teal-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template CSV
            </button>
          </div>

          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />

          {!csvText ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-jungle-teal-200 rounded-xl p-12 text-center cursor-pointer hover:bg-jungle-teal-50 hover:border-jungle-teal-300 transition-colors"
            >
              <FileSpreadsheet className="w-12 h-12 text-jungle-teal-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-jungle-teal-900 mb-1">Click to select CSV file</h3>
              <p className="text-sm text-jungle-teal-600">or drag and drop your file here</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-jungle-teal-50 rounded-xl border border-jungle-teal-100">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-jungle-teal-600" />
                  <span className="font-medium text-jungle-teal-900">CSV Loaded</span>
                </div>
                <button
                  onClick={() => {
                    setCsvText('');
                    setReport(null);
                    setError(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear File
                </button>
              </div>

              {!report && !error && (
                <button
                  onClick={handleDryRun}
                  className="w-full py-3 bg-azure-mist-100 text-azure-mist-800 rounded-xl font-bold hover:bg-azure-mist-200 transition-colors border border-azure-mist-300"
                >
                  Validate Data
                </button>
              )}
            </div>
          )}

          {/* Error / Report section */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-5 h-5" />
                Error
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {report && (
            <div className={`p-4 border rounded-xl ${report.errors.length === 0 ? 'bg-green-50 border-green-200' : report.validCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold flex items-center gap-2 ${report.errors.length === 0 ? 'text-green-800' : report.validCount > 0 ? 'text-amber-800' : 'text-red-800'}`}>
                  {report.errors.length === 0 ? (
                      <><CheckCircle2 className="w-5 h-5" /> Validation Passed</>
                    ) : report.validCount > 0 ? (
                      <><AlertTriangle className="w-5 h-5" /> Partial Validation</>
                    ) : (
                      <><AlertTriangle className="w-5 h-5" /> Validation Failed</>
                    )}
                </h3>
                <span className="text-sm font-medium opacity-80">
                  {report.validCount} valid out of {report.totalCount} rows
                </span>
              </div>
              
              {report.errors.length > 0 && (
                <div className="mt-4 bg-white/60 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <ul className="text-sm text-red-700 space-y-1">
                    {report.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.validCount > 0 && (
                <>
                  <div className="mt-4 bg-white/60 rounded-xl overflow-hidden border border-green-200">
                    <div className="max-h-[30vh] overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-green-100/50 sticky top-0 backdrop-blur-sm shadow-xs">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold text-green-800">Name</th>
                            <th className="py-2.5 px-4 font-semibold text-green-800">Phone</th>
                            <th className="py-2.5 px-4 font-semibold text-green-800">Address</th>
                            <th className="py-2.5 px-4 font-semibold text-green-800 text-right">Due (৳)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-100/50">
                          {previewRows.map((r, i) => (
                            <tr key={i} className="hover:bg-white transition-colors">
                              <td className="py-2 px-4 font-medium text-jungle-teal-900">{r.name}</td>
                              <td className="py-2 px-4 text-jungle-teal-700">{r.phone || '-'}</td>
                              <td className="py-2 px-4 text-jungle-teal-700">{r.address || '-'}</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-amber-700">{r.due_taka}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <button
                    onClick={handleCommit}
                    disabled={loading}
                    className="mt-4 w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Importing...' : 'Confirm Import'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
