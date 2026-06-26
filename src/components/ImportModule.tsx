import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product, SizeSet } from '../types';
import { 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  Boxes, 
  FileText, 
  Loader2,
  AlertCircle,
  Sparkles,
  RefreshCcw,
  Tag,
  Edit3
} from 'lucide-react';

export default function ImportModule() {
  const [loading, setLoading] = useState(false);
  const [dbSizeSets, setDbSizeSets] = useState<SizeSet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Size set editing states
  const [isEditingSizeSet, setIsEditingSizeSet] = useState(false);
  const [editingSizeSetName, setEditingSizeSetName] = useState('');
  const [editingSizeSetSizes, setEditingSizeSetSizes] = useState<string[]>([]);
  const [isSizeSetUsedInInventory, setIsSizeSetUsedInInventory] = useState(false);
  
  // Product info
  const [productCode, setProductCode] = useState('');
  const [colorsInput, setColorsInput] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);

  // Size selections
  const [selectedSizeSetName, setSelectedSizeSetName] = useState<string>('Ri nhí');
  const [selectedSizeSetId, setSelectedSizeSetId] = useState<string | null>(null);
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [newSizeInput, setNewSizeInput] = useState('');
  const [saveCustomSet, setSaveCustomSet] = useState(false);
  const [customSetName, setCustomSetName] = useState('');

  // Bulk entry helper
  const [bulkQuantity, setBulkQuantity] = useState('');

  // Quantities matrix: [color][size] = quantity
  const [quantities, setQuantities] = useState<{ [color: string]: { [size: string]: number } }>({});
  const [batchNote, setBatchNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Custom Deletion Confirmation State for Size Sets
  const [confirmDeleteSizeSet, setConfirmDeleteSizeSet] = useState<{
    isOpen: boolean;
    id: string | null;
    name: string;
  }>({
    isOpen: false,
    id: null,
    name: ''
  });

  const fetchInitialData = async () => {
    try {
      const [sizeRes, productRes] = await Promise.all([
        supabase.from('size_sets').select('*').order('created_at', { ascending: true }),
        supabase.from('products').select('*')
      ]);

      const { data: sizeData, error: sizeErr } = sizeRes;
      if (sizeErr) throw sizeErr;
      const activeSets = (sizeData || []).filter((s: any) => s.is_active !== false);
      setDbSizeSets(activeSets);

      // Set default selected size set if not already set
      if (activeSets && activeSets.length > 0 && !selectedSizeSetId) {
        const defaultSet = activeSets.find(s => s.is_default) || activeSets[0];
        setSelectedSizeSetId(defaultSet.id);
        setSelectedSizeSetName(defaultSet.name);
      } else if (!selectedSizeSetId) {
        setSelectedSizeSetName('Tuỳ chọn');
      }

      const { data: prodData, error: prodErr } = productRes;
      if (prodErr) throw prodErr;
      setProducts(prodData || []);
    } catch (err: any) {
      console.error('Lỗi fetch dữ liệu:', err.message);
    }
  };

  const handleAddSizeSet = async () => {
    if (!customSetName.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập tên bộ size mẫu' });
      return;
    }
    if (customSizes.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng nhập ít nhất một size' });
      return;
    }

    setLoading(true);
    try {
      const { data: newSet, error: setErr } = await supabase
        .from('size_sets')
        .insert({
          name: customSetName.trim(),
          sizes: customSizes,
          is_default: false,
          is_active: true
        })
        .select()
        .single();

      if (setErr) throw setErr;

      setMessage({ type: 'success', text: 'Đã thêm bộ size thành công' });

      // Refresh size sets list
      const { data: sizeData } = await supabase.from('size_sets').select('*').order('created_at', { ascending: true });
      const updated = (sizeData || []).filter((s: any) => s.is_active !== false);
      setDbSizeSets(updated);

      if (newSet) {
        setSelectedSizeSetId(newSet.id);
        setSelectedSizeSetName(newSet.name);
      }

      // Reset custom creator states
      setCustomSizes([]);
      setCustomSetName('');
      setSaveCustomSet(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Không thể thêm bộ size' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSizeSet = (id: string) => {
    const targetSet = dbSizeSets.find(s => s.id === id);
    if (!targetSet) return;
    if (targetSet.is_default) {
      setMessage({ type: 'error', text: 'Không thể xoá bộ size mặc định của hệ thống.' });
      return;
    }
    setConfirmDeleteSizeSet({
      isOpen: true,
      id,
      name: targetSet.name
    });
  };

  const executeDeleteSizeSet = async () => {
    const { id } = confirmDeleteSizeSet;
    if (!id) return;

    setLoading(true);
    setConfirmDeleteSizeSet(prev => ({ ...prev, isOpen: false }));
    try {
      const { error: updateErr } = await supabase
        .from('size_sets')
        .update({ is_active: false })
        .eq('id', id)
        .eq('is_default', false);

      if (updateErr) {
        console.log('Soft delete failed, trying hard delete:', updateErr);
        const { error: deleteErr } = await supabase
          .from('size_sets')
          .delete()
          .eq('id', id)
          .eq('is_default', false);
        if (deleteErr) throw deleteErr;
      }

      setMessage({ type: 'success', text: 'Đã xoá bộ size thành công.' });
      
      // If the deleted size set was currently selected, select another one or reset to free input
      if (selectedSizeSetId === id) {
        setSelectedSizeSetId(null);
        setSelectedSizeSetName('Tuỳ chọn');
      }

      // Refetch
      await fetchInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Không thể xoá bộ size.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSizeSet = async (sizeSet: any) => {
    setSelectedSizeSetId(sizeSet.id);
    setSelectedSizeSetName(sizeSet.name);
    setIsEditingSizeSet(false); // reset edit state when selecting another set
    
    // Check if used in inventory
    if (!sizeSet.is_default) {
      try {
        const { data } = await supabase
          .from('inventory_batches')
          .select('id')
          .eq('size_set_id', sizeSet.id)
          .limit(1);
        setIsSizeSetUsedInInventory(data && data.length > 0);
      } catch (err) {
        console.error('Check inventory failed:', err);
        setIsSizeSetUsedInInventory(false);
      }
    } else {
      setIsSizeSetUsedInInventory(false);
    }
  };

  const handleSaveSizeSetEdit = async () => {
    if (!selectedSizeSetId) return;
    if (!editingSizeSetName.trim()) {
      setMessage({ type: 'error', text: 'Tên bộ size không được để trống' });
      return;
    }
    if (editingSizeSetSizes.length === 0) {
      setMessage({ type: 'error', text: 'Danh sách size không được để trống' });
      return;
    }
    setLoading(true);
    try {
      const updateData: any = {
        name: editingSizeSetName.trim()
      };
      
      // If not used in inventory, allow size modification
      if (!isSizeSetUsedInInventory) {
        updateData.sizes = editingSizeSetSizes;
      }

      const { error } = await supabase
        .from('size_sets')
        .update(updateData)
        .eq('id', selectedSizeSetId)
        .eq('is_default', false);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Cập nhật bộ size thành công.' });
      setIsEditingSizeSet(false);
      setSelectedSizeSetName(editingSizeSetName.trim());

      // Refresh
      await fetchInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Lỗi cập nhật bộ size: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    const channel = supabase
      .channel('public:import_module_data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'size_sets' }, () => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_batches' }, () => {
        fetchInitialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update sizes based on selected set
  const getActiveSizes = (): string[] => {
    if (selectedSizeSetId) {
      const found = dbSizeSets.find(s => s.id === selectedSizeSetId);
      return found ? found.sizes : [];
    }
    return customSizes;
  };

  // Process color input
  useEffect(() => {
    const list = colorsInput
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    setColors(list);
  }, [colorsInput]);

  // Handle autocomplete matching
  const handleProductCodeChange = (code: string) => {
    const upperCode = code.toUpperCase();
    setProductCode(upperCode);
    
    const matched = products.find(p => p.code.toUpperCase() === upperCode);
    if (matched) {
      setColorsInput(matched.colors.join(', '));
      setSelectedProductId(matched.id);
    } else {
      setSelectedProductId(null);
    }
  };

  // Custom size parser logic with robust range expansion
  const parseCustomSizes = (input: string): string[] => {
    const tokens = input.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
    const result: string[] = [];

    tokens.forEach(token => {
      // Check if token matches a range pattern like "17-22" or "3-10"
      const match = token.match(/^(\d+)-(\d+)$/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (start < end && end - start <= 50) { // Safety limit of 50 sizes
          for (let i = start; i <= end; i++) {
            result.push(i.toString());
          }
          return;
        }
      }
      // Otherwise split by hyphen if it's not a valid numeric range (e.g., S-M-L)
      const hyphens = token.split('-');
      if (hyphens.length > 1) {
        hyphens.forEach(h => {
          const trimmed = h.trim();
          if (trimmed) result.push(trimmed);
        });
      } else {
        result.push(token);
      }
    });

    return Array.from(new Set(result));
  };

  // Add custom size
  const handleAddCustomSize = () => {
    const parsed = parseCustomSizes(newSizeInput);
    if (parsed.length > 0) {
      const uniqueNewSizes = parsed.filter(sz => !customSizes.includes(sz));
      if (uniqueNewSizes.length > 0) {
        setCustomSizes([...customSizes, ...uniqueNewSizes]);
      }
      setNewSizeInput('');
    }
  };

  // Remove custom size
  const handleRemoveCustomSize = (size: string) => {
    setCustomSizes(customSizes.filter(s => s !== size));
  };

  // Reset quantities matrix when colors or sizes change
  const activeSizes = getActiveSizes();
  useEffect(() => {
    const newQuantities: typeof quantities = {};
    colors.forEach(color => {
      newQuantities[color] = {};
      activeSizes.forEach(size => {
        newQuantities[color][size] = quantities[color]?.[size] || 0;
      });
    });
    setQuantities(newQuantities);
  }, [colors, selectedSizeSetName, selectedSizeSetId, customSizes]);

  // Apply bulk quantity to all matrix cells
  const applyBulkQuantity = () => {
    const qty = parseInt(bulkQuantity, 10);
    if (isNaN(qty) || qty < 0) return;

    const newQuantities = { ...quantities };
    colors.forEach(color => {
      newQuantities[color] = {};
      activeSizes.forEach(size => {
        newQuantities[color][size] = qty;
      });
    });
    setQuantities(newQuantities);
  };

  const handleQtyChange = (color: string, size: string, value: string) => {
    const qty = parseInt(value, 10) || 0;
    setQuantities(prev => ({
      ...prev,
      [color]: {
        ...prev[color],
        [size]: qty >= 0 ? qty : 0
      }
    }));
  };

  const handleSaveImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!productCode.trim()) {
        throw new Error('Mã hàng không được bỏ trống.');
      }
      if (colors.length === 0) {
        throw new Error('Vui lòng nhập ít nhất một màu sắc.');
      }
      if (activeSizes.length === 0) {
        throw new Error('Vui lòng thiết lập bộ size trước khi nhập kho.');
      }

      // Check if any quantity is entered
      let totalQty = 0;
      colors.forEach(c => {
        activeSizes.forEach(s => {
          totalQty += quantities[c]?.[s] || 0;
        });
      });

      if (totalQty === 0) {
        throw new Error('Vui lòng nhập số lượng > 0 cho ít nhất một size và một màu.');
      }

      let productId = selectedProductId;

      // 1. Save or Update Product
      if (!productId) {
        // Double check if code already exists in DB (just in case)
        const { data: existingProd } = await supabase
          .from('products')
          .select('id, colors')
          .eq('code', productCode.trim().toUpperCase())
          .maybeSingle();

        if (existingProd) {
          productId = existingProd.id;
          // Merge colors
          const mergedColors = Array.from(new Set([...existingProd.colors, ...colors]));
          await supabase
            .from('products')
            .update({ colors: mergedColors, updated_at: new Date().toISOString() })
            .eq('id', productId);
        } else {
          // Create new product (without name field)
          const { data: newProd, error: prodErr } = await supabase
            .from('products')
            .insert({
              code: productCode.trim().toUpperCase(),
              colors: colors,
              note: batchNote.trim() || null
            })
            .select()
            .single();

          if (prodErr) throw prodErr;
          productId = newProd.id;
        }
      } else {
        // Update product colors if newly added
        const matchedProduct = products.find(p => p.id === productId);
        if (matchedProduct) {
          const mergedColors = Array.from(new Set([...matchedProduct.colors, ...colors]));
          await supabase
            .from('products')
            .update({ colors: mergedColors, updated_at: new Date().toISOString() })
            .eq('id', productId);
        }
      }

      // 2. Save new Custom Size Set if requested
      let sizeSetId = selectedSizeSetId;
      if (!selectedSizeSetId && saveCustomSet && customSetName.trim() && customSizes.length > 0) {
        const { data: newSet, error: setErr } = await supabase
          .from('size_sets')
          .insert({
            name: customSetName.trim(),
            sizes: customSizes,
            is_default: false
          })
          .select()
          .single();

        if (setErr) throw setErr;
        sizeSetId = newSet.id;
      }

      // 3. Save/Upsert Inventory Batches
      const batchInserts: any[] = [];
      colors.forEach(color => {
        activeSizes.forEach(size => {
          const qty = quantities[color]?.[size] || 0;
          if (qty > 0) {
            batchInserts.push({
              product_id: productId,
              product_code: productCode.trim().toUpperCase(),
              color: color,
              size_set_id: sizeSetId,
              size: size,
              quantity: qty,
              unit_type: sizeSetId 
                ? dbSizeSets.find(s => s.id === sizeSetId)?.name || customSetName.trim() || 'Ri'
                : 'Tuỳ chọn',
              note: batchNote.trim() || null
            });
          }
        });
      });

      const { error: stockRpcError } = await supabase.rpc('increment_inventory_stock', {
        p_items: batchInserts
      });
      if (stockRpcError) throw stockRpcError;

      setMessage({ type: 'success', text: `Đã nhập kho thành công lô hàng (${totalQty} cái)! Dữ liệu đã đồng bộ lên Supabase.` });
      
      // Reset form
      setProductCode('');
      setColorsInput('');
      setColors([]);
      setCustomSizes([]);
      setBulkQuantity('');
      setQuantities({});
      setBatchNote('');
      setSelectedProductId(null);
      setSaveCustomSet(false);
      setCustomSetName('');
      
      let updatedDbSizeSets = dbSizeSets;
      if (!selectedSizeSetId && sizeSetId) {
        const { data: sizeData } = await supabase.from('size_sets').select('*').order('created_at', { ascending: true });
        updatedDbSizeSets = (sizeData || []).filter((s: any) => s.is_active !== false);
        setDbSizeSets(updatedDbSizeSets);
      }
      
      if (sizeSetId) {
        setSelectedSizeSetId(sizeSetId);
        const setObj = updatedDbSizeSets.find(s => s.id === sizeSetId);
        if (setObj) setSelectedSizeSetName(setObj.name);
      } else {
        setSelectedSizeSetId(null);
        setSelectedSizeSetName('Tuỳ chọn');
      }

      setProductSearch('');
      setIsCreatingNewProduct(false);
      setIsDropdownOpen(false);
      
      if (!selectedProductId) {
        const { data: prodData } = await supabase.from('products').select('*');
        setProducts(prodData || []);
      } else {
        setProducts(prev => prev.map(product => (
          product.id === selectedProductId
            ? { ...product, colors: Array.from(new Set([...product.colors, ...colors])) }
            : product
        )));
      }

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra khi nhập kho.' });
    } finally {
      setLoading(false);
    }
  };

  const autofillFromProduct = (prod: Product) => {
    setProductCode(prod.code);
    setColorsInput(prod.colors.join(', '));
    setSelectedProductId(prod.id);
    setProductSearch(prod.code);
    setIsCreatingNewProduct(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Nhập kho lô hàng mới</h2>
        <p className="text-xs text-slate-500 mt-0.5">Thêm sản phẩm, khai báo phân khúc ri/size và nhập số lượng trực tiếp vào kho dữ liệu</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex gap-3 text-xs font-medium items-start animate-fade-in ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p>{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold hover:underline shrink-0">Đóng</button>
        </div>
      )}

      <form onSubmit={handleSaveImport} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Information */}
        <div className="lg:col-span-1 space-y-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <Tag className="h-4 w-4 text-blue-600" /> Information hàng hoá
          </h3>

          {/* Code input */}
          {isCreatingNewProduct ? (
            <div className="space-y-1 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 block">Mã hàng mới <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewProduct(false);
                    setProductCode('');
                    setSelectedProductId(null);
                    setProductSearch('');
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-bold cursor-pointer"
                >
                  Chọn mã có sẵn
                </button>
              </div>
              <input
                type="text"
                required
                value={productCode}
                onChange={(e) => handleProductCodeChange(e.target.value)}
                placeholder="Ví dụ: SP102, KHOAC01"
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 uppercase"
              />
              {selectedProductId ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                  <AlertCircle className="h-3 w-3" /> Mã trùng có sẵn (Sẽ chuyển thành nhập thêm)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                  Mã hàng mới (Chưa tồn tại)
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-1 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 block">Chọn mã hàng có sẵn <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewProduct(true);
                    setProductCode('');
                    setSelectedProductId(null);
                    setColorsInput('');
                    setColors([]);
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-bold cursor-pointer"
                >
                  + Tạo mã hàng mới
                </button>
              </div>
              
              {/* Combobox Input wrapper */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Gõ hoặc click để tìm mã hàng..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setIsDropdownOpen(true);
                    // also look for exact match dynamically
                    const upperCode = e.target.value.trim().toUpperCase();
                    const matched = products.find(p => p.code.toUpperCase() === upperCode);
                    if (matched) {
                      setProductCode(matched.code);
                      setSelectedProductId(matched.id);
                      setColorsInput(matched.colors.join(', '));
                    } else {
                      setProductCode('');
                      setSelectedProductId(null);
                    }
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full px-3.5 py-2 pr-10 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 uppercase"
                />
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Selected Indicator */}
              {selectedProductId && (
                <div className="flex items-center gap-1.5 mt-1 animate-fade-in">
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    <Check className="h-3 w-3" /> Đã chọn mã: {productCode} (Nhập thêm)
                  </span>
                </div>
              )}

              {/* Click outside backdrop overlay */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setIsDropdownOpen(false)} 
                />
              )}

              {/* Floating Dropdown List */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {products.filter(p => p.code.toLowerCase().includes(productSearch.toLowerCase())).length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      Không tìm thấy mã hàng nào.
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewProduct(true);
                          setProductCode(productSearch.trim().toUpperCase());
                          setIsDropdownOpen(false);
                        }}
                        className="block mx-auto mt-1 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        + Tạo mã mới "{productSearch.trim().toUpperCase()}"
                      </button>
                    </div>
                  ) : (
                    products
                      .filter(p => p.code.toLowerCase().includes(productSearch.toLowerCase()))
                      .map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            autofillFromProduct(p);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs font-semibold text-slate-700 flex justify-between items-center transition-colors cursor-pointer"
                        >
                          <span>{p.code}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({p.colors.length} màu: {p.colors.slice(0, 3).join(', ')}...)</span>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Colors input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 block">Danh sách màu sắc <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={colorsInput}
              onChange={(e) => setColorsInput(e.target.value)}
              placeholder="Ngăn cách bằng dấu phẩy, ví dụ: Đỏ, Đen, Trắng"
              className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {colors.map((color, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-md border border-blue-100">
                    {color}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 block">Ghi chú lô nhập</label>
            <textarea
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              placeholder="Ví dụ: Nhập lô xưởng sỉ ngày 26/06"
              rows={2}
              className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Center & Right Column: Size Setup & Quantity Matrix */}
        <div className="lg:col-span-2 space-y-6">
          {/* Size Configuration Area */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Boxes className="h-4 w-4 text-blue-600" /> Cấu hình phân khúc Size/Ri
            </h3>

            {/* Selection Buttons */}
            <div className="flex flex-wrap gap-2">
              {dbSizeSets.map((sizeSet) => {
                const isSelected = selectedSizeSetId === sizeSet.id;
                return (
                  <div key={sizeSet.id} className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => handleSelectSizeSet(sizeSet)}
                      className={`py-2 pl-3.5 pr-8 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      style={{ paddingRight: !sizeSet.is_default ? '2.25rem' : '0.875rem' }}
                    >
                      {sizeSet.name}
                    </button>
                    {!sizeSet.is_default && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSizeSet(sizeSet.id);
                        }}
                        className={`absolute right-2.5 p-1 rounded-md hover:bg-red-500 hover:text-white transition-colors cursor-pointer ${
                          isSelected ? 'text-blue-200' : 'text-slate-400'
                        }`}
                        title="Xoá bộ size này"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setSelectedSizeSetName('Tuỳ chọn');
                  setSelectedSizeSetId(null);
                  setIsEditingSizeSet(false);
                }}
                className={`py-2 px-3.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  selectedSizeSetName === 'Tuỳ chọn' && !selectedSizeSetId
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Khai báo size tự do
              </button>
            </div>

            {/* Control panel if a custom size set is selected */}
            {selectedSizeSetId && !dbSizeSets.find(s => s.id === selectedSizeSetId)?.is_default && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 animate-fade-in text-xs mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">Bộ size mẫu tự tạo: {selectedSizeSetName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const found = dbSizeSets.find(s => s.id === selectedSizeSetId);
                      if (found) {
                        setEditingSizeSetName(found.name);
                        setEditingSizeSetSizes([...found.sizes]);
                        setIsEditingSizeSet(!isEditingSizeSet);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg cursor-pointer text-[11px] transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> {isEditingSizeSet ? 'Đóng chế độ sửa' : 'Sửa bộ size này'}
                  </button>
                </div>

                {isEditingSizeSet && (
                  <div className="pt-3 border-t border-slate-250/65 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-600 block">Tên bộ size mới:</span>
                        <input
                          type="text"
                          value={editingSizeSetName}
                          onChange={(e) => setEditingSizeSetName(e.target.value)}
                          className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-600 block">
                          Danh sách size {isSizeSetUsedInInventory && <span className="text-red-500 font-bold">(Đã có tồn kho - Khóa sửa kích cỡ)</span>}:
                        </span>
                        <input
                          type="text"
                          disabled={isSizeSetUsedInInventory}
                          placeholder={isSizeSetUsedInInventory ? 'Đã phát sinh tồn kho, không được sửa đổi size' : 'Ngăn cách bằng dấu phẩy, ví dụ: S,M,L'}
                          value={editingSizeSetSizes.join(', ')}
                          onChange={(e) => setEditingSizeSetSizes(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingSizeSet(false)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer"
                      >
                        Huỷ
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSizeSetEdit}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                      >
                        Lưu bộ size
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Manual Size Set UI */}
            {!selectedSizeSetId && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4 animate-fade-in text-xs">
                {/* Manual custom size creator */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="font-semibold text-slate-600 block">Thêm từng Size mẫu hoặc dải size (ví dụ 17-22):</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSizeInput}
                          onChange={(e) => setNewSizeInput(e.target.value)}
                          placeholder="Ví dụ: S, M, L, XL hoặc 18, 20 hoặc 17-22"
                          className="flex-1 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 text-xs font-semibold uppercase"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomSize();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomSize}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>
                  </div>

                  {customSizes.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-semibold text-slate-500 block">Các size đã nhập:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {customSizes.map((sz, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-800 rounded font-mono font-bold text-xs">
                            {sz}
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomSize(sz)}
                              className="text-red-500 hover:text-red-700 cursor-pointer font-bold"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Instant Add Custom Set Area */}
                      <div className="pt-3 border-t border-slate-200/60 space-y-2">
                        <span className="text-[11px] font-bold text-slate-600 block">Lưu bộ size này làm mẫu để dùng lại lần sau:</span>
                        <div className="flex flex-col sm:flex-row gap-2 items-end">
                          <div className="flex-1 space-y-1 w-full">
                            <span className="text-[10px] text-slate-500">Tên gọi bộ size mẫu:</span>
                            <input
                              type="text"
                              value={customSetName}
                              onChange={(e) => setCustomSetName(e.target.value)}
                              placeholder="Ví dụ: Ri đại 17-22, Set áo nữ..."
                              className="w-full bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 text-xs font-semibold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAddSizeSet}
                            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1 shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" /> + Thêm bộ size này
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quantities Entry Grid Matrix */}
          {colors.length > 0 && activeSizes.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Bảng nhập số lượng hàng
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Nhập số lượng hàng theo ma trận màu sắc và size tương ứng</p>
                </div>

                {/* Bulk input helper */}
                <div className="flex gap-1.5 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 max-w-[260px]">
                  <input
                    type="number"
                    min="0"
                    placeholder="Số lượng cả Ri..."
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-center font-bold"
                  />
                  <button
                    type="button"
                    onClick={applyBulkQuantity}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    Áp dụng chung
                  </button>
                </div>
              </div>

              {/* Table Matrix */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 font-semibold text-slate-700 w-24">Màu sắc</th>
                      {activeSizes.map(size => (
                        <th key={size} className="p-3 font-bold font-mono text-center text-slate-800 bg-slate-100/60 min-w-[50px]">
                          Sz {size}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {colors.map(color => (
                      <tr key={color} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800 truncate max-w-[120px]">
                          {color}
                        </td>
                        {activeSizes.map(size => (
                          <td key={size} className="p-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={quantities[color]?.[size] === 0 ? '' : quantities[color]?.[size] || ''}
                              onChange={(e) => handleQtyChange(color, size, e.target.value)}
                              placeholder="0"
                              className="w-14 border border-slate-200 rounded-lg py-1.5 px-1 text-center font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 bg-slate-50/30"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg shadow-blue-500/15 active:scale-95 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang đồng bộ dữ liệu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Lưu lô hàng & Nhập kho
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Custom Deletion Confirmation Modal for Size Sets */}
      {confirmDeleteSizeSet.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-scale-up animate-duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 mb-3.5">
                <div className="p-2 bg-red-50 rounded-xl">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase">Xác nhận xoá bộ size</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Bạn có chắc chắn muốn xoá bộ size <span className="font-bold text-slate-900">"{confirmDeleteSizeSet.name}"</span> không?
                Hành động này không thể hoàn tác và bộ size này sẽ không còn hiển thị để chọn mẫu nhập kho nữa.
              </p>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteSizeSet({ isOpen: false, id: null, name: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={executeDeleteSizeSet}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-500/10 transition-all cursor-pointer"
                >
                  Xác nhận xoá
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
