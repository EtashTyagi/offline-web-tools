const raw = import.meta.env.GA_MEASUREMENT_ID;
export const GA_MEASUREMENT_ID = typeof raw === 'string' ? raw.trim() : '';

export function telemetryAvailable(): boolean {
  return GA_MEASUREMENT_ID.length > 0;
}

export function gtagScriptSrc(): string {
  return `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
}
