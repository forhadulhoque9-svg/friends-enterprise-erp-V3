import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getCashBalance } from '../../db/db';
import { 
  FileText, 
  BarChart3, 
  Scale, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Layers, 
  RefreshCw, 
  CheckCircle2, 
  Calendar, 
  PieChart
} from 'lucide-react';

export default function ReportsModule() {
  const [activeTab, setActiveTab] = useState<'pnl' | 'trial_balance' | 'cash_flow'>('pnl');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'today'>('all');

  // Live queries for Financial Reports calculation
  const salesInvoices = useLiveQuery(() => db.salesInvoices.toArray()) || [];
  const salesItems = useLiveQuery(() => db.salesInvoiceItems.toArray()) || [];
  const purchaseInvoices = useLiveQuery(() => db.purchaseInvoices.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const returns = useLiveQuery(() => db.returns.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const companies = useLiveQuery(() => db.companies.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const productBatches = useLiveQuery(() => db.productBatches.toArray()) || [];
  const cashBook = useLiveQuery(() => db.cashBook.toArray()) || [];
  const hawlats = useLiveQuery(() => db.hawlats.toArray()) || [];
  const currentCash = useLiveQuery(() => getCashBalance()) || 0;

  // 1. Calculate P&L metrics
  const totalGrossSales = salesInvoices.reduce((sum, inv) => sum + (inv.netTotal || 0), 0);
  const totalSalesDiscount = salesInvoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
  
  // Calculate Cost of Goods Sold (COGS)
  const totalCOGS = salesItems.reduce((sum, item) => {
    const qty = item.qty || item.quantity || 0;
    const edp = item.edp || item.dp || item.price || 0;
    return sum + (qty * edp);
  }, 0);

  const totalOperatingExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalSalesReturns = returns.filter(r => r.returnType === 'Sales_Return').reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
  
  const grossProfit = totalGrossSales - totalCOGS;
  const netOperatingProfit = grossProfit - totalOperatingExpenses - totalSalesReturns;

  // 2. Calculate Trial Balance metrics
  const totalAccountsReceivable = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalAccountsPayable = companies.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  
  // Inventory valuation (Cost Value)
  const totalInventoryValue = productBatches.reduce((sum, b) => {
    const available = b.availableStock ?? b.currentStock ?? 0;
    const cost = b.edp || b.dp || 0;
    return sum + (available * cost);
  }, 0) || products.reduce((sum, p) => sum + ((p.stock || 0) * (p.purchasePrice || 0)), 0);

  // Net Hawlat Balance
  const totalHawlatReceivable = hawlats.filter(h => h.cashBalance < 0).reduce((sum, h) => sum + Math.abs(h.cashBalance), 0);
  const totalHawlatPayable = hawlats.filter(h => h.cashBalance > 0).reduce((sum, h) => sum + h.cashBalance, 0);

  // Total Debits & Credits
  const totalDebit = currentCash + totalAccountsReceivable + totalInventoryValue + totalHawlatReceivable;
  const totalCredit = totalAccountsPayable + totalHawlatPayable + (netOperatingProfit > 0 ? netOperatingProfit : 0);
  const capitalBalance = totalDebit - totalCredit; // Balancing equity figure

  // 3. Cash Flow Summary
  const totalCashInflow = cashBook.reduce((sum, tx) => sum + (tx.cashIn || 0), 0);
  const totalCashOutflow = cashBook.reduce((sum, tx) => sum + (tx.cashOut || 0), 0);
  const netCashFlow = totalCashInflow - totalCashOutflow;

  // Export functions
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === 'pnl') {
      csvContent += "Statement,Amount (BDT)\n";
      csvContent += `Gross Sales Revenue,${totalGrossSales}\n`;
      csvContent += `Sales Discounts,${totalSalesDiscount}\n`;
      csvContent += `Cost of Goods Sold (COGS),${totalCOGS}\n`;
      csvContent += `Gross Profit,${grossProfit}\n`;
      csvContent += `Operating Expenses,${totalOperatingExpenses}\n`;
      csvContent += `Sales Returns,${totalSalesReturns}\n`;
      csvContent += `Net Profit,${netOperatingProfit}\n`;
    } else if (activeTab === 'trial_balance') {
      csvContent += "Account Head,Debit (BDT),Credit (BDT)\n";
      csvContent += `Cash Balance,${currentCash},0\n`;
      csvContent += `Accounts Receivable (Customers),${totalAccountsReceivable},0\n`;
      csvContent += `Stock Inventory Valuation,${totalInventoryValue},0\n`;
      csvContent += `Hawlat Receivables,${totalHawlatReceivable},0\n`;
      csvContent += `Accounts Payable (Suppliers),0,${totalAccountsPayable}\n`;
      csvContent += `Hawlat Payables,0,${totalHawlatPayable}\n`;
      csvContent += `Net Operating Profit,0,${netOperatingProfit > 0 ? netOperatingProfit : 0}\n`;
      csvContent += `Owner Equity / Retained Earnings,0,${capitalBalance}\n`;
    } else {
      csvContent += "Cash Flow Indicator,Amount (BDT)\n";
      csvContent += `Total Cash Inflow,${totalCashInflow}\n`;
      csvContent += `Total Cash Outflow,${totalCashOutflow}\n`;
      csvContent += `Net Operating Cash Flow,${netCashFlow}\n`;
      csvContent += `Ending Cash Balance,${currentCash}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `friends_erp_${activeTab}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="reports-module">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">Financial Reports & Analytics</h1>
            <p className="font-sans text-xs text-slate-500">Live Profit & Loss, Trial Balance Audit, and Cash Flow ledger analysis.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 py-1.5 px-3 text-xs font-bold shadow-sm transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 py-1.5 px-3 text-xs font-bold shadow-sm transition"
          >
            <Printer className="h-3.5 w-3.5" /> Print Statement
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 rounded-lg py-2 px-4 text-xs font-bold transition ${activeTab === 'pnl' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <TrendingUp className="h-4 w-4" /> Profit & Loss Statement
          </button>

          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`flex items-center gap-2 rounded-lg py-2 px-4 text-xs font-bold transition ${activeTab === 'trial_balance' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Scale className="h-4 w-4" /> Trial Balance Audit
          </button>

          <button
            onClick={() => setActiveTab('cash_flow')}
            className={`flex items-center gap-2 rounded-lg py-2 px-4 text-xs font-bold transition ${activeTab === 'cash_flow' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <DollarSign className="h-4 w-4" /> Cash Flow Summary
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
          <Calendar className="h-3.5 w-3.5" />
          <span>Real-time Dexie Engine Sync</span>
        </div>
      </div>

      {/* REPORT 1: PROFIT & LOSS STATEMENT */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Net Sales</span>
              <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">৳{totalGrossSales.toLocaleString()}</div>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3" /> {salesInvoices.length} Invoices Issued
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost of Goods Sold (COGS)</span>
              <div className="text-xl font-extrabold text-slate-800 mt-1 font-mono">৳{totalCOGS.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">Batch EDP procurement cost</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operating Expenses</span>
              <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono">৳{totalOperatingExpenses.toLocaleString()}</div>
              <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                <ArrowDownRight className="h-3 w-3" /> {expenses.length} Expense Logs
              </span>
            </div>

            <div className={`rounded-xl border p-4 shadow-sm ${netOperatingProfit >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Operating Profit</span>
              <div className={`text-2xl font-black mt-1 font-mono ${netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ৳{netOperatingProfit.toLocaleString()}
              </div>
              <span className="text-[10px] font-bold mt-1 block text-slate-600">
                {netOperatingProfit >= 0 ? 'Positive Margin Gain' : 'Deficit Operating Loss'}
              </span>
            </div>
          </div>

          {/* Detailed Financial Statement Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Income Statement Breakdown
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Currency: BDT</span>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              
              {/* Revenue */}
              <div className="space-y-2">
                <div className="flex justify-between font-extrabold text-slate-900 text-sm border-b border-slate-200 pb-1">
                  <span>1. Trading Sales Revenue</span>
                  <span></span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>Gross Sales Billed</span>
                  <span className="font-mono font-semibold">৳{(totalGrossSales + totalSalesDiscount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-500 italic">
                  <span>Less: Trade Discounts</span>
                  <span className="font-mono">- ৳{totalSalesDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pl-4 font-bold text-slate-900 pt-1 border-t border-dashed border-slate-200">
                  <span>Net Sales Revenue</span>
                  <span className="font-mono text-indigo-700">৳{totalGrossSales.toLocaleString()}</span>
                </div>
              </div>

              {/* COGS */}
              <div className="space-y-2 pt-3">
                <div className="flex justify-between font-extrabold text-slate-900 text-sm border-b border-slate-200 pb-1">
                  <span>2. Cost of Goods Sold (COGS)</span>
                  <span></span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>Product Inventory Cost Basis (EDP)</span>
                  <span className="font-mono font-semibold">- ৳{totalCOGS.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pl-4 font-extrabold text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                  <span>Gross Profit</span>
                  <span className="font-mono text-sm">৳{grossProfit.toLocaleString()}</span>
                </div>
              </div>

              {/* Operating Expenses */}
              <div className="space-y-2 pt-3">
                <div className="flex justify-between font-extrabold text-slate-900 text-sm border-b border-slate-200 pb-1">
                  <span>3. Operating Expenses & Returns</span>
                  <span></span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>Utility, Fuel & Admin Expenses</span>
                  <span className="font-mono text-rose-600">- ৳{totalOperatingExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>Customer Sales Returns & Refunds</span>
                  <span className="font-mono text-rose-600">- ৳{totalSalesReturns.toLocaleString()}</span>
                </div>
              </div>

              {/* Bottom Line Net Profit */}
              <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-center text-base font-black text-slate-900 bg-slate-50 p-4 rounded-xl">
                <span>NET OPERATING PROFIT / (LOSS)</span>
                <span className={`font-mono text-xl ${netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ৳{netOperatingProfit.toLocaleString()}
                </span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: TRIAL BALANCE */}
      {activeTab === 'trial_balance' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-2">
                <Scale className="h-4 w-4 text-indigo-600" /> Double-Entry Trial Balance Summary
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Auto-balanced Double-Entry Ledger</span>
            </div>

            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-extrabold text-slate-500 uppercase">
                  <th className="py-3 px-6">Account Ledger Classification</th>
                  <th className="py-3 px-4 text-right">Debit (BDT)</th>
                  <th className="py-3 px-4 text-right">Credit (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Cash-in-Hand / Vault Account</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳{currentCash.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Accounts Receivable (Customer Outstandings)</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳{totalAccountsReceivable.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Stock Inventory Asset (Valuation at EDP)</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳{totalInventoryValue.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                </tr>
                {totalHawlatReceivable > 0 && (
                  <tr>
                    <td className="py-3 px-6 font-semibold text-slate-900">Hawlat Debtors (Cash Receivable)</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳{totalHawlatReceivable.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                  </tr>
                )}
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Accounts Payable (Supplier Liabilities)</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳{totalAccountsPayable.toLocaleString()}</td>
                </tr>
                {totalHawlatPayable > 0 && (
                  <tr>
                    <td className="py-3 px-6 font-semibold text-slate-900">Hawlat Creditors (Cash Owed)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳{totalHawlatPayable.toLocaleString()}</td>
                  </tr>
                )}
                {netOperatingProfit > 0 && (
                  <tr>
                    <td className="py-3 px-6 font-semibold text-slate-900">Accumulated Operating Profit</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">৳{netOperatingProfit.toLocaleString()}</td>
                  </tr>
                )}
                <tr className="bg-slate-50/80">
                  <td className="py-3 px-6 font-semibold text-slate-900">Retained Owner Equity / Balancing Capital</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳0</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">৳{Math.max(0, capitalBalance).toLocaleString()}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-100 text-sm font-black text-slate-900">
                  <td className="py-3 px-6">TOTAL TRIAL BALANCE</td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-700">৳{totalDebit.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-700">৳{(totalCredit + Math.max(0, capitalBalance)).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: CASH FLOW SUMMARY */}
      {activeTab === 'cash_flow' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Total Cash Inflow</span>
              <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">৳{totalCashInflow.toLocaleString()}</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Sales Collections & Credits</span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total Cash Outflow</span>
              <div className="text-2xl font-black text-rose-700 mt-1 font-mono">৳{totalCashOutflow.toLocaleString()}</div>
              <span className="text-[10px] text-rose-600 font-semibold mt-1 block">Purchases, Expenses & Payments</span>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Net Cash Position</span>
              <div className="text-2xl font-black text-indigo-900 mt-1 font-mono">৳{currentCash.toLocaleString()}</div>
              <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">Live Vault / Cash Balance</span>
            </div>
          </div>

          {/* Cash Transactions Recent History */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" /> Recent Cashbook Flow Entries
              </h3>
              <span className="text-[10px] font-mono text-slate-500">{cashBook.length} Transactions</span>
            </div>

            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-extrabold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Reference</th>
                  <th className="py-2.5 px-4">Remarks</th>
                  <th className="py-2.5 px-4 text-right">Inflow (BDT)</th>
                  <th className="py-2.5 px-4 text-right">Outflow (BDT)</th>
                  <th className="py-2.5 px-4 text-right">Vault Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashBook.slice(-15).reverse().map((tx) => (
                  <tr key={tx.id || tx.refId} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-[11px]">{new Date(tx.date || tx.createdAt || '').toLocaleDateString()}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{tx.refId}</td>
                    <td className="py-2.5 px-4 text-slate-600">{tx.remarks}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {tx.cashIn > 0 ? `+৳${tx.cashIn.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      {tx.cashOut > 0 ? `-৳${tx.cashOut.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      ৳{(tx.balance ?? tx.balanceAfter ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
