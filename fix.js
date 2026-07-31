const fs = require('fs');
const content = fs.readFileSync('src/modules/reports/ReportsModule.tsx', 'utf8');
const newContent = content.replace('export default function ReportsModule', `export function formatBanglaCurrency(amount: number | string | undefined | null): string { if (amount === undefined || amount === null) return "৳০.০০"; const num = typeof amount === "string" ? parseFloat(amount) : amount; if (isNaN(num)) return "৳০.০০"; const formatted = num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const banglaDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"]; return "৳" + formatted.replace(/[0-9]/g, w => banglaDigits[parseInt(w)]); }
export function toBanglaNumerals(num: number | string | undefined | null): string { if (num === undefined || num === null) return "০"; const str = num.toString(); const banglaDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"]; return str.replace(/[0-9]/g, w => banglaDigits[parseInt(w)]); }

export default function ReportsModule`);
fs.writeFileSync('src/modules/reports/ReportsModule.tsx', newContent);
