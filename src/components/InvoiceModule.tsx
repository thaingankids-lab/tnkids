import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Product, InventoryBatch } from '../types';
import PrintableDeliveryNote from './PrintableDeliveryNote';
import { 
  Plus, 
  Trash2, 
  Search, 
  UserPlus, 
  AlertTriangle, 
  Check, 
  Printer, 
  Save, 
  Loader2, 
  ChevronRight,
  ShoppingBag,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
import { downloadInvoiceExcel, downloadInvoicePdf } from '../lib/invoiceExport';

interface CartItem {
  id: string; // unique local cart item id
  product_id: string;
  product_code: string;
  product_name: string;
  color: string;
  size: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit_type: string; // 'Ri nhí', 'Ri đại', 'Tuỳ chọn'
  batch_id: string; // Reference to inventory_batches.id to subtract stock later
  available_qty: number;
}

interface CartGroup {
  key: string;
  product_code: string;
  product_name: string;
  color: string;
  unit_type: string;
  unit_price: number;
  sizes: string[];
  quantityPerSize: number | null;
  totalPieces: number;
  subtotal: number;
  itemIds: string[];
}

export default function InvoiceModule({ onInvoiceCreated }: { onInvoiceCreated?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockBatches, setStockBatches] = useState<InventoryBatch[]>([]);

  // Selected Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNote, setNewCustNote] = useState('');

  // Item selector state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'single' | 'ri_nhi' | 'ri_dai' | 'ri_set'>('single');
  const [riMultiplier, setRiMultiplier] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<string>('');

  // Size sets list from database for selecting whole Ri
  const [sizeSets, setSizeSets] = useState<any[]>([]);
  const [selectedSizeSetId, setSelectedSizeSetId] = useState<string | null>(null);

  // Custom sizes quantity inputs for selected product + color
  const [availableSizesForColor, setAvailableSizesForColor] = useState<{ size: string; quantity: number; batch_id: string; unit_type: string }[]>([]);
  const [sizeQuantities, setSizeQuantities] = useState<{ [size: string]: number }>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceNote, setInvoiceNote] = useState('');
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [paymentStatus, setPaymentStatus] = useState<string>('đã thu');

  // Success printing state
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);

  const findSizeSetByKeyword = (keywords: string[]) => {
    return sizeSets.find(set => {
      const name = String(set.name || '').toLocaleLowerCase('vi-VN');
      return keywords.some(keyword => name.includes(keyword));
    });
  };

  const getExpectedRiSizes = () => {
    if (entryMode === 'ri_nhi') {
      const riNhiSet = findSizeSetByKeyword(['nhí', 'nhi']);
      return riNhiSet?.sizes || ['3', '4', '5', '6', '7', '8', '9', '10'];
    }

    if (entryMode === 'ri_dai') {
      const riDaiSet = findSizeSetByKeyword(['đại', 'dai']);
      return riDaiSet?.sizes || ['11', '12', '13', '14', '15', '16'];
    }

    if (entryMode === 'ri_set' && selectedSizeSetId) {
      return sizeSets.find(set => set.id === selectedSizeSetId)?.sizes || [];
    }

    return [];
  };

  const fetchData = async () => {
    try {
      const [customersRes, productsRes, stockRes, sizeSetsRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('products').select('*').order('code'),
        supabase.from('inventory_batches').select('*').gt('quantity', 0),
        supabase.from('size_sets').select('*').order('name')
      ]);

      if (customersRes.error) throw customersRes.error;
      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (sizeSetsRes.error) throw sizeSetsRes.error;

      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
      setStockBatches((stockRes.data || []) as any);

      const activeSets = (sizeSetsRes.data || []).filter((s: any) => s.is_active !== false);
      setSizeSets(activeSets);
    } catch (err) {
      console.error('Lỗi fetch dữ liệu xuất hoá đơn:', err);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('public:invoice_form_data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_batches' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'size_sets' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // When selected product changes, find available colors in stock
  useEffect(() => {
    if (!selectedProductId) {
      setAvailableColors([]);
      setSelectedColor('');
      return;
    }

    const colorsInStock = Array.from(new Set(
      stockBatches
        .filter(b => b.product_id === selectedProductId)
        .map(b => b.color)
    ));
    setAvailableColors(colorsInStock);
    setSelectedColor(colorsInStock[0] || '');
  }, [selectedProductId, stockBatches]);

  // When color changes, find available sizes and quantities
  useEffect(() => {
    if (!selectedProductId || !selectedColor) {
      setAvailableSizesForColor([]);
      setSizeQuantities({});
      return;
    }

    const sizesInStock = stockBatches
      .filter(b => b.product_id === selectedProductId && b.color === selectedColor)
      .map(b => ({
        size: b.size,
        quantity: b.quantity,
        batch_id: b.id,
        unit_type: b.unit_type
      }));

    setAvailableSizesForColor(sizesInStock);

    // Reset inputs
    const initialQtys: { [size: string]: number } = {};
    sizesInStock.forEach(s => {
      initialQtys[s.size] = 0;
    });
    setSizeQuantities(initialQtys);
  }, [selectedColor, selectedProductId, stockBatches]);

  // Handle auto-fill based on Ri Nhí/Ri Đại or Custom Ri Set selection
  useEffect(() => {
    if (entryMode === 'single') {
      const resetQtys: { [size: string]: number } = {};
      availableSizesForColor.forEach(s => {
        resetQtys[s.size] = 0;
      });
      setSizeQuantities(resetQtys);
      return;
    }

    const newQtys = { ...sizeQuantities };

    if (entryMode === 'ri_set' && selectedSizeSetId) {
      const activeSet = sizeSets.find(s => s.id === selectedSizeSetId);
      if (activeSet) {
        availableSizesForColor.forEach(s => {
          const isPart = activeSet.sizes.some((sz: string) => sz.trim() === s.size.trim());
          newQtys[s.size] = isPart ? riMultiplier : 0;
        });
      }
    } else {
      availableSizesForColor.forEach(s => {
        if (entryMode === 'ri_nhi' && s.unit_type === 'Ri nhí') {
          newQtys[s.size] = riMultiplier;
        } else if (entryMode === 'ri_dai' && s.unit_type === 'Ri đại') {
          newQtys[s.size] = riMultiplier;
        } else {
          newQtys[s.size] = 0;
        }
      });
    }

    setSizeQuantities(newQtys);
  }, [entryMode, riMultiplier, selectedSizeSetId, availableSizesForColor, sizeSets]);

  const handleSizeQtyChange = (size: string, val: string) => {
    const qty = parseInt(val, 10) || 0;
    setSizeQuantities(prev => ({
      ...prev,
      [size]: qty >= 0 ? qty : 0
    }));
  };

  const selectedRiSummary = useMemo(() => {
    if (entryMode === 'single') return null;

    let label = 'Ri nhóm';
    let sizesInGroup = availableSizesForColor;

    if (entryMode === 'ri_nhi') {
      label = 'Ri nhí';
      sizesInGroup = availableSizesForColor.filter(size => size.unit_type === 'Ri nhí');
    } else if (entryMode === 'ri_dai') {
      label = 'Ri đại';
      sizesInGroup = availableSizesForColor.filter(size => size.unit_type === 'Ri đại');
    } else if (entryMode === 'ri_set' && selectedSizeSetId) {
      const activeSet = sizeSets.find(set => set.id === selectedSizeSetId);
      label = activeSet?.name || 'Ri nhóm';
      sizesInGroup = activeSet
        ? availableSizesForColor.filter(size => activeSet.sizes.some((setSize: string) => setSize.trim() === size.size.trim()))
        : [];
    }

    const sortedSizes = [...sizesInGroup].sort((a, b) => {
      const numA = parseInt(a.size, 10);
      const numB = parseInt(b.size, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.size.localeCompare(b.size);
    });

    const maxRi = sortedSizes.length > 0 ? Math.min(...sortedSizes.map(size => size.quantity)) : 0;
    const totalPieces = sortedSizes.length * riMultiplier;
    const price = parseInt(itemPrice, 10) || 0;

    return {
      label,
      sizes: sortedSizes,
      maxRi,
      totalPieces,
      estimatedTotal: totalPieces * price
    };
  }, [entryMode, selectedSizeSetId, availableSizesForColor, sizeSets, riMultiplier, itemPrice]);

  const addToCart = () => {
    const prod = products.find(p => p.id === selectedProductId);
    const price = parseInt(itemPrice, 10);

    if (!prod) return;
    if (isNaN(price) || price <= 0) {
      alert('Vui lòng nhập đơn giá hợp lệ > 0.');
      return;
    }

    // Missing sizes can be intentional (not produced), so only insufficient stocked sizes block the sale.
    if (entryMode !== 'single') {
      const expectedSizes = getExpectedRiSizes();
      const missingSizes: string[] = [];
      const insufficientSizes: { size: string; req: number; av: number }[] = [];

      expectedSizes.forEach((sz: string) => {
        const sizeTrimmed = sz.trim();
        const stockInfo = availableSizesForColor.find(s => s.size.trim() === sizeTrimmed);
        const reqQty = riMultiplier;

        if (!stockInfo || stockInfo.quantity <= 0) {
          missingSizes.push(sizeTrimmed);
          return;
        }

        const existingInCart = cart
          .filter(item => item.batch_id === stockInfo.batch_id)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (reqQty + existingInCart > stockInfo.quantity) {
          insufficientSizes.push({
            size: sizeTrimmed,
            req: reqQty + existingInCart,
            av: stockInfo.quantity
          });
        }
      });

      if (insufficientSizes.length > 0) {
        let errMsg = 'Một số size có trong kho nhưng không đủ số lượng để bán:\n';
        insufficientSizes.forEach(item => {
          errMsg += `- Size ${item.size} cần ${item.req} cái nhưng chỉ còn ${item.av} cái trong kho.\n`;
        });
        alert(errMsg);
        return;
      }

      if (missingSizes.length > 0) {
        const label = selectedRiSummary?.label || 'Ri đã chọn';
        const ok = window.confirm(
          `${label} đang không có các size: ${missingSizes.join(', ')}.\n` +
          'Có thể đây là size không sản xuất hoặc chưa nhập kho.\n\n' +
          'Bạn có muốn tiếp tục bán các size đang có hàng không?'
        );
        if (!ok) return;
      }
    }

    const itemsToAdd: CartItem[] = [];
    let hasStockError = false;

    // Check sizes being entered
    Object.keys(sizeQuantities).forEach(size => {
      const qty = sizeQuantities[size];
      if (qty <= 0) return;

      const stockInfo = availableSizesForColor.find(s => s.size === size);
      if (!stockInfo) return;

      // Check stock availability
      const existingInCart = cart
        .filter(item => item.batch_id === stockInfo.batch_id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (qty + existingInCart > stockInfo.quantity) {
        alert(`Số lượng chọn bán cho Size ${size} (${qty + existingInCart} cái) vượt quá tồn kho hiện tại (${stockInfo.quantity} cái).`);
        hasStockError = true;
        return;
      }

      itemsToAdd.push({
        id: `${stockInfo.batch_id}-${size}-${Date.now()}`,
        product_id: prod.id,
        product_code: prod.code,
        product_name: prod.code,
        color: selectedColor,
        size: size,
        quantity: qty,
        unit_price: price,
        subtotal: qty * price,
        unit_type: stockInfo.unit_type,
        batch_id: stockInfo.batch_id,
        available_qty: stockInfo.quantity
      });
    });

    if (hasStockError) return;

    if (itemsToAdd.length === 0) {
      alert('Vui lòng chọn số lượng lớn hơn 0 cho ít nhất một size.');
      return;
    }

    setCart([...cart, ...itemsToAdd]);
    
    // Reset selection fields slightly
    setEntryMode('single');
    setRiMultiplier(1);
    const resetQtys: { [size: string]: number } = {};
    availableSizesForColor.forEach(s => {
      resetQtys[s.size] = 0;
    });
    setSizeQuantities(resetQtys);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const groupedCart = useMemo<CartGroup[]>(() => {
    const groups: Record<string, CartGroup> = {};

    cart.forEach(item => {
      const key = [
        item.product_id,
        item.product_code,
        item.color,
        item.unit_type,
        item.unit_price
      ].join('|');

      if (!groups[key]) {
        groups[key] = {
          key,
          product_code: item.product_code,
          product_name: item.product_name,
          color: item.color,
          unit_type: item.unit_type,
          unit_price: item.unit_price,
          sizes: [],
          quantityPerSize: item.quantity,
          totalPieces: 0,
          subtotal: 0,
          itemIds: []
        };
      }

      groups[key].sizes.push(item.size);
      groups[key].totalPieces += item.quantity;
      groups[key].subtotal += item.subtotal;
      groups[key].itemIds.push(item.id);

      if (groups[key].quantityPerSize !== item.quantity) {
        groups[key].quantityPerSize = null;
      }
    });

    return Object.values(groups).map(group => ({
      ...group,
      sizes: group.sizes.sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      })
    }));
  }, [cart]);

  const removeCartGroup = (key: string) => {
    const group = groupedCart.find(item => item.key === key);
    if (!group) return;
    setCart(cart.filter(item => !group.itemIds.includes(item.id)));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const debtAmount = totalAmount - (parseInt(paidAmount, 10) || 0);

  // Auto-set status based on paid amount
  useEffect(() => {
    const paid = parseInt(paidAmount, 10) || 0;
    if (paid === 0) {
      setPaymentStatus('chưa thu');
    } else if (paid >= totalAmount && totalAmount > 0) {
      setPaymentStatus('đã thu');
    } else {
      setPaymentStatus('thu một phần');
    }
  }, [paidAmount, totalAmount]);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Giỏ hàng trống! Vui lòng chọn ít nhất 1 sản phẩm.');
      return;
    }

    setLoading(true);
    try {
      let customerId = selectedCustomerId;
      let customerName = '';
      let customerPhone = '';
      let customerAddress = '';

      // 1. Create customer if new
      if (isNewCustomer) {
        if (!newCustName.trim()) {
          throw new Error('Vui lòng nhập tên khách hàng mới.');
        }

        const token = `KH-${Math.floor(100000 + Math.random() * 900000)}`;

        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            name: newCustName.trim(),
            phone: newCustPhone.trim() || null,
            address: newCustAddress.trim() || null,
            note: newCustNote.trim() || '',
            tracking_token: token
          })
          .select()
          .single();

        if (custErr) throw custErr;
        customerId = newCust.id;
        customerName = newCust.name;
        customerPhone = newCust.phone || '';
        customerAddress = newCust.address || '';
      } else {
        const found = customers.find(c => c.id === customerId);
        if (found) {
          customerName = found.name;
          customerPhone = found.phone || '';
          customerAddress = found.address || '';
        } else {
          customerName = 'Khách lẻ vãng lai';
        }
      }

      // Generate invoice code
      const invoiceCode = `HD-${Date.now().toString().slice(-8)}`;

      // 2. Create Invoice
      const { data: newInvoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          invoice_code: invoiceCode,
          customer_id: customerId || null,
          customer_name_snapshot: customerName,
          customer_phone_snapshot: customerPhone,
          customer_address_snapshot: customerAddress,
          total_amount: totalAmount,
          paid_amount: parseInt(paidAmount, 10) || 0,
          debt_amount: debtAmount >= 0 ? debtAmount : 0,
          payment_status: paymentStatus,
          sale_date: new Date().toISOString(),
          note: invoiceNote.trim() || ''
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // 3. Create Invoice Items
      const itemInserts = cart.map(item => ({
        invoice_id: newInvoice.id,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        unit_type: item.unit_type
      }));

      const { error: itemsErr } = await supabase
        .from('invoice_items')
        .insert(itemInserts);

      if (itemsErr) throw itemsErr;

      // 4. Subtract stock. Group by batch to avoid one read + one write per cart row.
      const quantityByBatch = cart.reduce<Record<string, number>>((acc, item) => {
        acc[item.batch_id] = (acc[item.batch_id] || 0) + item.quantity;
        return acc;
      }, {});
      const stockAdjustments = Object.entries(quantityByBatch).map(([batchId, quantity]) => ({
        batch_id: batchId,
        quantity
      }));
      const { error: stockRpcErr } = await supabase.rpc('decrement_inventory_stock', {
        p_adjustments: stockAdjustments
      });
      if (stockRpcErr) throw stockRpcErr;

      // 5. Create Payment record if paid amount > 0
      const paid = parseInt(paidAmount, 10) || 0;
      if (paid > 0 && customerId) {
        const { error: payErr } = await supabase
          .from('payments')
          .insert({
            customer_id: customerId,
            invoice_id: newInvoice.id,
            amount: paid,
            payment_date: new Date().toISOString(),
            note: `Thanh toán cho hoá đơn ${invoiceCode}`
          });
        
        if (payErr) console.error('Lỗi tạo phiếu thu tự động:', payErr.message);
      }

      // Successful invoice creation
      alert(`Xuất hoá đơn thành công! Mã hoá đơn: ${invoiceCode}`);
      setCreatedInvoice({
        ...newInvoice,
        items: cart,
        customer_name_snapshot: customerName,
        customer_phone_snapshot: customerPhone,
        customer_address_snapshot: customerAddress
      });

      // Reset Form State
      setCart([]);
      setSelectedCustomerId('');
      setIsNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustNote('');
      setInvoiceNote('');
      setPaidAmount('0');
      setSelectedProductId('');
      setItemPrice('');

      setStockBatches(prev => prev
        .map(batch => {
          const quantitySold = quantityByBatch[batch.id] || 0;
          return quantitySold > 0 ? { ...batch, quantity: batch.quantity - quantitySold } : batch;
        })
        .filter(batch => batch.quantity > 0)
      );
      if (onInvoiceCreated) onInvoiceCreated();

    } catch (err: any) {
      alert('Lỗi khi lưu hoá đơn: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Xuất hoá đơn bán hàng</h2>
        <p className="text-xs text-slate-500 mt-0.5">Lập đơn sỉ lẻ, trừ trực tiếp số lượng tồn kho theo ri và tự tính toán công nợ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Client Selection & Creation */}
        <div className="space-y-5 lg:col-span-1">
          {/* Client select card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-blue-600" /> Hồ sơ khách hàng
              </h3>
              <button
                type="button"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                {isNewCustomer ? 'Chọn khách cũ' : 'Thêm khách mới'}
              </button>
            </div>

            {isNewCustomer ? (
              <div className="space-y-3 animate-fade-in text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600">Tên khách hàng <span className="text-red-500">*</span></span>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="Tên khách, xưởng sỉ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600">Số điện thoại</span>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="09xxx..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600">Địa chỉ giao nhận</span>
                  <input
                    type="text"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="Đống Đa, Hà Nội..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600">Ghi chú công nợ khách</span>
                  <textarea
                    value={newCustNote}
                    onChange={(e) => setNewCustNote(e.target.value)}
                    placeholder="Thanh toán gối đầu..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600 block">Chọn khách hàng từ danh sách:</span>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-slate-50 font-medium"
                  >
                    <option value="">-- Khách lẻ vãng lai (Không ghi sổ nợ) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                {selectedCustomerId && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] space-y-1">
                    <p className="font-semibold text-slate-700">Thông tin snapshot liên hệ:</p>
                    <p className="text-slate-500">SĐT: {customers.find(c => c.id === selectedCustomerId)?.phone || 'N/A'}</p>
                    <p className="text-slate-500">Đ/C: {customers.find(c => c.id === selectedCustomerId)?.address || 'N/A'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Core Item Selector Area */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-blue-600" /> Chọn hàng cần bán
            </h3>

            {/* Select product */}
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-slate-600 block">Chọn mã sản phẩm có tồn kho:</span>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-slate-50 font-bold"
              >
                <option value="">-- Chọn sản phẩm --</option>
                {products.map(p => {
                  const inStock = stockBatches.some(b => b.product_id === p.id);
                  return (
                    <option key={p.id} value={p.id} disabled={!inStock}>
                      {p.code} {!inStock ? '(HẾT HÀNG)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedProductId && availableColors.length > 0 && (
              <div className="space-y-4 animate-fade-in text-xs">
                {/* Select Color */}
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600 block">Chọn màu sắc:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableColors.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          selectedColor === color
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Entry mode select */}
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600 block">Hình thức lấy sỉ:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEntryMode('single')}
                      className={`py-1.5 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                        entryMode === 'single' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      Lẻ tự do
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('ri_nhi')}
                      disabled={!availableSizesForColor.some(s => s.unit_type === 'Ri nhí')}
                      className={`py-1.5 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                        entryMode === 'ri_nhi' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      Ri nhí
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode('ri_dai')}
                      disabled={!availableSizesForColor.some(s => s.unit_type === 'Ri đại')}
                      className={`py-1.5 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                        entryMode === 'ri_dai' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      Ri đại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEntryMode('ri_set');
                        if (sizeSets.length > 0 && !selectedSizeSetId) {
                          setSelectedSizeSetId(sizeSets[0].id);
                        }
                      }}
                      className={`py-1.5 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                        entryMode === 'ri_set' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      Ri nhóm
                    </button>
                  </div>
                </div>

                {/* Custom Ri set selector */}
                {entryMode === 'ri_set' && (
                  <div className="space-y-1 animate-fade-in text-xs">
                    <span className="font-semibold text-slate-600 block">Chọn nhóm Ri tự tạo:</span>
                    <select
                      value={selectedSizeSetId || ''}
                      onChange={(e) => setSelectedSizeSetId(e.target.value || null)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none bg-slate-50 font-bold"
                    >
                      <option value="">-- Chọn nhóm Ri --</option>
                      {sizeSets.map(set => (
                        <option key={set.id} value={set.id}>
                          {set.name} ({set.sizes.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Ri Multiplier */}
                {entryMode !== 'single' && (
                  <div className="space-y-1 p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 animate-fade-in">
                    <span className="font-semibold text-blue-800 block">Số lượng Ri cần lấy:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={riMultiplier}
                        onChange={(e) => setRiMultiplier(parseInt(e.target.value, 10) || 1)}
                        className="w-20 bg-white border border-slate-200 rounded-lg py-1 px-2 text-center font-bold"
                      />
                      <span className="text-[10px] text-slate-500 font-medium">
                        (= {riMultiplier} cái cho mỗi Size thuộc {
                          entryMode === 'ri_nhi' ? 'Ri nhí' : 
                          entryMode === 'ri_dai' ? 'Ri đại' : 
                          (sizeSets.find(s => s.id === selectedSizeSetId)?.name || 'Ri nhóm')
                        })
                      </span>
                    </div>
                  </div>
                )}

                {/* Input Price */}
                <div className="space-y-1">
                  <span className="font-semibold text-slate-600 block">Đơn giá bán sỉ/lẻ (đ/cái) <span className="text-red-500">*</span></span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ví dụ: 85000, 120000"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none font-mono font-bold text-slate-900"
                  />
                </div>

                {/* Sizes List with quantities */}
                {entryMode === 'single' ? (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-600 block">Số lượng cần bán theo từng Size:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {availableSizesForColor.map(s => (
                        <div key={s.size} className="flex items-center justify-between p-2 rounded-xl border bg-slate-50/50 border-slate-200">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-slate-800 text-xs">Sz {s.size}</span>
                            <span className="text-[10px] text-slate-400 block">Tồn: {s.quantity} cái</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={sizeQuantities[s.size] || ''}
                            onChange={(e) => handleSizeQtyChange(s.size, e.target.value)}
                            placeholder="0"
                            className="w-14 bg-white border border-slate-200 rounded-lg py-1 text-center font-mono font-bold text-slate-900 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedRiSummary && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-bold text-blue-900 block">Đang chọn: {selectedRiSummary.label}</span>
                        <span className="text-slate-500 block mt-1">
                          Size trong nhóm: {selectedRiSummary.sizes.map(size => size.size).join(', ') || 'Chưa có tồn kho'}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-white border border-blue-100 rounded-lg font-mono font-black text-blue-700">
                        {riMultiplier} ri
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white border border-blue-100 rounded-xl p-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Tối đa bán</span>
                        <span className="font-mono font-black text-slate-900">{selectedRiSummary.maxRi} ri</span>
                      </div>
                      <div className="bg-white border border-blue-100 rounded-xl p-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Tổng cái</span>
                        <span className="font-mono font-black text-slate-900">{selectedRiSummary.totalPieces}</span>
                      </div>
                      <div className="bg-white border border-blue-100 rounded-xl p-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Tạm tính</span>
                        <span className="font-mono font-black text-slate-900">{formatCurrency(selectedRiSummary.estimatedTotal)}</span>
                      </div>
                    </div>

                    {selectedRiSummary.maxRi < riMultiplier && (
                      <div className="text-red-600 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        Không đủ tồn kho để lấy {riMultiplier} ri. Nhóm này hiện chỉ đủ tối đa {selectedRiSummary.maxRi} ri.
                      </div>
                    )}
                  </div>
                )}

                {/* Push to cart button */}
                <button
                  type="button"
                  onClick={addToCart}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Thêm vào hoá đơn tạm thời
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Column 2 & 3: Giant Invoice Summary & Printing and Checkout */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveInvoice} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileTextIcon className="h-4 w-4 text-blue-600" /> Giỏ hàng & thanh toán
              </h3>
              <span className="font-mono text-[10px] font-semibold text-slate-400">
                {groupedCart.length} nhóm hàng phân loại
              </span>
            </div>

            {/* Cart Items Table */}
            {cart.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-500 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-100 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="p-3">Hàng hoá</th>
                      <th className="p-3 text-center">Phân loại</th>
                      <th className="p-3 text-center">SL</th>
                      <th className="p-3 text-right">Đơn giá</th>
                      <th className="p-3 text-right">Thành tiền</th>
                      <th className="p-3 text-center w-12">Xoá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedCart.map(item => (
                      <tr key={item.key} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{item.product_name}</div>
                          <span className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            {item.product_code}
                          </span>
                        </td>
                        <td className="p-3 text-center space-y-0.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full text-[10px] whitespace-nowrap block w-fit mx-auto border border-blue-100">
                            Màu {item.color}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {item.unit_type} ({item.sizes.join(', ')})
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-900">
                          {item.quantityPerSize !== null && item.sizes.length > 1
                            ? `${item.quantityPerSize} ri`
                            : `${item.totalPieces} cái`}
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-slate-600">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeCartGroup(item.key)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400">
                <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs">Chưa có sản phẩm nào trong giỏ hàng.</p>
                <p className="text-[10px] text-slate-400 mt-1">Chọn mã hàng, màu sắc và size bên trái để thêm vào đơn hàng.</p>
              </div>
            )}

            {/* Calculations & Payment fields */}
            {cart.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                {/* Note */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-600 block">Ghi chú phiếu giao hàng:</span>
                    <textarea
                      value={invoiceNote}
                      onChange={(e) => setInvoiceNote(e.target.value)}
                      placeholder="Ghi chú giao hàng nhanh, gửi xe đò..."
                      rows={3}
                      className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Math check */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>Tổng tiền hàng sỉ:</span>
                    <span className="font-mono text-sm text-slate-950">{formatCurrency(totalAmount)}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-slate-600 block">Số tiền đã thanh toán (đ):</span>
                    <input
                      type="number"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full bg-white px-3.5 py-2 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between font-bold border-t border-slate-200 pt-3">
                    <span className="text-red-600">Ghi nợ công nợ gối đầu:</span>
                    <span className="font-mono text-sm text-red-600">{formatCurrency(debtAmount >= 0 ? debtAmount : 0)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Đang lưu & trừ kho...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Xuất hoá đơn & Trừ kho
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* PRINT VIEW SECTION (MẪU PHIẾU GIAO HÀNG CHUẨN IN ẤN) */}
          {createdInvoice && (
            <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-200 shadow-sm space-y-4 animate-fade-in relative">
              <div className="absolute top-4 right-4 flex gap-2 no-print">
                <button
                  onClick={() => downloadInvoicePdf(createdInvoice)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Lưu PDF
                </button>
                <button
                  onClick={() => downloadInvoiceExcel(createdInvoice)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Lưu Excel
                </button>
                <button
                  onClick={() => setCreatedInvoice(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Đóng mẫu in
                </button>
              </div>

              <PrintableDeliveryNote invoice={createdInvoice} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple fallback icon replacement
function FileTextIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
