import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, postHawlatTransaction, settleHawlatDebt } from '../db/db';
import { Hawlat, HawlatTransactionType, Product } from '../types';
import { 
  Scale, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Coins, 
  Package, 
  BookOpen, 
  CheckCircle2, 
  Save, 
  X, 
  Info,
  DollarSign,
  Building2,
  Receipt,
  Printer,
  Edit2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

// Bengali Numeral Conversion Utilities
const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

function toBanglaNumerals(num: number | string | undefined | null): string {
  if (num === undefined || num === null || isNaN(Number(num))) return '০';
  const str = num.toString();
  return str.replace(/\d/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

function formatBanglaCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '৳ ০';
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('bn-BD', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(absVal);
  return `${isNegative ? '-' : ''}৳ ${formatted}`;
}

function formatBanglaNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '০';
  return new Intl.NumberFormat('bn-BD').format(num);
}

export default function HawlatModule() {
  const [search, setSearch] = useState('');
  
  // Tab state: 'Directory' (তালিকা) | 'Transact' (এন্ট্রি) | 'Custody' (আমানত ও ব্যাংক) | 'Ledgers' (লেজার)
  const [activeTab, setActiveTab] = useState<'Directory' | 'Transact' | 'Custody' | 'Ledgers'>('Directory');
  const [selectedHawlatId, setSelectedHawlatId] = useState<string | null>(null);

  // Form state - CRUD Hawlat Contact
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingHawlat, setEditingHawlat] = useState<Hawlat | null>(null);
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactRemarks, setContactRemarks] = useState('');
  const [openingCashBalance, setOpeningCashBalance] = useState(0);
  const [openingCashType, setOpeningCashType] = useState<'owe_them' | 'they_owe_us'>('they_owe_us');
  const [openingCustody, setOpeningCustody] = useState(0);
  const [contactError, setContactError] = useState('');

  // Form state - Transactions
  const [txHawlatId, setTxHawlatId] = useState('');
  const [txCategory, setTxCategory] = useState<'cash' | 'product' | 'custody' | 'settlement'>('cash');
  const [txSubOption, setTxSubOption] = useState<string>('cash_lend');
  
  // Transaction fields
  const [txCashAmount, setTxCashAmount] = useState(0);
  const [txProductId, setTxProductId] = useState('');
  const [txCartons, setTxCartons] = useState(0);
  const [txLoosePcs, setTxLoosePcs] = useState(0);
  const [txPcsPerCarton, setTxPcsPerCarton] = useState(1);
  const [txRatePerCarton, setTxRatePerCarton] = useState(0);
  const [txRatePerPcs, setTxRatePerPcs] = useState(0);
  const [txBankName, setTxBankName] = useState('ইসলামী ব্যাংক বাংলাদেশ লিমিটেড');
  const [txCustomBank, setTxCustomBank] = useState('');
  const [txBankSlipNo, setTxBankSlipNo] = useState('');
  const [txRemarks, setTxRemarks] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [txError, setTxError] = useState('');
  const [txSuccess, setTxSuccess] = useState('');

  // Live Queries
  const hawlats = useLiveQuery(() => db.hawlats.toArray());
  const products = useLiveQuery(() => db.products.toArray());

  const selectedHawlat = useLiveQuery(() => 
    selectedHawlatId ? db.hawlats.get(selectedHawlatId) : Promise.resolve(undefined),
    [selectedHawlatId]
  );

  const selectedHawlatLedger = useLiveQuery(async () => {
    if (!selectedHawlatId) return [];
    const entries = await db.hawlatLedgers.where('hawlatId').equals(selectedHawlatId).toArray();
    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedHawlatId]);

  const filteredHawlats = hawlats?.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) || 
    h.phone?.toLowerCase().includes(search.toLowerCase()) ||
    h.id.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Summary Metrics
  const totalReceivable = hawlats?.reduce((acc, h) => h.cashBalance < 0 ? acc + Math.abs(h.cashBalance) : acc, 0) || 0;
  const totalPayable = hawlats?.reduce((acc, h) => h.cashBalance > 0 ? acc + h.cashBalance : acc, 0) || 0;
  const totalCustody = hawlats?.reduce((acc, h) => acc + (h.custodyBalance || 0), 0) || 0;

  // Open Add/Edit Contact Modal
  const handleOpenContactModal = (hawlat?: Hawlat) => {
    if (hawlat) {
      setEditingHawlat(hawlat);
      setContactId(hawlat.id);
      setContactName(hawlat.name);
      setContactPhone(hawlat.phone || '');
      setContactAddress(hawlat.address || '');
      setContactRemarks(hawlat.remarks || '');
      setOpeningCashBalance(Math.abs(hawlat.cashBalance || 0));
      setOpeningCashType(hawlat.cashBalance >= 0 ? 'owe_them' : 'they_owe_us');
      setOpeningCustody(hawlat.custodyBalance || 0);
    } else {
      setEditingHawlat(null);
      setContactId(`HW-${Math.floor(1000 + Math.random() * 9000)}`);
      setContactName('');
      setContactPhone('');
      setContactAddress('');
      setContactRemarks('');
      setOpeningCashBalance(0);
      setOpeningCashType('they_owe_us');
      setOpeningCustody(0);
    }
    setContactError('');
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');

    if (!contactName.trim()) {
      setContactError('ব্যবসায়ীর নাম আবশ্যক।');
      return;
    }

    try {
      const initialCash = openingCashType === 'owe_them' ? openingCashBalance : -openingCashBalance;

      if (editingHawlat) {
        await db.hawlats.update(editingHawlat.id, {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          address: contactAddress.trim(),
          remarks: contactRemarks.trim(),
          cashBalance: initialCash,
          custodyBalance: openingCustody
        });
      } else {
        const idToUse = contactId.trim() || `HW-${Date.now().toString().slice(-4)}`;
        const exists = await db.hawlats.get(idToUse);
        if (exists) {
          setContactError('এই হাওলাদার আইডি ইতোমধ্যে ব্যবহৃত হয়েছে। অন্য নম্বর লিখুন।');
          return;
        }

        await db.hawlats.add({
          id: idToUse,
          name: contactName.trim(),
          phone: contactPhone.trim(),
          address: contactAddress.trim(),
          remarks: contactRemarks.trim(),
          cashBalance: initialCash,
          custodyBalance: openingCustody,
          openingCashBalance: initialCash,
          productBalances: {}
        });
      }

      setIsContactModalOpen(false);
    } catch (err: any) {
      setContactError(err.message || 'হাওলাদার তথ্য সংরক্ষণ করতে ব্যর্থ হয়েছে।');
    }
  };

  // Product Selection Auto-fill
  const handleProductChange = (productId: string) => {
    setTxProductId(productId);
    const prod = products?.find(p => p.id === productId);
    if (prod) {
      const pcsPerCtn = prod.pcsPerCarton || 1;
      setTxPcsPerCarton(pcsPerCtn);
      setTxRatePerCarton(prod.dp ? prod.dp * pcsPerCtn : 0);
      setTxRatePerPcs(prod.dp || prod.sellingPrice || 0);
    }
  };

  // Calculate total product pieces & estimated value
  const calculatedTotalPcs = (txCartons * txPcsPerCarton) + txLoosePcs;
  const calculatedTotalValue = (txCartons * txRatePerCarton) + (txLoosePcs * txRatePerPcs);

  // Post Hawlat Transaction
  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');
    setTxSuccess('');

    if (!txHawlatId) {
      setTxError('অনুগ্রহ করে একজন হাওলাদার/ব্যবসায়ী নির্বাচন করুন।');
      return;
    }

    let txTypeMapped: HawlatTransactionType = 'Cash_Lend';
    let cashAmt = 0;
    let prodQty = 0;
    let pId: string | undefined = undefined;

    try {
      if (txCategory === 'cash') {
        if (txCashAmount <= 0) {
          setTxError('নগদ টাকার পরিমাণ ০ এর বেশি হতে হবে।');
          return;
        }
        cashAmt = txCashAmount;

        if (txSubOption === 'cash_lend') { // হাওলাত দেওয়া হলো (আমরা পাব)
          txTypeMapped = 'Cash_Lend';
        } else { // হাওলাত নেওয়া হলো (উনি পাবেন)
          txTypeMapped = 'Cash_Receive';
        }
      } 
      else if (txCategory === 'product') {
        if (!txProductId) {
          setTxError('অনুগ্রহ করে পণ্য নির্বাচন করুন।');
          return;
        }
        if (calculatedTotalPcs <= 0) {
          setTxError('পণ্য কার্টন বা লুজ পিসের সংখ্যা ০ এর বেশি হতে হবে।');
          return;
        }
        pId = txProductId;
        prodQty = calculatedTotalPcs;

        if (txSubOption === 'product_receive') { // পণ্য হাওলাত এনেছি (স্টক ইন)
          txTypeMapped = 'Product_Receive';
        } else { // পণ্য হাওলাত দিয়েছি (স্টক আউট)
          txTypeMapped = 'Product_Lend';
        }
      } 
      else if (txCategory === 'custody') {
        if (txCashAmount <= 0) {
          setTxError('গচ্ছিত আমানতের পরিমাণ ০ এর বেশি হতে হবে।');
          return;
        }
        cashAmt = txCashAmount;

        if (txSubOption === 'custody_deposit') { // দোকানে গচ্ছিত টাকা জমা
          txTypeMapped = 'Cash_Custody_Deposit';
        } else { // ব্যাংকে জমা ও সমন্বয়
          txTypeMapped = 'Bank_Deposit_Settle';
        }
      } 
      else if (txCategory === 'settlement') {
        if (txSubOption === 'settle_cash') {
          if (txCashAmount <= 0) {
            setTxError('সমন্বয়কৃত টাকার পরিমাণ ০ এর বেশি হতে হবে।');
            return;
          }
          const targetHawlat = await db.hawlats.get(txHawlatId);
          if (!targetHawlat) throw new Error('হাওলাদার তথ্য পাওয়া যায়নি');

          // If cashBalance > 0 (we owe them), settling means we PAY cash (-amount)
          // If cashBalance < 0 (they owe us), settling means we RECEIVE cash (+amount)
          const isWeOweThem = targetHawlat.cashBalance > 0;
          cashAmt = isWeOweThem ? -txCashAmount : txCashAmount;
          txTypeMapped = 'Cash_Settle';
        } else if (txSubOption === 'settle_product') {
          if (!txProductId) {
            setTxError('সমন্বয়ের জন্য পণ্য নির্বাচন করুন।');
            return;
          }
          if (calculatedTotalPcs <= 0) {
            setTxError('সমন্বয়কৃত পণ্যের সংখ্যা নির্বাচন করুন।');
            return;
          }
          pId = txProductId;
          const targetHawlat = await db.hawlats.get(txHawlatId);
          const currentPBal = targetHawlat?.productBalances[txProductId] || 0;
          
          // Negate or adjust balance towards 0
          prodQty = currentPBal > 0 ? -calculatedTotalPcs : calculatedTotalPcs;
          txTypeMapped = 'Product_Settle';
        }
      }

      const finalBankName = txBankName === 'অন্যান্য ব্যাংক' ? txCustomBank : txBankName;

      await postHawlatTransaction(
        txHawlatId,
        txTypeMapped,
        cashAmt,
        pId,
        prodQty,
        txRemarks || 'হাওলাত লেনদেন',
        txDate,
        {
          cartons: txCartons,
          loosePcs: txLoosePcs,
          pcsPerCarton: txPcsPerCarton,
          ratePerCarton: txRatePerCarton,
          ratePerPcs: txRatePerPcs,
          totalValue: calculatedTotalValue,
          bankName: finalBankName,
          bankSlipNo: txBankSlipNo
        }
      );

      setTxSuccess('হাওলাত লেনদেন সফলভাবে সংরক্ষিত ও লেজারে আপডেট হয়েছে!');
      // Reset input fields
      setTxCashAmount(0);
      setTxCartons(0);
      setTxLoosePcs(0);
      setTxRemarks('');
      setTxBankSlipNo('');
    } catch (err: any) {
      setTxError(err.message || 'লেনদেন সম্পাদন করতে সমস্যা হয়েছে।');
    }
  };

  // Full Debt Settlement
  const handleFullSettlement = async (hawlatId: string) => {
    if (!confirm('আপনি কি এই ব্যবসায়ীর সাথে সমস্ত নগদ ও পণ্যের হাওলাত হিসাব পুরোপুরি সমন্বয়/পরিশোধ করতে চান?')) {
      return;
    }
    try {
      await settleHawlatDebt(hawlatId, true, true, new Date().toISOString().split('T')[0]);
      alert('সমস্ত হাওলাত হিসাব সফলভাবে জের শূন্য (০) করা হয়েছে!');
    } catch (err: any) {
      alert(`সমন্বয় ব্যর্থ হয়েছে: ${err.message}`);
    }
  };

  // Print Hawlat Statement
  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Module Title & Top Stats Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                হাওলাত (ইন্টার-বিজনেস লেন্ডিং ও আমানত)
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                পাশ্ববর্তী ব্যবসায়ী/পরিবেশকদের সাথে পণ্য ও নগদ টাকা আদান-প্রদান এবং নিরাপদ গচ্ছিত আমানত ব্যবস্থাপনা
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenContactModal()}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন হাওলাদার যোগ করুন</span>
          </button>
        </div>

        {/* 3 Automated Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800">মোট দেনা (আমরা পাব)</p>
              <h3 className="text-xl font-bold text-emerald-900 mt-1">
                {formatBanglaCurrency(totalReceivable)}
              </h3>
              <p className="text-[11px] text-emerald-600 mt-0.5">অন্যান্য ব্যবসায়ীদের কাছে পাওনা</p>
            </div>
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-800">মোট পাওনা (উনি পাবেন)</p>
              <h3 className="text-xl font-bold text-rose-900 mt-1">
                {formatBanglaCurrency(totalPayable)}
              </h3>
              <p className="text-[11px] text-rose-600 mt-0.5">আমাদের পরিশোধ করতে হবে</p>
            </div>
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-sky-50/70 border border-sky-100 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-800">মোট গচ্ছিত ক্যাশ আমানত</p>
              <h3 className="text-xl font-bold text-sky-900 mt-1">
                {formatBanglaCurrency(totalCustody)}
              </h3>
              <p className="text-[11px] text-sky-600 mt-0.5">অন্য দোকানে গচ্ছিত রাখা নগদ টাকা</p>
            </div>
            <div className="p-2.5 bg-sky-100 text-sky-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('Directory')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'Directory'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>১. হাওলাদার তালিকা ({toBanglaNumerals(hawlats?.length || 0)})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('Transact');
            setTxCategory('cash');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'Transact'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>২. দ্বিমুখী লেনদেন এন্ট্রি (নগদ ও পণ্য)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('Custody');
            setTxCategory('custody');
            setTxSubOption('custody_deposit');
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'Custody'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>৩. ক্যাশ আমানত ও ব্যাংক জমা</span>
        </button>

        <button
          onClick={() => setActiveTab('Ledgers')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'Ledgers'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>৪. হাওলাদার রানিং লেজার স্টেটমেন্ট</span>
        </button>
      </div>

      {/* TAB 1: Hawlat Directory (হাওলাদার তালিকা) */}
      {activeTab === 'Directory' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-5">
          {/* Search & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="হাওলাদারের নাম, ফোন নম্বর বা আইডি দিয়ে খুঁজুন..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <span className="text-xs text-slate-500">
              মোট তালিকাভুক্ত ব্যবসায়ী: <strong className="text-slate-800">{toBanglaNumerals(filteredHawlats.length)}</strong> জন
            </span>
          </div>

          {/* Directory Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHawlats.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
                কোনো হাওলাদার তথ্য পাওয়া যায়নি। নতুন তথ্য যোগ করতে উপরে "+ নতুন হাওলাদার যোগ করুন" বাটনে ক্লিক করুন।
              </div>
            ) : (
              filteredHawlats.map((h) => {
                const isWeOwe = h.cashBalance > 0; // positive means we owe them
                const isTheyOwe = h.cashBalance < 0; // negative means they owe us
                const activeProdCount = Object.values(h.productBalances || {}).filter(q => q !== 0).length;

                return (
                  <div 
                    key={h.id} 
                    className="bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md rounded-xl p-5 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                            {h.id}
                          </span>
                          <h3 className="text-base font-bold text-slate-800 mt-1">
                            {h.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => handleOpenContactModal(h)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="তথ্য সংশোধন করুন"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-500 mt-1">
                        📞 {h.phone || 'মোবাইল নম্বর নেই'}
                      </p>
                      {h.address && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          📍 {h.address}
                        </p>
                      )}

                      {/* Cash Status Badge */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">নগদ দেনা-পাওনা:</span>
                          <span className={`font-bold ${
                            isWeOwe ? 'text-rose-600' : isTheyOwe ? 'text-emerald-600' : 'text-slate-700'
                          }`}>
                            {h.cashBalance === 0 ? '৳ ০ (সমতা)' : (
                              isWeOwe 
                                ? `${formatBanglaCurrency(h.cashBalance)} (উনি পাবেন)` 
                                : `${formatBanglaCurrency(Math.abs(h.cashBalance))} (আমরা পাব)`
                            )}
                          </span>
                        </div>

                        {/* Custody Balance */}
                        {(h.custodyBalance || 0) > 0 && (
                          <div className="flex items-center justify-between text-xs bg-sky-50 px-2.5 py-1.5 rounded-md border border-sky-100">
                            <span className="text-sky-800 font-medium">গচ্ছিত আমানত:</span>
                            <span className="font-bold text-sky-900">{formatBanglaCurrency(h.custodyBalance)}</span>
                          </div>
                        )}

                        {/* Product Balance Indicator */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-500">পণ্য জের:</span>
                          <span className="font-medium text-slate-700">
                            {activeProdCount > 0 ? `${toBanglaNumerals(activeProdCount)} টি পণ্য লেনদেন বাকি` : 'কোনো পণ্য জের নেই'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedHawlatId(h.id);
                          setActiveTab('Ledgers');
                        }}
                        className="flex-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        রানিং লেজার
                      </button>

                      <button
                        onClick={() => {
                          setTxHawlatId(h.id);
                          setActiveTab('Transact');
                        }}
                        className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        লেনদেন এন্ট্রি
                      </button>

                      <button
                        onClick={() => handleFullSettlement(h.id)}
                        className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="সম্পূর্ণ হিসাব সমন্বয় / শূন্য করুন"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Transaction Entry (দ্বিমুখী লেনদেন এন্ট্রি - নগদ ও পণ্য) */}
      {(activeTab === 'Transact' || activeTab === 'Custody') && (
        <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-6">
          {/* Inner Category Buttons */}
          <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-100">
            <button
              onClick={() => {
                setTxCategory('cash');
                setTxSubOption('cash_lend');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                txCategory === 'cash' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Coins className="w-4 h-4" />
              ক) নগদ টাকা হাওলাত (Cash)
            </button>

            <button
              onClick={() => {
                setTxCategory('product');
                setTxSubOption('product_receive');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                txCategory === 'product' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              খ) পণ্য হাওলাত (Product Stock)
            </button>

            <button
              onClick={() => {
                setTxCategory('custody');
                setTxSubOption('custody_deposit');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                txCategory === 'custody' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              গ) গচ্ছিত আমানত ও ব্যাংক জমা
            </button>

            <button
              onClick={() => {
                setTxCategory('settlement');
                setTxSubOption('settle_cash');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                txCategory === 'settlement' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              ঘ) হাওলাত পরিশোধ ও সমন্বয় (Settlement)
            </button>
          </div>

          {/* Transaction Form */}
          <form onSubmit={handlePostTransaction} className="space-y-6">
            {txError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{txError}</span>
              </div>
            )}

            {txSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{txSuccess}</span>
              </div>
            )}

            {/* Sub-Option Radio Selectors */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                লেনদেনের উদ্দেশ্য নির্বাচন করুন:
              </label>

              {txCategory === 'cash' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'cash_lend' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="cashSub"
                      value="cash_lend"
                      checked={txSubOption === 'cash_lend'}
                      onChange={() => setTxSubOption('cash_lend')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>হাওলাত দেওয়া হলো (আমরা পাব - Cash Out)</span>
                  </label>

                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'cash_receive' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="cashSub"
                      value="cash_receive"
                      checked={txSubOption === 'cash_receive'}
                      onChange={() => setTxSubOption('cash_receive')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>হাওলাত নেওয়া হলো (উনি পাবেন - Cash In)</span>
                  </label>
                </div>
              )}

              {txCategory === 'product' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'product_receive' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="prodSub"
                      value="product_receive"
                      checked={txSubOption === 'product_receive'}
                      onChange={() => setTxSubOption('product_receive')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>পণ্য হাওলাত আনা হলো (স্টক ইন - We Borrow Stock)</span>
                  </label>

                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'product_lend' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="prodSub"
                      value="product_lend"
                      checked={txSubOption === 'product_lend'}
                      onChange={() => setTxSubOption('product_lend')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>পণ্য হাওলাত দেওয়া হলো (স্টক আউট - We Lend Stock)</span>
                  </label>
                </div>
              )}

              {txCategory === 'custody' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'custody_deposit' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="custSub"
                      value="custody_deposit"
                      checked={txSubOption === 'custody_deposit'}
                      onChange={() => setTxSubOption('custody_deposit')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>দোকানে গচ্ছিত টাকা জমা (Deposit Cash for Safe Keeping)</span>
                  </label>

                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'bank_deposit' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="custSub"
                      value="bank_deposit"
                      checked={txSubOption === 'bank_deposit'}
                      onChange={() => setTxSubOption('bank_deposit')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>ব্যাংকে জমা ও সমন্বয় (Direct Bank Deposit & Settlement)</span>
                  </label>
                </div>
              )}

              {txCategory === 'settlement' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'settle_cash' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="settleSub"
                      value="settle_cash"
                      checked={txSubOption === 'settle_cash'}
                      onChange={() => setTxSubOption('settle_cash')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>নগদ টাকা দিয়ে পরিশোধ / সমন্বয় (Direct Cash Settlement)</span>
                  </label>

                  <label className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 transition-all ${
                    txSubOption === 'settle_product' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm' 
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="settleSub"
                      value="settle_product"
                      checked={txSubOption === 'settle_product'}
                      onChange={() => setTxSubOption('settle_product')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>পণ্য ফেরত দিয়ে সমন্বয় (Product Stock Return)</span>
                  </label>
                </div>
              )}
            </div>

            {/* General Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  হাওলাদার / ব্যবসায়ী নির্বাচন করুন *
                </label>
                <select
                  value={txHawlatId}
                  onChange={(e) => setTxHawlatId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                >
                  <option value="">-- হাওলাদার নাম নির্বাচন করুন --</option>
                  {hawlats?.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.phone || h.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  লেনদেনের তারিখ *
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Cash Input Fields */}
            {(txCategory === 'cash' || txCategory === 'custody' || (txCategory === 'settlement' && txSubOption === 'settle_cash')) && (
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>নগদ টাকার হিসাব:</span>
                </h4>

                <div className="max-w-md">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    টাকার পরিমাণ (BDT ৳) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={txCashAmount || ''}
                      onChange={(e) => setTxCashAmount(parseFloat(e.target.value) || 0)}
                      placeholder="০.০০"
                      className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bank Deposit Extra Fields */}
            {txCategory === 'custody' && txSubOption === 'bank_deposit' && (
              <div className="bg-sky-50/70 p-4 rounded-xl border border-sky-100 space-y-4">
                <h4 className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span>ব্যাংক অ্যাকাউন্ট ও ট্রানজেকশন তথ্য:</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ব্যাংকের নাম নির্বাচন করুন *
                    </label>
                    <select
                      value={txBankName}
                      onChange={(e) => setTxBankName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="ইসলামী ব্যাংক বাংলাদেশ লিমিটেড">ইসলামী ব্যাংক বাংলাদেশ লিমিটেড</option>
                      <option value="ডাচ বাংলা ব্যাংক লিমিটেড">ডাচ বাংলা ব্যাংক লিমিটেড</option>
                      <option value="দ্য সিটি ব্যাংক লিমিটেড">দ্য সিটি ব্যাংক লিমিটেড</option>
                      <option value="ব্র্যাক ব্যাংক লিমিটেড">ব্র্যাক ব্যাংক লিমিটেড</option>
                      <option value="পূবালী ব্যাংক লিমিটেড">পূবালী ব্যাংক লিমিটেড</option>
                      <option value="ইউনাইটেড কমার্শিয়াল ব্যাংক">ইউনাইটেড কমার্শিয়াল ব্যাংক</option>
                      <option value="অন্যান্য ব্যাংক">অন্যান্য ব্যাংক (হাতে লিখুন)</option>
                    </select>
                  </div>

                  {txBankName === 'অন্যান্য ব্যাংক' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ব্যাংকের নাম (হাতে লিখুন)
                      </label>
                      <input
                        type="text"
                        value={txCustomBank}
                        onChange={(e) => setTxCustomBank(e.target.value)}
                        placeholder="যেমন: সাউথইস্ট ব্যাংক লিমিটেড"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ব্যাংক জমা স্লিপ / ট্রানজেকশন আইডি নম্বর
                    </label>
                    <input
                      type="text"
                      value={txBankSlipNo}
                      onChange={(e) => setTxBankSlipNo(e.target.value)}
                      placeholder="যেমন: SLIP-9012384"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Product Input Fields */}
            {(txCategory === 'product' || (txCategory === 'settlement' && txSubOption === 'settle_product')) && (
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>পণ্যের বিবরণ ও দ্বৈত ইউনিট এন্ট্রি (কার্টন ও লুজ পিস):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      পণ্য নির্বাচন করুন (Product SKU) *
                    </label>
                    <select
                      value={txProductId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">-- পণ্য নির্বাচন করুন --</option>
                      {products?.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (স্টক: {toBanglaNumerals(p.stock || 0)} কার্টন | প্রতি কার্টনে {toBanglaNumerals(p.pcsPerCarton || 1)} পিস)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      কার্টন সংখ্যা (Cartons)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={txCartons || ''}
                      onChange={(e) => setTxCartons(parseInt(e.target.value) || 0)}
                      placeholder="০"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      লুজ পিস (Loose Pieces)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={txLoosePcs || ''}
                      onChange={(e) => setTxLoosePcs(parseInt(e.target.value) || 0)}
                      placeholder="০"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      প্রতি কার্টন আনুপাতিক দর (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={txRatePerCarton || ''}
                      onChange={(e) => setTxRatePerCarton(parseFloat(e.target.value) || 0)}
                      placeholder="০.০০"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      প্রতি পিস দর (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={txRatePerPcs || ''}
                      onChange={(e) => setTxRatePerPcs(parseFloat(e.target.value) || 0)}
                      placeholder="০.০০"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Total Calculated Stats */}
                <div className="bg-emerald-50/80 p-3 rounded-lg border border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-600">মোট গণনা করা পিস: </span>
                    <strong className="text-emerald-900 font-bold text-sm">
                      {toBanglaNumerals(calculatedTotalPcs)} পিস
                    </strong>
                    <span className="text-slate-400 text-[11px] ml-1">
                      ({toBanglaNumerals(txCartons)} কার্টন × {toBanglaNumerals(txPcsPerCarton)} পিস + {toBanglaNumerals(txLoosePcs)} লুজ পিস)
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-600">আনুমানিক মোট মূল্য: </span>
                    <strong className="text-emerald-900 font-bold text-sm">
                      {formatBanglaCurrency(calculatedTotalValue)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Remarks / Memo Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                লেনদেনের বিবরণ / বিশেষ নোট
              </label>
              <textarea
                rows={2}
                value={txRemarks}
                onChange={(e) => setTxRemarks(e.target.value)}
                placeholder="যেমন: দোকানের গচ্ছিত আমানত ফেরত অথবা চালানের সাথে সমন্বয়..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3 rounded-lg shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>হাওলাত লেনদেন নিশ্চিত ও সংরক্ষণ করুন</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Running Ledger Statement (হাওলাদার রানিং লেজার স্টেটমেন্ট) */}
      {activeTab === 'Ledgers' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-5">
          {/* Hawlat Entity Selector Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex-1 max-w-md">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                লেজার দেখার জন্য হাওলাদার নির্বাচন করুন:
              </label>
              <select
                value={selectedHawlatId || ''}
                onChange={(e) => setSelectedHawlatId(e.target.value || null)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
              >
                <option value="">-- হাওলাদার নাম নির্বাচন করুন --</option>
                {hawlats?.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.phone || h.id})
                  </option>
                ))}
              </select>
            </div>

            {selectedHawlat && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintStatement}
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>লেজার স্টেটমেন্ট প্রিন্ট করুন</span>
                </button>
              </div>
            )}
          </div>

          {/* Ledger Content View */}
          {!selectedHawlat ? (
            <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
              লেজার বিবরণ ও হিসাব দেখতে উপরের ড্রপডাউন থেকে একজন হাওলাদার নির্বাচন করুন।
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ledger Profile Header */}
              <div className="bg-slate-900 text-white p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-bold">
                      {selectedHawlat.id}
                    </span>
                    <h2 className="text-xl font-bold text-white">
                      {selectedHawlat.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    📞 {selectedHawlat.phone || 'মোবাইল নম্বর নেই'} {selectedHawlat.address ? `| 📍 ${selectedHawlat.address}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                    <span className="text-slate-400 block">বর্তমান নগদ জের:</span>
                    <strong className={`text-base font-bold ${
                      selectedHawlat.cashBalance > 0 ? 'text-rose-400' : selectedHawlat.cashBalance < 0 ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                      {selectedHawlat.cashBalance === 0 
                        ? '৳ ০ (সমতা)' 
                        : selectedHawlat.cashBalance > 0 
                          ? `${formatBanglaCurrency(selectedHawlat.cashBalance)} (উনি পাবেন)` 
                          : `${formatBanglaCurrency(Math.abs(selectedHawlat.cashBalance))} (আমরা পাব)`
                      }
                    </strong>
                  </div>

                  {(selectedHawlat.custodyBalance || 0) > 0 && (
                    <div className="bg-sky-950/80 p-3 rounded-lg border border-sky-800">
                      <span className="text-sky-300 block">গচ্ছিত নগদ আমানত:</span>
                      <strong className="text-base font-bold text-sky-200">
                        {formatBanglaCurrency(selectedHawlat.custodyBalance)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">তারিখ</th>
                      <th className="py-3 px-4">লেনদেনের প্রকার</th>
                      <th className="py-3 px-4">বিবরণ / মেমো</th>
                      <th className="py-3 px-4 text-right">নগদ গ্রহণ / প্রদান</th>
                      <th className="py-3 px-4">পণ্য বিবরণ (কার্টন + পিস)</th>
                      <th className="py-3 px-4">ব্যাংকের তথ্য</th>
                      <th className="py-3 px-4 text-right">লেনদেন পরবর্তী নগদ জের</th>
                      <th className="py-3 px-4 text-right">গচ্ছিত আমানত</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedHawlatLedger?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          এই হাওলাদারের এখনো কোনো লেনদেন এন্ট্রি রেকর্ড হয়নি।
                        </td>
                      </tr>
                    ) : (
                      selectedHawlatLedger?.map((entry) => {
                        const isCashIn = entry.cashAmount > 0;
                        const isCashOut = entry.cashAmount < 0;

                        let typeBadgeClass = 'bg-slate-100 text-slate-800';
                        let typeLabelBangla = entry.type;

                        if (entry.type === 'Cash_Lend') {
                          typeBadgeClass = 'bg-rose-100 text-rose-800';
                          typeLabelBangla = 'হাওলাত প্রদান (Cash Out)';
                        } else if (entry.type === 'Cash_Receive') {
                          typeBadgeClass = 'bg-emerald-100 text-emerald-800';
                          typeLabelBangla = 'হাওলাত গ্রহণ (Cash In)';
                        } else if (entry.type === 'Product_Lend') {
                          typeBadgeClass = 'bg-amber-100 text-amber-800';
                          typeLabelBangla = 'পণ্য দেওয়া হলো (Stock Out)';
                        } else if (entry.type === 'Product_Receive') {
                          typeBadgeClass = 'bg-blue-100 text-blue-800';
                          typeLabelBangla = 'পণ্য আনা হলো (Stock In)';
                        } else if (entry.type === 'Cash_Custody_Deposit') {
                          typeBadgeClass = 'bg-sky-100 text-sky-800';
                          typeLabelBangla = 'দোকানে গচ্ছিত রাখা';
                        } else if (entry.type === 'Bank_Deposit_Settle') {
                          typeBadgeClass = 'bg-indigo-100 text-indigo-800';
                          typeLabelBangla = 'ব্যাংকে জমা ও সমন্বয়';
                        } else if (entry.type === 'Cash_Settle' || entry.type === 'Product_Settle') {
                          typeBadgeClass = 'bg-emerald-50 text-emerald-900 border border-emerald-200';
                          typeLabelBangla = 'হিসাব সমন্বয়';
                        }

                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium whitespace-nowrap">
                              {entry.date}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${typeBadgeClass}`}>
                                {typeLabelBangla}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <p className="font-medium text-slate-800">{entry.remarks || '-'}</p>
                              <span className="text-[10px] text-slate-400 font-mono">{entry.refId}</span>
                            </td>
                            <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                              isCashIn ? 'text-emerald-600' : isCashOut ? 'text-rose-600' : 'text-slate-500'
                            }`}>
                              {entry.cashAmount === 0 ? '-' : (
                                isCashIn ? `+${formatBanglaCurrency(entry.cashAmount)}` : formatBanglaCurrency(entry.cashAmount)
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {entry.productName ? (
                                <div>
                                  <strong className="block text-slate-800">{entry.productName}</strong>
                                  <span className="text-slate-500 text-[11px]">
                                    {toBanglaNumerals(entry.cartons || 0)} কার্টন, {toBanglaNumerals(entry.loosePcs || 0)} পিস (মোট {toBanglaNumerals(entry.productQty)} পিস)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {entry.bankName ? (
                                <div>
                                  <span className="font-semibold block">{entry.bankName}</span>
                                  {entry.bankSlipNo && <span className="text-[10px] text-slate-400 font-mono">স্লিপ: {entry.bankSlipNo}</span>}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                              {formatBanglaCurrency(entry.cashBalanceAfter)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-sky-900 whitespace-nowrap">
                              {entry.custodyBalanceAfter ? formatBanglaCurrency(entry.custodyBalanceAfter) : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add/Edit Hawlat Contact */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold">
                  {editingHawlat ? 'হাওলাদার তথ্য সংশোধন করুন' : 'নতুন হাওলাদার / ব্যবসায়ী যোগ করুন'}
                </h3>
              </div>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-4">
              {contactError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{contactError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    হাওলাদার আইডি *
                  </label>
                  <input
                    type="text"
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    disabled={!!editingHawlat}
                    placeholder="যেমন: HW-1001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono disabled:opacity-60"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ব্যবসায়ীর/প্রতিষ্ঠানের নাম *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="যেমন: মেসার্স রহিম ট্রেডার্স"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="০১৮৩৫৯১২৫৯৭"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ঠিকানা / বাজার
                  </label>
                  <input
                    type="text"
                    value={contactAddress}
                    onChange={(e) => setContactAddress(e.target.value)}
                    placeholder="যেমন: খাতুনগঞ্জ, চট্টগ্রাম"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Initial Opening Balances */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">প্রারম্ভিক জের (Opening Balances):</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      প্রারম্ভিক নগদ জের (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={openingCashBalance || ''}
                      onChange={(e) => setOpeningCashBalance(parseFloat(e.target.value) || 0)}
                      placeholder="০"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      জের এর ধরন
                    </label>
                    <select
                      value={openingCashType}
                      onChange={(e: any) => setOpeningCashType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-semibold"
                    >
                      <option value="they_owe_us">আমরা পাব (They Owe Us)</option>
                      <option value="owe_them">উনি পাবেন (We Owe Them)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    প্রারম্ভিক গচ্ছিত ক্যাশ আমানত (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={openingCustody || ''}
                    onChange={(e) => setOpeningCustody(parseFloat(e.target.value) || 0)}
                    placeholder="০"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sky-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিশেষ মন্তব্য / নোট
                </label>
                <input
                  type="text"
                  value={contactRemarks}
                  onChange={(e) => setContactRemarks(e.target.value)}
                  placeholder="যেমন: ডিস্ট্রিবিউটর পয়েন্ট বা বিশ্বস্ত ব্যবসায়ী"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
