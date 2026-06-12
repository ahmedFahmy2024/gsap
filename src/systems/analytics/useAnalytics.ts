import { useEffect } from 'react';
import { transientStore, useAppStore } from '../../state/store';
import { chapters } from '../../story/sections';
import { flush, track, trackOnce } from './analytics';

/** Story funnel depth, % of the full scroll track. */
const DEPTH_MILESTONES = [25, 50, 75, 100] as const;

/**
 * Product analytics wiring (design §11 Phase 6). Mounted once in App:
 *
 *  - chapter_reached — once per chapter per page load, from the store's
 *    currentChapter (the Director already writes it at boundary-cross
 *    frequency; this is the §8-sanctioned reactive read).
 *  - scroll_depth — 25/50/75/100% milestones from the transient store.
 *    The subscription fires per scroll event, so the hot path is latched
 *    integer comparisons only; allocation happens at most 4 times.
 *  - quality_tier_changed — every runtime demotion (PerformanceMonitor
 *    decline, context-loss/render-error fallback) becomes field data.
 *  - RUM (web-vitals + fps beacon) — idle-loaded as its own chunk so the
 *    shell budget (§13 ≤ 120 KB) never pays for it.
 *  - flush() on hide/pagehide — the batched beacon's end-of-session ship.
 *
 * CTA clicks are tracked at the buttons themselves (CtaSection).
 */
export function useAnalytics(): void {
  useEffect(() => {
    const unsubscribeStore = useAppStore.subscribe((state, previous) => {
      if (state.currentChapter !== previous.currentChapter) {
        const chapter = chapters[state.currentChapter];
        if (chapter) {
          trackOnce(`chapter:${chapter.id}`, 'chapter_reached', {
            chapter: chapter.id,
            index: state.currentChapter,
          });
        }
      }
      if (state.qualityTier !== previous.qualityTier) {
        track('quality_tier_changed', {
          from: previous.qualityTier,
          to: state.qualityTier,
        });
      }
    });

    // Local cursor instead of trackOnce on the hot path: scroll events fire
    // per frame while scrolling, and §8 forbids per-frame allocation.
    let nextMilestone = 0;
    const unsubscribeScroll = transientStore.subscribe((state) => {
      while (
        nextMilestone < DEPTH_MILESTONES.length &&
        state.scrollProgress * 100 >= DEPTH_MILESTONES[nextMilestone]
      ) {
        const percent = DEPTH_MILESTONES[nextMilestone];
        nextMilestone += 1;
        trackOnce(`depth:${percent}`, 'scroll_depth', { percent });
      }
    });

    // RUM loads off the critical path; startRum's module latch makes the
    // StrictMode double-invoke (and a cancel race) harmless. The tier getter
    // is injected so the lazy chunk never imports the react store (see rum.ts).
    const loadRum = () => {
      void import('./rum').then((module) =>
        module.startRum({
          getTier: () => useAppStore.getState().qualityTier,
        }),
      );
    };
    let idleId = 0;
    let timerId = 0;
    // typeof, not `in`: lib.dom types it unconditionally, but Safari still
    // doesn't ship requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(loadRum);
    } else {
      timerId = window.setTimeout(loadRum, 2000);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);

    return () => {
      unsubscribeStore();
      unsubscribeScroll();
      if (idleId) {
        window.cancelIdleCallback(idleId);
      }
      window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}
