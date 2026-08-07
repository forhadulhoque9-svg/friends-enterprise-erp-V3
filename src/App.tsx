import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase, getCashBalance } from './db/db';
import { dataManager } from './services/dataManager';
import Logo from './components/Logo';
import Dashboard from './modules/Dashboard';
import Products from './modules/Products';
import Customers from './modules/Customers';
import Sales from './modules/Sales';
import Purchases from './modules/Purchases';
import Inventory from './modules/Inventory';
import HawlatModule from './modules/Hawlat';
import BusinessProfileModule from './modules/business-profile/BusinessProfileModule';
import ReportsModule from './modules/reports/ReportsModule';
import DsrModule from './modules/dsr/DsrModule';
import DemandSheetModule from './modules/demand-sheet/DemandSheetModule';
import BackupRestore from './modules/BackupRestore';
import DamageManagement from './modules/DamageManagement';
import DailyExpenses from './modules/expenses/DailyExpenses';
import CompanyFinancials from './modules/CompanyFinancials';
import CompanyTargetDetail from './modules/CompanyTargetDetail';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  TrendingUp, 
  ShoppingBag, 
  Layers, 
  ShieldAlert, 
  Coins, 
  Settings, 
  Download, 
  Upload, 
  Wifi, 
  RefreshCw, 
  Trash2, 
  Save, 
  Image, 
  Check, 
  AlertTriangle,
  Building2,
  BarChart3,
  Truck,
  FileCheck,
  UserCheck,
  HardDrive,
  RotateCcw,
  Wallet,
  PieChart
} from 'lucide-react';

type ModuleTab = 'dashboard' | 'products' | 'customers' | 'sales' | 'purchases' | 'inventory' | 'damage' | 'hawlat' | 'reports' | 'dsr' | 'demand-sheet' | 'business-profile' | 'settings' | 'expenses' | 'financials' | 'target';

export default function App() {
  const [activeTab, setActiveTab] = useState<ModuleTab>('dashboard');
  const [dbSeeded, setDbSeeded] = useState(false);

  // Live query for configuration and general KPIs
  const profile = useLiveQuery(() => db.businessProfiles.get('bp_default'));
  const cashBal = useLiveQuery(() => getCashBalance());

  const compName = profile?.businessName || 'মেসার্স ফাহিম এন্টারপ্রাইজ';

  // Seed DB & Sync live stores on mount
  useEffect(() => {
    const runSync = async () => {
      await dataManager.syncAll();
      setDbSeeded(true);
    };
    runSync();
  }, []);


  const handleBackupDatabase = async () => {
    try {
      const backupData: Record<string, any> = {};
      const tableNames = db.tables.map(t => t.name);

      for (const name of tableNames) {
        backupData[name] = await db.table(name).toArray();
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `friends_enterprise_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error creating backup: ' + err);
    }
  };

  // RESTORE DATABASE: Parse uploaded JSON and bulk-overwrite tables
  const handleRestoreDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (confirm('Are you absolutely sure you want to restore this backup? Doing so will fully replace all current local data.')) {
            // Clear all tables first
            for (const table of db.tables) {
              await table.clear();
            }
            // Populate tables
            for (const [tableName, data] of Object.entries(parsed)) {
              if (db.tables.some(t => t.name === tableName)) {
                await db.table(tableName).bulkAdd(data as any[]);
              }
            }
            alert('Database Restored Successfully! Reloading workspace...');
            window.location.reload();
          }
        } catch (err) {
          alert('Failed to parse backup file. Please make sure it is a valid JSON backup exported from this ERP.');
        }
      };
      reader.readAsText(file);
    }
  };

  // RESET DATABASE to initial state
  const handleFactoryReset = async () => {
    if (confirm('DANGER: This will delete ALL transactions, products, customer balances, and configurations, resetting the database back to clean factory defaults. Proceed?')) {
      try {
        for (const table of db.tables) {
          await table.clear();
        }
        await seedDatabase();
        alert('ERP Database factory reset complete!');
        window.location.reload();
      } catch (err) {
        alert('Reset failed: ' + err);
      }
    }
  };

  // HARD RESET: Clear localStorage, sessionStorage, flush Dexie tables, sync empty state, and reload
  const handleHardResetState = async () => {
    if (confirm('Reset App State & Clear Storage? This will clear local/session storage, flush all cached state, and reload the application.')) {
      try {
        await dataManager.resetAndSync();
        window.location.reload();
      } catch (err) {
        console.error('Hard reset failed:', err);
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }
    }
  };

  if (!dbSeeded) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        <span className="text-xs font-bold text-slate-500 mt-4 font-mono tracking-widest uppercase">Initializing Offline IndexDB Engine...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50/70 text-slate-900 print:overflow-visible print:h-auto print:bg-white" id="friends-erp-root">
      
      {/* 1. LEFT SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex md:w-64 md:flex-col shrink-0 border-r border-slate-200/80 bg-white print:hidden">
        {/* Brand Logo Header */}
        <div className="flex h-16 items-center px-6 border-b border-slate-100">
          <Logo />
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Executive Desk</span>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-dashboard"
          >
            <LayoutDashboard className="h-4 w-4" /> ড্যাশবোর্ড
          </button>

          <button 
            onClick={() => setActiveTab('inventory')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'inventory' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-inventory"
          >
            <Package className="h-4 w-4" /> ইনভেন্টরি ও স্টক
          </button>

          <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-4 mb-2">Trading Sales</span>

          <button 
            onClick={() => setActiveTab('sales')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'sales' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-sales"
          >
            <TrendingUp className="h-4 w-4" /> সেলস ইনভয়েস ও মেমো
          </button>

          <button 
            onClick={() => setActiveTab('customers')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'customers' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-customers"
          >
            <Users className="h-4 w-4" /> কাস্টমার তালিকা
          </button>

          <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-4 mb-2">Field Sales & Logistics</span>

          <button 
            onClick={() => setActiveTab('dsr')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'dsr' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-dsr"
          >
            <UserCheck className="h-4 w-4" /> ডিএসআর ফিল্ড ভিজিট
          </button>

          <button 
            onClick={() => setActiveTab('demand-sheet')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'demand-sheet' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-demand-sheet"
          >
            <FileCheck className="h-4 w-4" /> ডিমান্ড স্লিপ ও চালান
          </button>

          <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-4 mb-2">Procurement & Claims</span>

          <button 
            onClick={() => setActiveTab('purchases')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'purchases' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-purchases"
          >
            <ShoppingBag className="h-4 w-4" /> ক্রয় ও সাপ্লায়ার লেজার
          </button>

          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'expenses' ? 'bg-rose-50 text-rose-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-expenses"
          >
            <Wallet className="h-4 w-4 text-rose-600" /> দৈনন্দিন খরচের খাত
          </button>

          <button 
            onClick={() => setActiveTab('damage')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'damage' ? 'bg-purple-50 text-purple-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-damage"
          >
            <ShieldAlert className="h-4 w-4 text-purple-600" /> ড্যামেজ ও ক্লেইম রেজিস্টার
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'reports' ? 'bg-indigo-50 text-indigo-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-reports"
          >
            <PieChart className="h-4 w-4" /> লাভ-ক্ষতির রিপোর্ট
          </button>

          <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-4 mb-2">Bespoke Ledgers</span>

          <button 
            onClick={() => setActiveTab('hawlat')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'hawlat' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-hawlat"
          >
            <Coins className="h-4 w-4" /> হাওলাত লেজার
          </button>

          <button 
            onClick={() => setActiveTab('products')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'products' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-products"
          >
            <Layers className="h-4 w-4" /> পণ্যের তালিকা (SKU)
          </button>

          <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-4 mb-2">System Admin</span>

          <button 
            onClick={() => setActiveTab('business-profile')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'business-profile' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-business-profile"
          >
            <Building2 className="h-4 w-4" /> ব্যবসায়িক প্রোফাইল
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold transition ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            id="nav-settings"
          >
            <HardDrive className="h-4 w-4 text-emerald-600" /> ব্যাকআপ ও রিস্টোর
          </button>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-mono text-slate-500 font-bold">Local Host: 127.0.0.1</span>
          </div>
          <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">Offline Database secured</span>
        </div>
      </aside>

      {/* 2. MAIN CORE STAGE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto">
        
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-6 print:hidden">
          <div className="flex items-center gap-4">
            {/* Small screen menu indicators / logo */}
            <div className="md:hidden flex items-center gap-2">
              <Logo iconOnly className="h-8" />
              <select 
                value={activeTab} 
                onChange={(e) => setActiveTab(e.target.value as ModuleTab)}
                className="rounded border border-slate-200 bg-white p-1 text-xs font-bold text-slate-900 focus:outline-none"
              >
                <option value="dashboard">ড্যাশবোর্ড</option>
                <option value="inventory">ইনভেন্টরি ও স্টক</option>
                <option value="sales">সেলস ইনভয়েস ও মেমো</option>
                <option value="customers">কাস্টমার তালিকা</option>
                <option value="dsr">ডিএসআর ফিল্ড ভিজিট</option>
                <option value="demand-sheet">ডিমান্ড স্লিপ ও চালান</option>
                <option value="purchases">ক্রয় ও সাপ্লায়ার লেজার</option>
                <option value="expenses">দৈনন্দিন খরচের খাত</option>
                <option value="damage">ড্যামেজ ও ক্লেইম রেজিস্টার</option>
                <option value="reports">লাভ-ক্ষতির রিপোর্ট</option>
                <option value="hawlat">হাওলাত লেজার</option>
                <option value="products">পণ্যের তালিকা (SKU)</option>
                <option value="business-profile">ব্যবসায়িক প্রোফাইল</option>
                <option value="settings">ব্যাকআপ ও রিস্টোর</option>
              </select>
            </div>

            <div className="hidden md:flex items-center gap-2 text-slate-400 text-xs font-medium">
              <span>{compName} ERP</span>
              <span>/</span>
              <span className="text-slate-900 font-bold capitalize">{activeTab} Console</span>
            </div>
          </div>

          {/* Connection diagnostics, database actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-3 py-1">
              <Coins className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] font-mono font-bold text-slate-700">Cash: ৳{(cashBal || 0).toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
              <Wifi className="h-3 w-3" /> Offline Native
            </div>

            {/* Reset App State & Clear Storage Button */}
            <button 
              onClick={handleHardResetState}
              className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
              title="Reset App State & Clear Storage"
              id="reset-app-state-btn"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
              <span className="hidden sm:inline">Reset App State & Clear Storage</span>
            </button>

            {/* Quick backup button in header */}
            <button 
              onClick={handleBackupDatabase}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition"
              title="Fast Backup Database"
            >
              <Download className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Active Stage Renderer */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 print:overflow-visible print:h-auto print:p-0 print:block">
          {activeTab === 'dashboard' && <Dashboard onNavigate={(mod) => setActiveTab(mod as any)} />}
          {activeTab === 'financials' && <CompanyFinancials />}
          {activeTab === 'target' && <CompanyTargetDetail />}
          {activeTab === 'products' && <Products />}
          {activeTab === 'customers' && <Customers />}
          {activeTab === 'sales' && <Sales />}
          {activeTab === 'purchases' && <Purchases />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'expenses' && <DailyExpenses />}
          {activeTab === 'damage' && <DamageManagement />}
          {activeTab === 'hawlat' && <HawlatModule />}
          {activeTab === 'reports' && <ReportsModule />}
          {activeTab === 'dsr' && <DsrModule />}
          {activeTab === 'demand-sheet' && <DemandSheetModule />}
          {activeTab === 'business-profile' && <BusinessProfileModule />}
          
          {/* TAB: BACKUP & RESTORE MODULE */}
          {activeTab === 'settings' && <BackupRestore />}

        </main>
      </div>

    </div>
  );
}
