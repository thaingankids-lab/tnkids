import { useState, useEffect } from 'react';
import { ActiveTab } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ImportModule from './components/ImportModule';
import InventoryModule from './components/InventoryModule';
import InvoiceModule from './components/InvoiceModule';
import TodayInvoicesModule from './components/TodayInvoicesModule';
import CustomersModule from './components/CustomersModule';
import BackupRestoreModule from './components/BackupRestoreModule';
import TrackingView from './components/TrackingView';
import DatabaseCheckModal from './components/DatabaseCheckModal';
import { Menu, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  
  // Custom SPA router state for tracking link
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  useEffect(() => {
    // Parse URL path to detect "/tracking/KH-XXXXXX"
    const path = window.location.pathname;
    const trackingRegex = /^\/tracking\/([a-zA-Z0-9-]+)/;
    const match = path.match(trackingRegex);

    if (match && match[1]) {
      setTrackingToken(match[1]);
    } else {
      // Also check query param fallback like "?tracking=KH-123456"
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get('tracking');
      if (qToken) {
        setTrackingToken(qToken);
      }
    }
  }, []);

  // If tracking mode is detected, bypass admin layout and show tracking view directly
  if (trackingToken) {
    return <TrackingView token={trackingToken} />;
  }

  // Render Admin Layout
  return (
    <div className="min-h-screen bg-slate-50/60 font-sans flex text-slate-800">
      
      {/* Database Verification flow */}
      {!isValidated && (
        <DatabaseCheckModal onValidated={() => setIsValidated(true)} />
      )}

      {/* Main Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mobileOpen={mobileMenuOpen} 
        setMobileOpen={setMobileMenuOpen} 
      />

      {/* Content Area Wrap */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        
        {/* Top Sticky Header */}
        <header className="sticky top-0 bg-white border-b border-slate-100 z-10 px-5 py-3.5 flex items-center justify-between no-print shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-700 lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="h-3 w-3" />
                ADMINSECURE
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Dữ liệu bảo mật SSL</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            {/* Realtime database status bar */}
            <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Đồng bộ Supabase</span>
            </div>
          </div>
        </header>

        {/* Main Workspace Frame */}
        <main className="flex-1 p-5 md:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'import' && <ImportModule />}
          {activeTab === 'inventory' && <InventoryModule />}
          {activeTab === 'invoice' && <InvoiceModule onInvoiceCreated={() => setActiveTab('today_invoices')} />}
          {activeTab === 'today_invoices' && <TodayInvoicesModule />}
          {activeTab === 'customers' && <CustomersModule />}
          {activeTab === 'debt' && <CustomersModule />} {/* Debt utilizes the customers bookkeeping module */}
          {activeTab === 'backup' && <BackupRestoreModule />}
        </main>
      </div>

    </div>
  );
}
