/**
 * Centered Bengali Localization Dictionary mapping english internal keys to bengali terms
 */
export const BENGALI_TRANSLATIONS: Record<string, string> = {
  // Global & General
  friendsEnterprise: 'ফ্রেন্ডস এন্টারপ্রাইজ',
  erpControlCenter: 'ইআরপি কন্ট্রোল সেন্টার',
  executiveDashboard: 'এক্সিকিউটিভ ড্যাশবোর্ড',
  stockController: 'স্টক কন্ট্রোলার',
  salesInvoicing: 'সেলস ইনভয়েসিং',
  retailCustomers: 'খুচরা ক্রেতা',
  supplierPurchases: 'সরবরাহকারী ক্রয়',
  tradeFinancials: 'ট্রেড ফাইন্যান্সিয়ালস',
  hawlatLedger: 'হাওলাত লেজার',
  skuCatalog: 'এসকেইউ ক্যাটালগ',
  erpSettings: 'ইআরপি সেটিংস',
  cashBalance: 'নগদ তহবিল',
  offlineNative: 'অফলাইন নেটিভ',
  corporateBranding: 'কর্পোরেট ব্র্যান্ডিং সেটিংস',
  applyUpdate: 'প্রয়োগ ও আপডেট করুন',
  saveSuccessful: 'সেটিংস সফলভাবে আপডেট হয়েছে!',
  search: 'অনুসন্ধান করুন',
  add: 'যোগ করুন',
  edit: 'সম্পাদনা',
  delete: 'মুছে ফেলুন',
  save: 'সংরক্ষণ করুন',
  cancel: 'বাতিল',
  remarks: 'মন্তব্য',
  date: 'তারিখ',
  actions: 'পদক্ষেপ',
  status: 'অবস্থা',
  success: 'সফল',
  error: 'ত্রুটি',
  warning: 'সতর্কতা',
  lowStockAlert: 'কম স্টক সতর্কতা',

  // Dashboard Tab
  totalSales: 'মোট বিক্রি',
  totalCollection: 'মোট আদায়',
  totalDue: 'মোট বকেয়া',
  totalPurchases: 'মোট ক্রয়',
  cashBookSummary: 'ক্যাশ বুক সংক্ষেপ',
  recentTransactions: 'সাম্প্রতিক লেনদেনসমূহ',
  financialPerformance: 'আর্থিক কার্যকারিতা',
  quickAccess: 'দ্রুত প্রবেশ করুন',

  // SKU Tab
  skuCode: 'এসকেইউ কোড',
  productName: 'পণ্যের নাম',
  brandName: 'ব্র্যান্ডের নাম',
  category: 'ক্যাটাগরি',
  purchasePrice: 'ক্রয় মূল্য (DP)',
  edpPrice: 'কার্যকরী ক্রয় মূল্য (EDP)',
  retailPrice: 'বিক্রয় মূল্য (MRP)',
  currentStock: 'বর্তমান স্টক',
  unitType: 'ইউনিট',
  addSku: 'নতুন পণ্য যোগ করুন',
  editSku: 'পণ্য সম্পাদন করুন',

  // Customer Tab
  customerName: 'ক্রেতার নাম',
  phone: 'মোবাইল নম্বর',
  address: 'ঠিকানা',
  creditLimit: 'ক্রেডিট লিমিট',
  outstanding: 'মোট বকেয়া',
  addCustomer: 'নতুন খুচরা ক্রেতা যোগ করুন',
  editCustomer: 'ক্রেতার তথ্য পরিবর্তন করুন',
  ledgerRecord: 'লেজার রেকর্ডসমূহ',
  debit: 'ডেবিট (বিক্রি)',
  credit: 'ক্রেডিট (আদায়/ফেরত)',
  runningBalance: 'চলতি জের',

  // Sales Tab
  invoiceNo: 'ইনভয়েস নং',
  selectCustomer: 'ক্রেতা নির্বাচন করুন',
  selectProduct: 'পণ্য নির্বাচন করুন',
  qty: 'পরিমাণ',
  price: 'মূল্য',
  discount: 'ডিসকাউন্ট',
  isFree: 'ফ্রি পণ্য?',
  addItem: 'আইটেম যোগ করুন',
  subTotal: 'উপ-মোট',
  flatDiscount: 'ফ্ল্যাট ডিসকাউন্ট',
  netTotal: 'মোট প্রদেয়',
  cashPaid: 'নগদ পরিশোধ',
  dueAmount: 'বকেয়ার পরিমাণ',
  printInvoice: 'ইনভয়েস প্রিন্ট',
  draftItems: 'খসড়া তালিকা',
  completeInvoice: 'ইনভয়েস সম্পন্ন করুন',

  // Purchase Tab
  supplierName: 'সরবরাহকারী প্রতিষ্ঠান',
  purchaseNo: 'ক্রয় রশিদ নং',
  procureItems: 'ক্রয়কৃত পণ্যের তালিকা',
  addSupplier: 'নতুন সরবরাহকারী যোগ করুন',
  recordPayment: 'পেমেন্ট রেকর্ড করুন',

  // Hawlat Tab
  hawlatHolder: 'হাওলাত গ্রহীতা/দাতা',
  cashDebt: 'নগদ ঋণ',
  productDebt: 'পণ্য ঋণ',
  postTransaction: 'লেনদেন পোস্ট করুন',
  fullSettlement: 'পূর্ণ নিষ্পত্তি',

  // Financials Tab
  ledgers: 'লেজার খতিয়ান',
  cashInHand: 'হাতে নগদ টাকা',
  damageClaim: 'ড্যামেজ ও ক্লেইম',
  approveDamage: 'ড্যামেজ অনুমোদন',
  incentives: 'ইনসেন্টিভ',
  claims: 'দাবি নিষ্পত্তি',
  expenses: 'দৈনিক খরচ'
};

/**
 * Localization helper translation hook-like utility
 */
export function t(key: string): string {
  return BENGALI_TRANSLATIONS[key] || key;
}
