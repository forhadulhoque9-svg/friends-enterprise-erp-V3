import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { SalesInvoice, Route, Customer, Salesman } from '../types';
import { 
  Search, 
  Calendar, 
  MapPin, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  AlertCircle, 
  Printer, 
  Eye, 
  Trash2, 
  X, 
  Filter, 
  RefreshCw,
  ShoppingBag,
  UserCheck,
  Building2,
  CheckCircle2,
  Coins
} from 'lucide-react';

// Helper: Convert numbers to Bangla digits
export function toBanglaNumerals(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  const str = String(num);
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

// Helper: Format BDT Currency with Bangla Numerals
export function formatBanglaCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  const isNegative = amount < 0;
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `${isNegative ? '-' : ''}৳ ${toBanglaNumerals(formatted)}`;
}

// Helper: Format Number with Bangla Numerals
export function formatBanglaNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) num = 0;
  return toBanglaNumerals(Math.round(num).toLocaleString('en-US'));
}

// Helper: Format Date to Bangla String
export function formatBanglaDate(dateString: string | Date): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return toBanglaNumerals(String(dateString));

  const monthNamesBangla = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  
  const day = date.getDate();
  const month = monthNamesBangla[date.getMonth()];
  const year = date.getFullYear();

  return `${toBanglaNumerals(day)} ${month}, ${toBanglaNumerals(year)}`;
}

export default function SalesInvoices() {
  // Live Dexie Database Queries
  const invoices = useLiveQuery(() => db.salesInvoices.orderBy('date').reverse().toArray()) || [];
  const routes = useLiveQuery(() => db.routes.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const dsrList = useLiveQuery(() => db.salesmen.toArray()) || [];
  const businessProfiles = useLiveQuery(() => db.businessProfiles.toArray()) || [];

  // Business details for print memo
  const configuredPhone = businessProfiles?.[0]?.phone || '০১৮৩৫৯১২৫৯৭';
  const configuredOwner = businessProfiles?.[0]?.owner || 'ফরহাদুল হক';
  const configuredBusinessName = businessProfiles?.[0]?.businessName || 'ফ্রেন্ডস এন্টারপ্রাইজ';

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

  // Filtered Invoices Computation
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Date Filter
      if (fromDate && inv.date < fromDate) return false;
      if (toDate && inv.date > toDate) return false;

      // Market / Route Filter
      if (selectedRouteId) {
        // Match routeId on invoice or match routeName/marketName from customer
        const matchInvoiceRoute = inv.routeId === selectedRouteId;
        const cust = customers.find(c => c.id === inv.customerId);
        const matchCustomerRoute = cust?.routeId === selectedRouteId;
        const selectedRoute = routes.find(r => r.id === selectedRouteId);
        const matchRouteName = selectedRoute && inv.customerName && 
          (inv.customerName.includes(selectedRoute.routeName) || (selectedRoute.marketName && inv.customerName.includes(selectedRoute.marketName)));

        if (!matchInvoiceRoute && !matchCustomerRoute && !matchRouteName) {
          return false;
        }
      }

      // Search Term Filter (Memo / Invoice No, Customer Name, Shop Name, DSR Name)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const invNoMatch = inv.invoiceNo?.toLowerCase().includes(query);
        const custMatch = inv.customerName?.toLowerCase().includes(query);
        const dsrMatch = inv.dsrName?.toLowerCase().includes(query);
        const remarksMatch = inv.remarks?.toLowerCase().includes(query);

        // Check if item name matches
        const itemMatch = inv.items?.some(i => i.name.toLowerCase().includes(query));

        if (!invNoMatch && !custMatch && !dsrMatch && !remarksMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, fromDate, toDate, selectedRouteId, searchTerm, customers, routes]);

  // Dynamic Summary Totals
  const totalSales = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.netTotal || 0), 0);
  }, [filteredInvoices]);

  const totalCashCollected = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.cashPaid || 0), 0);
  }, [filteredInvoices]);

  const totalDueAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const due = inv.dueAmount !== undefined ? inv.dueAmount : Math.max(0, (inv.netTotal || 0) - (inv.cashPaid || 0));
      return sum + due;
    }, 0);
  }, [filteredInvoices]);

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
    window.print();
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
              বিক্রয় ইনভয়েস ও বিক্রয় ইতিহাস (Sales Invoices History)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              তারিখ, মার্কেট/রুট ও কাস্টমার অনুযায়ী ফিল্টার করে মোট বিক্রি, নগদ পাওনা ও বাকি পর্যবেক্ষণ করুন।
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
            <span className="text-xs font-bold text-emerald-200 tracking-wide uppercase">মোট বিক্রি (Total Sales)</span>
            <div className="p-2 bg-emerald-950/60 rounded-lg text-emerald-300">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-white pt-1">
            {formatBanglaCurrency(totalSales)}
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium">
            ফিল্টারকৃত {toBanglaNumerals(filteredInvoices.length)} টি মেমোর সর্বমোট বিক্রির সমষ্টি
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
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
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
                <th className="py-3 px-4 text-center">পেমেন্ট মেথড</th>
                <th className="py-3 px-4 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const due = inv.dueAmount !== undefined ? inv.dueAmount : Math.max(0, (inv.netTotal || 0) - (inv.cashPaid || 0));
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

                      {/* Payment Method Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          due === 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          inv.cashPaid > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {inv.paymentMethod || (due === 0 ? 'Cash' : inv.cashPaid > 0 ? 'Partial' : 'Due')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                            title="মেমো বিস্তারিত দেখুন"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setTimeout(() => window.print(), 200);
                            }}
                            className="p-1.5 text-slate-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                            title="মেমো প্রিন্ট করুন"
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
                      <FileText className="h-8 w-8 text-slate-300" />
                      <span>কোনো ইনভয়েস পাওয়া যায়নি!</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                      <th className="py-2 px-3 text-center">পরিমাণ</th>
                      <th className="py-2 px-3 text-right">দর (৳)</th>
                      <th className="py-2 px-3 text-right">মোট টাকা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-bold text-slate-900">{item.name}</td>
                        <td className="py-2 px-3 text-center font-bold">{formatBanglaNumber(item.qty)} পিস</td>
                        <td className="py-2 px-3 text-right">{formatBanglaCurrency(item.price)}</td>
                        <td className="py-2 px-3 text-right font-black">{formatBanglaCurrency(item.total)}</td>
                      </tr>
                    ))}
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
                      {selectedInvoice.customerDuesBreakdown.map((due, idx) => (
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
                  <span>Gross Sales:</span>
                  <span>{formatBanglaCurrency(selectedInvoice.subTotal || 0)}</span>
                </div>
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
                  <span>{formatBanglaCurrency(selectedInvoice.dueAmount || Math.max(0, selectedInvoice.netTotal - selectedInvoice.cashPaid))}</span>
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
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
      )}

      {/* PRINTABLE MEMO TEMPLATE FOR WINDOW.PRINT */}
      {selectedInvoice && (
        <div className="hidden print:block absolute inset-0 bg-white text-black p-8 font-sans space-y-6 z-[100] h-screen w-screen" id="printable-sales-invoice">
          
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <p className="font-serif text-sm font-semibold tracking-wider text-slate-800">
              بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
            <h1 className="font-black text-2xl tracking-wide uppercase mt-1">{configuredBusinessName}</h1>
            <p className="text-xs font-bold text-slate-700">পরিচালনায়: {configuredOwner}</p>
            <p className="text-[11px] text-slate-600">খাতুনগঞ্জ, চট্টগ্রাম • মোবাইল: {configuredPhone}</p>
            <div className="pt-1">
              <span className="inline-block border border-slate-800 px-3 py-0.5 text-xs font-black uppercase">
                Sales Invoice
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-3 text-xs">
            <div>
              <span className="font-bold text-slate-600 block">ইনভয়েস নং:</span>
              <span className="font-black text-sm text-slate-900">{toBanglaNumerals(selectedInvoice.invoiceNo)}</span>
              <span className="font-bold text-slate-600 block mt-1">ডিএসআর নাম:</span>
              <span className="font-bold text-slate-900">{selectedInvoice.dsrName || 'N/A'}</span>
              <span className="font-bold text-slate-600 block mt-1">বাজার / রুট:</span>
              <span className="font-bold text-slate-900">{selectedInvoice.customerName}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-600 block">তারিখ:</span>
              <span className="font-bold text-slate-900">{formatBanglaDate(selectedInvoice.date)}</span>
              <span className="font-bold text-slate-600 block mt-1">নোট / কৈফিয়ত:</span>
              <span className="text-slate-800 font-semibold">{selectedInvoice.remarks}</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-xs uppercase mb-2 border-b border-slate-800 pb-1">পণ্যের বিবরণ</h3>
            <table className="w-full text-left border-collapse my-2">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black text-slate-900">
                  <th className="py-1.5">ক্রম</th>
                  <th className="py-1.5">পণ্য ও কোম্পানি</th>
                  <th className="py-1.5 text-center">পরিমাণ (পিস)</th>
                  <th className="py-1.5 text-right">একক মূল্য</th>
                  <th className="py-1.5 text-right">মোট টাকা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {selectedInvoice.items?.map((item, idx) => (
                  <tr key={idx} className="py-2">
                    <td className="py-2 font-bold">{toBanglaNumerals(idx + 1)}</td>
                    <td className="py-2 font-bold">{item.name}</td>
                    <td className="py-2 text-center font-bold">{formatBanglaNumber(item.qty)}</td>
                    <td className="py-2 text-right">{formatBanglaCurrency(item.price)}</td>
                    <td className="py-2 text-right font-black">{formatBanglaCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300">
            <div className="text-xs space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
              <span className="font-bold block text-slate-800">পরিশোধ বিবরণী:</span>
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span>নগদ আদায় (Collection):</span>
                <span className="font-bold">{formatBanglaCurrency(selectedInvoice.cashPaid)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>মোট বাকি (Due):</span>
                <span className="font-bold text-rose-700">{formatBanglaCurrency(selectedInvoice.dueAmount || 0)}</span>
              </div>
            </div>

            <div className="text-xs space-y-1.5 font-semibold text-slate-800">
              <div className="flex justify-between">
                <span>Gross Sales:</span>
                <span>{formatBanglaCurrency(selectedInvoice.subTotal)}</span>
              </div>
              {selectedInvoice.discount > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>ছাড়:</span>
                  <span>- {formatBanglaCurrency(selectedInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-slate-900 pt-1 font-black text-sm">
                <span>Net Sales (সর্বমোট পরিশোধযোগ্য):</span>
                <span>{formatBanglaCurrency(selectedInvoice.netTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between w-full mt-16 pt-6 border-t border-slate-300 text-xs text-slate-600">
            <div className="text-center w-1/3">
              <div className="h-6 border-b border-dashed border-slate-400"></div>
              <span className="mt-1 block font-bold">গ্রহীতার স্বাক্ষর</span>
            </div>
            <div className="text-center w-1/3">
              <div className="h-6 border-b border-dashed border-slate-400"></div>
              <span className="mt-1 block font-bold">প্রস্তুতকারক</span>
            </div>
            <div className="text-center w-1/3">
              <div className="h-6 border-b border-dashed border-slate-400"></div>
              <span className="mt-1 block font-bold">ফর {configuredBusinessName}</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
