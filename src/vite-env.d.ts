/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional analytics/RUM beacon endpoint (systems/analytics): when set at
   * build time, events batch and ship there via sendBeacon. When unset,
   * events still reach the DEV console and window.dataLayer — no network.
   */
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}
