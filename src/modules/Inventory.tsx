import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Product, Company, Category, CompanyDamage } from '../types';
import { 
  Package, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Tag, 
  Boxes, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Filter, 
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Layers,
  Sparkles,
  BarChart3,
  DollarSign,
  X
} from 'lucide-react';

// Bangla Numerals Converter
export function toBanglaNumerals(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  const str = String(num);
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

// Currency Formatter in BDT with Bangla Numerals
export function formatBanglaCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  const isNegative = amount < 0;
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `${isNegative ? '-' : ''}৳ ${toBanglaNumerals(formatted)}`;
}

// Number Formatter with Bangla Numerals
export function formatBanglaNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) num = 0;
  return toBanglaNumerals(Math.round(num).toLocaleString('en-US'));
}

// Bangla Date Formatter
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

// Unit Breakdown Formatter (Carton, Pack, Piece)
export function formatUnitBreakdown(totalPieces: number, cartonSize?: number): string {
  const size = cartonSize && cartonSize > 0 ? cartonSize : 1;
  if (size <= 1) {
    return `${formatBanglaNumber(totalPieces)} পিস`;
  }
  const cartons = Math.floor(totalPieces / size);
  const remainingPieces = totalPieces % size;

  if (cartons > 0 && remainingPieces > 0) {
    return `${formatBanglaNumber(cartons)} কার্টন ${formatBanglaNumber(remainingPieces)} পিস`;
  } else if (cartons > 0) {
    return `${formatBanglaNumber(cartons)} কার্টন (${formatBanglaNumber(totalPieces)} পিস)`;
  } else {
    return `${formatBanglaNumber(totalPieces)} পিস`;
  }
}

export default function Inventory() {
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'All' | 'Low' | 'Out' | 'Damage'>('All');

  // Company Claim Modal States
  const [selectedClaimProduct, setSelectedClaimProduct] = useState<Product | null>(null);
  const [inputClaimQty, setInputClaimQty] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Live Database Queries
  const products = useLiveQuery(() => db.products.toArray());
  const companies = useLiveQuery(() => db.companies.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const companyDamages = useLiveQuery(() => db.companyDamages.toArray());
  const stockLedgers = useLiveQuery(() => db.stockLedgers.toArray());

  // Aggregate Damage Stock per Product
  const productDamageStockMap = (companyDamages || []).reduce<Record<string, number>>((acc, dmg) => {
    // Only count active/pending/approved damages that haven't been fully paid/cleared
    if (dmg.status !== 'Paid' && dmg.qty > 0) {
      acc[dmg.productId] = (acc[dmg.productId] || 0) + dmg.qty;
    }
    return acc;
  }, {});

  // Compute Dashboard Metrics
  const totalGoodStockPieces = (products || []).reduce((acc, p) => acc + (p.stock || 0), 0);
  
  const totalDamageStockPieces = Object.values(productDamageStockMap).reduce((acc, qty) => acc + qty, 0);

  const totalStockValue = (products || []).reduce((acc, p) => {
    const goodVal = (p.stock || 0) * (p.purchasePrice || p.edp || 0);
    const damageQty = productDamageStockMap[p.id!] || 0;
    const damageVal = damageQty * (p.purchasePrice || p.edp || 0);
    return acc + goodVal + damageVal;
  }, 0);

  const lowStockThreshold = 20; // Default minimum safe level

  const lowStockCount = (products || []).filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.reorderLevel || lowStockThreshold)).length;
  const stockOutCount = (products || []).filter(p => (p.stock || 0) === 0).length;

  // Filtered Products List
  const filteredProducts = (products || []).filter(p => {
    // 1. Search filter by Product Name or Barcode/SKU
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      p.name.toLowerCase().includes(query) || 
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.id && p.id.toLowerCase().includes(query));

    // 2. Company Filter
    const matchesCompany = !selectedCompanyFilter || p.companyId === selectedCompanyFilter || p.brand === selectedCompanyFilter;

    // 3. Category Filter
    const matchesCategory = !selectedCategoryFilter || p.categoryId === selectedCategoryFilter || p.category === selectedCategoryFilter;

    // 4. Product Selection Filter
    const matchesProduct = !selectedProductFilter || p.id === selectedProductFilter;

    // 5. Stock Status Filter
    let matchesStatus = true;
    const goodStock = p.stock || 0;
    const damageStock = productDamageStockMap[p.id!] || 0;

    if (stockStatusFilter === 'Low') {
      matchesStatus = goodStock > 0 && goodStock <= (p.reorderLevel || lowStockThreshold);
    } else if (stockStatusFilter === 'Out') {
      matchesStatus = goodStock === 0;
    } else if (stockStatusFilter === 'Damage') {
      matchesStatus = damageStock > 0;
    }

    return matchesSearch && matchesCompany && matchesCategory && matchesProduct && matchesStatus;
  });

  // Execute Company Claim (Damage Stock Decreases, Good Stock Increases)
  const handleExecuteCompanyClaim = async () => {
    if (!selectedClaimProduct || !selectedClaimProduct.id || inputClaimQty <= 0) {
      setErrorMsg('অনুগ্রহ করে সঠিক ক্লেইম পরিমাণ প্রদান করুন।');
      return;
    }

    const currentDamageQty = productDamageStockMap[selectedClaimProduct.id] || 0;
    if (inputClaimQty > currentDamageQty) {
      setErrorMsg(`ক্লেমের পরিমাণ বর্তমান ড্যামেজ স্টক (${formatBanglaNumber(currentDamageQty)} পিস) এর বেশি হতে পারে না!`);
      return;
    }

    setIsClaiming(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const claimId = `claim_${Date.now()}`;

      await db.transaction('rw', [
        db.products,
        db.companyDamages,
        db.companyClaims,
        db.stockLedgers,
        db.auditLogs
      ], async () => {
        // 1. Good Stock Increases
        const currentGoodStock = selectedClaimProduct.stock || 0;
        const updatedGoodStock = currentGoodStock + inputClaimQty;
        await db.products.update(selectedClaimProduct.id!, {
          stock: updatedGoodStock
        });

        // 2. Damage Stock Decreases (Update or settle companyDamages records)
        let remainingToDeduct = inputClaimQty;
        const activeDamages = await db.companyDamages
          .where('productId')
          .equals(selectedClaimProduct.id!)
          .filter(d => d.status !== 'Paid' && d.qty > 0)
          .toArray();

        for (const dmg of activeDamages) {
          if (remainingToDeduct <= 0) break;
          if (dmg.qty <= remainingToDeduct) {
            remainingToDeduct -= dmg.qty;
            await db.companyDamages.update(dmg.id!, {
              qty: 0,
              status: 'Approved'
            });
          } else {
            await db.companyDamages.update(dmg.id!, {
              qty: dmg.qty - remainingToDeduct,
              damageValue: Math.max(0, (dmg.qty - remainingToDeduct) * (selectedClaimProduct.purchasePrice || 0))
            });
            remainingToDeduct = 0;
          }
        }

        // 3. Record Company Claim System Log
        const companyName = selectedClaimProduct.brand || 'কোম্পানি';
        await db.companyClaims.add({
          id: claimId,
          companyId: selectedClaimProduct.companyId || 'comp_default',
          companyName: companyName,
          date: todayStr,
          type: 'Damage Claim',
          amount: inputClaimQty * (selectedClaimProduct.purchasePrice || 0),
          status: 'Settled',
          remarks: `কোম্পানি ড্যামেজ ক্লেম ফেরত অনুমোদন: ${inputClaimQty} পিস ভালো স্টকে স্থানান্তরিত।`
        });

        // 4. Record Stock Ledger Entry
        await db.stockLedgers.add({
          id: `st_claim_${claimId}_${Date.now()}`,
          productId: selectedClaimProduct.id!,
          productName: selectedClaimProduct.name,
          date: todayStr,
          type: 'Adjustment',
          refId: claimId,
          qtyIn: inputClaimQty,
          qtyOut: 0,
          balance: updatedGoodStock,
          remarks: `কোম্পানি ড্যামেজ ক্লেম গ্রহণ: ${formatBanglaNumber(inputClaimQty)} পিস ড্যামেজ থেকে ভালো স্টকে যুক্ত`
        });
      });

      setSuccessMsg(`সফলভাবে ${formatBanglaNumber(inputClaimQty)} পিস ড্যামেজ পণ্য কোম্পানি থেকে ক্লেম করে ভালো স্টকে যুক্ত করা হয়েছে!`);
      setSelectedClaimProduct(null);
      setInputClaimQty(0);
    } catch (err: any) {
      setErrorMsg(err.message || 'কোম্পানি ক্লেম প্রক্রিয়াকরণে সমস্যা হয়েছে।');
    } finally {
      setIsClaiming(false);
    }
  };

  // Recent Stock Movement Logs
  const recentStockLogs = (stockLedgers || [])
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 10);

  return (
    <div className="space-y-6 pb-12" id="inventory-module">
      
      {/* Top Banner Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6 text-indigo-400" />
            <h1 className="font-sans font-black text-xl sm:text-2xl text-white">
              ইনভেন্টরি ও ওয়ারহাউস ব্যবস্থাপনা (Inventory & Stock)
            </h1>
          </div>
          <p className="font-sans text-xs text-slate-300 mt-1">
            ফ্রেন্ডস এন্টারপ্রাইজ • ভালো স্টক ও ড্যামেজ স্টক পৃথকীকরণ ড্যাশবোর্ড
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>এফএমসিজি ডিস্ট্রিবিউশন ওয়্যারহাউস</span>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-900 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 hover:text-rose-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ১. ইনভেন্টরি ড্যাশবোর্ড সামারি (Inventory Dashboard 5 Stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* ১. মোট ভালো স্টক */}
        <div className="rounded-2xl border border-emerald-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800">মোট ভালো স্টক</span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-black text-slate-900 block">
              {formatBanglaNumber(totalGoodStockPieces)} পিস
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">বিক্রয়যোগ্য অক্ষত পণ্য</p>
          </div>
        </div>

        {/* ২. মোট ড্যামেজ স্টক */}
        <div className="rounded-2xl border border-rose-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800">মোট ড্যামেজ স্টক</span>
            <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-black text-rose-700 block">
              {formatBanglaNumber(totalDamageStockPieces)} পিস
            </span>
            <p className="text-[10px] text-rose-500 mt-0.5">ফেরতকৃত ক্ষতিগ্রস্ত পণ্য</p>
          </div>
        </div>

        {/* ৩. মোট স্টকের মূল্য */}
        <div className="rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-800">মোট স্টকের মূল্য</span>
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-black text-indigo-900 block">
              {formatBanglaCurrency(totalStockValue)}
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">ক্রয়মূল্য অনুযায়ী মোট মূল্য</p>
          </div>
        </div>

        {/* ৪. কমে যাওয়া স্টক */}
        <div className="rounded-2xl border border-amber-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800">কমে যাওয়া স্টক</span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-black text-amber-800 block">
              {formatBanglaNumber(lowStockCount)} টি পণ্য
            </span>
            <p className="text-[10px] text-amber-600 mt-0.5">নিরাপদ মাত্রার নিচে রয়েছে</p>
          </div>
        </div>

        {/* ৫. শেষ হয়ে যাওয়া স্টক */}
        <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">শেষ হয়ে যাওয়া স্টক</span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-black text-slate-800 block">
              {formatBanglaNumber(stockOutCount)} টি পণ্য
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">স্টক বর্তমানে ০ পিস</p>
          </div>
        </div>

      </div>

      {/* ২. ফিল্টার ও সার্চ কন্ট্রোল (Filters & Search) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <h2 className="font-sans font-bold text-sm text-slate-900">
              ফিল্টার ও অনুসন্ধান (Search & Filters)
            </h2>
          </div>

          {/* Quick status tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button 
              onClick={() => setStockStatusFilter('All')}
              className={`rounded-lg px-3 py-1 transition ${stockStatusFilter === 'All' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              সব পণ্য ({formatBanglaNumber((products || []).length)})
            </button>
            <button 
              onClick={() => setStockStatusFilter('Low')}
              className={`rounded-lg px-3 py-1 transition ${stockStatusFilter === 'Low' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'}`}
            >
              কমে গেছে ({formatBanglaNumber(lowStockCount)})
            </button>
            <button 
              onClick={() => setStockStatusFilter('Out')}
              className={`rounded-lg px-3 py-1 transition ${stockStatusFilter === 'Out' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'}`}
            >
              স্টক শেষ ({formatBanglaNumber(stockOutCount)})
            </button>
            <button 
              onClick={() => setStockStatusFilter('Damage')}
              className={`rounded-lg px-3 py-1 transition ${stockStatusFilter === 'Damage' ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-50'}`}
            >
              ড্যামেজ স্টক
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Input (Product Name or Barcode) */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              পণ্যের নাম বা বারকোড
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text"
                placeholder="পণ্যের নাম বা বারকোড দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Company Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              কোম্পানি ফিল্টার
            </label>
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="">-- সব কোম্পানি --</option>
              {companies?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              ক্যাটাগরি ফিল্টার
            </label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="">-- সব ক্যাটাগরি --</option>
              {categories?.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Product Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              নির্দিষ্ট পণ্য ফিল্টার
            </label>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="">-- সব পণ্য --</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* ৩. প্রোডাক্ট কার্ড ও তালিকা (Product Cards & Matrix Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Main Inventory Products Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-bold text-base text-slate-900">
              পণ্যের তালিকা ও স্টক স্টেটাস
            </h2>
            <span className="text-xs font-bold text-slate-500">
              দেখাচ্ছে: {formatBanglaNumber(filteredProducts.length)} টি পণ্য
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
                    <th className="py-3 px-3">পণ্যের নাম</th>
                    <th className="py-3 px-3">কোম্পানি ও ক্যাটাগরি</th>
                    <th className="py-3 px-3 text-center">কার্টন সাইজ</th>
                    <th className="py-3 px-3 text-center">ভালো স্টক (অক্ষত)</th>
                    <th className="py-3 px-3 text-center">ড্যামেজ স্টক</th>
                    <th className="py-3 px-3 text-right">স্টক মূল্য (BDT)</th>
                    <th className="py-3 px-3 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                        <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        কোনো পণ্য ফিল্টারের সাথে মেলেনি।
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const matchedCompany = companies?.find(c => c.id === p.companyId || c.name === p.brand);
                      const compName = matchedCompany ? matchedCompany.name : (p.brand || 'সাধারণ');
                      const catName = p.category || 'সাধারণ';
                      
                      const goodStock = p.stock || 0;
                      const damageStock = productDamageStockMap[p.id!] || 0;
                      
                      const unitPrice = p.purchasePrice || p.edp || 0;
                      const stockValue = goodStock * unitPrice;

                      const isLowStock = goodStock > 0 && goodStock <= (p.reorderLevel || lowStockThreshold);
                      const isStockOut = goodStock === 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          
                          {/* পণ্যের নাম */}
                          <td className="py-3 px-3 font-bold text-slate-900">
                            <div>{p.name}</div>
                            {p.sku && (
                              <div className="text-[10px] text-slate-400 font-normal">বারকোড/SKU: {toBanglaNumerals(p.sku)}</div>
                            )}
                          </td>

                          {/* কোম্পানি ও ক্যাটাগরি */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800">{compName}</div>
                            <div className="text-[10px] text-slate-400">{catName}</div>
                          </td>

                          {/* কার্টন সাইজ */}
                          <td className="py-3 px-3 text-center font-bold text-slate-600">
                            {p.cartonSize ? `${formatBanglaNumber(p.cartonSize)} পিস/কার্টন` : '১ পিস'}
                          </td>

                          {/* বর্তমান ভালো স্টক */}
                          <td className="py-3 px-3 text-center">
                            <div className="space-y-1">
                              <span className={`inline-block px-2 py-0.5 rounded-md font-bold ${
                                isStockOut 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : isLowStock 
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}>
                                {formatUnitBreakdown(goodStock, p.cartonSize)}
                              </span>

                              {/* Warning Badge */}
                              {isLowStock && (
                                <div className="text-[10px] font-black text-amber-700 flex items-center justify-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-600 animate-pulse" />
                                  <span>স্টক কমে গেছে</span>
                                </div>
                              )}

                              {isStockOut && (
                                <div className="text-[10px] font-black text-rose-600 flex items-center justify-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-rose-600" />
                                  <span>স্টক শেষ</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* বর্তমান ড্যামেজ স্টক */}
                          <td className="py-3 px-3 text-center font-black">
                            {damageStock > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                                {formatBanglaNumber(damageStock)} পিস
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">০ পিস</span>
                            )}
                          </td>

                          {/* স্টকের মূল্য */}
                          <td className="py-3 px-3 text-right font-black text-indigo-950">
                            {formatBanglaCurrency(stockValue)}
                          </td>

                          {/* অ্যাকশন - কোম্পানি ক্লেম */}
                          <td className="py-3 px-3 text-center">
                            {damageStock > 0 ? (
                              <button 
                                type="button"
                                onClick={() => {
                                  setSelectedClaimProduct(p);
                                  setInputClaimQty(damageStock);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-[11px] font-bold transition shadow-xs"
                                title="কোম্পানি ড্যামেজ ক্লেম করুন"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span>ক্লেম করুন</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">অক্ষত</span>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Stock Movement Audit Logs */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-sans font-bold text-base text-slate-900">
            সাম্প্রতিক স্টক মুভমেন্ট লগ
          </h2>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            {recentStockLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                কোনো সাম্প্রতিক স্টক মুভমেন্ট তথ্য পাওয়া যায়নি।
              </div>
            ) : (
              recentStockLogs.map(log => {
                const isIncoming = log.qtyIn > 0;
                return (
                  <div key={log.id} className="flex items-start justify-between border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg mt-0.5 ${isIncoming ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {isIncoming ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block truncate max-w-[150px]">
                          {log.productName}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {log.remarks || log.type}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-black block ${isIncoming ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isIncoming ? '+' : '-'}{formatBanglaNumber(isIncoming ? log.qtyIn : log.qtyOut)} পিস
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {formatBanglaDate(log.date)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ৪. কোম্পানি ক্লেম মডাল (Company Claim Modal) */}
      {selectedClaimProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-600 p-1.5 text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="font-sans font-bold text-base text-slate-900">
                  কোম্পানি ড্যামেজ ক্লেম প্রক্রিয়াকরণ
                </h3>
              </div>
              <button 
                onClick={() => setSelectedClaimProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-purple-50/60 p-3.5 rounded-xl border border-purple-100">
              <div className="flex justify-between">
                <span className="text-slate-600">পণ্যের নাম:</span>
                <span className="font-bold text-slate-900">{selectedClaimProduct.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">কোম্পানি:</span>
                <span className="font-bold text-slate-900">{selectedClaimProduct.brand || 'সাধারণ'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">বর্তমান ড্যামেজ স্টক:</span>
                <span className="font-black text-purple-900">
                  {formatBanglaNumber(productDamageStockMap[selectedClaimProduct.id!] || 0)} পিস
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">বর্তমান ভালো স্টক:</span>
                <span className="font-bold text-emerald-800">
                  {formatBanglaNumber(selectedClaimProduct.stock || 0)} পিস
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ক্লেম করার পরিমাণ (পিস)
              </label>
              <input 
                type="number"
                min="1"
                max={productDamageStockMap[selectedClaimProduct.id!] || 0}
                value={inputClaimQty || ''}
                onChange={(e) => setInputClaimQty(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm font-black text-slate-900 focus:border-purple-600 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                ক্লেম সম্পন্ন হলে ড্যামেজ স্টক কমবে এবং ভালো স্টকের পরিমাণ বৃদ্ধি পাবে।
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedClaimProduct(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isClaiming}
                onClick={handleExecuteCompanyClaim}
                className="w-1/2 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition disabled:opacity-50"
              >
                {isClaiming ? 'প্রসেস হচ্ছে...' : 'ক্লেম নিশ্চিত করুন'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
