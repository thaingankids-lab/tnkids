import { useState, useEffect } from 'react';
import { checkDatabaseSetup, INITIAL_SQL_SCRIPT } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Copy, Play, Database, RefreshCw } from 'lucide-react';

interface DatabaseCheckModalProps {
  onValidated: () => void;
}

export default function DatabaseCheckModal({ onValidated }: DatabaseCheckModalProps) {
  const [loading, setLoading] = useState(true);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  const checkSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await checkDatabaseSetup();
      if (result.success) {
        onValidated();
        setStatusChecked(true);
      } else {
        setMissingTables(result.missingTables);
        setError(result.error || null);
        setStatusChecked(true);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kiểm tra kết nối');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSetup();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(INITIAL_SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-100">
          <RefreshCw className="h-10 w-10 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Đang kiểm tra kết nối Database</h3>
          <p className="text-sm text-slate-500 mt-2">Đang thiết lập liên kết thời gian thực với Supabase...</p>
        </div>
      </div>
    );
  }

  // If status is checked and no missing tables, don't show anything (it will trigger onValidated)
  if (statusChecked && missingTables.length === 0 && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50 rounded-t-2xl">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Database className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Yêu cầu thiết lập Supabase Database</h3>
            <p className="text-xs text-slate-500">Ứng dụng cần các bảng dữ liệu để hoạt động chính xác</p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Lỗi kết nối Supabase</p>
                <p className="text-xs mt-1 text-red-600">{error}</p>
                <p className="text-xs mt-1">Vui lòng kiểm tra xem Supabase Credentials có chính xác không.</p>
              </div>
            </div>
          )}

          {missingTables.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex gap-3 text-amber-800">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Chưa tìm thấy các bảng dữ liệu sau trên Supabase:</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {missingTables.map((table) => (
                      <span key={table} className="px-2 py-0.5 bg-amber-100 text-amber-900 text-xs rounded font-mono border border-amber-200">
                        {table}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-2 pl-8">
                Để ứng dụng hoạt động đầy đủ, bạn cần chạy script tạo bảng trong trang quản lý của Supabase.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Play className="h-4 w-4 text-blue-600 fill-blue-600" /> Các bước thực hiện nhanh:
              </h4>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Đã sao chép!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Sao chép SQL Script
                  </>
                )}
              </button>
            </div>

            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <li>Nhấn nút <b>"Sao chép SQL Script"</b> ở trên.</li>
              <li>Truy cập vào trang quản lý Supabase của bạn tại <b><a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">supabase.com</a></b> hoặc mở trực tiếp project.</li>
              <li>Chọn mục <b>SQL Editor</b> (ở menu bên trái, biểu tượng <span className="font-mono bg-slate-200 px-1 rounded">{"_>"}</span>).</li>
              <li>Nhấn <b>New Query</b>, dán đoạn mã vừa copy vào ô soạn thảo.</li>
              <li>Nhấn nút <b>Run</b> màu xanh lá cây ở góc dưới bên phải.</li>
              <li>Quay lại đây và nhấn nút <b>"Tôi đã chạy SQL, kiểm tra lại"</b> bên dưới.</li>
            </ol>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Xem trước SQL Script sẽ chạy:</span>
            <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-950 max-h-[180px] overflow-y-auto">
              <pre className="p-3 text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {INITIAL_SQL_SCRIPT}
              </pre>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-3 justify-end">
          <button
            onClick={() => {
              // Bypass checking for development or if the user is testing
              onValidated();
            }}
            className="px-4 py-2 hover:bg-slate-200 text-slate-600 font-medium text-xs rounded-xl transition-all cursor-pointer"
          >
            Bỏ qua (Dành cho Dev)
          </button>
          <button
            onClick={checkSetup}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-md hover:shadow-lg shadow-blue-500/15 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-spin-hover" />
            Tôi đã chạy SQL, kiểm tra lại
          </button>
        </div>
      </div>
    </div>
  );
}
