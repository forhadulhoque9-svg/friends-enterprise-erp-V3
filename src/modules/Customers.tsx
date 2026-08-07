import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, postCustomerPayment } from '../db/db';
import { Customer } from '../types';
import { 
  Search, 
  User, 
  CreditCard, 
  Save, 
  X, 
  Printer, 
  CheckCircle2, 
  Coins, 
  Plus, 
  FileText, 
  Receipt,
  Store,
  Calendar,
  AlertCircle,
  Building2,
  DollarSign
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
  if (!dateString) return '—';
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

export default function Customers() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active selected retailer ID
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Collection Entry Form States
  const [inputCollectionAmount, setInputCollectionAmount] = useState<number>(0);
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [collectionRemarks, setCollectionRemarks] = useState<string>('নগদ আদায়');
  const [isSubmittingCollection, setIsSubmittingCollection] = useState<boolean>(false);
  const [collectionError, setCollectionError] = useState<string>('');

  // Add Retailer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustId, setNewCustId] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [addCustError, setAddCustError] = useState('');

  // Receipt Modal State (রশিদ)
  const [activeReceipt, setActiveReceipt] = useState<{
    shopName: string;
    date: string;
    collectedAmount: number;
    remainingDue: number;
    remarks: string;
  } | null>(null);

  // Database Live Queries
  const customers = useLiveQuery(() => db.customers.toArray());
  const selectedCustomer = useLiveQuery(() => 
    selectedCustomerId ? db.customers.get(selectedCustomerId) : Promise.resolve(undefined),
    [selectedCustomerId]
  );

  const selectedCustomerLedger = useLiveQuery(async () => {
    if (!selectedCustomerId) return [];
    try {
      const data = await db.customerLedgers.where('customerId').equals(selectedCustomerId).toArray();
      return data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } catch (err) {
      console.error('Customer ledger fetch error:', err);
      return [];
    }
  }, [selectedCustomerId]) || [];

  const allLedgers = useLiveQuery(() => db.customerLedgers.toArray());

  // Filter customers by Shop Name (দোকানের নাম) or Phone/ID
  const filteredCustomers = (customers || []).filter(c => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || 
           (c.phone && c.phone.includes(q)) || 
           (c.id && c.id.toLowerCase().includes(q));
  });

  // Calculate Dashboard Summary KPIs
  const totalMarketDue = (customers || []).reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalDueCustomers = (customers || []).filter(c => (c.outstandingBalance || 0) > 0).length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCollectionTotal = (allLedgers || [])
    .filter(l => l.date === todayStr && l.type === 'Payment')
    .reduce((sum, l) => sum + (l.credit || 0), 0);

  // Latest collection date for selected customer
  const lastCollectionEntry = (selectedCustomerLedger || [])
    .slice()
    .reverse()
    .find(l => l.type === 'Payment');
  const lastCollectionDate = lastCollectionEntry ? lastCollectionEntry.date : null;

  // Handle Cash Collection Posting
  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedCustomer) return;

    if (inputCollectionAmount <= 0) {
      setCollectionError('অনুগ্রহ করে সঠিক আদায়ের পরিমাণ প্রদান করুন (০ এর বেশি হতে হবে)।');
      return;
    }

    setIsSubmittingCollection(true);
    setCollectionError('');

    try {
      const currentDue = selectedCustomer.outstandingBalance || 0;
      
      // Save payment transaction atomically (updates Ledger, Cash Book, Dashboard Cash, and Total Market Due)
      await postCustomerPayment(
        selectedCustomerId,
        inputCollectionAmount,
        collectionDate,
        collectionRemarks || 'নগদ আদায়'
      );

      const remainingDue = Math.max(0, currentDue - inputCollectionAmount);

      // Generate Receipt Data
      setActiveReceipt({
        shopName: selectedCustomer.name,
        date: collectionDate,
        collectedAmount: inputCollectionAmount,
        remainingDue: remainingDue,
        remarks: collectionRemarks || 'নগদ আদায়'
      });

      // Reset collection input
      setInputCollectionAmount(0);
      setCollectionRemarks('নগদ আদায়');
    } catch (err: any) {
      setCollectionError(err.message || 'আদায় সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setIsSubmittingCollection(false);
    }
  };

  // Quick fill for full payment
  const handleSetFullCollection = () => {
    if (selectedCustomer) {
      setInputCollectionAmount(Math.max(0, selectedCustomer.outstandingBalance || 0));
    }
  };

  // Add new retailer shop
  const handleSaveNewRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCustError('');

    if (!newCustName.trim()) {
      setAddCustError('দোকানের নাম প্রদান করা আবশ্যক।');
      return;
    }

    try {
      const id = newCustId.trim() || `CUST_${Date.now()}`;
      const exists = await db.customers.get(id);
      if (exists) {
        setAddCustError('এই আইডির দোকান ইতোমধ্যে নিবন্ধিত আছে।');
        return;
      }

      await db.customers.add({
        id,
        name: newCustName.trim(),
        phone: newCustPhone.trim() || '',
        address: newCustAddress.trim() || '',
        creditLimit: 0,
        outstandingBalance: 0
      });

      setSelectedCustomerId(id);
      setIsAddModalOpen(false);
      setNewCustId('');
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
    } catch (err: any) {
      setAddCustError(err.message || 'দোকান নিবন্ধনে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="space-y-6 pb-12" id="collection-module">
      
      {/* Top Banner Header */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 p-5 text-white shadow-sm border border-emerald-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-emerald-400" />
            <h1 className="font-sans font-black text-xl sm:text-2xl text-white">
              বকেয়া টাকা আদায় ও কালেকশন মডিউল (Collection)
            </h1>
          </div>
          <p className="font-sans text-xs text-emerald-200 mt-1">
            ফ্রেন্ডস এন্টারপ্রাইজ • রিটেইলার বকেয়া খাতা ও ক্যাশ আদায়
          </p>
        </div>

        <button
          onClick={() => {
            setNewCustId(`C${(customers || []).length + 1}`);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-xs transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন দোকান যোগ করুন</span>
        </button>
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* মোট বকেয়া খদ্দের */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">বকেয়া দোকান সংখ্যা</span>
            <div className="rounded-lg bg-amber-200/80 p-2 text-amber-800">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-amber-950 block">
              {formatBanglaNumber(totalDueCustomers)} টি দোকান
            </span>
            <p className="text-[10px] text-amber-700 mt-0.5">মার্কেটে বাকি রয়েছে</p>
          </div>
        </div>

        {/* মোট মার্কেট বাকি */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">মোট মার্কেট বাকি</span>
            <div className="rounded-lg bg-rose-200/80 p-2 text-rose-800">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-rose-950 block">
              {formatBanglaCurrency(totalMarketDue)}
            </span>
            <p className="text-[10px] text-rose-700 mt-0.5">মোট অবিক্রীত বকেয়া পাওনা</p>
          </div>
        </div>

        {/* আজকের মোট আদায় */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">আজকের মোট আদায়</span>
            <div className="rounded-lg bg-emerald-200/80 p-2 text-emerald-800">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-950 block">
              {formatBanglaCurrency(todayCollectionTotal)}
            </span>
            <p className="text-[10px] text-emerald-700 mt-0.5">আজকের ক্যাশ বুকে জমার পরিমাণ</p>
          </div>
        </div>

      </div>

      {/* Main Grid: Search & Collection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (5 cols): Retailer Search & Directory */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Store className="h-4 w-4 text-emerald-600" />
                <span>দোকান নির্বাচন ও অনুসন্ধান</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-500">
                মোট: {formatBanglaNumber(filteredCustomers.length)}
              </span>
            </div>

            {/* Customer Search by Shop Name */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text"
                placeholder="দোকানের নাম দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Shop Cards List */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  কোনো দোকান পাওয়া যায়নি।
                </div>
              ) : (
                filteredCustomers.map(cust => {
                  const isSelected = selectedCustomerId === cust.id;
                  const isFullyPaid = (cust.outstandingBalance || 0) <= 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomerId(cust.id);
                        setCollectionError('');
                      }}
                      className={`rounded-xl border p-3.5 cursor-pointer transition flex items-center justify-between ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 block">
                            {cust.name}
                          </span>

                          {/* Status Badge */}
                          {isFullyPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              সম্পূর্ণ পরিশোধ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                              বকেয়া রয়েছে
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-500">
                          মোবাইল: {toBanglaNumerals(cust.phone)} • ঠিকানা: {cust.address}
                        </p>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400 block font-bold">বর্তমান বাকি</span>
                        <span className={`text-xs font-black block ${isFullyPaid ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatBanglaCurrency(cust.outstandingBalance || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Right Column (7 cols): Collection Entry & Customer Statement */}
        <div className="lg:col-span-7 space-y-6">
          
          {selectedCustomer ? (
            <div className="space-y-6">
              
              {/* Customer Information Panel */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      নির্বাচিত রিটেইলার তথ্য
                    </span>
                    <h2 className="font-sans font-black text-lg text-slate-900 mt-1">
                      {selectedCustomer.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      মোবাইল: {toBanglaNumerals(selectedCustomer.phone)} • ঠিকানা: {selectedCustomer.address}
                    </p>
                  </div>

                  {/* Payment Status Tag */}
                  {(selectedCustomer.outstandingBalance || 0) <= 0 ? (
                    <div className="inline-flex items-center gap-1 bg-emerald-100 border border-emerald-300 text-emerald-900 px-3 py-1.5 rounded-xl text-xs font-black">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>সম্পূর্ণ পরিশোধ</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-black">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>বকেয়া বিদ্যমান</span>
                    </div>
                  )}
                </div>

                {/* 3 Metric Summary Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  
                  {/* বর্তমান মোট বাকি */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">বর্তমান মোট বাকি</span>
                    <span className={`text-base font-black block mt-0.5 ${(selectedCustomer.outstandingBalance || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {formatBanglaCurrency(selectedCustomer.outstandingBalance || 0)}
                    </span>
                  </div>

                  {/* সর্বশেষ আদায়ের তারিখ */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">সর্বশেষ আদায়ের তারিখ</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {lastCollectionDate ? formatBanglaDate(lastCollectionDate) : 'কোনো তথ্য নেই'}
                    </span>
                  </div>

                </div>

                {/* Collection Entry Form (আজকের আদায় গ্রহণ) */}
                <form onSubmit={handleSaveCollection} className="border-t border-slate-100 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-emerald-600" />
                      <span>আজকের আদায় এন্ট্রি (Collection Entry)</span>
                    </h3>

                    <button
                      type="button"
                      onClick={handleSetFullCollection}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg transition"
                    >
                      সম্পূর্ণ আদায় করুন
                    </button>
                  </div>

                  {collectionError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                      {collectionError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* আজকের আদায়ের পরিমাণ */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        আজকের আদায়ের পরিমাণ (টাকা) *
                      </label>
                      <input 
                        type="number"
                        min="1"
                        step="any"
                        placeholder="আদায়ের পরিমাণ লিখুন..."
                        value={inputCollectionAmount || ''}
                        onChange={(e) => setInputCollectionAmount(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                        required
                      />
                    </div>

                    {/* আদায়ের তারিখ */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        আদায়ের তারিখ
                      </label>
                      <input 
                        type="date"
                        value={collectionDate}
                        onChange={(e) => setCollectionDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                        required
                      />
                    </div>

                  </div>

                  {/* মন্তব্য / রেফারেন্স */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      মন্তব্য / বিবরণ
                    </label>
                    <input 
                      type="text"
                      placeholder="যেমন: ফিল্ড রিপ্রেজেন্টেটিভ কালেকশন..."
                      value={collectionRemarks}
                      onChange={(e) => setCollectionRemarks(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingCollection || inputCollectionAmount <= 0}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSubmittingCollection ? 'সংরক্ষণ হচ্ছে...' : 'আদায় নিশ্চিত ও রশিদ তৈরি করুন'}</span>
                  </button>
                </form>

              </div>

              {/* Collection History (আদায় ইতিহাস ও খতিয়ান) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-slate-600" />
                    <span>আদায় ইতিহাস ও খতিয়ান (Collection History)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>প্রিন্ট করুন</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">তারিখ</th>
                        <th className="py-2.5 px-3">বিবরণ / ধরন</th>
                        <th className="py-2.5 px-3 text-right">আদায়ের পরিমাণ (-)</th>
                        <th className="py-2.5 px-3 text-right">অবশিষ্ট বাকি</th>
                        <th className="py-2.5 px-3 text-center">রশিদ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                      {(!Array.isArray(selectedCustomerLedger) || selectedCustomerLedger.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                            এই দোকানের কোনো লেনদেন রেকর্ড পাওয়া যায়নি।
                          </td>
                        </tr>
                      ) : (
                        selectedCustomerLedger.map((entry, index) => {
                          if (!entry) return null;
                          const isPayment = entry?.type === 'Payment';
                          return (
                            <tr key={entry?.id || `cust-ledger-${index}`} className="hover:bg-slate-50/70 transition">
                              
                              {/* তারিখ */}
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {entry?.date ? formatBanglaDate(entry.date) : '—'}
                              </td>

                              {/* বিবরণ / ধরন */}
                              <td className="py-2.5 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isPayment ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {isPayment ? 'নগদ আদায়' : entry?.type === 'Invoice' ? 'বিক্রি (বাকি)' : (entry?.type || 'অজানা')}
                                </span>
                                {entry?.remarks && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">{entry.remarks}</span>
                                )}
                              </td>

                              {/* আদায়ের পরিমাণ */}
                              <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                                {(entry?.credit || 0) > 0 ? formatBanglaCurrency(entry.credit!) : '—'}
                              </td>

                              {/* অবশিষ্ট বাকি */}
                              <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                {formatBanglaCurrency(entry?.balance || 0)}
                              </td>

                              {/* রশিদ দেখুন */}
                              <td className="py-2.5 px-3 text-center">
                                {isPayment && (entry?.credit || 0) > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveReceipt({
                                        shopName: selectedCustomer.name,
                                        date: entry.date,
                                        collectedAmount: entry.credit,
                                        remainingDue: entry.balance,
                                        remarks: entry.remarks || 'নগদ আদায়'
                                      });
                                    }}
                                    className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg transition"
                                    title="রশিদ দেখুন"
                                  >
                                    <Receipt className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-300">—</span>
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
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center h-[400px]">
              <Store className="h-12 w-12 text-slate-300 mb-3" />
              <h3 className="font-sans font-bold text-base text-slate-800">
                কোনো দোকান নির্বাচিত করা হয়নি
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                বাঁ দিকের তালিকা থেকে যে কোনো দোকান নির্বাচন করে বকেয়া টাকা আদায় এন্ট্রি করুন এবং খতিয়ান দেখুন।
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Bangla Collection Receipt Modal (রশিদ মডাল) */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            
            {/* Receipt Header */}
            <div className="text-center border-b border-slate-200 pb-4 space-y-1">
              <div className="inline-flex p-2 bg-emerald-100 rounded-full text-emerald-700 mb-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-sans font-black text-lg text-slate-900">
                ফ্রেন্ডস এন্টারপ্রাইজ
              </h3>
              <p className="text-xs font-bold text-emerald-800">
                টাকা প্রাপ্তি স্বীকারপত্র (আদায় রশিদ)
              </p>
              <p className="text-[10px] text-slate-400">
                খাতুনগঞ্জ, চট্টগ্রাম • ফোন: ০০০১৮৩৫৯১২৫৯৭
              </p>
            </div>

            {/* Receipt Content */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-600">দোকানের নাম:</span>
                <span className="font-black text-slate-900">{activeReceipt.shopName}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-600">আদায়ের তারিখ:</span>
                <span className="font-bold text-slate-900">{formatBanglaDate(activeReceipt.date)}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-600">আদায়ের পরিমাণ:</span>
                <span className="font-black text-emerald-800 text-sm">
                  {formatBanglaCurrency(activeReceipt.collectedAmount)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="font-bold text-slate-600">অবশিষ্ট বাকি:</span>
                <span className={`font-black text-sm ${activeReceipt.remainingDue <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatBanglaCurrency(activeReceipt.remainingDue)}
                </span>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-xs transition"
              >
                বন্ধ করুন
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 text-xs transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>রশিদ প্রিন্ট</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add New Retailer Modal (নতুন দোকান নিবন্ধন) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-sans font-bold text-base text-slate-900 flex items-center gap-1.5">
                <Store className="h-5 w-5 text-emerald-600" />
                <span>নতুন রিটেইলার দোকান নিবন্ধক</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRetailer} className="space-y-3 text-xs">
              {addCustError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {addCustError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">দোকানের নাম *</label>
                <input 
                  type="text"
                  placeholder="যেমন: জননী ডিপার্টমেন্টাল স্টোর"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 font-semibold focus:border-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">মোবাইল নম্বর</label>
                <input 
                  type="text"
                  placeholder="যেমন: ০১৮০০০০০"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 font-semibold focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ঠিকানা</label>
                <input 
                  type="text"
                  placeholder="যেমন: খাতুনগঞ্জ, চট্টগ্রাম"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 font-semibold focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
