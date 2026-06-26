import { 
  LayoutDashboard, 
  PlusCircle, 
  Boxes, 
  FileSpreadsheet, 
  History, 
  Users, 
  DollarSign,
  DatabaseBackup,
  X,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', name: 'Tổng quan', icon: LayoutDashboard },
    { id: 'import', name: 'Nhập kho hàng', icon: PlusCircle },
    { id: 'inventory', name: 'Xem tồn kho', icon: Boxes },
    { id: 'invoice', name: 'Xuất hoá đơn', icon: FileSpreadsheet },
    { id: 'today_invoices', name: 'Hoá đơn hôm nay', icon: History },
    { id: 'customers', name: 'Khách hàng', icon: Users },
    { id: 'debt', name: 'Sổ nợ & Công nợ', icon: DollarSign },
    { id: 'backup', name: 'Backup & Restore', icon: DatabaseBackup },
  ] as const;

  const handleTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-900 border-r border-slate-200 shadow-xs">
      {/* Brand Logo */}
      <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-600 text-white font-bold shrink-0 shadow-sm">
            SR
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-800">
              ShopRi Manager
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">Kho Sỉ & Bán Hàng</p>
          </div>
        </div>
        {mobileOpen && (
          <button 
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 lg:hidden cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer group ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-100/50' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
              }`} />
              <span>{item.name}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/80 text-center">
        <p className="text-[10px] text-slate-500 font-mono font-medium">Dữ liệu Supabase thời gian thực</p>
        <p className="text-[9px] text-slate-400 mt-0.5">Phần mềm viết bởi Hoàng Uyên</p>
        <p className="text-[9px] text-slate-400 mt-0.5">Bản quyền thuộc về Hoàng Uyên 0931325512</p>
        <p className="text-[9px] text-slate-400 mt-0.5">Phiên bản v1.3.0 (Ổn định)</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          
          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 w-64 max-w-xs flex flex-col z-50 animate-slide-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
