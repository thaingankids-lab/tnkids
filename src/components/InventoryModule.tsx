import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Loader2, 
  Boxes, 
  ArrowUpDown,
  TrendingDown,
  ChevronDown,
  Edit3
} from 'lucide-react';

interface StockItem {
  id: string;
  product_id: string;
  product_code: string;
  color: string;
  size: string;
  quantity: number;
  unit_type: string;
  note: string;
  created_at: string;
  products: {
    id: string;
    code: string;
    note?: string;
  } | null;
}

export interface SizeCard {
  size: string;
  quantity: number;
  inventory_id: string;
  note: string;
  color: string;
}

export interface GroupCard {
  size_set_name: string;
  size_set_id: string | null;
  color: string;
  totalQuantity: number;
  sizes: SizeCard[];
}

export interface ProductCard {
  product_id: string;
  product_code: string;
  product_name: string;
  product_note: string;
  totalQuantity: number;
  colors: string[];
  groups: GroupCard[];
}

const getColorBadgeStyle = (color: string) => {
  const c = color.trim().toLowerCase();
  if (c === 'đen' || c === 'black' || c === 'dark') {
    return 'bg-slate-950 text-white border border-slate-800';
  }
  if (c === 'trắng' || c === 'white') {
    return 'bg-white text-slate-800 border border-slate-300';
  }
  if (c === 'đỏ' || c === 'red') {
    return 'bg-red-500 text-white border border-red-600';
  }
  if (c === 'xanh' || c === 'blue') {
    return 'bg-blue-500 text-white border border-blue-600';
  }
  if (c === 'vàng' || c === 'yellow') {
    return 'bg-amber-400 text-slate-900 border border-amber-500';
  }
  if (c === 'hồng' || c === 'pink') {
    return 'bg-rose-400 text-white border border-rose-500';
  }
  if (c === 'cam' || c === 'orange') {
    return 'bg-orange-500 text-white border border-orange-600';
  }
  if (c === 'xám' || c === 'grey' || c === 'gray') {
    return 'bg-slate-400 text-white border border-slate-500';
  }
  if (c === 'tím' || c === 'purple') {
    return 'bg-purple-500 text-white border border-purple-600';
  }
  if (c === 'xanh lá' || c === 'green') {
    return 'bg-emerald-500 text-white border border-emerald-600';
  }
  return 'bg-white/25 text-white border border-white/30 backdrop-blur-xs';
};

export default function InventoryModule() {
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Product details editing states
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState('');
  const [editingProductCode, setEditingProductCode] = useState('');
  const [editingProductName, setEditingProductName] = useState('');
  const [editingProductNote, setEditingProductNote] = useState('');

  // Tree drill-down states
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupCard | null>(null);

  // Custom Deletion Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    itemId: string | null;
    deleteType: 'item' | 'product' | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    itemId: null,
    deleteType: null,
    title: '',
    message: ''
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

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [unitTypeFilter, setUnitTypeFilter] = useState('');

  // Dropdown list for filters
  const [allColors, setAllColors] = useState<string[]>([]);
  const [allSizes, setAllSizes] = useState<string[]>([]);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_batches')
        .select(`
          id,
          product_id,
          product_code,
          color,
          size,
          quantity,
          unit_type,
          note,
          created_at,
          products (
            id,
            code,
            note
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const stockData = (data || []) as unknown as StockItem[];
      setStock(stockData);

      // Extract unique colors and sizes for filter options
      const colorsSet = new Set<string>();
      const sizesSet = new Set<string>();
      stockData.forEach(item => {
        if (item.color) colorsSet.add(item.color);
        if (item.size) sizesSet.add(item.size);
      });
      setAllColors(Array.from(colorsSet).sort());
      setAllSizes(Array.from(sizesSet).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      }));
    } catch (err: any) {
      console.error('Lỗi tải danh sách tồn kho:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();

    // Live sync realtime
    const channel = supabase
      .channel('public:inventory_batches_inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_batches' }, () => {
        fetchStock();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchStock();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStartEdit = (sizeItem: SizeCard) => {
    setEditingId(sizeItem.inventory_id);
    setEditQty(sizeItem.quantity);
    setEditNote(sizeItem.note || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setActionLoading(true);
    try {
      if (editQty < 0) {
        showToast('Số lượng tồn kho không thể âm.', 'error');
        return;
      }
      
      const { error } = await supabase
        .from('inventory_batches')
        .update({
          quantity: editQty,
          note: editNote.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      showToast('Đã lưu chỉnh sửa tồn kho thành công.', 'success');
      setEditingId(null);
      await fetchStock();

      // Sync local state modal immediately
      if (selectedGroup) {
        const updatedSizes = selectedGroup.sizes.map(s => {
          if (s.inventory_id === id) {
            return { ...s, quantity: editQty, note: editNote };
          }
          return s;
        });
        setSelectedGroup({
          ...selectedGroup,
          sizes: updatedSizes,
          totalQuantity: updatedSizes.reduce((sum, s) => sum + s.quantity, 0)
        });
      }
    } catch (err: any) {
      showToast('Không thể lưu chỉnh sửa: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItemClick = (id: string, sizeLabel: string) => {
    setConfirmDelete({
      isOpen: true,
      itemId: id,
      deleteType: 'item',
      title: 'Xác nhận xoá dòng tồn kho',
      message: `Bạn có chắc chắn muốn xoá vĩnh viễn tồn kho của Size ${sizeLabel}? Thao tác này sẽ làm mất số lượng tương ứng và không thể khôi phục.`
    });
  };

  const executeDelete = async () => {
    if (!confirmDelete.itemId) return;
    setActionLoading(true);
    try {
      if (confirmDelete.deleteType === 'product') {
        const productCode = confirmDelete.itemId;
        // Find product_id
        let productId = stock.find(item => item.products?.code === productCode)?.product_id;

        if (!productId) {
          const { data: prodData } = await supabase
            .from('products')
            .select('id')
            .eq('code', productCode)
            .single();
          if (prodData) {
            productId = prodData.id;
          }
        }

        if (!productId) {
          throw new Error('Không tìm thấy thông tin sản phẩm trong hệ thống.');
        }

        // 1. First manually delete related inventory batches
        const { error: batchDelErr } = await supabase
          .from('inventory_batches')
          .delete()
          .eq('product_id', productId);
        if (batchDelErr) throw batchDelErr;

        // 2. Then delete the product itself
        const { error: prodDelErr } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);
        if (prodDelErr) throw prodDelErr;

        showToast(`Đã xoá mã hàng "${productCode}" và tất cả tồn kho liên quan thành công.`, 'success');
        setSelectedProductCode(null);
        setSelectedGroup(null);
        setConfirmDelete({ isOpen: false, itemId: null, deleteType: null, title: '', message: '' });
        await fetchStock();
      } else {
        // Delete standard item
        const { error } = await supabase
          .from('inventory_batches')
          .delete()
          .eq('id', confirmDelete.itemId);

        if (error) throw error;
        
        const deletedId = confirmDelete.itemId;
        showToast('Đã xoá thành công dòng tồn kho khỏi cơ sở dữ liệu.', 'success');
        setConfirmDelete({ isOpen: false, itemId: null, deleteType: null, title: '', message: '' });
        setEditingId(null);
        await fetchStock();

        // Sync local state modal immediately
        if (selectedGroup) {
          const updatedSizes = selectedGroup.sizes.filter(s => s.inventory_id !== deletedId);
          if (updatedSizes.length === 0) {
            setSelectedGroup(null);
          } else {
            setSelectedGroup({
              ...selectedGroup,
              sizes: updatedSizes,
              totalQuantity: updatedSizes.reduce((sum, s) => sum + s.quantity, 0)
            });
          }
        }
      }
    } catch (err: any) {
      showToast('Không thể xoá dữ liệu: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter application logic (memoized to eliminate lag)
  const filteredStock = useMemo(() => {
    return stock.filter(item => {
      const prodCode = (item.product_code || item.products?.code || '').toLowerCase();
      const searchLower = searchQuery.toLowerCase();

      const matchesSearch = prodCode.includes(searchLower);
      const matchesColor = colorFilter === '' || item.color === colorFilter;
      const matchesSize = sizeFilter === '' || item.size === sizeFilter;
      
      const itemUnit = (item.unit_type || '').toLowerCase();
      const filterUnit = unitTypeFilter.toLowerCase();
      
      const matchesUnitType = unitTypeFilter === '' || 
        itemUnit === filterUnit ||
        (filterUnit === 'ri nhí' && itemUnit.includes('ri nhí')) ||
        (filterUnit === 'ri đại' && itemUnit.includes('ri đại')) ||
        (filterUnit === 'tuỳ chọn' && (!itemUnit.includes('ri nhí') && !itemUnit.includes('ri đại')));

      return matchesSearch && matchesColor && matchesSize && matchesUnitType;
    });
  }, [stock, searchQuery, colorFilter, sizeFilter, unitTypeFilter]);

  const totalStockQuantity = filteredStock.reduce((sum, item) => sum + item.quantity, 0);

  // Grouping logic (product_code -> color -> size_set_id/unit_type -> size)
  const productCards = useMemo(() => {
    const productsMap: { [code: string]: ProductCard } = {};

    filteredStock.forEach(item => {
      const code = item.product_code || item.products?.code || 'N/A';
      if (!productsMap[code]) {
        productsMap[code] = {
          product_id: item.product_id || item.products?.id || '',
          product_code: code,
          product_name: code,
          product_note: item.note || item.products?.note || '',
          totalQuantity: 0,
          colors: [],
          groups: []
        };
      }

      productsMap[code].totalQuantity += item.quantity;
      if (item.color && !productsMap[code].colors.includes(item.color)) {
        productsMap[code].colors.push(item.color);
      }

      const color = item.color || 'Mặc định';
      const groupName = item.unit_type || 'Tuỳ chọn';

      let group = productsMap[code].groups.find(g => g.color === color && g.size_set_name === groupName);
      if (!group) {
        group = {
          size_set_name: groupName,
          size_set_id: null,
          color: color,
          totalQuantity: 0,
          sizes: []
        };
        productsMap[code].groups.push(group);
      }

      group.totalQuantity += item.quantity;

      let sizeCard = group.sizes.find(s => s.size === item.size);
      if (sizeCard) {
        sizeCard.quantity += item.quantity;
      } else {
        group.sizes.push({
          size: item.size,
          quantity: item.quantity,
          inventory_id: item.id,
          note: item.note || '',
          color: color
        });
      }
    });

    // Sort sizes numerically or alphabetically within each group
    Object.values(productsMap).forEach(prod => {
      prod.groups.forEach(g => {
        g.sizes.sort((a, b) => {
          const numA = parseInt(a.size, 10);
          const numB = parseInt(b.size, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.size.localeCompare(b.size);
        });
      });
    });

    return Object.values(productsMap);
  }, [filteredStock]);

  const selectedProduct = useMemo(() => {
    return productCards.find(p => p.product_code === selectedProductCode);
  }, [productCards, selectedProductCode]);

  // Product Delete handler with Cascade confirmation
  const handleDeleteProduct = (productCode: string) => {
    setConfirmDelete({
      isOpen: true,
      itemId: productCode,
      deleteType: 'product',
      title: 'Xác nhận xoá toàn bộ mã hàng',
      message: `Bạn có chắc chắn muốn xoá vĩnh viễn mã hàng "${productCode}" cùng toàn bộ tồn kho (tất cả các màu, tất cả các nhóm size) liên quan không? Thao tác này sẽ làm mất sạch số lượng của mã hàng này và không thể khôi phục.`
    });
  };

  const handleSaveProductEdit = async () => {
    if (!editingProductId) return;
    const finalCode = editingProductCode.trim().toUpperCase();
    const finalName = editingProductName.trim();
    const finalNote = editingProductNote.trim();

    if (!finalCode) {
      showToast('Mã sản phẩm không được để trống.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      // Check duplicate code
      const { data: existingProds, error: checkErr } = await supabase
        .from('products')
        .select('id')
        .eq('code', finalCode)
        .neq('id', editingProductId);

      if (checkErr) throw checkErr;
      if (existingProds && existingProds.length > 0) {
        showToast(`Mã sản phẩm "${finalCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã khác.`, 'error');
        return;
      }

      // Update product table
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          code: finalCode,
          note: finalNote || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProductId);

      if (updateErr) throw updateErr;

      const { error: batchCodeErr } = await supabase
        .from('inventory_batches')
        .update({
          product_code: finalCode,
          updated_at: new Date().toISOString()
        })
        .eq('product_id', editingProductId);

      if (batchCodeErr) throw batchCodeErr;

      showToast('Đã cập nhật thông tin sản phẩm thành công.', 'success');
      setIsEditingProduct(false);
      setSelectedProductCode(finalCode); // update current selected view if code changed
      await fetchStock();
    } catch (err: any) {
      showToast('Không thể cập nhật sản phẩm: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Danh sách quản lý tồn kho</h2>
          <p className="text-xs text-slate-500 mt-0.5">Hiển thị dạng card phân tầng thông minh và cập nhật số lượng tồn tức thì</p>
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-400 rounded-2xl px-5 py-2.5 text-right shrink-0 shadow-md text-white animate-fade-in">
          <span className="text-[10px] font-bold text-emerald-100 block uppercase tracking-wider">Tổng tồn kho</span>
          <span className="text-base font-black font-mono">
            {totalStockQuantity.toLocaleString('vi-VN')} <span className="text-xs font-normal font-sans text-emerald-50">cái</span>
          </span>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-xs font-semibold rounded-xl"
            />
          </div>

          {/* Color filter */}
          <div>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-xs font-semibold rounded-xl"
            >
              <option value="">Tất cả màu sắc</option>
              {allColors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          {/* Size filter */}
          <div>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-xs font-semibold rounded-xl"
            >
              <option value="">Tất cả các Size</option>
              {allSizes.map(size => (
                <option key={size} value={size}>Size {size}</option>
              ))}
            </select>
          </div>

          {/* Unit/Ri Type filter */}
          <div>
            <select
              value={unitTypeFilter}
              onChange={(e) => setUnitTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-xs font-semibold rounded-xl"
            >
              <option value="">Tất cả loại Ri/Size</option>
              <option value="Ri nhí">Ri nhí</option>
              <option value="Ri đại">Ri đại</option>
              <option value="Tuỳ chọn">Tuỳ chọn tự do</option>
            </select>
          </div>
        </div>

        {/* Clear filters button */}
        {(searchQuery || colorFilter || sizeFilter || unitTypeFilter) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSearchQuery('');
                setColorFilter('');
                setSizeFilter('');
                setUnitTypeFilter('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Xoá bộ lọc tìm kiếm
            </button>
          </div>
        )}
      </div>

      {/* Main Hierarchical Rendering */}
      {loading ? (
        <div className="py-24 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Đang đồng bộ danh mục tồn kho từ Supabase...</p>
        </div>
      ) : filteredStock.length > 0 ? (
        <div className="space-y-4">
          
          {/* Level 1: Products List View */}
          {selectedProductCode === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in font-sans">
              {productCards.map((prod) => (
                <div
                  key={prod.product_code}
                  onClick={() => setSelectedProductCode(prod.product_code)}
                  className="relative overflow-hidden rounded-3xl border border-blue-400 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-lg transition-all duration-350 hover:-translate-y-1.5 hover:shadow-2xl hover:border-blue-300 cursor-pointer group flex flex-col justify-between min-h-[290px]"
                >
                  {/* Decorative ambient glowing circle */}
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl pointer-events-none transition-transform group-hover:scale-125 duration-500" />
                  
                  <div>
                    {/* Header: Product Code and Delete Button */}
                    <div className="relative flex items-start justify-between z-10">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-blue-150">
                          Mã hàng
                        </div>
                        <div className="mt-1 text-4xl font-black font-mono tracking-tight text-white drop-shadow-xs">
                          {prod.product_code}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold text-white backdrop-blur-xs uppercase tracking-wide border border-white/10 shadow-xs">
                          MÃ HÀNG
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(prod.product_code);
                          }}
                          className="p-1.5 bg-white/15 hover:bg-red-600 hover:text-white text-white/80 rounded-xl transition-all cursor-pointer border border-white/10 shadow-xs hover:border-red-500"
                          title="Xoá toàn bộ mã hàng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata body: Colors count & Groups count & Total Stock inside grid */}
                    <div className="relative mt-6 grid grid-cols-3 gap-3 z-10">
                      <div className="rounded-xl bg-white/15 p-3 backdrop-blur-xs border border-white/10 flex flex-col justify-between">
                        <div className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Tổng tồn</div>
                        <div className="mt-1 text-xl font-black font-mono">{prod.totalQuantity}</div>
                        <div className="text-[9px] text-blue-200">cái</div>
                      </div>

                      <div className="rounded-xl bg-white/15 p-3 backdrop-blur-xs border border-white/10 flex flex-col justify-between">
                        <div className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Màu sắc</div>
                        <div className="mt-1 text-xl font-black font-mono">{prod.colors.length}</div>
                        <div className="text-[9px] text-blue-200">màu</div>
                      </div>

                      <div className="rounded-xl bg-white/15 p-3 backdrop-blur-xs border border-white/10 flex flex-col justify-between">
                        <div className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Nhóm Ri</div>
                        <div className="mt-1 text-xl font-black font-mono">{prod.groups.length}</div>
                        <div className="text-[9px] text-blue-200">nhóm</div>
                      </div>
                    </div>

                    {/* Render color badges with pretty background style mapping */}
                    {prod.colors.length > 0 && (
                      <div className="relative flex flex-wrap gap-1.5 mt-4 z-10">
                        {prod.colors.map(c => (
                          <span 
                            key={c} 
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg shadow-2xs transition-all ${getColorBadgeStyle(c)}`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer button */}
                  <div className="relative mt-5 z-10">
                    <button className="w-full rounded-xl bg-white px-4 py-2.5 text-xs font-black text-indigo-700 transition hover:bg-blue-50 flex items-center justify-center gap-1.5 shadow-md">
                      Xem chi tiết &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Level 2: Inside a Product - Groups List View
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-2 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductCode(null);
                      setSelectedGroup(null);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                  >
                    &larr; Quay lại danh sách
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProduct) {
                        setEditingProductId(selectedProduct.product_id);
                        setEditingProductCode(selectedProduct.product_code);
                        setEditingProductName(selectedProduct.product_name || '');
                        setEditingProductNote(selectedProduct.product_note || '');
                        setIsEditingProduct(true);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Sửa thông tin sản phẩm
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">Đang xem mã hàng:</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black rounded-lg text-xs uppercase tracking-wider">
                    {selectedProductCode}
                  </span>
                </div>
              </div>

              {selectedProduct && (selectedProduct.product_name || selectedProduct.product_note) && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-xs text-slate-600 leading-relaxed">
                  {selectedProduct.product_name && (
                    <p><span className="font-bold text-slate-700 uppercase mr-1">Tên hàng:</span> <span className="font-semibold text-slate-900">{selectedProduct.product_name}</span></p>
                  )}
                  {selectedProduct.product_note && (
                    <p className="mt-1 text-slate-500 italic"><span className="font-bold text-slate-600 uppercase not-italic mr-1">Mô tả:</span> {selectedProduct.product_note}</p>
                  )}
                </div>
              )}

              {selectedProduct ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {selectedProduct.groups.map((group, idx) => {
                    let bgGradientClass = "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white border-purple-400";
                    let badgeClass = "bg-white/20 text-white border border-white/10 backdrop-blur-xs shadow-xs";
                    let textMutedClass = "text-purple-100";
                    let colorBadgeClass = "bg-white text-purple-900 border border-purple-200 font-extrabold shadow-sm";
                    
                    const groupNameLower = group.size_set_name.toLowerCase();
                    if (groupNameLower.includes('nhí') || groupNameLower.includes('nhi')) {
                      bgGradientClass = "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white border-emerald-400";
                      badgeClass = "bg-white/20 text-white border border-white/10 backdrop-blur-xs shadow-xs";
                      textMutedClass = "text-emerald-100";
                      colorBadgeClass = "bg-white text-emerald-900 border border-emerald-200 font-extrabold shadow-sm";
                    } else if (groupNameLower.includes('đại') || groupNameLower.includes('dai')) {
                      bgGradientClass = "bg-gradient-to-br from-orange-500 via-amber-500 to-red-600 text-white border-orange-400";
                      badgeClass = "bg-white/20 text-white border border-white/10 backdrop-blur-xs shadow-xs";
                      textMutedClass = "text-orange-100";
                      colorBadgeClass = "bg-white text-orange-900 border border-orange-200 font-extrabold shadow-sm";
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedGroup(group)}
                        className={`relative overflow-hidden p-5 rounded-2xl border ${bgGradientClass} shadow-md hover:-translate-y-1 hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between group min-h-[195px]`}
                      >
                        {/* Decorative ambient glowing circle */}
                        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl pointer-events-none transition-transform group-hover:scale-125 duration-300" />
                        
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center justify-between">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${badgeClass}`}>
                              {group.size_set_name}
                            </span>
                            <span className={`px-2.5 py-0.5 text-[10px] rounded-lg ${colorBadgeClass}`}>
                              Màu: {group.color}
                            </span>
                          </div>

                          <div className="pt-1">
                            <span className={`text-[10px] ${textMutedClass} block font-semibold uppercase tracking-wider`}>Số size trong nhóm</span>
                            <span className="text-xl font-black">{group.sizes.length} sizes</span>
                          </div>
                        </div>

                        <div className="relative mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold z-10">
                          <div className="flex flex-col">
                            <span className={`text-[9px] ${textMutedClass} uppercase font-extrabold tracking-wider`}>Lượng tồn trong Ri</span>
                            <span className="font-mono text-xl font-black">
                              {group.totalQuantity} <span className="text-xs font-medium opacity-80">cái</span>
                            </span>
                          </div>
                          <span className="group-hover:translate-x-1 transition-transform bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-xs">
                            Xem chi tiết &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Mã hàng không có tồn kho phù hợp.</p>
              )}
            </div>
          )}

          {/* Level 3: Sizes List Modal / Drawer */}
          {selectedGroup && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-40 p-4 animate-fade-in no-print">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black rounded-lg text-xs uppercase tracking-wider">
                        {selectedProductCode}
                      </span>
                      <span className="text-slate-300">/</span>
                      <span className="text-xs font-extrabold text-slate-600">
                        Nhóm: {selectedGroup.size_set_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Màu sắc:</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded border border-blue-100">
                        {selectedGroup.color}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2">Tổng tồn nhóm:</span>
                      <span className="text-xs font-black text-slate-800 font-mono">
                        {selectedGroup.totalQuantity} cái
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedGroup(null);
                      setEditingId(null);
                    }}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Body - Sizes Cards Grid */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {selectedGroup.sizes.map((sizeItem) => {
                      const isEditing = editingId === sizeItem.inventory_id;

                      if (isEditing) {
                        return (
                          <div
                            key={sizeItem.inventory_id}
                            className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-md animate-fade-in"
                          >
                            <div className="flex justify-between items-center text-xs text-blue-800 font-bold">
                              <span>Size {sizeItem.size}</span>
                              <span className="px-1.5 py-0.5 bg-blue-100 rounded text-[10px] text-slate-600 font-semibold">{sizeItem.color}</span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">Số lượng:</span>
                              <input
                                type="number"
                                min="0"
                                value={editQty}
                                onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 0)}
                                className="w-full text-center font-bold font-mono text-xs bg-white border border-blue-400 rounded-xl py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">Ghi chú:</span>
                              <input
                                type="text"
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="Note..."
                                className="w-full text-[10px] bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>

                            <div className="flex gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(sizeItem.inventory_id)}
                                disabled={actionLoading}
                                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center cursor-pointer font-bold text-[10px]"
                              >
                                <Check className="h-3 w-3 mr-1" /> Lưu
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg flex items-center justify-center cursor-pointer font-bold text-[10px]"
                              >
                                Huỷ
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Define status styling based on quantity
                      let statusCardClass = "bg-white border-slate-200 hover:border-blue-400 hover:shadow-blue-500/5";
                      let statusBadgeClass = "bg-emerald-600 text-white";
                      let qtyLabelText = "Còn hàng";
                      
                      if (sizeItem.quantity <= 0) {
                        statusCardClass = "bg-red-50/40 border-red-200 hover:border-red-400 hover:shadow-red-500/5 opacity-75";
                        statusBadgeClass = "bg-red-500 text-white";
                        qtyLabelText = "Hết hàng";
                      } else if (sizeItem.quantity <= 20) {
                        statusCardClass = "bg-amber-50/40 border-amber-200 hover:border-amber-400 hover:shadow-amber-500/5";
                        statusBadgeClass = "bg-amber-500 text-white";
                        qtyLabelText = "Sắp hết";
                      } else {
                        statusCardClass = "bg-emerald-50/40 border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-500/5";
                        statusBadgeClass = "bg-emerald-500 text-white";
                      }

                      return (
                        <div
                          key={sizeItem.inventory_id}
                          className={`rounded-2xl p-4.5 flex flex-col justify-between transition-all relative group shadow-sm ${statusCardClass}`}
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Size</span>
                              <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-extrabold rounded-md shadow-xs">
                                {sizeItem.color}
                              </span>
                            </div>
                            
                            {/* Huge Size text */}
                            <div className="text-3xl font-black text-slate-900 font-mono mt-1">
                              {sizeItem.size}
                            </div>
                            
                            {/* Quantity Indicator with beautiful dynamic badge */}
                            <div className="mt-3 flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${statusBadgeClass}`}>
                                {sizeItem.quantity} cái
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">{qtyLabelText}</span>
                            </div>

                            {sizeItem.note && (
                              <p className="text-[10px] text-slate-400 italic mt-2 line-clamp-2 bg-white/50 p-1.5 rounded-lg border border-slate-100" title={sizeItem.note}>
                                * {sizeItem.note}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-1.5 justify-end mt-4 pt-2 border-t border-slate-100 relative z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(sizeItem);
                              }}
                              className="p-1.5 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                              title="Sửa số lượng"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItemClick(sizeItem.inventory_id, sizeItem.size);
                              }}
                              className="p-1.5 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                              title="Xoá tồn"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedGroup(null);
                      setEditingId(null);
                    }}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-950 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Đóng chi tiết
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
          <Boxes className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">Không tìm thấy hàng tồn kho khớp bộ lọc</p>
          <p className="text-xs text-slate-400 mt-1">Vui lòng thử điều chỉnh lại bộ lọc hoặc vào tab Nhập Kho để bổ sung.</p>
        </div>
      )}

      {/* Edit Product Info Modal */}
      {isEditingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-amber-50 text-slate-800">
              <div className="p-2 bg-amber-100 rounded-xl">
                <Edit3 className="h-5 w-5 text-amber-700" />
              </div>
              <h3 className="font-bold text-base text-slate-800">Chỉnh sửa thông tin sản phẩm</h3>
            </div>
            
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Mã sản phẩm (Viết HOA, không cách):</label>
                <input
                  type="text"
                  value={editingProductCode}
                  onChange={(e) => setEditingProductCode(e.target.value)}
                  className="w-full bg-white px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm uppercase"
                  placeholder="Ví dụ: VAY01"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Tên sản phẩm:</label>
                <input
                  type="text"
                  value={editingProductName}
                  onChange={(e) => setEditingProductName(e.target.value)}
                  className="w-full bg-white px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-800"
                  placeholder="Ví dụ: Váy hoa nhí"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Ghi chú sản phẩm:</label>
                <textarea
                  rows={2}
                  value={editingProductNote}
                  onChange={(e) => setEditingProductNote(e.target.value)}
                  className="w-full bg-white px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs resize-none"
                  placeholder="Ghi chú thêm về lô mẫu, vải..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setIsEditingProduct(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveProductEdit}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
              >
                {actionLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Lưu thay đổi
              </button>
            </div>
          </div>
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
              <h3 className="font-bold text-base">{confirmDelete.title}</h3>
            </div>
            
            <div className="p-6">
              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmDelete.message}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete({ isOpen: false, itemId: null, title: '', message: '' })}
                disabled={actionLoading}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDelete}
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
