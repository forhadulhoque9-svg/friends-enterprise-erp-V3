import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatBanglaCurrency, toBanglaNumerals, formatBanglaNumber } from '../lib/utils';
import { 
  Building2, 
  TrendingUp, 
  Target, 
  ShoppingBag, 
  ArrowRight,
  PieChart,
  Calendar,
  ChevronRight,
  Search,
  Receipt,
  Printer,
  FileText,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import UniversalPrintModal from '../components/UniversalPrintModal';

export default function CompanyTargetDetail() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState<any>(null);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Live Queries
  const companies = useLiveQuery(() => db.companies.toArray()) || [];
  const companyTargets = useLiveQuery(() => db.companyTargets.toArray()) || [];
  const invoices = useLiveQuery(() => db.salesInvoices.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Filtered companies based on search
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [companies, searchTerm]);

  // Performance calculations
  const performances = useMemo(() => {
    if (!companies || companies.length === 0) return [];
    
    // Optimization: Create maps for O(1) lookups
    const productMap = new Map(products?.map(p => [p.id, p]));
    const targetMap = new Map(companyTargets?.filter(t => t.month === currentMonthStr).map(t => [t.refId, t]));
    
    return companies.map(c => {
      if (!c) return null;
      
      const targetRecord = targetMap.get(c.id || '');
      const monthlyTarget = targetRecord?.primaryTarget || 0;
      
      const salesToDate = (invoices || [])
        .reduce((acc, inv) => {
          if (!inv || !inv.items) return acc;
          const companyTotal = inv.items
            .reduce((itemAcc, item) => {
              if (!item || !item.productId) return itemAcc;
              const product = productMap.get(item.productId);
              if (!product) return itemAcc;
              
              // Match by companyId or Name
              const isMatch = product.companyId === c.id || 
                (product.company && c.name && product.company.trim().toLowerCase() === c.name.trim().toLowerCase());
              
              return isMatch ? itemAcc + (item.total || 0) : itemAcc;
            }, 0);
          return acc + companyTotal;
        }, 0);

      const remainingTarget = Math.max(0, monthlyTarget - salesToDate);
      const achievementPercent = monthlyTarget > 0 ? Math.min(100, Math.round((salesToDate / monthlyTarget) * 100)) : 0;

      return {
        companyId: c.id,
        companyName: c.name,
        monthlyTarget,
        salesToDate,
        remainingTarget,
        achievementPercent,
        outstanding: c.outstandingBalance || 0
      };
    }).filter(Boolean) as any[];
  }, [companies, companyTargets, invoices, products, currentMonthStr]);

  const selectedPerformance = useMemo(() => {
    if (!selectedCompanyId) return null;
    return performances.find(p => p.companyId === selectedCompanyId);
  }, [performances, selectedCompanyId]);

  const ledgerEntries = useLiveQuery(async () => {
    if (!selectedCompanyId) return [];
    const entries = await db.companyLedgers
      .where('companyId')
      .equals(selectedCompanyId)
      .toArray();
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCompanyId]) || [];

  const handlePrintLedger = () => {
    if (!selectedPerformance) return;
    const company = companies.find(c => c.id === selectedCompanyId);
    setPrintData({
      companyName: company?.name || '',
      companyId: selectedCompanyId,
      outstandingBalance: company?.outstandingBalance || 0,
      entries: ledgerEntries.slice().reverse() // chronological for print
    });
    setShowPrintModal(true);
  };

  const handleSaveTarget = async () => {
    if (!selectedCompanyId || !targetInput) return;
    
    setIsSavingTarget(true);
    try {
      const amount = parseFloat(targetInput);
      if (isNaN(amount)) throw new Error('Invalid amount');

      const existingTarget = companyTargets.find(t => t.refId === selectedCompanyId);
      const company = companies.find(c => c.id === selectedCompanyId);

      const targetData = {
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        targetType: 'Company' as const,
        refId: selectedCompanyId,
        refName: company?.name || 'Unknown',
        primaryTarget: amount,
        secondaryTarget: 0,
        primaryAchievement: selectedPerformance?.salesToDate || 0,
        secondaryAchievement: 0,
        updatedAt: new Date().toISOString()
      };

      if (existingTarget?.id) {
        await db.companyTargets.update(existingTarget.id, targetData);
      } else {
        await db.companyTargets.add({
          ...targetData,
          id: `target_${Date.now()}`,
          createdAt: new Date().toISOString()
        });
      }
      
      setTargetInput('');
    } catch (err) {
      console.error('Save target error:', err);
    } finally {
      setIsSavingTarget(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans font-black text-2xl text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-emerald-600" />
            কোম্পানি টার্গেট ও লেজার কনসোল
          </h1>
          <p className="font-sans text-xs text-slate-500">কোম্পানিভিত্তিক সেলস টার্গেট, এচিভমেন্ট এবং বিস্তারিত লেজার রিপোর্ট</p>
        </div>
        {selectedCompanyId && (
          <button 
            onClick={() => setSelectedCompanyId(null)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            তালিকায় ফিরে যান
          </button>
        )}
      </div>

      {!selectedCompanyId ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="text"
                    placeholder="কোম্পানি অনুসন্ধান..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span>মোট কোম্পানি: {toBanglaNumerals(companies.length)} টি</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-5">কোম্পানির নাম</th>
                      <th className="py-3 px-5 text-right">মাসিক টার্গেট</th>
                      <th className="py-3 px-5 text-right">বর্তমান সেলস</th>
                      <th className="py-3 px-5 text-center">এচিভমেন্ট</th>
                      <th className="py-3 px-5 text-right">অবশিষ্ট টার্গেট</th>
                      <th className="py-3 px-5 text-right">বর্তমান দেনা (দেনা)</th>
                      <th className="py-3 px-5 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {performances
                      .filter(p => (p.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(p => (
                      <tr key={p.companyId} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-5">
                          <span className="font-bold text-slate-900 block">{p.companyName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.companyId}</span>
                        </td>
                        <td className="py-4 px-5 text-right font-bold text-slate-700">
                          {formatBanglaCurrency(p.monthlyTarget)}
                        </td>
                        <td className="py-4 px-5 text-right font-bold text-emerald-700">
                          {formatBanglaCurrency(p.salesToDate)}
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${p.achievementPercent >= 80 ? 'bg-emerald-500' : p.achievementPercent >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${p.achievementPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black">{toBanglaNumerals(p.achievementPercent)}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right font-bold text-amber-700">
                          {formatBanglaCurrency(p.remainingTarget)}
                        </td>
                        <td className="py-4 px-5 text-right font-black text-rose-700">
                          {formatBanglaCurrency(p.outstanding)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <button 
                            onClick={() => setSelectedCompanyId(p.companyId)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition"
                          >
                            বিস্তারিত দেখুন <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Detail View Header Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Target className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Monthly Target</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatBanglaCurrency(selectedPerformance?.monthlyTarget || 0)}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input 
                  type="number"
                  placeholder="টার্গেট সেট করুন"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={handleSaveTarget}
                  disabled={isSavingTarget || !targetInput}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {isSavingTarget ? 'সেভ হচ্ছে...' : 'সেভ'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-bold mt-2">নির্ধারিত মাসিক সেলস লক্ষ্যমাত্রা</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="px-2 py-0.5 rounded-full bg-emerald-50 text-[10px] font-black text-emerald-700 border border-emerald-100">
                    {toBanglaNumerals(selectedPerformance?.achievementPercent || 0)}%
                  </div>
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700 tracking-tight">
                {formatBanglaCurrency(selectedPerformance?.salesToDate || 0)}
              </div>
              <p className="text-[11px] text-slate-400 font-bold mt-1">অর্জিত সেলস (Achievement)</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Remaining</span>
              </div>
              <div className="text-2xl font-black text-amber-700 tracking-tight">
                {formatBanglaCurrency(selectedPerformance?.remainingTarget || 0)}
              </div>
              <p className="text-[11px] text-slate-400 font-bold mt-1">লক্ষ্যমাত্রায় পৌঁছাতে অবশিষ্ট</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
                  <Receipt className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Liability</span>
              </div>
              <div className="text-2xl font-black text-rose-700 tracking-tight">
                {formatBanglaCurrency(selectedPerformance?.outstanding || 0)}
              </div>
              <p className="text-[11px] text-slate-400 font-bold mt-1">কোম্পানির নিকট বর্তমান দেনা</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Visual Performance Chart */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="font-sans font-black text-sm text-slate-900 mb-6 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" />
                টার্গেট বনাম সেলস গ্রাফ
              </h3>
              
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { name: 'টার্গেট', value: selectedPerformance?.monthlyTarget || 0, color: '#6366f1' },
                      { name: 'সেলস', value: selectedPerformance?.salesToDate || 0, color: '#10b981' }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                      tickFormatter={(val) => `৳${toBanglaNumerals(Math.round(val / 1000))}k`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 800 }}
                      formatter={(val: number) => [formatBanglaCurrency(val), 'পরিমাণ']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                      { [0, 1].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">এচিভমেন্ট স্ট্যাটাস:</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    (selectedPerformance?.achievementPercent || 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                    (selectedPerformance?.achievementPercent || 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {(selectedPerformance?.achievementPercent || 0) >= 80 ? 'অসাধারণ' : (selectedPerformance?.achievementPercent || 0) >= 50 ? 'চলমান' : 'পিছিয়ে আছে'}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${
                      (selectedPerformance?.achievementPercent || 0) >= 80 ? 'bg-emerald-500' : 
                      (selectedPerformance?.achievementPercent || 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${selectedPerformance?.achievementPercent || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Detailed Ledger History */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-sans font-black text-sm text-slate-900 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  কোম্পানি লেজার ট্রানজাকশন
                </h3>
                <button 
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition"
                >
                  <Printer className="h-3.5 w-3.5" /> প্রিন্ট লেজার
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">তারিখ</th>
                      <th className="py-2.5 px-3">বিবরণ</th>
                      <th className="py-2.5 px-3 text-right">ডেবিট (Den)</th>
                      <th className="py-2.5 px-3 text-right">ক্রেডিট (Rec)</th>
                      <th className="py-2.5 px-3 text-right">ব্যালেন্স</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">কোনো ট্রানজাকশন হিস্ট্রি পাওয়া যায়নি।</td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-3 font-mono text-slate-500">{toBanglaNumerals(entry.date)}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block">{entry.remarks}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Ref: {entry.refId}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-rose-600">
                            {entry.debit && entry.debit > 0 ? formatBanglaCurrency(entry.debit) : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-600">
                            {entry.credit && entry.credit > 0 ? formatBanglaCurrency(entry.credit) : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-900 bg-slate-50/50">
                            {formatBanglaCurrency(entry.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Universal Print Modal */}
      <UniversalPrintModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="কোম্পানি লেজার রিপোর্ট"
        type="company-ledger"
        data={printData}
      />
    </div>
  );
}
