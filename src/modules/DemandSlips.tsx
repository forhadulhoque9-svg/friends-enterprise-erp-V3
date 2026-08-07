import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';
import { db } from '../db/db';
import { DemandSheet, DemandSheetItem, Company, Product } from '../types';
import { toBanglaNumerals, formatBanglaCurrency, formatBanglaNumber } from '../lib/utils';
import companyLogoPng from '../assets/images/company_logo.png';
import { 
  FileCheck, 
  Plus, 
  Building2, 
  Package, 
  Printer, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Layers, 
  FileText,
  Boxes,
  RefreshCw,
  Eye,
  Calendar,
  DollarSign,
  MessageCircle,
  Image as ImageIcon,
  FileDown,
  Loader2,
  ChevronDown
} from 'lucide-react';
import UniversalPrintModal from '../components/UniversalPrintModal';

// Helper functions moved to utils.ts

export default function DemandSlips() {
  const demandSheets = useLiveQuery(() => db.demandSheets.toArray()) || [];
  const companies = useLiveQuery(() => db.companies.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Header State (No Invoice Terms)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const profile = useLiveQuery(() => db.businessProfiles.get('bp_default'));
  const compName = profile?.businessName || 'মেসার্স ফাহিম এন্টারপ্রাইজ';
  const logo = profile?.logoBase64 || companyLogoPng;
  const [myEnterpriseName, setMyEnterpriseName] = useState<string>('');

  React.useEffect(() => {
    if (profile?.businessName) {
      setMyEnterpriseName(profile.businessName);
    } else {
      setMyEnterpriseName('মেসার্স ফাহিম এন্টারপ্রাইজ');
    }
  }, [profile]);
  // Generate sequential demand number
  const generateNextDemandNo = (sheets: DemandSheet[]) => {
    const date = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = monthNames[date.getMonth()];
    const prefix = `S & B ${currentMonth}-`;
    
    const currentMonthSheets = sheets.filter(s => s.demandNo?.startsWith(prefix));
    let maxSeq = 0;
    for (const s of currentMonthSheets) {
      const seqStr = s.demandNo.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    return `${prefix}${(maxSeq + 1).toString().padStart(2, '0')}`;
  };

  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companies;
    return companies.filter(c => 
      c.name.toLowerCase().includes(companySearch.toLowerCase()) || 
      (c.phone && c.phone.includes(companySearch))
    );
  }, [companies, companySearch]);

  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [demandNo, setDemandNo] = useState<string>('');
  
  const [demandDate, setDemandDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [onlineEntryAmount, setOnlineEntryAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('হ্যান্ড ক্যাশ');
  const [bankName, setBankName] = useState<string>('');

  // Dual-Unit Line Item Draft State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [cartonsInput, setCartonsInput] = useState<number>(0);
  const [customRate, setCustomRate] = useState<number | ''>('');

  // Draft items list
  const [items, setItems] = useState<DemandSheetItem[]>([]);

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  React.useEffect(() => {
    if (activeTab === 'create' && demandNo === '' && demandSheets) {
      setDemandNo(generateNextDemandNo(demandSheets));
    }
  }, [activeTab, demandSheets, demandNo]);

  const [searchHistory, setSearchHistory] = useState<string>('');
  const [filterCompanyHistory, setFilterCompanyHistory] = useState<string>('');
  const [viewingDemandSheet, setViewingDemandSheet] = useState<DemandSheet | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);

  // Selected Company Object & Ledger Balance
  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === selectedCompanyId);
  }, [companies, selectedCompanyId]);

  const previousBalance = useMemo(() => {
    if (!selectedCompany) return 0;
    return selectedCompany.outstandingBalance || 0;
  }, [selectedCompany]);

  // Available products filtered strictly by selected company
  const companyProducts = useMemo(() => {
    if (!selectedCompanyId) return [];
    
    const selectedCompName = (selectedCompany?.name || '').trim().toLowerCase();
    const sId = String(selectedCompanyId).trim();

    return products.filter(p => {
      if (!p) return false;
      
      // 1. Safe ID matching (cast to string to handle numeric/string mismatches)
      const pCompId = p.companyId ? String(p.companyId).trim() : '';
      if (pCompId && sId && pCompId === sId) return true;
      
      // 2. Robust Name matching (if ID match fails or is missing)
      const pCompName = (p.company || '').trim().toLowerCase();
      const pBrandName = (p.brand || '').trim().toLowerCase();
      
      if (selectedCompName) {
        // Direct match
        if (pCompName === selectedCompName || pBrandName === selectedCompName) return true;
        
        // Contextual fallback: if the product's company name is contained within or contains the selected company
        if (pCompName && (pCompName.includes(selectedCompName) || selectedCompName.includes(pCompName))) return true;
      }
      
      return false;
    });
  }, [products, selectedCompanyId, selectedCompany]);

  // Selected Product Object
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Handle Product Selection Change -> Auto Populate Rate & Reset Counts
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    setCartonsInput(0);

    const prod = products.find(p => p.id === prodId);
    if (prod) {
      // Auto populate rate per carton or piece based on purchase pricing
      const rateCarton = prod.purchasePriceCarton || (prod.purchasePrice ? prod.purchasePrice * (prod.pcsPerCarton || prod.cartonSize || 1) : 0);
      setCustomRate(rateCarton || prod.purchasePrice || 0);
    } else {
      setCustomRate('');
    }
  };

  // Auto-calculated Line Item metrics for input fields
  const currentPcsPerCarton = selectedProduct ? (selectedProduct.pcsPerCarton || selectedProduct.cartonSize || 1) : 1;
  const currentTotalPcs = (cartonsInput * currentPcsPerCarton);
  
  // Rate per carton
  const currentRatePerCarton = typeof customRate === 'number' ? customRate : 0;
  const currentRatePerPcs = currentPcsPerCarton > 0 ? (currentRatePerCarton / currentPcsPerCarton) : currentRatePerCarton;
  const currentLineTotal = cartonsInput * currentRatePerCarton;

  // Add Item to Draft Table
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      setNotification({ type: 'error', message: 'অনুগ্রহ করে প্রথমে কোম্পানি নির্বাচন করুন।' });
      return;
    }
    if (!selectedProduct) {
      setNotification({ type: 'error', message: 'অনুগ্রহ করে একটি পণ্য নির্বাচন করুন।' });
      return;
    }
    if (cartonsInput <= 0) {
      setNotification({ type: 'error', message: 'অনুগ্রহ করে কার্টুনের পরিমাণ দিন।' });
      return;
    }

    const newItem: DemandSheetItem = {
      productId: selectedProduct.id!,
      productName: selectedProduct.name || selectedProduct.productName || 'Unnamed SKU',
      cartons: cartonsInput,
      loosePcs: 0,
      pcsPerCarton: currentPcsPerCarton,
      qty: currentTotalPcs,
      rate: currentRatePerCarton,
      ratePerCarton: currentRatePerCarton,
      ratePerPcs: currentRatePerPcs,
      total: currentLineTotal
    };

    setItems([...items, newItem]);

    // Reset Item Form
    setSelectedProductId('');
    setCartonsInput(0);
    setCustomRate('');
    setNotification({ type: 'success', message: 'পণ্য ডিমান্ড লিস্টে যোগ করা হয়েছে!' });
    setTimeout(() => setNotification(null), 2500);
  };

  // Remove Item from Draft
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Subtotal of Current New Demand
  const newDemandSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total, 0);
  }, [items]);

  // Total Demand Amount = New Demand Subtotal - Online Entry Amount
  const totalDemandAmount = newDemandSubtotal - (typeof onlineEntryAmount === 'number' ? onlineEntryAmount : 0);

  // Aggregate item unit totals in draft
  const totalCartonsDraft = items.reduce((sum, i) => sum + (i.cartons || 0), 0);
  const totalPcsDraft = items.reduce((sum, i) => sum + i.qty, 0);

  const handleDeleteDemand = async (id: string) => {
    if (confirm('আপনি কি এই ডিমান্ড স্লিপটি মুছে ফেলতে চান?')) {
      try {
        await db.demandSheets.delete(id);
        setNotification({ type: 'success', message: 'ডিমান্ড স্লিপটি সফলভাবে মুছে ফেলা হয়েছে!' });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        setNotification({ type: 'error', message: 'মুছে ফেলতে ত্রুটি: ' + err });
      }
    }
  };

  // Submit Demand Slip
  const handleSubmitDemandSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      setNotification({ type: 'error', message: 'কোম্পানি নির্বাচন করা হয়নি!' });
      return;
    }
    if (items.length === 0) {
      setNotification({ type: 'error', message: 'ডিমান্ড স্লিপে অন্তত একটি পণ্য যোগ করুন।' });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      const newDemandSlip: DemandSheet = {
        id: `ds_${Date.now()}`,
        demandNo,
        date: demandDate,
        businessProfileId: 'bp_default',
        businessName: myEnterpriseName,
        companyId: selectedCompanyId,
        companyName: selectedCompany?.name || 'কোম্পানি',
        items,
        remarks,
        onlineEntryAmount: typeof onlineEntryAmount === 'number' ? onlineEntryAmount : 0,
        paymentMethod: typeof onlineEntryAmount === 'number' && onlineEntryAmount > 0 ? paymentMethod : undefined,
        bankName: typeof onlineEntryAmount === 'number' && onlineEntryAmount > 0 && paymentMethod === 'ব্যাংক' ? bankName : undefined,
        netOutstanding: previousBalance + newDemandSubtotal - (typeof onlineEntryAmount === 'number' ? onlineEntryAmount : 0),
        companyOutstanding: previousBalance,
        currentOrderAmount: newDemandSubtotal,
        orderTotal: totalDemandAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.demandSheets.add(newDemandSlip);
      
      setNotification({
        type: 'success',
        message: `ডিমান্ড স্লিপ #${demandNo} সফলভাবে সংরক্ষিত হয়েছে!`
      });

      // Reset form
      setDemandNo('');
      setItems([]);
      setRemarks('');
      setOnlineEntryAmount('');
      setPaymentMethod('হ্যান্ড ক্যাশ');
      setBankName('');
      setSelectedCompanyId('');
      
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      setNotification({ type: 'error', message: 'ডিমান্ড স্লিপ সংরক্ষণে ত্রুটি: ' + err });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter History Demand Slips
  const filteredHistory = useMemo(() => {
    return demandSheets.filter(ds => {
      const matchesSearch = ds.demandNo.toLowerCase().includes(searchHistory.toLowerCase()) ||
                            (ds.companyName && ds.companyName.toLowerCase().includes(searchHistory.toLowerCase()));
      const matchesCompany = !filterCompanyHistory || ds.companyId === filterCompanyHistory;
      return matchesSearch && matchesCompany;
    }).sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [demandSheets, searchHistory, filterCompanyHistory]);

  // Print Handle
  const handlePrint = async () => {
    const element = document.getElementById('printable-demand-voucher');
    if (!element) {
      window.print();
      return;
    }

    try {
      // Get all current styles to preserve layout
      let cssRules = '';
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          if (rules) {
            for (let j = 0; j < rules.length; j++) {
              cssRules += rules[j].cssText + '\n';
            }
          }
        } catch (e) {}
      }

      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Demand Slip - ${viewingDemandSheet?.demandNo}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssRules}
    @page { size: A4; margin: 10mm; }
    body { background: white !important; padding: 0; margin: 0; }
    #printable-demand-voucher { width: 100% !important; max-width: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
  </style>
</head>
<body>
  ${element.outerHTML}
</body>
</html>`;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.height = '0';
      iframe.style.width = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(fullHtml);
        iframeDoc.close();
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            window.print();
          }
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print error:', err);
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    if (!viewingDemandSheet || !printableRef.current) return;
    
    try {
      const element = printableRef.current;
      const cssRules = Array.from(document.styleSheets)
        .filter(s => !s.href || s.href.startsWith(window.location.origin))
        .map(s => {
          try {
            return Array.from(s.cssRules).map(r => r.cssText).join('\n');
          } catch (e) { return ''; }
        }).join('\n');

      const fullHtml = `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <title>Demand Slip - ${viewingDemandSheet.demandNo}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssRules}
    @page { size: A4; margin: 10mm; }
    body { background: white !important; padding: 20px; font-family: sans-serif; }
    #printable-demand-voucher { width: 100% !important; max-width: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
  </style>
</head>
<body>
  ${element.outerHTML}
  <script>
    window.onload = () => {
      // Optional: Auto-trigger print when opened as file
      // window.print();
    };
  </script>
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Demand_Slip_${viewingDemandSheet.demandNo.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (Capacitor.isNativePlatform()) {
        Toast.show({ text: 'ডাউনলোড শুরু হয়েছে (HTML ফরম্যাট)' });
      }
    } catch (err) {
      console.error('Download error:', err);
      handlePrint();
    }
  };

  const handleShare = async () => {
    if (!viewingDemandSheet) return;
    setIsGeneratingPdf(true);

    try {
      // Attempt native share of text/link first, fallback to WhatsApp
      if (navigator.share && Capacitor.isNativePlatform()) {
        try {
          await navigator.share({
            title: `ডিমান্ড স্লিপ - ${viewingDemandSheet.demandNo}`,
            text: `${myEnterpriseName}\nডিমান্ড স্লিপ: ${viewingDemandSheet.demandNo}\nকোম্পানি: ${viewingDemandSheet.companyName}\nমোট: ${formatBanglaCurrency(viewingDemandSheet.orderTotal)}`,
            url: window.location.href
          });
        } catch (err) {
          handleShareWhatsApp();
        }
      } else {
        handleShareWhatsApp();
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // WhatsApp Share Handle
  const handleShareWhatsApp = () => {
    if (!viewingDemandSheet) return;
    
    const compNameHeader = myEnterpriseName;
    const title = `ডিমান্ড স্লিপ ভাউচার (#${viewingDemandSheet.demandNo})`;
    
    let message = `*${compNameHeader}*\n`;
    message += `*${title}*\n`;
    message += `তারিখ: ${toBanglaNumerals(viewingDemandSheet.date)}\n`;
    message += `কোম্পানি: ${viewingDemandSheet.companyName}\n\n`;
    
    message += `*চাহিদাকৃত পণ্য:* \n`;
    viewingDemandSheet.items.forEach((it, i) => {
      message += `${toBanglaNumerals(i + 1)}. ${it.productName}: ${toBanglaNumerals(it.cartons)} কার্টুন\n`;
    });
    
    const totalAmt = viewingDemandSheet.orderTotal || ((viewingDemandSheet.currentOrderAmount || 0) + (viewingDemandSheet.companyOutstanding || 0));
    message += `\n*মোট বিল:* ${formatBanglaCurrency(totalAmt)}\n`;
    message += `\n_Generated by Fast-Entry POS_`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-12" id="demand-slips-module">
      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs font-bold hover:opacity-75">✕</button>
        </div>
      )}

      {/* Main Module Header & View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck className="h-6 w-6 text-emerald-600" />
            <span>ডিমান্ড স্লিপ (DEMAND SLIP)</span>
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">
            কোম্পানিভিত্তিক মালামালের চাহিদা ও সমন্বিত বকেয়া হিসাব ব্যবস্থাপনা
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'create'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
            id="tab-create-demand"
          >
            <Plus className="h-4 w-4" />
            <span>নতুন ডিমান্ড এন্ট্রি</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
            id="tab-history-demand"
          >
            <FileText className="h-4 w-4" />
            <span>ডিমান্ড স্লিপ রেকর্ড ({toBanglaNumerals(demandSheets.length)})</span>
          </button>
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* SECTION 1: HEADER & ENTERPRISE CONFIGURATION (Side-by-side: Select Company & My Enterprise Name) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                ১. প্রতিষ্ঠানের মৌলিক তথ্য (Header Configuration)
              </span>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                স্মারক নং: {demandNo} | তারিখ: {toBanglaNumerals(demandDate)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Field 1: Select Company */}
              <div className="relative">
                <label className="block text-xs font-black text-slate-800 uppercase mb-1.5">
                  কোম্পানির নাম (Select Company) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition shadow-xs flex items-center justify-between"
                    id="select-company-dropdown-btn"
                  >
                    <span className={selectedCompanyId ? 'text-slate-900' : 'text-slate-400'}>
                      {selectedCompany 
                        ? `${selectedCompany.name} ${selectedCompany.phone ? `(${selectedCompany.phone})` : ''}`
                        : '-- কোম্পানি নির্বাচন করুন --'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCompanyDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setIsCompanyDropdownOpen(false)}
                      />
                      <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in duration-100 origin-top">
                        <div className="sticky top-0 bg-white px-2 py-2 border-b border-slate-100 z-10">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={companySearch}
                              onChange={(e) => setCompanySearch(e.target.value)}
                              placeholder="কোম্পানি খুঁজুন..."
                              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold focus:outline-none focus:border-emerald-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>
                        </div>
                        {filteredCompanies.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-500 italic text-center">
                            কোনো কোম্পানি পাওয়া যায়নি
                          </div>
                        ) : (
                          filteredCompanies.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCompanyId(c.id);
                                setSelectedProductId('');
                                setItems([]);
                                setIsCompanyDropdownOpen(false);
                                setCompanySearch('');
                              }}
                              className={`w-full text-left px-4 py-2.5 text-[11px] font-bold transition-colors border-b border-slate-50 last:border-0 ${
                                selectedCompanyId === c.id 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {c.name} {c.phone ? <span className="text-slate-400 font-normal ml-1">({c.phone})</span> : ''}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                {!selectedCompanyId && (
                  <p className="text-[11px] font-medium text-slate-400 mt-1">
                    * কোম্পানি সিলেক্ট করলে সংশ্লিষ্ট কোম্পানির পণ্য ও বকেয়া লেজার লোড হবে।
                  </p>
                )}
              </div>

              {/* Field 2: My Enterprise Name */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase mb-1.5">
                  আমার প্রতিষ্ঠানের নাম (My Enterprise Name) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={myEnterpriseName}
                  onChange={(e) => setMyEnterpriseName(e.target.value)}
                  placeholder={`যেমন: ${compName}`}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition shadow-xs"
                  required
                  id="my-enterprise-name-input"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: AUTOMATED COMPANY LEDGER SUMMARY CARD */}
          {selectedCompany && (
            <div className="bg-linear-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-2xl text-white shadow-md border border-slate-700/60 animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <Building2 className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{selectedCompany.name}</h3>
                    <p className="text-[11px] text-slate-300 font-medium">স্বয়ংক্রিয় সমন্বিত ডিমান্ড বিল সামারি</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700/50">
                  কোম্পানি লেজার যুক্ত
                </span>
              </div>

              {/* 3 Key Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Stat 1: Previous Balance */}
                <div className={`backdrop-blur-xs p-4 rounded-xl border transition ${previousBalance > 0 ? 'bg-rose-500/10 border-rose-500/30' : previousBalance < 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                  <span className={`text-[11px] font-bold block mb-1 ${previousBalance > 0 ? 'text-rose-200' : previousBalance < 0 ? 'text-emerald-200' : 'text-slate-300'}`}>
                    পূর্বের কোম্পানি বকেয়া (Previous Balance)
                  </span>
                  <div className={`text-lg font-black tracking-tight ${previousBalance > 0 ? 'text-rose-300' : previousBalance < 0 ? 'text-emerald-300' : 'text-white'}`}>
                    {formatBanglaCurrency(Math.abs(previousBalance))}
                  </div>
                  <span className={`text-[11px] font-black block mt-1 ${previousBalance > 0 ? 'text-rose-400' : previousBalance < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {previousBalance > 0 ? 'সাবেক জের: ক্রেডিট (Credit)' : previousBalance < 0 ? 'সাবেক জের: ডেবিট (Debit)' : 'কোনো বকেয়া নেই'}
                  </span>
                </div>

                {/* Stat 2: New Demand Subtotal */}
                <div className="bg-white/5 backdrop-blur-xs p-4 rounded-xl border border-white/10 hover:border-white/20 transition">
                  <span className="text-[11px] font-bold text-slate-300 block mb-1">
                    নতুন ডিমান্ড পণ্যমূল্য (New Demand Subtotal)
                  </span>
                  <div className="text-lg font-black text-emerald-300 tracking-tight">
                    {formatBanglaCurrency(newDemandSubtotal)}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    বর্তমান ড্রাফট পণ্যের মোট মূল্য
                  </span>
                </div>

                {/* Stat 3: Total Demand Amount */}
                <div className="bg-emerald-500/15 backdrop-blur-xs p-4 rounded-xl border border-emerald-500/30 hover:border-emerald-500/50 transition">
                  <span className="text-[11px] font-bold text-emerald-200 block mb-1">
                    সর্বমোট ডিমান্ড বিল (Total Demand Amount)
                  </span>
                  <div className="text-xl font-black text-emerald-400 tracking-tight">
                    {formatBanglaCurrency(totalDemandAmount)}
                  </div>
                  <span className="text-[10px] text-emerald-300/80 block mt-1 font-semibold">
                    (শুধু বর্তমান ডিমান্ডের মোট মূল্য)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: DUAL-UNIT ITEM SELECTION TABLE & DRAFT LIST */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-600" />
                ২. দ্বৈত একক ডিমান্ড পণ্য নির্বাচন (Dual-Unit Item Entry)
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                ফিল্টারকৃত পণ্য: {toBanglaNumerals(companyProducts.length)} টি
              </span>
            </div>

            {!selectedCompanyId ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                <Building2 className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">ডিমান্ড স্লিপে পণ্য যোগ করতে প্রথমে ওপর থেকে কোম্পানি নির্বাচন করুন</p>
                <p className="text-[11px] text-slate-400">কোম্পানি নির্বাচন করলে সেই কোম্পানির জন্য নিবন্ধিত পণ্যগুলো এখানে দৃশ্যমান হবে।</p>
              </div>
            ) : companyProducts.length === 0 ? (
              <div className="p-6 text-center bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto" />
                <p className="text-xs font-bold">এই কোম্পানির কোনো পণ্য ক্যাটালগে পাওয়া যায়নি!</p>
                <p className="text-[11px]">পণ্য ক্যাটালগ (Products Module) এ গিয়ে কোম্পানির পণ্য যোগ করুন।</p>
              </div>
            ) : (
              <form onSubmit={handleAddItem} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  
                  {/* Field A: Product Dropdown */}
                  <div className="lg:col-span-2">
                    <label 
                      htmlFor="product-selection-dropdown"
                      className="block text-xs font-black text-slate-800 uppercase mb-1 cursor-pointer"
                    >
                      পণ্য নির্বাচন (Select Product) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none shadow-sm flex items-center justify-between transition-all"
                      >
                        <span className={selectedProductId ? 'text-slate-900' : 'text-slate-400'}>
                          {selectedProduct 
                            ? `${(selectedProduct.name || selectedProduct.productName || '').trim()} (কার্টন: ${toBanglaNumerals(selectedProduct.pcsPerCarton || selectedProduct.cartonSize || 1)})`
                            : '-- পণ্য সিলেক্ট করুন --'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isProductDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[60]" 
                            onClick={() => setIsProductDropdownOpen(false)}
                          />
                          <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in zoom-in duration-100 origin-top">
                            {companyProducts.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-500 italic text-center">
                                {selectedCompanyId ? 'এই কোম্পানির কোনো পণ্য পাওয়া যায়নি' : 'প্রথমে কোম্পানি নির্বাচন করুন'}
                              </div>
                            ) : (
                              companyProducts.map((p, idx) => (
                                <button
                                  key={p.id || `p-opt-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    handleProductSelect(p.id);
                                    setIsProductDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-4 py-3 text-[11px] font-bold transition-colors border-b border-slate-50 last:border-0 ${
                                    selectedProductId === p.id 
                                      ? 'bg-emerald-50 text-emerald-700' 
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {(p.name || p.productName || 'Unnamed').trim()} 
                                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                                    কার্টন সাইজ: {toBanglaNumerals(p.pcsPerCarton || p.cartonSize || 1)} পিস
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Field B: Cartons Input */}
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      কার্টুন সংখ্যা (Cartons)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cartonsInput === 0 ? '0' : cartonsInput}
                      onChange={(e) => setCartonsInput(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none shadow-2xs"
                    />
                  </div>

                  {/* Field D: Rate Input */}
                  <div className="lg:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      প্রতি কার্টুন মূল্য (Rate/Carton)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none shadow-2xs"
                    />
                  </div>

                </div>

                {/* Dynamic Summary Preview for Item Entry */}
                {selectedProduct && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/80 text-emerald-950 text-xs font-bold">
                    <div>
                      <span>মোট পরিমাণ: </span>
                      <span className="text-emerald-900 font-black">
                        {toBanglaNumerals(cartonsInput)} কার্টুন
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>লাইন টোটাল: <strong className="text-emerald-900 text-sm">{formatBanglaCurrency(currentLineTotal)}</strong></span>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow-xs"
                        id="add-item-to-demand-btn"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>যোগ করুন</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* DRAFT ITEMS TABLE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase">
                  ডিমান্ড পণ্য তালিকা (Demand Items Table)
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  মোট পদ (Items): {toBanglaNumerals(items.length)}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-900 font-black text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">ক্রমিক নং</th>
                      <th className="py-3 px-4">পণ্যের নাম</th>
                      <th className="py-3 px-4 text-right">ক্রয়মূল্য</th>
                      <th className="py-3 px-4 text-right">কার্টুন সংখ্যা</th>
                      <th className="py-3 px-4 text-right">মোট টাকা</th>
                      <th className="py-3 px-3 text-center w-16">মুছুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                          ডিমান্ড স্লিপে কোনো পণ্য যোগ করা হয়নি।
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                            {toBanglaNumerals(idx + 1)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-800">
                            {formatBanglaCurrency(item.ratePerCarton || item.rate)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-emerald-800">
                            {formatBanglaNumber(item.cartons || 0)} কার্টুন
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900">
                            {formatBanglaCurrency(item.total)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition"
                              title="পণ্যটি অপসারণ করুন"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-black text-xs">
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-right uppercase">
                          সর্বমোট (Total Summary):
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400">
                          {formatBanglaNumber(totalCartonsDraft)} কার্টুন
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 text-sm">
                          {formatBanglaCurrency(newDemandSubtotal)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* REMARKS, ONLINE ENTRY & SUBMIT BUTTON */}
            {items.length > 0 && (
              <div className="pt-4 border-t border-slate-200 flex flex-col gap-4">
                <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      অনলাইন এন্ট্রি
                    </label>
                    <input
                      type="number"
                      value={onlineEntryAmount}
                      onChange={(e) => setOnlineEntryAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="টাকার পরিমাণ..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-1 relative">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      মাধ্যম
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none cursor-pointer shadow-sm flex items-center justify-between"
                        id="payment-method-dropdown-btn"
                      >
                        <span>{paymentMethod}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isPaymentDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isPaymentDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[60]" 
                            onClick={() => setIsPaymentDropdownOpen(false)}
                          />
                          <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in duration-100 origin-top">
                            {['হ্যান্ড ক্যাশ', 'মোবাইল ব্যাংকিং', 'ব্যাংক'].map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => {
                                  setPaymentMethod(method);
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors border-b border-slate-50 last:border-0 ${
                                  paymentMethod === method 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {method}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {paymentMethod === 'ব্যাংক' && (
                    <div className="md:col-span-1">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ব্যাংকের নাম
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="ব্যাংকের নাম..."
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className={`md:col-span-${paymentMethod === 'ব্যাংক' ? '1' : '2'}`}>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      মন্তব্য (Remarks)
                    </label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="মন্তব্য (ঐচ্ছিক)..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 w-full border-t border-slate-200 pt-3">
                  <button
                    onClick={handleSubmitDemandSlip}
                    disabled={isSaving}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    id="save-demand-slip-btn"
                  >
                    <Save className="h-4 w-4" />
                    <span>ডিমান্ড স্লিপ সংরক্ষণ করুন (Save Demand Slip)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEMAND SLIP RECORD & HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase">
                ডিমান্ড স্লিপ আর্কাইভ ও ইতিহাস (Demand Slips History)
              </h2>
              <p className="text-xs text-slate-500 font-medium">পূর্বের সংরক্ষিত সকল ডিমান্ড স্লিপের তালিকা</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  placeholder="স্মারক নং বা কোম্পানি অনুসন্ধান..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={filterCompanyHistory}
                onChange={(e) => setFilterCompanyHistory(e.target.value)}
                className="w-full sm:w-48 py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="">সকল কোম্পানি</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-900 font-black text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">স্মারক নং (Demand No)</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4">কোম্পানি</th>
                  <th className="py-3 px-3 text-center">মোট পণ্য</th>
                  <th className="py-3 px-4 text-right">নতুন ডিমান্ড Subtotal</th>
                  <th className="py-3 px-4 text-right">পূর্বের বকেয়া</th>
                  <th className="py-3 px-4 text-right">সমন্বিত ডিমান্ড বিল</th>
                  <th className="py-3 px-4 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-bold">
                      কোনো ডিমান্ড স্লিপ রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((ds) => (
                    <tr key={ds.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                        {ds.demandNo}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600">
                        {toBanglaNumerals(ds.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {ds.companyName}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {toBanglaNumerals(ds.items?.length || 0)} টি
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatBanglaCurrency(ds.currentOrderAmount || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        {formatBanglaCurrency(ds.companyOutstanding || ds.netOutstanding || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-900">
                        {formatBanglaCurrency((ds.orderTotal || ((ds.currentOrderAmount || 0) + (ds.companyOutstanding || 0))))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              const totalAmt = ds.orderTotal || ((ds.currentOrderAmount || 0) + (ds.companyOutstanding || 0));
                              setPrintData({
                                demandNo: ds.demandNo,
                                date: toBanglaNumerals(ds.date),
                                companyName: ds.companyName,
                                orderTotal: totalAmt,
                                items: ds.items || [],
                                companyOutstanding: ds.companyOutstanding,
                                currentOrderAmount: ds.currentOrderAmount,
                                onlineEntryAmount: ds.onlineEntryAmount,
                                paymentMethod: ds.paymentMethod,
                                bankName: ds.bankName
                              });
                              setShowPrintModal(true);
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 transition"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>প্রিন্ট / শেয়ার</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDemand(ds.id!)}
                            className="flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 transition"
                            title="ডিলিট"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>ডিলিট</span>
                          </button>
                          <button
                            onClick={() => setViewingDemandSheet(ds)}
                            className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>বিস্তারিত</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW & PRINT DEMAND SLIP VOUCHER MODAL */}
      {viewingDemandSheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-fade-in">
            
            {/* Modal Bar (Screen only) */}
            <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between print:hidden">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <Printer className="h-4 w-4 text-emerald-400" />
                ডিমান্ড স্লিপ ভাউচার প্রিভিউ (#{viewingDemandSheet.demandNo})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  disabled={isGeneratingPdf}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>শেয়ার / হোয়াটসঅ্যাপ</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  id="btn-demand-download-pdf"
                >
                  {isGeneratingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  <span>ডাউনলোড PDF</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-[11px] font-black shadow-sm transition"
                >
                  <Printer className="h-4 w-4" />
                  <span>প্রিন্ট ভাউচার</span>
                </button>
                <button
                  onClick={() => setViewingDemandSheet(null)}
                  className="text-slate-400 hover:text-white font-bold px-2 py-1 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Voucher Content */}
            <div className="p-8 pt-4 space-y-4 bg-white" id="printable-demand-voucher" ref={printableRef}>
              {/* Printable Voucher Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-2">
                {/* Top Anchored Info & Logo Row */}
                <div className="flex justify-between items-center w-full mb-3">
                  <div className="w-1/4 text-[11px] font-black text-slate-800">
                    ডিমান্ড নং: {viewingDemandSheet.demandNo}
                  </div>
                  <div className="w-1/2 flex justify-center">
                    {logo && (
                      <img src={logo} alt="Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="w-1/4 text-[11px] font-bold text-slate-600 text-right">
                    তারিখ: {toBanglaNumerals(viewingDemandSheet.date)}
                  </div>
                </div>

                {/* Central Header Block */}
                <div className="flex flex-col items-center justify-center text-center w-full">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                    {viewingDemandSheet.businessName || compName}
                  </h2>
                  <p className="text-[11px] font-bold text-slate-700 mt-1">
                    পাইকারী পরিবেশক ও ডিস্ট্রিবিউশন এজেন্ট
                  </p>
                  <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                    খাতুনগঞ্জ, চট্টগ্রাম | মোবাইল: ০১৮৩৫৯১২৫৯৭
                  </p>

                  <div className="mt-4 flex flex-col items-center gap-1">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-2 border-slate-900 px-6 py-1 rounded-full inline-block">
                      ডিমান্ড স্লিপ
                    </h3>
                    <h2 className="text-xl font-black text-slate-900 uppercase mt-0.5">
                      {viewingDemandSheet.companyName}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Status Header */}
              <div className="flex flex-wrap md:flex-nowrap items-stretch justify-center gap-4">
                {viewingDemandSheet.companyOutstanding !== undefined && viewingDemandSheet.companyOutstanding !== 0 && (
                  <div className={`flex-1 p-3 rounded-xl border flex items-center justify-center font-black uppercase tracking-widest text-sm ${viewingDemandSheet.companyOutstanding > 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                    ব্যালেন্স: ৳ {formatBanglaNumber(Math.abs(viewingDemandSheet.companyOutstanding))} 
                    <span className="text-[11px] ml-1.5 opacity-80 font-bold">
                      ({viewingDemandSheet.companyOutstanding > 0 ? 'ক্রেডিট' : 'ডেবিট'}) / ({viewingDemandSheet.companyOutstanding > 0 ? 'CR' : 'DR'})
                    </span>
                  </div>
                )}
                {viewingDemandSheet.onlineEntryAmount !== undefined && viewingDemandSheet.onlineEntryAmount > 0 && (
                  <div className="flex-1 p-3 rounded-xl border flex flex-col items-center justify-center font-black uppercase tracking-widest text-sm bg-blue-50 text-blue-800 border-blue-300 gap-1">
                    <span>অনলাইন পেমেন্ট: ৳ {formatBanglaNumber(viewingDemandSheet.onlineEntryAmount)}</span>
                    <span className="text-[10px] bg-white px-2 py-1 rounded border border-blue-200 mt-1">মাধ্যম: {viewingDemandSheet.paymentMethod || 'ব্যাংক'} {viewingDemandSheet.bankName ? `(${viewingDemandSheet.bankName})` : ''}</span>
                  </div>
                )}
              </div>

              {/* Demand Items Table */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-800 uppercase block">চাহিদাকৃত পণ্যের বিবরণ:</span>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-200 text-slate-900 font-black text-[11px] uppercase border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 border border-slate-300 text-center w-16">ক্রমিক নং</th>
                      <th className="py-2 px-3 border border-slate-300">পণ্যের নাম</th>
                      <th className="py-2 px-3 border border-slate-300 text-right">ক্রয়মূল্য</th>
                      <th className="py-2 px-3 border border-slate-300 text-right">কার্টুন সংখ্যা</th>
                      <th className="py-2 px-3 border border-slate-300 text-right">মোট টাকা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {viewingDemandSheet.items.map((it, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 border border-slate-300 text-center font-bold">
                          {toBanglaNumerals(i + 1)}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 font-bold">
                          {it.productName}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-mono">
                          {formatBanglaCurrency(it.ratePerCarton || it.rate)}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-bold">
                          {formatBanglaNumber(it.cartons || 0)} কার্টুন
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-black">
                          {formatBanglaCurrency(it.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-100 text-emerald-900 font-black border-t-2 border-emerald-300">
                      <td colSpan={3} className="py-3 px-3 border-r border-emerald-200 border-b border-l border-emerald-300 text-right uppercase tracking-widest text-xs">ডিমান্ড মোট (Subtotal):</td>
                      <td className="py-3 px-3 border-r border-emerald-200 border-b border-emerald-300 text-right font-mono text-sm">
                        {formatBanglaNumber(viewingDemandSheet.items.reduce((sum, i) => sum + (i.cartons || 0), 0))} কার্টুন
                      </td>
                      <td className="py-3 px-3 border-b border-r border-emerald-300 text-right font-mono text-sm">
                        {formatBanglaCurrency(viewingDemandSheet.currentOrderAmount || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {viewingDemandSheet.remarks && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>বিশেষ মন্তব্য / নোট:</strong> {viewingDemandSheet.remarks}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-700">
                <div>
                  <div className="border-t border-slate-400 w-40 mx-auto pt-1 font-bold">প্রস্তুতকারীর স্বাক্ষর</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 w-40 mx-auto pt-1 font-bold">অনুমোদনকারী ব্যবস্থাপক</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
      {/* Universal Print Modal */}
      <UniversalPrintModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="ডিমান্ড স্লিপ ভাউচার"
        type="demand"
        data={printData}
      />

    </div>
  );
}
