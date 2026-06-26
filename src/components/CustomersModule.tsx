import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Invoice, Payment } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  DollarSign, 
  Link, 
  Loader2, 
  X, 
  Calendar, 
  Check, 
  FileText, 
  AlertCircle,
  Clock,
  ExternalLink,
  Copy
} from 'lucide-react';

export default function CustomersModule() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal / Detail states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const selectedCustomerRef = useRef<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Custom Deletion Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    customerId: string | null;
  }>({
    isOpen: false,
    customerId: null
  });

  // Custom Toast/Notification Banner State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | null;
  }>({
    message: '',
    type: null
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev.message === message ? { message: '', type: null } : prev);
    }, 4000);
  };

  // Payment creation form
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Customer Edit/Add Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [formCustomer, setFormCustomer] = useState<Partial<Customer> | null>(null);

  // Copy tracking link helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // 1. Fetch customers
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (custErr) throw custErr;
      
      const customersList = custData || [];

      // 2. Fetch all invoices to aggregate stats (total_purchased, total_paid, total_debt)
      const { data: invData } = await supabase
        .from('invoices')
        .select('customer_id, total_amount, paid_amount, debt_amount');

      // Create stats dictionary
      const statsMap: { [id: string]: { purchased: number; paid: number; debt: number } } = {};
      customersList.forEach(c => {
        statsMap[c.id] = { purchased: 0, paid: 0, debt: 0 };
      });

      invData?.forEach(inv => {
        if (inv.customer_id && statsMap[inv.customer_id]) {
          statsMap[inv.customer_id].purchased += Number(inv.total_amount);
          statsMap[inv.customer_id].paid += Number(inv.paid_amount);
          statsMap[inv.customer_id].debt += Number(inv.debt_amount);
        }
      });

      const processedCustomers = customersList.map(c => ({
        ...c,
        purchased: statsMap[c.id]?.purchased || 0,
        paid: statsMap[c.id]?.paid || 0,
        debt: statsMap[c.id]?.debt || 0
      }));

      setCustomers(processedCustomers as any);
    } catch (err: any) {
      console.error('Lỗi tải danh sách khách hàng:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();

    const channel = supabase
      .channel('public:customers_module')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchCustomers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchCustomers();
        if (selectedCustomerRef.current) handleOpenDetail(selectedCustomerRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchCustomers();
        if (selectedCustomerRef.current) handleOpenDetail(selectedCustomerRef.current);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  const handleOpenDetail = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setDetailLoading(true);
    try {
      // Fetch customer invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', cust.id)
        .order('sale_date', { ascending: false });

      setCustomerInvoices(invData || []);

      // Fetch customer payments
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', cust.id)
        .order('payment_date', { ascending: false });

      setCustomerPayments(payData || []);
    } catch (err) {
      console.error('Lỗi tải chi tiết khách hàng:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenAddForm = () => {
    setFormCustomer({
      name: '',
      phone: '',
      address: '',
      note: ''
    });
    setShowFormModal(true);
  };

  const handleOpenEditForm = (cust: Customer) => {
    setFormCustomer(cust);
    setShowFormModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomer?.name?.trim()) return;

    setActionLoading(true);
    try {
      if (formCustomer.id) {
        // Edit mode
        const { error } = await supabase
          .from('customers')
          .update({
            name: formCustomer.name.trim(),
            phone: formCustomer.phone?.trim() || null,
            address: formCustomer.address?.trim() || null,
            note: formCustomer.note?.trim() || '',
            updated_at: new Date().toISOString()
          })
          .eq('id', formCustomer.id);

        if (error) throw error;
        showToast('Đã cập nhật hồ sơ khách hàng thành công.', 'success');
      } else {
        // Add mode
        const token = `KH-${Math.floor(100000 + Math.random() * 900000)}`;
        const { error } = await supabase
          .from('customers')
          .insert({
            name: formCustomer.name.trim(),
            phone: formCustomer.phone?.trim() || null,
            address: formCustomer.address?.trim() || null,
            note: formCustomer.note?.trim() || '',
            tracking_token: token
          });

        if (error) throw error;
        showToast('Đã thêm khách hàng mới thành công.', 'success');
      }

      setShowFormModal(false);
      setFormCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      showToast('Có lỗi xảy ra: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCustomerClick = (id: string) => {
    setConfirmDelete({
      isOpen: true,
      customerId: id
    });
  };

  const executeDeleteCustomer = async () => {
    const id = confirmDelete.customerId;
    if (!id) return;

    setActionLoading(true);
    try {
      // 1. Fetch all invoices for this customer to find invoice_ids
      const { data: customerInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('customer_id', id);

      const invoiceIds = (customerInvoices || []).map(inv => inv.id);

      // 2. Delete invoice_items associated with these invoices
      if (invoiceIds.length > 0) {
        await supabase
          .from('invoice_items')
          .delete()
          .in('invoice_id', invoiceIds);
      }

      // 3. Delete payments associated with this customer
      await supabase
        .from('payments')
        .delete()
        .eq('customer_id', id);

      // 4. Delete invoices associated with this customer
      await supabase
        .from('invoices')
        .delete()
        .eq('customer_id', id);

      // 5. Delete customer row
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Đã xoá hồ sơ khách hàng và toàn bộ lịch sử hóa đơn, thanh toán liên quan thành công.', 'success');
      setConfirmDelete({ isOpen: false, customerId: null });
      fetchCustomers();
    } catch (err: any) {
      showToast('Không thể xoá khách hàng: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // SMART DEBT SETTLEMENT ALGORITHM (Gối đầu nợ thông minh)
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(paymentAmount, 10);
    if (!selectedCustomer || isNaN(amount) || amount <= 0) return;

    setActionLoading(true);
    try {
      // 1. Create Payment record
      const { error: payErr } = await supabase
        .from('payments')
        .insert({
          customer_id: selectedCustomer.id,
          amount: amount,
          payment_date: new Date().toISOString(),
          note: paymentNote.trim() || 'Thu nợ gối đầu định kỳ'
        });

      if (payErr) throw payErr;

      // 2. Fetch all unpaid invoices of this customer, ordered by oldest first
      const { data: unpaidInvoices, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', selectedCustomer.id)
        .gt('debt_amount', 0)
        .order('sale_date', { ascending: true });

      if (invErr) throw invErr;

      let remainingPayment = amount;

      if (unpaidInvoices && unpaidInvoices.length > 0) {
        for (const inv of unpaidInvoices) {
          if (remainingPayment <= 0) break;

          const currentDebt = inv.debt_amount;
          let newPaid = inv.paid_amount;
          let newDebt = currentDebt;
          let status = inv.payment_status;

          if (remainingPayment >= currentDebt) {
            // Deduct full debt of this invoice
            newPaid = inv.total_amount;
            newDebt = 0;
            status = 'đã thu';
            remainingPayment -= currentDebt;
          } else {
            // Deduct partial debt of this invoice
            newPaid += remainingPayment;
            newDebt -= remainingPayment;
            status = 'thu một phần';
            remainingPayment = 0;
          }

          // Update this invoice in Supabase
          const { error: updErr } = await supabase
            .from('invoices')
            .update({
              paid_amount: newPaid,
              debt_amount: newDebt,
              payment_status: status,
              updated_at: new Date().toISOString()
            })
            .eq('id', inv.id);

          if (updErr) console.error(`Lỗi khấu trừ nợ cho hoá đơn ${inv.invoice_code}:`, updErr.message);
        }
      }

      showToast(`Đã thu khoản nợ ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)} thành công! Đã tự động khấu trừ nợ gối đầu.`, 'success');
      
      // Reset payment form state
      setPaymentAmount('');
      setPaymentNote('');
      setShowPaymentModal(false);

      // Refresh detail views
      handleOpenDetail(selectedCustomer);
      fetchCustomers();
    } catch (err: any) {
      showToast('Có lỗi xảy ra khi thu nợ: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyTrackingLink = (cust: Customer) => {
    // Generate tracking full URL
    const appUrl = window.location.origin;
    const trackingUrl = `${appUrl}/tracking/${cust.tracking_token}`;
    
    navigator.clipboard.writeText(trackingUrl);
    setCopiedId(cust.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      return nameMatch || phoneMatch;
    });
  }, [customers, searchQuery]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quản lý khách hàng & Sổ nợ</h2>
          <p className="text-xs text-slate-500 mt-0.5">Quản lý lịch sử giao dịch sỉ lẻ, khấu trừ nợ gối đầu và tạo link tra cứu riêng biệt cho khách</p>
        </div>
        <button
          onClick={handleOpenAddForm}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg shadow-blue-500/15 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tạo hồ sơ khách mới
        </button>
      </div>

      {/* Filter and Search */}
      <div className="relative max-w-md bg-white p-2 rounded-2xl border border-slate-100 shadow-xs">
        <Search className="absolute left-5 top-5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm tên khách hàng, số điện thoại..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white focus:outline-none border border-slate-200 focus:border-blue-500 text-xs font-semibold rounded-xl"
        />
      </div>

      {/* Customers List Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Đang đồng bộ sổ nợ khách sỉ sài gòn và toàn quốc...</p>
        </div>
      ) : filteredCustomers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCustomers.map(cust => {
            const castObj = cust as any;
            return (
              <div key={cust.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                
                {/* Upper info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{cust.name}</h3>
                    <button
                      onClick={() => handleCopyTrackingLink(cust)}
                      className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-50 cursor-pointer flex items-center gap-1 transition-colors"
                      title="Copy link theo dõi cho khách"
                    >
                      {copiedId === cust.id ? (
                        <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                      ) : (
                        <Link className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500">
                    {cust.phone && <p>SĐT: <span className="font-mono font-bold text-slate-700">{cust.phone}</span></p>}
                    {cust.address && <p className="line-clamp-1">Địa chỉ: {cust.address}</p>}
                    {cust.note && <p className="italic text-[11px] text-slate-400 line-clamp-1">Ghi chú: {cust.note}</p>}
                  </div>
                </div>

                {/* Math values */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/60 grid grid-cols-3 gap-2 text-[10px] text-center">
                  <div>
                    <span className="text-slate-400 block font-medium">Đã lấy sỉ</span>
                    <span className="font-mono font-bold text-slate-800 block mt-0.5">{formatCurrency(castObj.purchased || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Đã thanh toán</span>
                    <span className="font-mono font-bold text-emerald-600 block mt-0.5">{formatCurrency(castObj.paid || 0)}</span>
                  </div>
                  <div className="border-l border-slate-200">
                    <span className="text-red-500 block font-bold">Còn nợ lại</span>
                    <span className="font-mono font-black text-red-600 block mt-0.5">{formatCurrency(castObj.debt || 0)}</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-between gap-1 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenDetail(cust)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" /> Lịch sử nợ
                  </button>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEditForm(cust)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                      title="Sửa hồ sơ"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomerClick(cust.id)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                      title="Xoá hồ sơ"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white py-24 text-center rounded-2xl border border-slate-100">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">Chưa có hồ sơ đối tác nào</p>
          <p className="text-xs text-slate-400 mt-1">Bấm nút "Tạo hồ sơ khách mới" ở góc trên để khởi động cuốn sổ nợ thời gian thực.</p>
        </div>
      )}

      {/* DETAIL CUSTOMER HISTORY MODAL DIALOG */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chi tiết công nợ & Lịch sử: {selectedCustomer.name}</h3>
                {selectedCustomer.phone && <p className="text-[10px] text-slate-400 font-mono mt-0.5">SĐT: {selectedCustomer.phone}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <DollarSign className="h-3.5 w-3.5" /> Thêm thu nợ gối đầu
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content list */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {detailLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin mx-auto" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left half: invoices list */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-blue-600" /> Tất cả các hoá đơn đã xuất
                    </h4>

                    {customerInvoices.length > 0 ? (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {customerInvoices.map(inv => (
                          <div key={inv.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="font-mono font-black text-slate-800 text-[11px]">{inv.invoice_code}</span>
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
                            <div className="grid grid-cols-3 text-[10px] text-slate-500">
                              <div>
                                <span>Mua:</span>
                                <p className="font-mono font-bold text-slate-800">{formatCurrency(inv.total_amount)}</p>
                              </div>
                              <div>
                                <span>Đã thu:</span>
                                <p className="font-mono font-bold text-slate-800">{formatCurrency(inv.paid_amount)}</p>
                              </div>
                              <div>
                                <span className="text-red-500 font-bold">Còn nợ:</span>
                                <p className="font-mono font-bold text-red-600">{formatCurrency(inv.debt_amount)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 italic">
                              <Calendar className="h-3 w-3" />
                              {new Date(inv.sale_date).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 py-6 text-center">Chưa có hoá đơn mua bán nào.</p>
                    )}
                  </div>

                  {/* Right half: Payment logs */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-emerald-600">
                      <Clock className="h-4 w-4" /> Lịch sử các lần nộp nợ gối đầu
                    </h4>

                    {customerPayments.length > 0 ? (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {customerPayments.map(pay => (
                          <div key={pay.id} className="p-3 rounded-xl border border-slate-100 bg-emerald-50/20 flex justify-between gap-4">
                            <div className="space-y-1">
                              <span className="font-mono font-bold text-emerald-700 block text-[11px]">+ {formatCurrency(pay.amount)}</span>
                              <p className="text-[10px] text-slate-500 italic">{pay.note}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="text-[9px] text-slate-400 font-mono block">
                                {new Date(pay.payment_date).toLocaleDateString('vi-VN')}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono block">
                                {new Date(pay.payment_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 py-6 text-center">Chưa có lần thu nợ nào được ghi nhận.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORM CUSTOMER MODAL (ADD / EDIT) */}
      {showFormModal && formCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveCustomer} className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 text-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between items-center">
              <span className="font-bold text-sm text-slate-800">
                {formCustomer.id ? 'Sửa thông tin đối tác' : 'Tạo hồ sơ khách hàng sỉ mới'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setFormCustomer(null);
                }}
                className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="font-semibold text-slate-600 block">Tên xưởng sỉ / Khách sỉ <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  required
                  value={formCustomer.name || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, name: e.target.value })}
                  placeholder="Ví dụ: Xưởng Sỉ Thu Trang SG"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-600 block">Số điện thoại liên lạc</span>
                <input
                  type="text"
                  value={formCustomer.phone || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, phone: e.target.value })}
                  placeholder="09xxx..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-600 block">Địa chỉ nhận hàng (Ví dụ: Chợ Tân Bình)</span>
                <input
                  type="text"
                  value={formCustomer.address || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, address: e.target.value })}
                  placeholder="Chợ sỉ Tân Bình, sạp 10..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-600 block">Ghi chú chung</span>
                <textarea
                  value={formCustomer.note || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, note: e.target.value })}
                  placeholder="Giao hàng chành xe Tô Châu, gửi xe Phương Trang..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setFormCustomer(null);
                }}
                className="px-4 py-2 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg cursor-pointer"
              >
                Huỷ bỏ
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu hồ sơ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FORM PAYMENTS (ADD BILL PAYMENT COLLECTION) */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddPayment} className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 text-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between items-center">
              <span className="font-bold text-sm text-slate-800">Khấu trừ nợ gối đầu: {selectedCustomer.name}</span>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500">Tổng dư nợ cũ hiện tại:</span>
                <span className="font-mono font-bold text-red-600 text-sm">{(selectedCustomer as any).debt ? formatCurrency((selectedCustomer as any).debt) : '0 đ'}</span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-600 block">Số tiền khách trả gối nợ (đ) <span className="text-red-500">*</span></span>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ví dụ: 3000000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-600 block">Ghi chú thu nợ</span>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Khách khoản khoản VCB chi nhánh quận 5..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg cursor-pointer"
              >
                Huỷ bỏ
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Xác nhận thu nợ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Deletion Confirmation Modal */}
      {confirmDelete.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-50 flex items-center gap-3 bg-red-50 text-red-700">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base">Xác nhận xoá khách hàng</h3>
            </div>
            
            <div className="p-6 space-y-3">
              <p className="text-xs font-bold text-red-600 leading-relaxed uppercase tracking-wider">
                CẢNH BÁO NGUY HIỂM!
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Xoá khách hàng sẽ giải phóng liên kết các hoá đơn cũ của khách hàng này thành <span className="font-semibold text-slate-800">"Khách vãng lai"</span>. Hành động này không thể khôi phục lại liên kết cũ. Bạn vẫn muốn tiếp tục?
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete({ isOpen: false, customerId: null })}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteCustomer}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors flex items-center gap-1"
              >
                {actionLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Portal Banner */}
      {toast.type && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-slide-up no-print">
          <div className={`p-4 rounded-2xl shadow-lg border flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-red-50 border-red-100 text-red-800'
          }`}>
            <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <Check className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold flex-1">{toast.message}</p>
            <button 
              onClick={() => setToast({ message: '', type: null })}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
