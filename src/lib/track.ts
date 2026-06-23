export type ConsentState = 'accepted' | 'declined' | null;

export interface OwtTelemetry {
  available: boolean;
  getConsent: () => ConsentState;
  setConsent: (value: 'accepted' | 'declined') => void;
  track: (name: string, params?: Record<string, unknown>) => void;
  trackToolOpen: (toolId: string, category?: string) => void;
  trackToolUse: (toolId: string, category?: string) => void;
}

declare global {
  interface Window {
    owtTelemetry?: OwtTelemetry;
  }
}

function api(): OwtTelemetry | undefined {
  return typeof window !== 'undefined' ? window.owtTelemetry : undefined;
}

export function telemetryActive(): boolean {
  return !!api();
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  api()?.track(name, params);
}

export function trackToolOpen(toolId: string, category?: string): void {
  api()?.trackToolOpen(toolId, category);
}

export function trackToolUse(toolId: string, category?: string): void {
  api()?.trackToolUse(toolId, category);
}

export function getConsent(): ConsentState {
  return api()?.getConsent() ?? null;
}

export function setConsent(value: 'accepted' | 'declined'): void {
  api()?.setConsent(value);
}
