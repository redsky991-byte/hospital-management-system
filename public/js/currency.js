// ============================================================
// MedCare HMS - Currency Module
// Supports 12 major currencies
// ============================================================
const CURRENCIES = {
  USD: { symbol: '$',   name: 'US Dollar',         code: 'USD', decimals: 2 },
  EUR: { symbol: '€',   name: 'Euro',               code: 'EUR', decimals: 2 },
  GBP: { symbol: '£',   name: 'British Pound',      code: 'GBP', decimals: 2 },
  AED: { symbol: 'د.إ', name: 'UAE Dirham',         code: 'AED', decimals: 2 },
  PKR: { symbol: '₨',   name: 'Pakistani Rupee',    code: 'PKR', decimals: 0 },
  INR: { symbol: '₹',   name: 'Indian Rupee',       code: 'INR', decimals: 2 },
  CNY: { symbol: '¥',   name: 'Chinese Yuan',       code: 'CNY', decimals: 2 },
  JPY: { symbol: '¥',   name: 'Japanese Yen',       code: 'JPY', decimals: 0 },
  SAR: { symbol: '﷼',   name: 'Saudi Riyal',        code: 'SAR', decimals: 2 },
  TRY: { symbol: '₺',   name: 'Turkish Lira',       code: 'TRY', decimals: 2 },
  CAD: { symbol: 'C$',  name: 'Canadian Dollar',    code: 'CAD', decimals: 2 },
  AUD: { symbol: 'A$',  name: 'Australian Dollar',  code: 'AUD', decimals: 2 }
};

function getCurrency() {
  return localStorage.getItem('hms_currency') || 'USD';
}

function setCurrency(code) {
  if (!CURRENCIES[code]) return;
  localStorage.setItem('hms_currency', code);
}

function getCurrencyInfo() {
  return CURRENCIES[getCurrency()] || CURRENCIES.USD;
}

function getCurrencySymbol() {
  return getCurrencyInfo().symbol;
}

function formatCurrency(amount) {
  const curr = getCurrencyInfo();
  const num = Number(amount) || 0;
  return curr.symbol + num.toFixed(curr.decimals);
}

function buildCurrencyOptions(selectedCode) {
  return Object.values(CURRENCIES).map(c =>
    `<option value="${c.code}"${c.code === selectedCode ? ' selected' : ''}>${c.code} – ${c.symbol} ${c.name}</option>`
  ).join('');
}

window.CURRENCIES = CURRENCIES;
window.getCurrency = getCurrency;
window.setCurrency = setCurrency;
window.getCurrencySymbol = getCurrencySymbol;
window.formatCurrency = formatCurrency;
window.buildCurrencyOptions = buildCurrencyOptions;
