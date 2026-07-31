import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, postHawlatTransaction, settleHawlatDebt } from '../db/db';
import { Hawlat, HawlatTransactionType } from '../types';
import { 
  Scale, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Coins, 
  Package, 
  BookOpen, 
  Activity, 
  CheckCircle, 
  Save, 
  X, 
  Info,
  DollarSign,
  Undo2
} from 'lucide-react';

export default function HawlatModule() {
  const [search, setSearch] = useState('');
  
  // Tab: 'Master' | 'Transact' | 'Ledgers'
  const [activeSubTab, setActiveSubTab] = useState<'Master' | 'Transact' | 'Ledgers'>('Master');
  const [selectedHawlatId, setSelectedHawlatId] = useState<string | null>(null);

  // Form states - CRUD Hawlat Contact
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRemarks, setContactRemarks] = useState('');
  const [contactError, setContactError] = useState('');

  // Form states - Hawlat Transaction Posting
  const [txHawlatId, setTxHawlatId] = useState('');
  const [txType, setTxType] = useState<HawlatTransactionType>('Cash_Receive');
  const [txCashAmount, setTxCashAmount] = useState(0);
  const [txProductId, setTxProductId] = useState('');
  const [txProductQty, setTxProductQty] = useState(0);
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

  const selectedHawlatLedger = useLiveQuery(() => 
    selectedHawlatId 
      ? db.hawlatLedgers.where('hawlatId').equals(selectedHawlatId).sortBy('date')
      : Promise.resolve([]),
    [selectedHawlatId]
  );

  const filteredHawlats = hawlats?.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) || 
    h.id.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleOpenContactModal = () => {
    setContactId('');
    setContactName('');
    setContactPhone('');
    setContactRemarks('');
    setContactError('');
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');

    if (!contactId.trim() || !contactName.trim()) {
      setContactError('Hawlat ID and Contact Name are required.');
      return;
    }

    try {
      const exists = await db.hawlats.get(contactId.trim());
      if (exists) {
        setContactError('Hawlat ID already exists. Must be unique.');
        return;
      }

      await db.hawlats.add({
        id: contactId.trim(),
        name: contactName.trim(),
        phone: contactPhone.trim(),
        remarks: contactRemarks.trim(),
        cashBalance: 0,
        productBalances: {}
      });
      setIsContactModalOpen(false);
    } catch (err: any) {
      setContactError(err.message || 'Error saving Hawlat contact.');
    }
  };

  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');
    setTxSuccess('');

    if (!txHawlatId) {
      setTxError('Please select a Hawlat Contact.');
      return;
    }

    // Validation
    const isCashFlow = txType.startsWith('Cash_');
    const isProductFlow = txType.startsWith('Product_');

    if (isCashFlow && txCashAmount <= 0) {
      setTxError('Cash amount must be greater than zero for cash operations.');
      return;
    }

    if (isProductFlow) {
      if (!txProductId) {
        setTxError('Please select a product item.');
        return;
      }
      if (txProductQty <= 0) {
        setTxError('Product quantity must be greater than zero.');
        return;
      }
    }

    try {
      let cashFlowAmt = 0;
      let prodFlowQty = 0;

      // Map business logic flow directions:
      // In our ERP Cash Book and Product stock:
      // 'Cash_Lend': We lend cash to them -> Cash goes OUT of ERP (cashAmount is negative)
      // 'Cash_Receive': We borrow cash from them -> Cash comes INTO ERP (cashAmount is positive)
      // 'Product_Lend': We lend products to them -> Stock goes OUT of inventory (productQty is negative)
      // 'Product_Receive': We borrow products from them -> Stock comes INTO inventory (productQty is positive)
      // 'Cash_Settle' / 'Product_Settle' / 'Mixed_Settle' represent payments towards outstanding
      
      if (txType === 'Cash_Lend') {
        cashFlowAmt = -txCashAmount; // Cash out
      } else if (txType === 'Cash_Receive') {
        cashFlowAmt = txCashAmount; // Cash in
      } else if (txType === 'Product_Lend') {
        prodFlowQty = -txProductQty; // Stock out
      } else if (txType === 'Product_Receive') {
        prodFlowQty = txProductQty; // Stock in
      } else if (txType === 'Cash_Settle') {
        // Cash settlement of outstanding cash debt
        // If we owe them cash (cashBalance > 0), settling means we PAY them (Cash out, negative)
        // If they owe us cash (cashBalance < 0), settling means we RECEIVE cash (Cash in, positive)
        const currentBal = (await db.hawlats.get(txHawlatId))?.cashBalance || 0;
        if (currentBal === 0) {
          setTxError('There is no outstanding cash debt to settle with this entity.');
          return;
        }
        cashFlowAmt = -currentBal; // Negating the balance pulls it to 0
      } else if (txType === 'Product_Settle') {
        // Product settlement of outstanding product debt
        if (!txProductId) {
          setTxError('Please choose the specific product to settle.');
          return;
        }
        const currentBal = (await db.hawlats.get(txHawlatId))?.productBalances[txProductId] || 0;
        if (currentBal === 0) {
          setTxError('There is no outstanding product debt to settle for this SKU.');
          return;
        }
        prodFlowQty = -currentBal; // Negating product balance pulls it to 0
      } else if (txType === 'Mixed_Settle') {
        // Settle product debt with cash, or cash debt with products
        // Allow entering both Cash and Product with opposite flow trends
        if (!txProductId) {
          setTxError('Select the associated product SKU for mixed settlement.');
          return;
        }
        if (txCashAmount <= 0 || txProductQty <= 0) {
          setTxError('Mixed settlement requires both positive cash and product entries.');
          return;
        }
        // Operators must select specific sign orientations
        // For ease of use, let's allow them to input positive values, and we'll apply them based on active debts
        const hRec = await db.hawlats.get(txHawlatId);
        if (hRec) {
          const cashBal = hRec.cashBalance;
          const prodBal = hRec.productBalances[txProductId] || 0;
          
          if (cashBal > 0 && prodBal < 0) {
            // We owe them cash (cashBal > 0), they owe us products (prodBal < 0)
            // Settle them: we reduce cash debt (cash out, negative) and reduce product debt (give up products, negative)
            cashFlowAmt = -txCashAmount;
            prodFlowQty = txProductQty; // They return products to us (Stock in, positive)
          } else {
            // General manual offset:
            cashFlowAmt = -txCashAmount; // paying cash to offset product
            prodFlowQty = -txProductQty; // giving product to offset cash
          }
        }
      }

      await postHawlatTransaction(
        txHawlatId,
        txType,
        cashFlowAmt,
        txProductId || undefined,
        prodFlowQty,
        txRemarks || `${txType.replace('_', ' ')} Hawlat entry`,
        txDate
      );

      setTxSuccess('Hawlat ledger and physical assets updated atomically!');
      setTxCashAmount(0);
      setTxProductQty(0);
      setTxRemarks('');
      setTxProductId('');
    } catch (err: any) {
      setTxError(err.message || 'Error occurred while posting Hawlat transaction.');
    }
  };

  const handleFullSettleDebt = async (hawlatId: string, settleCash: boolean, settleProducts: boolean) => {
    if (confirm('Execute complete settlement for this Hawlat entity? All outstanding assets will be zeroed out.')) {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        await settleHawlatDebt(hawlatId, settleCash, settleProducts, todayStr);
        alert('Hawlat outstanding settled completely!');
      } catch (err: any) {
        alert(`Settlement failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6" id="hawlat-module">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans font-extrabold text-2xl text-gray-900 tracking-tight">Hawlat Management</h1>
          <p className="font-sans text-sm text-gray-500">Bespoke ledger tracking for temporary capital, product lending, and settlements.</p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
          <button 
            onClick={() => setActiveSubTab('Master')}
            className={`rounded px-3 py-1.5 transition ${activeSubTab === 'Master' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Outstanding Monitor
          </button>
          <button 
            onClick={() => setActiveSubTab('Transact')}
            className={`rounded px-3 py-1.5 transition ${activeSubTab === 'Transact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            id="tab-hawlat-transact"
          >
            Post Transaction
          </button>
          <button 
            onClick={() => {
              setActiveSubTab('Ledgers');
              if (hawlats && hawlats.length > 0 && !selectedHawlatId) {
                setSelectedHawlatId(hawlats[0].id);
              }
            }}
            className={`rounded px-3 py-1.5 transition ${activeSubTab === 'Ledgers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            id="tab-hawlat-ledger"
          >
            Hawlat Ledgers
          </button>
        </div>
      </div>

      {/* SUB TAB 1: MASTER MONITOR */}
      {activeSubTab === 'Master' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-bold text-base text-slate-900">Hawlat Contacts</h2>
            <button 
              onClick={handleOpenContactModal}
              className="flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
              id="add-hawlat-contact-btn"
            >
              <Plus className="h-4 w-4" /> Create Hawlat Contact
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredHawlats.length === 0 ? (
              <div className="col-span-2 flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center bg-white">
                <span className="text-xs font-bold text-slate-400">No Hawlat Contacts Created</span>
                <p className="text-[10px] text-slate-400 mt-1">Create unique Hawlat contacts to begin ledger tracking.</p>
              </div>
            ) : (
              filteredHawlats.map(h => {
                const activeProdDebts = Object.entries(h.productBalances).filter(([_, qty]) => qty !== 0);
                return (
                  <div key={h.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-black text-slate-900 text-sm block">{h.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 block mt-0.5">ID: {h.id} • Mob: {h.phone || 'No Phone'}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedHawlatId(h.id);
                          setActiveSubTab('Ledgers');
                        }}
                        className="rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-2 py-1 text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <BookOpen className="h-3.5 w-3.5" /> View Ledger
                      </button>
                    </div>

                    {/* Cash balance and Product balances summary */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Cash */}
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cash Position</span>
                        <span className={`text-base font-black block mt-1 font-mono ${h.cashBalance > 0 ? 'text-amber-600' : h.cashBalance < 0 ? 'text-teal-600' : 'text-slate-900'}`}>
                          {h.cashBalance > 0 ? `We owe: ৳${h.cashBalance.toLocaleString()}` : h.cashBalance < 0 ? `They owe: ৳${Math.abs(h.cashBalance).toLocaleString()}` : '৳ 0.00'}
                        </span>
                      </div>

                      {/* Products */}
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Products Position</span>
                          {activeProdDebts.length === 0 ? (
                            <span className="text-[11px] font-bold text-slate-500 block mt-1">All stocks settled</span>
                          ) : (
                            <div className="max-h-16 overflow-y-auto mt-1 space-y-1 pr-1">
                              {activeProdDebts.map(([pId, qty]) => (
                                <span key={pId} className={`font-mono text-[9px] font-bold block ${qty > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
                                  {pId}: {qty > 0 ? `We owe ${qty}` : `They owe ${Math.abs(qty)}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Settlements */}
                    {(h.cashBalance !== 0 || activeProdDebts.length > 0) && (
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        {h.cashBalance !== 0 && (
                          <button 
                            onClick={() => handleFullSettleDebt(h.id, true, false)}
                            className="flex-1 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 py-1 text-[10px] font-bold transition"
                          >
                            Settle Cash Outstanding
                          </button>
                        )}
                        {activeProdDebts.length > 0 && (
                          <button 
                            onClick={() => handleFullSettleDebt(h.id, false, true)}
                            className="flex-1 rounded border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 py-1 text-[10px] font-bold transition"
                          >
                            Settle Stock Outstanding
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 2: POST TRANSACTION */}
      {activeSubTab === 'Transact' && (
        <div className="max-w-xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-sans font-black text-lg text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-1.5">
            <Coins className="h-5 w-5 text-emerald-600" /> Post Hawlat Ledger Transaction
          </h2>

          <form onSubmit={handlePostTransaction} className="space-y-4">
            {txError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                {txError}
              </div>
            )}

            {txSuccess && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-700">
                {txSuccess}
              </div>
            )}

            {/* Select Hawlat Contact */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Hawlat Entity
              </label>
              <select 
                value={txHawlatId}
                onChange={(e) => setTxHawlatId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                id="hawlat-entity-select"
                required
              >
                <option value="">-- Select Contact --</option>
                {hawlats?.map(h => (
                  <option key={h.id} value={h.id}>{h.name} (Cash Bal: ৳{h.cashBalance})</option>
                ))}
              </select>
            </div>

            {/* Transaction Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Posting Transaction Date
              </label>
              <input 
                type="date" 
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            {/* Flow Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Hawlat Transaction Type
              </label>
              <select 
                value={txType}
                onChange={(e) => {
                  setTxType(e.target.value as HawlatTransactionType);
                  setTxCashAmount(0);
                  setTxProductQty(0);
                  setTxProductId('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                id="hawlat-type-select"
                required
              >
                <option value="Cash_Receive">Cash Borrow (Cash Inflow into ERP)</option>
                <option value="Cash_Lend">Cash Lend (Cash Outflow from ERP)</option>
                <option value="Product_Receive">Product Borrow (Stock Inflow into ERP)</option>
                <option value="Product_Lend">Product Lend (Stock Outflow from ERP)</option>
                <option value="Cash_Settle">Direct Cash Settlement</option>
                <option value="Product_Settle">Direct Product Settlement</option>
                <option value="Mixed_Settle">Mixed Assets Settlement</option>
              </select>
            </div>

            {/* DYNAMIC FIELDS */}
            {(txType === 'Cash_Receive' || txType === 'Cash_Lend' || txType === 'Mixed_Settle') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cash Amount (BDT)
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={txCashAmount || ''}
                  onChange={(e) => setTxCashAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
            )}

            {(txType.startsWith('Product_') || txType === 'Mixed_Settle' || txType === 'Product_Settle') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Product SKU
                  </label>
                  <select 
                    value={txProductId}
                    onChange={(e) => setTxProductId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    id="hawlat-product-select"
                    required
                  >
                    <option value="">-- Choose SKU --</option>
                    {products?.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Product Qty
                  </label>
                  <input 
                    type="number" 
                    value={txProductQty || ''}
                    onChange={(e) => setTxProductQty(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Transaction Memo Remarks
              </label>
              <input 
                type="text" 
                placeholder="e.g. Temporary cash borrow for bulk Unilever purchase"
                value={txRemarks}
                onChange={(e) => setTxRemarks(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button 
              type="submit" 
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-bold shadow-sm transition"
              id="post-hawlat-tx-btn"
            >
              Post Atomic Hawlat Transaction
            </button>
          </form>
        </div>
      )}

      {/* SUB TAB 3: HAWLAT RUNNING LEDGERS */}
      {activeSubTab === 'Ledgers' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Side Selector */}
          <div className="lg:col-span-1 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Choose Contact</span>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {hawlats?.map(h => (
                <div 
                  key={h.id}
                  onClick={() => setSelectedHawlatId(h.id)}
                  className={`rounded-xl border p-4 cursor-pointer transition ${selectedHawlatId === h.id ? 'bg-emerald-50/50 border-emerald-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="text-xs font-extrabold text-slate-900 block">{h.name}</span>
                  <span className="text-[10px] text-slate-400 block font-mono mt-1">Cash Balance: ৳{h.cashBalance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ledger Table */}
          <div className="lg:col-span-2 space-y-4">
            {selectedHawlatId && selectedHawlat ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-6">
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase font-black tracking-widest block font-mono">Bespoke Hawlat Ledger</span>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">{selectedHawlat.name}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">ID Code: {selectedHawlat.id} • Memo: {selectedHawlat.remarks}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2">Date</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Description</th>
                        <th className="py-2 text-right">Cash Transacted</th>
                        <th className="py-2 text-center">Product SKU (Qty)</th>
                        <th className="py-2 text-right">Cash Bal After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {selectedHawlatLedger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            No ledger entries found.
                          </td>
                        </tr>
                      ) : (
                        selectedHawlatLedger.map(entry => {
                          const isCash = entry.cashAmount !== 0;
                          const isProd = entry.productId && entry.productQty !== 0;

                          return (
                            <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 font-mono">{entry.date}</td>
                              <td className="py-3">
                                <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-black ${
                                  entry.type.startsWith('Cash_Settle') || entry.type.startsWith('Product_Settle') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  entry.type.includes('Lend') ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  'bg-amber-50 text-amber-800 border border-amber-100'
                                }`}>
                                  {entry.type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 text-[11px] text-slate-500">{entry.remarks}</td>
                              <td className={`py-3 text-right font-mono font-bold ${entry.cashAmount > 0 ? 'text-emerald-700' : entry.cashAmount < 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                {isCash ? `৳ ${entry.cashAmount.toLocaleString()}` : '—'}
                              </td>
                              <td className="py-3 text-center">
                                {isProd ? (
                                  <span className="font-semibold text-slate-800 block">
                                    {entry.productId} ({entry.productQty > 0 ? `+${entry.productQty}` : entry.productQty})
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-3 text-right font-mono font-extrabold text-slate-900">
                                ৳ {entry.cashBalanceAfter.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center border-dashed border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-400">
                Select a contact on the left to audit statements.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Hawlat Contact CRUD Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-sans font-extrabold text-base text-gray-900 tracking-tight">Create Hawlat Contact</h2>
              <button onClick={() => setIsContactModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 space-y-4">
              {contactError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {contactError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Entity ID Code</label>
                <input 
                  type="text" 
                  placeholder="e.g. H003" 
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Haji Bashar" 
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Mobile Phone Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 018XXXXXXXX" 
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">General Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Local trade exchange agent" 
                  value={contactRemarks}
                  onChange={(e) => setContactRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsContactModalOpen(false)} 
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition"
                >
                  <Save className="h-4 w-4" /> Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
