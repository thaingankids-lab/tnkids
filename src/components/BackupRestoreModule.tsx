import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  BackupPayload,
  createBackupPayload,
  downloadBackupFile,
  getBackupSummary,
  restoreBackupPayload,
  validateBackupPayload,
} from '../lib/backup';

type Notice = {
  type: 'success' | 'error';
  message: string;
};

export default function BackupRestoreModule() {
  const [working, setWorking] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupPayload | null>(null);
  const [fileName, setFileName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const backupSummary = useMemo(
    () => (selectedBackup ? getBackupSummary(selectedBackup) : []),
    [selectedBackup],
  );

  const totalRows = backupSummary.reduce((sum, item) => sum + item.count, 0);
  const canRestore = selectedBackup && confirmText.trim().toUpperCase() === 'RESTORE';

  const showNotice = (message: string, type: Notice['type']) => {
    setNotice({ message, type });
  };

  const handleDownloadBackup = async () => {
    setWorking(true);
    setNotice(null);
    try {
      const payload = await createBackupPayload();
      downloadBackupFile(payload);
      showNotice('Đã tạo file backup đầy đủ dữ liệu hiện tại.', 'success');
    } catch (err: any) {
      showNotice(err.message || 'Không thể tạo backup.', 'error');
    } finally {
      setWorking(false);
    }
  };

  const handleBackupFile = async (file?: File) => {
    setNotice(null);
    setConfirmText('');
    setSelectedBackup(null);
    setFileName('');

    if (!file) return;

    try {
      const text = await file.text();
      const payload = validateBackupPayload(JSON.parse(text));
      setSelectedBackup(payload);
      setFileName(file.name);
      showNotice('File backup hợp lệ. Hãy kiểm tra kỹ trước khi phục hồi.', 'success');
    } catch (err: any) {
      showNotice(err.message || 'Không thể đọc file backup.', 'error');
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup || !canRestore) return;

    setWorking(true);
    setNotice(null);
    try {
      const beforeRestore = await createBackupPayload();
      downloadBackupFile(beforeRestore);
      await restoreBackupPayload(selectedBackup);
      showNotice('Đã phục hồi dữ liệu từ file backup. App vừa tự tải thêm một backup dự phòng trước khi restore.', 'success');
      setConfirmText('');
    } catch (err: any) {
      showNotice(err.message || 'Không thể phục hồi backup.', 'error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Backup & Restore dữ liệu</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xuất file dự phòng và phục hồi toàn bộ kho, khách hàng, hóa đơn, thanh toán khi cần.
          </p>
        </div>
        <button
          onClick={handleDownloadBackup}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-60 cursor-pointer"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Tải file backup
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{notice.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DatabaseBackup className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tạo backup an toàn</h3>
              <p className="text-xs text-slate-500">File JSON chứa đủ bảng dữ liệu và giữ nguyên ID liên kết.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {['products', 'size_sets', 'inventory_batches', 'customers', 'invoices', 'invoice_items', 'payments'].map((table) => (
              <div key={table} className="border border-slate-100 rounded-xl bg-slate-50 px-3 py-2">
                <span className="font-mono text-slate-700">{table}</span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Nên tải backup trước mỗi lần nhập kho lớn, sửa dữ liệu hàng loạt, hoặc trước khi restore từ file cũ.
            </p>
          </div>
        </section>

        <section className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Restore từ file backup</h3>
              <p className="text-xs text-slate-500">Phục hồi toàn bộ dữ liệu theo thứ tự để tránh mất liên kết.</p>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors p-6 cursor-pointer text-center">
            <Upload className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-sm font-semibold text-slate-800">Chọn file backup .json</span>
            <span className="text-xs text-slate-500 mt-1">File tạo từ chức năng backup của app</span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={working}
              onChange={(event) => handleBackupFile(event.target.files?.[0])}
            />
          </label>

          {selectedBackup && (
            <div className="space-y-4">
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                <div className="flex items-start gap-3">
                  <FileJson className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{fileName}</p>
                    <p className="text-xs text-slate-500">
                      Xuất lúc {new Date(selectedBackup.exportedAt).toLocaleString('vi-VN')} • {totalRows.toLocaleString('vi-VN')} dòng dữ liệu
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                  {backupSummary.map((item) => (
                    <div key={item.table} className="bg-white border border-slate-100 rounded-lg px-3 py-2">
                      <p className="font-mono text-[10px] text-slate-500">{item.table}</p>
                      <p className="font-bold text-slate-900 text-sm">{item.count.toLocaleString('vi-VN')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 space-y-3">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="font-semibold">
                    Restore sẽ xóa dữ liệu hiện tại rồi ghi lại từ file backup. App sẽ tự tải một backup dự phòng ngay trước khi bắt đầu.
                  </p>
                </div>
                <input
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="Gõ RESTORE để xác nhận"
                  className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:ring-2 focus:ring-red-200"
                  disabled={working}
                />
              </div>

              <button
                onClick={handleRestore}
                disabled={!canRestore || working}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Phục hồi dữ liệu từ backup
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
