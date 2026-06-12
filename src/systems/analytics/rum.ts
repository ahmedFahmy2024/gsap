import gsap from 'gsap';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import type { MetricType } from 'web-vitals';
import type { QualityTier } from '../quality/quality';
import { track } from './analytics';

/**
 * RUM — Real User Monitoring (design §11 Phase 6). The §13 table wants
 * field data, not just lab numbers; this module ships the two halves:
 *
 *  - Core Web Vitals via the `web-vitals` library (LCP/CLS/INP/FCP/TTFB).
 *    Registering late is safe — the library replays buffered performance
 *    entries — which is why this whole module can be a lazy, idle-loaded
 *    chunk that costs the shell budget nothing.
 *  - An fps beacon: frame durations from gsap.ticker (the app's single
 *    rAF) accumulated into a fixed histogram, summarized to p95 fps +
 *    long-frame count (§13 rows) and tracked when the page hides.
 *
 * Loaded once by useAnalytics; the module-level latch makes StrictMode /
 * repeat loads no-ops. Runs for the page's lifetime — there is nothing to
 * unmount, the page IS the session.
 *
 * The quality tier is injected as a getter rather than read from the store:
 * importing the (zustand-react) store here would drag React into this lazy
 * chunk's dependency graph and split a shared react chunk out of the shell.
 */

export interface RumOptions {
  /** Sampled at fps-report time, so summaries name the tier they ran under. */
  getTier: () => QualityTier;
}

let started = false;

/** Histogram ceiling: frames ≥ this all land in the last bucket. */
const MAX_FRAME_MS = 120;
/** Don't report a summary for a window too short to mean anything (~2 s). */
const MIN_SAMPLES = 120;
/** Anything longer is a rAF resume artifact (tab switch), not a frame. */
const RESUME_ARTIFACT_MS = 1000;

export function startRum(options: RumOptions): void {
  if (started) {
    return;
  }
  started = true;

  const reportVital = (metric: MetricType) => {
    track('web_vital', {
      metric: metric.name,
      // CLS is a unitless score reported ×1000 (the GA convention, keeps
      // every value an integer); the rest are milliseconds.
      value: Math.round(
        metric.name === 'CLS' ? metric.value * 1000 : metric.value,
      ),
      rating: metric.rating,
      navigationType: metric.navigationType,
    });
  };
  onCLS(reportVital);
  onFCP(reportVital);
  onINP(reportVital);
  onLCP(reportVital);
  onTTFB(reportVital);

  /* fps beacon — §8 discipline: the ticker callback only increments
   * pre-allocated integers; all aggregation happens at report time.
   * Caveat: under reduced motion the scroll engine restores GSAP's
   * lagSmoothing, which masks >500 ms stalls as 33 ms ticks — long-frame
   * counts are only authoritative for the smooth-scroll cohort. */
  const buckets = new Uint32Array(MAX_FRAME_MS + 1);
  let longFrames = 0;
  let samples = 0;

  const tick = (_time: number, deltaTime: number) => {
    if (deltaTime <= 0 || deltaTime > RESUME_ARTIFACT_MS) {
      return;
    }
    buckets[Math.min(MAX_FRAME_MS, Math.round(deltaTime))] += 1;
    samples += 1;
    if (deltaTime > 50) {
      longFrames += 1;
    }
  };
  gsap.ticker.add(tick);

  const reportFps = () => {
    if (samples < MIN_SAMPLES) {
      return;
    }
    // p95 frame duration: walk the histogram until 95% of frames are at or
    // below the bucket. p95 fps is its reciprocal.
    let remaining = Math.ceil(samples * 0.95);
    let p95ms = MAX_FRAME_MS;
    for (let ms = 0; ms <= MAX_FRAME_MS; ms += 1) {
      remaining -= buckets[ms];
      if (remaining <= 0) {
        p95ms = ms;
        break;
      }
    }
    track('fps_summary', {
      p95Fps: Math.round(1000 / Math.max(1, p95ms)),
      longFrames,
      samples,
      // The tier at report time — together with quality_tier_changed events
      // this tells us which configuration the frames were rendered under.
      tier: options.getTier(),
    });
    buckets.fill(0);
    longFrames = 0;
    samples = 0;
  };

  // Hidden is the only reliable end-of-session signal; counters reset per
  // report, so a user who returns produces a fresh window per dwell.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      reportFps();
    }
  });
  window.addEventListener('pagehide', reportFps);
}
