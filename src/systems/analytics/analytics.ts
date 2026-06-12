/**
 * Analytics sink (docs/ENGINEERING_DESIGN.md §11 Phase 6).
 *
 * One tiny, dependency-free funnel for every product/field event: callers
 * use track() / trackOnce() and never care where the data goes. Delivery:
 *
 *  - DEV: console.debug, so events are visible while building.
 *  - `window.dataLayer` (GTM-style), pushed synchronously when present —
 *    drop a tag manager on the page and events flow with zero code changes.
 *  - VITE_ANALYTICS_ENDPOINT (optional build-time env): events buffer and
 *    flush as a JSON batch via sendBeacon — on buffer pressure and on
 *    page hide (flush() is wired by useAnalytics). No endpoint, no network.
 *
 * Pure module: no React, no GSAP, no Three — importable from anywhere,
 * including the stage chunk (the context-loss guard reports faults here).
 */

type AnalyticsPayload = Record<string, string | number | boolean>;

interface AnalyticsEvent {
  name: string;
  /** Epoch ms at track() time. */
  ts: number;
  payload: AnalyticsPayload;
}

interface DataLayerWindow extends Window {
  dataLayer?: { push: (entry: object) => unknown };
}

const endpoint: string | undefined = import.meta.env.VITE_ANALYTICS_ENDPOINT;

/** Flush before the batch grows enough to risk the sendBeacon size cap. */
const MAX_BUFFER = 50;

const buffer: AnalyticsEvent[] = [];

export function track(name: string, payload: AnalyticsPayload = {}): void {
  if (import.meta.env.DEV) {
    console.debug(`[analytics] ${name}`, payload);
  }
  (window as DataLayerWindow).dataLayer?.push({ event: name, ...payload });
  if (endpoint) {
    buffer.push({ name, ts: Date.now(), payload });
    // Hidden means teardown may be imminent and no later flush is
    // guaranteed — web-vitals finalizes CLS/LCP/INP exactly then, so those
    // must not wait in the buffer. Beacon immediately.
    if (buffer.length >= MAX_BUFFER || document.visibilityState === 'hidden') {
      flush();
    }
  }
}

/* Latches live at module level so StrictMode remounts and HMR cannot
 * re-fire once-per-session events. */
const seen = new Set<string>();

/** track(), but at most once per page load for a given key. */
export function trackOnce(
  key: string,
  name: string,
  payload: AnalyticsPayload = {},
): void {
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  track(name, payload);
}

/**
 * Ship the buffered batch. Called on visibilitychange→hidden / pagehide
 * (the only reliable end-of-session signals) and on buffer pressure.
 * sendBeacon survives page teardown; the fetch fallback is best-effort.
 */
export function flush(): void {
  if (!endpoint || buffer.length === 0) {
    return;
  }
  const body = JSON.stringify(buffer.splice(0, buffer.length));
  if (navigator.sendBeacon?.(endpoint, body)) {
    return;
  }
  fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => {
    /* analytics must never surface as a page error */
  });
}
