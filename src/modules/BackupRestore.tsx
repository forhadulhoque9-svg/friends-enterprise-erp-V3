import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from '../db/db';
import { 
  Download, 
  Upload, 
  Database, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  FileText, 
  X, 
  HardDrive, 
  Calendar, 
  Clock, 
  Boxes, 
  Users, 
  Coins, 
  Info,
  Sparkles
} from 'lucide-react';

// Bangla Numerals Converter
export function toBanglaNumerals(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  const str = String(num);
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

// Bangla Byte Size Formatter
export function formatBanglaBytes(bytes: number): string {
  if (bytes === 0) return '০ বাইট';
  if (bytes < 1024) return `${toBanglaNumerals(bytes)} বাইট`;
  if (bytes < 1024 * 1024) return `${toBanglaNumerals((bytes / 1024).toFixed(1))} কেবি`;
  return `${toBanglaNumerals((bytes / (1024 * 1024)).toFixed(2))} এমবি`;
}

// Bangla Date Time Formatter
export function formatBanglaDateTime(isoString: string | Date | null | undefined) {
  if (!isoString) return { dateStr: 'কোনো ব্যাকআপ তথ্য নেই', timeStr: '—' };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { dateStr: 'কোনো ব্যাকআপ তথ্য নেই', timeStr: '—' };

  const monthNames = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const day = toBanglaNumerals(d.getDate());
  const month = monthNames[d.getMonth()];
  const year = toBanglaNumerals(d.getFullYear());

  let hours = d.getHours();
  const minutes = toBanglaNumerals(d.getMinutes().toString().padStart(2, '0'));
  const ampm = hours >= 12 ? 'পিএম' : 'এএম';
  hours = hours % 12 || 12;
  const hoursStr = toBanglaNumerals(hours);

  return {
    dateStr: `${day} ${month}, ${year}`,
    timeStr: `${hoursStr}:${minutes} ${ampm}`
  };
}

export default function BackupRestore() {
  // Status Notifications
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Last Backup Info stored in localStorage
  const [lastBackupIso, setLastBackupIso] = useState<string | null>(() => {
    return localStorage.getItem('friends_erp_last_backup_time');
  });

  // Restore Modal & File States
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);
  const [restorePreviewData, setRestorePreviewData] = useState<{
    backupDate?: string;
    backupTime?: string;
    totalRecords?: number;
    tableCount?: number;
    rawParsed?: Record<string, any>;
  } | null>(null);

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Database Stats Queries
  const tableStats = useLiveQuery(async () => {
    const stats: Array<{ name: string; labelBangla: string; count: number }> = [];
    
    const banglaTableNames: Record<string, string> = {
      products: 'পণ্য ক্যাটালগ (Products)',
      customers: 'রিটেইলার খদ্দের (Customers)',
      customerLedgers: 'কাস্টমার লেজার (Customer Ledgers)',
      salesInvoices: 'বিক্রয় ইনভয়েস (Sales Invoices)',
      salesInvoiceItems: 'ইনভয়েস আইটেম (Invoice Items)',
      companies: 'সরবরাহকারী কোম্পানি (Companies)',
      companyLedgers: 'কোম্পানি লেজার (Company Ledgers)',
      purchaseInvoices: 'ক্রয় ইনভয়েস (Purchases)',
      purchaseInvoiceItems: 'পারচেজ আইটেম (Purchase Items)',
      companyDamages: 'ড্যামেজ স্টক (Damage Stock)',
      companyIncentives: 'কোম্পানি ইনসেনটিভ (Incentives)',
      companyClaims: 'কোম্পানি ক্লেম (Claims)',
      companySchemes: 'কোম্পানি স্কিম (Schemes)',
      hawlats: 'হাওলাত হিসাব (Hawlat Parties)',
      hawlatLedgers: 'হাওলাত লেজার (Hawlat Ledgers)',
      cashBook: 'ক্যাশ বুক (Cash Book)',
      expenses: 'খরচ ও ব্যয়ের হিসাব (Expenses)',
      expenseLedgers: 'খরচ লেজার (Expense Ledgers)',
      stockLedgers: 'স্টক লেজার (Stock Ledgers)',
      routes: 'ডিএসআর রুট (Routes)',
      routeLedgers: 'রুট লেজার (Route Ledgers)',
      demandSheets: 'ডিমান্ড ও পিকিং শিট (Demand Sheets)',
      businessProfiles: 'বিজনেস প্রোফাইল (Business Profile)',
      config: 'সিস্টেম কনফিগারেশন (Config)',
      shops: 'দোকান তালিকা (Shops)',
      shopLedgers: 'দোকান লেজার (Shop Ledgers)',
      salesTrips: 'সেলস ট্রিপ (Sales Trips)',
      companyTargets: 'কোম্পানি টার্গেট (Targets)',
      productBatches: 'পণ্য ব্যাচ (Product Batches)',
      dailySalesReports: 'দৈনিক সেলস রিপোর্ট (DSR)',
      auditLogs: 'অডিট লগ (Audit Logs)',
      failedTransactions: 'ব্যর্থ লেনদেন (Failed TX)',
      dailyKPIs: 'দৈনিক পারফরম্যান্স (KPIs)',
      configRegistry: 'কনফিগ রেজিস্ট্রি (Registry)',
      configurations: 'মাস্টার কনফিগারেশন (Master Config)',
      brands: 'ব্র্যান্ড তালিকা (Brands)',
      categories: 'ক্যাটাগরি তালিকা (Categories)',
      salesmen: 'বিক্রয় প্রতিনিধি (Salesmen)',
      deliveryMen: 'ডেলিভারি ম্যান (Delivery Men)',
      transactionJournal: 'লেনদেন জার্নাল (Journal)',
      commissionLedgers: 'কমিশন লেজার (Commission Ledgers)',
      profitLedgers: 'লাভ-ক্ষতি লেজার (Profit Ledgers)',
      returns: 'পণ্য ফেরত (Returns)',
      returnItems: 'ফেরতকৃত পণ্য (Return Items)',
      dsrShortLedgers: 'ডিএসআর শর্ট লেজার (Shortage)',
      dsrPayrolls: 'ডিএসআর পে-রোল (Payroll)'
    };

    for (const table of db.tables) {
      const count = await table.count();
      stats.push({
        name: table.name,
        labelBangla: banglaTableNames[table.name] || table.name,
        count
      });
    }

    return stats;
  }, []);

  const totalRecordCount = (tableStats || []).reduce((sum, t) => sum + t.count, 0);

  // Estimate DB size based on JSON representation
  const [estimatedDbSize, setEstimatedDbSize] = useState<number>(0);

  useEffect(() => {
    async function calculateDbSize() {
      try {
        let totalBytes = 0;
        for (const table of db.tables) {
          const records = await table.toArray();
          const jsonStr = JSON.stringify(records);
          totalBytes += jsonStr.length;
        }
        setEstimatedDbSize(totalBytes);
      } catch (err) {
        setEstimatedDbSize(0);
      }
    }
    calculateDbSize();
  }, [tableStats]);

  // 1. Execute Manual Backup
  const handleExecuteBackup = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');

      const nowIso = new Date().toISOString();
      const dt = formatBanglaDateTime(nowIso);

      const backupObject: Record<string, any> = {
        meta: {
          app: 'Friends Enterprise ERP v3',
          timestamp: nowIso,
          backupDate: dt.dateStr,
          backupTime: dt.timeStr,
          totalTables: db.tables.length,
          totalRecords: totalRecordCount
        },
        data: {}
      };

      for (const table of db.tables) {
        backupObject.data[table.name] = await table.toArray();
      }

      const jsonString = JSON.stringify(backupObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const todayYMD = nowIso.split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `friends_enterprise_erp_backup_${todayYMD}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save last backup timestamp
      localStorage.setItem('friends_erp_last_backup_time', nowIso);
      setLastBackupIso(nowIso);

      setSuccessMsg('ব্যাকআপ সফল হয়েছে');
    } catch (err: any) {
      setErrorMsg('ব্যাকআপ তৈরির সময় ত্রুটি দেখা দিয়েছে: ' + (err.message || String(err)));
    }
  };

  // 2. Select Backup File & Verify Integrity
  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setErrorMsg('ত্রুটি: ব্যাকআপ ফাইলটি খালি বা ক্ষতিগ্রস্ত!');
          return;
        }

        const parsed = JSON.parse(text);

        // Verification of backup integrity
        const isStructuredBackup = parsed && typeof parsed === 'object' && (parsed.data || parsed.products || parsed.customers);
        
        if (!isStructuredBackup) {
          setErrorMsg('ত্রুটি: ব্যাকআপ ফাইলটি ক্ষতিগ্রস্ত অথবা সঠিক ফ্রেন্ডস এন্টারপ্রাইজ ব্যাকআপ ফাইল নয়!');
          return;
        }

        // Count total records in backup
        const dataMap = parsed.data || parsed;
        let fileRecordsCount = 0;
        let tableCount = 0;

        for (const [key, val] of Object.entries(dataMap)) {
          if (key !== 'meta' && Array.isArray(val)) {
            fileRecordsCount += val.length;
            tableCount += 1;
          }
        }

        setSelectedRestoreFile(file);
        setRestorePreviewData({
          backupDate: parsed.meta?.backupDate || formatBanglaDateTime(file.lastModified ? new Date(file.lastModified) : new Date()).dateStr,
          backupTime: parsed.meta?.backupTime || formatBanglaDateTime(file.lastModified ? new Date(file.lastModified) : new Date()).timeStr,
          totalRecords: fileRecordsCount,
          tableCount: tableCount,
          rawParsed: dataMap
        });

        setIsRestoreModalOpen(true);
      } catch (err) {
        setErrorMsg('ত্রুটি: ব্যাকআপ ফাইলটি ক্ষতিগ্রস্ত অথবা সঠিক ফ্রেন্ডস এন্টারপ্রাইজ ব্যাকআপ ফাইল নয়!');
      }
    };

    reader.readAsText(file);
    // reset input value so re-selection triggers onChange
    e.target.value = '';
  };

  // 3. Confirm & Execute Restore
  const handleConfirmRestore = async () => {
    if (!restorePreviewData || !restorePreviewData.rawParsed) {
      setErrorMsg('ত্রুটি: রিস্টোর ডাটা অনুপস্থিত!');
      return;
    }

    setIsRestoring(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const dataMap = restorePreviewData.rawParsed;

      // Perform atomic restore in transaction
      await db.transaction('rw', db.tables, async () => {
        // Clear all tables
        for (const table of db.tables) {
          await table.clear();
        }

        // Populate tables
        for (const [tableName, records] of Object.entries(dataMap)) {
          if (tableName !== 'meta' && Array.isArray(records) && records.length > 0) {
            const table = db.table(tableName);
            if (table) {
              await table.bulkAdd(records);
            }
          }
        }
      });

      // Ensure config records exist
      await seedDatabase();

      setSuccessMsg('ডাটা সফলভাবে পুনরুদ্ধার হয়েছে');
      setIsRestoreModalOpen(false);
      setSelectedRestoreFile(null);
      setRestorePreviewData(null);

      // Small delay then soft reload to refresh all in-memory live queries
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      setErrorMsg('রিস্টোর করার সময় ত্রুটি দেখা দিয়েছে: ' + (err.message || String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  const lastBkInfo = formatBanglaDateTime(lastBackupIso);

  return (
    <div className="space-y-6 pb-12" id="backup-restore-module">
      
      {/* Top Banner Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-indigo-400" />
            <h1 className="font-sans font-black text-xl sm:text-2xl text-white">
              ডাটাবেজ ব্যাকআপ ও রিস্টোর সিস্টেম (Backup & Restore)
            </h1>
          </div>
          <p className="font-sans text-xs text-slate-300 mt-1">
            ফ্রেন্ডস এন্টারপ্রাইজ • ১০০% অফলাইন ব্যাকআপ ডাউনলোড, ডাটাবেজ সুরক্ষা ও রিকোভারি কেন্দ্র
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-emerald-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>অফলাইন লোকাল ইনডেক্স-ডিবি নিরাপদ</span>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-900 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 hover:text-rose-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* ১. মোট রেকর্ড */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">মোট ডাটাবেজ রেকর্ড</span>
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 block">
              {toBanglaNumerals(totalRecordCount)} টি রেকর্ড
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">সবগুলো টেবিল মিলিয়ে মোট ডাটা</p>
          </div>
        </div>

        {/* ২. ডাটাবেজ সাইজ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">ডাটাবেজের আকার (Size)</span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-900 block">
              {formatBanglaBytes(estimatedDbSize)}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">আনুমানিক সংকুচিত মেমরি সাইজ</p>
          </div>
        </div>

        {/* ৩. সর্বশেষ ব্যাকআপের তারিখ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">সর্বশেষ ব্যাকআপের তারিখ</span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm font-black text-slate-900 block truncate">
              {lastBkInfo.dateStr}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              সময়: {lastBkInfo.timeStr}
            </p>
          </div>
        </div>

        {/* ৪. মোট ডাটা টেবিল */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">মোট ইআরপি টেবিল</span>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-purple-950 block">
              {toBanglaNumerals(db.tables.length)} টি সারণী
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">সকল মডিউলের স্ট্রাকচারড টেবিল</p>
          </div>
        </div>

      </div>

      {/* Main Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Col: 1. Manual Backup & Download */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-sans font-black text-base text-slate-900">
                ম্যানুয়াল ব্যাকআপ গ্রহণ (Manual Backup)
              </h2>
              <p className="text-xs text-slate-500">
                ১-ক্লিকে সম্পূর্ণ ইআরপি ডাটাবেজের ডুপ্লিকেট ব্যাকআপ ফাইল ডাউনলোড করুন
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-3 text-xs text-slate-700">
            <span className="font-bold text-slate-900 block text-xs">
              ব্যাকআপ ফাইলে স্বয়ংক্রিয়ভাবে যেসব ডাটা অন্তর্ভুক্ত হবে:
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>পণ্যের ক্যাটালগ ও ভালো স্টক</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>ড্যামেজ স্টক ও কোম্পানি ক্লেম</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>রিটেইলার খদ্দের ও বকেয়া খতিয়ান</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>বিক্রয় ইনভয়েস ও রুট ডেলিভারি</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>আজকের কালেকশন ও ক্যাশ বুক</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>সাপ্লায়ার ক্রয় ও কোম্পানি লেজার</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>হাওলাত খতিয়ান ও লেনদেন</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>ট্রেড ফাইন্যান্স, খরচ ও সেটিংস</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExecuteBackup}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 group"
          >
            <Download className="h-4 w-4 text-emerald-400 group-hover:translate-y-0.5 transition" />
            <span>১-ক্লিকে ব্যাকআপ ডাউনলোড করুন (.json)</span>
          </button>
        </div>

        {/* Right Col: 2. Restore System */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-sans font-black text-base text-slate-900">
                ডাটা রিস্টোর ও রিকোভারি (Database Restore)
              </h2>
              <p className="text-xs text-slate-500">
                পূর্বে সেভ করা ব্যাকআপ ফাইল নির্বাচন করে সমস্ত ডাটা পুনরুদ্ধার করুন
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/70 p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>সতর্কতা ও ডাটা নিরাপত্তা নিশ্চয়তা:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              রিস্টোর করার আগে ব্যাকআপ ফাইলের নিখুঁততা (Integrity) স্বয়ংক্রিয়ভাবে পরীক্ষা করা হবে। ফাইলটি ক্ষতিগ্রস্ত হলে কোনো পরিবর্তন ছাড়াই রিস্টোর প্রক্রিয়া বাতিল হবে।
            </p>
          </div>

          <div className="relative">
            <label 
              htmlFor="restore-file-input-btn"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 py-3.5 px-4 font-bold text-xs transition shadow-xs"
            >
              <Upload className="h-4 w-4 text-indigo-700" />
              <span>ব্যাকআপ ফাইল নির্বাচন করে রিস্টোর করুন (.json)</span>
            </label>
            <input 
              type="file"
              accept=".json"
              id="restore-file-input-btn"
              onChange={handleFileSelectForRestore}
              className="hidden"
            />
          </div>
        </div>

      </div>

      {/* Database Table Records Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-700" />
            <h2 className="font-sans font-bold text-sm text-slate-900">
              ডাটাবেজ সারণী ও রেকর্ড বিবরণী (Table Breakdown)
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            মোট সারণী: {toBanglaNumerals(db.tables.length)} টি
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(tableStats || []).map(stat => (
            <div key={stat.name} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
              <div>
                <span className="font-bold text-slate-800 block">{stat.labelBangla}</span>
                <span className="text-[10px] text-slate-400 font-mono">{stat.name}</span>
              </div>
              <span className="font-black text-indigo-950 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {toBanglaNumerals(stat.count)} টি
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {isRestoreModalOpen && restorePreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-600 p-2 text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <h3 className="font-sans font-black text-base text-slate-900">
                  ডাটাবেজ রিস্টোর নিশ্চিতকরণ
                </h3>
              </div>
              <button onClick={() => setIsRestoreModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-semibold">
              আপনি কি নিশ্চিত যে বর্তমান ডাটাবেজের সমস্ত ডাটা প্রতিস্থাপন করে নির্বাচিত ব্যাকআপ ফাইলটি রিস্টোর করতে চান?
            </p>

            <div className="space-y-2 bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 text-xs font-medium">
              <div className="flex justify-between">
                <span className="text-slate-600">ব্যাকআপের তারিখ:</span>
                <span className="font-bold text-slate-900">{restorePreviewData.backupDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ব্যাকআপের সময়:</span>
                <span className="font-bold text-slate-900">{restorePreviewData.backupTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">অন্তর্ভুক্ত মোট রেকর্ড:</span>
                <span className="font-black text-indigo-900">
                  {toBanglaNumerals(restorePreviewData.totalRecords || 0)} টি রেকর্ড
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
              >
                {isRestoring ? 'রিস্টোর হচ্ছে...' : 'রিস্টোর নিশ্চিত করুন'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
