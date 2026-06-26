import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  DollarSign, 
  Boxes, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  todayRevenue: number;
  totalDebt: number;
  totalProductsInStock: number;
  totalCustomers: number;
  recentInvoices: any[];
  lowStockItems: any[];
  chartData: any[];
}

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    totalDebt: 0,
    totalProductsInStock: 0,
    totalCustomers: 0,
    recentInvoices: [],
    lowStockItems: [],
    chartData: []
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get today's range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // Fetch today's invoices
      const { data: todayInvoices, error: todayErr } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, debt_amount')
        .gte('sale_date', todayStr);

      if (todayErr) console.error(todayErr);

      const todayRevenue = todayInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      // 2. Fetch total customer debt
      const { data: allInvoices, error: invErr } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, debt_amount, customer_name_snapshot, sale_date, invoice_code, payment_status');

      if (invErr) console.error(invErr);

      const totalDebt = allInvoices?.reduce((sum, inv) => sum + Number(inv.debt_amount), 0) || 0;

      // 3. Fetch total stock quantity
      const { data: stockBatches, error: stockErr } = await supabase
        .from('inventory_batches')
        .select('quantity, color, size, product_id, unit_type, products(code)');

      if (stockErr) console.error(stockErr);

      const totalProductsInStock = stockBatches?.reduce((sum, batch) => sum + batch.quantity, 0) || 0;

      // 4. Fetch total customers
      const { count: customersCount, error: custErr } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      if (custErr) console.error(custErr);

      // 5. Get recent 5 invoices
      const recentInvoices = allInvoices
        ? [...allInvoices].sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()).slice(0, 5)
        : [];

      // 6. Calculate low stock items grouped by product and unit_type (nhóm size)
      const stockSummaryMap: { [key: string]: any } = {};
      stockBatches?.forEach(batch => {
        const prod = batch.products as any;
        if (!prod) return;
        const groupName = batch.unit_type || 'Tuỳ chọn';
        const key = `${prod.code}-${groupName}`;
        if (!stockSummaryMap[key]) {
          stockSummaryMap[key] = {
            code: prod.code,
            name: prod.code,
            unit_type: groupName,
            quantity: 0,
            hasLowStock: false
          };
        }
        stockSummaryMap[key].quantity += batch.quantity;
        if (batch.quantity <= 15) {
          stockSummaryMap[key].hasLowStock = true;
        }
      });

      const lowStockItems = Object.values(stockSummaryMap)
        .filter(item => item.hasLowStock)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 5);

      // 7. Format chart data for last 7 days
      const chartDataMap: { [key: string]: { date: string; revenue: number; debt: number } } = {};
      
      // Seed last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
        const key = d.toDateString();
        chartDataMap[key] = { date: dayLabel, revenue: 0, debt: 0 };
      }

      allInvoices?.forEach(inv => {
        const invDate = new Date(inv.sale_date);
        const key = invDate.toDateString();
        if (chartDataMap[key]) {
          chartDataMap[key].revenue += Number(inv.total_amount);
          chartDataMap[key].debt += Number(inv.debt_amount);
        }
      });

      const chartData = Object.keys(chartDataMap)
        .map(key => ({
          ...chartDataMap[key],
          timeValue: new Date(key).getTime()
        }))
        .sort((a, b) => a.timeValue - b.timeValue);

      setStats({
        todayRevenue,
        totalDebt,
        totalProductsInStock,
        totalCustomers: customersCount || 0,
        recentInvoices,
        lowStockItems,
        chartData
      });
    } catch (err) {
      console.error('Lỗi tính toán dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Setup realtime subscription
    const invoicesSub = supabase
      .channel('public:invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const stockSub = supabase
      .channel('public:inventory_batches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_batches' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invoicesSub);
      supabase.removeChannel(stockSub);
    };
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Tổng quan cửa hàng</h2>
          <p className="text-xs text-slate-500 mt-0.5">Báo cáo hoạt động và dữ liệu đồng bộ thời gian thực với Supabase</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Tải lại dữ liệu
        </button>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Today Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between group hover:border-blue-200 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 block">Doanh số hôm nay</span>
            <span className="text-xl font-bold text-slate-900 font-mono tracking-tight block">
              {formatCurrency(stats.todayRevenue)}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="h-3 w-3" />
              Trực tiếp từ hoá đơn
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Total Debt */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between group hover:border-red-200 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 block">Tổng nợ phải thu</span>
            <span className="text-xl font-bold text-red-600 font-mono tracking-tight block">
              {formatCurrency(stats.totalDebt)}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <ArrowDownRight className="h-3 w-3" />
              Công nợ khách hàng
            </span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-all">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Total Stock */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl border border-emerald-500 shadow-md flex items-center justify-between group hover:scale-[1.02] hover:shadow-emerald-500/10 transition-all text-white">
          <div className="space-y-2">
            <span className="text-xs font-bold text-emerald-100 block uppercase tracking-wider">Tổng sản phẩm tồn kho</span>
            <span className="text-xl font-extrabold text-white font-mono tracking-tight block">
              {stats.totalProductsInStock.toLocaleString('vi-VN')} <span className="text-xs text-emerald-100 font-sans font-normal">cái</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-100 bg-emerald-500/30 border border-emerald-400/20 px-2 py-0.5 rounded-full">
              Phân loại theo ri & size
            </span>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-100 rounded-xl group-hover:bg-white group-hover:text-emerald-700 transition-all">
            <Boxes className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Total Customers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between group hover:border-purple-200 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 block">Tổng số khách hàng</span>
            <span className="text-xl font-bold text-slate-900 font-mono tracking-tight block">
              {stats.totalCustomers.toLocaleString('vi-VN')} <span className="text-xs text-slate-400 font-sans font-normal">đối tác</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              Có hồ sơ & số điện thoại
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-900">Biểu đồ doanh thu 7 ngày gần đây</h3>
          <p className="text-xs text-slate-500 mt-0.5">So sánh tổng tiền hàng bán ra và công nợ ghi nhận hàng ngày</p>
        </div>
        <div className="h-[280px] w-full">
          {stats.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(val: any) => [formatCurrency(val), '']} 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '12px' }}
                />
                <Area type="monotone" name="Doanh thu" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" name="Công nợ mới" dataKey="debt" stroke="#dc2626" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDebt)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs">
              Chưa có dữ liệu giao dịch trong 7 ngày qua.
            </div>
          )}
        </div>
      </div>

      {/* Two Columns Grid: Recent invoices & Low Stock Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Recent Invoices */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hoá đơn vừa xuất</h3>
              <p className="text-xs text-slate-500">Các đơn hàng mới phát sinh gần nhất</p>
            </div>
            <button 
              onClick={() => setActiveTab('today_invoices')}
              className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {stats.recentInvoices.length > 0 ? (
              stats.recentInvoices.map((inv, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-slate-800">{inv.invoice_code}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-600">{inv.customer_name_snapshot}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(inv.sale_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="font-mono font-bold text-slate-900 block">{formatCurrency(inv.total_amount)}</span>
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      inv.payment_status === 'đã thu' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : inv.payment_status === 'thu một phần'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {inv.payment_status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Chưa có hoá đơn nào được tạo.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Low Stock Warnings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Cảnh báo sắp hết hàng
              </h3>
              <p className="text-xs text-slate-500">Các mặt hàng theo mã hàng và nhóm size có lượng tồn ít (≤ 15 cái)</p>
            </div>
            <button 
              onClick={() => setActiveTab('inventory')}
              className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Kiểm tra kho
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {stats.lowStockItems.length > 0 ? (
              stats.lowStockItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg font-black text-[11px] border border-indigo-100 shadow-3xs">
                      {item.code}
                    </span>
                    <span className="text-slate-400 font-medium text-[11px]">•</span>
                    <span className="font-bold text-slate-700 bg-amber-50 text-amber-800 border border-amber-200/50 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide">
                      {item.unit_type || 'Tuỳ chọn'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-lg text-[11px]">
                      Tồn: {item.quantity} cái
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Tuyệt vời! Kho hàng của bạn có lượng tồn dồi dào trên mọi phân loại size/màu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
