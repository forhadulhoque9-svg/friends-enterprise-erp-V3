import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import UniversalPrintModal from '../components/UniversalPrintModal';
import { 
  db, 
  approveDamageReturn, 
  settleDamagePayment, 
  postCompanyIncentive, 
  settleCompanyClaim 
} from '../db/db';
import { CompanyDamage, CompanyIncentive, CompanyClaim, CompanyScheme, IncentiveType, ClaimType, SchemeType } from '../types';
import { 
  ShieldAlert, 
  Gift, 
  Briefcase, 
  Plus, 
  Activity, 
  X, 
  Check, 
  Coins, 
  AlertCircle, 
  ToggleLeft, 
  ToggleRight, 
  UserPlus,
  Printer
} from 'lucide-react';

export default function CompanyFinancials() {
  // Tabs: 'Damages' | 'Incentives' | 'Claims' | 'Schemes'
  const [activeSubTab, setActiveSubTab] = useState<'Damages' | 'Incentives' | 'Claims' | 'Schemes'>('Damages');
  
  // Modal toggle states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Print Preview State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const [compName] = useState('মেসার্স ফাহিম এন্টারপ্রাইজ');
  const [compAddress] = useState('তেজগাঁও, ঢাকা');

  // Form states - Damages
  const [dmgCompanyId, setDmgCompanyId] = useState('');
  const [dmgProductId, setDmgProductId] = useState('');
  const [dmgQty, setDmgQty] = useState(0);
  const [dmgValue, setDmgValue] = useState(0);
  const [dmgRemarks, setDmgRemarks] = useState('');

  // Form states - Incentives
  const [incCompanyId, setIncCompanyId] = useState('');
  const [incType, setIncType] = useState<IncentiveType>('Target Incentive');
  const [incAmount, setIncAmount] = useState(0);
  const [incRemarks, setIncRemarks] = useState('');

  // Form states - Claims
  const [clmCompanyId, setClmCompanyId] = useState('');
  const [clmType, setClmType] = useState<ClaimType>('Damage Claim');
  const [clmAmount, setClmAmount] = useState(0);
  const [clmRemarks, setClmRemarks] = useState('');

  // Form states - Schemes
  const [schCompanyId, setSchCompanyId] = useState('');
  const [schName, setSchName] = useState('');
  const [schType, setSchType] = useState<SchemeType>('FreeProduct');
  const [schProductId, setSchProductId] = useState('');
  const [schTriggerQty, setSchTriggerQty] = useState(0);
  const [schRewardQty, setSchRewardQty] = useState(0);
  const [schDiscountPercent, setSchDiscountPercent] = useState(0);
  const [schRemarks, setSchRemarks] = useState('');

  // Live Queries
  const companies = useLiveQuery(() => db.companies.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  
  const damages = useLiveQuery(() => db.companyDamages.toArray());
  const incentives = useLiveQuery(() => db.companyIncentives.toArray());
  const claims = useLiveQuery(() => db.companyClaims.toArray());
  const schemes = useLiveQuery(() => db.companySchemes.toArray());

  const handleOpenAddModal = () => {
    setError('');
    // Reset forms
    setDmgCompanyId(''); setDmgProductId(''); setDmgQty(1); setDmgValue(0); setDmgRemarks('');
    setIncCompanyId(''); setIncType('Target Incentive'); setIncAmount(0); setIncRemarks('');
    setClmCompanyId(''); setClmType('Damage Claim'); setClmAmount(0); setClmRemarks('');
    setSchCompanyId(''); setSchName(''); setSchType('FreeProduct'); setSchProductId(''); 
    setSchTriggerQty(10); setSchRewardQty(1); setSchDiscountPercent(0); setSchRemarks('');
    
    setIsModalOpen(true);
  };

  const handlePrintDamage = (dmg: CompanyDamage) => {
    const comp = companies?.find(c => c.id === dmg.companyId);
    const prod = products?.find(p => p.id === dmg.productId);
    
    setPrintData({
      id: dmg.id,
      companyName: comp?.name || 'Unknown',
      productName: prod?.name || 'Unknown',
      qty: dmg.qty,
      value: dmg.damageValue,
      remarks: dmg.remarks,
      date: new Date(parseInt(dmg.id.split('_')[1])).toLocaleDateString()
    });
    setShowPrintModal(true);
  };

  const handleSaveDamage = async () => {
    const comp = companies?.find(c => c.id === dmgCompanyId);
    const prod = products?.find(p => p.id === dmgProductId);

    if (!dmgCompanyId || !dmgProductId || !comp || !prod) {
      setError('Please select valid Company and Product.');
      return;
    }
    if (dmgQty <= 0 || dmgValue <= 0) {
      setError('Quantity and damage value must be greater than zero.');
      return;
    }

    try {
      await db.companyDamages.add({
        id: `dmg_${Date.now()}`,
        companyId: dmgCompanyId,
        companyName: comp.name,
        productId: dmgProductId,
        productName: prod.name,
        qty: dmgQty,
        damageValue: dmgValue,
        status: 'Pending',
        date: new Date().toISOString().split('T')[0],
        remarks: dmgRemarks || 'Warehouse transit damages'
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error saving damage entry.');
    }
  };

  const handleSaveIncentive = async () => {
    const comp = companies?.find(c => c.id === incCompanyId);
    if (!incCompanyId || !comp) {
      setError('Please select a company.');
      return;
    }
    if (incAmount <= 0) {
      setError('Incentive value must be greater than zero.');
      return;
    }

    try {
      const incentiveData: CompanyIncentive = {
        id: `inc_${Date.now()}`,
        companyId: incCompanyId,
        companyName: comp.name,
        date: new Date().toISOString().split('T')[0],
        type: incType,
        amount: incAmount,
        remarks: incRemarks || 'Incentive claim earned'
      };

      await postCompanyIncentive(incentiveData);
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error processing incentive credit.');
    }
  };

  const handleSaveClaim = async () => {
    const comp = companies?.find(c => c.id === clmCompanyId);
    if (!clmCompanyId || !comp) {
      setError('Please select a company.');
      return;
    }
    if (clmAmount <= 0) {
      setError('Claim value must be positive.');
      return;
    }

    try {
      await db.companyClaims.add({
        id: `clm_${Date.now()}`,
        companyId: clmCompanyId,
        companyName: comp.name,
        date: new Date().toISOString().split('T')[0],
        type: clmType,
        amount: clmAmount,
        status: 'Submitted',
        remarks: clmRemarks || 'Trade claim report'
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error saving claim.');
    }
  };

  const handleSaveScheme = async () => {
    const comp = companies?.find(c => c.id === schCompanyId);
    const prod = products?.find(p => p.id === schProductId);

    if (!schCompanyId || !schName.trim() || !schProductId || !comp || !prod) {
      setError('Company, Name, and Product must be selected.');
      return;
    }

    try {
      await db.companySchemes.add({
        id: `sch_${Date.now()}`,
        companyId: schCompanyId,
        companyName: comp.name,
        name: schName,
        type: schType,
        productId: schProductId,
        productName: prod.name,
        triggerQty: schTriggerQty,
        rewardQty: schType === 'FreeProduct' ? schRewardQty : 0,
        discountPercent: schType === 'Discount' ? schDiscountPercent : 0,
        isActive: true,
        remarks: schRemarks || 'Trade Scheme Promotion'
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error saving scheme.');
    }
  };

  const handleToggleSchemeActive = async (id: string, current: boolean) => {
    await db.companySchemes.update(id, { isActive: !current });
  };

  const handleApproveDamage = async (id: string) => {
    if (confirm('Approve this damage return? This will automatically credit the Company Ledger and reduce your liabilities to them.')) {
      await approveDamageReturn(id);
    }
  };

  const handleSettleDamagePaid = async (id: string) => {
    if (confirm('Mark this approved damage as Paid/Settle by Cash? This adds the physical refund value directly into your General Cash Book.')) {
      await settleDamagePayment(id);
    }
  };

  const handleSettleClaim = async (id: string) => {
    if (confirm('Mark this claim as Settle? Settle will credit the amount into Company Ledger, reducing liabilities.')) {
      await settleCompanyClaim(id);
    }
  };

  return (
    <div className="space-y-6" id="company-financials-module">
      
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans font-extrabold text-2xl text-gray-900 tracking-tight">Financial Backoffice</h1>
          <p className="font-sans text-sm text-gray-500">Manage claims, supplier incentives, damaged items settlement, and promotions.</p>
        </div>
        <button 
          onClick={handleOpenAddModal} 
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition self-start sm:self-auto"
          id="add-financial-item-btn"
        >
          <Plus className="h-4 w-4" /> Record New Entry
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto text-xs font-semibold">
        <button 
          onClick={() => setActiveSubTab('Damages')}
          className={`flex items-center gap-1.5 py-2.5 px-4 border-b-2 transition ${activeSubTab === 'Damages' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          <ShieldAlert className="h-4 w-4" /> Damages Return ({damages?.length || 0})
        </button>
        <button 
          onClick={() => setActiveSubTab('Incentives')}
          className={`flex items-center gap-1.5 py-2.5 px-4 border-b-2 transition ${activeSubTab === 'Incentives' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          id="tab-incentives"
        >
          <Gift className="h-4 w-4" /> Incentives Credit ({incentives?.length || 0})
        </button>
        <button 
          onClick={() => setActiveSubTab('Claims')}
          className={`flex items-center gap-1.5 py-2.5 px-4 border-b-2 transition ${activeSubTab === 'Claims' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          id="tab-claims"
        >
          <Activity className="h-4 w-4" /> Claims Settle ({claims?.length || 0})
        </button>
        <button 
          onClick={() => setActiveSubTab('Schemes')}
          className={`flex items-center gap-1.5 py-2.5 px-4 border-b-2 transition ${activeSubTab === 'Schemes' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          id="tab-schemes"
        >
          <Gift className="h-4 w-4" /> Trade Schemes ({schemes?.length || 0})
        </button>
      </div>

      {/* SUB-PANEL: DAMAGES */}
      {activeSubTab === 'Damages' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Supplier Company</th>
                <th className="py-2.5 px-4">Product Details</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Refund Value</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {damages?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">No damage returns recorded yet.</td>
                </tr>
              ) : (
                damages?.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono">{d.date}</td>
                    <td className="py-3 px-4 font-bold">{d.companyName}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold block">{d.productName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {d.productId}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold">{d.qty}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳ {d.damageValue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black font-mono tracking-wide ${
                        d.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        d.status === 'Approved' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button 
                          onClick={() => handlePrintDamage(d)}
                          className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition"
                          title="প্রিন্ট স্লিপ"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {d.status === 'Pending' && (
                          <button 
                            onClick={() => handleApproveDamage(d.id)}
                            className="flex items-center gap-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 px-2 py-1 text-[10px] font-bold shadow-sm transition"
                            title="Approve to credit ledger"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve Credit
                          </button>
                        )}
                        {d.status === 'Approved' && (
                          <button 
                            onClick={() => handleSettleDamagePaid(d.id)}
                            className="flex items-center gap-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 px-2 py-1 text-[10px] font-bold shadow-sm transition"
                            title="Settle via Cash refund"
                          >
                            <Coins className="h-3.5 w-3.5" /> Settle Cash
                          </button>
                        )}
                        {d.status === 'Paid' && (
                          <span className="text-[10px] text-slate-400 font-bold">Closed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-PANEL: INCENTIVES */}
      {activeSubTab === 'Incentives' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Supplier Company</th>
                <th className="py-2.5 px-4">Incentive Classification</th>
                <th className="py-2.5 px-4">Remarks / Details</th>
                <th className="py-2.5 px-4 text-right">Incentive Credit Value</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {incentives?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">No company incentives recorded.</td>
                </tr>
              ) : (
                incentives?.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono">{i.date}</td>
                    <td className="py-3 px-4 font-bold">{i.companyName}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block rounded bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 font-bold text-[10px]">
                        {i.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{i.remarks}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">৳ {i.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Posted Ledger Credit
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-PANEL: CLAIMS */}
      {activeSubTab === 'Claims' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Supplier Company</th>
                <th className="py-2.5 px-4">Claim Category</th>
                <th className="py-2.5 px-4">Audit Memo</th>
                <th className="py-2.5 px-4 text-right">Claim Value Amount</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {claims?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">No active trade claims submitted.</td>
                </tr>
              ) : (
                claims?.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono">{c.date}</td>
                    <td className="py-3 px-4 font-bold">{c.companyName}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block rounded bg-blue-50 text-blue-800 border border-blue-100 px-2 py-0.5 font-bold text-[10px]">
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.remarks}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">৳ {c.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-black font-mono tracking-wide ${
                        c.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                        c.status === 'In-Process' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.status !== 'Settled' ? (
                        <button 
                          onClick={() => handleSettleClaim(c.id)}
                          className="rounded bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1 text-[10px] font-semibold transition shadow-sm"
                        >
                          Settle Claim
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold">Credited</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-PANEL: SCHEMES */}
      {activeSubTab === 'Schemes' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-2.5 px-4">Scheme Name</th>
                <th className="py-2.5 px-4">Supplier Brand</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Trigger Rule Condition</th>
                <th className="py-2.5 px-4">Reward Output</th>
                <th className="py-2.5 px-4 text-center">Active Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {schemes?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">No active promotional trade schemes available.</td>
                </tr>
              ) : (
                schemes?.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-slate-900 block">{s.name}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{s.remarks}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold">{s.companyName}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${
                        s.type === 'FreeProduct' ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      }`}>
                        {s.type === 'FreeProduct' ? 'Product Promo' : 'Discount Scheme'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      Order <span className="font-bold text-slate-900">{s.triggerQty} units</span> of <span className="font-semibold block text-slate-500">{s.productName}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {s.type === 'FreeProduct' ? (
                        <span className="text-rose-700 font-bold">Get {s.rewardQty} free units</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">Get {s.discountPercent}% flat discount</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => handleToggleSchemeActive(s.id, s.isActive)}
                        className="transition inline-block p-1 hover:bg-slate-50 rounded"
                        title={s.isActive ? 'Deactivate scheme' : 'Activate scheme'}
                        id={`toggle-scheme-${s.id}`}
                      >
                        {s.isActive ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <ToggleRight className="h-4 w-4" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <ToggleLeft className="h-4 w-4" /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Consolidated entry dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-sans font-extrabold text-base text-gray-900 tracking-tight">
                {activeSubTab === 'Damages' && 'Record Warehouse Damages'}
                {activeSubTab === 'Incentives' && 'Record Earned Incentive Bonus'}
                {activeSubTab === 'Claims' && 'Submit Supplier claim report'}
                {activeSubTab === 'Schemes' && 'Setup promotional Trade Scheme'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* COMPANY SELECTOR FOR ALL TYPE OF RECORDS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Partner Supplier Company
                </label>
                <select 
                  value={
                    activeSubTab === 'Damages' ? dmgCompanyId :
                    activeSubTab === 'Incentives' ? incCompanyId :
                    activeSubTab === 'Claims' ? clmCompanyId :
                    schCompanyId
                  }
                  onChange={(e) => {
                    if (activeSubTab === 'Damages') setDmgCompanyId(e.target.value);
                    else if (activeSubTab === 'Incentives') setIncCompanyId(e.target.value);
                    else if (activeSubTab === 'Claims') setClmCompanyId(e.target.value);
                    else setSchCompanyId(e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                  id="financial-company-select"
                >
                  <option value="">-- Choose Supplier Company --</option>
                  {companies?.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>

              {/* DYNAMIC FIELDS BASED ON SUBTAB PANEL */}
              
              {/* DAMAGES DRAFT */}
              {activeSubTab === 'Damages' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Damaged Product</label>
                    <select 
                      value={dmgProductId}
                      onChange={(e) => setDmgProductId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                      id="financial-dmg-product"
                    >
                      <option value="">-- Choose Product SKU --</option>
                      {products?.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Damaged Qty</label>
                      <input 
                        type="number" 
                        value={dmgQty || ''}
                        onChange={(e) => setDmgQty(parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Estimated Damage Value (BDT)</label>
                      <input 
                        type="number" 
                        value={dmgValue || ''}
                        onChange={(e) => setDmgValue(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">SR Damage Description / Notes</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Received damaged, carton tear in transit"
                      value={dmgRemarks}
                      onChange={(e) => setDmgRemarks(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button onClick={handleSaveDamage} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 text-xs shadow-sm transition">
                    Save Damage Record (Pending approval)
                  </button>
                </>
              )}

              {/* INCENTIVES DRAFT */}
              {activeSubTab === 'Incentives' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Incentive Classification</label>
                    <select 
                      value={incType}
                      onChange={(e) => setIncType(e.target.value as IncentiveType)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Target Incentive">Target Incentive</option>
                      <option value="Online Order Incentive">Online Order Incentive</option>
                      <option value="Scheme Bonus">Scheme Bonus</option>
                      <option value="Festival Bonus">Festival Bonus</option>
                      <option value="Special Bonus">Special Bonus</option>
                      <option value="Manual Adjustment">Manual Adjustment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Incentive Reward Value (BDT)</label>
                    <input 
                      type="number" 
                      value={incAmount || ''}
                      onChange={(e) => setIncAmount(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Incentive Details / Notes</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Q1 Unilever monsoon target bonus claim"
                      value={incRemarks}
                      onChange={(e) => setIncRemarks(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="rounded bg-indigo-50 border border-indigo-100 p-2.5 text-[10px] text-indigo-800">
                    ℹ️ Saving will **instantly** write a Credit Entry in your Company Ledger, reducing what you owe to them.
                  </div>
                  <button onClick={handleSaveIncentive} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 text-xs shadow-sm transition">
                    Save & Credit Company Ledger
                  </button>
                </>
              )}

              {/* CLAIMS DRAFT */}
              {activeSubTab === 'Claims' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Claim Classification</label>
                    <select 
                      value={clmType}
                      onChange={(e) => setClmType(e.target.value as ClaimType)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Damage Claim">Damage Claim</option>
                      <option value="Shortage Claim">Shortage Claim</option>
                      <option value="Expiry Claim">Expiry Claim</option>
                      <option value="Return Claim">Return Claim</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Claim Estimated value (BDT)</label>
                    <input 
                      type="number" 
                      value={clmAmount || ''}
                      onChange={(e) => setClmAmount(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Claims memo</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Shortage claim for Lux invoice delivery"
                      value={clmRemarks}
                      onChange={(e) => setClmRemarks(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button onClick={handleSaveClaim} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 text-xs shadow-sm transition">
                    File Supplier Claim Report
                  </button>
                </>
              )}

              {/* SCHEMES DRAFT */}
              {activeSubTab === 'Schemes' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Scheme Promotion Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Soap 10+1 Eid Special"
                      value={schName}
                      onChange={(e) => setSchName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Promo Scheme Type</label>
                    <select 
                      value={schType}
                      onChange={(e) => setSchType(e.target.value as SchemeType)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="FreeProduct">Promotional Free Product Item</option>
                      <option value="Discount">Percentage Trade Discount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Applicable Product SKU</label>
                    <select 
                      value={schProductId}
                      onChange={(e) => setSchProductId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Choose Product SKU --</option>
                      {products?.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Trigger Order Qty</label>
                      <input 
                        type="number" 
                        value={schTriggerQty || ''}
                        onChange={(e) => setSchTriggerQty(parseInt(e.target.value) || 10)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    {schType === 'FreeProduct' ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Free Reward Qty</label>
                        <input 
                          type="number" 
                          value={schRewardQty || ''}
                          onChange={(e) => setSchRewardQty(parseInt(e.target.value) || 1)}
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Discount percentage (%)</label>
                        <input 
                          type="number" 
                          value={schDiscountPercent || ''}
                          onChange={(e) => setSchDiscountPercent(parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Remarks / Promo notes</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Active throughout July festival season"
                      value={schRemarks}
                      onChange={(e) => setSchRemarks(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button onClick={handleSaveScheme} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 text-xs shadow-sm transition">
                    Save Promotional Scheme
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Universal Print Modal */}
      <UniversalPrintModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="ড্যামেজ ও পণ্য ফেরত স্লিপ"
        type="damage"
        compName={compName}
        compAddress={compAddress}
        data={printData}
      />

    </div>
  );
}
