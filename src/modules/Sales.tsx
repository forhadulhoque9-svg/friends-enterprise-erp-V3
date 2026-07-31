import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, recordStockLedger, recordCashTransaction, postSalesInvoice } from '../db/db';
import { Product, Customer, SalesInvoice, Route, DSRShortLedgerEntry } from '../types';
import SalesInvoices from './SalesInvoices';
import { 
  Plus, 
  Trash2, 
  Printer, 
  ShoppingBag, 
  User, 
  Package, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Percent,
  Sparkles,
  Building2,
  Store,
  Calendar,
  Wallet,
  Clock,
  ShieldAlert,
  ArrowRightLeft,
  Receipt,
  Tag,
  Coins,
  FileText,
  Phone,
  RefreshCw,
  UserCheck,
  History
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

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  companyName: string;
  cartonQty: number;      // Carton Quantity
  pieceQty: number;       // Piece Quantity
  cartonSize: number;     // Pieces per carton
  baseQty: number;        // Total Pieces = (cartonQty * cartonSize) + pieceQty
  sellingPrice: number;   // Rate per piece
  discountPercent: number;
  totalSales: number;     // Total Amount = baseQty * sellingPrice - discount
  totalPurchaseCost: number;
}

export interface DamageItem {
  id: string;
  productId: string;
  productName: string;
  companyId?: string;
  companyName?: string;
  cartonQty: number;
  pieceQty: number;
  cartonSize: number;
  baseQty: number;        // Total Pieces
  purchasePrice: number;  // Cost price per piece
  damageValue: number;    // Total Damage Amount BDT
  reason: string;
}

export interface DueCustomerEntry {
  id: string;
  customerId: string;
  customerName: string;
  shopName: string;
  previousDue: number;   // From customer.outstandingBalance in DB
  todaysDue: number;     // Today's due assigned from this invoice
  collection: number;    // Today's cash collection from this customer
  remainingDue: number;  // previousDue + todaysDue - collection
}

export default function Sales() {
  // Sub-Tab Navigation State
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'history'>('create');

  // Live Database Queries
  const routes = useLiveQuery(() => db.routes.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const companies = useLiveQuery(() => db.companies.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const dsrList = useLiveQuery(() => db.salesmen.toArray());
  const businessProfiles = useLiveQuery(() => db.businessProfiles.toArray());

  // Configured Business Phone Number
  const configuredPhone = businessProfiles?.[0]?.phone || '০১৮৩৫৯১২৫৯৭';
  const configuredOwner = businessProfiles?.[0]?.owner || 'ফরহাদুল হক';
  const configuredBusinessName = businessProfiles?.[0]?.businessName || 'ফ্রেন্ডস এন্টারপ্রাইজ';

  // Invoice Information State
  const [invoiceNo, setInvoiceNo] = useState<string>(`FE-SL-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoiceTime, setInvoiceTime] = useState<string>(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
  const [selectedDsrId, setSelectedDsrId] = useState<string>('');
  const [dsrName, setDsrName] = useState<string>('');
  const [marketName, setMarketName] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');

  // Cart Items State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [flatDiscount, setFlatDiscount] = useState<number>(0);

  // Product Entry Draft State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [inputCartonQty, setInputCartonQty] = useState<number>(0);
  const [inputPieceQty, setInputPieceQty] = useState<number>(0);
  const [inputRate, setInputRate] = useState<number>(0);
  const [inputDiscount, setInputDiscount] = useState<number>(0);

  // Return / Damage State
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [selectedDamageProductId, setSelectedDamageProductId] = useState<string>('');
  const [inputDamageCartonQty, setInputDamageCartonQty] = useState<number>(0);
  const [inputDamagePieceQty, setInputDamagePieceQty] = useState<number>(1);
  const [inputDamageReason, setInputDamageReason] = useState<string>('প্যাকেট ক্ষতিগ্রস্ত / গলিত');

  // Multiple Dues State
  const [dueCustomers, setDueCustomers] = useState<DueCustomerEntry[]>([]);
  const [selectedDueCustomerId, setSelectedDueCustomerId] = useState<string>('');
  const [inputTodaysDue, setInputTodaysDue] = useState<number>(0);
  const [inputDueCollection, setInputDueCollection] = useState<number>(0);

  // DSR Short Field (Single Field Requirement)
  const [dsrShortage, setDsrShortage] = useState<number>(0);

  // Shop Commission State
  const [shopCommission, setShopCommission] = useState<number>(0);

  // Master / General Invoice Toggle State
  const [isMasterInvoice, setIsMasterInvoice] = useState<boolean>(true);

  // Operational Feedback & Printable Active Invoice
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<SalesInvoice | null>(null);

  // Current Lookups
  const currentDraftProduct = products?.find(p => p.id === selectedProductId);
  const currentDamageProduct = products?.find(p => p.id === selectedDamageProductId);
  const currentDueCustomer = customers?.find(c => c.id === selectedDueCustomerId);

  // Auto-set rate and default carton/piece when draft product selected
  useEffect(() => {
    if (currentDraftProduct) {
      setInputRate(currentDraftProduct.retailPrice || 0);
      if (inputCartonQty === 0 && inputPieceQty === 0) {
        setInputCartonQty(1);
        setInputPieceQty(0);
      }
    }
  }, [selectedProductId, currentDraftProduct]);

  // Auto-fill Route & Market
  useEffect(() => {
    if (selectedRouteId) {
      const selectedRoute = routes?.find(r => r.id === selectedRouteId);
      if (selectedRoute) {
        setMarketName(selectedRoute.marketName || selectedRoute.routeName || '');
      }
    }
  }, [selectedRouteId, routes]);

  // Generate new Invoice Number
  const handleRegenerateInvoiceNo = () => {
    setInvoiceNo(`FE-SL-${Date.now().toString().slice(-6)}`);
  };

  // Add Product Item to Cart (Supporting Carton & Piece simultaneously)
  const handleAddCartItem = () => {
    setErrorMsg('');
    if (!selectedProductId || !currentDraftProduct) {
      setErrorMsg('অনুগ্রহ করে একটি পণ্য নির্বাচন করুন।');
      return;
    }

    const cartonSize = currentDraftProduct.cartonSize && currentDraftProduct.cartonSize > 0 ? currentDraftProduct.cartonSize : 24;
    const totalPieces = (inputCartonQty * cartonSize) + inputPieceQty;

    if (totalPieces <= 0) {
      setErrorMsg('কার্টুন বা পিস পরিমাণ অন্তত ১ হতে হবে।');
      return;
    }

    if (totalPieces > currentDraftProduct.stock) {
      setErrorMsg(`স্টকে পর্যাপ্ত পণ্য নেই! বর্তমান স্টক: ${formatBanglaNumber(currentDraftProduct.stock)} পিস।`);
      return;
    }

    const matchedCompany = companies?.find(c => c.id === currentDraftProduct.companyId || c.name === currentDraftProduct.brand);
    const companyName = matchedCompany ? matchedCompany.name : (currentDraftProduct.brand || 'সাধারণ কোম্পানি');

    const sellingPrice = inputRate > 0 ? inputRate : (currentDraftProduct.retailPrice || 0);
    const purchasePrice = currentDraftProduct.edp || currentDraftProduct.purchasePrice || 0;
    
    const grossPrice = totalPieces * sellingPrice;
    const itemDiscountVal = (grossPrice * inputDiscount) / 100;
    const totalSales = Math.max(0, grossPrice - itemDiscountVal);
    const totalPurchaseCost = totalPieces * purchasePrice;

    const newItem: CartItem = {
      id: `cart_${Date.now()}_${selectedProductId}`,
      productId: selectedProductId,
      productName: currentDraftProduct.name,
      companyName,
      cartonQty: inputCartonQty,
      pieceQty: inputPieceQty,
      cartonSize,
      baseQty: totalPieces,
      sellingPrice,
      discountPercent: inputDiscount,
      totalSales,
      totalPurchaseCost
    };

    setCartItems(prev => [...prev, newItem]);

    // Reset product draft fields
    setSelectedProductId('');
    setInputCartonQty(0);
    setInputPieceQty(0);
    setInputRate(0);
    setInputDiscount(0);
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  // Add Damage Return Item
  const handleAddDamageItem = () => {
    setErrorMsg('');
    if (!selectedDamageProductId || !currentDamageProduct) {
      setErrorMsg('ড্যামেজ ফেরতের জন্য পণ্য নির্বাচন করুন।');
      return;
    }

    const cartonSize = currentDamageProduct.cartonSize && currentDamageProduct.cartonSize > 0 ? currentDamageProduct.cartonSize : 24;
    const totalPieces = (inputDamageCartonQty * cartonSize) + inputDamagePieceQty;

    if (totalPieces <= 0) {
      setErrorMsg('ড্যামেজ পরিমাণ অন্তত ১ হতে হবে।');
      return;
    }

    const matchedCompany = companies?.find(c => c.id === currentDamageProduct.companyId || c.name === currentDamageProduct.brand);
    const companyName = matchedCompany ? matchedCompany.name : (currentDamageProduct.brand || 'সাধারণ কোম্পানি');
    const purchasePrice = currentDamageProduct.edp || currentDamageProduct.purchasePrice || 0;
    const damageValue = totalPieces * purchasePrice;

    const newDamage: DamageItem = {
      id: `dmg_${Date.now()}_${selectedDamageProductId}`,
      productId: selectedDamageProductId,
      productName: currentDamageProduct.name,
      companyId: currentDamageProduct.companyId,
      companyName,
      cartonQty: inputDamageCartonQty,
      pieceQty: inputDamagePieceQty,
      cartonSize,
      baseQty: totalPieces,
      purchasePrice,
      damageValue,
      reason: inputDamageReason || 'প্যাকেট ক্ষতিগ্রস্ত'
    };

    setDamageItems(prev => [...prev, newDamage]);

    // Reset damage draft fields
    setSelectedDamageProductId('');
    setInputDamageCartonQty(0);
    setInputDamagePieceQty(1);
  };

  const handleRemoveDamageItem = (index: number) => {
    setDamageItems(prev => prev.filter((_, i) => i !== index));
  };

  // Add Due Customer Entry
  const handleAddDueCustomer = () => {
    setErrorMsg('');
    if (!selectedDueCustomerId || !currentDueCustomer) {
      setErrorMsg('অনুগ্রহ করে বাকি গ্রহণকারী কাস্টমার নির্বাচন করুন।');
      return;
    }

    if (inputTodaysDue <= 0 && inputDueCollection <= 0) {
      setErrorMsg('আজকের বাকির পরিমাণ বা সংগ্রহের পরিমাণ ০ টাকার বেশি হতে হবে।');
      return;
    }

    // Check if already added
    if (dueCustomers.some(d => d.customerId === selectedDueCustomerId)) {
      setErrorMsg('এই কাস্টমার ইতোমধ্যে বাকি তালিকায় যুক্ত আছেন।');
      return;
    }

    const previousDue = currentDueCustomer.outstandingBalance || 0;
    const remainingDue = previousDue + inputTodaysDue - inputDueCollection;

    const newDueEntry: DueCustomerEntry = {
      id: `due_${Date.now()}_${selectedDueCustomerId}`,
      customerId: selectedDueCustomerId,
      customerName: currentDueCustomer.name,
      shopName: currentDueCustomer.shopName || currentDueCustomer.name,
      previousDue,
      todaysDue: inputTodaysDue,
      collection: inputDueCollection,
      remainingDue
    };

    setDueCustomers(prev => [...prev, newDueEntry]);

    // Reset due customer selection
    setSelectedDueCustomerId('');
    setInputTodaysDue(0);
    setInputDueCollection(0);
  };

  const handleRemoveDueCustomer = (index: number) => {
    setDueCustomers(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const grossTotalSales = cartItems.reduce((acc, item) => acc + item.totalSales, 0);
  const totalDamageValue = damageItems.reduce((acc, item) => acc + item.damageValue, 0);
  
  // Net Sales formula: Gross Sales - Damage Return Amount - Discount
  const netTotalSales = Math.max(0, grossTotalSales - totalDamageValue - flatDiscount);
  const totalPurchaseCost = cartItems.reduce((acc, item) => acc + item.totalPurchaseCost, 0);

  // Total Dues from Due Customers Breakdown (Net Today's Due)
  const totalDue = dueCustomers.reduce((acc, item) => acc + Math.max(0, item.todaysDue - item.collection), 0);

  // Total Cash Collection = Net Sales - Total Due
  const totalCashCollected = Math.max(0, netTotalSales - totalDue);

  // Estimated Profit: Net Sales - Total Purchase Cost - Shop Commission
  const todayProfit = netTotalSales - totalPurchaseCost - shopCommission;

  // Post & Finalize Invoice
  const handlePostInvoice = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedDsrId && !dsrName) {
      setErrorMsg('ডিএসআর এর নাম বাধ্যতামূলক! অনুগ্রহ করে তালিকা থেকে নির্দিষ্ট ডিএসআর নির্বাচন করুন।');
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg('ইনভয়েসে অন্তত একটি পণ্য যুক্ত করুন।');
      return;
    }

    if (totalDue > netTotalSales) {
      setErrorMsg(`মোট বাকির পরিমাণ (${formatBanglaCurrency(totalDue)}) মোট বিক্রয়ের (${formatBanglaCurrency(netTotalSales)}) চেয়ে বেশি হতে পারে না!`);
      return;
    }

    setIsPosting(true);

    try {
      const invoiceId = `sales_inv_${Date.now()}`;
      const todayStr = invoiceDate || new Date().toISOString().split('T')[0];

      const matchedDsr = dsrList?.find(d => d.id === selectedDsrId);
      const finalDsrName = matchedDsr ? matchedDsr.name : (dsrName || 'N/A');

      // Build Master or Single Sales Invoice
      const invoiceData: SalesInvoice = {
        id: invoiceId,
        invoiceNo,
        customerId: dueCustomers[0]?.customerId || 'cash_customer',
        customerName: marketName 
          ? `${marketName}${customerName ? ` (${customerName})` : ''}` 
          : (customerName || (isMasterInvoice ? 'মাস্টার লোড ও বাল্ক ডেলিভারি' : 'বাজার বিক্রয়')),
        routeId: selectedRouteId || undefined,
        dsrId: selectedDsrId || undefined,
        dsrName: finalDsrName,
        salesmanId: selectedDsrId || undefined,
        deliveryManId: selectedDsrId || undefined,
        date: todayStr,
        isMasterInvoice,
        customerDuesBreakdown: dueCustomers.map(d => ({
          customerId: d.customerId,
          customerName: d.customerName,
          shopName: d.shopName,
          dueAmount: Math.max(0, d.todaysDue - d.collection),
          remarks: `পূর্বের বাকি: ৳${d.previousDue} | আজকের বাকি: ৳${d.todaysDue} | আদায়: ৳${d.collection} | অবশিষ্ট বাকি: ৳${d.remainingDue}`
        })),
        items: cartItems.map(item => ({
          productId: item.productId,
          name: `${item.productName} (${item.companyName})`,
          qty: item.baseQty,
          price: item.sellingPrice,
          discount: item.discountPercent,
          total: item.totalSales,
          isFree: false
        })),
        subTotal: grossTotalSales,
        discount: flatDiscount + totalDamageValue,
        netTotal: netTotalSales,
        cashPaid: totalCashCollected,
        dueAmount: totalDue,
        outstandingBalanceBefore: 0,
        outstandingBalanceAfter: totalDue,
        remarks: `সময়: ${invoiceTime} | ডিএসআর: ${finalDsrName} | বাজার: ${marketName || 'সাধারণ'} | কাস্টমার: ${customerName || 'N/A'} ${customerMobile ? `(${customerMobile})` : ''} | ড্যামেজ: ৳${totalDamageValue} | দোকান কমিশন: ৳${shopCommission}`
      };

      // Process Damage Returns if any exist
      if (damageItems.length > 0) {
        for (const dmg of damageItems) {
          await db.companyDamages.add({
            id: `dmg_${Date.now()}_${dmg.productId}`,
            companyId: dmg.companyId || 'company_default',
            companyName: dmg.companyName || 'কোম্পানি',
            productId: dmg.productId,
            productName: dmg.productName,
            qty: dmg.baseQty,
            damageValue: dmg.damageValue,
            status: 'Pending',
            date: todayStr,
            remarks: `ড্যামেজ ফেরত (ইনভয়েস #${invoiceNo}): ${marketName || 'বাজার'} (${dmg.reason})`
          });

          await db.stockLedgers.add({
            id: `st_damage_${invoiceId}_${dmg.productId}_${Date.now()}`,
            productId: dmg.productId,
            productName: dmg.productName,
            date: todayStr,
            type: 'Damage',
            refId: invoiceId,
            qtyIn: dmg.baseQty,
            qtyOut: 0,
            balance: 0,
            remarks: `ড্যামেজ ফেরত গ্রহণ: ${dmg.baseQty} পিস (${marketName || 'বাজার'})`
          });
        }
      }

      // Execute central transaction engine for stock, cash, and customer ledger posting
      await postSalesInvoice(invoiceData);

      // Auto-tag DSR Shortage against assigned DSR for automatic payroll sync
      if (dsrShortage > 0 && selectedDsrId && matchedDsr) {
        const shortEntry: DSRShortLedgerEntry = {
          id: `short_${invoiceId}`,
          dsrId: selectedDsrId,
          dsrName: matchedDsr.name,
          date: todayStr,
          expectedAmount: totalCashCollected + dsrShortage,
          submittedAmount: totalCashCollected,
          shortAmount: dsrShortage,
          refInvoiceId: invoiceId,
          refInvoiceNo: invoiceNo,
          status: 'Pending',
          remarks: `সেলস ইনভয়েস #${invoiceNo} থেকে ডে-এন্ড শর্টেজ (${marketName || 'বাজার'})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.dsrShortLedgers.add(shortEntry);
      }

      setActiveInvoice(invoiceData);
      setSuccessMsg(`ইনভয়েস #${invoiceNo} সফলভাবে পোস্ট করা হয়েছে!${dsrShortage > 0 ? ` (ডিএসআর শর্টেজ ৳${formatBanglaNumber(dsrShortage)} পে-রোলে সিঙ্ক হয়েছে)` : ''}`);
      
      // Clear Invoice Form
      setCartItems([]);
      setDamageItems([]);
      setDueCustomers([]);
      setFlatDiscount(0);
      setShopCommission(0);
      setDsrShortage(0);
      setMarketName('');
      setCustomerName('');
      setCustomerMobile('');
      setSelectedRouteId('');
      handleRegenerateInvoiceNo();
    } catch (err: any) {
      setErrorMsg(err.message || 'ইনভয়েস সেভ করার সময় ত্রুটি ঘটেছে।');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12" id="sales-module">
      
      {/* =========================================
          PREMIUM BRANDING HEADER (Screen & Print)
         ========================================= */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 text-white shadow-md border border-emerald-700/40 text-center space-y-2 relative overflow-hidden print:hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400"></div>
        
        {/* Bismillah Header */}
        <p className="font-serif text-sm sm:text-base font-bold text-amber-300 tracking-widest drop-shadow-xs">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>

        {/* Company Name */}
        <h1 className="font-black text-2xl sm:text-3xl text-white tracking-wide uppercase font-sans">
          {configuredBusinessName}
        </h1>

        {/* Owner & Phone Info */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-emerald-100/90 font-medium pt-0.5">
          <span>পরিচালনায়: <b>{configuredOwner}</b></span>
          <span className="hidden sm:inline text-emerald-400">•</span>
          <span className="flex items-center gap-1 font-bold text-amber-200">
            <Phone className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            মোবাইল: {configuredPhone}
          </span>
        </div>

        {/* Title Badge */}
        <div className="pt-2">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-1 rounded-full text-xs font-black uppercase tracking-widest text-emerald-200 border border-emerald-400/30 shadow-inner">
            <Receipt className="h-3.5 w-3.5 text-amber-300" />
            Sales Invoice (সেলস ইনভয়েস)
          </span>
        </div>
      </div>

      {/* Sub-Tab Switcher Navigation */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <button 
          onClick={() => setActiveSubTab('create')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'create' 
              ? 'bg-emerald-800 text-white shadow-sm font-black' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Plus className="h-4 w-4" />
          নতুন ইনভয়েস তৈরি (New Invoice)
        </button>

        <button 
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'history' 
              ? 'bg-emerald-800 text-white shadow-sm font-black' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <History className="h-4 w-4" />
          বিক্রয় ইনভয়েস ফিল্টার ও ইতিহাস (Sales Invoices & Filters)
        </button>
      </div>

      {/* RENDER INVOICE HISTORY TAB */}
      {activeSubTab === 'history' ? (
        <SalesInvoices />
      ) : (

      /* Main Form Layout Grid */
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        
        {/* LEFT 2 COLS: Invoice Info, Product Entry, Damage Return, Multiple Dues */}
        <div className="lg:col-span-2 space-y-6">

          {/* =========================================
              ১. ইনভয়েস তথ্য (INVOICE INFORMATION)
             ========================================= */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-700 p-2 text-white shadow-xs">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-sans font-black text-base text-slate-900 tracking-wide">
                    ১. ইনভয়েস তথ্য (Invoice Information)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    মেমো নম্বর, তারিখ, সময়, ডিএসআর ও বাজারের বিস্তারিত বিবরণ
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                হেডার তথ্য
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              
              {/* Invoice No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>ইনভয়েস নম্বর (Invoice No)</span>
                  <button 
                    type="button" 
                    onClick={handleRegenerateInvoiceNo}
                    className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> নতুন
                  </button>
                </label>
                <input 
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-black text-indigo-950 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  তারিখ (Date) <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সময় (Time)
                </label>
                <input 
                  type="text"
                  value={invoiceTime}
                  onChange={(e) => setInvoiceTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* DSR Name (Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>ডিএসআর এর নাম (DSR Name) <span className="text-rose-600 font-extrabold">*</span></span>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Mandatory</span>
                </label>
                <select
                  value={selectedDsrId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedDsrId(id);
                    const matched = dsrList?.find(d => d.id === id);
                    if (matched) {
                      setDsrName(matched.name);
                    }
                  }}
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50/20 py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                >
                  <option value="">-- ডিএসআর নির্বাচন করুন --</option>
                  {dsrList?.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.designation ? `(${d.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Route & Market Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  রুট ও বাজারের নাম (Market Name) <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  <select 
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                    className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 py-2 px-2 text-[11px] font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none shrink-0"
                  >
                    <option value="">-- রুট বেছে নিন --</option>
                    {routes?.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.routeName}
                      </option>
                    ))}
                  </select>
                  <input 
                    type="text"
                    placeholder="বাজারের নাম"
                    value={marketName}
                    onChange={(e) => setMarketName(e.target.value)}
                    className="w-1/2 rounded-xl border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  কাস্টমারের নাম (Customer Name)
                </label>
                <input 
                  type="text"
                  placeholder="যেমন: রহিমপুর বাজার দোকানসমূহ"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Customer Mobile (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  কাস্টমার মোবাইল (Customer Mobile) <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                </label>
                <input 
                  type="text"
                  placeholder="যেমন: 01711000000"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

            </div>
          </div>

          {/* =========================================
              ২. পণ্য ভুক্তি (PRODUCT ENTRY - Carton & Piece)
             ========================================= */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-700 p-2 text-white shadow-xs">
                  <Package className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-sans font-black text-base text-slate-900 tracking-wide">
                    ২. পণ্য ভুক্তি (Product Entry - Carton & Piece Sales)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    কার্টুন ও পিস উভয়ই স্বাধীনভাবে ইনপুট করুন। মোট পিস ও বিক্রয় মূল্য স্বয়ংসক্রিয়ভাবে হিসাব হবে।
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                স্বাধীন কার্টুন + পিস
              </span>
            </div>

            {/* Product Draft Add Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-2xs">
              
              {/* Product Selector */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  পণ্য নির্বাচন (Select Product)
                </label>
                <select 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- পণ্য নির্বাচন করুন --</option>
                  {products?.map(p => {
                    const matchedCompany = companies?.find(c => c.id === p.companyId || c.name === p.brand);
                    const compName = matchedCompany ? matchedCompany.name : (p.brand || '');
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {compName ? `[${compName}]` : ''} (স্টক: {formatBanglaNumber(p.stock)} পিস)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Carton Qty Input */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  কার্টুন (Carton)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={inputCartonQty}
                  onChange={(e) => setInputCartonQty(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-indigo-300 bg-indigo-50/30 py-2 px-2 text-xs font-black text-center text-indigo-950 focus:border-indigo-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Piece Qty Input */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  পিস (Piece)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={inputPieceQty}
                  onChange={(e) => setInputPieceQty(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-indigo-300 bg-indigo-50/30 py-2 px-2 text-xs font-black text-center text-indigo-950 focus:border-indigo-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Rate per Piece */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  দর / MRP (৳)
                </label>
                <input 
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={inputRate || ''}
                  onChange={(e) => setInputRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-center text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Disc % */}
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ছাড় %
                </label>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={inputDiscount || ''}
                  onChange={(e) => setInputDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-1 text-xs font-bold text-center text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-1">
                <button 
                  type="button"
                  onClick={handleAddCartItem}
                  className="w-full flex h-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition font-bold cursor-pointer"
                  title="পণ্য যোগ করুন"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>

            </div>

            {/* Display Selected Draft Product Live Preview Box */}
            {currentDraftProduct && (() => {
              const cartonSize = currentDraftProduct.cartonSize && currentDraftProduct.cartonSize > 0 ? currentDraftProduct.cartonSize : 24;
              const totalPieces = (inputCartonQty * cartonSize) + inputPieceQty;
              const sellingPrice = inputRate > 0 ? inputRate : (currentDraftProduct.retailPrice || 0);
              const totalAmount = totalPieces * sellingPrice;

              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-indigo-50/80 border border-indigo-200/90 px-4 py-2.5 rounded-xl text-indigo-950 font-medium gap-2 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-indigo-900">{currentDraftProduct.name}</span>
                    <span className="text-[11px] text-slate-600">
                      (১ কার্টুন = {toBanglaNumerals(cartonSize)} পিস)
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span>কার্টুন: <b className="text-indigo-900">{toBanglaNumerals(inputCartonQty)}</b></span>
                    <span>পিস: <b className="text-indigo-900">{toBanglaNumerals(inputPieceQty)}</b></span>
                    <span className="text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200">
                      মোট পিস: <b>{toBanglaNumerals(totalPieces)} পিস</b>
                    </span>
                    <span className="text-indigo-950 bg-white px-2.5 py-0.5 rounded-md border border-indigo-200 shadow-2xs">
                      মোট মূল্য: <b>{formatBanglaCurrency(totalAmount)}</b>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Cart Items Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
                    <th className="py-2.5 px-3">ক্রম</th>
                    <th className="py-2.5 px-3">পণ্য ও কোম্পানি</th>
                    <th className="py-2.5 px-3 text-center">কার্টুন</th>
                    <th className="py-2.5 px-3 text-center">পিস</th>
                    <th className="py-2.5 px-3 text-center">মোট পিস</th>
                    <th className="py-2.5 px-3 text-right">একক মূল্য</th>
                    <th className="py-2.5 px-3 text-right">মোট বিক্রয়</th>
                    <th className="py-2.5 px-3 text-center">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">
                        এখনো কোনো পণ্য কার্টে যোগ করা হয়নি। উপরের ফরম থেকে কার্টুন ও পিস ইনপুট দিয়ে যোগ করুন।
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-500">{toBanglaNumerals(idx + 1)}</td>
                        <td className="py-2.5 px-3 font-bold">
                          <div className="text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{item.companyName}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-900 bg-indigo-50/30">
                          {formatBanglaNumber(item.cartonQty)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-900 bg-indigo-50/30">
                          {formatBanglaNumber(item.pieceQty)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-emerald-800 bg-emerald-50/30">
                          {formatBanglaNumber(item.baseQty)} পিস
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {formatBanglaCurrency(item.sellingPrice)}
                          {item.discountPercent > 0 && (
                            <span className="block text-[9px] text-rose-600">(-{toBanglaNumerals(item.discountPercent)}%)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-indigo-950">
                          {formatBanglaCurrency(item.totalSales)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button 
                            type="button"
                            onClick={() => handleRemoveCartItem(idx)}
                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
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
          </div>

          {/* =========================================
              ৩. ড্যামেজ ফেরত (RETURN / DAMAGE)
             ========================================= */}
          <div className="rounded-2xl border border-rose-200/90 bg-rose-50/30 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-rose-600 p-2 text-white shadow-xs">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-sans font-black text-base text-rose-950 tracking-wide">
                    ৩. ড্যামেজ ফেরত (Damage Return)
                  </h2>
                  <p className="text-[11px] text-rose-700 font-medium">
                    ফেরতকৃত পণ্য ড্যামেজ স্টকে জমা হবে এবং ইনভয়েসের মোট মূল্য থেকে বিয়োগ হবে।
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-3 py-1 rounded-full border border-rose-200">
                স্বয়ংক্রিয় বিয়োগ
              </span>
            </div>

            {/* Damage Add Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-2xs">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ড্যামেজ পণ্য নির্বাচন
                </label>
                <select 
                  value={selectedDamageProductId}
                  onChange={(e) => setSelectedDamageProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-rose-500 focus:outline-none"
                >
                  <option value="">-- ড্যামেজ পণ্য নির্বাচন করুন --</option>
                  {products?.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  কার্টুন
                </label>
                <input 
                  type="number"
                  min="0"
                  value={inputDamageCartonQty}
                  onChange={(e) => setInputDamageCartonQty(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-center focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  পিস
                </label>
                <input 
                  type="number"
                  min="0"
                  value={inputDamagePieceQty}
                  onChange={(e) => setInputDamagePieceQty(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-xs font-black text-center focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ফেরতের কারণ
                </label>
                <input 
                  type="text"
                  value={inputDamageReason}
                  onChange={(e) => setInputDamageReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <button 
                  type="button"
                  onClick={handleAddDamageItem}
                  className="w-full flex h-9 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition font-bold cursor-pointer"
                  title="ড্যামেজ যোগ করুন"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Damage List Table */}
            {damageItems.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-rose-50 border-b border-rose-100 text-rose-900 text-[11px] font-bold">
                      <th className="py-2 px-3">পণ্যের নাম</th>
                      <th className="py-2 px-3 text-center">কার্টুন / পিস</th>
                      <th className="py-2 px-3 text-center">মোট পিস</th>
                      <th className="py-2 px-3 text-right">ড্যামেজ মূল্য (ক্রয়মূল্য)</th>
                      <th className="py-2 px-3">কারণ</th>
                      <th className="py-2 px-3 text-center">মুছুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 text-xs text-slate-800">
                    {damageItems.map((dmg, idx) => (
                      <tr key={dmg.id}>
                        <td className="py-2 px-3 font-bold">{dmg.productName}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-700">
                          {toBanglaNumerals(dmg.cartonQty)} কার্টুন, {toBanglaNumerals(dmg.pieceQty)} পিস
                        </td>
                        <td className="py-2 px-3 text-center font-extrabold text-rose-700">
                          {formatBanglaNumber(dmg.baseQty)} পিস
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-900">
                          {formatBanglaCurrency(dmg.damageValue)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{dmg.reason}</td>
                        <td className="py-2 px-3 text-center">
                          <button 
                            type="button"
                            onClick={() => handleRemoveDamageItem(idx)}
                            className="text-rose-600 hover:bg-rose-100 p-1 rounded cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* =========================================
              ৪. মাল্টিপল কাস্টমার বাকি (MULTIPLE DUES)
             ========================================= */}
          <div className="rounded-2xl border border-amber-200/90 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-100 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-600 p-2 text-white shadow-xs">
                  <UserCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-sans font-black text-base text-slate-900 tracking-wide">
                    ৪. মাল্টিপল কাস্টমার বাকি (Multiple Due Customers Support)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    একই বাজারের অধীনস্থ বিভিন্ন দোকানদারদের পূর্বের বাকি, আজকের বাকি ও সংগ্রহের পৃথক হিসাব
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 self-start sm:self-auto">
                দোকানদার বাকির তালিকা
              </span>
            </div>

            {/* Add Due Customer Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
              
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  দোকান / কাস্টমার নির্বাচন করুন
                </label>
                <select 
                  value={selectedDueCustomerId}
                  onChange={(e) => setSelectedDueCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- কাস্টমার / দোকান বেছে নিন --</option>
                  {customers?.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.shopName || c.name} ({c.name} • পূর্বের বাকি: ৳{toBanglaNumerals(c.outstandingBalance || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Previous Due Display */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  পূর্বের বাকি
                </label>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-100 py-2 px-2 text-xs font-black text-slate-700 text-center">
                  {formatBanglaCurrency(currentDueCustomer?.outstandingBalance || 0)}
                </div>
              </div>

              {/* Today's Due Input */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  আজকের বাকি (৳)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={inputTodaysDue || ''}
                  onChange={(e) => setInputTodaysDue(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50/50 py-2 px-2 text-xs font-black text-amber-950 text-center focus:border-amber-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Today's Collection Input */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  আজকের আদায় (Collection ৳)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={inputDueCollection || ''}
                  onChange={(e) => setInputDueCollection(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50/50 py-2 px-2 text-xs font-black text-emerald-950 text-center focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <button 
                  type="button"
                  onClick={handleAddDueCustomer}
                  className="w-full flex h-9 items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition font-bold cursor-pointer"
                  title="বাকি কাস্টমার যুক্ত করুন"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>

            </div>

            {/* Due Customers Breakdown Table */}
            {dueCustomers.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-amber-600 text-white text-[11px] font-bold">
                      <th className="py-2.5 px-3">দোকানের নাম</th>
                      <th className="py-2.5 px-3">মালিকের নাম</th>
                      <th className="py-2.5 px-3 text-right">পূর্বের বাকি</th>
                      <th className="py-2.5 px-3 text-right">আজকের বাকি</th>
                      <th className="py-2.5 px-3 text-right">আজকের আদায়</th>
                      <th className="py-2.5 px-3 text-right">অবশিষ্ট বাকি</th>
                      <th className="py-2.5 px-3 text-center">মুছুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                    {dueCustomers.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-amber-50/30">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{d.shopName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{d.customerName}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-600">
                          {formatBanglaCurrency(d.previousDue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-amber-900">
                          {formatBanglaCurrency(d.todaysDue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-800">
                          {formatBanglaCurrency(d.collection)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-indigo-950 bg-amber-50/40">
                          {formatBanglaCurrency(d.remainingDue)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button 
                            type="button"
                            onClick={() => handleRemoveDueCustomer(idx)}
                            className="text-rose-600 hover:bg-rose-50 p-1 rounded transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 font-medium">
                কোনো কাস্টমার বাকি না থাকলে এটি খালি রাখুন (সম্পূর্ণ নগদ বিক্রি)
              </div>
            )}
          </div>

          {/* =========================================
              ৫. ডিএসআর শর্টেজ (DSR SHORT AMOUNT)
             ========================================= */}
          <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-rose-700 p-2 text-white shadow-xs">
                  <Wallet className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-sans font-black text-base text-slate-900 tracking-wide">
                    ৫. ডিএসআর শর্টেজ (DSR Short Amount)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    ডিএসআর ডেলিভারি শেষে এই শর্টেজ তৈরি হলে তা পে-রোলে স্বয়ংক্রিয়ভাবে যোগ হবে।
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                Single Field
              </span>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
                <span>ডিএসআর শর্টেজ পরিমাণ (DSR Shortage ৳)</span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Auto-Payroll Sync</span>
              </label>
              <input 
                type="number"
                min="0"
                placeholder="যেমন: ৫০০"
                value={dsrShortage || ''}
                onChange={(e) => setDsrShortage(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-rose-300 bg-rose-50/20 py-2.5 px-3 text-sm font-black text-rose-950 focus:border-rose-600 focus:bg-white focus:outline-none"
              />
              <span className="text-[10px] text-rose-600 mt-1 block font-medium">
                পরবর্তীতে এই শর্টেজ স্বয়ংক্রিয়ভাবে ডিএসআর বেতন (DSR Salary) মডিউলে কর্তন করা হবে।
              </span>
            </div>
          </div>

        </div>

        {/* RIGHT 1 COL: INVOICE SUMMARY & FINANCIALS */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* =========================================
              ৬. ইনভয়েস সামারি (INVOICE SUMMARY)
             ========================================= */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4 sticky top-6">
            <h2 className="font-sans font-black text-base text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-700" />
              ইনভয়েস সামারি (Financial Summary)
            </h2>

            <div className="space-y-3 text-xs">
              
              {/* Gross Sales */}
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-600">Gross Sales (মোট বিক্রি):</span>
                <span className="font-black text-slate-900 text-sm">
                  {formatBanglaCurrency(grossTotalSales)}
                </span>
              </div>

              {/* Damage Return */}
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-rose-700">
                <span className="font-bold">Damage Return (ড্যামেজ ফেরত):</span>
                <span className="font-black">
                  - {formatBanglaCurrency(totalDamageValue)}
                </span>
              </div>

              {/* Discount Input */}
              <div className="py-1 border-b border-slate-100">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Discount (ইনভয়েস ছাড় ৳)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={flatDiscount || ''}
                  onChange={(e) => setFlatDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Net Sales */}
              <div className="flex justify-between items-center py-2.5 bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="font-black text-emerald-950 text-xs">Net Sales (সর্বমোট নিট বিক্রি):</span>
                <span className="font-black text-emerald-900 text-base">
                  {formatBanglaCurrency(netTotalSales)}
                </span>
              </div>

              {/* Shop Commission Input */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  দোকান কমিশন (Shop Commission ৳)
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="0"
                  value={shopCommission || ''}
                  onChange={(e) => setShopCommission(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-indigo-200 bg-indigo-50/30 py-2 px-3 text-xs font-black text-indigo-950 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Due & Collection Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-900">Due (মোট বাকি):</span>
                  <span className="font-black text-amber-950 text-sm">{formatBanglaCurrency(totalDue)}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-900">Collection (নগদ আদায়):</span>
                  <span className="font-black text-emerald-950 text-sm">{formatBanglaCurrency(totalCashCollected)}</span>
                </div>
              </div>

              {/* Estimated Profit Card */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-800 to-teal-900 p-4 text-white shadow-xs space-y-1 mt-3">
                <div className="flex items-center justify-between text-emerald-200 text-[11px] font-bold">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Estimated Profit (আনুমানিক লাভ)
                  </span>
                  <span className="text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded">Auto Calculated</span>
                </div>
                <div className="text-xl font-black tracking-tight text-white pt-1">
                  {formatBanglaCurrency(todayProfit)}
                </div>
                <p className="text-[10px] text-emerald-200/90 border-t border-emerald-700/60 pt-1 mt-1">
                  Net Sales - COGS ({formatBanglaCurrency(totalPurchaseCost)}) - Shop Commission ({formatBanglaCurrency(shopCommission)})
                </p>
              </div>

            </div>

            {/* Operational Messages */}
            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Post Invoice Action Button */}
            <button 
              type="button"
              disabled={isPosting}
              onClick={handlePostInvoice}
              className="w-full flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 shadow-md transition font-extrabold text-sm tracking-wide disabled:opacity-50 cursor-pointer"
            >
              <Coins className="h-5 w-5" />
              {isPosting ? 'সেভ হচ্ছে...' : 'ইনভয়েস সেভ ও পোস্ট করুন'}
            </button>

            {/* Print Memo Button */}
            {activeInvoice && (
              <button 
                type="button"
                onClick={handlePrint}
                className="w-full flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition font-bold text-xs cursor-pointer shadow-xs"
              >
                <Printer className="h-4 w-4" />
                মেমো প্রিন্ট করুন (Print Invoice)
              </button>
            )}

          </div>

        </div>

      </div>
      )}

      {/* =========================================
          FULL PRINTABLE MEMO & PDF VIEW
         ========================================= */}
      {activeInvoice && (
        <div className="hidden print:block absolute inset-0 bg-white text-black p-8 font-sans space-y-6 z-[100] h-screen w-screen" id="printable-invoice">
          
          {/* Header */}
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

          {/* Memo Information Grid */}
          <div className="grid grid-cols-2 gap-4 border-b border-slate-300 pb-3 text-xs">
            <div>
              <span className="font-bold text-slate-600 block">ইনভয়েস নং:</span>
              <span className="font-black text-sm text-slate-900">{toBanglaNumerals(activeInvoice.invoiceNo)}</span>
              <span className="font-bold text-slate-600 block mt-1">ডিএসআর নাম:</span>
              <span className="font-bold text-slate-900">{activeInvoice.dsrName || 'N/A'}</span>
              <span className="font-bold text-slate-600 block mt-1">বাজার / রুট:</span>
              <span className="font-bold text-slate-900">{activeInvoice.customerName}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-600 block">তারিখ:</span>
              <span className="font-bold text-slate-900">{formatBanglaDate(activeInvoice.date)}</span>
              <span className="font-bold text-slate-600 block mt-1">নোট / কৈফিয়ত:</span>
              <span className="text-slate-800 font-semibold">{activeInvoice.remarks}</span>
            </div>
          </div>

          {/* Products Table */}
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
                {activeInvoice.items.map((item, idx) => (
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

          {/* Customer Dues Breakdown Section */}
          {activeInvoice.customerDuesBreakdown && activeInvoice.customerDuesBreakdown.length > 0 && (
            <div className="border-t border-slate-300 pt-3">
              <h3 className="font-bold text-xs uppercase mb-1.5 border-b border-slate-800 pb-1 text-slate-900">
                মাল্টিপল কাস্টমার বাকি ব্রেকডাউন (Customer Due Allocations)
              </h3>
              <table className="w-full text-left border-collapse my-1 text-xs">
                <thead>
                  <tr className="border-b border-slate-400 text-[10px] font-bold bg-slate-100">
                    <th className="py-1 px-2">দোকানের নাম</th>
                    <th className="py-1 px-2">মালিকের নাম</th>
                    <th className="py-1 px-2 text-right">নির্ধারিত বাকি</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeInvoice.customerDuesBreakdown.map((due, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2 font-bold">{due.shopName || due.customerName}</td>
                      <td className="py-1 px-2 text-slate-600">{due.customerName}</td>
                      <td className="py-1 px-2 text-right font-black">{formatBanglaCurrency(due.dueAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Financial Summary Box */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300">
            <div className="text-xs space-y-1 bg-slate-50 p-3 rounded border border-slate-200">
              <span className="font-bold block text-slate-800">পরিশোধ বিবরণী:</span>
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span>নগদ আদায় (Collection):</span>
                <span className="font-bold">{formatBanglaCurrency(activeInvoice.cashPaid)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>মোট বাকি (Due):</span>
                <span className="font-bold text-rose-700">{formatBanglaCurrency(activeInvoice.dueAmount || 0)}</span>
              </div>
            </div>

            <div className="text-xs space-y-1.5 font-semibold text-slate-800">
              <div className="flex justify-between">
                <span>Gross Sales:</span>
                <span>{formatBanglaCurrency(activeInvoice.subTotal)}</span>
              </div>
              {activeInvoice.discount > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>ছাড় / ড্যামেজ:</span>
                  <span>- {formatBanglaCurrency(activeInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-slate-900 pt-1 font-black text-sm">
                <span>Net Sales (সর্বমোট পরিশোধযোগ্য):</span>
                <span>{formatBanglaCurrency(activeInvoice.netTotal)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
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
