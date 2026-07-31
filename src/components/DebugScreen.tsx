import React, { Component, ReactNode, ErrorInfo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, clearAndResetDatabase } from '../db/db';
import { Database, Activity, CheckCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DebugScreenErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DebugScreen caught a runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold mb-1">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>DebugScreen Runtime Error Caught:</span>
          </div>
          <pre className="text-[11px] font-mono bg-rose-100/60 p-2.5 rounded text-rose-800 whitespace-pre-wrap overflow-x-auto">
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function DebugScreenContent() {
  const [isClearing, setIsClearing] = useState(false);

  const handleClearPreviewDatabase = async () => {
    try {
      setIsClearing(true);
      await clearAndResetDatabase();
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear preview database:', err);
      alert('Failed to clear database: ' + (err instanceof Error ? err.message : String(err)));
      setIsClearing(false);
    }
  };

  const stats = useLiveQuery(async () => {
    try {
      const totalCompanies = await db.companies.count();
      const totalCustomers = await db.customers.count();
      const totalProducts = await db.products.count();
      const totalSales = await db.salesInvoices.count();
      const totalPurchases = await db.purchaseInvoices.count();

      // customerLedgers is indexed on (id, transactionId, referenceType, referenceId, customerId, isDeleted) in v3 schema.
      // Fetch all customer ledgers and filter by type in-memory to prevent IndexedDB SchemaError.
      const allCustomerLedgers = await db.customerLedgers.toArray();
      const totalCollections = allCustomerLedgers.filter(
        (entry: any) => entry.type === 'Payment' || entry.referenceType === 'CustomerPayment'
      ).length;

      const isAllZero =
        totalCompanies === 0 &&
        totalCustomers === 0 &&
        totalProducts === 0 &&
        totalSales === 0 &&
        totalPurchases === 0 &&
        totalCollections === 0;

      return {
        totalCompanies,
        totalCustomers,
        totalProducts,
        totalSales,
        totalPurchases,
        totalCollections,
        isAllZero,
        error: null
      };
    } catch (err: any) {
      console.error('Error fetching live debug metrics:', err);
      return {
        totalCompanies: 0,
        totalCustomers: 0,
        totalProducts: 0,
        totalSales: 0,
        totalPurchases: 0,
        totalCollections: 0,
        isAllZero: true,
        error: err?.message || String(err)
      };
    }
  });

  if (!stats) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Activity className="h-4 w-4 animate-spin text-indigo-600" />
          <span>Loading Live IndexedDB Debug Metrics...</span>
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold mb-1">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span>IndexedDB Query Warning:</span>
        </div>
        <p className="text-[11px] font-mono text-amber-800">{stats.error}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-4 shadow-xs" id="debug-screen-console">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-indigo-100 pb-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-600" />
          <h2 className="text-xs font-black uppercase tracking-wider text-indigo-950">
            Live IndexedDB Diagnostics Console
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearPreviewDatabase}
            disabled={isClearing}
            id="clear-preview-database-btn"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Deletes FriendsEnterpriseDB_v3 IndexedDB, recreates schema, seeds initial configs, and reloads page."
          >
            {isClearing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 text-white" />
            )}
            <span>Clear Preview Database</span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            <span>LIVE DATABASE CONNECTED</span>
          </div>
        </div>
      </div>

      {stats.isAllZero ? (
        <div className="my-2 p-3 text-center rounded-lg border border-amber-200 bg-amber-50/80 text-amber-900 font-bold text-xs flex items-center justify-center gap-2" id="live-db-no-data-msg">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="font-mono tracking-wider">LIVE DATABASE CONNECTED - NO DATA</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-2">
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Companies</span>
          <span className="text-lg font-black text-slate-900 font-mono">{stats.totalCompanies}</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Customers</span>
          <span className="text-lg font-black text-slate-900 font-mono">{stats.totalCustomers}</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Products</span>
          <span className="text-lg font-black text-slate-900 font-mono">{stats.totalProducts}</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Sales</span>
          <span className="text-lg font-black text-slate-900 font-mono">{stats.totalSales}</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Purchases</span>
          <span className="text-lg font-black text-slate-900 font-mono">{stats.totalPurchases}</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-2xs">
          <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Collections</span>
          <span className="text-lg font-black text-slate-900 font-mono">{stats.totalCollections}</span>
        </div>
      </div>
    </div>
  );
}

export default function DebugScreen() {
  return (
    <DebugScreenErrorBoundary>
      <DebugScreenContent />
    </DebugScreenErrorBoundary>
  );
}

