import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { SalesInvoice } from '../types';
import ErrorBoundary from '../components/ErrorBoundary';
import UniversalPrintModal from '../components/UniversalPrintModal';
import { formatBanglaCurrency, toBanglaNumerals, formatBanglaDate } from '../lib/utils';
import companyLogoPng from '../assets/images/company_logo.png';
import { 
  Search, 
  Calendar, 
  MapPin, 
  FileText, 
  TrendingUp, 
  Wallet, 
  Printer, 
  Eye, 
  Trash2, 
  X, 
  Filter, 
  RefreshCw,
  CheckCircle2,
  Coins,
  Undo2,
  PackageMinus,
  PackageCheck
} from 'lucide-react';

// Helper: Format Number with Bangla Numerals
export function formatBanglaNumber(num: number | string | undefined | null): string {
  const numericVal = typeof num === 'number' ? num : parseFloat(String(num || 0));
  if (isNaN(numericVal)) return '০';
  return toBanglaNumerals(Math.round(numericVal).toLocaleString('en-US'));
}

function SalesInvoicesContent() {
  // Safe Live Dexie Database Queries
  const rawInvoices = useLiveQuery(() => db.salesInvoices.toArray()) || [];
  const routes = useLiveQuery(() => db.routes.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const companies = useLiveQuery(() => db.companies.toArray()) || [];
  const profile = useLiveQuery(() => db.businessProfiles.get('bp_default'));

  // Sort invoices by date descending safely in memory
  const invoices = useMemo(() => {
    if (!Array.isArray(rawInvoices)) return [];
    return [...rawInvoices].sort((a, b) => {
      const dateA = a?.date ? new Date(a.date).getTime() : 0;
      const dateB = b?.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [rawInvoices]);

  // Business details for print memo
  const configuredPhone = profile?.phone || '০১৮৩৫৯১২৫৯৭';
  const configuredOwner = profile?.owner || 'ফরহাদুল হক';
  const configuredBusinessName = profile?.businessName || 'ফ্রেন্ডস এন্টারপ্রাইজ';
  const logo = profile?.logoBase64 || companyLogoPng;

  const [showPrintModal, setShowPrintModal] = useState(false);

  // Filter States
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Active Invoice View / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string>('');

  // Invoice Product Return & EOD Reconciliation States
  const [returnInvoice, setReturnInvoice] = useState<SalesInvoice | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: string]: { cartons: number; loosePcs: number } }>({});
  const [isSavingReturn, setIsSavingReturn] = useState<boolean>(false);

  // Quick Preset Handlers
  const handlePresetDate = (type: 'today' | 'yesterday' | 'this_month' | 'all') => {
    const today = new Date();
    if (type === 'today') {
      const d = today.toISOString().split('T')[0];
      setFromDate(d);
      setToDate(d);
    } else if (type === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split('T')[0];
      setFromDate(d);
      setToDate(d);
    } else if (type === 'this_month') {
      setFromDate(firstDayOfMonth);
      setToDate(todayStr);
    } else if (type === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // Filtered Invoices Computation with complete null safety
  const filteredInvoices = useMemo(() => {
    if (!Array.isArray(invoices)) return [];
    return invoices.filter((inv) => {
      if (!inv) return false;

      // Date Filter
      const invDate = inv.date || '';
      if (fromDate && invDate < fromDate) return false;
      if (toDate && invDate > toDate) return false;

      // Market / Route Filter
      if (selectedRouteId) {
        const matchInvoiceRoute = inv.routeId === selectedRouteId;
        const cust = Array.isArray(customers) ? customers.find(c => c && c.id === inv.customerId) : null;
        const matchCustomerRoute = cust?.routeId === selectedRouteId;
        const selectedRoute = Array.isArray(routes) ? routes.find(r => r && r.id === selectedRouteId) : null;
        
        const routeName = selectedRoute?.routeName || '';
        const marketName = selectedRoute?.marketName || '';
        const custName = inv.customerName || '';
        
        const matchRouteName = Boolean(
          routeName && custName && (
            custName.includes(routeName) || (marketName && custName.includes(marketName))
          )
        );

        if (!matchInvoiceRoute && !matchCustomerRoute && !matchRouteName) {
          return false;
        }
      }

      // Search Term Filter (Memo / Invoice No, Customer Name, Shop Name, DSR Name, Items)
      if (searchTerm && searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const invNoMatch = (inv.invoiceNo || '').toLowerCase().includes(query);
        const custMatch = (inv.customerName || '').toLowerCase().includes(query);
        const dsrMatch = (inv.dsrName || '').toLowerCase().includes(query);
        const remarksMatch = (inv.remarks || '').toLowerCase().includes(query);

        // Check if item name matches
        const itemMatch = Array.isArray(inv.items) && inv.items.some(i => i && (i.name || '').toLowerCase().includes(query));

        if (!invNoMatch && !custMatch && !dsrMatch && !remarksMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, fromDate, toDate, selectedRouteId, searchTerm, customers, routes]);

  // Dynamic Summary Totals
  const totalSales = useMemo(() => {
    if (!Array.isArray(filteredInvoices)) return 0;
    return filteredInvoices.reduce((sum, inv) => sum + (Number(inv?.netTotal) || 0), 0);
  }, [filteredInvoices]);

  const totalCashCollected = useMemo(() => {
    if (!Array.isArray(filteredInvoices)) return 0;
    return filteredInvoices.reduce((sum, inv) => sum + (Number(inv?.cashPaid) || 0), 0);
  }, [filteredInvoices]);

  const totalDueAmount = useMemo(() => {
    if (!Array.isArray(filteredInvoices)) return 0;
    return filteredInvoices.reduce((sum, inv) => {
      const net = Number(inv?.netTotal) || 0;
      const cash = Number(inv?.cashPaid) || 0;
      const due = inv?.dueAmount !== undefined && inv?.dueAmount !== null 
        ? Number(inv.dueAmount) 
        : Math.max(0, net - cash);
      return sum + (isNaN(due) ? 0 : due);
    }, 0);
  }, [filteredInvoices]);

  // Open Return Goods Modal
  const handleOpenReturnModal = (inv: SalesInvoice) => {
    const initialQtys: { [productId: string]: { cartons: number; loosePcs: number } } = {};
    if (inv.items) {
      inv.items.forEach((item) => {
        initialQtys[item.productId] = {
          cartons: item.returnedCartons || 0,
          loosePcs: item.returnedLoosePcs || (item.returnedQty && !item.returnedCartons ? item.returnedQty : 0)
        };
      });
    }
    setReturnQuantities(initialQtys);
    setReturnInvoice(inv);
  };

  // Handle Save Returned Goods & Central Warehouse Stock Sync
  const handleSaveReturn = async () => {
    if (!returnInvoice) return;

    try {
      setIsSavingReturn(true);
      let totalReturnedVal = 0;
      let newGrossSales = 0;

      const updatedItems = returnInvoice.items.map((item) => {
        const p = products.find(prod => prod.id === item.productId);
        const pcsPerCtn = p?.pcsPerCarton || p?.cartonSize || 1;
        const entry = returnQuantities[item.productId] || { cartons: 0, loosePcs: 0 };
        
        // Calculate returned pcs (constrained to not exceed original delivered qty)
        const retPcs = Math.min(item.qty, Math.max(0, (entry.cartons || 0) * pcsPerCtn + (entry.loosePcs || 0)));
        const netQty = Math.max(0, item.qty - retPcs);
        const itemNetTotal = netQty * item.price;
        const itemReturnedValue = retPcs * item.price;

        totalReturnedVal += itemReturnedValue;
        newGrossSales += itemNetTotal;

        return {
          ...item,
          returnedQty: retPcs,
          returnedCartons: entry.cartons || 0,
          returnedLoosePcs: entry.loosePcs || 0,
          returnedAmount: itemReturnedValue,
          netQty: netQty,
          total: itemNetTotal
        };
      });

      const newSubTotal = newGrossSales;
      const newNetTotal = Math.max(0, newSubTotal - (returnInvoice.discount || 0));
      const newDueAmount = Math.max(0, newNetTotal - (returnInvoice.cashPaid || 0));

      // 1. Sync & Return Stock back to Central Warehouse Inventory
      for (const item of returnInvoice.items) {
        const entry = returnQuantities[item.productId] || { cartons: 0, loosePcs: 0 };
        const p = products.find(prod => prod.id === item.productId);
        const pcsPerCtn = p?.pcsPerCarton || p?.cartonSize || 1;
        const newRetPcs = Math.min(item.qty, Math.max(0, (entry.cartons || 0) * pcsPerCtn + (entry.loosePcs || 0)));
        const prevRetPcs = item.returnedQty || 0;
        const deltaRetPcs = newRetPcs - prevRetPcs;

        if (deltaRetPcs !== 0 && p && p.id) {
          const currentStk = p.stock || p.stockInPcs || 0;
          const updatedStk = Math.max(0, currentStk + deltaRetPcs);
          
          await db.products.update(p.id, {
            stock: updatedStk,
            stockInPcs: updatedStk
          });

          // Record stock ledger entry for returned goods
          if (deltaRetPcs > 0) {
            await db.stockLedgers.add({
              id: `stk_ret_${Date.now()}_${p.id}`,
              productId: p.id,
              productName: p.name || item.name,
              date: todayStr,
              type: 'Return',
              refId: returnInvoice.id,
              qtyIn: deltaRetPcs,
              qtyOut: 0,
              balance: updatedStk,
              remarks: `চালান #${returnInvoice.invoiceNo} পণ্য ফেরত সমন্বয় (গুদামে যুক্ত ${toBanglaNumerals(deltaRetPcs)} পিস)`
            });

            // Automated Sync to Damage Management Warehouse Stock
            const compObj = companies.find(c => c.id === p.companyId);
            const compId = p.companyId || compObj?.id || 'general_company';
            const compName = p.company || compObj?.name || 'সাধারণ কোম্পানি';
            const unitPrice = item.price || p.dp || p.purchasePricePcs || p.purchasePrice || 1;
            const damageVal = deltaRetPcs * unitPrice;
            const ctn = entry.cartons || Math.floor(deltaRetPcs / pcsPerCtn);
            const loose = entry.loosePcs || (deltaRetPcs % pcsPerCtn);

            await db.companyDamages.add({
              id: `dmg_ret_${Date.now()}_${p.id}`,
              companyId: compId,
              companyName: compName,
              productId: p.id,
              productName: p.name || item.name,
              qty: deltaRetPcs,
              cartons: ctn,
              loosePcs: loose,
              unitPrice: unitPrice,
              damageValue: damageVal,
              status: 'Pending',
              date: todayStr,
              remarks: `বিক্রয় চালান #${returnInvoice.invoiceNo} হতে স্বয়ংক্রিয় ড্যামেজ যুক্ত`,
              isOpeningStock: false
            });
          }
        }
      }

      // 2. Audit Trail Record in db.returns
      await db.returns.add({
        id: `ret_${Date.now()}_${returnInvoice.id}`,
        returnNo: `RET-${returnInvoice.invoiceNo}`,
        transactionId: returnInvoice.id,
        returnType: 'Sales_Return',
        customerId: returnInvoice.customerId,
        date: todayStr,
        totalRefundAmount: totalReturnedVal,
        paymentMethod: 'Stock_Adjustment',
        remarks: `চালান #${returnInvoice.invoiceNo} পণ্য ফেরত ও এন্ড-অব-ডে সমন্বয়`
      });

      // 3. Update Sales Invoice Record with new net totals
      await db.salesInvoices.update(returnInvoice.id, {
        items: updatedItems,
        subTotal: newSubTotal,
        netTotal: newNetTotal,
        dueAmount: newDueAmount,
        totalReturnedAmount: totalReturnedVal,
        isReturnProcessed: true,
        returnDate: todayStr
      });

      // 4. Adjust Customer Ledger Balance if due changed
      if (returnInvoice.customerId) {
        const cust = customers.find(c => c.id === returnInvoice.customerId);
        if (cust) {
          const oldDue = returnInvoice.dueAmount !== undefined ? returnInvoice.dueAmount : Math.max(0, (returnInvoice.netTotal || 0) - (returnInvoice.cashPaid || 0));
          const dueDiff = newDueAmount - oldDue; // Negative value if due decreased
          if (dueDiff !== 0) {
            const currentCustBal = cust.outstandingBalance || 0;
            const updatedCustBal = Math.max(0, currentCustBal + dueDiff);
            
            await db.customers.update(cust.id, {
              outstandingBalance: updatedCustBal
            });

            await db.customerLedgers.add({
              id: `cl_ret_adj_${Date.now()}_${cust.id}`,
              customerId: cust.id,
              date: todayStr,
              type: 'Return',
              refId: returnInvoice.id,
              debit: 0,
              credit: Math.abs(dueDiff),
              balance: updatedCustBal,
              remarks: `চালান #${returnInvoice.invoiceNo} পণ্য ফেরত সমন্বয় (বাকি হ্রাস)`
            });
          }
        }
      }

      setActionSuccess('স্টক সমন্বয় সফল হয়েছে! ফেরতকৃত পণ্য সেন্ট্রাল গোডাউনের স্টকে যোগ করা হয়েছে এবং চালানের নিট বিক্রি ও বাকি আপডেট হয়েছে।');
      setReturnInvoice(null);
      setTimeout(() => setActionSuccess(''), 4000);

    } catch (err: any) {
      alert('পণ্য ফেরত ও স্টক সমন্বয়ে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setIsSavingReturn(false);
    }
  };

  // Delete Invoice Action
  const handleDeleteInvoice = async (invoiceId: string, invoiceNo: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ইনভয়েস "${invoiceNo}" স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await db.salesInvoices.delete(invoiceId);
      setActionSuccess(`ইনভয়েস "${invoiceNo}" সফলভাবে মুছে ফেলা হয়েছে।`);
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(null);
      }
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert('ইনভয়েস মুছতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Memo Print
  const handlePrint = () => {
    setShowPrintModal(true);
  };

  return (
    <div className="space-y-6 pb-12" id="sales-invoices-module">
      
      {/* MODULE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-800 text-white rounded-xl shadow-xs">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 font-sans tracking-tight">
              বিক্রয় ইনভয়েস, ফেরত ও স্টক সমন্বয় (Sales Invoices & Returns)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              তারিখ ও রুট ফিল্টার করে বিক্রয় তথ্য পর্যবেক্ষণ, চালান ভিত্তিক পণ্য ফেরত এন্ট্রি এবং অটোমেটিক স্টক সমন্বয় করুন।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            মোট ইনভয়েস: <span className="text-emerald-800 font-black">{toBanglaNumerals(filteredInvoices.length)} টি</span>
          </span>
        </div>
      </div>

      {/* DYNAMIC SUMMARY HEADER CARDS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Card 1: Total Sales */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden border border-emerald-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-200 tracking-wide uppercase">মোট বিক্রি (Net Sales)</span>
            <div className="p-2 bg-emerald-950/60 rounded-lg text-emerald-300">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-white pt-1">
            {formatBanglaCurrency(totalSales)}
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium">
            ফিল্টারকৃত {toBanglaNumerals(filteredInvoices.length)} টি মেমোর নিট বিক্রির সমষ্টি
          </p>
        </div>

        {/* Card 2: Total Cash Collected */}
        <div className="bg-gradient-to-br from-blue-800 to-indigo-900 text-white rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden border border-blue-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-200 tracking-wide uppercase">মোট নগদ পাওনা/আদায় (Total Cash)</span>
            <div className="p-2 bg-blue-950/60 rounded-lg text-blue-300">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-white pt-1">
            {formatBanglaCurrency(totalCashCollected)}
          </div>
          <p className="text-[11px] text-blue-200/80 font-medium">
            ফিল্টারকৃত সময়সীমা ও মার্কেটের নগদ ক্যাশ প্রাপ্তি
          </p>
        </div>

        {/* Card 3: Total Due */}
        <div className="bg-gradient-to-br from-amber-800 to-orange-900 text-white rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden border border-amber-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-200 tracking-wide uppercase">মোট বাকি (Total Due)</span>
            <div className="p-2 bg-amber-950/60 rounded-lg text-amber-300">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-white pt-1">
            {formatBanglaCurrency(totalDueAmount)}
          </div>
          <p className="text-[11px] text-amber-200/80 font-medium">
            ফিল্টারকৃত ফিল্ড থেকে অবিক্রিত/বাকি পাওনা
          </p>
        </div>

      </div>

      {/* ADVANCED SEARCH & FILTERS SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4.5 w-4.5 text-emerald-700" />
            <h2 className="font-sans font-bold text-sm text-slate-900">
              এডভান্সড ফিল্টার ও অনুসন্ধান (Advanced Filters)
            </h2>
          </div>
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button 
              onClick={() => handlePresetDate('today')}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition"
            >
              আজ (Today)
            </button>
            <button 
              onClick={() => handlePresetDate('yesterday')}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition"
            >
              গতকাল
            </button>
            <button 
              onClick={() => handlePresetDate('this_month')}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 transition"
            >
              চলতি মাস
            </button>
            <button 
              onClick={() => handlePresetDate('all')}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              সব সময় (All)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* 1. Date Range Filter */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
              তারিখ অনুযায়ী ফিল্টার (Date Range)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">হইতে (From):</span>
                <input 
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">পর্যন্ত (To):</span>
                <input 
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Market / Route Filter */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-700" />
              মার্কেট/রুট ফিল্টার (Market/Route)
            </label>
            <div className="pt-4">
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- সকল মার্কেট / রুট (All Routes) --</option>
                {routes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.routeName} {rt.marketName ? `(${rt.marketName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Search Input Field */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-emerald-700" />
              কাস্টমার ও মেমো নম্বর সার্চ
            </label>
            <div className="pt-4 relative">
              <input 
                type="text"
                placeholder="মেমো নম্বর, কাস্টমারের নাম, দোকান বা ডিএসআর..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-6" />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-6 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Clear Filters indicator */}
        {(fromDate || toDate || selectedRouteId || searchTerm) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              ফিল্টারিং ফলাফল: <span className="font-bold text-slate-900">{toBanglaNumerals(filteredInvoices.length)} টি মেমো</span> পাওয়া গেছে।
            </span>
            <button 
              onClick={() => {
                setFromDate('');
                setToDate('');
                setSelectedRouteId('');
                setSearchTerm('');
              }}
              className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> সকল ফিল্টার রিসেট করুন
            </button>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* SALES INVOICES DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-sans font-bold text-xs uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-700" />
            বিক্রয় ইনভয়েস তালিকা (Invoices List)
          </h2>
          <span className="text-[11px] font-bold text-slate-500">
            সর্বশেষ তারিখে সাজানো
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-[11px] uppercase font-bold text-slate-700 border-b border-slate-200">
                <th className="py-3 px-4">মেমো / তারিখ</th>
                <th className="py-3 px-4">কাস্টমার / মার্কেট</th>
                <th className="py-3 px-4">ডিএসআর / বিক্রেতা</th>
                <th className="py-3 px-4 text-right">মোট বিক্রি (Net)</th>
                <th className="py-3 px-4 text-right">নগদ আদায়</th>
                <th className="py-3 px-4 text-right">অবশিষ্ট বাকি</th>
                <th className="py-3 px-4 text-center">ফেরত স্ট্যাটাস</th>
                <th className="py-3 px-4 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const due = inv.dueAmount !== undefined ? inv.dueAmount : Math.max(0, (inv.netTotal || 0) - (inv.cashPaid || 0));
                  const hasReturns = inv.isReturnProcessed || (inv.totalReturnedAmount && inv.totalReturnedAmount > 0);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      
                      {/* Memo & Date */}
                      <td className="py-3 px-4">
                        <div className="font-black text-emerald-900 font-mono">
                          {inv.invoiceNo}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {formatBanglaDate(inv.date)}
                        </div>
                      </td>

                      {/* Customer & Market */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {inv.customerName || 'সাধারণ ক্রেতা'}
                        </div>
                        {inv.remarks && (
                          <div className="text-[10px] text-slate-500 line-clamp-1">
                            {inv.remarks}
                          </div>
                        )}
                      </td>

                      {/* DSR / Salesman */}
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {inv.dsrName || 'N/A'}
                      </td>

                      {/* Net Total */}
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatBanglaCurrency(inv.netTotal || 0)}
                      </td>

                      {/* Cash Paid */}
                      <td className="py-3 px-4 text-right font-black text-emerald-800">
                        {formatBanglaCurrency(inv.cashPaid || 0)}
                      </td>

                      {/* Due Amount */}
                      <td className="py-3 px-4 text-right font-black text-amber-900">
                        {due > 0 ? (
                          <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded">
                            {formatBanglaCurrency(due)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            পরিশোধিত
                          </span>
                        )}
                      </td>

                      {/* Return Badge */}
                      <td className="py-3 px-4 text-center">
                        {hasReturns ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                            <Undo2 className="h-3 w-3" /> ফেরত সমন্বিত ({formatBanglaCurrency(inv.totalReturnedAmount || 0)})
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-medium text-slate-400">
                            কোনো ফেরত নেই
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleOpenReturnModal(inv)}
                            className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="পণ্য ফেরত এন্ট্রি (Return Goods)"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="মেমো বিস্তারিত দেখুন"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setShowPrintModal(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="মেমো প্রিন্ট ও শেয়ার করুন"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button 
                            disabled={isDeleting}
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNo)}
                            className="p-1.5 text-rose-500 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="ইনভয়েস মুছুন"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="h-10 w-10 text-slate-300" />
                      <span className="text-sm font-bold text-slate-600">কোনো ইনভয়েস ইতিহাস পাওয়া যায়নি।</span>
                      <p className="text-xs text-slate-400">নতুন ইনভয়েস তৈরি করলে এখানে ইতিহাস সংরক্ষিত থাকবে।</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================
          INVOICE PRODUCT RETURNS & EOD RECONCILIATION MODAL
         ==================================================== */}
      {returnInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            
            {/* Return Modal Header */}
            <div className="flex items-center justify-between p-4 bg-emerald-900 text-white border-b border-emerald-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-800/80 rounded-lg">
                  <Undo2 className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <h2 className="font-bold text-sm">
                    চালান ভিত্তিক পণ্য ফেরত এন্ট্রি ও স্টক সমন্বয় (Invoice Return & EOD Reconciliation)
                  </h2>
                  <p className="text-[11px] text-emerald-200/90 font-medium">
                    কাস্টমার থেকে ফেরত আসা পণ্য এন্ট্রি করুন। অটোমেটিক চালানের নিট বিক্রি ও গুদামের স্টক সমন্বয় হবে।
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setReturnInvoice(null)}
                className="text-emerald-300 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              
              {/* Invoice Summary Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold text-[10px] block">চালান নম্বর (Invoice No):</span>
                  <span className="font-black text-sm text-emerald-900 font-mono">{returnInvoice.invoiceNo}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold text-[10px] block">কাস্টমার / মার্কেট:</span>
                  <span className="font-bold text-slate-900 text-xs">{returnInvoice.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold text-[10px] block">ডিএসআর / বিক্রেতা:</span>
                  <span className="font-bold text-slate-800">{returnInvoice.dsrName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold text-[10px] block">চালান তারিখ:</span>
                  <span className="font-bold text-slate-900">{formatBanglaDate(returnInvoice.date)}</span>
                </div>
              </div>

              {/* Items Table for Return Entry */}
              <div>
                <h3 className="font-bold text-xs uppercase text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <PackageMinus className="h-4 w-4 text-emerald-700" />
                  চালুকৃত ও ফেরতকৃত মালের তালিকা
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-[11px] font-bold uppercase text-slate-700 border-b border-slate-200">
                        <th className="py-2.5 px-3">পণ্য ও একক দর</th>
                        <th className="py-2.5 px-3 text-center">চালুকৃত মাল (Delivered)</th>
                        <th className="py-2.5 px-3 text-center bg-amber-50 text-amber-900 border-x border-amber-200">
                          ফেরতকৃত মাল এন্ট্রি (Return Qty)
                        </th>
                        <th className="py-2.5 px-3 text-center">প্রকৃত বিক্রি (Net Sold)</th>
                        <th className="py-2.5 px-3 text-right">প্রকৃত বিক্রয় মূল্য</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {returnInvoice.items?.map((item) => {
                        const p = products.find(prod => prod.id === item.productId);
                        const pcsPerCtn = p?.pcsPerCarton || p?.cartonSize || 1;
                        
                        const deliveredCartons = Math.floor(item.qty / pcsPerCtn);
                        const deliveredLoose = item.qty % pcsPerCtn;

                        const retState = returnQuantities[item.productId] || { cartons: 0, loosePcs: 0 };
                        const retPcs = Math.min(item.qty, Math.max(0, (retState.cartons || 0) * pcsPerCtn + (retState.loosePcs || 0)));
                        
                        const netSoldPcs = Math.max(0, item.qty - retPcs);
                        const netSoldCartons = Math.floor(netSoldPcs / pcsPerCtn);
                        const netSoldLoose = netSoldPcs % pcsPerCtn;
                        const netSoldAmount = netSoldPcs * item.price;

                        return (
                          <tr key={item.productId} className="hover:bg-slate-50/80 transition">
                            
                            {/* Product Name & Price */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                দর: {formatBanglaCurrency(item.price)} / পিস ({toBanglaNumerals(pcsPerCtn)} পিসে ১ কার্টন)
                              </div>
                            </td>

                            {/* Delivered Quantity */}
                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                              <div>{formatBanglaNumber(item.qty)} পিস</div>
                              {pcsPerCtn > 1 && (
                                <div className="text-[10px] text-slate-500 font-normal">
                                  ({toBanglaNumerals(deliveredCartons)} কার্টন {deliveredLoose > 0 ? `${toBanglaNumerals(deliveredLoose)} পিস` : ''})
                                </div>
                              )}
                            </td>

                            {/* Returned Qty Input Fields */}
                            <td className="py-3 px-3 bg-amber-50/50 border-x border-amber-100">
                              <div className="flex items-center justify-center gap-2">
                                {pcsPerCtn > 1 && (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-amber-900 block">ফেরত কার্টন:</span>
                                    <input 
                                      type="number"
                                      min="0"
                                      max={deliveredCartons}
                                      value={retState.cartons ?? 0}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        setReturnQuantities(prev => ({
                                          ...prev,
                                          [item.productId]: {
                                            cartons: val,
                                            loosePcs: prev[item.productId]?.loosePcs || 0
                                          }
                                        }));
                                      }}
                                      className="w-16 bg-white border border-amber-300 rounded-lg px-2 py-1 text-center text-xs font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                  </div>
                                )}

                                <div className="space-y-0.5">
                                  <span className="text-[9px] font-bold text-amber-900 block">
                                    {pcsPerCtn > 1 ? 'লুজ পিস:' : 'ফেরত পিস:'}
                                  </span>
                                  <input 
                                    type="number"
                                    min="0"
                                    max={pcsPerCtn > 1 ? pcsPerCtn - 1 : item.qty}
                                    value={retState.loosePcs ?? 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setReturnQuantities(prev => ({
                                        ...prev,
                                        [item.productId]: {
                                          cartons: prev[item.productId]?.cartons || 0,
                                          loosePcs: val
                                        }
                                      }));
                                    }}
                                    className="w-16 bg-white border border-amber-300 rounded-lg px-2 py-1 text-center text-xs font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                  />
                                </div>
                              </div>
                              <div className="text-[10px] font-extrabold text-amber-900 text-center mt-1">
                                মোট ফেরত: {formatBanglaNumber(retPcs)} পিস
                              </div>
                            </td>

                            {/* Net Sold Qty */}
                            <td className="py-3 px-3 text-center font-black text-emerald-900">
                              <div>{formatBanglaNumber(netSoldPcs)} পিস</div>
                              {pcsPerCtn > 1 && (
                                <div className="text-[10px] text-slate-500 font-semibold">
                                  ({toBanglaNumerals(netSoldCartons)} কার্টন {netSoldLoose > 0 ? `${toBanglaNumerals(netSoldLoose)} পিস` : ''})
                                </div>
                              )}
                            </td>

                            {/* Net Sold Amount */}
                            <td className="py-3 px-3 text-right font-black text-slate-900">
                              {formatBanglaCurrency(netSoldAmount)}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic Financial Summary Card */}
              {(() => {
                let totalReturnedVal = 0;
                let newSubTotalVal = 0;

                returnInvoice.items.forEach(item => {
                  const p = products.find(prod => prod.id === item.productId);
                  const pcsPerCtn = p?.pcsPerCarton || p?.cartonSize || 1;
                  const entry = returnQuantities[item.productId] || { cartons: 0, loosePcs: 0 };
                  const retPcs = Math.min(item.qty, Math.max(0, (entry.cartons || 0) * pcsPerCtn + (entry.loosePcs || 0)));
                  const netQty = Math.max(0, item.qty - retPcs);

                  totalReturnedVal += retPcs * item.price;
                  newSubTotalVal += netQty * item.price;
                });

                const newNetTotalVal = Math.max(0, newSubTotalVal - (returnInvoice.discount || 0));
                const newDueVal = Math.max(0, newNetTotalVal - (returnInvoice.cashPaid || 0));

                return (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-slate-600">
                      <span>চালুকৃত মোট বিক্রি (Delivered Gross Sales):</span>
                      <span>{formatBanglaCurrency(returnInvoice.subTotal || 0)}</span>
                    </div>
                    {totalReturnedVal > 0 && (
                      <div className="flex justify-between font-black text-amber-800 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200">
                        <span>ফেরতকৃত মালের মোট মূল্য (Total Returned Value):</span>
                        <span>- {formatBanglaCurrency(totalReturnedVal)}</span>
                      </div>
                    )}
                    {returnInvoice.discount > 0 && (
                      <div className="flex justify-between font-bold text-rose-600">
                        <span>চালান ডিসকাউন্ট (Discount):</span>
                        <span>- {formatBanglaCurrency(returnInvoice.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm text-emerald-950 border-t border-slate-200 pt-2">
                      <span>প্রকৃত সংশোধিত নিট বিক্রি (New Net Sales):</span>
                      <span className="text-emerald-800">{formatBanglaCurrency(newNetTotalVal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-blue-900 pt-0.5">
                      <span>আদায়কৃত নগদ ক্যাশ (Cash Paid):</span>
                      <span>{formatBanglaCurrency(returnInvoice.cashPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm text-amber-900 border-t border-dashed border-slate-200 pt-1.5">
                      <span>সংশোধিত অবশিষ্ট বাকি (Updated Outstanding Due):</span>
                      <span className={newDueVal > 0 ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded' : 'text-emerald-700'}>
                        {formatBanglaCurrency(newDueVal)}
                      </span>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>সংরক্ষণ বাটনে ক্লিক করলে গুদামের স্টক স্বয়ংক্রিয়ভাবে আপডেট হবে।</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setReturnInvoice(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button 
                  disabled={isSavingReturn}
                  onClick={handleSaveReturn}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <PackageCheck className="h-4.5 w-4.5" />
                  {isSavingReturn ? 'সংরক্ষণ ও স্টক সমন্বয় হচ্ছে...' : 'পণ্য ফেরত ও স্টক সমন্বয় সংরক্ষণ করুন'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ====================================================
          INVOICE DETAILS MODAL & PRINTABLE MEMO
         ==================================================== */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-800" />
                <h2 className="font-bold text-sm text-slate-900">
                  ইনভয়েস বিস্তারিত: <span className="font-mono text-emerald-900">{selectedInvoice.invoiceNo}</span>
                </h2>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px]">কাস্টমার / মার্কেট:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedInvoice.customerName}</span>
                  <span className="text-slate-400 block font-semibold text-[10px] mt-2">ডিএসআর নাম:</span>
                  <span className="font-bold text-slate-800">{selectedInvoice.dsrName || 'N/A'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-semibold text-[10px]">তারিখ:</span>
                  <span className="font-bold text-slate-900">{formatBanglaDate(selectedInvoice.date)}</span>
                  {selectedInvoice.remarks && (
                    <div className="mt-2">
                      <span className="text-slate-400 block font-semibold text-[10px]">নোট:</span>
                      <span className="text-slate-700 font-medium">{selectedInvoice.remarks}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="font-bold text-xs uppercase text-slate-700 mb-2 border-b border-slate-200 pb-1">
                  পণ্য সামগ্রীর তালিকা
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                      <th className="py-2 px-3">পণ্য</th>
                      <th className="py-2 px-3 text-center">চালুকৃত (Delivered)</th>
                      <th className="py-2 px-3 text-center">ফেরত (Returned)</th>
                      <th className="py-2 px-3 text-center">প্রকৃত বিক্রি</th>
                      <th className="py-2 px-3 text-right">দর (৳)</th>
                      <th className="py-2 px-3 text-right">মোট টাকা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items?.map((item, idx) => {
                      const retPcs = item.returnedQty || 0;
                      const netPcs = item.netQty !== undefined ? item.netQty : item.qty - retPcs;
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-bold text-slate-900">{item.name}</td>
                          <td className="py-2 px-3 text-center font-bold">{formatBanglaNumber(item.qty)} পিস</td>
                          <td className="py-2 px-3 text-center font-bold text-amber-800">
                            {retPcs > 0 ? `${formatBanglaNumber(retPcs)} পিস` : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-black text-emerald-900">{formatBanglaNumber(netPcs)} পিস</td>
                          <td className="py-2 px-3 text-right">{formatBanglaCurrency(item.price)}</td>
                          <td className="py-2 px-3 text-right font-black">{formatBanglaCurrency(item.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Customer Due Allocation Breakdown */}
              {selectedInvoice.customerDuesBreakdown && selectedInvoice.customerDuesBreakdown.length > 0 && (
                <div>
                  <h3 className="font-bold text-xs uppercase text-slate-700 mb-2 border-b border-slate-200 pb-1">
                    কাস্টমার বাকি বরাদ্দ
                  </h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-50 text-[10px] font-bold uppercase text-amber-900 border-b border-amber-200">
                        <th className="py-1.5 px-3">দোকান / কাস্টমার</th>
                        <th className="py-1.5 px-3 text-right">বাকি পরিমাণ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {selectedInvoice.customerDuesBreakdown.map((due: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-3 font-bold">{due.shopName || due.customerName}</td>
                          <td className="py-1.5 px-3 text-right font-black text-rose-700">{formatBanglaCurrency(due.dueAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Totals */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>চালুকৃত মোট বিক্রি:</span>
                  <span>{formatBanglaCurrency(selectedInvoice.subTotal || 0)}</span>
                </div>
                {selectedInvoice.totalReturnedAmount && selectedInvoice.totalReturnedAmount > 0 ? (
                  <div className="flex justify-between font-bold text-amber-800">
                    <span>ফেরতকৃত মালের মূল্য:</span>
                    <span>- {formatBanglaCurrency(selectedInvoice.totalReturnedAmount)}</span>
                  </div>
                ) : null}
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>ইনভয়েস ডিসকাউন্ট:</span>
                    <span>- {formatBanglaCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-2">
                  <span>সর্বমোট নিট বিক্রি (Net Total):</span>
                  <span>{formatBanglaCurrency(selectedInvoice.netTotal || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-800 pt-1">
                  <span>নগদ আদায় (Cash Paid):</span>
                  <span>{formatBanglaCurrency(selectedInvoice.cashPaid || 0)}</span>
                </div>
                <div className="flex justify-between font-black text-amber-900">
                  <span>অবশিষ্ট বাকি (Due Amount):</span>
                  <span>{formatBanglaCurrency(selectedInvoice.dueAmount || Math.max(0, (selectedInvoice.netTotal || 0) - (selectedInvoice.cashPaid || 0)))}</span>
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button 
                onClick={() => {
                  const invToReturn = selectedInvoice;
                  setSelectedInvoice(null);
                  // handleOpenReturnModal(invToReturn); // This should be defined or removed
                }}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <Undo2 className="h-4 w-4" /> পণ্য ফেরত এন্ট্রি (Return Goods)
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-4 py-2 bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> প্রিন্ট মেমো
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Universal Print Modal */}
      {selectedInvoice && (
        <UniversalPrintModal 
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title="সেলস ইনভয়েস ও ক্যাশ মেমো"
          type="invoice"
          data={{
            invoiceNo: selectedInvoice.invoiceNo,
            date: formatBanglaDate(selectedInvoice.date),
            customerName: selectedInvoice.customerName,
            dsrName: selectedInvoice.dsrName,
            routeName: routes.find(r => r.id === selectedInvoice.routeId)?.routeName || 'N/A',
            items: selectedInvoice.items?.map((item: any) => ({
              productName: item.name,
              qty: item.qty,
              returnedQty: item.returnedQty || 0,
              soldQty: item.netQty !== undefined ? item.netQty : (item.qty - (item.returnedQty || 0)),
              rate: item.price,
              subtotal: item.total
            })),
            subtotal: selectedInvoice.subTotal,
            discount: selectedInvoice.discount,
            netTotal: selectedInvoice.netTotal,
            cashPaid: selectedInvoice.cashPaid,
            dueAmount: selectedInvoice.dueAmount
          }}
        />
      )}

    </div>
  );
}

export default function SalesInvoices() {
  return (
    <ErrorBoundary fallbackTitle="বিক্রয় ইনভয়েস ফিল্টার ও ইতিহাস লোড করতে সমস্যা হয়েছে।">
      <SalesInvoicesContent />
    </ErrorBoundary>
  );
}
