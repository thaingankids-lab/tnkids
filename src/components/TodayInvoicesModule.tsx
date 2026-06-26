import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { 
  History, 
  Search, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Printer, 
  Loader2, 
  AlertTriangle, 
  RefreshCw,
  Eye
} from 'lucide-react';

export default function TodayInvoicesModule() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected invoice for detail view modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Deep edit invoice items states
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [tempItems, setTempItems] = useState<any[]>([]);
  const [tempPaid, setTempPaid] = useState<number>(0);
  const [tempNote, setTempNote] = useState<string>('');

  const handleStartDeepEdit = () => {
    if (!selectedInvoice) return;
    setIsEditingItems(true);
    setTempItems(selectedInvoice.invoice_items.map((it: any) => ({ ...it })));
    setTempPaid(selectedInvoice.paid_amount);
    setTempNote(selectedInvoice.note || '');
  };

  const handleDeepEditQtyChange = (itemId: string, newQty: number) => {
    setTempItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const qty = Math.max(1, newQty);
        return {
          ...it,
          quantity: qty,
          subtotal: qty * it.unit_price
        };
      }
      return it;
    }));
  };

  const handleDeepEditPriceChange = (itemId: string, newPrice: number) => {
    setTempItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const price = Math.max(0, newPrice);
        return {
          ...it,
          unit_price: price,
          subtotal: it.quantity * price
        };
      }
      return it;
    }));
  };

  const handleDeepEditRemoveItem = (itemId: string) => {
    setTempItems(prev => prev.filter(it => it.id !== itemId));
  };

  const handleSaveDeepEdit = async () => {
    if (!selectedInvoice) return;
    setActionLoading(true);
    try {
      // 1. Validate increased quantities against available stock
      const originalItems = selectedInvoice.invoice_items || [];

      for (const tempItem of tempItems) {
        const orig = originalItems.find((it: any) => it.id === tempItem.id);
        const origQty = orig ? orig.quantity : 0;
        const diff = tempItem.quantity - origQty;

        if (diff > 0) {
          const { data: matchedBatches } = await supabase
            .from('inventory_batches')
            .select('id, quantity')
            .eq('product_id', tempItem.product_id)
            .eq('color', tempItem.color)
            .eq('size', tempItem.size)
            .eq('unit_type', tempItem.unit_type);

          const availableStock = matchedBatches && matchedBatches.length > 0 ? matchedBatches[0].quantity : 0;
          if (availableStock < diff) {
            throw new Error(`Không đủ tồn kho cho sản phẩm ${tempItem.product_code} - Màu ${tempItem.color} - Size ${tempItem.size}. Cần thêm ${diff} cái, nhưng trong kho chỉ còn ${availableStock} cái.`);
          }
        }
      }

      // 2. Adjust stock in inventory_batches
      for (const tempItem of tempItems) {
        const orig = originalItems.find((it: any) => it.id === tempItem.id);
        const origQty = orig ? orig.quantity : 0;
        const diff = tempItem.quantity - origQty;

        if (diff !== 0) {
          const { data: matchedBatches } = await supabase
            .from('inventory_batches')
            .select('id, quantity')
            .eq('product_id', tempItem.product_id)
            .eq('color', tempItem.color)
            .eq('size', tempItem.size)
            .eq('unit_type', tempItem.unit_type);

          if (matchedBatches && matchedBatches.length > 0) {
            const batch = matchedBatches[0];
            const newStockQty = batch.quantity - diff;
            await supabase
              .from('inventory_batches')
              .update({ quantity: Math.max(0, newStockQty) })
              .eq('id', batch.id);
          } else if (diff < 0) {
            await supabase
              .from('inventory_batches')
              .insert({
                product_id: tempItem.product_id,
                product_code: tempItem.product_code,
                color: tempItem.color,
                size: tempItem.size,
                quantity: -diff,
                unit_type: tempItem.unit_type,
                note: `Hoàn kho tự động từ việc giảm số lượng của hoá đơn ${selectedInvoice.invoice_code}`
              });
          }
        }
      }

      // Handle completely removed items
      const removedItems = originalItems.filter((orig: any) => !tempItems.some(temp => temp.id === orig.id));
      for (const removed of removedItems) {
        const { data: matchedBatches } = await supabase
          .from('inventory_batches')
          .select('id, quantity')
          .eq('product_id', removed.product_id)
          .eq('color', removed.color)
          .eq('size', removed.size)
          .eq('unit_type', removed.unit_type);

        if (matchedBatches && matchedBatches.length > 0) {
          const batch = matchedBatches[0];
          await supabase
            .from('inventory_batches')
            .update({ quantity: batch.quantity + removed.quantity })
            .eq('id', batch.id);
        } else {
          await supabase
            .from('inventory_batches')
            .insert({
              product_id: removed.product_id,
              product_code: removed.product_code,
              color: removed.color,
              size: removed.size,
              quantity: removed.quantity,
              unit_type: removed.unit_type,
              note: `Hoàn kho tự động từ việc xoá dòng hàng của hoá đơn ${selectedInvoice.invoice_code}`
            });
        }

        await supabase
          .from('invoice_items')
          .delete()
          .eq('id', removed.id);
      }

      if (tempItems.length === 0) {
        await supabase
          .from('invoices')
          .delete()
          .eq('id', selectedInvoice.id);

        await supabase
          .from('payments')
          .delete()
          .eq('invoice_id', selectedInvoice.id);

        showToast(`Đã xoá hoàn toàn hoá đơn ${selectedInvoice.invoice_code} do không còn mặt hàng nào.`, 'success');
        setSelectedInvoice(null);
        setIsEditingItems(false);
        fetchInvoices();
        return;
      }

      // 3. Save modified items back
      for (const tempItem of tempItems) {
        await supabase
          .from('invoice_items')
          .update({
            quantity: tempItem.quantity,
            unit_price: tempItem.unit_price,
            subtotal: tempItem.subtotal
          })
          .eq('id', tempItem.id);
      }

      // 4. Recalculate totals
      const newTotalAmount = tempItems.reduce((sum, it) => sum + it.subtotal, 0);
      const newDebtAmount = Math.max(0, newTotalAmount - tempPaid);
      let status = 'chưa thu';
      if (tempPaid >= newTotalAmount) {
        status = 'đã thu';
      } else if (tempPaid > 0) {
        status = 'thu một phần';
      }

      const { error: invUpdateErr } = await supabase
        .from('invoices')
        .update({
          total_amount: newTotalAmount,
          paid_amount: tempPaid,
          debt_amount: newDebtAmount,
          payment_status: status,
          note: tempNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInvoice.id);

      if (invUpdateErr) throw invUpdateErr;

      if (selectedInvoice.customer_id) {
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('id')
          .eq('invoice_id', selectedInvoice.id);

        if (existingPayments && existingPayments.length > 0) {
          await supabase
            .from('payments')
            .update({
              amount: tempPaid,
              note: `Cập nhật thanh toán chỉnh sửa cho hoá đơn ${selectedInvoice.invoice_code}`
            })
            .eq('id', existingPayments[0].id);
        } else if (tempPaid > 0) {
          await supabase
            .from('payments')
            .insert({
              customer_id: selectedInvoice.customer_id,
              invoice_id: selectedInvoice.id,
              amount: tempPaid,
              payment_date: new Date().toISOString(),
              note: `Thanh toán mới khi chỉnh sửa hoá đơn ${selectedInvoice.invoice_code}`
            });
        }
      }

      showToast(`Đã cập nhật chi tiết hoá đơn ${selectedInvoice.invoice_code} thành công.`, 'success');

      const updatedInvoice = {
        ...selectedInvoice,
        total_amount: newTotalAmount,
        paid_amount: tempPaid,
        debt_amount: newDebtAmount,
        payment_status: status,
        note: tempNote,
        invoice_items: tempItems
      };
      setSelectedInvoice(updatedInvoice);
      setIsEditingItems(false);
      fetchInvoices();
    } catch (err: any) {
      showToast('Lỗi khi cập nhật chi tiết hoá đơn: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Editing invoice state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);

  // Custom Deletion Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    invoice: any | null;
  }>({
    isOpen: false,
    invoice: null
  });

  // Custom Toast Notification State
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

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // Fetch today's invoices with their items and customer details
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (
            *
          )
        `)
        .gte('sale_date', todayStr)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      setInvoices((data || []) as any);
    } catch (err: any) {
      console.error('Lỗi tải hoá đơn hôm nay:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();

    // Setup realtime subscription
    const invoicesSub = supabase
      .channel('public:invoices_today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchInvoices();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_items' }, () => {
        fetchInvoices();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchInvoices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invoicesSub);
    };
  }, []);

  const handleStartEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditPaidAmount(inv.paid_amount);
  };

  const handleSaveEdit = async (inv: Invoice) => {
    setActionLoading(true);
    try {
      const totalAmount = inv.total_amount;
      const newPaid = editPaidAmount;
      const newDebt = totalAmount - newPaid;

      let status = 'chưa thu';
      if (newPaid >= totalAmount) {
        status = 'đã thu';
      } else if (newPaid > 0) {
        status = 'thu một phần';
      }

      // Update invoice
      const { error: updateErr } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaid,
          debt_amount: newDebt >= 0 ? newDebt : 0,
          payment_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', inv.id);

      if (updateErr) throw updateErr;

      // Update payments table (adjust or insert a payment adjustment)
      if (inv.customer_id) {
        // Find existing payments for this invoice
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('id')
          .eq('invoice_id', inv.id);

        if (existingPayments && existingPayments.length > 0) {
          // Adjust first payment or update total amount
          await supabase
            .from('payments')
            .update({
              amount: newPaid,
              note: `Cập nhật thanh toán cho hoá đơn ${inv.invoice_code}`
            })
            .eq('id', existingPayments[0].id);
        } else if (newPaid > 0) {
          // Create a new payment record if none existed before
          await supabase
            .from('payments')
            .insert({
              customer_id: inv.customer_id,
              invoice_id: inv.id,
              amount: newPaid,
              payment_date: new Date().toISOString(),
              note: `Thanh toán mới cho hoá đơn ${inv.invoice_code}`
            });
        }
      }

      setEditingId(null);
      showToast(`Đã cập nhật thanh toán hoá đơn ${inv.invoice_code} thành công.`, 'success');
      fetchInvoices();
    } catch (err: any) {
      showToast('Không thể cập nhật hoá đơn: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInvoiceClick = (inv: any) => {
    setConfirmDelete({
      isOpen: true,
      invoice: inv
    });
  };

  const executeDeleteInvoice = async () => {
    const inv = confirmDelete.invoice;
    if (!inv) return;

    setActionLoading(true);
    try {
      const items = inv.invoice_items || [];

      // 1. Return stock to inventory_batches
      for (const item of items) {
        // Find exact matching inventory batch
        const { data: matchedBatches } = await supabase
          .from('inventory_batches')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('color', item.color)
          .eq('size', item.size)
          .eq('unit_type', item.unit_type);

        if (matchedBatches && matchedBatches.length > 0) {
          // Update existing batch
          const batch = matchedBatches[0];
          await supabase
            .from('inventory_batches')
            .update({ quantity: batch.quantity + item.quantity })
            .eq('id', batch.id);
        } else {
          // Re-create the deleted batch
          await supabase
            .from('inventory_batches')
            .insert({
              product_id: item.product_id,
              product_code: item.product_code,
              color: item.color,
              size: item.size,
              quantity: item.quantity,
              unit_type: item.unit_type,
              note: `Hoàn kho tự động từ việc xoá hoá đơn ${inv.invoice_code}`
            });
        }
      }

      // 1.5 Delete invoice_items first to ensure no constraint blocks
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', inv.id);

      // 2. Delete invoice
      const { error: delErr } = await supabase
        .from('invoices')
        .delete()
        .eq('id', inv.id);

      if (delErr) throw delErr;

      // 3. Delete payments linked to this invoice
      await supabase
        .from('payments')
        .delete()
        .eq('invoice_id', inv.id);

      showToast(`Đã xoá thành công hoá đơn ${inv.invoice_code} và hoàn trả số lượng hàng hoá vào kho.`, 'success');
      setConfirmDelete({ isOpen: false, invoice: null });
      fetchInvoices();
    } catch (err: any) {
      showToast('Lỗi khi xoá hoá đơn: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const codeMatch = inv.invoice_code.toLowerCase().includes(searchQuery.toLowerCase());
      const nameMatch = inv.customer_name_snapshot.toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = inv.customer_phone_snapshot?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      return codeMatch || nameMatch || phoneMatch;
    });
  }, [invoices, searchQuery]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Hoá đơn bán trong ngày</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tổng hợp toàn bộ các đơn hàng sỉ lẻ được tạo ra trong ngày hôm nay</p>
        </div>
        <button
          onClick={fetchInvoices}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tải lại danh sách
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md bg-white p-2 rounded-2xl border border-slate-100 shadow-xs">
        <Search className="absolute left-5 top-5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm mã hoá đơn, tên khách, số điện thoại..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white focus:outline-none border border-slate-200 focus:border-blue-500 text-xs font-semibold rounded-xl"
        />
      </div>

      {/* Invoices List Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Đang quét hoá đơn phát sinh hôm nay...</p>
        </div>
      ) : filteredInvoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredInvoices.map(inv => {
            const isEditing = editingId === inv.id;
            const items = (inv as any).invoice_items || [];
            const totalQty = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

            return (
              <div 
                key={inv.id} 
                className={`bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-slate-200 transition-all p-5 flex flex-col justify-between space-y-4 relative ${
                  inv.payment_status === 'đã thu' 
                    ? 'border-l-4 border-l-emerald-500' 
                    : inv.payment_status === 'thu một phần'
                      ? 'border-l-4 border-l-amber-500'
                      : 'border-l-4 border-l-red-500'
                }`}
              >
                {/* Upper part */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="font-mono font-black text-slate-900 text-xs">
                        {inv.invoice_code}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {new Date(inv.sale_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      inv.payment_status === 'đã thu' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : inv.payment_status === 'thu một phần'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {inv.payment_status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p><span className="text-slate-400">Khách:</span> <b className="text-slate-800">{inv.customer_name_snapshot}</b></p>
                    {inv.customer_phone_snapshot && (
                      <p><span className="text-slate-400">SĐT:</span> <span className="font-mono text-slate-600 font-medium">{inv.customer_phone_snapshot}</span></p>
                    )}
                    <p><span className="text-slate-400">Sản phẩm:</span> <span className="font-semibold text-slate-700">{totalQty} cái sỉ</span></p>
                  </div>
                </div>

                {/* Math breakdown / input values */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/60 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Tổng trị giá đơn:</span>
                    <span className="font-mono font-bold text-slate-950">{formatCurrency(inv.total_amount)}</span>
                  </div>

                  <div className="flex justify-between text-slate-500 items-center">
                    <span>Đã thu tiền:</span>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editPaidAmount}
                        onChange={(e) => setEditPaidAmount(parseInt(e.target.value, 10) || 0)}
                        className="w-24 bg-white border border-blue-500 rounded px-1.5 py-0.5 text-right font-mono font-bold text-slate-900"
                      />
                    ) : (
                      <span className="font-mono font-bold text-emerald-600">{formatCurrency(inv.paid_amount)}</span>
                    )}
                  </div>

                  <div className="flex justify-between font-bold border-t border-slate-200/60 pt-1.5 text-red-600">
                    <span>Ghi sổ nợ:</span>
                    <span className="font-mono">{formatCurrency(inv.debt_amount)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="pt-2 flex justify-between gap-1 border-t border-slate-100">
                  {isEditing ? (
                    <div className="flex gap-1.5 ml-auto">
                      <button
                        onClick={() => handleSaveEdit(inv)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" /> Lưu lại
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Huỷ
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold cursor-pointer"
                        title="Xem chi tiết phiếu in"
                      >
                        <Eye className="h-3.5 w-3.5" /> Chi tiết
                      </button>

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStartEdit(inv)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                          title="Sửa thanh toán"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoiceClick(inv)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                          title="Xoá đơn hoàn kho"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white py-24 text-center rounded-2xl border border-slate-100">
          <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">Hôm nay chưa có giao dịch nào phát sinh</p>
          <p className="text-xs text-slate-400 mt-1">Sử dụng tab "Xuất hoá đơn" để xuất phiếu giao hàng đầu tiên cho ngày hôm nay.</p>
        </div>
      )}

      {/* DETAIL INVOICE DIALOG MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 border border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between items-center no-print">
              <span className="font-bold text-sm text-slate-800">
                {isEditingItems ? 'Chỉnh sửa chi tiết đơn hàng' : 'Mẫu in phiếu giao hàng chi tiết'}
              </span>
              <div className="flex gap-2">
                {!isEditingItems ? (
                  <>
                    <button
                      onClick={handleStartDeepEdit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Sửa chi tiết đơn
                    </button>
                    <button
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" /> In phiếu
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveDeepEdit}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Lưu thay đổi
                    </button>
                    <button
                      onClick={() => setIsEditingItems(false)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-500 hover:bg-slate-600 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" /> Huỷ bỏ
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedInvoice(null);
                    setIsEditingItems(false);
                  }}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
 
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {isEditingItems ? (
                <div className="space-y-6 animate-fade-in text-xs">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="font-bold text-slate-800 text-sm">Chỉnh sửa chi tiết mặt hàng bán</h3>
                    <p className="text-[11px] text-slate-500">
                      Sửa số lượng và đơn giá của các mặt hàng bên dưới. Khi lưu, hệ thống sẽ tự động đối soát, kiểm tra tồn kho và điều chỉnh lại số lượng trong kho tương ứng.
                    </p>
                  </div>

                  {/* Editable Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-left">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="border border-slate-200 p-2 font-bold text-center w-10">STT</th>
                          <th className="border border-slate-200 p-2 font-bold">Tên hàng hoá / Chi tiết phân loại</th>
                          <th className="border border-slate-200 p-2 font-bold text-center w-24">Số lượng</th>
                          <th className="border border-slate-200 p-2 font-bold text-right w-32">Đơn giá (đ)</th>
                          <th className="border border-slate-200 p-2 font-bold text-right w-28">Thành tiền</th>
                          <th className="border border-slate-200 p-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tempItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="border border-slate-200 p-2 text-center font-mono">{idx + 1}</td>
                            <td className="border border-slate-200 p-2">
                              <span className="font-semibold text-slate-800 block">{item.product_name || item.product_code}</span>
                              <span className="font-mono text-[10px] text-slate-500">
                                Màu: {item.color} - Size: {item.size} ({item.unit_type})
                              </span>
                            </td>
                            <td className="border border-slate-200 p-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleDeepEditQtyChange(item.id, parseInt(e.target.value, 10) || 1)}
                                className="w-16 px-1.5 py-1 border border-slate-300 rounded font-bold text-center font-mono focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="border border-slate-200 p-2">
                              <input
                                type="number"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) => handleDeepEditPriceChange(item.id, parseInt(e.target.value, 10) || 0)}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded font-bold text-right font-mono focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="border border-slate-200 p-2 text-right font-mono font-bold text-slate-700">
                              {formatCurrency(item.subtotal)}
                            </td>
                            <td className="border border-slate-200 p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeepEditRemoveItem(item.id)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer transition-colors"
                                title="Xoá dòng hàng này"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {tempItems.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                              Không còn mặt hàng nào trong đơn. Bấm Lưu để xoá hoá đơn.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals & Paid Adjustments */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú đơn hàng:</label>
                        <textarea
                          rows={2}
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          placeholder="Ví dụ: Khách sỉ đặt gối đầu..."
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium focus:outline-none focus:border-blue-500 text-xs"
                        />
                      </div>
                    </div>

                    <div className="w-full md:w-80 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-600">Tổng cộng tiền hàng:</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          {formatCurrency(tempItems.reduce((sum, it) => sum + it.subtotal, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-600">Đã thu của khách (đ):</span>
                        <input
                          type="number"
                          min="0"
                          value={tempPaid}
                          onChange={(e) => setTempPaid(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-36 px-2 py-1 border border-slate-300 rounded font-bold text-right font-mono focus:outline-none focus:border-blue-500 text-xs"
                        />
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-red-600 font-bold">
                        <span>Tổng nợ mới gối đầu:</span>
                        <span className="font-mono text-sm">
                          {formatCurrency(Math.max(0, tempItems.reduce((sum, it) => sum + it.subtotal, 0) - tempPaid))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingItems(false)}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 font-bold rounded-xl cursor-pointer"
                    >
                      Huỷ bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDeepEdit}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Xác nhận lưu
                    </button>
                  </div>
                </div>
              ) : (
                /* Core Printable sheet */
                <div id="print-area" className="bg-white text-slate-900 p-4 text-xs leading-relaxed font-sans border border-slate-300">
                  <div className="text-center space-y-1 mb-6">
                    <h1 className="text-lg font-bold uppercase tracking-wider">PHIẾU GIAO HÀNG</h1>
                    <p className="font-mono font-semibold text-slate-600 text-[10px]">Mã đơn: {selectedInvoice.invoice_code}</p>
                    <p className="text-slate-500 text-[10px]">Ngày bán: {new Date(selectedInvoice.sale_date).toLocaleString('vi-VN')}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6 border-b border-slate-200 pb-4">
                    <div className="space-y-1">
                      <p><span className="text-slate-500">Khách hàng:</span> <b className="text-slate-900">{selectedInvoice.customer_name_snapshot}</b></p>
                      <p><span className="text-slate-500">Điện thoại:</span> <span className="font-mono font-medium">{selectedInvoice.customer_phone_snapshot || 'N/A'}</span></p>
                      <p><span className="text-slate-500">Địa chỉ:</span> <span>{selectedInvoice.customer_address_snapshot || 'N/A'}</span></p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p><span className="text-slate-500">Đơn vị bán hàng:</span> <b>XƯỞNG SỈ THỜI TRANG</b></p>
                      <p><span className="text-slate-500">Địa chỉ:</span> <span>Kho hàng sỉ toàn quốc</span></p>
                      <p><span className="text-slate-500">Ghi chú:</span> <span className="italic text-slate-600">{selectedInvoice.note || 'N/A'}</span></p>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full border-collapse border border-slate-400 text-left mb-6">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-400">
                        <th className="border border-slate-400 p-2 font-bold text-center w-10">STT</th>
                        <th className="border border-slate-400 p-2 font-bold">Tên hàng hoá</th>
                        <th className="border border-slate-400 p-2 font-bold text-center w-14">ĐVT</th>
                        <th className="border border-slate-400 p-2 font-bold text-center w-14">SL</th>
                        <th className="border border-slate-400 p-2 font-bold text-right w-24">Đơn giá</th>
                        <th className="border border-slate-400 p-2 font-bold text-right w-28">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.invoice_items || []).map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="border border-slate-400 p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-400 p-2 font-medium">
                            {item.product_name} 
                            <span className="font-mono text-[10px] text-slate-500 ml-1">
                              ({item.product_code} - Màu {item.color} - Size {item.size})
                            </span>
                          </td>
                          <td className="border border-slate-400 p-2 text-center text-slate-600">{item.unit_type}</td>
                          <td className="border border-slate-400 p-2 text-center font-mono font-bold">{item.quantity}</td>
                          <td className="border border-slate-400 p-2 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                          <td className="border border-slate-400 p-2 text-right font-mono font-bold">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Calculations */}
                  <div className="w-fit ml-auto min-w-[280px] space-y-1.5 border-t border-slate-300 pt-3 mb-8 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cộng tiền hàng:</span>
                      <span className="font-mono font-bold">{formatCurrency(selectedInvoice.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Đã thu khách hàng:</span>
                      <span className="font-mono">{formatCurrency(selectedInvoice.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 text-red-600">
                      <span>Tổng nợ cũ / Nợ gối đầu:</span>
                      <span className="font-mono">{formatCurrency(selectedInvoice.debt_amount)}</span>
                    </div>
                  </div>

                  {/* Sign areas */}
                  <div className="grid grid-cols-2 text-center mt-12 mb-6">
                    <div className="space-y-16">
                      <p className="font-semibold uppercase text-slate-700">NGƯỜI MUA HÀNG</p>
                      <p className="text-slate-400 italic text-[10px]">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div className="space-y-16">
                      <p className="font-semibold uppercase text-slate-700">NGƯỜI BÁN HÀNG</p>
                      <p className="text-slate-400 italic text-[10px]">(Ký, ghi rõ họ tên)</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Deletion Confirmation Modal */}
      {confirmDelete.isOpen && confirmDelete.invoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-50 flex items-center gap-3 bg-red-50 text-red-700">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base">Xác nhận xoá hoá đơn</h3>
            </div>
            
            <div className="p-6 space-y-3">
              <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                Bạn có chắc chắn muốn xoá hoá đơn <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-red-600">{confirmDelete.invoice.invoice_code}</span>?
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hệ thống sẽ tự động hoàn trả lại tồn kho <span className="font-mono font-bold text-slate-700">({confirmDelete.invoice.invoice_items?.reduce((sum: number, i: any) => sum + i.quantity, 0)} cái)</span> về lại các phân loại sỉ tương ứng.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete({ isOpen: false, invoice: null })}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteInvoice}
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
