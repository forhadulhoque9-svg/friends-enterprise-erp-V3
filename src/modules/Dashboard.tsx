import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getCashBalance } from '../db/db';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Users, 
  Layers, 
  Scale, 
  TrendingDown, 
  AlertTriangle,
  Receipt,
  Calendar,
  Wallet,
  Package,
  Clock,
  PlusCircle,
  Download,
  Building,
  CheckCircle2,
  Sparkles,
  ArrowRightLeft,
  Briefcase,
  Phone,
  Edit2,
  Check,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  onNavigate: (module: string) => void;
}

// Convert English numerals to Bangla numerals
export function toBanglaNumerals(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  const str = String(num);
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

// Format currency as ৳ formatted with Bangla numerals
export function formatBanglaCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  const isNegative = amount < 0;
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `${isNegative ? '-' : ''}৳ ${toBanglaNumerals(formatted)}`;
}

// Format plain numbers in Bangla
export function formatBanglaNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) num = 0;
  return toBanglaNumerals(num.toLocaleString('en-US'));
}

// Format dates in Bangla (e.g. ২৩ জুলাই, ২০২৬)
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

// Circular Progress Bar Component
function CircularProgress({ percent, size = 68, strokeWidth = 7 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  let colorClass = "stroke-emerald-600 text-emerald-600";
  if (percent < 50) colorClass = "stroke-amber-500 text-amber-600";
  if (percent >= 80) colorClass = "stroke-emerald-600 text-emerald-600";

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={`${colorClass} transition-all duration-700 ease-out`}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-sans text-xs font-black text-slate-800">
        {toBanglaNumerals(percent)}%
      </span>
    </div>
  );
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('01835912597');
  const [mobileInput, setMobileInput] = useState<string>('01835912597');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);

  const metrics = useLiveQuery(async () => {
    const products = await db.products.toArray();
    const productBatches = await db.productBatches.toArray();
    const customers = await db.customers.toArray();
    const companies = await db.companies.toArray();
    const invoices = await db.salesInvoices.toArray();
    const purchases = await db.purchaseInvoices.toArray();
    const hawlats = await db.hawlats.toArray();
    const claims = await db.companyClaims.toArray();
    const damages = await db.companyDamages.toArray();
    const companyTargets = await db.companyTargets.toArray();
    const expenses = await db.expenses.toArray();
    const cashTransactions = await db.cashBook.toArray();

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM

    // ১. আজকের ব্যবসা (Today's Business)
    const todayInvoices = invoices.filter(inv => inv.date === todayStr || inv.date?.startsWith(todayStr));
    const todayTotalSales = todayInvoices.reduce((acc, inv) => acc + (inv.netTotal || 0), 0);
    const todayCashSales = todayInvoices.reduce((acc, inv) => acc + (inv.cashPaid || 0), 0);
    const todayCreditSales = todayInvoices.reduce((acc, inv) => acc + Math.max(0, (inv.netTotal || 0) - (inv.cashPaid || 0)), 0);
    const todayInvoiceCount = todayInvoices.length;

    // Today's collections from cashBook & invoices
    const todayCashBookCollections = cashTransactions
      .filter(tx => (tx.date === todayStr || tx.date?.startsWith(todayStr)) && (tx.type === 'Sales_Collection' || tx.cashIn > 0))
      .reduce((acc, tx) => acc + (tx.cashIn || 0), 0);
    
    // Total today's collection (cash received today)
    const todayTotalCollection = todayCashBookCollections > 0 ? todayCashBookCollections : todayCashSales;

    // ২. কোম্পানির কর্মক্ষমতা (Company Performance)
    const daysPassedInMonth = Math.max(1, new Date().getDate());
    const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const remainingDaysInMonth = Math.max(0, totalDaysInMonth - daysPassedInMonth);

    // Create map of company products for accurate sales attribution
    const productCompanyMap: Record<string, string> = {};
    products.forEach(p => {
      if (p.id) productCompanyMap[p.id] = p.companyId || p.brand || '';
    });

    // Month sales by company
    const companyMonthSalesMap: Record<string, number> = {};
    companies.forEach(c => { companyMonthSalesMap[c.id || c.name] = 0; });

    invoices.forEach(inv => {
      if (inv.date && inv.date.startsWith(currentMonthStr)) {
        if (inv.items && inv.items.length > 0) {
          inv.items.forEach(item => {
            const compId = productCompanyMap[item.productId] || '';
            const matchedCompany = companies.find(c => c.id === compId || c.name === compId || c.name === item.name);
            const key = matchedCompany ? (matchedCompany.id || matchedCompany.name) : (companies[0]?.id || 'default');
            companyMonthSalesMap[key] = (companyMonthSalesMap[key] || 0) + (item.itemTotal || item.total || 0);
          });
        } else {
          // If invoice has companyName or general fallback
          const matchedCompany = companies.find(c => c.name === (inv as any).companyName);
          const key = matchedCompany ? (matchedCompany.id || matchedCompany.name) : (companies[0]?.id || 'default');
          companyMonthSalesMap[key] = (companyMonthSalesMap[key] || 0) + (inv.netTotal || 0);
        }
      }
    });

    const companyPerformances = companies.map(c => {
      const compId = c.id || c.name;
      const salesToDate = companyMonthSalesMap[compId] || 0;
      
      // Target lookup or default
      const targetRecord = companyTargets.find(t => (t.refId === c.id || t.refName === c.name) && t.month === currentMonthStr);
      const monthlyTarget = targetRecord ? targetRecord.primaryTarget : (c.outstandingBalance > 0 ? c.outstandingBalance * 2 : 0);

      const achievementPercent = monthlyTarget > 0 ? Math.min(100, Math.round((salesToDate / monthlyTarget) * 100)) : 0;
      const remainingTarget = Math.max(0, monthlyTarget - salesToDate);
      
      const avgDailySales = Math.round(salesToDate / daysPassedInMonth);
      const projectedSales = Math.round((salesToDate / daysPassedInMonth) * totalDaysInMonth);
      const projectedAchievementPercent = monthlyTarget > 0 ? Math.round((projectedSales / monthlyTarget) * 100) : 0;
      const requiredDailySales = (remainingDaysInMonth > 0 && remainingTarget > 0) 
        ? Math.round(remainingTarget / remainingDaysInMonth) 
        : 0;

      let statusBadge: { label: string; key: 'ahead' | 'ontrack' | 'behind' } = {
        label: 'সঠিক পথে (On Track)',
        key: 'ontrack'
      };

      if (monthlyTarget > 0) {
        if (projectedAchievementPercent >= 100 || salesToDate >= monthlyTarget) {
          statusBadge = { label: 'এগিয়ে আছে (Ahead)', key: 'ahead' };
        } else if (projectedAchievementPercent >= 85) {
          statusBadge = { label: 'সঠিক পথে (On Track)', key: 'ontrack' };
        } else {
          statusBadge = { label: 'পিছিয়ে আছে (Behind)', key: 'behind' };
        }
      }

      return {
        id: c.id,
        name: c.name,
        monthlyTarget,
        salesToDate,
        achievementPercent,
        remainingTarget,
        avgDailySales,
        projectedSales,
        projectedAchievementPercent,
        requiredDailySales,
        daysPassedInMonth,
        totalDaysInMonth,
        remainingDaysInMonth,
        statusBadge
      };
    });

    // Load saved phone number from config or default profile
    const erpConfig = await db.config.get('main');
    const allProfiles = await db.businessProfiles.toArray();
    const defaultProfile = allProfiles.find(p => p.isDefault);
    const savedMobile = erpConfig?.phone || defaultProfile?.phone || localStorage.getItem('erp_mobile_number') || '01835912597';

    // Calculate aggregated company performance for Pie Chart
    const totalTargetAcrossCompanies = companyPerformances.reduce((acc, c) => acc + (c.monthlyTarget || 0), 0);
    const totalAchievedAcrossCompanies = companyPerformances.reduce((acc, c) => acc + (c.salesToDate || 0), 0);
    const totalRemainingAcrossCompanies = Math.max(0, totalTargetAcrossCompanies - totalAchievedAcrossCompanies);
    const overallAchievementPercent = totalTargetAcrossCompanies > 0 
      ? Math.min(100, Math.round((totalAchievedAcrossCompanies / totalTargetAcrossCompanies) * 100)) 
      : 0;

    // ৩. আর্থিক সারাংশ (Financial Summary)
    const cashBalance = await getCashBalance();
    const totalReceivables = customers.reduce((acc, c) => acc + (c.outstandingBalance > 0 ? c.outstandingBalance : 0), 0);
    const totalPayables = companies.reduce((acc, c) => acc + (c.outstandingBalance > 0 ? c.outstandingBalance : 0), 0);
    const hawlatCashNet = hawlats.reduce((acc, h) => acc + (h.cashBalance || 0), 0);

    // ৪. স্টক সারাংশ (Stock Summary)
    const totalStockValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.purchasePrice || p.edp || 0)), 0);
    const lowStockCount = products.filter(p => (p.stock || 0) <= (p.reorderLevel || 20) && (p.stock || 0) > 0).length;
    const outOfStockCount = products.filter(p => (p.stock || 0) <= 0).length;

    // Expiring soon count (within 30 days)
    const nowTime = new Date().getTime();
    const thirtyDaysTime = nowTime + 30 * 24 * 60 * 60 * 1000;
    const expiringSoonCount = productBatches.filter(b => {
      if (!b.expiryDate) return false;
      const expTime = new Date(b.expiryDate).getTime();
      return expTime >= nowTime && expTime <= thirtyDaysTime && ((b.availableStock || 0) > 0 || (b.currentStock || 0) > 0);
    }).length;

    const lowStockItems = products.filter(p => (p.stock || 0) <= (p.reorderLevel || 20)).slice(0, 6);

    // ৫. লাভ (Profit Summary)
    let todayGrossProfit = 0;
    todayInvoices.forEach(inv => {
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach(item => {
          if (item.netProfit !== undefined) {
            todayGrossProfit += item.netProfit;
          } else {
            const qty = item.quantity || item.qty || 0;
            const rate = item.rate || item.price || 0;
            const edp = item.edp || item.dp || item.price || 0;
            todayGrossProfit += (rate - edp) * qty - (item.discount || 0);
          }
        });
      } else {
        todayGrossProfit += (inv.netTotal || 0) * 0.1; // fallback 10% estimation
      }
    });

    const todayExpenses = expenses
      .filter(exp => exp.date === todayStr || exp.date?.startsWith(todayStr))
      .reduce((acc, exp) => acc + (exp.amount || 0), 0);
    
    const todayProfit = todayGrossProfit - todayExpenses;

    // Month Profit
    let monthGrossProfit = 0;
    const monthInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(currentMonthStr));
    monthInvoices.forEach(inv => {
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach(item => {
          if (item.netProfit !== undefined) {
            monthGrossProfit += item.netProfit;
          } else {
            const qty = item.quantity || item.qty || 0;
            const rate = item.rate || item.price || 0;
            const edp = item.edp || item.dp || item.price || 0;
            monthGrossProfit += (rate - edp) * qty - (item.discount || 0);
          }
        });
      } else {
        monthGrossProfit += (inv.netTotal || 0) * 0.1;
      }
    });

    const monthExpenses = expenses
      .filter(exp => exp.date && exp.date.startsWith(currentMonthStr))
      .reduce((acc, exp) => acc + (exp.amount || 0), 0);

    const monthProfit = monthGrossProfit - monthExpenses;

    // Financial Highlights
    const totalSales = invoices.reduce((acc, inv) => acc + inv.netTotal, 0);
    const totalPurchases = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
    const pendingDamageVal = damages.filter(d => d.status === 'Pending').reduce((acc, d) => acc + d.damageValue, 0);
    const activeClaimsVal = claims.filter(c => c.status !== 'Settled').reduce((acc, c) => acc + c.amount, 0);

    // Audit feed
    const combinedTx: { id: string; type: 'Sale' | 'Purchase'; ref: string; party: string; amount: number; date: string }[] = [];
    invoices.slice(-4).forEach(inv => {
      combinedTx.push({
        id: inv.id || inv.invoiceNo,
        type: 'Sale',
        ref: `#${inv.invoiceNo}`,
        party: inv.customerName,
        amount: inv.netTotal,
        date: inv.date
      });
    });

    purchases.slice(-4).forEach(pur => {
      combinedTx.push({
        id: pur.id || pur.purchaseNo,
        type: 'Purchase',
        ref: `#${pur.purchaseNo}`,
        party: pur.companyName,
        amount: pur.totalAmount,
        date: pur.date
      });
    });

    combinedTx.sort((a, b) => b.date.localeCompare(a.date));

    // Chart Data (Last 5 days)
    const dailyMap: Record<string, { date: string; Sales: number; Purchases: number }> = {};
    const last5Days = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last5Days.forEach(day => {
      const banglaLabel = formatBanglaDate(day).split(',')[0]; // e.g. ২৩ জুলাই
      dailyMap[day] = { date: banglaLabel, Sales: 0, Purchases: 0 };
    });

    invoices.forEach(inv => {
      const day = inv.date;
      if (dailyMap[day]) {
        dailyMap[day].Sales += inv.netTotal;
      }
    });

    purchases.forEach(p => {
      const day = p.date;
      if (dailyMap[day]) {
        dailyMap[day].Purchases += p.totalAmount;
      }
    });

    const chartData = Object.values(dailyMap);

    return {
      todayTotalSales,
      todayCashSales,
      todayCreditSales,
      todayTotalCollection,
      todayInvoiceCount,
      todayGrossProfit,
      todayExpenses,
      todayProfit,
      monthProfit,
      companyPerformances,
      savedMobile,
      totalTargetAcrossCompanies,
      totalAchievedAcrossCompanies,
      totalRemainingAcrossCompanies,
      overallAchievementPercent,
      cashBalance,
      totalReceivables,
      totalPayables,
      hawlatCashNet,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
      expiringSoonCount,
      lowStockItems,
      totalSales,
      totalPurchases,
      pendingDamageVal,
      activeClaimsVal,
      recentTx: combinedTx.slice(0, 5),
      chartData
    };
  });

  // Sync mobile number when metrics loaded
  useEffect(() => {
    if (metrics?.savedMobile) {
      setMobileNumber(metrics.savedMobile);
      setMobileInput(metrics.savedMobile);
    }
  }, [metrics?.savedMobile]);

  const handleSaveMobile = async () => {
    const newPhone = mobileInput.trim() || '01835912597';
    setMobileNumber(newPhone);
    setIsEditingPhone(false);
    localStorage.setItem('erp_mobile_number', newPhone);
    try {
      const existing = await db.config.get('main');
      if (existing) {
        await db.config.update('main', { phone: newPhone });
      } else {
        await db.config.add({ id: 'main', companyName: 'Friends Enterprise', phone: newPhone, address: '' });
      }
    } catch (err) {
      console.error('Failed to update phone in DB:', err);
    }
  };

  // Direct quick backup execution
  const handleQuickBackup = async () => {
    try {
      setBackupStatus('ব্যাকআপ তৈরি হচ্ছে...');
      const backupData: Record<string, any> = {};
      const tableNames = db.tables.map(t => t.name);

      for (const name of tableNames) {
        backupData[name] = await db.table(name).toArray();
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `friends_enterprise_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupStatus('ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে!');
      setTimeout(() => setBackupStatus(''), 4000);
    } catch (err) {
      alert('ব্যাকআপ নিতে সমস্যা হয়েছে: ' + err);
      setBackupStatus('');
    }
  };

  if (!metrics) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
        <p className="font-sans text-xs font-semibold text-slate-500">তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" id="dashboard-module">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-6 text-center text-white shadow-md border border-emerald-600/30">
        <p className="font-serif text-base sm:text-lg md:text-xl font-semibold tracking-wider text-emerald-100 mb-1 opacity-95">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <h1 className="font-sans font-black text-2xl sm:text-3xl text-white tracking-wide drop-shadow-sm">
          ফ্রেন্ডস এন্টারপ্রাইজ
        </h1>
        <p className="font-sans text-xs sm:text-sm text-emerald-200 mt-1 font-medium">
          পরিচালনায়: ফরহাদুল হক
        </p>

        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {/* Dynamic Mobile Number Field */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/70 px-3.5 py-1 text-xs font-semibold text-emerald-100 backdrop-blur-sm border border-emerald-500/30 shadow-xs">
            <Phone className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            {isEditingPhone ? (
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-200 text-xs font-bold">মোবাইল:</span>
                <input
                  type="text"
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMobile(); }}
                  className="w-36 rounded bg-emerald-950/90 px-2 py-0.5 text-xs text-white border border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300 font-mono"
                  placeholder="01XXXXXXXXX"
                  autoFocus
                />
                <button
                  onClick={handleSaveMobile}
                  className="rounded bg-emerald-500 hover:bg-emerald-400 p-1 text-emerald-950 font-bold transition-colors cursor-pointer"
                  title="সংরক্ষণ করুন"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingPhone(true)}
                className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group"
                title="মোবাইল নম্বর পরিবর্তন করতে ক্লিক করুন"
              >
                <span>
                  মোবাইল: {mobileNumber.startsWith('+') 
                    ? toBanglaNumerals(mobileNumber) 
                    : `+৮৮০ ${toBanglaNumerals(mobileNumber.replace(/^0/, ''))}`}
                </span>
                <Edit2 className="h-3 w-3 text-emerald-400 opacity-70 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Today's Date */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/70 px-3.5 py-1 text-[11px] font-semibold text-emerald-100 backdrop-blur-sm border border-emerald-500/30 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            আজ: {formatBanglaDate(new Date())}
          </div>
        </div>
      </div>

      {backupStatus && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {backupStatus}
        </div>
      )}

      {/* ১. এক্সিকিউটিভ সামারি (Executive Summary - 6 Core Cards) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-700 p-1.5 text-white shadow-xs">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-sans font-bold text-base text-slate-900">১. আজকের এক্সিকিউটিভ সামারি</h2>
              <p className="text-[11px] text-slate-500">মালিকের জন্য আজকের রিয়েল-টাইম ব্যবসায়িক তথ্য</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            আজকের সারসংক্ষেপ
          </span>
        </div>

        {/* 6 Executive Summary Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* ১. আজকের বিক্রয় */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 hover:bg-emerald-50 transition shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">আজকের বিক্রয়</span>
              <div className="rounded-md bg-emerald-100 p-1 text-emerald-800">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="font-sans text-base sm:text-lg font-black text-slate-900 block truncate">
                {formatBanglaCurrency(metrics.todayTotalSales)}
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 mt-0.5 block truncate">
                {formatBanglaNumber(metrics.todayInvoiceCount)} টি ইনভয়েস
              </span>
            </div>
          </div>

          {/* ২. আজকের ক্যাশ আদায় */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 hover:bg-blue-50 transition shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950">আজকের ক্যাশ আদায়</span>
              <div className="rounded-md bg-blue-100 p-1 text-blue-800">
                <Wallet className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="font-sans text-base sm:text-lg font-black text-slate-900 block truncate">
                {formatBanglaCurrency(metrics.todayTotalCollection)}
              </span>
              <span className="text-[10px] font-semibold text-blue-700 mt-0.5 block truncate">
                মোট ক্যাশ জমা
              </span>
            </div>
          </div>

          {/* ৩. আজকের বাকির বিক্রয় */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 hover:bg-amber-50 transition shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950">আজকের বাকির বিক্রয়</span>
              <div className="rounded-md bg-amber-100 p-1 text-amber-800">
                <Clock className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="font-sans text-base sm:text-lg font-black text-slate-900 block truncate">
                {formatBanglaCurrency(metrics.todayCreditSales)}
              </span>
              <span className="text-[10px] font-semibold text-amber-700 mt-0.5 block truncate">
                বাকিতে বিক্রয়
              </span>
            </div>
          </div>

          {/* ৪. আজকের গ্রস লাভ */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 hover:bg-teal-50 transition shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-950">আজকের গ্রস লাভ</span>
              <div className="rounded-md bg-teal-100 p-1 text-teal-800">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="font-sans text-base sm:text-lg font-black text-slate-900 block truncate">
                {formatBanglaCurrency(metrics.todayGrossProfit)}
              </span>
              <span className="text-[10px] font-semibold text-teal-700 mt-0.5 block truncate">
                পণ্য বিক্রয়ের গ্রস লাভ
              </span>
            </div>
          </div>

          {/* ৫. আজকের খরচ / ব্যয় */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 hover:bg-rose-50 transition shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-950">আজকের খরচ (ব্যয়)</span>
              <div className="rounded-md bg-rose-100 p-1 text-rose-800">
                <TrendingDown className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="font-sans text-base sm:text-lg font-black text-rose-900 block truncate">
                {formatBanglaCurrency(metrics.todayExpenses)}
              </span>
              <span className="text-[10px] font-semibold text-rose-700 mt-0.5 block truncate">
                আজকের মোট খরচ
              </span>
            </div>
          </div>

          {/* ৬. আজকের নিট লাভ (Net Profit) */}
          <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-100/90 via-teal-50 to-emerald-50 p-3.5 transition shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-950">আজকের নিট লাভ</span>
              <div className="rounded-md bg-emerald-700 p-1 text-white shadow-xs">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className={`font-sans text-base sm:text-lg font-black block truncate ${metrics.todayProfit >= 0 ? 'text-emerald-900' : 'text-rose-700'}`}>
                {formatBanglaCurrency(metrics.todayProfit)}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 mt-0.5 block truncate">
                গ্রস লাভ - খরচ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ২. কোম্পানি পারফরম্যান্স পূর্বাভাস (Executive Company Performance Forecast) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-700 p-2 text-white shadow-xs">
              <Building className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-sans font-black text-base text-slate-900 tracking-wide">
                ২. কোম্পানি পারফরম্যান্স পূর্বাভাস (Company Performance Forecast)
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                চলতি মাসের অর্জিত বিক্রয় (MTD) ও বর্তমান বিক্রয়ের গড় গতির ভিত্তিতে মাস শেষের পূর্বাভাস
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] font-bold text-indigo-900 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/80 shadow-2xs">
              চলতি দিন: {toBanglaNumerals(new Date().getDate())} / {toBanglaNumerals(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())} (অবশিষ্ট: {toBanglaNumerals(Math.max(0, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()))} দিন)
            </span>
            <button 
              onClick={() => onNavigate('financials')} 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              কোম্পানি লেজার →
            </button>
          </div>
        </div>

        {metrics.companyPerformances.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            কোনো সাপ্লাই কোম্পানি রেকর্ড পাওয়া যায়নি। ক্রয়ের মডিউল থেকে কোম্পানি যুক্ত করুন।
          </div>
        ) : (
          <div className="space-y-5">
            {/* Target vs Achievement Pie Chart Summary Visualizer */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3 border-b border-indigo-100/80 pb-2">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-sans font-bold text-xs text-indigo-950 uppercase tracking-wider">
                    সামগ্রিক কোম্পানি টার্গেট বনাম অর্জন বিশ্লেষণ (Overall Target Analysis)
                  </h3>
                </div>
                <span className="text-[11px] font-extrabold text-indigo-800 bg-indigo-100 px-3 py-0.5 rounded-full border border-indigo-200">
                  সামগ্রিক অর্জন: {toBanglaNumerals(metrics.overallAchievementPercent)}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Overall Target vs Achievement Pie Chart */}
                <div className="h-52 w-full relative flex flex-col items-center justify-center">
                  {metrics.totalTargetAcrossCompanies === 0 && metrics.totalAchievedAcrossCompanies === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <div className="h-20 w-20 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center mb-2">
                        <span className="text-xs font-bold text-slate-400">০%</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">কোনো সক্রিয় টার্গেট বা বিক্রয় পাওয়া যায়নি</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'অর্জিত বিক্রয় (MTD)', value: metrics.totalAchievedAcrossCompanies, color: '#10b981' },
                            { name: 'অবশিষ্ট টার্গেট', value: metrics.totalRemainingAcrossCompanies, color: '#f59e0b' }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          <Cell key="achieved" fill="#10b981" />
                          <Cell key="remaining" fill="#f59e0b" />
                        </Pie>
                        <Tooltip 
                          formatter={(val: any) => [formatBanglaCurrency(Number(val)), '']}
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Overall Company Summary Cards */}
                <div className="space-y-2 p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-2xs">
                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                    কোম্পানি সমূহের সমষ্টিগত সারাংশ
                  </h4>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="font-semibold text-emerald-950">অর্জিত বিক্রয় (১ম - আজ):</span>
                      </div>
                      <span className="font-black text-emerald-800">{formatBanglaCurrency(metrics.totalAchievedAcrossCompanies)}</span>
                    </div>

                    <div className="flex justify-between items-center bg-amber-50/80 p-2 rounded-lg border border-amber-100">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"></span>
                        <span className="font-semibold text-amber-950">অবশিষ্ট টার্গেট:</span>
                      </div>
                      <span className="font-black text-amber-800">{formatBanglaCurrency(metrics.totalRemainingAcrossCompanies)}</span>
                    </div>

                    <div className="flex justify-between items-center bg-indigo-50/80 p-2 rounded-lg border border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                        <span className="font-semibold text-indigo-950">মোট নির্ধারিত টার্গেট:</span>
                      </div>
                      <span className="font-black text-indigo-900">{formatBanglaCurrency(metrics.totalTargetAcrossCompanies)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid of Executive Company Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {metrics.companyPerformances.map(comp => (
                <div 
                  key={comp.id || comp.name} 
                  className="rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50/90 transition p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  {/* Card Header: Company Name & Status Badge */}
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <h3 className="font-sans font-black text-sm text-slate-900 truncate flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-indigo-600 shrink-0" />
                      {comp.name}
                    </h3>

                    {/* Status Badge */}
                    {comp.statusBadge.key === 'ahead' && (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        এগিয়ে আছে
                      </span>
                    )}
                    {comp.statusBadge.key === 'ontrack' && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs">
                        <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                        সঠিক পথে
                      </span>
                    )}
                    {comp.statusBadge.key === 'behind' && (
                      <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs">
                        <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                        পিছিয়ে আছে
                      </span>
                    )}
                  </div>

                  {/* Card Content Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    {/* Metrics List */}
                    <div className="sm:col-span-8 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center bg-white p-1.5 px-2 rounded-md border border-slate-200/70">
                        <span className="text-slate-600 font-medium text-[11px]">মাসিক টার্গেট:</span>
                        <span className="font-bold text-slate-900">{formatBanglaCurrency(comp.monthlyTarget)}</span>
                      </div>

                      <div className="flex justify-between items-center bg-emerald-50/80 p-1.5 px-2 rounded-md border border-emerald-100">
                        <span className="text-emerald-950 font-medium text-[11px]">অর্জিত বিক্রয় (১ম-আজ):</span>
                        <span className="font-black text-emerald-800">{formatBanglaCurrency(comp.salesToDate)}</span>
                      </div>

                      <div className="flex justify-between items-center bg-white p-1.5 px-2 rounded-md border border-slate-200/70">
                        <span className="text-slate-600 font-medium text-[11px]">গড় দৈনিক বিক্রয় ({toBanglaNumerals(comp.daysPassedInMonth)} দিনে):</span>
                        <span className="font-bold text-slate-800">{formatBanglaCurrency(comp.avgDailySales)} /দিন</span>
                      </div>

                      <div className="flex justify-between items-center bg-indigo-50/80 p-1.5 px-2 rounded-md border border-indigo-100">
                        <span className="text-indigo-950 font-medium text-[11px]">মাস শেষে সম্ভাব্য বিক্রয়:</span>
                        <div className="text-right">
                          <span className="font-black text-indigo-900 block">{formatBanglaCurrency(comp.projectedSales)}</span>
                          <span className="text-[9px] font-bold text-indigo-700 block">
                            পূর্বাভাস অর্জন: {toBanglaNumerals(comp.projectedAchievementPercent)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-amber-50/80 p-1.5 px-2 rounded-md border border-amber-100">
                        <span className="text-amber-950 font-medium text-[11px]">অবশিষ্ট টার্গেট:</span>
                        <span className="font-bold text-amber-900">{formatBanglaCurrency(comp.remainingTarget)}</span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-100/90 p-1.5 px-2 rounded-md border border-slate-200">
                        <span className="text-slate-700 font-medium text-[11px]">
                          প্রয়োজনীয় দৈনিক বিক্রয় ({toBanglaNumerals(comp.remainingDaysInMonth)} দিনে):
                        </span>
                        <span className="font-bold text-indigo-950">
                          {comp.remainingDaysInMonth > 0 && comp.remainingTarget > 0 
                            ? `${formatBanglaCurrency(comp.requiredDailySales)} /দিন` 
                            : (comp.remainingTarget === 0 ? 'টার্গেট পূর্ণ!' : 'মাস সমাপনী')}
                        </span>
                      </div>
                    </div>

                    {/* Circular Progress Indicator */}
                    <div className="sm:col-span-4 flex flex-col items-center justify-center p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs text-center">
                      <CircularProgress percent={comp.achievementPercent} size={70} strokeWidth={7} />
                      <span className="text-[10px] font-bold text-slate-700 mt-1.5">বর্তমান অর্জন</span>
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 border border-indigo-100">
                        পূর্বাভাস: {toBanglaNumerals(comp.projectedAchievementPercent)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid: ৩. আর্থিক সারাংশ + ৪. স্টক সারাংশ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ৩. আর্থিক সারাংশ (Financial Summary) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <div className="rounded-lg bg-blue-600 p-1.5 text-white shadow-xs">
                <Wallet className="h-4 w-4" />
              </div>
              <h2 className="font-sans font-bold text-base text-slate-900">৩. আর্থিক সারাংশ</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* বাজারে মোট বাকি */}
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="rounded bg-amber-100 p-1 text-amber-800">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold text-amber-950">বাজারে মোট বাকি</span>
                </div>
                <span className="text-base font-black text-amber-900 mt-2 block">{formatBanglaCurrency(metrics.totalReceivables)}</span>
                <span className="text-[10px] text-amber-700 mt-0.5 block">কাস্টমার বকেয়া</span>
              </div>

              {/* কোম্পানিকে প্রদানযোগ্য */}
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="rounded bg-indigo-100 p-1 text-indigo-800">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold text-indigo-950">কোম্পানিকে প্রদানযোগ্য</span>
                </div>
                <span className="text-base font-black text-indigo-900 mt-2 block">{formatBanglaCurrency(metrics.totalPayables)}</span>
                <span className="text-[10px] text-indigo-700 mt-0.5 block">সরবরাহকারীর পাওনা</span>
              </div>

              {/* হাতে নগদ */}
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="rounded bg-emerald-100 p-1 text-emerald-800">
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold text-emerald-950">হাতে নগদ</span>
                </div>
                <span className="text-base font-black text-emerald-900 mt-2 block">{formatBanglaCurrency(metrics.cashBalance)}</span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">ক্যাশ বই ব্যালেন্স</span>
              </div>

              {/* হাওলাত */}
              <div className="rounded-xl bg-slate-100/70 border border-slate-200 p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="rounded bg-slate-200 p-1 text-slate-800">
                    <Scale className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">হাওলাত</span>
                </div>
                <span className={`text-base font-black mt-2 block ${metrics.hawlatCashNet > 0 ? 'text-rose-700' : metrics.hawlatCashNet < 0 ? 'text-teal-700' : 'text-slate-800'}`}>
                  {formatBanglaCurrency(Math.abs(metrics.hawlatCashNet))}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {metrics.hawlatCashNet > 0 ? 'আমরা দেবো' : metrics.hawlatCashNet < 0 ? 'আমরা পাবো' : 'হাওলাত সমতা'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ৪. স্টক সারাংশ (Stock Summary) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500 p-1.5 text-white shadow-xs">
                  <Package className="h-4 w-4" />
                </div>
                <h2 className="font-sans font-bold text-base text-slate-900">৪. স্টক সারাংশ</h2>
              </div>
              <button 
                onClick={() => onNavigate('inventory')} 
                className="text-xs font-bold text-amber-700 hover:underline"
              >
                ইনভেন্টরি দেখুন →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* মোট স্টকের মূল্য */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 col-span-2">
                <span className="text-xs font-bold text-slate-500 block">মোট স্টকের মূল্য</span>
                <span className="text-lg font-black text-slate-900 mt-1 block">
                  {formatBanglaCurrency(metrics.totalStockValue)}
                </span>
                <span className="text-[10px] text-slate-400">সামগ্রিক ইনভেন্টরি ক্রয়মূল্য</span>
              </div>

              {/* কমে যাওয়া স্টক */}
              <div className="rounded-xl bg-amber-50/70 p-3.5 border border-amber-200">
                <span className="text-xs font-bold text-amber-900 block">কমে যাওয়া স্টক</span>
                <span className="text-lg font-black text-amber-800 mt-1 block">
                  {formatBanglaNumber(metrics.lowStockCount)} টি
                </span>
                <span className="text-[10px] text-amber-700">রিঅর্ডার সীমার নিচে</span>
              </div>

              {/* শেষ হয়ে যাওয়া স্টক */}
              <div className="rounded-xl bg-rose-50/70 p-3.5 border border-rose-200">
                <span className="text-xs font-bold text-rose-900 block">শেষ হয়ে যাওয়া স্টক</span>
                <span className="text-lg font-black text-rose-800 mt-1 block">
                  {formatBanglaNumber(metrics.outOfStockCount)} টি
                </span>
                <span className="text-[10px] text-rose-700">স্টক শূন্য</span>
              </div>

              {/* মেয়াদ শেষ হওয়ার পথে */}
              <div className="rounded-xl bg-purple-50/70 p-3.5 border border-purple-200 col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-purple-900 block">মেয়াদ শেষ হওয়ার পথে</span>
                    <span className="text-[10px] text-purple-700">আগামী ৩০ দিনের মধ্যে মেয়াদোত্তীর্ণ</span>
                  </div>
                  <span className="text-lg font-black text-purple-900">
                    {formatBanglaNumber(metrics.expiringSoonCount)} টি ব্যাচ
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ৬. Quick Actions (দ্রুত কাজ) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <div className="rounded-lg bg-slate-900 p-1.5 text-white shadow-xs">
            <PlusCircle className="h-4 w-4" />
          </div>
          <h2 className="font-sans font-bold text-base text-slate-900">৬. দ্রুত কাজ (Quick Actions)</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* নতুন বিক্রয় */}
          <button 
            onClick={() => onNavigate('sales')} 
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 py-3.5 px-4 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 transition shadow-xs text-center font-bold text-xs"
            id="quick-action-sales"
          >
            <div className="rounded-full bg-emerald-600 p-2 text-white">
              <PlusCircle className="h-4 w-4" />
            </div>
            <span>নতুন বিক্রয়</span>
          </button>

          {/* নতুন ক্রয় */}
          <button 
            onClick={() => onNavigate('purchases')} 
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50/60 py-3.5 px-4 text-indigo-900 hover:bg-indigo-100 hover:border-indigo-300 transition shadow-xs text-center font-bold text-xs"
            id="quick-action-purchases"
          >
            <div className="rounded-full bg-indigo-600 p-2 text-white">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span>নতুন ক্রয়</span>
          </button>

          {/* টাকা আদায় */}
          <button 
            onClick={() => onNavigate('customers')} 
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/60 py-3.5 px-4 text-blue-900 hover:bg-blue-100 hover:border-blue-300 transition shadow-xs text-center font-bold text-xs"
            id="quick-action-collection"
          >
            <div className="rounded-full bg-blue-600 p-2 text-white">
              <Wallet className="h-4 w-4" />
            </div>
            <span>টাকা আদায়</span>
          </button>

          {/* ব্যাকআপ */}
          <button 
            onClick={handleQuickBackup} 
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-slate-300 bg-slate-100/70 py-3.5 px-4 text-slate-900 hover:bg-slate-200 transition shadow-xs text-center font-bold text-xs"
            id="quick-action-backup"
          >
            <div className="rounded-full bg-slate-800 p-2 text-white">
              <Download className="h-4 w-4" />
            </div>
            <span>ব্যাকআপ</span>
          </button>
        </div>
      </div>

      {/* Analytics Chart & Secondary Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales vs Purchases Chart */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-bold text-base text-slate-900">বিক্রয় ও ক্রয়ের সংক্ষিপ্ত গ্রাফ (গত ৫ দিন)</h2>
            <span className="text-[11px] font-semibold text-slate-400">টাকায় হিসাব</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value: any) => [formatBanglaCurrency(Number(value)), '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#e2e8f0' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} name="বিক্রয় (টাকা)" />
                <Bar dataKey="Purchases" fill="#6366f1" radius={[4, 4, 0, 0]} name="ক্রয় (টাকা)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-sans font-bold text-base text-slate-900 mb-4">আর্থিক তথ্যসমূহ</h2>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-rose-50 p-1.5 text-rose-600">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">সর্বমোট ক্রয়</span>
                    <span className="text-[10px] text-slate-400">পণ্য ক্রয়ের মোট খরচ</span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-900">{formatBanglaCurrency(metrics.totalPurchases)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-emerald-50 p-1.5 text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">সর্বমোট বিক্রয়</span>
                    <span className="text-[10px] text-slate-400">সর্বমোট ইনভয়েস মূল্য</span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-900">{formatBanglaCurrency(metrics.totalSales)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-amber-50 p-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">সক্রিয় ক্লেইম সমূহের মূল্য</span>
                    <span className="text-[10px] text-slate-400">ক্ষতিগ্রস্ত বা ফেরত আইটেম</span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-900">{formatBanglaCurrency(metrics.activeClaimsVal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-teal-50 p-1.5 text-teal-600">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">অপেক্ষমান ড্যামেজ স্টক</span>
                    <span className="text-[10px] text-slate-400">ক্রেডিট অনুমোদনের অপেক্ষায়</span>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-900">{formatBanglaCurrency(metrics.pendingDamageVal)}</span>
              </div>
            </div>
          </div>

          {metrics.lowStockCount > 0 && (
            <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-900">{formatBanglaNumber(metrics.lowStockCount)} টি পণ্যের স্টক কমে গেছে!</span>
                <p className="text-[10px] text-amber-700 mt-0.5">জরুরী ভিত্তিতে নতুন অর্ডার করার পরামর্শ দেওয়া হচ্ছে।</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock Reorder Warnings & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Items Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-bold text-base text-slate-900">স্টক রিঅর্ডার সতর্কতা</h2>
            <button 
              onClick={() => onNavigate('inventory')} 
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              স্টক পরিচালনা করুন
            </button>
          </div>

          {metrics.lowStockItems.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center">
              <span className="text-xs font-semibold text-slate-400 block">সকল স্টক পর্যাপ্ত আছে</span>
              <p className="text-[10px] text-slate-400 mt-1">কোনো পণ্যের স্টক রিঅর্ডার সীমার নিচে নেই।</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto pr-1">
              {metrics.lowStockItems.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{p.name}</span>
                    <span className="text-[10px] font-sans text-slate-400 block mt-0.5">ব্র্যান্ড: {p.brand} • ক্যাটাগরি: {p.category}</span>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${p.stock <= 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                      অবশিষ্ট: {formatBanglaNumber(p.stock)} {p.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Combined Recent Audited Transactions Feed */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-bold text-base text-slate-900">সাম্প্রতিক লেনদেন</h2>
            <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              অডিট লগ
            </span>
          </div>

          {metrics.recentTx.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center">
              <span className="text-xs font-semibold text-slate-400 block">কোনো সাম্প্রতিক লেনদেন নেই</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.recentTx.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg p-1.5 text-white ${tx.type === 'Sale' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                      {tx.type === 'Sale' ? <TrendingUp className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{tx.party}</span>
                        <span className="text-[10px] text-slate-400">{toBanglaNumerals(tx.ref)}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">{formatBanglaDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${tx.type === 'Sale' ? 'text-emerald-700' : 'text-indigo-700'}`}>
                    {tx.type === 'Sale' ? '+' : '-'}{formatBanglaCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
