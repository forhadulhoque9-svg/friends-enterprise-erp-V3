import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, recordCashTransaction } from '../../db/db';
import { Salesman, DSRShortLedgerEntry, DSRPayrollRecord } from '../../types';
import { 
  Users, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  DollarSign, 
  Search, 
  Trash2, 
  Edit3, 
  Printer, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  FileText, 
  Calculator, 
  UserCheck,
  Building2,
  ShieldCheck,
  Briefcase,
  XCircle,
  HelpCircle
} from 'lucide-react';

export default function DsrModule() {
  const [activeTab, setActiveTab] = useState<'settlement' | 'payroll'>('settlement');

  // Live Database Queries
  const salesmen = useLiveQuery(() => db.salesmen.toArray()) || [];
  const invoices = useLiveQuery(() => db.salesInvoices.toArray()) || [];
  const shortLedgers = useLiveQuery(() => db.dsrShortLedgers.toArray()) || [];
  const payrolls = useLiveQuery(() => db.dsrPayrolls.toArray()) || [];
  const cashBook = useLiveQuery(() => db.cashBook.toArray()) || [];

  // ----------------------------------------------------
  // TAB 1: DSR DAILY SETTLEMENT & SHORT TRACKER (AUTO SYNCED READ-ONLY)
  // ----------------------------------------------------
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDsrId, setSelectedDsrId] = useState<string>('');

  // Selected DSR
  const selectedDsr = salesmen.find(s => s.id === selectedDsrId);

  // Invoices assigned to this DSR on selected settlementDate
  const assignedInvoices = invoices.filter(inv => {
    const isSameDate = inv.date === settlementDate;
    if (!isSameDate) return false;
    if (!selectedDsrId) return true; // Show all if no DSR selected
    return inv.dsrId === selectedDsrId || inv.salesmanId === selectedDsrId || (inv.dsrName && selectedDsr && inv.dsrName === selectedDsr.name);
  });

  const totalAssignedInvoices = assignedInvoices.length;
  const totalAssignedSales = assignedInvoices.reduce((sum, inv) => sum + (inv.netTotal || 0), 0);
  // Total expected cash collection from these assigned delivery invoices
  const totalExpectedCash = assignedInvoices.reduce((sum, inv) => {
    const cash = inv.cashPaid || (inv.netTotal - (inv.dueAmount || 0));
    return sum + Math.max(0, cash);
  }, 0);

  // Auto aggregated short amount from Sales Invoices for selected date/DSR
  const dateShorts = shortLedgers.filter(s => {
    const isSameDate = s.date === settlementDate;
    if (!isSameDate) return false;
    if (!selectedDsrId) return true;
    return s.dsrId === selectedDsrId;
  });
  const calculatedShort = dateShorts.reduce((sum, s) => sum + (s.shortAmount || 0), 0);

  const handleDeleteShort = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত যে এই শর্ট এন্ট্রিটি মুছে ফেলতে চান?')) {
      await db.dsrShortLedgers.delete(id);
    }
  };

  const handleWaiveShort = async (id: string) => {
    if (confirm('আপনি কি এই শর্ট/ঘাটতি মওকুফ করতে চান?')) {
      await db.dsrShortLedgers.update(id, { status: 'Waived', updatedAt: new Date().toISOString() });
    }
  };

  // ----------------------------------------------------
  // TAB 2: DSR MANAGEMENT & PAYROLL CALCULATOR STATE
  // ----------------------------------------------------
  // DSR Management Modal/Form State
  const [dsrName, setDsrName] = useState<string>('');
  const [dsrPhone, setDsrPhone] = useState<string>('');
  const [dsrDesignation, setDsrDesignation] = useState<string>('');
  const [dsrSalary, setDsrSalary] = useState<number | ''>('');
  const [editingDsrId, setEditingDsrId] = useState<string | null>(null);

  const handleSaveDsrMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dsrName.trim()) {
      alert('অনুগ্রহ করে ডিএসআর-এর নাম লিখুন।');
      return;
    }

    try {
      const salaryNum = typeof dsrSalary === 'number' ? dsrSalary : 0;
      if (editingDsrId) {
        await db.salesmen.update(editingDsrId, {
          name: dsrName,
          phone: dsrPhone,
          designation: dsrDesignation,
          monthlySalary: salaryNum,
          updatedAt: new Date().toISOString()
        });
        setEditingDsrId(null);
      } else {
        const newDsr: Salesman = {
          id: `dsr_${Date.now()}`,
          name: dsrName,
          phone: dsrPhone,
          designation: dsrDesignation,
          monthlySalary: salaryNum,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.salesmen.add(newDsr);
      }

      setDsrName('');
      setDsrPhone('');
      setDsrSalary('');
    } catch (err) {
      alert('ডিএসআর সংরক্ষণে সমস্যা: ' + err);
    }
  };

  const handleEditDsr = (dsr: Salesman) => {
    setEditingDsrId(dsr.id || null);
    setDsrName(dsr.name);
    setDsrPhone(dsr.phone || '');
    setDsrDesignation(dsr.designation || '');
    setDsrSalary(dsr.monthlySalary || 0);
  };

  const handleDeleteDsr = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত যে এই ডিএসআর ডিলেট করতে চান?')) {
      await db.salesmen.delete(id);
    }
  };

  // Monthly Payroll State
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g., "2026-07"
  const [payrollMonth, setPayrollMonth] = useState<string>(currentMonthStr);
  const [payrollDsrId, setPayrollDsrId] = useState<string>('');
  const [totalDaysInMonth, setTotalDaysInMonth] = useState<number>(30);
  const [presentDays, setPresentDays] = useState<number>(0);
  const [commissionBonus, setCommissionBonus] = useState<number | ''>(0);
  const [advanceTaken, setAdvanceTaken] = useState<number | ''>(0);
  const [payrollRemarks, setPayrollRemarks] = useState<string>('');
  const [isProcessingPayroll, setIsProcessingPayroll] = useState<boolean>(false);
  const [payrollSuccess, setPayrollSuccess] = useState<string>('');

  // Quick Advance Entry State
  const [showAddAdvance, setShowAddAdvance] = useState<boolean>(false);
  const [newAdvDate, setNewAdvDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newAdvAmount, setNewAdvAmount] = useState<number | ''>('');
  const [newAdvVoucher, setNewAdvVoucher] = useState<string>('');
  const [newAdvRemarks, setNewAdvRemarks] = useState<string>('');

  const targetPayrollDsr = salesmen.find(s => s.id === payrollDsrId);

  // Unified Date-wise Ledger Structure
  interface UnifiedDSRLedgerItem {
    id: string;
    date: string;
    type: 'Shortage' | 'Advance';
    typeLabel: string;
    refNo: string;
    remarks: string;
    amount: number;
  }

  const rawUnifiedLedger: UnifiedDSRLedgerItem[] = [];

  if (payrollDsrId && targetPayrollDsr) {
    // 1. Filter Shortages from dsrShortLedgers
    const monthShorts = shortLedgers.filter(s => {
      if (s.dsrId !== payrollDsrId) return false;
      if (s.status === 'Waived') return false;
      if (s.entryType === 'Advance') return false;
      return (s.date || '').startsWith(payrollMonth);
    });

    monthShorts.forEach(s => {
      rawUnifiedLedger.push({
        id: s.id || `short_${s.date}_${Math.random()}`,
        date: s.date,
        type: 'Shortage',
        typeLabel: '[ Shortage ]',
        refNo: s.refInvoiceNo ? `ইনভয়েস #${s.refInvoiceNo}` : 'ডে-এন্ড সেটলমেন্ট',
        remarks: s.remarks || 'সেলস ইনভয়েস শর্টেজ',
        amount: s.shortAmount || 0
      });
    });

    // 2. Filter Advances from dsrShortLedgers
    const monthAdvLedger = shortLedgers.filter(s => {
      if (s.dsrId !== payrollDsrId) return false;
      if (s.status === 'Waived') return false;
      if (s.entryType !== 'Advance') return false;
      return (s.date || '').startsWith(payrollMonth);
    });

    monthAdvLedger.forEach(a => {
      rawUnifiedLedger.push({
        id: a.id || `adv_${a.date}_${Math.random()}`,
        date: a.date,
        type: 'Advance',
        typeLabel: '[ Advance ]',
        refNo: a.refInvoiceNo ? `ভাউচার #${a.refInvoiceNo}` : 'অগ্রিম ভাউচার',
        remarks: a.remarks || 'ডিএসআর অগ্রিম গ্রহণ',
        amount: a.shortAmount || a.expectedAmount || 0
      });
    });

    // 3. Filter Advances from cashBook
    const monthCashAdvances = cashBook.filter(c => {
      if (!c.date || !c.date.startsWith(payrollMonth)) return false;
      if (c.cashOut <= 0) return false;
      const isDsrRef = c.refId === payrollDsrId;
      const isDsrNameInRemarks = targetPayrollDsr?.name && c.remarks?.includes(targetPayrollDsr.name);
      const isAdvanceText = c.remarks?.includes('Advance') || c.remarks?.includes('অগ্রিম');
      return isDsrRef || (isDsrNameInRemarks && isAdvanceText);
    });

    monthCashAdvances.forEach(c => {
      if (!rawUnifiedLedger.some(item => item.id === c.id)) {
        rawUnifiedLedger.push({
          id: c.id,
          date: c.date,
          type: 'Advance',
          typeLabel: '[ Advance ]',
          refNo: c.transactionId ? `ভাউচার #${c.transactionId}` : 'ক্যাশ ভাউচার',
          remarks: c.remarks || 'ক্যাশ অগ্রিম',
          amount: c.cashOut
        });
      }
    });

    // 4. Check if manual advanceTaken input exceeds explicit advances
    const totalExplicitAdvances = rawUnifiedLedger
      .filter(i => i.type === 'Advance')
      .reduce((sum, i) => sum + i.amount, 0);

    const manualAdvInput = typeof advanceTaken === 'number' ? advanceTaken : 0;
    if (manualAdvInput > totalExplicitAdvances) {
      const unallocatedDiff = manualAdvInput - totalExplicitAdvances;
      rawUnifiedLedger.push({
        id: `manual_adv_${payrollMonth}`,
        date: `${payrollMonth}-15`,
        type: 'Advance',
        typeLabel: '[ Advance ]',
        refNo: 'ম্যানুয়াল এডজাস্টমেন্ট',
        remarks: 'মাসিক সমন্বিত অগ্রিম (General Advance)',
        amount: unallocatedDiff
      });
    }
  }

  // Active Date Filtering & Chronological Sorting
  const activeUnifiedLedger = rawUnifiedLedger
    .filter(item => item && item.amount > 0 && !!item.date)
    .sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));

  // Totals & Deductions Breakdown
  const totalMonthShortDeduction = activeUnifiedLedger
    .filter(i => i.type === 'Shortage')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalMonthAdvance = activeUnifiedLedger
    .filter(i => i.type === 'Advance')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalDeductions = totalMonthShortDeduction + totalMonthAdvance;

  // Auto Salary Calculations
  const baseMonthlySalary = targetPayrollDsr?.monthlySalary || 0;
  const earnedBaseSalary = Math.round((baseMonthlySalary / (totalDaysInMonth || 30)) * (presentDays || 0));
  const commBonusNum = typeof commissionBonus === 'number' ? commissionBonus : 0;
  const grossEarnedSalary = earnedBaseSalary + commBonusNum;
  const netPayableSalary = Math.max(0, grossEarnedSalary - totalDeductions);

  // Post Quick Advance Entry
  const handleSaveQuickAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollDsrId || !targetPayrollDsr) {
      alert('অনুগ্রহ করে একজন ডিএসআর নির্বাচন করুন।');
      return;
    }
    const advNum = typeof newAdvAmount === 'number' ? newAdvAmount : 0;
    if (advNum <= 0) {
      alert('অনুগ্রহ করে সঠিক অগ্রিম পরিমাণ লিখুন।');
      return;
    }

    try {
      const vNo = newAdvVoucher.trim() || `ADV-${Date.now().toString().slice(-4)}`;
      const advEntry: DSRShortLedgerEntry = {
        id: `adv_${Date.now()}`,
        dsrId: targetPayrollDsr.id!,
        dsrName: targetPayrollDsr.name,
        date: newAdvDate,
        expectedAmount: advNum,
        submittedAmount: 0,
        shortAmount: advNum,
        refInvoiceNo: vNo,
        status: 'Pending',
        remarks: newAdvRemarks.trim() || 'ডিএসআর অগ্রিম গ্রহণ (Advance)',
        entryType: 'Advance',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.dsrShortLedgers.add(advEntry);

      // Record Cash Outflow
      await recordCashTransaction(
        newAdvDate,
        'Expense',
        advEntry.id!,
        0,
        advNum,
        `ডিএসআর অগ্রিম প্রদান: ${targetPayrollDsr.name} (ভাউচার #${vNo})`
      );

      setNewAdvAmount('');
      setNewAdvVoucher('');
      setNewAdvRemarks('');
      setShowAddAdvance(false);
    } catch (err) {
      alert('অগ্রিম এন্ট্রি সংরক্ষণে ত্রুটি: ' + err);
    }
  };

  // Process & Record Payroll
  const handlePostPayroll = async () => {
    if (!payrollDsrId || !targetPayrollDsr) {
      alert('অনুগ্রহ করে পে-রোলের জন্য একজন ডিএসআর নির্বাচন করুন।');
      return;
    }

    setIsProcessingPayroll(true);
    setPayrollSuccess('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const record: DSRPayrollRecord = {
        id: `payroll_${payrollDsrId}_${payrollMonth}_${Date.now()}`,
        dsrId: targetPayrollDsr.id!,
        dsrName: targetPayrollDsr.name,
        month: payrollMonth,
        totalDaysInMonth,
        presentDays,
        monthlyBaseSalary: baseMonthlySalary,
        earnedBaseSalary,
        commissionBonus: commBonusNum,
        advanceTaken: totalMonthAdvance,
        shortDeduction: totalMonthShortDeduction,
        netPayableSalary,
        paymentDate: todayStr,
        paymentStatus: 'Paid',
        remarks: payrollRemarks || `${payrollMonth} মাসের বেতন পরিশোধ`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.dsrPayrolls.add(record);

      // Update short ledger entries status to 'Deducted'
      const activeLedgersToUpdate = shortLedgers.filter(s => s.dsrId === payrollDsrId && (s.date || '').startsWith(payrollMonth));
      for (const s of activeLedgersToUpdate) {
        if (s.id) {
          await db.dsrShortLedgers.update(s.id, { status: 'Deducted', updatedAt: new Date().toISOString() });
        }
      }

      // Record cash expense payout
      if (netPayableSalary > 0) {
        await recordCashTransaction(
          todayStr,
          'Expense',
          record.id!,
          0,
          netPayableSalary,
          `ডিএসআর নিট বেতন পরিশোধ: ${targetPayrollDsr.name} (${payrollMonth})`
        );
      }

      setPayrollSuccess(`ডিএসআর ${targetPayrollDsr.name}-এর ${payrollMonth} মাসের বেতন নিট ৳${formatBanglaNumber(netPayableSalary)} পরিশোধ ও ভাউচার অনুমোদিত হয়েছে!`);
      setTimeout(() => setPayrollSuccess(''), 5000);
    } catch (err) {
      alert('পে-রোল প্রক্রিয়াকরণে ত্রুটি: ' + err);
    } finally {
      setIsProcessingPayroll(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // Helpers
  function formatBanglaNumber(num: number): string {
    return new Intl.NumberFormat('bn-BD').format(num || 0);
  }

  function formatBanglaCurrency(amount: number): string {
    return `৳ ${new Intl.NumberFormat('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0)}`;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6" id="dsr-module-root">
      
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">
              ডিএসআর ও ডেলিভারি পে-রোল (DSR & Payroll Management)
            </h1>
            <p className="font-sans text-xs font-semibold text-slate-500">
              ডেইলি ক্যাশ সেটলমেন্ট, শর্ট/ঘাটতি ট্র্যাকিং, হাজিরা ও মাসিক পে-রোল হিসাব অটোমেশন
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1.5 border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              activeTab === 'settlement' 
                ? 'bg-white text-indigo-700 shadow-sm font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-4 w-4" />
            ডেইলি সেটলমেন্ট ও শর্ট ট্র্যাকার
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
              activeTab === 'payroll' 
                ? 'bg-white text-indigo-700 shadow-sm font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="h-4 w-4" />
            ডিএসআর হাজিরা ও পে-রোল
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: DAILY SETTLEMENT & SHORT TRACKER */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'settlement' && (
        <div className="space-y-6">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500">অ্যাসাইনকৃত ডেলিভারি বিল</span>
              <div className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                {formatBanglaNumber(totalAssignedInvoices)} টি
              </div>
              <p className="text-[10px] text-slate-400 mt-1">তারিখ: {settlementDate}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500">মোট বিক্রয় মূল্য</span>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {formatBanglaCurrency(totalAssignedSales)}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800">প্রত্যাশিত মোট নগদ আদায়</span>
              <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                {formatBanglaCurrency(totalExpectedCash)}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-xs">
              <span className="text-[11px] font-bold text-rose-800">গণনাকৃত শর্ট / ঘাটতি</span>
              <div className="text-2xl font-black text-rose-700 mt-1 font-mono flex items-center gap-1">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                {formatBanglaCurrency(calculatedShort)}
              </div>
            </div>
          </div>

          {/* Read-Only Info Banner & Details */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Left 5 Cols: Read-Only Rules Panel & Filters */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="rounded-lg bg-indigo-600 p-1.5 text-white">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-sans font-bold text-base text-slate-900">
                    ডিএসআর ডেলিভারি ও অটোলিংকড শর্টেজ
                  </h2>
                  <p className="text-[11px] text-slate-500">সেলস ইনভয়েস থেকে স্বয়ংক্রিয় সিঙ্ককৃত ডেটা (Read-Only)</p>
                </div>
              </div>

              {/* Policy Banner */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>ডিএসআর শর্টেজ নীতি (Single Entry Point)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  ডিএসআর শর্টেজ শুধুমাত্র <strong>সেলস ইনভয়েস / ডে-এন্ড সেটলমেন্ট</strong> ইন্টারফেসে ইনভয়েস জেনারেট করার সময় ইনপুট দেওয়া হয়। এখানে কোনো ম্যানুয়াল শর্টেজ ইনপুট প্রয়োজন নেই; ইনভয়েসে এন্ট্রি করা শর্টেজ স্বয়ংক্রিয়ভাবে ডিএসআর-এর আইডিতে ট্যাগ হয় এবং মাসিক পে-রোলে কর্তন করা হয়।
                </p>
              </div>

              {/* Filter Controls */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    সেটেলমেন্ট তারিখ
                  </label>
                  <input 
                    type="date"
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ডিএসআর ফিল্টার করুন
                  </label>
                  <select 
                    value={selectedDsrId}
                    onChange={(e) => setSelectedDsrId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- সকল ডিএসআর --</option>
                    {salesmen.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aggregated Figures Display */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-700 font-medium">
                  <span>প্রত্যাশিত মোট আদায়:</span>
                  <span className="font-mono font-bold text-indigo-700">{formatBanglaCurrency(totalExpectedCash)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 font-medium">
                  <span>অটো-সিঙ্কড মোট শর্টেজ:</span>
                  <span className="font-mono font-bold text-rose-600">{formatBanglaCurrency(calculatedShort)}</span>
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Active Assigned Invoices Table */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-600" />
                  আজকের অ্যাসাইনকৃত ডেলিভারি মেমোসমূহ ({formatBanglaNumber(assignedInvoices.length)})
                </h3>
              </div>

              {assignedInvoices.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  নির্বাচিত তারিখ বা ডিএসআর-এর জন্য কোনো অ্যাসাইনকৃত ইনভয়েস পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">মেমো নম্বর</th>
                        <th className="py-2.5 px-3">বাজার/গ্রাহক</th>
                        <th className="py-2.5 px-3 text-right">মোট টাকা</th>
                        <th className="py-2.5 px-3 text-right">নগদ আদায়</th>
                        <th className="py-2.5 px-3 text-right">বাকি</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                      {assignedInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{inv.invoiceNo}</td>
                          <td className="py-2.5 px-3 font-bold">{inv.customerName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{formatBanglaCurrency(inv.netTotal)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatBanglaCurrency(inv.cashPaid)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">{formatBanglaCurrency(inv.dueAmount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Short Ledger History List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-sans font-bold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                ডিএসআর শর্ট / ঘাটতি লেজার হিস্ট্রি (Short Ledger)
              </h3>
            </div>

            {shortLedgers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                কোনো শর্ট বা ঘাটতি রেকর্ড পাওয়া যায়নি (No shortage or advance records found for this month)।
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                      <th className="py-3 px-3">তারিখ</th>
                      <th className="py-3 px-3">ডিএসআর নাম</th>
                      <th className="py-3 px-3 text-right">প্রত্যাশিত ক্যাশ</th>
                      <th className="py-3 px-3 text-right">জমা ক্যাশ</th>
                      <th className="py-3 px-3 text-right">ঘাটতি/শর্ট</th>
                      <th className="py-3 px-3 text-center">স্ট্যাটাস</th>
                      <th className="py-3 px-3">মন্তব্য</th>
                      <th className="py-3 px-3 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                    {shortLedgers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono">{s.date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{s.dsrName}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{formatBanglaCurrency(s.expectedAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatBanglaCurrency(s.submittedAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600">{formatBanglaCurrency(s.shortAmount)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                            s.status === 'Deducted' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {s.status === 'Pending' ? 'অপেক্ষমান' : s.status === 'Deducted' ? 'বেতন থেকে কর্তিত' : 'মওকুফ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{s.remarks || '-'}</td>
                        <td className="py-2.5 px-3 text-center flex justify-center gap-1">
                          {s.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => handleWaiveShort(s.id!)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700"
                              title="মওকুফ করুন"
                            >
                              মওকুফ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteShort(s.id!)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="মুছুন"
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
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: DSR MANAGEMENT & PAYROLL CALCULATOR */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          
          {/* Section A: DSR Roster Management */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-600 p-1.5 text-white">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-sans font-bold text-base text-slate-900">
                    ১. ডিএসআর প্রোফাইল তালিকা ও বেতন স্কেল নির্ধারণ
                  </h2>
                  <p className="text-[11px] text-slate-500">ডিএসআর কর্মকর্তাদের মৌলিক তথ্য ও মাসিক নির্ধারিত স্কেল পরিচালনা করুন</p>
                </div>
              </div>
            </div>

            {/* Form to Add / Edit DSR */}
            <form onSubmit={handleSaveDsrMaster} className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 items-end">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ডিএসআর নাম <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  placeholder="যেমন: করিম উল্লাহ"
                  value={dsrName}
                  onChange={(e) => setDsrName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  মোবাইল নম্বর
                </label>
                <input 
                  type="text"
                  placeholder="018XXXXXXXX"
                  value={dsrPhone}
                  onChange={(e) => setDsrPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  পদবী
                </label>
                <input 
                  type="text"
                  value={dsrDesignation}
                  onChange={(e) => setDsrDesignation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  মাসিক মূল বেতন (৳)
                </label>
                <input 
                  type="number"
                  min="0"
                  value={dsrSalary}
                  onChange={(e) => setDsrSalary(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full flex h-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold shadow-xs transition"
                  title="সংরক্ষণ করুন"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* DSR Roster Grid Cards */}
            {salesmen.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                কোনো ডিএসআর কর্মকর্তা নিবন্ধিত নেই। নতুন ডিএসআর যুক্ত করতে উপরের ফর্মটি ব্যবহার করুন।
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {salesmen.map((dsr) => (
                  <div key={dsr.id} className="rounded-xl border border-slate-200 bg-white p-3.5 flex justify-between items-center shadow-2xs hover:border-indigo-300 transition">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                        {dsr.name}
                      </h4>
                      <p className="text-[10px] text-slate-500">{dsr.designation || 'DSR Officer'} • {dsr.phone || 'মোবাইল নেই'}</p>
                      <p className="text-[11px] font-black text-indigo-700 mt-1 font-mono">
                        মূল বেতন: {formatBanglaCurrency(dsr.monthlySalary || 0)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditDsr(dsr)}
                        className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDsr(dsr.id!)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Monthly Payroll Calculator & Salary Slip Generator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-600 p-1.5 text-white">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-sans font-bold text-base text-slate-900">
                    ২. ডিএসআর মাসিক পে-রোল ও সমন্বিত শর্ট/এডভান্স লেজার
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    হাজিরা দিন, মূল বেতন, তারিখভিত্তিক শর্টেজ ও অগ্রিম ট্রানজেকশন অটো সমন্বয় করে নিট বেতন নির্ধারণ
                  </p>
                </div>
              </div>

              {payrollDsrId && targetPayrollDsr && (
                <button
                  type="button"
                  onClick={() => setShowAddAdvance(!showAddAdvance)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  নতুন অগ্রিম (Advance) যোগ করুন
                </button>
              )}
            </div>

            {/* Quick Add Advance Modal / Form */}
            {showAddAdvance && (
              <form onSubmit={handleSaveQuickAdvance} className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-amber-900 border-b border-amber-200 pb-2">
                  <span>নতুন ডিএসআর অগ্রিম (Advance) এন্ট্রি করুন</span>
                  <button type="button" onClick={() => setShowAddAdvance(false)} className="text-amber-700 hover:text-amber-900">✕</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">তারিখ</label>
                    <input 
                      type="date"
                      value={newAdvDate}
                      onChange={(e) => setNewAdvDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs font-bold focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">পরিমাণ (৳)</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder="যেমন: ২০০০"
                      value={newAdvAmount}
                      onChange={(e) => setNewAdvAmount(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs font-bold text-amber-900 focus:outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ভাউচার / রেফারেন্স নং</label>
                    <input 
                      type="text"
                      placeholder="যেমন: ADV-101"
                      value={newAdvVoucher}
                      onChange={(e) => setNewAdvVoucher(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">বিবরণ / কারণ</label>
                    <input 
                      type="text"
                      placeholder="যেমন: বাসা ভাড়া বাবদ অগ্রিম"
                      value={newAdvRemarks}
                      onChange={(e) => setNewAdvRemarks(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setShowAddAdvance(false)} 
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                  >
                    অগ্রিম সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            )}

            {payrollSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900 shadow-xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{payrollSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              
              {/* Form Inputs: 5 Cols */}
              <div className="lg:col-span-5 space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Month */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      মাসিক পে-রোল মাস (Month)
                    </label>
                    <input 
                      type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Select DSR */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ডিএসআর নির্বাচন করুন <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      value={payrollDsrId}
                      onChange={(e) => setPayrollDsrId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- ডিএসআর বেছে নিন --</option>
                      {salesmen.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} (মূল: ৳{s.monthlySalary || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Total Days */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      মাসের মোট দিন
                    </label>
                    <input 
                      type="number"
                      value={totalDaysInMonth}
                      onChange={(e) => setTotalDaysInMonth(parseInt(e.target.value) || 30)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-center focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Present Days */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      উপস্থিতি (Present Days)
                    </label>
                    <input 
                      type="number"
                      value={presentDays}
                      onChange={(e) => setPresentDays(parseInt(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-center focus:border-emerald-500 focus:outline-none text-emerald-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Commission/Bonus */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      (+) কমিশন / বোনাস (৳)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={commissionBonus}
                      onChange={(e) => setCommissionBonus(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-emerald-700 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* General Advance Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      (-) সাধারণ অগ্রিম (Advance) (৳)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={advanceTaken}
                      onChange={(e) => setAdvanceTaken(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-amber-700 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Salary Calculation Formula Breakdown Card */}
                {targetPayrollDsr && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700 font-bold">
                      <span>মাসিক নির্ধারিত মূল বেতন:</span>
                      <span className="font-mono text-slate-900">{formatBanglaCurrency(baseMonthlySalary)}</span>
                    </div>
                    <div className="flex justify-between text-indigo-900 font-bold">
                      <span>অর্জিত বেতন হিসাব:</span>
                      <span className="font-mono">({formatBanglaCurrency(baseMonthlySalary)} / {totalDaysInMonth}) × {presentDays}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-black border-t border-indigo-200/60 pt-1">
                      <span>অর্জিত মূল বেতন:</span>
                      <span className="font-mono">{formatBanglaCurrency(earnedBaseSalary)}</span>
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মন্তব্য
                  </label>
                  <input 
                    type="text"
                    placeholder="যেমন: মাসিক চূড়ান্ত বেতন অনুমোদন"
                    value={payrollRemarks}
                    onChange={(e) => setPayrollRemarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Salary Ledger & Voucher Printable Output: 7 Cols */}
              <div className="lg:col-span-7 space-y-4" id="printable-salary-slip">
                <div className="rounded-2xl border-2 border-slate-800 bg-white p-5 shadow-md space-y-4 relative overflow-hidden">
                  
                  {/* Watermark / Header */}
                  <div className="text-center border-b border-slate-200 pb-3">
                    <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
                      ফ্রেন্ডস এন্টারপ্রাইজ (FRIENDS ENTERPRISE)
                    </h3>
                    <p className="text-[11px] font-bold text-indigo-700">ডিএসআর মাসিক পে-রোল ও সমন্বিত শর্ট/এডভান্স বিবরণী</p>
                    <p className="text-[10px] text-slate-500">খাতুনগঞ্জ, চট্টগ্রাম • হটলাইন: ০১৮৩৫৯১২৫৯৭</p>
                  </div>

                  {/* DSR Info Block */}
                  {targetPayrollDsr ? (
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">ডিএসআর নাম:</span>
                        <span className="font-black text-slate-900">{targetPayrollDsr.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">মাস ও সাল:</span>
                        <span className="font-mono font-bold text-indigo-700">{payrollMonth}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">পদবী:</span>
                        <span className="font-bold text-slate-800">{targetPayrollDsr.designation || 'DSR Officer'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">উপস্থিতি:</span>
                        <span className="font-bold text-emerald-700">{formatBanglaNumber(presentDays)} / {formatBanglaNumber(totalDaysInMonth)} দিন</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-400 text-xs italic">
                      বিবরণী দেখতে একজন ডিএসআর নির্বাচন করুন
                    </div>
                  )}

                  {/* Unified Date-wise Ledger Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                      <h4 className="font-bold text-xs text-slate-900">
                        ১. তারিখভিত্তিক শর্টেজ ও এডভান্স বিবরণী (Unified Date-wise Ledger)
                      </h4>
                      <span className="text-[10px] text-indigo-600 font-mono font-bold">
                        {activeUnifiedLedger.length} টি সক্রিয় লেনদেন
                      </span>
                    </div>

                    {activeUnifiedLedger.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        এই মাসে কোনো শর্টেজ বা অগ্রিম ট্রানজেকশন নেই।
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                              <th className="py-2 px-2.5">তারিখ</th>
                              <th className="py-2 px-2.5 text-center">ধরন</th>
                              <th className="py-2 px-2.5">রেফারেন্স / ভাউচার</th>
                              <th className="py-2 px-2.5">বিবরণ</th>
                              <th className="py-2 px-2.5 text-right">পরিমাণ (৳)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {activeUnifiedLedger.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-1.5 px-2.5 font-mono text-slate-600">{item.date}</td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                    item.type === 'Shortage' 
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                                  }`}>
                                    {item.typeLabel}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 font-mono text-slate-700">{item.refNo}</td>
                                <td className="py-1.5 px-2.5 text-slate-800">{item.remarks}</td>
                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                  {formatBanglaCurrency(item.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                              <td colSpan={4} className="py-2 px-2.5 text-slate-700 text-right">
                                মোট শর্টেজ: <span className="text-rose-600 font-mono">{formatBanglaCurrency(totalMonthShortDeduction)}</span> | মোট এডভান্স: <span className="text-amber-700 font-mono">{formatBanglaCurrency(totalMonthAdvance)}</span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-black text-rose-700">
                                = {formatBanglaCurrency(totalDeductions)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Settlement Summary Breakdown Box */}
                  <div className="space-y-2 text-xs border-y border-slate-200 py-3 bg-slate-50/50 p-3 rounded-xl">
                    <h4 className="font-bold text-xs text-slate-900 border-b border-slate-200 pb-1">
                      ২. চূড়ান্ত বেতন ও সমন্বিত দেনা হিসাব (Settlement Summary)
                    </h4>
                    <div className="flex justify-between text-slate-600">
                      <span>মাসিক নির্ধারিত মূল বেতন:</span>
                      <span className="font-mono font-bold">{formatBanglaCurrency(baseMonthlySalary)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>অর্জিত মূল বেতন ({presentDays}/{totalDaysInMonth} দিন):</span>
                      <span className="font-mono">{formatBanglaCurrency(earnedBaseSalary)}</span>
                    </div>
                    {commBonusNum > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>(+) কমিশন / পারফরম্যান্স বোনাস:</span>
                        <span className="font-mono">+{formatBanglaCurrency(commBonusNum)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-slate-900 border-t border-dashed border-slate-200 pt-1">
                      <span>সর্বমোট অর্জিত গ্রস বেতন:</span>
                      <span className="font-mono">{formatBanglaCurrency(grossEarnedSalary)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>(-) মোট শর্টেজ / ঘাটতি কর্তন:</span>
                      <span className="font-mono">-{formatBanglaCurrency(totalMonthShortDeduction)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>(-) মোট অগ্রিম গ্রহণ কর্তন (Advances):</span>
                      <span className="font-mono">-{formatBanglaCurrency(totalMonthAdvance)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-extrabold border-t border-slate-200 pt-1">
                      <span>সর্বমোট কর্তন (Total Deductions):</span>
                      <span className="font-mono">-{formatBanglaCurrency(totalDeductions)}</span>
                    </div>
                  </div>

                  {/* Final Net Payable Total */}
                  <div className="bg-slate-900 text-white rounded-xl p-3 flex justify-between items-center shadow-sm">
                    <div>
                      <span className="text-xs font-bold block">সর্বমোট প্রদেয় নিট বেতন (Net Payable):</span>
                      <span className="text-[10px] text-slate-400">অর্জিত গ্রস বেতন - সর্বমোট কর্তন</span>
                    </div>
                    <span className="text-xl font-black font-mono text-emerald-400">
                      {formatBanglaCurrency(netPayableSalary)}
                    </span>
                  </div>

                  {/* Signatures for Print */}
                  <div className="hidden print:grid grid-cols-3 gap-4 pt-8 text-center text-xs font-bold text-slate-800 border-t border-slate-300 mt-6">
                    <div>
                      <div className="border-t border-slate-400 pt-1">প্রস্তুতকারীর স্বাক্ষর</div>
                    </div>
                    <div>
                      <div className="border-t border-slate-400 pt-1">ডিএসআর গ্রহীতার স্বাক্ষর</div>
                    </div>
                    <div>
                      <div className="border-t border-slate-400 pt-1">অনুমোদনকারীর স্বাক্ষর</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 print:hidden">
                    <button
                      type="button"
                      onClick={handlePostPayroll}
                      disabled={isProcessingPayroll || !payrollDsrId}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isProcessingPayroll ? 'প্রক্রিয়াধীন...' : 'বেতন ভাউচার পরিশোধ করুন'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintSlip}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 transition"
                    >
                      <Printer className="h-4 w-4" />
                      প্রিন্ট স্লিপ (A4)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Payroll Vouchers Table */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                পূর্ববর্তী বেতন পরিশোধের ইতিহাস (Payroll History)
              </h3>

              {payrolls.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  কোনো বেতন ভাউচার সংরক্ষিত নেই।
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">পরিশোধ তারিখ</th>
                        <th className="py-2.5 px-3">ডিএসআর নাম</th>
                        <th className="py-2.5 px-3">মাস</th>
                        <th className="py-2.5 px-3 text-center">উপস্থিতি</th>
                        <th className="py-2.5 px-3 text-right">বোনাস</th>
                        <th className="py-2.5 px-3 text-right">শর্ট কর্তন</th>
                        <th className="py-2.5 px-3 text-right">নিট প্রদেয়</th>
                        <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                      {payrolls.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-500">{p.paymentDate || '-'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{p.dsrName}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{p.month}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">{formatBanglaNumber(p.presentDays)}/{formatBanglaNumber(p.totalDaysInMonth)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{formatBanglaCurrency(p.commissionBonus)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">{formatBanglaCurrency(p.shortDeduction)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">{formatBanglaCurrency(p.netPayableSalary)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {p.paymentStatus === 'Paid' ? 'পরিশোধিত' : 'অপেক্ষমান'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Icon component alias
function SaveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}
