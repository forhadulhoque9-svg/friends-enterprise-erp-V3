/**
 * Reusable utility helper functions for Friends Enterprise ERP v3
 */

/**
 * Format a number as Bangladeshi Taka (৳)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
    .format(amount)
    .replace('BDT', '৳');
}

/**
 * Format date string to DD MMM YYYY format
 */
export function formatDate(dateString: string | Date): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Handle printing of specific DOM elements for invoices, receipts, and reports
 */
export function printElement(elementId: string, title: string = 'Document'): void {
  const content = document.getElementById(elementId);
  if (!content) {
    console.error(`Element with ID ${elementId} not found for printing.`);
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups to print reports.');
    return;
  }

  // Get tailwind styles to inject into print document
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(style => style.outerHTML)
    .join('\n');

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          @media print {
            body {
              background-color: white;
              color: black;
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: 'Inter', sans-serif;
            padding: 40px;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${content.innerHTML}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Safe download as JSON utility
 */
export function downloadJSON(data: Record<string, any>, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a Universally Unique Lexicographically Sortable Identifier (ULID)
 * Ensures high performance IndexedDB sorting and zero-dependency offline generation.
 */
export function generateULID(seedTime: number = Date.now()): string {
  const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const ENCODING_LEN = 32;
  
  let timeStr = "";
  let time = seedTime;
  for (let i = 9; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    timeStr = ENCODING.charAt(mod) + timeStr;
    time = Math.floor(time / ENCODING_LEN);
  }

  let randStr = "";
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * ENCODING_LEN);
    randStr += ENCODING.charAt(rand);
  }

  return timeStr + randStr;
}

