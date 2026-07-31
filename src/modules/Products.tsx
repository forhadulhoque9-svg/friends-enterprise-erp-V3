import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Product } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Package, 
  Hash, 
  Save, 
  X, 
  Info, 
  Building2, 
  Layers, 
  Image as ImageIcon, 
  Eye, 
  Boxes, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  RefreshCw,
  Upload
} from 'lucide-react';

// Helper functions for Bangla numeral conversion and currency formatting
const toBanglaNumerals = (num: number | string | null | undefined): string => {
  if (num === null || num === undefined || num === '') return '০';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
};

const formatBanglaCurrency = (amount: number): string => {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount || 0);
  return '৳ ' + toBanglaNumerals(formatted);
};

const formatBanglaNumber = (num: number): string => {
  const formatted = new Intl.NumberFormat('en-IN').format(num || 0);
  return toBanglaNumerals(formatted);
};

// Common company and category presets for Bangladesh ERP distribution
const DEFAULT_COMPANIES = [
  'স্কয়ার ফুড অ্যান্ড বেভারেজ',
  'প্রাণ ফুড গ্রুপ',
  'আকিজ ফুডস',
  'মেঘনা গ্রুপ অফ ইন্ডাস্ট্রিজ (তীর)',
  'সিটি গ্রুপ ( তীর / ফ্রেশ )',
  'ইউনিলিভার বাংলাদেশ',
  'অলিম্পিক ইন্ডাস্ট্রিজ',
  'এসিআই লিমিটেড',
  'বিডি ফুডস',
  'বসুন্ধরা গ্রুপ',
  'নেসলে বাংলাদেশ',
  'অন্যান্য'
];

const DEFAULT_CATEGORIES = [
  'মসলা ও গুঁড়া',
  'বিস্কুট ও কনফেকশনারি',
  'পানীয় ও জুস',
  'তেল ও ঘি',
  'চাল, ডাল ও খাদ্যশস্য',
  'সাবান, ডিটারজেন্ট ও প্রসাধন',
  'দুগ্ধজাত পণ্য ও ডেইরি',
  'চিপস ও স্ন্যাক্স',
  'চা ও কফি',
  'অন্যান্য'
];

export default function Products() {
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Form Fields
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pcsPerCarton, setPcsPerCarton] = useState<number>(24);
  const [purchasePriceCarton, setPurchasePriceCarton] = useState<number>(0);
  const [purchasePricePcs, setPurchasePricePcs] = useState<number>(0);
  const [salesPriceCarton, setSalesPriceCarton] = useState<number>(0);
  const [salesPricePcs, setSalesPricePcs] = useState<number>(0);
  const [initialCartons, setInitialCartons] = useState<number>(0);
  const [initialLoosePcs, setInitialLoosePcs] = useState<number>(0);

  // Auto-calculated total stock in pieces
  const calculatedStockInPcs = (initialCartons * (pcsPerCarton || 1)) + initialLoosePcs;

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [error, setError] = useState('');

  // Live Query from IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Derived filter options
  const companiesList = ['All', ...Array.from(new Set(
    [...DEFAULT_COMPANIES, ...products.map(p => p.company || p.brand || '').filter(Boolean)]
  ))];

  const categoriesList = ['All', ...Array.from(new Set(
    [...DEFAULT_CATEGORIES, ...products.map(p => p.category || '').filter(Boolean)]
  ))];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const pCode = (p.productCode || p.sku || p.id || '').toLowerCase();
    const pName = (p.productName || p.name || '').toLowerCase();
    const pComp = (p.company || p.brand || '').toLowerCase();

    const matchesSearch = 
      pCode.includes(search.toLowerCase()) || 
      pName.includes(search.toLowerCase()) ||
      pComp.includes(search.toLowerCase());

    const matchesCompany = selectedCompany === 'All' || (p.company || p.brand) === selectedCompany;
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

    return matchesSearch && matchesCompany && matchesCategory;
  });

  // Helper notice display
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open Add Product Form
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setProductCode(`P-${String(products.length + 101).padStart(3, '0')}`);
    setProductName('');
    setCompany(DEFAULT_COMPANIES[0]);
    setCategory(DEFAULT_CATEGORIES[0]);
    setImageUrl('');
    setPcsPerCarton(24);
    setPurchasePriceCarton(0);
    setPurchasePricePcs(0);
    setSalesPriceCarton(0);
    setSalesPricePcs(0);
    setInitialCartons(0);
    setInitialLoosePcs(0);
    setError('');
    setIsFormOpen(true);
  };

  // Open Edit Product Form
  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setProductCode(p.productCode || p.sku || p.id);
    setProductName(p.productName || p.name);
    setCompany(p.company || p.brand || DEFAULT_COMPANIES[0]);
    setCategory(p.category || DEFAULT_CATEGORIES[0]);
    setImageUrl(p.imageUrl || '');
    
    const pcsCarton = p.pcsPerCarton || p.cartonSize || 24;
    setPcsPerCarton(pcsCarton);

    const purPcs = p.purchasePricePcs || p.purchasePrice || 0;
    const purCarton = p.purchasePriceCarton || (purPcs * pcsCarton);
    setPurchasePriceCarton(purCarton);
    setPurchasePricePcs(purPcs);

    const salPcs = p.salesPricePcs || p.retailPrice || 0;
    const salCarton = p.salesPriceCarton || (salPcs * pcsCarton);
    setSalesPriceCarton(salCarton);
    setSalesPricePcs(salPcs);

    const totalStk = p.stockInPcs ?? p.stock ?? 0;
    setInitialCartons(Math.floor(totalStk / (pcsCarton || 1)));
    setInitialLoosePcs(totalStk % (pcsCarton || 1));
    setError('');
    setIsFormOpen(true);
  };

  // Open View Details Modal
  const handleOpenViewModal = (p: Product) => {
    setViewingProduct(p);
    setIsViewOpen(true);
  };

  // Handlers for dynamic price calculation
  const handleCartonPurchaseChange = (val: number) => {
    setPurchasePriceCarton(val);
    if (pcsPerCarton > 0) {
      setPurchasePricePcs(Number((val / pcsPerCarton).toFixed(2)));
    }
  };

  const handlePcsPurchaseChange = (val: number) => {
    setPurchasePricePcs(val);
    setPurchasePriceCarton(Number((val * pcsPerCarton).toFixed(2)));
  };

  const handleCartonSalesChange = (val: number) => {
    setSalesPriceCarton(val);
    if (pcsPerCarton > 0) {
      setSalesPricePcs(Number((val / pcsPerCarton).toFixed(2)));
    }
  };

  const handlePcsSalesChange = (val: number) => {
    setSalesPricePcs(val);
    setSalesPriceCarton(Number((val * pcsPerCarton).toFixed(2)));
  };

  const handlePcsPerCartonChange = (val: number) => {
    const newPcs = val > 0 ? val : 1;
    setPcsPerCarton(newPcs);
    if (purchasePriceCarton > 0) {
      setPurchasePricePcs(Number((purchasePriceCarton / newPcs).toFixed(2)));
    }
    if (salesPriceCarton > 0) {
      setSalesPricePcs(Number((salesPriceCarton / newPcs).toFixed(2)));
    }
  };

  // Image Upload handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save / Update Product
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!productCode.trim()) {
      setError('প্রোডাক্ট কোড আবশ্যক (Product Code is required)।');
      return;
    }

    if (!productName.trim()) {
      setError('প্রোডাক্টের নাম লিখুন (Product Name is required)।');
      return;
    }

    if (!company.trim()) {
      setError('কোম্পানির নাম নির্ধারণ করুন।');
      return;
    }

    if (pcsPerCarton <= 0) {
      setError('প্রতি কার্টনে পিস সংখ্যা ১ বা তার বেশি হতে হবে।');
      return;
    }

    if (purchasePricePcs < 0 || salesPricePcs < 0) {
      setError('মূল্য ঋণাত্মক হতে পারে না।');
      return;
    }

    try {
      const targetId = editingProduct ? editingProduct.id : productCode.trim();

      const productPayload: Product = {
        id: targetId,
        productCode: productCode.trim(),
        sku: productCode.trim(),
        productName: productName.trim(),
        name: productName.trim(),
        company: company.trim(),
        brand: company.trim(),
        category: category.trim() || 'অন্যান্য',
        imageUrl: imageUrl.trim(),
        pcsPerCarton: pcsPerCarton,
        cartonSize: pcsPerCarton,
        unit: 'Pcs',
        purchasePriceCarton: purchasePriceCarton,
        purchasePricePcs: purchasePricePcs,
        purchasePrice: purchasePricePcs,
        salesPriceCarton: salesPriceCarton,
        salesPricePcs: salesPricePcs,
        retailPrice: salesPricePcs,
        stockInPcs: calculatedStockInPcs,
        stock: calculatedStockInPcs
      };

      if (editingProduct) {
        await db.products.update(editingProduct.id, productPayload);
        showNotification('success', `প্রোডাক্ট "${productName}" সফলভাবে আপডেট করা হয়েছে।`);
      } else {
        const existing = await db.products.get(targetId);
        if (existing) {
          setError('এই প্রোডাক্ট কোডটি ইতিমধ্যেই ব্যবহৃত হয়েছে। অনুগ্রহ করে ইউনিক কোড ব্যবহার করুন।');
          return;
        }
        await db.products.add(productPayload);
        showNotification('success', `নতুন প্রোডাক্ট "${productName}" সফলভাবে যুক্ত করা হয়েছে।`);
      }

      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'প্রোডাক্ট সংরক্ষণ করার সময় ত্রুটি ঘটেছে।');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    try {
      await db.products.delete(id);
      setDeleteConfirmId(null);
      showNotification('success', 'প্রোডাক্টটি সফলভাবে মুছে ফেলা হয়েছে।');
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'প্রোডাক্টটি মুছতে ব্যর্থ হয়েছে।');
    }
  };

  // Compute dual unit text (e.g., 10 কার্টন, 5 পিস)
  const renderDualUnitStock = (stockPcs: number, pcsCarton: number) => {
    const size = pcsCarton > 0 ? pcsCarton : 1;
    const cartons = Math.floor((stockPcs || 0) / size);
    const remPcs = (stockPcs || 0) % size;

    return (
      <div className="flex flex-col items-center">
        <span className="font-bold text-slate-900 text-xs">
          {toBanglaNumerals(cartons)} কার্টন, {toBanglaNumerals(remPcs)} পিস
        </span>
        <span className="text-[10px] text-slate-500">
          (সর্বমোট: {formatBanglaNumber(stockPcs || 0)} পিস)
        </span>
      </div>
    );
  };

  // Analytics summary calculations
  const totalProductsCount = products.length;
  const totalStockInPcs = products.reduce((sum, p) => sum + (p.stockInPcs ?? p.stock ?? 0), 0);
  const totalStockValue = products.reduce((sum, p) => {
    const pPcs = p.purchasePricePcs ?? p.purchasePrice ?? 0;
    const stk = p.stockInPcs ?? p.stock ?? 0;
    return sum + (pPcs * stk);
  }, 0);

  return (
    <div className="space-y-6" id="products-module">
      {/* Top Banner & Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl shadow-xs border flex items-center gap-3 animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          )}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6 text-emerald-600" />
            <h1 className="font-sans font-black text-2xl text-slate-900 tracking-tight">
              প্রোডাক্ট রেজিস্টার ও ক্যাটালগ
            </h1>
          </div>
          <p className="font-sans text-xs font-semibold text-slate-500 mt-1">
            দ্বৈত একক (কার্টন ও পিস) স্টক, মূল্য ও ব্র্যান্ড ম্যানুফ্যাকচারার রেজিস্ট্রি
          </p>
        </div>
        <button 
          onClick={handleOpenAddModal} 
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 shadow-sm transition active:scale-95 self-start sm:self-auto cursor-pointer"
          id="add-product-btn"
        >
          <Plus className="h-4 w-4 stroke-[3]" /> নতুন প্রোডাক্ট যোগ করুন
        </button>
      </div>

      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase">মোট প্রোডাক্ট</span>
            <span className="text-lg font-black text-slate-900">
              {toBanglaNumerals(totalProductsCount)} টি
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase">মোট মজুদ স্টক</span>
            <span className="text-lg font-black text-slate-900">
              {formatBanglaNumber(totalStockInPcs)} পিস
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase">স্টকের মোট ক্রয়মূল্য</span>
            <span className="text-lg font-black text-slate-900">
              {formatBanglaCurrency(totalStockValue)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 block uppercase">সক্রিয় কোম্পানি</span>
            <span className="text-lg font-black text-slate-900">
              {toBanglaNumerals(companiesList.length - 1)} টি
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3 md:flex-row md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="প্রোডাক্ট কোড, নাম বা কোম্পানি দিয়ে খুঁজুন..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            id="product-search-input"
          />
        </div>

        {/* Company Dropdown */}
        <div className="relative min-w-[180px]">
          <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <select 
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs font-bold text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none"
            id="product-company-filter"
          >
            <option value="All">সকল কোম্পানি</option>
            {companiesList.filter(c => c !== 'All').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Category Dropdown */}
        <div className="relative min-w-[180px]">
          <Layers className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs font-bold text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none"
            id="product-category-filter"
          >
            <option value="All">সকল ক্যাটাগরি</option>
            {categoriesList.filter(c => c !== 'All').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters */}
        {(search || selectedCompany !== 'All' || selectedCategory !== 'All') && (
          <button
            onClick={() => {
              setSearch('');
              setSelectedCompany('All');
              setSelectedCategory('All');
            }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" /> রিসেট
          </button>
        )}
      </div>

      {/* Product List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center">ছবি</th>
                <th className="py-3.5 px-4">কোড</th>
                <th className="py-3.5 px-4">প্রোডাক্টের নাম ও ক্যাটাগরি</th>
                <th className="py-3.5 px-4">কোম্পানি</th>
                <th className="py-3.5 px-4 text-center">কার্টন সাইজ</th>
                <th className="py-3.5 px-4 text-right">ক্রয়মূল্য (কার্টন / পিস)</th>
                <th className="py-3.5 px-4 text-right">বিক্রয়মূল্য (কার্টন / পিস)</th>
                <th className="py-3.5 px-4 text-center">বর্তমান স্টক</th>
                <th className="py-3.5 px-4 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 text-xs font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 text-sm">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400 mt-1">অনুসন্ধান ফিল্টার পরিবর্তন করুন অথবা নতুন প্রোডাক্ট যোগ করুন।</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const pCode = p.productCode || p.sku || p.id;
                  const pName = p.productName || p.name;
                  const pCompany = p.company || p.brand || 'N/A';
                  const pcsCarton = p.pcsPerCarton || p.cartonSize || 24;
                  const purPcs = p.purchasePricePcs ?? p.purchasePrice ?? 0;
                  const purCarton = p.purchasePriceCarton ?? (purPcs * pcsCarton);
                  const salPcs = p.salesPricePcs ?? p.retailPrice ?? 0;
                  const salCarton = p.salesPriceCarton ?? (salPcs * pcsCarton);
                  const stockPcs = p.stockInPcs ?? p.stock ?? 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      {/* Image Thumbnail */}
                      <td className="py-3 px-4 text-center">
                        <div className="h-10 w-10 mx-auto rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {p.imageUrl ? (
                            <img 
                              src={p.imageUrl} 
                              alt={pName} 
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                // Fallback on image load error
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                      </td>

                      {/* Code (System Identifier in English) */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <span className="inline-block bg-slate-100 border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-900">
                          {pCode}
                        </span>
                      </td>

                      {/* Name & Category */}
                      <td className="py-3 px-4">
                        <span className="font-black text-slate-900 block text-xs">{pName}</span>
                        <span className="inline-block bg-emerald-50 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded mt-1">
                          {p.category || 'অন্যান্য'}
                        </span>
                      </td>

                      {/* Company */}
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {pCompany}
                      </td>

                      {/* Carton Size */}
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {toBanglaNumerals(pcsCarton)} পিস
                      </td>

                      {/* Purchase Prices */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-slate-900 block">
                          {formatBanglaCurrency(purCarton)} / কার্টন
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          ({formatBanglaCurrency(purPcs)} / পিস)
                        </span>
                      </td>

                      {/* Sales Prices */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-emerald-700 block">
                          {formatBanglaCurrency(salCarton)} / কার্টন
                        </span>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">
                          ({formatBanglaCurrency(salPcs)} / পিস)
                        </span>
                      </td>

                      {/* Dual-Unit Stock */}
                      <td className="py-3 px-4 text-center">
                        {renderDualUnitStock(stockPcs, pcsCarton)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleOpenViewModal(p)} 
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="বিস্তারিত দেখুন"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenEditModal(p)} 
                            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="সম্পাদনা করুন"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(p.id)} 
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =======================================
          ADD / EDIT PRODUCT FORM MODAL
         ======================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-emerald-400" />
                <h2 className="font-sans font-black text-base tracking-tight">
                  {editingProduct ? 'প্রোডাক্ট তথ্য সংশোধন করুন' : 'নতুন প্রোডাক্ট রেজিস্টার করুন'}
                </h2>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)} 
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Product Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    প্রোডাক্ট কোড (Product Code) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="e.g. P-101" 
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      disabled={!!editingProduct}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 py-2 pl-9 pr-3 text-xs font-mono font-bold focus:border-emerald-500 focus:bg-white focus:outline-none"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ইংরেজি কোড (সিস্টেম আইডি হিসেবে সংরক্ষিত)
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    প্রোডাক্টের নাম (Product Name) <span className="text-rose-600">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="যেমন: রাঁধুনী গুঁড়া মরিচ ২০০ গ্রাম" 
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Company & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    কোম্পানির নাম (Company) <span className="text-rose-600">*</span>
                  </label>
                  <input 
                    type="text" 
                    list="company-list-suggestions"
                    placeholder="কোম্পানি বা ব্র্যান্ড নির্বাচন করুন" 
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <datalist id="company-list-suggestions">
                    {DEFAULT_COMPANIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    ক্যাটাগরি (Category) <span className="text-rose-600">*</span>
                  </label>
                  <input 
                    type="text" 
                    list="category-list-suggestions"
                    placeholder="ক্যাটাগরি নির্বাচন করুন" 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <datalist id="category-list-suggestions">
                    {DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
              </div>

              {/* Image URL or File Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  প্রোডাক্টের ছবি (Image URL অথবা ফাইল আপলোড)
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <ImageIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="https://example.com/image.jpg" 
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span>আপলোড</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange} 
                      className="hidden" 
                    />
                  </label>
                </div>
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <img src={imageUrl} alt="Preview" className="h-10 w-10 object-cover rounded-lg border border-slate-300" />
                    <span className="text-[11px] text-slate-600 font-semibold">ছবির প্রিভিউ সফল হয়েছে</span>
                    <button 
                      type="button" 
                      onClick={() => setImageUrl('')} 
                      className="ml-auto text-rose-600 text-[11px] font-bold hover:underline"
                    >
                      ছবি সরান
                    </button>
                  </div>
                )}
              </div>

              {/* Carton Size & Dual-Unit Initial Stock */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase mb-1">
                    কার্টন সাইজ (প্রতি কার্টনে পিস) <span className="text-rose-600">*</span>
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    placeholder="যেমন: ২৪" 
                    value={pcsPerCarton || ''}
                    onChange={(e) => handlePcsPerCartonChange(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    ১ কার্টনে মোট পিসের সংখ্যা (যেমন: ২৪ পিস)
                  </span>
                </div>

                {/* Initial Stock Fields (Cartons & Loose Pcs side-by-side) */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <span className="block text-xs font-black text-slate-800 uppercase">
                    প্রাথমিক স্টক এন্ট্রি (Initial Stock Entry)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        প্রাথমিক কার্টন স্টক (Initial Stock - Cartons)
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        value={initialCartons === 0 ? '0' : initialCartons}
                        onChange={(e) => setInitialCartons(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        প্রাথমিক খুচরা পিস (Initial Stock - Loose Pcs)
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        value={initialLoosePcs === 0 ? '0' : initialLoosePcs}
                        onChange={(e) => setInitialLoosePcs(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Live Summary Text Box */}
                  <div className="text-xs font-bold text-emerald-900 bg-emerald-50/90 p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                    <span className="text-emerald-950 font-black">
                      সর্বমোট স্টক: {toBanglaNumerals(initialCartons)} কার্টন, {toBanglaNumerals(initialLoosePcs)} পিস (মোট {formatBanglaNumber(calculatedStockInPcs)} পিস)
                    </span>
                  </div>
                </div>
              </div>

              {/* Purchase Prices (Cost) */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
                <span className="text-xs font-black text-amber-950 uppercase block border-b border-amber-200 pb-1">
                  ক্রয়মূল্য বিবরণী (Purchase Prices)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      কার্টন ক্রয়মূল্য (৳)
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="যেমন: ১২০০" 
                      value={purchasePriceCarton || ''}
                      onChange={(e) => handleCartonPurchaseChange(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      পিস ক্রয়মূল্য (৳ - স্বয়ংক্রিয়)
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="যেমন: ৫০" 
                      value={purchasePricePcs || ''}
                      onChange={(e) => handlePcsPurchaseChange(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sales Prices */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3">
                <span className="text-xs font-black text-emerald-950 uppercase block border-b border-emerald-200 pb-1">
                  বিক্রয়মূল্য বিবরণী (Sales Prices)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      কার্টন বিক্রয়মূল্য (৳)
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="যেমন: ১৪৪০" 
                      value={salesPriceCarton || ''}
                      onChange={(e) => handleCartonSalesChange(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      পিস বিক্রয়মূল্য (৳ - স্বয়ংক্রিয়)
                    </label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="যেমন: ৬০" 
                      value={salesPricePcs || ''}
                      onChange={(e) => handlePcsSalesChange(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Expected Profit Calculation Preview */}
              {salesPricePcs > 0 && purchasePricePcs > 0 && (
                <div className="rounded-xl bg-blue-50 p-3.5 border border-blue-200 text-xs font-bold text-blue-900 flex justify-between items-center">
                  <span>প্রতি পিস আনুমানিক লাভ (Profit/Pcs):</span>
                  <span className="text-emerald-700 text-sm">
                    {formatBanglaCurrency(salesPricePcs - purchasePricePcs)} (+{toBanglaNumerals((((salesPricePcs - purchasePricePcs) / purchasePricePcs) * 100).toFixed(1))}%)
                  </span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)} 
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================
          VIEW PRODUCT DETAILS MODAL
         ======================================= */}
      {isViewOpen && viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-emerald-400" />
                <h2 className="font-sans font-black text-base tracking-tight">
                  প্রোডাক্টের বিস্তারিত বিবরণ
                </h2>
              </div>
              <button 
                onClick={() => setIsViewOpen(false)} 
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              {/* Top Banner with Image & Title */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="h-16 w-16 rounded-xl border border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {viewingProduct.imageUrl ? (
                    <img src={viewingProduct.imageUrl} alt={viewingProduct.productName || viewingProduct.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div>
                  <span className="font-mono text-xs font-black text-slate-500 block">
                    কোড: {viewingProduct.productCode || viewingProduct.sku || viewingProduct.id}
                  </span>
                  <h3 className="font-black text-base text-slate-900 mt-0.5">
                    {viewingProduct.productName || viewingProduct.name}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    <span className="inline-block bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      কোম্পানি: {viewingProduct.company || viewingProduct.brand}
                    </span>
                    <span className="inline-block bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded">
                      ক্যাটাগরি: {viewingProduct.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual Unit Stock Details */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                <span className="text-xs font-bold text-emerald-800 block uppercase">বর্তমান মজুদ স্টক (Dual-Unit)</span>
                <div className="mt-1 text-base font-black text-emerald-950">
                  {renderDualUnitStock(
                    viewingProduct.stockInPcs ?? viewingProduct.stock ?? 0, 
                    viewingProduct.pcsPerCarton ?? viewingProduct.cartonSize ?? 24
                  )}
                </div>
              </div>

              {/* Pricing Breakdown Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">কার্টন সাইজ:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {toBanglaNumerals(viewingProduct.pcsPerCarton || viewingProduct.cartonSize || 24)} পিস
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">কার্টন ক্রয়মূল্য:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatBanglaCurrency(viewingProduct.purchasePriceCarton || ((viewingProduct.purchasePricePcs || viewingProduct.purchasePrice || 0) * (viewingProduct.pcsPerCarton || 24)))}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">পিস ক্রয়মূল্য:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatBanglaCurrency(viewingProduct.purchasePricePcs || viewingProduct.purchasePrice || 0)}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-600 block">কার্টন বিক্রয়মূল্য:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatBanglaCurrency(viewingProduct.salesPriceCarton || ((viewingProduct.salesPricePcs || viewingProduct.retailPrice || 0) * (viewingProduct.pcsPerCarton || 24)))}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 col-span-2">
                  <span className="text-[11px] font-bold text-emerald-600 block">পিস বিক্রয়মূল্য:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {formatBanglaCurrency(viewingProduct.salesPricePcs || viewingProduct.retailPrice || 0)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={() => setIsViewOpen(false)} 
                  className="rounded-xl bg-slate-900 text-white px-5 py-2 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================
          DELETE CONFIRMATION MODAL
         ======================================= */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="font-black text-base text-slate-900">
                প্রোডাক্ট মুছে ফেলার নিশ্চিতকরণ
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              আপনি কি নিশ্চিত যে আপনি এই প্রোডাক্টটি ডাটাবেস থেকে মুছে ফেলতে চান? এটি মুছে ফেললে তা পুনরায় পুনরুদ্ধার করা যাবে না।
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button 
                onClick={() => handleDeleteProduct(deleteConfirmId)} 
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-xs"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
