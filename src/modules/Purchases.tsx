import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, postPurchaseInvoice, postCompanyPayment, postCompanyIncentive } from '../db/db';
import { Company, PurchaseItem, PurchaseInvoice, DemandSheet, Product, CompanyIncentive, IncentiveType } from '../types';
import UniversalPrintModal from '../components/UniversalPrintModal';
import { formatBanglaCurrency, toBanglaNumerals, formatBanglaDate } from '../lib/utils';
import { 
  Plus, 
  Search, 
  Briefcase, 
  Trash2, 
  Layers, 
  CreditCard, 
  Save, 
  X, 
  Info, 
  ArrowUpCircle, 
  Printer, 
  ShoppingBag, 
  Receipt,
  FileCheck,
  Edit3,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Boxes,
  Calendar,
  DollarSign,
  Check,
  Building2,
  FileText,
  History,
  ArrowRight,
  AlertCircle,
  Package,
  Share2
} from 'lucide-react';

const formatBanglaNumber = (num: number): string => {
  const formatted = new Intl.NumberFormat('en-IN').format(num || 0);
  return toBanglaNumerals(formatted);
};

interface PurchaseLineItem {
  productId: string;
  name: string;
  cartons: number;
  loosePcs: number;
  pcsPerCarton: number;
  qty: number; // total pcs
  purchasePricePcs: number;
  ratePerCarton: number;
  total: number;
}

export default function Purchases() {
  const [searchCompany, setSearchCompany] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<'ledger' | 'purchase' | 'demand'>('purchase');
  const [printData, setPrintData] = useState<any>(null);
  const [compName] = useState('মেসার্স ফাহিম এন্টারপ্রাইজ');
  const [compAddress] = useState('তেজগাঁও, ঢাকা');
  
  // Main Module Tabs: 'new-purchase' | 'ledger' | 'history'
  const [activeTab, setActiveTab] = useState<'new-purchase' | 'ledger' | 'history'>('new-purchase');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Purchase Entry Mode: 'import-demand' | 'manual-entry'
  const [entryMode, setEntryMode] = useState<'import-demand' | 'manual-entry'>('import-demand');
  const [selectedDemandSlipId, setSelectedDemandSlipId] = useState<string>('');

  // Purchase Header Form
  const [purchaseCompanyId, setPurchaseCompanyId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [cashPaid, setCashPaid] = useState<number>(0);

  // Item List in Purchase Order
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([]);

  // Add Item Draft Drawer / Section State
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [addProductId, setAddProductId] = useState<string>('');
  const [addCartons, setAddCartons] = useState<number>(1);
  const [addLoosePcs, setAddLoosePcs] = useState<number>(0);
  const [addCustomRate, setAddCustomRate] = useState<number | ''>('');

  // Notifications & Loaders
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Supplier Add/Edit Modal
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyIdInput, setCompanyIdInput] = useState('');
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [companyPhoneInput, setCompanyPhoneInput] = useState('');
  const [companyAddressInput, setCompanyAddressInput] = useState('');
  const [companyOpeningBalanceInput, setCompanyOpeningBalanceInput] = useState<number>(0);
  const [companyOpeningBalanceTypeInput, setCompanyOpeningBalanceTypeInput] = useState<'Payable' | 'Receivable'>('Payable');
  const [companyError, setCompanyError] = useState('');

  // Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payRemarks, setPayRemarks] = useState('');
  const [payError, setPayError] = useState('');

  // Incentive & Claim Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<IncentiveType>('Target Incentive');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [adjustmentRemarks, setAdjustmentRemarks] = useState('');
  const [adjustmentError, setAdjustmentError] = useState('');

  // Live Queries
  const companies = useLiveQuery(() => db.companies.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const demandSheets = useLiveQuery(() => db.demandSheets.toArray()) || [];
  const purchaseInvoices = useLiveQuery(() => db.purchaseInvoices.toArray()) || [];

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === (selectedCompanyId || purchaseCompanyId));
  }, [companies, selectedCompanyId, purchaseCompanyId]);

  const selectedCompanyLedger = useLiveQuery(() => 
    selectedCompanyId 
      ? db.companyLedgers.where('companyId').equals(selectedCompanyId).sortBy('date')
      : Promise.resolve([]),
    [selectedCompanyId]
  ) || [];

  // Filtered companies list
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => 
      c.name.toLowerCase().includes(searchCompany.toLowerCase()) || 
      c.id.toLowerCase().includes(searchCompany.toLowerCase())
    );
  }, [companies, searchCompany]);

  // Available Demand Slips for importing
  const availableDemandSlips = useMemo(() => {
    return demandSheets.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [demandSheets]);

  // Handle Demand Slip Import Selection
  const handleSelectDemandSlip = (dsId: string) => {
    setSelectedDemandSlipId(dsId);
    if (!dsId) {
      setPurchaseItems([]);
      return;
    }

    const ds = demandSheets.find(d => d.id === dsId);
    if (!ds) return;

    setPurchaseCompanyId(ds.companyId);
    if (!selectedCompanyId) setSelectedCompanyId(ds.companyId);

    // Map demand slip items into editable purchase line items
    const loadedItems: PurchaseLineItem[] = (ds.items || []).map(i => {
      const prod = products.find(p => p.id === i.productId);
      const pcsPerCarton = i.pcsPerCarton || prod?.pcsPerCarton || prod?.cartonSize || 1;
      const cartons = i.cartons !== undefined ? i.cartons : Math.floor(i.qty / pcsPerCarton);
      const loosePcs = i.loosePcs !== undefined ? i.loosePcs : i.qty % pcsPerCarton;
      const totalPcs = (cartons * pcsPerCarton) + loosePcs;

      const ratePerCarton = i.ratePerCarton || i.rate || (prod?.purchasePriceCarton || (prod?.purchasePrice ? prod.purchasePrice * pcsPerCarton : 0));
      const purchasePricePcs = i.ratePerPcs || (ratePerCarton > 0 && pcsPerCarton > 0 ? ratePerCarton / pcsPerCarton : (prod?.purchasePricePcs || prod?.purchasePrice || 0));
      const lineTotal = i.total || (cartons * ratePerCarton + loosePcs * purchasePricePcs);

      return {
        productId: i.productId,
        name: i.productName || prod?.name || 'অজানা পণ্য',
        cartons,
        loosePcs,
        pcsPerCarton,
        qty: totalPcs,
        purchasePricePcs,
        ratePerCarton,
        total: lineTotal
      };
    });

    setPurchaseItems(loadedItems);
    setRemarks(`ডিমান্ড স্লিপ #${ds.demandNo} থেকে ইম্পোর্ট করা হয়েছে`);
    setNotification({
      type: 'success',
      message: `ডিমান্ড স্লিপ #${ds.demandNo} থেকে ${loadedItems.length}টি পণ্য লোড হয়েছে।`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  // Modify item quantity or rate directly in item table
  const handleItemChange = (idx: number, field: 'cartons' | 'loosePcs' | 'ratePerCarton' | 'purchasePricePcs', val: number) => {
    const updated = [...purchaseItems];
    const item = { ...updated[idx] };
    const numericVal = isNaN(val) ? 0 : Math.max(0, val);

    if (field === 'cartons') {
      item.cartons = numericVal;
    } else if (field === 'loosePcs') {
      item.loosePcs = numericVal;
    } else if (field === 'ratePerCarton') {
      item.ratePerCarton = numericVal;
      if (item.pcsPerCarton > 0) {
        item.purchasePricePcs = numericVal / item.pcsPerCarton;
      }
    } else if (field === 'purchasePricePcs') {
      item.purchasePricePcs = numericVal;
      item.ratePerCarton = numericVal * item.pcsPerCarton;
    }

    item.qty = (item.cartons * item.pcsPerCarton) + item.loosePcs;
    item.total = (item.cartons * item.ratePerCarton) + (item.loosePcs * item.purchasePricePcs);
    
    updated[idx] = item;
    setPurchaseItems(updated);
  };

  // Delete an item from purchase order table
  const handleRemoveItem = (idx: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  // Available products for adding new items (filtered by selected company if chosen)
  const availableProductsForAdd = useMemo(() => {
    const activeCompany = purchaseCompanyId || selectedCompanyId;
    if (!activeCompany) return products;
    return products.filter(p => p.companyId === activeCompany || p.company === selectedCompany?.name);
  }, [products, purchaseCompanyId, selectedCompanyId, selectedCompany]);

  // Selected product object for add item drawer
  const selectedProductForAdd = useMemo(() => {
    return products.find(p => p.id === addProductId);
  }, [products, addProductId]);

  // Add new alternative / additional product item to order
  const handleAddNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addProductId || !selectedProductForAdd) {
      setNotification({ type: 'error', message: 'পণ্য নির্বাচন করুন!' });
      return;
    }

    const pcsPerCarton = selectedProductForAdd.pcsPerCarton || selectedProductForAdd.cartonSize || 1;
    const totalPcs = (addCartons * pcsPerCarton) + addLoosePcs;

    if (totalPcs <= 0) {
      setNotification({ type: 'error', message: 'পয়েন্ট পরিমাণ অন্তত ১ হতে হবে।' });
      return;
    }

    const defaultRatePerCarton = selectedProductForAdd.purchasePriceCarton || (selectedProductForAdd.purchasePrice ? selectedProductForAdd.purchasePrice * pcsPerCarton : 0);
    const ratePerCarton = addCustomRate !== '' ? Number(addCustomRate) : defaultRatePerCarton;
    const purchasePricePcs = pcsPerCarton > 0 ? ratePerCarton / pcsPerCarton : (selectedProductForAdd.purchasePricePcs || selectedProductForAdd.purchasePrice || 0);
    const lineTotal = (addCartons * ratePerCarton) + (addLoosePcs * purchasePricePcs);

    // Check if item exists already
    const existingIdx = purchaseItems.findIndex(i => i.productId === addProductId);

    if (existingIdx > -1) {
      const updated = [...purchaseItems];
      const existing = updated[existingIdx];
      existing.cartons += addCartons;
      existing.loosePcs += addLoosePcs;
      existing.qty = (existing.cartons * existing.pcsPerCarton) + existing.loosePcs;
      existing.total = (existing.cartons * existing.ratePerCarton) + (existing.loosePcs * existing.purchasePricePcs);
      setPurchaseItems(updated);
    } else {
      const newItem: PurchaseLineItem = {
        productId: selectedProductForAdd.id,
        name: selectedProductForAdd.name,
        cartons: addCartons,
        loosePcs: addLoosePcs,
        pcsPerCarton,
        qty: totalPcs,
        purchasePricePcs,
        ratePerCarton,
        total: lineTotal
      };
      setPurchaseItems([...purchaseItems, newItem]);
    }

    // Reset drawer state
    setAddProductId('');
    setAddCartons(1);
    setAddLoosePcs(0);
    setAddCustomRate('');
    setIsAddItemOpen(false);

    setNotification({ type: 'success', message: 'নতুন পণ্য পারচেজ তালিকায় যোগ করা হয়েছে!' });
    setTimeout(() => setNotification(null), 2500);
  };

  // Total Purchase Bill Calculations
  const totalPurchaseCartons = purchaseItems.reduce((acc, i) => acc + i.cartons, 0);
  const totalPurchaseLoosePcs = purchaseItems.reduce((acc, i) => acc + i.loosePcs, 0);
  const totalPurchasePcs = purchaseItems.reduce((acc, i) => acc + i.qty, 0);
  const totalPurchaseBill = purchaseItems.reduce((acc, i) => acc + i.total, 0);
  const dueToCompany = Math.max(0, totalPurchaseBill - cashPaid);

  // Submit Purchase Invoice & Sync Inventory/Ledger
  const handleSavePurchase = async () => {
    setNotification(null);

    const activeCompanyId = purchaseCompanyId || selectedCompanyId;
    const activeCompany = companies.find(c => c.id === activeCompanyId);

    if (!activeCompanyId || !activeCompany) {
      setNotification({ type: 'error', message: 'অনুগ্রহ করে প্রস্তুতকারক কোম্পানি নির্বাচন করুন।' });
      return;
    }

    if (purchaseItems.length === 0) {
      setNotification({ type: 'error', message: 'পারচেজ চালানে কোনো পণ্য যুক্ত করা হয়নি।' });
      return;
    }

    setIsSaving(true);

    try {
      const purchaseNo = `FE-PUR-${Date.now().toString().slice(-6)}`;
      const purchaseData: PurchaseInvoice = {
        id: `pur_inv_${Date.now()}`,
        purchaseNo,
        companyId: activeCompanyId,
        companyName: activeCompany.name,
        date: purchaseDate,
        supplierInvoiceNo: supplierInvoiceNo || undefined,
        items: purchaseItems.map(item => ({
          productId: item.productId,
          name: item.name,
          cartons: item.cartons,
          loosePcs: item.loosePcs,
          pcsPerCarton: item.pcsPerCarton,
          qty: item.qty,
          quantity: item.qty,
          purchasePrice: item.purchasePricePcs,
          ratePerCarton: item.ratePerCarton,
          ratePerPcs: item.purchasePricePcs,
          total: item.total
        })),
        totalAmount: totalPurchaseBill,
        cashPaid: cashPaid,
        outstandingBalanceBefore: activeCompany.outstandingBalance || 0,
        outstandingBalanceAfter: (activeCompany.outstandingBalance || 0) + totalPurchaseBill - cashPaid,
        remarks: remarks || (selectedDemandSlipId ? `ডিমান্ড স্লিপ #${selectedDemandSlipId} থেকে স্টক ইন` : 'ম্যানুয়াল পারচেজ চালান')
      };

      // 1. Save purchase invoice, update product stockInPcs & company ledger balance
      await postPurchaseInvoice(purchaseData);

      // 2. Update Demand Slip status if imported
      if (selectedDemandSlipId) {
        await db.demandSheets.update(selectedDemandSlipId, {
          status: 'সম্পন্ন / স্টক ইন (Completed)'
        });
      }

      setNotification({
        type: 'success',
        message: `পারচেজ চালান #${purchaseNo} সফলভাবে অনুমোদন ও স্টক ইন করা হয়েছে! কোম্পানি লেজার ও প্রোডাক্ট স্টক আপডেট সম্পন্ন।`
      });

      // Reset form
      setPurchaseItems([]);
      setCashPaid(0);
      setSupplierInvoiceNo('');
      setRemarks('');
      setSelectedDemandSlipId('');

      // Move to company ledger view
      setSelectedCompanyId(activeCompanyId);
      setActiveTab('ledger');

      setTimeout(() => setNotification(null), 4500);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'পারচেজ সংরক্ষণে ত্রুটি: ' + (err.message || err)
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Supplier CRUD Modal Handlers
  const handleOpenAddCompany = () => {
    setEditingCompany(null);
    setCompanyIdInput('');
    setCompanyNameInput('');
    setCompanyPhoneInput('');
    setCompanyAddressInput('');
    setCompanyOpeningBalanceInput(0);
    setCompanyOpeningBalanceTypeInput('Payable');
    setCompanyError('');
    setIsCompanyModalOpen(true);
  };

  const handleOpenEditCompany = (c: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCompany(c);
    setCompanyIdInput(c.id);
    setCompanyNameInput(c.name);
    setCompanyPhoneInput(c.phone);
    setCompanyAddressInput(c.address);
    setCompanyOpeningBalanceInput(c.openingBalance || 0);
    setCompanyOpeningBalanceTypeInput(c.openingBalanceType || 'Payable');
    setCompanyError('');
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError('');

    if (!companyIdInput.trim() || !companyNameInput.trim()) {
      setCompanyError('কোম্পানি আইডেন্টিফায়ার এবং নাম আবশ্যক।');
      return;
    }

    try {
      if (editingCompany) {
        await db.companies.update(editingCompany.id, {
          name: companyNameInput.trim(),
          phone: companyPhoneInput.trim(),
          address: companyAddressInput.trim(),
          openingBalance: companyOpeningBalanceInput,
          openingBalanceType: companyOpeningBalanceTypeInput
        });
      } else {
        const exists = await db.companies.get(companyIdInput.trim());
        if (exists) {
          setCompanyError('এই কোম্পানি আইডি কোডটি ইতিমধ্যে নিবন্ধিত।');
          return;
        }

        const initialOutstanding = companyOpeningBalanceTypeInput === 'Payable' 
          ? companyOpeningBalanceInput 
          : -companyOpeningBalanceInput;

        await db.companies.add({
          id: companyIdInput.trim(),
          name: companyNameInput.trim(),
          phone: companyPhoneInput.trim(),
          address: companyAddressInput.trim(),
          openingBalance: companyOpeningBalanceInput,
          openingBalanceType: companyOpeningBalanceTypeInput,
          outstandingBalance: initialOutstanding
        });
      }
      setIsCompanyModalOpen(false);
    } catch (err: any) {
      setCompanyError(err.message || 'কোম্পানি সংরক্ষণে ত্রুটি হয়েছে।');
    }
  };

  // Supplier Payment Posting Modal
  const handleOpenPayModal = () => {
    const company = companies.find(c => c.id === selectedCompanyId);
    setPayAmount(company?.outstandingBalance || 0);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayRemarks('সাপ্লায়ার দেনা ক্যাশ পরিশোধ');
    setPayError('');
    setIsPayModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');

    if (!selectedCompanyId) return;
    if (payAmount <= 0) {
      setPayError('পরিশোধের পরিমাণ ধনাত্মক সংখ্যা হতে হবে।');
      return;
    }

    try {
      await postCompanyPayment(
        selectedCompanyId, 
        payAmount, 
        payDate, 
        payRemarks
      );
      setIsPayModalOpen(false);
      setNotification({ type: 'success', message: 'সাপ্লায়ার দেনা ক্যাশ পরিশোধ লেজারে নথিভুক্ত হয়েছে।' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setPayError(err.message || 'পেমেন্ট এনট্রিতে ত্রুটি হয়েছে।');
    }
  };

  const handleOpenAdjustmentModal = () => {
    setAdjustmentType('Target Incentive');
    setAdjustmentAmount(0);
    setAdjustmentRemarks('');
    setAdjustmentError('');
    setIsAdjustmentModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustmentError('');

    if (!selectedCompanyId) return;
    if (adjustmentAmount <= 0) {
      setAdjustmentError('টাকার পরিমাণ ধনাত্মক সংখ্যা হতে হবে।');
      return;
    }

    try {
      const company = companies.find(c => c.id === selectedCompanyId);
      if (!company) throw new Error('Company not found');

      const incentiveData: CompanyIncentive = {
        id: crypto.randomUUID(),
        companyId: company.id,
        companyName: company.name,
        date: new Date().toISOString().split('T')[0],
        type: adjustmentType,
        amount: adjustmentAmount,
        remarks: adjustmentRemarks
      };

      await postCompanyIncentive(incentiveData);
      
      setIsAdjustmentModalOpen(false);
      setNotification({ type: 'success', message: 'লেজার ব্যালেন্স সমন্বিত হয়েছে।' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setAdjustmentError(err.message || 'অ্যাডজাস্টমেন্ট সংরক্ষণে ত্রুটি হয়েছে।');
    }
  };

  return (
    <div className="space-y-6" id="purchases-module">
      
      {/* 1. Header Title & Top Navigation Tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-sans font-black text-2xl text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-600" />
            সাপ্লায়ার পারচেজ ও স্টক ইন (Supplier Purchases & Stock In)
          </h1>
          <p className="font-sans text-xs text-slate-500 mt-0.5">
            ডিমান্ড স্লিপ থেকে লোড, ম্যানুয়াল স্টক ইন, আইটেম পরিবর্তন এবং কোম্পানি বাকি লেজার ব্যবস্থাপনা
          </p>
        </div>

        {/* Global Module Navigation Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/70">
          <button 
            onClick={() => setActiveTab('new-purchase')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${activeTab === 'new-purchase' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            id="tab-btn-new-purchase"
          >
            <Plus className="h-4 w-4 text-emerald-600" /> নতুন পারচেজ এন্ট্রি
          </button>

          <button 
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            id="tab-btn-ledger"
          >
            <Receipt className="h-4 w-4 text-indigo-600" /> কোম্পানি লেজার ও দেনা
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            id="tab-btn-history"
          >
            <FileText className="h-4 w-4 text-slate-600" /> পারচেজ ইতিহাস
          </button>
        </div>
      </div>

      {/* Global Toast Notification */}
      {notification && (
        <div className={`rounded-xl p-4 text-xs font-semibold flex items-center justify-between border shadow-sm transition ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: NEW PURCHASE CREATION (DUAL ENTRY OPTIONS & FULL EDIT) */}
      {/* ========================================================= */}
      {activeTab === 'new-purchase' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* Main Purchase Entry Form Container (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Step 1: Entry Mode Selector */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block font-mono">ধাপ ১: পারচেজ এন্ট্রি অপশন</span>
              <h2 className="font-sans font-extrabold text-base text-slate-900 mt-0.5 mb-3">কীভাবে স্টক ইন করতে চান?</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option A: Import from Demand Slip */}
                <div 
                  onClick={() => setEntryMode('import-demand')}
                  className={`rounded-xl border-2 p-4 cursor-pointer transition flex flex-col justify-between ${
                    entryMode === 'import-demand' 
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-sm' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-2 ${entryMode === 'import-demand' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">অপশন A: ডিমান্ড স্লিপ থেকে লোড</span>
                    </div>
                    {entryMode === 'import-demand' && <Check className="h-5 w-5 text-emerald-600" />}
                  </div>
                  <p className="text-xs text-slate-500">পূর্বের ডিমান্ড স্লিপের কোম্পানি, আইটেম ও রেট স্বয়ংক্রিয়ভাবে ফর্ম ও টেবিলে চলে আসবে।</p>
                </div>

                {/* Option B: Fresh Manual Entry */}
                <div 
                  onClick={() => {
                    setEntryMode('manual-entry');
                    setSelectedDemandSlipId('');
                  }}
                  className={`rounded-xl border-2 p-4 cursor-pointer transition flex flex-col justify-between ${
                    entryMode === 'manual-entry' 
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-sm' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-2 ${entryMode === 'manual-entry' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Edit3 className="h-5 w-5" />
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">অপশন B: সম্পূর্ণ নতুন ম্যানুয়াল এন্ট্রি</span>
                    </div>
                    {entryMode === 'manual-entry' && <Check className="h-5 w-5 text-emerald-600" />}
                  </div>
                  <p className="text-xs text-slate-500">ডিমান্ড স্লিপ ছাড়া সরাসরি নতুন চালান ও কোম্পানি সিলেক্ট করে ম্যানুয়াল স্টক ইন করুন।</p>
                </div>
              </div>

              {/* Demand Slip Select Dropdown (If Option A active) */}
              {entryMode === 'import-demand' && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ডিমান্ড স্লিপ নির্বাচন করুন (Import Demand Slip)
                  </label>
                  <select
                    value={selectedDemandSlipId}
                    onChange={(e) => handleSelectDemandSlip(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-emerald-50/20 py-2.5 px-3 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    id="demand-slip-select"
                  >
                    <option value="">-- তালিকায় থাকা ডিমান্ড স্লিপ বেছে নিন --</option>
                    {availableDemandSlips.map(ds => (
                      <option key={ds.id} value={ds.id}>
                        {ds.demandNo} — {ds.companyName} ({ds.date}) [{formatBanglaCurrency(ds.currentOrderAmount || ds.orderTotal || 0)}] {ds.status ? `• ${ds.status}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedDemandSlipId && (
                    <div className="flex items-center justify-between bg-emerald-100/60 rounded-lg p-2 text-xs text-emerald-900 font-medium">
                      <span>লিঙ্কড ডিমান্ড স্লিপ: <strong className="font-mono">{selectedDemandSlipId}</strong></span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const ds = demandSheets.find(d => d.id === selectedDemandSlipId);
                            if (ds) {
                              setPrintType('demand');
                              setPrintData({
                                demandNo: ds.demandNo,
                                date: ds.date,
                                companyName: ds.companyName,
                                items: ds.items || [],
                                currentOrderAmount: ds.currentOrderAmount || ds.orderTotal || 0,
                                remarks: ds.remarks
                              });
                              setShowPrintModal(true);
                            }
                          }}
                          className="flex items-center gap-1 bg-white/80 px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-white transition"
                        >
                          <Printer className="h-3 w-3" /> প্রিন্ট করুন
                        </button>
                        <button 
                          onClick={() => handleSelectDemandSlip('')}
                          className="text-emerald-700 hover:text-emerald-900 text-[11px] underline font-bold"
                        >
                          রিসেট করুন
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Invoice Header Information */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">ধাপ ২: সাপ্লায়ার ও পারচেজ চালান তথ্য</span>
                {purchaseCompanyId && (
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    বর্তমান দেনা: {formatBanglaCurrency(companies.find(c => c.id === purchaseCompanyId)?.outstandingBalance || 0)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Supplier Company */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    কোম্পানি / প্রস্তুতকারক *
                  </label>
                  <select 
                    value={purchaseCompanyId || selectedCompanyId || ''}
                    onChange={(e) => {
                      setPurchaseCompanyId(e.target.value);
                      setSelectedCompanyId(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                    id="purchase-company-select"
                  >
                    <option value="">-- কোম্পানি বেছে নিন --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    পারচেজ তারিখ
                  </label>
                  <input 
                    type="date" 
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Supplier Invoice Reference No */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    সাপ্লায়ার চালান নং (মেমো নং)
                  </label>
                  <input 
                    type="text" 
                    placeholder="যেমন: UN-892104"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Editable Line Items Table & Item Replacement */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-sans font-extrabold text-sm text-slate-900">
                    ধাপ ৩: পণ্য ও স্টক তালিকা (১০০% সম্পাদনযোগ্য)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    রিসিভ করা কার্টন, লুজ পিস ও দর পরিবর্তন করতে ক্লিক করুন। কোম্পানি ভিন্ন পণ্য পাঠালে পরিবর্তন বা নতুন আইটেম যুক্ত করুন।
                  </p>
                </div>

                {/* Add New Line Item Button */}
                <button 
                  onClick={() => setIsAddItemOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 transition shadow-sm"
                  id="btn-add-new-item"
                >
                  <Plus className="h-4 w-4" /> + নতুন পণ্য যোগ করুন
                </button>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                      <th className="py-2.5 px-3">ক্রম</th>
                      <th className="py-2.5 px-3">পণ্যের নাম</th>
                      <th className="py-2.5 px-3 text-center">কার্টন</th>
                      <th className="py-2.5 px-3 text-center">লুজ পিস</th>
                      <th className="py-2.5 px-3 text-center">মোট পিস</th>
                      <th className="py-2.5 px-3 text-right">কার্টন দর (৳)</th>
                      <th className="py-2.5 px-3 text-right">মোট টাকা (৳)</th>
                      <th className="py-2.5 px-3 text-center">মুছে ফেলুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Boxes className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                          <span>ডিমান্ড স্লিপ সিলেক্ট করুন অথবা উপরে "+ নতুন পণ্য যোগ করুন" বাটনে ক্লিক করে পণ্য যুক্ত করুন।</span>
                        </td>
                      </tr>
                    ) : (
                      purchaseItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-extrabold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">প্রতি কার্টনে: {toBanglaNumerals(item.pcsPerCarton)} পিস</span>
                          </td>

                          {/* Editable Cartons */}
                          <td className="py-2.5 px-2 text-center">
                            <input 
                              type="number" 
                              min="0"
                              value={item.cartons}
                              onChange={(e) => handleItemChange(idx, 'cartons', parseInt(e.target.value) || 0)}
                              className="w-16 rounded-lg border border-slate-200 bg-white py-1 px-2 text-center font-mono font-bold text-xs focus:border-emerald-500 focus:outline-none"
                            />
                          </td>

                          {/* Editable Loose Pcs */}
                          <td className="py-2.5 px-2 text-center">
                            <input 
                              type="number" 
                              min="0"
                              value={item.loosePcs}
                              onChange={(e) => handleItemChange(idx, 'loosePcs', parseInt(e.target.value) || 0)}
                              className="w-16 rounded-lg border border-slate-200 bg-white py-1 px-2 text-center font-mono font-bold text-xs focus:border-emerald-500 focus:outline-none"
                            />
                          </td>

                          {/* Auto Total Pcs */}
                          <td className="py-2.5 px-3 text-center font-mono font-extrabold text-indigo-700 bg-slate-50/50 rounded-lg">
                            {formatBanglaNumber(item.qty)}
                          </td>

                          {/* Editable Rate per Carton */}
                          <td className="py-2.5 px-2 text-right">
                            <input 
                              type="number" 
                              step="any"
                              value={item.ratePerCarton}
                              onChange={(e) => handleItemChange(idx, 'ratePerCarton', parseFloat(e.target.value) || 0)}
                              className="w-24 rounded-lg border border-slate-200 bg-white py-1 px-2 text-right font-mono font-bold text-xs focus:border-emerald-500 focus:outline-none"
                            />
                          </td>

                          {/* Calculated Line Total */}
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                            {formatBanglaCurrency(item.total)}
                          </td>

                          {/* Delete Action */}
                          <td className="py-2.5 px-3 text-center">
                            <button 
                              onClick={() => handleRemoveItem(idx)}
                              className="rounded-lg p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                              title="আইটেম বাদ দিন"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Order Items Summary Bar */}
              {purchaseItems.length > 0 && (
                <div className="flex flex-wrap items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-4">
                    <span>মোট আইটেম: <strong className="text-slate-900 font-mono">{toBanglaNumerals(purchaseItems.length)}</strong> টি</span>
                    <span>মোট কার্টন: <strong className="text-slate-900 font-mono">{formatBanglaNumber(totalPurchaseCartons)}</strong> টি</span>
                    <span>মোট পিস: <strong className="text-indigo-700 font-mono">{formatBanglaNumber(totalPurchasePcs)}</strong> পিস</span>
                  </div>
                  <div className="text-right">
                    <span>সর্বমোট পারচেজ বিল: <strong className="text-base text-emerald-700 font-mono ml-1">{formatBanglaCurrency(totalPurchaseBill)}</strong></span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Summary & Settlement Section (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Purchase Settlement Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5 sticky top-6">
              <h3 className="font-sans font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3">
                বিল হিসাব ও পারচেজ পোস্ট
              </h3>

              {/* Company Info Box */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">নির্বাচিত কোম্পানি:</span>
                  <span className="font-bold text-slate-900">{selectedCompany?.name || 'নির্বাচিত হয়নি'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">পূর্বের দেনা (We Owe):</span>
                  <span className="font-bold text-indigo-700 font-mono">{formatBanglaCurrency(selectedCompany?.outstandingBalance || 0)}</span>
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">মোট পারচেজ চালান বিল:</span>
                  <span className="text-sm font-black text-slate-900 font-mono">{formatBanglaCurrency(totalPurchaseBill)}</span>
                </div>

                {/* Cash Paid Immediately */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    নগদ টাকা প্রদান (Cash Paid)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="নগদ কত দিলেন" 
                      value={cashPaid || ''}
                      onChange={(e) => setCashPaid(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Added to Company Ledger */}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                  <span className="font-bold text-rose-700">কোম্পানি লেজারে নতুন দেনা যোগ হবে:</span>
                  <span className="text-sm font-black text-rose-700 font-mono">{formatBanglaCurrency(dueToCompany)}</span>
                </div>

                {/* Remarks / Reference */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    নোট / মন্তব্য
                  </label>
                  <input 
                    type="text" 
                    placeholder="যেমন: এসআর সেলিম এর মাধ্যমে চালান প্রাপ্তি"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button 
                  onClick={handleSavePurchase}
                  disabled={isSaving || purchaseItems.length === 0}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-md"
                  id="btn-approve-purchase"
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  অনুমোদন ও স্টক ইন করুন (Approve & Save)
                </button>

                <button 
                  onClick={() => {
                    setPurchaseItems([]);
                    setSelectedDemandSlipId('');
                    setRemarks('');
                    setCashPaid(0);
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  ফরম রিসেট করুন
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: COMPANY LEDGER & RUNNING TRANSACTIONS */}
      {/* ========================================================= */}
      {activeTab === 'ledger' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* Left: Supplier Company Directory (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-sans font-extrabold text-base text-slate-900">সাপ্লায়ার ডিরেক্টরি</h2>
                <p className="font-sans text-xs text-slate-500">প্রস্তুতকারক কোম্পানি ও ব্র্যান্ড তালিকা</p>
              </div>
              <button 
                onClick={handleOpenAddCompany}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
                title="নতুন কোম্পানি যোগ করুন"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="কোম্পানির নাম বা কোড দিয়ে খুঁজুন..." 
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-medium focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Company Cards */}
            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {filteredCompanies.length === 0 ? (
                <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center bg-white">
                  <span className="text-xs font-semibold text-slate-400 block">কোনো প্রস্তুতকারক কোম্পানি নেই।</span>
                </div>
              ) : (
                filteredCompanies.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`rounded-xl border p-4 cursor-pointer transition flex flex-col justify-between hover:shadow-sm ${
                      selectedCompanyId === c.id 
                        ? 'bg-emerald-50/50 border-emerald-500 shadow-sm' 
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`rounded-xl p-2 ${selectedCompanyId === c.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 block">{c.name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">{c.id} • {c.phone}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleOpenEditCompany(c, e)}
                        className="rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-1 transition"
                        title="কোম্পানি তথ্য পরিবর্তন"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">{c.address || 'ঠিকানা দেওয়া হয়নি'}</span>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-bold">
                          {c.outstandingBalance > 0 ? 'মোট দেনা (We Owe)' : c.outstandingBalance < 0 ? 'মোট পাওনা (Receivable)' : 'ব্যালেন্স (Balance)'}
                        </span>
                        <span className={`text-sm font-black font-mono ${c.outstandingBalance > 0 ? 'text-indigo-600' : c.outstandingBalance < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {formatBanglaCurrency(Math.abs(c.outstandingBalance))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Selected Supplier Ledger Detail (8 Cols) */}
          <div className="lg:col-span-8">
            {selectedCompanyId && selectedCompany ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col h-full space-y-6">
                
                {/* Header Info */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">কোম্পানি লেজার কনসোল</span>
                    <h2 className="font-sans font-black text-xl text-slate-900 mt-0.5">{selectedCompany.name}</h2>
                    <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">আইডি: {selectedCompany.id} • ফোন: {selectedCompany.phone || 'N/A'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Print Ledger Button */}
                    <button 
                      onClick={() => {
                        setPrintType('ledger');
                        setPrintData({
                          companyName: selectedCompany.name,
                          companyId: selectedCompany.id,
                          balance: selectedCompany.outstandingBalance,
                          entries: selectedCompanyLedger
                        });
                        setShowPrintModal(true);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm cursor-pointer"
                    >
                      <Printer className="h-4 w-4" /> স্টেটমেন্ট প্রিন্ট
                    </button>
                    {/* Incentive/Adjustment Button */}
                    <button 
                      onClick={handleOpenAdjustmentModal}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                    >
                      ইনসেন্টিভ ও ক্লেইম এডজাস্টমেন্ট
                    </button>
                    {/* Cash Payment Button */}
                    <button 
                      onClick={handleOpenPayModal}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700 transition shadow-sm"
                      id="btn-post-company-payment"
                    >
                      <ArrowUpCircle className="h-4.5 w-4.5" /> নগদ দেনা পরিশোধ
                    </button>
                  </div>
                </div>

                {/* Liability Summary Box */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">বর্তমান জের অবস্থা (Current Balance Status)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xl font-black text-slate-900 font-mono">
                        {formatBanglaCurrency(Math.abs(selectedCompany.outstandingBalance))}
                      </span>
                      {selectedCompany.outstandingBalance > 0 ? (
                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">কোম্পানি পাবে (Payable / দেনা)</span>
                      ) : selectedCompany.outstandingBalance < 0 ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">আমি পাব (Receivable / পাওনা)</span>
                      ) : (
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">ব্যালেন্স শূন্য</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <span>ঠিকানা: {selectedCompany.address || 'N/A'}</span>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="flex-1 overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                        <th className="py-3 px-3">তারিখ</th>
                        <th className="py-3 px-3">ধরন</th>
                        <th className="py-3 px-3">বিবরণ / রেফারেন্স</th>
                        <th className="py-3 px-3 text-right">ডেবিট (-) (পরিশোধ)</th>
                        <th className="py-3 px-3 text-right">ক্রেডিট (+) (পারচেজ)</th>
                        <th className="py-3 px-3 text-right pr-4">চলতি দেনা ( balance )</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {selectedCompanyLedger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            এই কোম্পানির সাথে পূর্বে কোনো লেজার লেনদেন সম্পন্ন হয়নি।
                          </td>
                        </tr>
                      ) : (
                        selectedCompanyLedger.map(entry => (
                          <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-3 font-mono">{entry.date}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                entry.type === 'Purchase' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                entry.type === 'Payment' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {entry.type === 'Purchase' ? 'পারচেজ' : entry.type === 'Payment' ? 'পরিশোধ' : entry.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">{entry.remarks}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                              {entry.debit > 0 ? formatBanglaCurrency(entry.debit) : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {entry.credit > 0 ? formatBanglaCurrency(entry.credit) : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-slate-900 pr-4">
                              {formatBanglaCurrency(entry.balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : (
              <div className="flex h-[70vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <Building2 className="h-12 w-12 text-slate-300 mb-3" />
                <h3 className="font-sans font-bold text-base text-slate-900">কোনো কোম্পানি নির্বাচন করা হয়নি</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">বামের তালিকা থেকে যেকোনো প্রস্তুতকারক কোম্পানি সিলেক্ট করে তার রানিং লেজার, দেনা-পাওনা ও পেমেন্ট হিস্ট্রি দেখুন।</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: PURCHASE HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h2 className="font-sans font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3">
            সকল পারচেজ চালান ইতিহাস (Purchase Invoices History)
          </h2>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-3">চালান নং</th>
                  <th className="py-3 px-3">তারিখ</th>
                  <th className="py-3 px-3">কোম্পানি</th>
                  <th className="py-3 px-3">মেমো নং</th>
                  <th className="py-3 px-3 text-center">আইটেম সংখ্যা</th>
                  <th className="py-3 px-3 text-right">চালান বিল (৳)</th>
                  <th className="py-3 px-3 text-right">নগদ প্রদান (৳)</th>
                  <th className="py-3 px-3 font-mono">মন্তব্য</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {purchaseInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      কোনো পারচেজ চালান ইতিহাস পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  purchaseInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700">{inv.purchaseNo}</td>
                      <td className="py-3 px-3 font-mono">{inv.date}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{inv.companyName}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{inv.supplierInvoiceNo || '—'}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{toBanglaNumerals(inv.items?.length || 0)}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900">{formatBanglaCurrency(inv.totalAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{formatBanglaCurrency(inv.cashPaid)}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setPrintType('purchase');
                              setPrintData({
                                purchaseNo: inv.purchaseNo,
                                date: inv.date,
                                companyName: inv.companyName,
                                supplierInvoiceNo: inv.supplierInvoiceNo,
                                items: inv.items || [],
                                totalAmount: inv.totalAmount,
                                cashPaid: inv.cashPaid,
                                remarks: inv.remarks
                              });
                              setShowPrintModal(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="প্রিন্ট চালান"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] truncate max-w-[200px]">{inv.remarks}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ADD NEW ITEM TO PURCHASE ORDER */}
      {/* ========================================================= */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-sans font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" /> নতুন পণ্য যোগ করুন (Add Alternate/New Item)
              </h3>
              <button onClick={() => setIsAddItemOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewItemSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  পণ্য নির্বাচন করুন *
                </label>
                <select 
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">-- ক্যাটালগ থেকে পণ্য বেছে নিন --</option>
                  {availableProductsForAdd.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id}) • স্টক: {toBanglaNumerals(p.stockInPcs || p.stock)} পিস
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductForAdd && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>প্রতি কার্টনে পিস:</span>
                    <span className="font-bold text-slate-900 font-mono">{toBanglaNumerals(selectedProductForAdd.pcsPerCarton || selectedProductForAdd.cartonSize || 1)} পিস</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ডিফল্ট ক্রয় মূল্য:</span>
                    <span className="font-bold text-slate-900 font-mono">৳ {toBanglaNumerals(selectedProductForAdd.purchasePriceCarton || selectedProductForAdd.purchasePrice || 0)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    কার্টন সংখ্যা
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={addCartons}
                    onChange={(e) => setAddCartons(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-indigo-500 focus:outline-none text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    লুজ পিস
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={addLoosePcs}
                    onChange={(e) => setAddLoosePcs(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-indigo-500 focus:outline-none text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  কার্টন দর (ক্রয় মূল্য ৳)
                </label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="খালি রাখলে ক্যাটালগ দর ব্যবহৃত হবে"
                  value={addCustomRate}
                  onChange={(e) => setAddCustomRate(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsAddItemOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 shadow-sm transition"
                >
                  <Plus className="h-4 w-4" /> তালিকায় যোগ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT COMPANY SUPPLIER */}
      {/* ========================================================= */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-sans font-extrabold text-base text-slate-900">
                {editingCompany ? 'কোম্পানি প্রোফাইল পরিবর্তন' : 'নতুন প্রস্তুতকারক কোম্পানি সংযোজন'}
              </h3>
              <button onClick={() => setIsCompanyModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-4">
              {companyError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {companyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  কোম্পানি আইডি কোড *
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: COM04" 
                  value={companyIdInput}
                  onChange={(e) => setCompanyIdInput(e.target.value)}
                  disabled={!!editingCompany}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 disabled:bg-slate-100 py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  কোম্পানির নাম *
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: Unilever Bangladesh Ltd." 
                  value={companyNameInput}
                  onChange={(e) => setCompanyNameInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ফোন নম্বর
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: 09612345678" 
                  value={companyPhoneInput}
                  onChange={(e) => setCompanyPhoneInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  অফিস / ডিপো ঠিকানা
                </label>
                <textarea 
                  placeholder="যেমন: তেজগাঁও শিল্প এলাকা, ঢাকা" 
                  value={companyAddressInput}
                  onChange={(e) => setCompanyAddressInput(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              {!editingCompany && (
                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      প্রারম্ভিক জের (Opening Balance)
                    </label>
                    <input 
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={companyOpeningBalanceInput || ''}
                      onChange={(e) => setCompanyOpeningBalanceInput(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      জের এর ধরন (Balance Type)
                    </label>
                    <select
                      value={companyOpeningBalanceTypeInput}
                      onChange={(e) => setCompanyOpeningBalanceTypeInput(e.target.value as 'Payable' | 'Receivable')}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Payable">কোম্পানি পাবে (দেনা)</option>
                      <option value="Receivable">আমি পাব (পাওনা)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsCompanyModalOpen(false)} 
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 shadow-sm transition"
                >
                  <Save className="h-4 w-4" /> সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: SUPPLIER PAYMENT POSTING */}
      {/* ========================================================= */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-sans font-extrabold text-base text-slate-900 flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-indigo-600" /> সাপ্লায়ার দেনা ক্যাশ পরিশোধ
              </h3>
              <button onClick={() => setIsPayModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              {payError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {payError}
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>কোম্পানির নাম:</span>
                  <span className="font-bold text-slate-900">{selectedCompany?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>বর্তমান বকেয়া দেনা:</span>
                  <span className="font-bold text-indigo-700 font-mono">{formatBanglaCurrency(selectedCompany?.outstandingBalance || 0)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  পরিশোধের পরিমাণ (টাকা ৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input 
                    type="number" 
                    step="any"
                    placeholder="নগদ টাকা প্রদান" 
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm font-mono font-bold focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  পেমেন্ট তারিখ
                </label>
                <input 
                  type="date" 
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  রেফারেন্স / প্রদান মাধ্যম
                </label>
                <input 
                  type="text" 
                  placeholder="যেমন: ব্যাংক অ্যাকাউন্ট / এসআর মারফত নগদ প্রদান" 
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsPayModalOpen(false)} 
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 shadow-sm transition"
                >
                  ক্যাশ পেমেন্ট পোস্ট করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: INCENTIVE AND CLAIM ADJUSTMENT */}
      {/* ========================================================= */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-sans font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" /> ইনসেন্টিভ ও ক্লেইম এডজাস্টমেন্ট
              </h3>
              <button onClick={() => setIsAdjustmentModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4">
              {adjustmentError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {adjustmentError}
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>কোম্পানি:</span>
                  <span className="font-bold text-slate-900">{selectedCompany?.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  ক্লেইমের ধরণ (Claim Type) *
                </label>
                <select 
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as IncentiveType)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="Target Incentive">টার্গেট ইনসেন্টিভ (Target Incentive)</option>
                  <option value="Scheme Bonus">স্পেশাল স্কিম (Special Scheme)</option>
                  <option value="Manual Adjustment">ব্যালেন্স এডজাস্টমেন্ট (Balance Adjustment)</option>
                  <option value="Special Bonus">অন্যান্য (Other)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  টাকার পরিমাণ (Amount ৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input 
                    type="number" 
                    step="any"
                    placeholder="0.00" 
                    value={adjustmentAmount || ''}
                    onChange={(e) => setAdjustmentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm font-mono font-bold focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  রেফারেন্স / নোট (Reference / Note)
                </label>
                <input 
                  type="text" 
                  placeholder="বিস্তারিত লিখুন..." 
                  value={adjustmentRemarks}
                  onChange={(e) => setAdjustmentRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsAdjustmentModalOpen(false)} 
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 shadow-sm transition"
                >
                  সমন্বয় করুন (Adjust)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Print Modal */}
      <UniversalPrintModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={printType === 'demand' ? 'ডিমান্ড স্লিপ ও ডেলিভারি চালান' : printType === 'ledger' ? 'কোম্পানি স্টেটমেন্ট ও সাপ্লায়ার লেজার' : 'পারচেজ/ক্রয় স্লিপ'}
        type={printType as any}
        compName={compName}
        compAddress={compAddress}
        data={printData}
      />


    </div>
  );
}
