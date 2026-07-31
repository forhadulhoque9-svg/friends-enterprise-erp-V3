import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, postExpense } from '../../db/db';
import { Expense } from '../../types';
import { Calendar, Tag, User, AlignLeft, Search, Plus, Trash2, Wallet } from 'lucide-react';

export function toBanglaNumerals(number: number | string): string {
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return number.toString().replace(/\d/g, (d) => banglaDigits[parseInt(d, 10)]);
}

export function formatBanglaCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '৳ ০.০০';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '৳ ০.০০';
  
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return '৳ ' + toBanglaNumerals(formatted);
}

const EXPENSE_CATEGORIES = [
  'গাড়ি ভাড়া (Vehicle Rent)',
  'গ্যারেজ ভাড়া (Garage Rent)',
  'গোডাউন ভাড়া (Warehouse Rent)',
  'স্টাফ বেতন/ভাতা (Staff Salary)',
  'বিদ্যুৎ/ইউটিলিটি বিল (Utilities)',
  'চা/নাস্তা ও বিনোদন (Entertainment)',
  'অন্যান্য খরচ (Other Expenses)'
];

export default function DailyExpenses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number>(0);
  const [paidBy, setPaidBy] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Filter State
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) || [];

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (filterStartDate && exp.date < filterStartDate) return false;
      if (filterEndDate && exp.date > filterEndDate) return false;
      if (filterCategory !== 'All' && exp.category !== filterCategory) return false;
      return true;
    });
  }, [expenses, filterStartDate, filterEndDate, filterCategory]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (amount <= 0) {
      setError('টাকার পরিমাণ ধনাত্মক সংখ্যা হতে হবে।');
      return;
    }
    if (!category) {
      setError('ক্যাটাগরি নির্বাচন করুন।');
      return;
    }

    try {
      await postExpense(date, category, amount, remarks, paidBy);
      setSuccessMsg('খরচ সফলভাবে এন্ট্রি করা হয়েছে।');
      setIsModalOpen(false);
      setAmount(0);
      setPaidBy('');
      setRemarks('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'খরচ সেভ করতে সমস্যা হয়েছে।');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত যে এই খরচ এন্ট্রি মুছতে চান?')) {
      try {
        await db.expenses.update(id, { isDeleted: true });
        // NOTE: Soft deleting expense. Does not reverse cash book in this simple implementation
        // For a full system, you would need a reverse transaction function
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-rose-600" /> দৈনন্দিন খরচের খাতা (Daily Expense Tracking)
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
            Manage your daily operating expenses
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700 shadow-sm transition"
        >
          <Plus className="h-4.5 w-4.5" /> নতুন খরচ যোগ করুন
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold shadow-sm">
          {successMsg}
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ফিল্টার অপশন (Filters)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শুরুর তারিখ (Start Date)</label>
            <input 
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শেষ তারিখ (End Date)</label>
            <input 
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি (Category)</label>
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm focus:border-rose-500 focus:outline-none"
            >
              <option value="All">সকল ক্যাটাগরি (All)</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">তারিখ</th>
                <th className="px-4 py-3">খাত (Category)</th>
                <th className="px-4 py-3">বিবরণ</th>
                <th className="px-4 py-3">প্রদানকারী (Paid By)</th>
                <th className="px-4 py-3 text-right">টাকা (৳)</th>
                <th className="px-4 py-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.filter(e => !e.isDeleted).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold">
                    কোন খরচ পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredExpenses.filter(e => !e.isDeleted).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{exp.date}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        <Tag className="h-3 w-3" /> {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={exp.remarks}>{exp.remarks || '-'}</td>
                    <td className="px-4 py-3">{exp.paidBy || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono font-black text-rose-600">
                      {formatBanglaCurrency(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                        title="Delete"
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
        
        {/* Total Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">মোট খরচ (Total Expenses):</span>
          <span className="text-xl font-black font-mono text-rose-700">
            {formatBanglaCurrency(totalExpenseAmount)}
          </span>
        </div>
      </div>

      {/* Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50 rounded-t-2xl">
              <h3 className="font-sans font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-rose-600" /> নতুন খরচ যোগ করুন
              </h3>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    তারিখ (Date) *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold focus:border-rose-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    খাত (Category) *
                  </label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm font-semibold focus:border-rose-500 focus:outline-none"
                    required
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    টাকার পরিমাণ (Amount ৳) *
                  </label>
                  <input 
                    type="number"
                    step="any"
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm font-mono font-bold focus:border-rose-500 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কার মাধ্যমে খরচ (Paid By)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold focus:border-rose-500 focus:outline-none"
                      placeholder="e.g. Rahim"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিবরণ / নোট (Description)
                </label>
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold focus:border-rose-500 focus:outline-none"
                    placeholder="খরচের বিস্তারিত..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  বাতিল করুন
                </button>
                <button 
                  type="submit"
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700 shadow-sm transition"
                >
                  সংরক্ষণ করুন (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
