import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, approveDamageReturn, settleDamagePayment } from '../db/db';
import { CompanyDamage, Company, Product } from '../types';
import { 
  ShieldAlert, 
  PlusCircle, 
  Printer, 
  CheckCircle2, 
  Trash2, 
  X, 
  Filter, 
  Search, 
  Package, 
  Building2, 
  Truck, 
  FileText, 
  History, 
  Coins, 
  RefreshCw, 
  UserCheck, 
  Calendar, 
  AlertTriangle,
  Layers,
  Box,
  BadgeCheck,
  RotateCcw
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

export default function DamageManagement() {
  // Live Dexie Database Queries
  const damages = useLiveQuery(() => db.companyDamages.toArray()) || [];
  const companies = useLiveQuery(() => db.companies.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const businessProfiles = useLiveQuery(() => db.businessProfiles.toArray()) || [];

  // Business Branding for Print
  const businessName = businessProfiles?.[0]?.businessName || 'ফ্রেন্ডস এন্টারপ্রাইজ';
  const ownerName = businessProfiles?.[0]?.owner || 'ফরহাদুল হক';
  const phoneNo = businessProfiles?.[0]?.phone || '০১৮৩৫৯১২৫৯৭';
  const addressStr = businessProfiles?.[0]?.address || 'খাতুনগঞ্জ, চট্টগ্রাম, বাংলাদেশ';

  // Active Tab View State
  const [activeTab, setActiveTab] = useState<'list' | 'opening' | 'new_entry' | 'triplicate_slip'>('list');

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Paid'>('all');

  // Notification Banner State
  const [actionMessage, setActionMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // ----------------------------------------------------
  // 1. OPENING DAMAGE STOCK FORM STATES
  // ----------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];
  const [opCompanyId, setOpCompanyId] = useState<string>('');
  const [opProductId, setOpProductId] = useState<string>('');
  const [opCartons, setOpCartons] = useState<number>(0);
  const [opLoosePcs, setOpLoosePcs] = useState<number>(0);
  const [opUnitPrice, setOpUnitPrice] = useState<number>(0);
  const [opDate, setOpDate] = useState<string>(todayStr);
  const [opRemarks, setOpRemarks] = useState<string>('পূর্বের মাসের প্রারম্ভিক জমাকৃত ড্যামেজ মাল');
  const [isSavingOpening, setIsSavingOpening] = useState<boolean>(false);

  // ----------------------------------------------------
  // 2. REGULAR DAMAGE ENTRY FORM STATES
  // ----------------------------------------------------
  const [newCompanyId, setNewCompanyId] = useState<string>('');
  const [newProductId, setNewProductId] = useState<string>('');
  const [newCartons, setNewCartons] = useState<number>(0);
  const [newLoosePcs, setNewLoosePcs] = useState<number>(0);
  const [newUnitPrice, setNewUnitPrice] = useState<number>(0);
  const [newDate, setNewDate] = useState<string>(todayStr);
  const [newRemarks, setNewRemarks] = useState<string>('গোডাউন প্রসেসিং/ট্রানজিট ড্যামেজ');
  const [isSavingNew, setIsSavingNew] = useState<boolean>(false);

  // ----------------------------------------------------
  // 3. TRIPLICATE SLIP PRINTING STATES
  // ----------------------------------------------------
  const [slipCompanyId, setSlipCompanyId] = useState<string>('');
  const [slipDriverName, setSlipDriverName] = useState<string>('');
  const [slipVehicleNo, setSlipVehicleNo] = useState<string>('');
  const [slipNo, setSlipNo] = useState<string>(`SLIP-DMG-${Date.now().toString().slice(-6)}`);
  const [slipDate, setSlipDate] = useState<string>(todayStr);
  const [selectedDamageIdsForSlip, setSelectedDamageIdsForSlip] = useState<string[]>([]);
  const [showSlipPreview, setShowSlipPreview] = useState<boolean>(false);

  // When product changes in Opening Stock Form, auto-fill unit price
  const handleOpeningProductChange = (prodId: string) => {
    setOpProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setOpUnitPrice(prod.dp || prod.purchasePricePcs || prod.purchasePrice || prod.retailPrice || 0);
      if (prod.companyId) {
        setOpCompanyId(prod.companyId);
      }
    }
  };

  // When product changes in Regular Entry Form, auto-fill unit price
  const handleNewProductChange = (prodId: string) => {
    setNewProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setNewUnitPrice(prod.dp || prod.purchasePricePcs || prod.purchasePrice || prod.retailPrice || 0);
      if (prod.companyId) {
        setNewCompanyId(prod.companyId);
      }
    }
  };

  // Save Opening Damage Stock
  const handleSaveOpeningStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setActionMessage('');

    if (!opCompanyId || !opProductId) {
      setErrorMessage('অনুগ্রহ করে কোম্পানি এবং পণ্য সঠিকভাবে নির্বাচন করুন।');
      return;
    }

    const prod = products.find(p => p.id === opProductId);
    const comp = companies.find(c => c.id === opCompanyId);
    if (!prod || !comp) {
      setErrorMessage('নির্বাচিত কোম্পানি বা পণ্য ডাটাবেজে পাওয়া যায়নি।');
      return;
    }

    const pcsPerCtn = prod.pcsPerCarton || prod.cartonSize || 1;
    const totalPcs = (opCartons || 0) * pcsPerCtn + (opLoosePcs || 0);

    if (totalPcs <= 0) {
      setErrorMessage('ড্যামেজ পরিমাণ কমপক্ষে ১ পিস বা ১ কার্টন হতে হবে।');
      return;
    }

    const unitPrice = opUnitPrice > 0 ? opUnitPrice : (prod.dp || prod.purchasePricePcs || prod.purchasePrice || 1);
    const totalValue = totalPcs * unitPrice;

    try {
      setIsSavingOpening(true);

      const damageId = `dmg_op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.companyDamages.add({
        id: damageId,
        companyId: opCompanyId,
        companyName: comp.name,
        productId: opProductId,
        productName: prod.name,
        qty: totalPcs,
        cartons: opCartons || 0,
        loosePcs: opLoosePcs || 0,
        unitPrice: unitPrice,
        damageValue: totalValue,
        status: 'Pending',
        date: opDate || todayStr,
        remarks: opRemarks || 'প্রারম্ভিক জমা ড্যামেজ স্টক (Opening Damage)',
        isOpeningStock: true
      });

      setActionMessage(`প্রারম্ভিক ড্যামেজ স্টক সফলভাবে সংরক্ষিত হয়েছে! (${prod.name} - ${formatBanglaNumber(totalPcs)} পিস, ${formatBanglaCurrency(totalValue)})`);
      
      // Reset Form
      setOpProductId('');
      setOpCartons(0);
      setOpLoosePcs(0);
      setOpUnitPrice(0);
      setActiveTab('list');
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage('প্রারম্ভিক ড্যামেজ স্টক সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setIsSavingOpening(false);
    }
  };

  // Save Regular Damage Entry
  const handleSaveNewDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setActionMessage('');

    if (!newCompanyId || !newProductId) {
      setErrorMessage('অনুগ্রহ করে কোম্পানি এবং পণ্য নির্বাচন করুন।');
      return;
    }

    const prod = products.find(p => p.id === newProductId);
    const comp = companies.find(c => c.id === newCompanyId);
    if (!prod || !comp) {
      setErrorMessage('নির্বাচিত কোম্পানি বা পণ্য পাওয়া যায়নি।');
      return;
    }

    const pcsPerCtn = prod.pcsPerCarton || prod.cartonSize || 1;
    const totalPcs = (newCartons || 0) * pcsPerCtn + (newLoosePcs || 0);

    if (totalPcs <= 0) {
      setErrorMessage('ড্যামেজ পরিমাণ কমপক্ষে ১ পিস বা ১ কার্টন হতে হবে।');
      return;
    }

    const unitPrice = newUnitPrice > 0 ? newUnitPrice : (prod.dp || prod.purchasePricePcs || prod.purchasePrice || 1);
    const totalValue = totalPcs * unitPrice;

    try {
      setIsSavingNew(true);

      const damageId = `dmg_reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.companyDamages.add({
        id: damageId,
        companyId: newCompanyId,
        companyName: comp.name,
        productId: newProductId,
        productName: prod.name,
        qty: totalPcs,
        cartons: newCartons || 0,
        loosePcs: newLoosePcs || 0,
        unitPrice: unitPrice,
        damageValue: totalValue,
        status: 'Pending',
        date: newDate || todayStr,
        remarks: newRemarks || 'গোডাউন ট্রানজিট ড্যামেজ এন্ট্রি',
        isOpeningStock: false
      });

      setActionMessage(`নতুন ড্যামেজ এন্ট্রি সফল হয়েছে! (${prod.name} - ${formatBanglaNumber(totalPcs)} পিস, ${formatBanglaCurrency(totalValue)})`);
      
      // Reset Form
      setNewProductId('');
      setNewCartons(0);
      setNewLoosePcs(0);
      setNewUnitPrice(0);
      setActiveTab('list');
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage('নতুন ড্যামেজ এন্ট্রি সেভ করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setIsSavingNew(false);
    }
  };

  // Approve Claim Handler (Updates Supplier Ledger)
  const handleApprove = async (id: string, productName: string) => {
    if (!confirm(`আপনি কি কোম্পানি ড্যামেজ ক্লেম "${productName}" অনুমোদন করতে চান? এর ফলে কোম্পানির লেজারে ড্যামেজ ক্রেডিট অ্যাড হবে।`)) {
      return;
    }

    try {
      await approveDamageReturn(id);
      setActionMessage(`ড্যামেজ ক্লেম "${productName}" অনুমোদিত হয়েছে এবং কোম্পানির লেজারে ক্রেডিট সমন্বয় করা হয়েছে।`);
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      alert('অনুমোদন করতে ব্যর্থ হয়েছে: ' + err.message);
    }
  };

  // Settle Payment Handler (Cash Book Credit/Refund)
  const handleSettle = async (id: string, productName: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে কোম্পানি থেকে এই ড্যামেজের নগদ রিফান্ড গ্রহণ করা হয়েছে?`)) {
      return;
    }

    try {
      await settleDamagePayment(id);
      setActionMessage(`ড্যামেজের ক্যাশ রিফান্ড ক্যাশবুক ও রেকর্ডে সফলভাবে এন্ট্রি করা হয়েছে।`);
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      alert('ক্যাশ রিফান্ড সমন্বয়ে ব্যর্থ হয়েছে: ' + err.message);
    }
  };

  // Delete Damage Record Handler
  const handleDeleteDamage = async (id: string, productName: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${productName}" ড্যামেজ রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      await db.companyDamages.delete(id);
      setActionMessage(`ড্যামেজ রেকর্ড মুছে ফেলা হয়েছে।`);
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err: any) {
      alert('রেকর্ড মুছতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  // Filtered Damage Records List
  const filteredDamages = useMemo(() => {
    return damages.filter((d) => {
      // Company Filter
      if (selectedCompanyId && d.companyId !== selectedCompanyId) return false;

      // Status Filter
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;

      // Search Query Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const prodMatch = d.productName?.toLowerCase().includes(query);
        const compMatch = d.companyName?.toLowerCase().includes(query);
        const remMatch = d.remarks?.toLowerCase().includes(query);
        if (!prodMatch && !compMatch && !remMatch) return false;
      }

      return true;
    });
  }, [damages, selectedCompanyId, statusFilter, searchTerm]);

  // Overall KPI Statistics
  const totalPendingPcs = useMemo(() => {
    return damages.filter(d => d.status === 'Pending').reduce((sum, d) => sum + (d.qty || 0), 0);
  }, [damages]);

  const totalPendingValue = useMemo(() => {
    return damages.filter(d => d.status === 'Pending').reduce((sum, d) => sum + (d.damageValue || 0), 0);
  }, [damages]);

  const totalApprovedValue = useMemo(() => {
    return damages.filter(d => d.status === 'Approved' || d.status === 'Paid').reduce((sum, d) => sum + (d.damageValue || 0), 0);
  }, [damages]);

  const totalOpeningValue = useMemo(() => {
    return damages.filter(d => d.isOpeningStock).reduce((sum, d) => sum + (d.damageValue || 0), 0);
  }, [damages]);

  // Damage Items available for Slip Printing for selected Company
  const pendingDamagesForSlipCompany = useMemo(() => {
    if (!slipCompanyId) return [];
    return damages.filter(d => d.companyId === slipCompanyId && d.status === 'Pending');
  }, [damages, slipCompanyId]);

  // Selected Damage Items for Slip Preview
  const slipItemsToPrint = useMemo(() => {
    return damages.filter(d => selectedDamageIdsForSlip.includes(d.id));
  }, [damages, selectedDamageIdsForSlip]);

  const slipTotalCartons = useMemo(() => {
    return slipItemsToPrint.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.productId);
      const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
      const ctn = item.cartons !== undefined ? item.cartons : Math.floor(item.qty / pcsPerCtn);
      return sum + ctn;
    }, 0);
  }, [slipItemsToPrint, products]);

  const slipTotalLoose = useMemo(() => {
    return slipItemsToPrint.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.productId);
      const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
      const loose = item.loosePcs !== undefined ? item.loosePcs : (item.qty % pcsPerCtn);
      return sum + loose;
    }, 0);
  }, [slipItemsToPrint, products]);

  const slipTotalPcs = useMemo(() => {
    return slipItemsToPrint.reduce((sum, item) => sum + item.qty, 0);
  }, [slipItemsToPrint]);

  const slipTotalAmount = useMemo(() => {
    return slipItemsToPrint.reduce((sum, item) => sum + item.damageValue, 0);
  }, [slipItemsToPrint]);

  // Handle Print Action
  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12" id="damage-management-module">
      
      {/* MODULE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-900 text-white rounded-xl shadow-xs">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 font-sans tracking-tight">
              ড্যামেজ ও ক্লেম ব্যবস্থাপনা (Damage & Claim Management)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              প্রারম্ভিক ড্যামেজ স্টক এন্ট্রি, গোডাউন ড্যামেজ ট্র্যাকিং এবং কোম্পানির ট্রিপ্লিকেট (৩-কপি) ডিসপ্যাচ স্লিপ প্রিন্ট করুন।
            </p>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'list' ? 'bg-purple-900 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            <Layers className="h-4 w-4" /> ড্যামেজ স্টক তালিকা ({toBanglaNumerals(damages.length)})
          </button>
          
          <button 
            onClick={() => setActiveTab('opening')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'opening' ? 'bg-purple-900 text-white shadow-xs' : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'}`}
          >
            <History className="h-4 w-4" /> প্রারম্ভিক ড্যামেজ এন্ট্রি
          </button>

          <button 
            onClick={() => setActiveTab('new_entry')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'new_entry' ? 'bg-purple-900 text-white shadow-xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'}`}
          >
            <PlusCircle className="h-4 w-4" /> নতুন ড্যামেজ এন্ট্রি
          </button>

          <button 
            onClick={() => setActiveTab('triplicate_slip')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'triplicate_slip' ? 'bg-purple-900 text-white shadow-xs' : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'}`}
          >
            <Printer className="h-4 w-4" /> ৩-কপি ড্যামেজ স্লিপ প্রিন্ট
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Warehouse Pending Stock */}
        <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-2 border border-purple-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wide">গোডাউনে পেন্ডিং স্টক</span>
            <div className="p-2 bg-purple-950/80 rounded-lg text-purple-300">
              <Box className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white pt-1">
            {formatBanglaNumber(totalPendingPcs)} পিস
          </div>
          <p className="text-[11px] text-purple-200/80 font-medium">
            বর্তমানে গোডাউনে জমা অবিক্রীত ড্যামেজ মাল
          </p>
        </div>

        {/* Card 2: Total Estimated Value */}
        <div className="bg-gradient-to-br from-amber-800 to-orange-950 text-white rounded-2xl p-5 shadow-sm space-y-2 border border-amber-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">পেন্ডিং ড্যামেজ মূল্য</span>
            <div className="p-2 bg-amber-950/80 rounded-lg text-amber-300">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white pt-1">
            {formatBanglaCurrency(totalPendingValue)}
          </div>
          <p className="text-[11px] text-amber-200/80 font-medium">
            কোম্পানির নিকট জমা দিতে অপেক্ষমাণ ক্লেম টাকা
          </p>
        </div>

        {/* Card 3: Approved / Credited Claims */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-950 text-white rounded-2xl p-5 shadow-sm space-y-2 border border-emerald-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wide">অনুমোদিত/ক্রেডিট প্রাপ্ত</span>
            <div className="p-2 bg-emerald-950/80 rounded-lg text-emerald-300">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white pt-1">
            {formatBanglaCurrency(totalApprovedValue)}
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium">
            কোম্পানি লেজারে ক্রেডিট সমন্বিত মোট মূল্য
          </p>
        </div>

        {/* Card 4: Opening Damage Stock Value */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-950 text-white rounded-2xl p-5 shadow-sm space-y-2 border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">প্রারম্ভিক ড্যামেজ স্টক</span>
            <div className="p-2 bg-slate-900 rounded-lg text-slate-300">
              <History className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white pt-1">
            {formatBanglaCurrency(totalOpeningValue)}
          </div>
          <p className="text-[11px] text-slate-300/80 font-medium">
            পূর্বের মাস হতে জমাকৃত প্রারম্ভিক স্টক মূল্য
          </p>
        </div>

      </div>

      {/* NOTIFICATIONS */}
      {actionMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-center gap-2 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ====================================================
          TAB 1: DAMAGE RECORDS LIST & WAREHOUSE STOCK
         ==================================================== */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="পণ্যের নাম, কোম্পানি বা নোট খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Company Filter */}
            <div>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="">-- সকল কোম্পানি / সাপ্লায়ার (All Companies) --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="all">-- সকল স্ট্যাটাস (All Statuses) --</option>
                <option value="Pending">গোডাউনে জমা (Pending Claim)</option>
                <option value="Approved">অনুমোদিত/ক্রেডিট সমন্বিত (Approved)</option>
                <option value="Paid">ক্যাশ রিফান্ড প্রাপ্ত (Paid/Refunded)</option>
              </select>
            </div>

          </div>

          {/* DAMAGE TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-xs uppercase text-slate-700 tracking-wider flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-purple-700" />
                গোডাউন ড্যামেজ স্টক ও ক্লেম তালিকা ({toBanglaNumerals(filteredDamages.length)} টি)
              </h2>
              <span className="text-[11px] font-bold text-slate-500">
                স্বয়ংক্রিয় লেজার ও স্টক সমন্বিত
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-[11px] uppercase font-bold text-slate-700 border-b border-slate-200">
                    <th className="py-3 px-4">তারিখ / টাইপ</th>
                    <th className="py-3 px-4">পণ্যের নাম</th>
                    <th className="py-3 px-4">কোম্পানি / সাপ্লায়ার</th>
                    <th className="py-3 px-4 text-center">পরিমাণ (কার্টন ও পিস)</th>
                    <th className="py-3 px-4 text-right">একক মূল্য</th>
                    <th className="py-3 px-4 text-right">মোট ড্যামেজ মূল্য</th>
                    <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                    <th className="py-3 px-4 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {filteredDamages.length > 0 ? (
                    filteredDamages.map((d) => {
                      const prod = products.find(p => p.id === d.productId);
                      const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
                      
                      const ctn = d.cartons !== undefined ? d.cartons : Math.floor((d.qty || 0) / pcsPerCtn);
                      const loose = d.loosePcs !== undefined ? d.loosePcs : ((d.qty || 0) % pcsPerCtn);

                      return (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition">
                          
                          {/* Date & Type */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{formatBanglaDate(d.date)}</div>
                            {d.isOpeningStock ? (
                              <span className="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                                প্রারম্ভিক স্টক (Opening)
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 text-[10px] font-semibold text-slate-500">
                                নিয়মিত ড্যামেজ
                              </span>
                            )}
                          </td>

                          {/* Product Name & Remarks */}
                          <td className="py-3 px-4">
                            <div className="font-black text-slate-900">{d.productName}</div>
                            {d.remarks && (
                              <div className="text-[10px] text-slate-500 line-clamp-1">{d.remarks}</div>
                            )}
                          </td>

                          {/* Company Name */}
                          <td className="py-3 px-4 font-bold text-slate-700">
                            {d.companyName}
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-4 text-center">
                            <div className="font-black text-purple-950">
                              {formatBanglaNumber(d.qty)} পিস
                            </div>
                            {pcsPerCtn > 1 && (
                              <div className="text-[10px] text-slate-500 font-semibold">
                                ({toBanglaNumerals(ctn)} কার্টন {loose > 0 ? `${toBanglaNumerals(loose)} পিস` : ''})
                              </div>
                            )}
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-4 text-right font-bold text-slate-700">
                            {formatBanglaCurrency(d.unitPrice || (d.damageValue / (d.qty || 1)))}
                          </td>

                          {/* Damage Value */}
                          <td className="py-3 px-4 text-right font-black text-amber-900">
                            {formatBanglaCurrency(d.damageValue)}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4 text-center">
                            {d.status === 'Pending' && (
                              <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                                গোডাউনে জমা (Pending)
                              </span>
                            )}
                            {d.status === 'Approved' && (
                              <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                                এপ্রুভড (Ledger Credited)
                              </span>
                            )}
                            {d.status === 'Paid' && (
                              <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                                পরিশোধিত (Paid Refund)
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {d.status === 'Pending' && (
                                <button
                                  onClick={() => handleApprove(d.id, d.productName)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition cursor-pointer"
                                  title="কোম্পানি লেজারে ড্যামেজ ক্রেডিট সমন্বয় করুন"
                                >
                                  অনুমোদন (Approve)
                                </button>
                              )}
                              {d.status === 'Approved' && (
                                <button
                                  onClick={() => handleSettle(d.id, d.productName)}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-2xs transition cursor-pointer"
                                  title="ক্যাশ রিফান্ড ক্যাশবুক এন্ট্রি করুন"
                                >
                                  ক্যাশ রিফান্ড (Mark Paid)
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteDamage(d.id, d.productName)}
                                className="p-1.5 text-rose-500 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="মুছুন"
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
                          <ShieldAlert className="h-8 w-8 text-slate-300" />
                          <span>কোনো ড্যামেজ স্টক বা রেকর্ড পাওয়া যায়নি!</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ====================================================
          TAB 2: OPENING DAMAGE STOCK FORM (প্রারম্ভিক ড্যামেজ স্টক এন্ট্রি)
         ==================================================== */}
      {activeTab === 'opening' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-purple-100 text-purple-900 rounded-xl">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                পূর্বের জমা ড্যামেজ এন্ট্রি (Opening Damage Stock Entry)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                গত মাস বা পূর্বের সময়কালের জমাকৃত ড্যামেজ মাল এন্ট্রি করুন। এটি বর্তমান গোডাউনের ড্যামেজ স্টকে যোগ হবে কিন্তু বিক্রয়ে প্রভাব ফেলবে না।
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveOpeningStock} className="space-y-4 text-xs">
            
            {/* 1. Supplier / Company Dropdown */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-purple-700" />
                কোম্পানি / সাপ্লায়ার নির্বাচন করুন *
              </label>
              <select
                required
                value={opCompanyId}
                onChange={(e) => setOpCompanyId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="">-- কোম্পানি বা সাপ্লায়ার নির্বাচন করুন --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Product Selection Dropdown */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-purple-700" />
                ড্যামেজ পণ্যের নাম *
              </label>
              <select
                required
                value={opProductId}
                onChange={(e) => handleOpeningProductChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="">-- প্রারম্ভিক ড্যামেজ পণ্য সিলেক্ট করুন --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (দর: ৳{p.dp || p.purchasePricePcs || p.purchasePrice || p.retailPrice || 0} / কার্টন সাইজ: {p.pcsPerCarton || p.cartonSize || 1} পিস)
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Quantity: Cartons & Loose Pcs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  প্রারম্ভিক কার্টন সংখ্যা (Cartons)
                </label>
                <input 
                  type="number"
                  min="0"
                  value={opCartons}
                  onChange={(e) => setOpCartons(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="০"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  প্রারম্ভিক লুজ পিস (Loose Pcs)
                </label>
                <input 
                  type="number"
                  min="0"
                  value={opLoosePcs}
                  onChange={(e) => setOpLoosePcs(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="০"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  একক দর (Unit Price BDT)
                </label>
                <input 
                  type="number"
                  min="0"
                  step="0.01"
                  value={opUnitPrice}
                  onChange={(e) => setOpUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Live Calculation Preview Box */}
            {opProductId && (
              <div className="bg-purple-50/80 p-4 rounded-xl border border-purple-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-purple-900 block">মোট প্রারম্ভিক ড্যামেজ হিসাব:</span>
                  <span className="text-xs text-purple-800 font-semibold">
                    {(() => {
                      const prod = products.find(p => p.id === opProductId);
                      const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
                      const totPcs = (opCartons || 0) * pcsPerCtn + (opLoosePcs || 0);
                      return `${formatBanglaNumber(totPcs)} পিস (${toBanglaNumerals(opCartons)} কার্টন + ${toBanglaNumerals(opLoosePcs)} পিস)`;
                    })()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-purple-900 block">মোট সম্ভাব্য মান:</span>
                  <span className="text-base font-black text-purple-950">
                    {(() => {
                      const prod = products.find(p => p.id === opProductId);
                      const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
                      const totPcs = (opCartons || 0) * pcsPerCtn + (opLoosePcs || 0);
                      return formatBanglaCurrency(totPcs * (opUnitPrice || 0));
                    })()}
                  </span>
                </div>
              </div>
            )}

            {/* 4. Date & Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-purple-700" />
                  রেকর্ড তারিখ
                </label>
                <input 
                  type="date"
                  value={opDate}
                  onChange={(e) => setOpDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  নোট / বিবরণ (Remarks)
                </label>
                <input 
                  type="text"
                  value={opRemarks}
                  onChange={(e) => setOpRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                disabled={isSavingOpening}
                className="px-6 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-white font-black shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <History className="h-4 w-4" />
                {isSavingOpening ? 'সংরক্ষণ হচ্ছে...' : 'প্রারম্ভিক ড্যামেজ স্টক সেভ করুন'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ====================================================
          TAB 3: REGULAR NEW DAMAGE ENTRY FORM
         ==================================================== */}
      {activeTab === 'new_entry' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                নতুন ড্যামেজ রেকর্ড এন্ট্রি (New Damage Record)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                গোডাউন হ্যান্ডলিং বা ট্রানজিটে ক্ষতিগ্রস্ত হওয়া পণ্যের তথ্য এন্ট্রি করুন।
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveNewDamage} className="space-y-4 text-xs">
            
            {/* Supplier / Company */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-emerald-700" />
                কোম্পানি / সাপ্লায়ার নির্বাচন করুন *
              </label>
              <select
                required
                value={newCompanyId}
                onChange={(e) => setNewCompanyId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- কোম্পানি বা সাপ্লায়ার নির্বাচন করুন --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-emerald-700" />
                ক্ষতিগ্রস্ত পণ্যের নাম *
              </label>
              <select
                required
                value={newProductId}
                onChange={(e) => handleNewProductChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">-- পণ্য নির্বাচন করুন --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (দর: ৳{p.dp || p.purchasePricePcs || p.purchasePrice || p.retailPrice || 0} / কার্টন সাইজ: {p.pcsPerCarton || p.cartonSize || 1} পিস)
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  কার্টন সংখ্যা (Cartons)
                </label>
                <input 
                  type="number"
                  min="0"
                  value={newCartons}
                  onChange={(e) => setNewCartons(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="০"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  লুজ পিস (Loose Pcs)
                </label>
                <input 
                  type="number"
                  min="0"
                  value={newLoosePcs}
                  onChange={(e) => setNewLoosePcs(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="০"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  একক দর (Unit Price BDT)
                </label>
                <input 
                  type="number"
                  min="0"
                  step="0.01"
                  value={newUnitPrice}
                  onChange={(e) => setNewUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Date & Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                  তারিখ
                </label>
                <input 
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  নোট / কারণ (Remarks)
                </label>
                <input 
                  type="text"
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                disabled={isSavingNew}
                className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-black shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                {isSavingNew ? 'সংরক্ষণ হচ্ছে...' : 'ড্যামেজ এন্ট্রি সেভ করুন'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ====================================================
          TAB 4: TRIPLICATE 3-COPY DISPATCH SLIP GENERATOR & PRINT
         ==================================================== */}
      {activeTab === 'triplicate_slip' && (
        <div className="space-y-6">
          
          {/* SLIP GENERATOR FORM */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5 print:hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-blue-100 text-blue-900 rounded-xl">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  কোম্পানি ডিসপ্যাচ ট্রিপ্লিকেট (৩-কপি) ড্যামেজ স্লিপ তৈরি করুন
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  কোম্পানি সিলেক্ট করে প্রেরণের ড্যামেজ মাল বাছাই করুন। এটি ১টি পাতায় ৩টি অফিসিয়াল কপি (১ম: কোম্পানি, ২য়: ড্রাইভার, ৩য়: অফিস) প্রিন্ট করবে।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              
              {/* Select Company */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ১. কোম্পানি নির্বাচন করুন *
                </label>
                <select
                  value={slipCompanyId}
                  onChange={(e) => {
                    setSlipCompanyId(e.target.value);
                    setSelectedDamageIdsForSlip([]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- কোম্পানি সিলেক্ট করুন --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Driver Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ২. ড্রাইভার / পরিপাহকের নাম
                </label>
                <input 
                  type="text"
                  placeholder="যেমন: রফিক মিয়া"
                  value={slipDriverName}
                  onChange={(e) => setSlipDriverName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Vehicle No */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ৩. গাড়ি / ট্রাক নম্বর
                </label>
                <input 
                  type="text"
                  placeholder="যেমন: চট্র মেট্রো-ড-১১-২২৩৩"
                  value={slipVehicleNo}
                  onChange={(e) => setSlipVehicleNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Slip Serial No & Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ৪. স্লিপ নম্বর ও তারিখ
                </label>
                <input 
                  type="text"
                  value={slipNo}
                  onChange={(e) => setSlipNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

            </div>

            {/* Select Pending Items Table */}
            {slipCompanyId && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase text-slate-700 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-blue-700" />
                    প্রেরণের জন্য গোডাউনে জমা ড্যামেজ মাল সিলেক্ট করুন ({toBanglaNumerals(pendingDamagesForSlipCompany.length)} টি রয়েছে)
                  </h3>
                  
                  {pendingDamagesForSlipCompany.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDamageIdsForSlip.length === pendingDamagesForSlipCompany.length) {
                          setSelectedDamageIdsForSlip([]);
                        } else {
                          setSelectedDamageIdsForSlip(pendingDamagesForSlipCompany.map(d => d.id));
                        }
                      }}
                      className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                    >
                      {selectedDamageIdsForSlip.length === pendingDamagesForSlipCompany.length ? 'সব আন-সিলেক্ট করুন' : 'সব সিলেক্ট করুন'}
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-center">সিলেক্ট</th>
                        <th className="py-2.5 px-3">পণ্যের নাম</th>
                        <th className="py-2.5 px-3 text-center">পরিমাণ</th>
                        <th className="py-2.5 px-3 text-right">একক দর</th>
                        <th className="py-2.5 px-3 text-right">মোট মূল্য</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingDamagesForSlipCompany.length > 0 ? (
                        pendingDamagesForSlipCompany.map((d) => {
                          const prod = products.find(p => p.id === d.productId);
                          const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
                          const ctn = d.cartons !== undefined ? d.cartons : Math.floor(d.qty / pcsPerCtn);
                          const loose = d.loosePcs !== undefined ? d.loosePcs : (d.qty % pcsPerCtn);
                          const isChecked = selectedDamageIdsForSlip.includes(d.id);

                          return (
                            <tr key={d.id} className={`hover:bg-slate-50 transition ${isChecked ? 'bg-blue-50/50' : ''}`}>
                              <td className="py-2.5 px-3 text-center">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDamageIdsForSlip(prev => [...prev, d.id]);
                                    } else {
                                      setSelectedDamageIdsForSlip(prev => prev.filter(id => id !== d.id));
                                    }
                                  }}
                                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{d.productName}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                {formatBanglaNumber(d.qty)} পিস ({toBanglaNumerals(ctn)} কার্টন, {toBanglaNumerals(loose)} পিস)
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                                {formatBanglaCurrency(d.unitPrice || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                {formatBanglaCurrency(d.damageValue)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                            এই কোম্পানির কোনো পেন্ডিং ড্যামেজ স্টক পাওয়া যায়নি।
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedDamageIdsForSlip.length > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="text-xs font-bold text-blue-900">
                      সিলেক্টকৃত আইটেম: {toBanglaNumerals(selectedDamageIdsForSlip.length)} টি | মোট পিস: {formatBanglaNumber(slipTotalPcs)} | মোট মূল্য: {formatBanglaCurrency(slipTotalAmount)}
                    </div>

                    <button
                      onClick={() => setShowSlipPreview(true)}
                      className="px-5 py-2 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-black text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
                    >
                      <Printer className="h-4 w-4" /> ৩-কপি স্লিপ প্রিভিউ ও প্রিন্ট করুন
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* TRIPLICATE 3-COPY PRINT LAYOUT SHEET */}
          {slipItemsToPrint.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-bold text-sm text-slate-900">
                    ট্রিপ্লিকেট (৩-কপি) ডিসপ্যাচ স্লিপ মেমো প্রিভিউ
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrintSlip}
                    className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" /> ৩-কপি প্রিন্ট দিন (Print Slip)
                  </button>
                </div>
              </div>

              {/* PRINT CONTAINER WITH 3 IDENTICAL COPIES */}
              <div className="space-y-8 font-sans text-slate-900 printable-slip-area">
                
                {[
                  { copyTitle: '১ম কপি: কোম্পানি কপি (Company Copy)', badgeBg: 'bg-blue-900 text-white' },
                  { copyTitle: '২য় কপি: ড্রাইভার/পরিবহন কপি (Driver Copy)', badgeBg: 'bg-emerald-900 text-white' },
                  { copyTitle: '৩য় কপি: অফিস/গোডাউন কপি (Office Copy)', badgeBg: 'bg-slate-900 text-white' }
                ].map((copyInfo, idx) => {
                  const targetCompany = companies.find(c => c.id === slipCompanyId);

                  return (
                    <div 
                      key={idx} 
                      className={`p-5 border-2 border-slate-900 rounded-xl relative space-y-3 bg-white page-break-inside-avoid ${idx < 2 ? 'mb-6 pb-6 border-b-2 border-dashed border-slate-400' : ''}`}
                    >
                      {/* Copy Indicator Header Badge */}
                      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${copyInfo.badgeBg}`}>
                            {copyInfo.copyTitle}
                          </span>
                          <span className="text-xs font-mono font-black text-slate-700">
                            নং: {slipNo}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-700">
                          তারিখ: {formatBanglaDate(slipDate)}
                        </div>
                      </div>

                      {/* Header Business Info */}
                      <div className="text-center space-y-0.5">
                        <h1 className="text-base font-black text-slate-950 tracking-tight">{businessName}</h1>
                        <p className="text-[11px] text-slate-700 font-bold">{addressStr} | প্রোপ্রাইটর: {ownerName}</p>
                        <p className="text-[10px] text-slate-600 font-semibold">মোবাইল: {phoneNo}</p>
                        <div className="inline-block text-xs font-extrabold uppercase tracking-wider px-3 py-0.5 mt-1 border border-slate-900 bg-slate-50 rounded">
                          কোম্পানি ড্যামেজ ও মাল ফেরত চালানি স্লিপ (Company Damage Dispatch Slip)
                        </div>
                      </div>

                      {/* Info Grid: Company & Transport Details */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-300 font-bold">
                        <div>
                          <span className="text-slate-500">প্রাপক কোম্পানি: </span>
                          <span className="text-slate-950 font-black">{targetCompany?.name || 'সিলেক্টকৃত কোম্পানি'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">পরিবহন/গাড়ি নং: </span>
                          <span className="text-slate-950">{slipVehicleNo || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">ড্রাইভারের নাম: </span>
                          <span className="text-slate-950">{slipDriverName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">প্রেরণের স্থান: </span>
                          <span className="text-slate-950">প্রধান গোডাউন, খাতুনগঞ্জ</span>
                        </div>
                      </div>

                      {/* Itemized Table */}
                      <table className="w-full text-left border-collapse border border-slate-900 text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 font-black border-b border-slate-900">
                            <th className="py-1 px-2 border-r border-slate-900 text-center w-10">ক্রম:</th>
                            <th className="py-1 px-2 border-r border-slate-900">পণ্যের বিবরণ (Product Description)</th>
                            <th className="py-1 px-2 border-r border-slate-900 text-center">কার্টন</th>
                            <th className="py-1 px-2 border-r border-slate-900 text-center">লুজ পিস</th>
                            <th className="py-1 px-2 border-r border-slate-900 text-center">মোট পিস</th>
                            <th className="py-1 px-2 border-r border-slate-900 text-right">একক মূল্য</th>
                            <th className="py-1 px-2 text-right">মোট টাকা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 font-bold">
                          {slipItemsToPrint.map((item, iIndex) => {
                            const prod = products.find(p => p.id === item.productId);
                            const pcsPerCtn = prod?.pcsPerCarton || prod?.cartonSize || 1;
                            const ctn = item.cartons !== undefined ? item.cartons : Math.floor(item.qty / pcsPerCtn);
                            const loose = item.loosePcs !== undefined ? item.loosePcs : (item.qty % pcsPerCtn);

                            return (
                              <tr key={item.id}>
                                <td className="py-1 px-2 border-r border-slate-900 text-center">{toBanglaNumerals(iIndex + 1)}</td>
                                <td className="py-1 px-2 border-r border-slate-900 font-black">{item.productName}</td>
                                <td className="py-1 px-2 border-r border-slate-900 text-center">{toBanglaNumerals(ctn)}</td>
                                <td className="py-1 px-2 border-r border-slate-900 text-center">{toBanglaNumerals(loose)}</td>
                                <td className="py-1 px-2 border-r border-slate-900 text-center font-black">{formatBanglaNumber(item.qty)}</td>
                                <td className="py-1 px-2 border-r border-slate-900 text-right">{formatBanglaCurrency(item.unitPrice || 0)}</td>
                                <td className="py-1 px-2 text-right font-black">{formatBanglaCurrency(item.damageValue)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-black border-t-2 border-slate-900">
                            <td colSpan={2} className="py-1.5 px-2 border-r border-slate-900 text-right">সর্বমোট (Total):</td>
                            <td className="py-1.5 px-2 border-r border-slate-900 text-center">{toBanglaNumerals(slipTotalCartons)} কার্টন</td>
                            <td className="py-1.5 px-2 border-r border-slate-900 text-center">{toBanglaNumerals(slipTotalLoose)} পিস</td>
                            <td className="py-1.5 px-2 border-r border-slate-900 text-center text-blue-900">{formatBanglaNumber(slipTotalPcs)} পিস</td>
                            <td className="py-1.5 px-2 border-r border-slate-900"></td>
                            <td className="py-1.5 px-2 text-right text-emerald-950 font-black">{formatBanglaCurrency(slipTotalAmount)}</td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Signature Lines */}
                      <div className="pt-6 grid grid-cols-2 gap-8 text-[11px] font-bold text-slate-900">
                        <div className="text-center space-y-1">
                          <div className="border-t border-slate-900 pt-1">
                            ড্রাইভার / পরিপাহকের স্বাক্ষর (Driver Signature)
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <div className="border-t border-slate-900 pt-1">
                            অনুমোদিত কর্মকর্তার স্বাক্ষর (Authorized Sign)
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}

              </div>

            </div>
          )}

        </div>
      )}

      {/* PRINT MEDIA STYLES INJECTION */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #friends-erp-root, #sales-invoices-module, header, aside {
            display: none !important;
          }
          .printable-slip-area, .printable-slip-area * {
            visibility: visible;
          }
          .printable-slip-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .page-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

    </div>
  );
}
