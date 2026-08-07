import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getCashBalance } from '../../db/db';
import UniversalPrintModal from '../../components/UniversalPrintModal';
import { formatBanglaCurrency, toBanglaNumerals } from '../../lib/utils';
import companyLogoPng from '../../assets/images/company_logo.png';
import { 
  FileText, BarChart3, Scale, ArrowUpRight, ArrowDownRight, 
  Download, Printer, TrendingUp, TrendingDown, DollarSign, 
  Layers, RefreshCw, CheckCircle2, Calendar, PieChart, Filter,
  X, FileDown
} from 'lucide-react';


export default function ReportsModule() {
  const [activeTab, setActiveTab] = useState<'pnl' | 'trial_balance' | 'cash_flow'>('pnl');
  const [dateFilter, setDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState(false);

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
  const companyIncentives = useLiveQuery(() => db.companyIncentives?.toArray()) || [];
  const currentCash = useLiveQuery(() => getCashBalance()) || 0;
  const profile = useLiveQuery(() => db.businessProfiles.get('bp_default'));
  const compName = profile?.businessName || 'মেসার্স ফাহিম এন্টারপ্রাইজ';
  const compAddress = profile?.address || 'তেজগাঁও, ঢাকা';
  const logo = profile?.logoBase64 || companyLogoPng;


  // Filter helper
  const filterByDate = (items: any[], dateField = 'date') => {
    return items.filter(item => {
      if (!item || !item[dateField]) return true;
      const itemDate = new Date(item[dateField]);
      const today = new Date();
      if (dateFilter === 'today') {
        return itemDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'this_week') {
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        return itemDate >= firstDayOfWeek;
      } else if (dateFilter === 'this_month') {
        return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'custom') {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59);
          return itemDate >= start && itemDate <= end;
        }
      }
      return true;
    });
  };

  const filteredSalesInvoices = filterByDate(salesInvoices || []);
  const filteredExpenses = filterByDate((expenses || []).filter(e => e && !e.isDeleted));
  const filteredIncentives = filterByDate(companyIncentives || []);
  
  // 1. Calculate P&L metrics with extreme safety
  const totalNetSales = filteredSalesInvoices.reduce((sum, inv) => sum + (inv?.netTotal || 0), 0) || 0;
  const totalSalesDiscount = filteredSalesInvoices.reduce((sum, inv) => sum + (inv?.discount || 0), 0) || 0;
  const totalSalesReturns = filteredSalesInvoices.reduce((sum, inv) => sum + (inv?.totalReturnedAmount || 0), 0) || 0;
  
  // Gross Sales (Total Invoice Sales Amount)
  const totalGrossSales = filteredSalesInvoices.reduce((sum, inv) => {
    const subTotal = inv?.subTotal || 0;
    const returned = inv?.totalReturnedAmount || 0;
    return sum + subTotal + returned;
  }, 0) || 0;

  // Calculate Cost of Goods Sold (COGS) based on filtered invoices
  const totalCOGS = filteredSalesInvoices.reduce((sum, inv) => {
    return sum + (inv?.items || []).reduce((itemSum, item) => {
      const qty = item?.qty || item?.quantity || 0;
      const edp = item?.edp || item?.dp || 0;
      return itemSum + (qty * edp);
    }, 0);
  }, 0) || 0;

  const grossProfit = (totalNetSales - totalCOGS) || 0;

  const totalIncentiveIncome = filteredIncentives.reduce((sum, inc) => sum + (inc?.amount || 0), 0) || 0;

  // Operating Expenses Breakdown
  const dsrExpenses = filteredExpenses.filter(e => e && (e.category || '').includes('ডিএসআর') || (e.category || '').includes('টিএ/ডিএ')).reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
  const transportExpenses = filteredExpenses.filter(e => e && (e.category || '').includes('গাড়ি') || (e.category || '').includes('পরিবহন')).reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
  const rentExpenses = filteredExpenses.filter(e => e && (e.category || '').includes('গ্যারেজ') || (e.category || '').includes('গোডাউন')).reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
  const staffExpenses = filteredExpenses.filter(e => e && (e.category || '').includes('স্টাফ') || (e.category || '').includes('অফিস')).reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
  
  // Anything else goes to utility/other
  const categorizedExpenseTotal = dsrExpenses + transportExpenses + rentExpenses + staffExpenses;
  const totalOperatingExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp?.amount || 0), 0) || 0;
  const utilityExpenses = Math.max(0, totalOperatingExpenses - categorizedExpenseTotal);

  const netOperatingProfit = (grossProfit + totalIncentiveIncome) - totalOperatingExpenses;

  // 2. Calculate Trial Balance metrics (Non-filtered - Trial balance is usually as of today)
  const totalAccountsReceivable = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalAccountsPayable = companies.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  
  const totalInventoryValue = productBatches.reduce((sum, b) => {
    const available = b?.availableStock ?? b?.currentStock ?? 0;
    const cost = b?.edp || b?.dp || 0;
    return sum + (available * cost);
  }, 0) || products.reduce((sum, p) => sum + ((p?.stock || 0) * (p?.purchasePrice || 0)), 0);

  const totalHawlatReceivable = hawlats.filter(h => (h.cashBalance || 0) < 0).reduce((sum, h) => sum + Math.abs(h.cashBalance || 0), 0);
  const totalHawlatPayable = hawlats.filter(h => (h.cashBalance || 0) > 0).reduce((sum, h) => sum + (h.cashBalance || 0), 0);

  const totalDebit = currentCash + totalAccountsReceivable + totalInventoryValue + totalHawlatReceivable;
  const totalCredit = totalAccountsPayable + totalHawlatPayable + (netOperatingProfit > 0 ? netOperatingProfit : 0);
  const capitalBalance = totalDebit - totalCredit; 

  // 3. Cash Flow Summary (Filtered)
  const filteredCashBook = filterByDate(cashBook);
  const totalCashInflow = filteredCashBook.reduce((sum, tx) => sum + (tx.cashIn || 0), 0);
  const totalCashOutflow = filteredCashBook.reduce((sum, tx) => sum + (tx.cashOut || 0), 0);
  const netCashFlow = totalCashInflow - totalCashOutflow;

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (activeTab === 'pnl') {
      csvContent += "Statement,Amount (BDT)\n";
      csvContent += `Gross Sales,${totalGrossSales}\n`;
      csvContent += `Damage & Returns,${totalSalesReturns}\n`;
      csvContent += `Net Sales Revenue,${totalNetSales}\n`;
      csvContent += `COGS,${totalCOGS}\n`;
      csvContent += `Gross Profit,${grossProfit}\n`;
      csvContent += `Incentive Income,${totalIncentiveIncome}\n`;
      csvContent += `Operating Expenses,${totalOperatingExpenses}\n`;
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
      csvContent += `Net Cash Flow,${netCashFlow}\n`;
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `erp_report_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" id="reports-module">

      {/* ----------------- PRINT VIEW (ONLY VISIBLE ON PRINT) ----------------- */}
      <div className="hidden print:block font-sans text-slate-900 bg-white min-h-screen">
        <div className="text-center pb-4 border-b-2 border-slate-900 mb-6 space-y-2">
          {logo && <img src={logo} alt="Logo" className="h-16 w-auto mx-auto object-contain" referrerPolicy="no-referrer" />}
          <h1 className="text-2xl font-black uppercase text-slate-900">{compName}</h1>
          <p className="text-sm font-bold text-slate-600">{compAddress}</p>
          <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-slate-500">
            <span>ফোন: {toBanglaNumerals(profile?.phone)}</span>
          </div>
          <h2 className="text-xl font-black mt-4 bg-slate-900 text-white inline-block px-6 py-1 rounded-full">মাসিক আয়-ব্যয় ও লাভ-ক্ষতির বিবরণী</h2>
          <p className="text-xs font-bold mt-2">
            তারিখ সীমা: {dateFilter === 'today' ? 'আজ' : dateFilter === 'this_week' ? 'চলতি সপ্তাহ' : dateFilter === 'this_month' ? 'চলতি মাস' : dateFilter === 'custom' ? `${customStartDate} থেকে ${customEndDate}` : 'সব সময়'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">প্রিন্ট সময়: {new Date().toLocaleString('bn-BD')}</p>
        </div>

        <div className="space-y-4">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold">(+) মোট ইনভয়েস বিক্রয় (Gross Sales)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono font-bold">{formatBanglaCurrency(totalGrossSales)}</td>
              </tr>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold text-slate-600">(-) বিক্রয় ফেরত ও ড্যামেজ ছাড় (Damage & Sales Returns)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono text-slate-600">- {formatBanglaCurrency(totalSalesReturns)}</td>
              </tr>
              <tr className="bg-slate-100">
                <td className="py-2 px-2 font-black">= নিট বিক্রয় আয় (Net Sales Revenue)</td>
                <td className="py-2 px-2 text-right font-mono font-black">{formatBanglaCurrency(totalNetSales)}</td>
              </tr>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold text-slate-600">(-) বিক্রিত পণ্যের মূল ক্রয়মূল্য (COGS)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono text-slate-600">- {formatBanglaCurrency(totalCOGS)}</td>
              </tr>
              <tr className="bg-emerald-50">
                <td className="py-2 px-2 font-black text-emerald-900">= পণ্য বিক্রির নিট লাভ (Gross Profit)</td>
                <td className="py-2 px-2 text-right font-mono font-black text-emerald-900">{formatBanglaCurrency(grossProfit)}</td>
              </tr>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold">(+) কোম্পানি ইনসেন্টিভ ও ক্লেইম জমা (Incentive & Claims)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono font-bold text-emerald-700">+ {formatBanglaCurrency(totalIncentiveIncome)}</td>
              </tr>
              <tr>
                <td className="py-4 font-black underline" colSpan={2}>পরিচালন খরচ ব্রেকডাউন (Operating Expenses):</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">ডিএসআর/টিএ-ডিএ খরচ</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(dsrExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">গাড়ি ও পরিবহন খরচ</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(transportExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">গ্যারেজ ও গোডাউন ভাড়া</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(rentExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">স্টাফ ও অফিস খরচ</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(staffExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700 border-b border-slate-300">ইউটিলিটি ও অন্যান্য খরচ</td>
                <td className="py-1 border-b border-slate-300 text-right font-mono text-slate-700">{formatBanglaCurrency(utilityExpenses)}</td>
              </tr>
              <tr className="bg-rose-50">
                <td className="py-2 px-2 font-black text-rose-900">= মোট পরিচালন খরচ (Total Operating Expenses)</td>
                <td className="py-2 px-2 text-right font-mono font-black text-rose-900">{totalOperatingExpenses > 0 ? '-' : ''} {formatBanglaCurrency(totalOperatingExpenses)}</td>
              </tr>
              <tr className="border-t-2 border-slate-900 border-b-4">
                <td className="py-4 px-2 text-lg font-black uppercase">চূড়ান্ত নিট লাভ / ক্ষতি (NET OPERATING PROFIT / LOSS)</td>
                <td className="py-4 px-2 text-right font-mono text-xl font-black">{formatBanglaCurrency(netOperatingProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-32 grid grid-cols-3 gap-8 text-center text-sm font-bold">
          <div className="border-t border-slate-400 pt-2">প্রস্তুতকারক (Prepared By)</div>
          <div className="border-t border-slate-400 pt-2">হিসাবরক্ষক (Accountant)</div>
          <div className="border-t border-slate-400 pt-2">স্বত্বাধিকারী/ম্যানেজার (Proprietor/Manager)</div>
        </div>
      </div>
      {/* ----------------- END PRINT VIEW ----------------- */}

      {/* NORMAL VIEW (HIDDEN ON PRINT) */}
      <div className="print:hidden space-y-6">

      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">ফাইন্যান্সিয়াল রিপোর্টস (Reports)</h1>
            <p className="font-sans text-xs text-slate-500">লাভ-ক্ষতির হিসাব, ট্রায়াল ব্যালেন্স এবং ক্যাশ ফ্লো অডিট।</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 py-1.5 px-3 text-xs font-bold shadow-sm transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" /> ডাউনলোড CSV (Export CSV)
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'pnl') setActiveTab('pnl');
              setShowPrintModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 py-1.5 px-3 text-xs font-bold shadow-sm transition print:hidden"
          >
            <Printer className="h-3.5 w-3.5" /> প্রিন্ট বিবরণী (Print)
          </button>
        </div>
      </div>

      {/* Universal Print Modal */}
      <UniversalPrintModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="মাসিক আয়-ব্যয় ও লাভ-ক্ষতির বিবরণী"
        type="pnl"
        data={{
          totalGrossSales,
          totalSalesReturns,
          totalNetSales,
          totalCOGS,
          grossProfit,
          totalIncentiveIncome,
          totalOperatingExpenses,
          netOperatingProfit
        }}
      />

      {/* Report Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`flex items-center gap-2 rounded-lg py-2 px-4 text-xs font-bold transition ${activeTab === 'pnl' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <TrendingUp className="h-4 w-4" /> লাভ-ক্ষতির হিসাব (Profit & Loss)
          </button>
          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`flex items-center gap-2 rounded-lg py-2 px-4 text-xs font-bold transition ${activeTab === 'trial_balance' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Scale className="h-4 w-4" /> ট্রায়াল ব্যালেন্স (Trial Balance)
          </button>
          <button
            onClick={() => setActiveTab('cash_flow')}
            className={`flex items-center gap-2 rounded-lg py-2 px-4 text-xs font-bold transition ${activeTab === 'cash_flow' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <DollarSign className="h-4 w-4" /> ক্যাশ ফ্লো (Cash Flow)
          </button>
        </div>
      </div>

      {/* Filters (Date Range) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-end gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">তারিখ ফিল্টার:</span>
        </div>
        <select 
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold focus:border-indigo-500 focus:outline-none"
        >
          <option value="today">আজ (Today)</option>
          <option value="this_week">চলতি সপ্তাহ (This Week)</option>
          <option value="this_month">চলতি মাস (This Month)</option>
          <option value="all">সব সময় (All Time)</option>
          <option value="custom">কাস্টম তারিখ (Custom Date)</option>
        </select>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500 font-bold">থেকে</span>
            <input 
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* REPORT 1: PROFIT & LOSS STATEMENT */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">মোট বিক্রয় (Net Sales Revenue)</span>
              <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{formatBanglaCurrency(totalNetSales)}</div>
              <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                ড্যামেজ ছাড়ের পর নিট বিক্রয়
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">পণ্য বিক্রির মোট লাভ (Gross Profit)</span>
              <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">{formatBanglaCurrency(grossProfit)}</div>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">নিট বিক্রয় - বিক্রিত পণ্যের খরচ</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">মোট পরিচালন খরচ (Total Expenses)</span>
              <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono">{formatBanglaCurrency(totalOperatingExpenses)}</div>
              <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                <ArrowDownRight className="h-3 w-3" /> {toBanglaNumerals(filteredExpenses.length)} টি খরচ এন্ট্রি
              </span>
            </div>

            <div className={`rounded-xl border p-4 shadow-sm ${netOperatingProfit >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">প্রকৃত নিট লাভ / ক্ষতি (Net Profit)</span>
              <div className={`text-2xl font-black mt-1 font-mono ${netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatBanglaCurrency(netOperatingProfit)}
              </div>
              <span className="text-[10px] font-bold mt-1 block text-slate-600">
                {netOperatingProfit >= 0 ? 'নিট লাভ (Positive Profit)' : 'ক্ষতি (Loss)'}
              </span>
            </div>
          </div>

          {/* Detailed Financial Statement Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> বিস্তারিত আয়-ব্যয় বিবরণী (Income Statement)
              </h3>
            </div>

            <div className="p-6 space-y-4 text-sm font-sans">
              
              {/* Section A: Sales & Gross Profit */}
              <div className="space-y-2">
                <div className="flex justify-between font-extrabold text-slate-900 border-b border-slate-200 pb-1">
                  <span>সেকশন ক: নিট বিক্রয় ও পণ্য লাভ (Sales & Gross Profit)</span>
                  <span></span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>(+) মোট ইনভয়েস বিক্রয় (Total Gross Sales)</span>
                  <span className="font-mono">{formatBanglaCurrency(totalGrossSales)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-500 font-medium">
                  <span>(-) বিক্রয় থেকে ফেরত/ড্যামেজ ছাড় (Damage & Sales Returns)</span>
                  <span className="font-mono text-rose-600">- {formatBanglaCurrency(totalSalesReturns)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-500 font-medium">
                  <span>(-) অন্যান্য বিক্রয় ডিসকাউন্ট (Trade Discounts)</span>
                  <span className="font-mono text-rose-600">- {formatBanglaCurrency(totalSalesDiscount)}</span>
                </div>
                <div className="flex justify-between pl-4 font-extrabold text-slate-900 pt-1 border-t border-dashed border-slate-200">
                  <span>= নিট বিক্রয় আয় (Net Sales Revenue)</span>
                  <span className="font-mono text-indigo-700">{formatBanglaCurrency(totalNetSales)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium mt-2">
                  <span>(-) বিক্রিত পণ্যের মূল খরচ (COGS)</span>
                  <span className="font-mono text-rose-600">- {formatBanglaCurrency(totalCOGS)}</span>
                </div>
                <div className="flex justify-between pl-4 font-extrabold text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100 mt-2">
                  <span>= পণ্য বিক্রির নিট লাভ (Gross Profit)</span>
                  <span className="font-mono">{formatBanglaCurrency(grossProfit)}</span>
                </div>
              </div>

              {/* Section B: Other Revenue */}
              <div className="space-y-2 pt-3">
                <div className="flex justify-between font-extrabold text-slate-900 border-b border-slate-200 pb-1">
                  <span>সেকশন খ: অতিরিক্ত আয় (Other Revenue)</span>
                  <span></span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>(+) কোম্পানি ইনসেন্টিভ ও স্কিম জমা (Company Incentive Adjustments)</span>
                  <span className="font-mono font-bold text-emerald-700">+ {formatBanglaCurrency(totalIncentiveIncome)}</span>
                </div>
              </div>

              {/* Section C: Operating Expenses */}
              <div className="space-y-2 pt-3">
                <div className="flex justify-between font-extrabold text-slate-900 border-b border-slate-200 pb-1">
                  <span>সেকশন গ: পরিচালন খরচ ও ডিএসআর ফিল্ড খরচ (Operating Expenses)</span>
                  <span></span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>ডিএসআর/টিএ-ডিএ খরচ (DSR Expenses & Allowances)</span>
                  <span className="font-mono text-slate-600">{formatBanglaCurrency(dsrExpenses)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>গাড়ি ও পরিবহন খরচ (Transport Expenses)</span>
                  <span className="font-mono text-slate-600">{formatBanglaCurrency(transportExpenses)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>গ্যারেজ ও গোডাউন ভাড়া (Garage & Warehouse Rent)</span>
                  <span className="font-mono text-slate-600">{formatBanglaCurrency(rentExpenses)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>স্টাফ ও অফিস খরচ (Staff Salaries & Admin)</span>
                  <span className="font-mono text-slate-600">{formatBanglaCurrency(staffExpenses)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700 font-medium">
                  <span>ইউটিলিটি ও অন্যান্য খরচ (Utilities & Daily Expenses)</span>
                  <span className="font-mono text-slate-600">{formatBanglaCurrency(utilityExpenses)}</span>
                </div>
                <div className="flex justify-between pl-4 font-extrabold text-rose-800 pt-1 border-t border-dashed border-slate-200 mt-2">
                  <span>= মোট পরিচালন খরচ (Total Expenses)</span>
                  <span className="font-mono">{totalOperatingExpenses > 0 ? '-' : ''} {formatBanglaCurrency(totalOperatingExpenses)}</span>
                </div>
              </div>

              {/* Section D: Bottom Line Net Profit */}
              <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-center text-lg font-black text-slate-900 bg-slate-50 p-4 rounded-xl mt-4">
                <span>সেকশন ঘ: চূড়ান্ত নিট লাভ / ক্ষতি (NET OPERATING PROFIT / LOSS)</span>
                <span className={`font-mono text-2xl ${netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatBanglaCurrency(netOperatingProfit)}
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
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatBanglaCurrency(currentCash)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Accounts Receivable (Customer Outstandings)</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatBanglaCurrency(totalAccountsReceivable)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Stock Inventory Asset (Valuation at EDP)</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatBanglaCurrency(totalInventoryValue)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                </tr>
                {totalHawlatReceivable > 0 && (
                  <tr>
                    <td className="py-3 px-6 font-semibold text-slate-900">Hawlat Debtors (Cash Receivable)</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatBanglaCurrency(totalHawlatReceivable)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                  </tr>
                )}
                <tr>
                  <td className="py-3 px-6 font-semibold text-slate-900">Accounts Payable (Supplier Liabilities)</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatBanglaCurrency(totalAccountsPayable)}</td>
                </tr>
                {totalHawlatPayable > 0 && (
                  <tr>
                    <td className="py-3 px-6 font-semibold text-slate-900">Hawlat Creditors (Cash Owed)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatBanglaCurrency(totalHawlatPayable)}</td>
                  </tr>
                )}
                {netOperatingProfit > 0 && (
                  <tr>
                    <td className="py-3 px-6 font-semibold text-slate-900">Accumulated Operating Profit</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{formatBanglaCurrency(netOperatingProfit)}</td>
                  </tr>
                )}
                <tr className="bg-slate-50/80">
                  <td className="py-3 px-6 font-semibold text-slate-900">Retained Owner Equity / Balancing Capital</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">৳০.০০</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">{formatBanglaCurrency(Math.max(0, capitalBalance))}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-100 text-sm font-black text-slate-900">
                  <td className="py-3 px-6">TOTAL TRIAL BALANCE</td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-700">{formatBanglaCurrency(totalDebit)}</td>
                  <td className="py-3 px-4 text-right font-mono text-indigo-700">{formatBanglaCurrency(totalCredit + Math.max(0, capitalBalance))}</td>
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
              <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">{formatBanglaCurrency(totalCashInflow)}</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">Sales Collections & Credits</span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total Cash Outflow</span>
              <div className="text-2xl font-black text-rose-700 mt-1 font-mono">{formatBanglaCurrency(totalCashOutflow)}</div>
              <span className="text-[10px] text-rose-600 font-semibold mt-1 block">Purchases, Expenses & Payments</span>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Net Cash Position</span>
              <div className="text-2xl font-black text-indigo-900 mt-1 font-mono">{formatBanglaCurrency(currentCash)}</div>
              <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">Live Vault / Cash Balance</span>
            </div>
          </div>

          {/* Cash Transactions Recent History */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" /> Recent Cashbook Flow Entries
              </h3>
              <span className="text-[10px] font-mono text-slate-500">{filteredCashBook.length} Transactions</span>
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
                {filteredCashBook.slice(-15).reverse().map((tx) => (
                  <tr key={tx.id || tx.refId} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-[11px]">{new Date(tx.date || tx.createdAt || '').toLocaleDateString()}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{tx.refId}</td>
                    <td className="py-2.5 px-4 text-slate-600">{tx.remarks}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {tx.cashIn > 0 ? `+${formatBanglaCurrency(tx.cashIn)}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      {tx.cashOut > 0 ? `-${formatBanglaCurrency(tx.cashOut)}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatBanglaCurrency(tx.balance ?? tx.balanceAfter ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
