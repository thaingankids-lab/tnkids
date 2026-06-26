import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Invoice } from '../types';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  DollarSign, 
  ShoppingBag,
  Loader2,
  Lock
} from 'lucide-react';

interface TrackingViewProps {
  token: string;
}

export default function TrackingView({ token }: TrackingViewProps) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackingData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch customer by tracking_token
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('tracking_token', token)
        .maybeSingle();

      if (custErr) throw custErr;
      if (!custData) {
        setError('Mã token theo dõi không hợp lệ hoặc đã bị xoá. Vui lòng liên hệ chủ cửa hàng.');
        return;
      }

      setCustomer(custData);

      // 2. Fetch customer invoices
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (
            *
          )
        `)
        .eq('customer_id', custData.id)
        .order('sale_date', { ascending: false });

      if (invErr) throw invErr;
      setInvoices((invData || []) as any);
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu tracking:', err.message);
      setError('Đã xảy ra sự cố khi đồng bộ thông tin từ Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTrackingData();
    }
  }, [token]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Đang kết nối cổng thông tin Supabase thời gian thực...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-sm w-full text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Liên kết không hợp lệ</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{error || 'Không tìm thấy thông tin khách hàng.'}</p>
        </div>
      </div>
    );
  }

  // Aggregate stats
  const totalPurchased = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
  const totalDebt = invoices.reduce((sum, inv) => sum + Number(inv.debt_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 pb-12">
      {/* Upper Brand / Safe Indicator */}
      <div className="bg-slate-900 text-white py-8 px-4 border-b border-slate-800 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mx-auto">
            <Lock className="h-3 w-3" /> Cổng thông tin khách hàng (Chỉ đọc)
          </div>
          <h1 className="text-xl font-bold tracking-tight">KHO SỈ QUẦN ÁO THỜI TRANG</h1>
          <p className="text-xs text-slate-400">Xem trực tuyến doanh số, công nợ gối đầu và trạng thái phiếu giao hàng</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Welcome customer card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Xin chào đối tác:</span>
          <h2 className="text-base font-bold text-slate-900">{customer.name}</h2>
          {customer.phone && (
            <p className="text-xs text-slate-500 font-medium">SĐT liên kết: <span className="font-mono font-bold text-slate-700">{customer.phone}</span></p>
          )}
          {customer.address && (
            <p className="text-xs text-slate-400">Đ/C giao nhận sỉ: {customer.address}</p>
          )}
        </div>

        {/* Stats Grid Dashboard */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center space-y-1 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Tổng tiền sỉ</span>
            <span className="font-mono font-black text-slate-900 text-xs sm:text-sm block">{formatCurrency(totalPurchased)}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center space-y-1 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase text-emerald-600">Đã thanh toán</span>
            <span className="font-mono font-black text-emerald-600 text-xs sm:text-sm block">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center space-y-1 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 block uppercase text-red-500">Nợ gối còn lại</span>
            <span className="font-mono font-black text-red-600 text-xs sm:text-sm block">{formatCurrency(totalDebt)}</span>
          </div>
        </div>

        {/* Invoices List for tracking */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <FileText className="h-4.5 w-4.5 text-blue-600" /> Nhật ký phiếu giao nhận hàng
          </h3>

          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map(inv => {
                const items = inv.items || [];
                const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

                return (
                  <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-3.5">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-mono font-black text-slate-900 text-xs">{inv.invoice_code}</span>
                        <span className="text-[10px] text-slate-400 block">
                          Ngày lập phiếu: {new Date(inv.sale_date).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                        inv.payment_status === 'đã thu' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : inv.payment_status === 'thu một phần'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}>
                        {inv.payment_status.toUpperCase()}
                      </span>
                    </div>

                    {/* Table contents of invoice */}
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                      <div className="divide-y divide-slate-100 text-[11px] p-2.5 space-y-2">
                        {inv.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-start pt-1.5 first:pt-0">
                            <div>
                              <span className="font-bold text-slate-800 block">{item.product_name}</span>
                              <span className="text-[10px] text-slate-400 block">
                                Phân loại: Màu {item.color} - Size {item.size} ({item.unit_type})
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-700 block font-mono">{item.quantity} cái</span>
                              <span className="text-[10px] text-slate-400 font-mono">@{formatCurrency(item.unit_price)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals math */}
                    <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-slate-100 text-slate-500">
                      <span>Cộng tiền đơn:</span>
                      <span className="font-mono font-bold text-slate-950 text-sm">{formatCurrency(inv.total_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-8 text-center rounded-2xl border border-slate-100">
              <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs">Bạn chưa có đơn hàng nào tại xưởng.</p>
            </div>
          )}
        </div>

        {/* Footer help */}
        <div className="text-center text-[10px] text-slate-400 pt-6">
          <p>Mọi thắc mắc về số liệu vui lòng liên hệ chủ cửa hàng sỉ.</p>
          <p className="mt-1 font-mono">Supabase Realtime Sync v1.2</p>
        </div>

      </div>
    </div>
  );
}
