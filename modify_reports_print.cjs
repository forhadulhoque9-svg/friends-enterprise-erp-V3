const fs = require('fs');
let code = fs.readFileSync('src/modules/reports/ReportsModule.tsx', 'utf8');

const configLines = `  const config = useLiveQuery(() => db.config.get('main'));
  const compName = config?.companyName || 'Friends Enterprise';
  const compAddress = config?.address || 'Khatunganj, Chittagong, Bangladesh';
`;

// Insert after `const currentCash = ...`
code = code.replace(/const currentCash = useLiveQuery\(\(\) => getCashBalance\(\)\) \|\| 0;/, "const currentCash = useLiveQuery(() => getCashBalance()) || 0;\n" + configLines);

// Now for the print view
const printView = `
      {/* ----------------- PRINT VIEW (ONLY VISIBLE ON PRINT) ----------------- */}
      <div className="hidden print:block font-sans text-slate-900 bg-white min-h-screen">
        <div className="text-center pb-4 border-b-2 border-slate-900 mb-6">
          <h1 className="text-2xl font-black">{compName}</h1>
          <p className="text-sm font-medium">{compAddress}</p>
          <h2 className="text-xl font-bold mt-4 underline decoration-slate-400 underline-offset-4">মাসিক আয়-ব্যয় ও লাভ-ক্ষতির বিবরণী</h2>
          <p className="text-xs font-bold mt-2">
            তারিখ সীমা: {dateFilter === 'today' ? 'আজ' : dateFilter === 'this_week' ? 'চলতি সপ্তাহ' : dateFilter === 'this_month' ? 'চলতি মাস' : dateFilter === 'custom' ? \`\${customStartDate} থেকে \${customEndDate}\` : 'সব সময়'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">প্রিন্ট সময়: {new Date().toLocaleString()}</p>
        </div>

        <div className="space-y-4">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold">(+) মোট ইনভয়েস বিক্রয় (Gross Sales)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono font-bold">{formatBanglaCurrency(totalGrossSales)}</td>
              </tr>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold text-slate-600">(-) বিক্রয় ফেরত ও ড্যামেজ ছাড় (Damage & Sales Returns)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono text-slate-600">- {formatBanglaCurrency(totalSalesReturns)}</td>
              </tr>
              <tr className="bg-slate-100">
                <td className="py-2 px-2 font-black">= নিট বিক্রয় আয় (Net Sales Revenue)</td>
                <td className="py-2 px-2 text-right font-mono font-black">{formatBanglaCurrency(totalNetSales)}</td>
              </tr>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold text-slate-600">(-) বিক্রিত পণ্যের মূল ক্রয়মূল্য (COGS)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono text-slate-600">- {formatBanglaCurrency(totalCOGS)}</td>
              </tr>
              <tr className="bg-emerald-50">
                <td className="py-2 px-2 font-black text-emerald-900">= পণ্য বিক্রির নিট লাভ (Gross Profit)</td>
                <td className="py-2 px-2 text-right font-mono font-black text-emerald-900">{formatBanglaCurrency(grossProfit)}</td>
              </tr>
              <tr>
                <td className="py-2 border-b border-slate-300 font-bold">(+) কোম্পানি ইনসেন্টিভ ও ক্লেইম জমা (Incentive & Claims)</td>
                <td className="py-2 border-b border-slate-300 text-right font-mono font-bold text-emerald-700">+ {formatBanglaCurrency(totalIncentiveIncome)}</td>
              </tr>
              <tr>
                <td className="py-4 font-black underline" colSpan={2}>পরিচালন খরচ ব্রেকডাউন (Operating Expenses):</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">ডিএসআর/টিএ-ডিএ খরচ</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(dsrExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">গাড়ি ও পরিবহন খরচ</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(transportExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">গ্যারেজ ও গোডাউন ভাড়া</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(rentExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700">স্টাফ ও অফিস খরচ</td>
                <td className="py-1 text-right font-mono text-slate-700">{formatBanglaCurrency(staffExpenses)}</td>
              </tr>
              <tr>
                <td className="py-1 pl-4 text-slate-700 border-b border-slate-300">ইউটিলিটি ও অন্যান্য খরচ</td>
                <td className="py-1 border-b border-slate-300 text-right font-mono text-slate-700">{formatBanglaCurrency(utilityExpenses)}</td>
              </tr>
              <tr className="bg-rose-50">
                <td className="py-2 px-2 font-black text-rose-900">= মোট পরিচালন খরচ (Total Operating Expenses)</td>
                <td className="py-2 px-2 text-right font-mono font-black text-rose-900">- {formatBanglaCurrency(totalOperatingExpenses)}</td>
              </tr>
              <tr className="border-t-2 border-slate-900 border-b-4">
                <td className="py-4 px-2 text-lg font-black uppercase">চূড়ান্ত নিট লাভ / ক্ষতি (NET OPERATING PROFIT / LOSS)</td>
                <td className="py-4 px-2 text-right font-mono text-xl font-black">{formatBanglaCurrency(netOperatingProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-32 grid grid-cols-3 gap-8 text-center text-sm font-bold">
          <div className="border-t border-slate-400 pt-2">প্রস্তুতকারক (Prepared By)</div>
          <div className="border-t border-slate-400 pt-2">হিসাবরক্ষক (Accountant)</div>
          <div className="border-t border-slate-400 pt-2">স্বত্বাধিকারী/ম্যানেজার (Proprietor/Manager)</div>
        </div>
      </div>
      {/* ----------------- END PRINT VIEW ----------------- */}

      {/* NORMAL VIEW (HIDDEN ON PRINT) */}
      <div className="print:hidden space-y-6">
`;

code = code.replace(/<div className="max-w-6xl mx-auto space-y-6" id="reports-module">/, '<div className="max-w-6xl mx-auto space-y-6" id="reports-module">\n' + printView);

code = code.replace(/    <\/div>\n  \);\n}/, '      </div>\n    </div>\n  );\n}');

// Also change the print button text to "প্রিন্ট বিবরণী (Print)"
code = code.replace(/<Printer className="h-3.5 w-3.5" \/> প্রিন্ট স্টেটমেন্ট \(Print\)/g, '<Printer className="h-3.5 w-3.5" /> প্রিন্ট বিবরণী (Print)');

fs.writeFileSync('src/modules/reports/ReportsModule.tsx', code);
