import { useEffect, useState } from 'react';

export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const get = () => document.documentElement.classList.contains('dark');
    setDark(get());
    const observer = new MutationObserver(() => setDark(get()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, fractionDigits = 0): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let f = formatterCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: fractionDigits,
      });
    } catch {
      f = new Intl.NumberFormat('en-US', { maximumFractionDigits: fractionDigits });
    }
    formatterCache.set(key, f);
  }
  return f;
}

export function formatCurrency(value: number, currency: string, fractionDigits = 0): string {
  try {
    return getFormatter(currency, fractionDigits).format(value || 0);
  } catch {
    return `${(value || 0).toFixed(fractionDigits)} ${currency}`;
  }
}
