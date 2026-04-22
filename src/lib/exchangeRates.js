/**
 * Exchange rate service — fawazahmed0/exchange-api
 * Free, no API key, 150+ currencies, updated daily.
 *
 * Rates are USD-based: 1 USD = N units of foreign currency.
 * Cache stored in localStorage for 24 hours.
 */

const CACHE_KEY  = 'splitkit_fx_rates';
const TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

const PRIMARY_URL  = 'https://cdn.jsdelivr.net/gh/fawazahmed0/exchange-api@1/latest/currencies/usd.min.json';
const FALLBACK_URL = 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json';

/**
 * Returns { rates, date } where:
 *   rates — { eur: 0.92, jpy: 149.5, ... }  (1 USD = N units)
 *   date  — "2024-01-15" string from the API, or '' on failure
 */
export async function getExchangeRateData() {
  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached && cached.rates && Date.now() - cached.fetchedAt < TTL_MS) {
      return { rates: cached.rates, fetchedAt: cached.fetchedAt };
    }
  } catch {
    // ignore malformed cache
  }

  // Fetch fresh rates
  let rates = null;
  let date  = '';
  for (const url of [PRIMARY_URL, FALLBACK_URL]) {
    try {
      const res  = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      // API response: { "date": "2024-01-15", "usd": { "eur": 0.92, ... } }
      rates = json.usd ?? json;
      date  = json.date ?? '';
      break;
    } catch {
      // try fallback
    }
  }

  if (!rates) {
    console.warn('[exchangeRates] Could not fetch rates — using USD-only mode');
    return { rates: {}, fetchedAt: null };
  }

  const fetchedAt = Date.now();

  // Cache result
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, date, fetchedAt }));
  } catch {
    // ignore storage errors
  }

  return { rates, fetchedAt };
}

/**
 * Returns just the rates object (backward-compatible wrapper).
 */
export async function getExchangeRates() {
  const { rates } = await getExchangeRateData();
  return rates;
}

/**
 * Convert an amount in any currency to USD.
 * @param {number}  amount        — original amount
 * @param {string}  currencyCode  — ISO 4217 code (e.g. 'JPY')
 * @param {object}  rates         — from getExchangeRates()
 * @returns {number} amount in USD, rounded to 2 decimal places
 */
export function convertToUsd(amount, currencyCode, rates) {
  if (!currencyCode || currencyCode === 'USD') return Math.round(amount * 100) / 100;
  const rate = rates[currencyCode.toLowerCase()];
  if (!rate) {
    console.warn(`[exchangeRates] No rate for ${currencyCode} — treating as USD`);
    return Math.round(amount * 100) / 100;
  }
  return Math.round((amount / rate) * 100) / 100;
}

/**
 * Format a single unit of a currency as its USD equivalent.
 * e.g. fmtUsdRate('JPY', rates) → "1 = $0.0067"
 */
export function fmtUsdRate(currencyCode, rates) {
  if (!currencyCode || currencyCode === 'USD') return 'Base currency';
  const rate = rates[currencyCode.toLowerCase()];
  if (!rate) return '';
  const usdVal = 1 / rate;
  let decimals;
  if      (usdVal >= 1)     decimals = 2;
  else if (usdVal >= 0.01)  decimals = 4;
  else                      decimals = 6;
  return `1 = $${usdVal.toFixed(decimals)}`;
}
