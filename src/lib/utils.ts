
export const toBanglaNumerals = (num: number | string | null | undefined): string => {
  if (num === null || num === undefined || num === '') return '০';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
};

export const formatBanglaCurrency = (amount: number): string => {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount || 0);
  return '৳ ' + toBanglaNumerals(formatted);
};

export const formatBanglaNumber = (num: number): string => {
  const formatted = new Intl.NumberFormat('en-IN').format(num || 0);
  return toBanglaNumerals(formatted);
};

export const formatBanglaDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  // simple conversion if needed, or just return as is if already in a good format
  return toBanglaNumerals(dateStr);
};
