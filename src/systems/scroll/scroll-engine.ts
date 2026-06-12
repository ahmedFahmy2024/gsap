import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { transientStore } from '../../state/store';

gsap.registerPlugin(ScrollTrigger);

// iOS URL-bar show/hide fires height-only resizes; refreshing on those
// causes mid-scroll jumps (docs/ENGINEERING_DESIGN.md §12).
ScrollTrigger.config({ ignoreMobileResize: true });

export interface ScrollEngineOptions {
  reducedMotion: boolean;
}

export interface ScrollEngine {
  /** Selector string, or an absolute scroll position in px. */
  scrollTo: (target: string | number) => void;
  destroy: () => void;
}

/**
 * Scrub value for the master timeline (§6, encoded HERE so the asymmetry
 * never gets sprinkled around): with a fine pointer, Lenis already lerps
 * wheel input, so the scrub must be exact (`true`) — `scrub: 1` would
 * double-smooth into a laggy, "drunk" feel. On touch-primary devices Lenis
 * passes native momentum through untouched (syncTouch: false), so a small
 * scrub lag is reintroduced for polish.
 */
export function getMasterScrub(): true | number {
  return window.matchMedia('(pointer: coarse)').matches ? 0.5 : true;
}

/**
 * The only module in the app that touches window scroll. Creates Lenis
 * (smooth path) or a passive native listener (reduced-motion path),
 * drives it from GSAP's ticker so the whole app shares one rAF, and
 * forwards updates to ScrollTrigger and the transient store.
 */
export function createScrollEngine(options: ScrollEngineOptions): ScrollEngine {
  if (options.reducedMotion) {
    return createNativeEngine();
  }
  return createLenisEngine();
}

function createLenisEngine(): ScrollEngine {
  const lenis = new Lenis({
    // We drive frames from gsap.ticker below — never let Lenis own a rAF.
    autoRaf: false,
    lerp: 0.1,
    // Touch keeps native momentum; Lenis smoothing on touch feels laggy
    // and the master scrub gets its own touch tuning in Phase 3 (§6).
    syncTouch: false,
  });

  lenis.on('scroll', () => {
    ScrollTrigger.update();
    transientStore.setState({
      scrollProgress: lenis.progress,
      scrollVelocity: lenis.velocity,
    });
  });

  const tick = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tick);
  // Lag smoothing pauses GSAP's clock after long frames, which would let
  // Lenis and ScrollTrigger drift apart — disable while Lenis drives.
  gsap.ticker.lagSmoothing(0);

  return {
    scrollTo: (target) => lenis.scrollTo(target, { offset: 0 }),
    destroy: () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    },
  };
}

function createNativeEngine(): ScrollEngine {
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    transientStore.setState({
      scrollProgress: max > 0 ? window.scrollY / max : 0,
      scrollVelocity: 0,
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return {
    scrollTo: (target) => {
      if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'auto' });
        return;
      }
      document.querySelector(target)?.scrollIntoView({ behavior: 'auto' });
    },
    destroy: () => window.removeEventListener('scroll', onScroll),
  };
}

/* Active-engine registry: lets UI call scrollToSection without owning the
 * engine lifecycle. Lives here so scroll remains this module's monopoly. */
let activeEngine: ScrollEngine | null = null;

export function setActiveEngine(engine: ScrollEngine | null): void {
  activeEngine = engine;
}

/**
 * Maps a chapter id to its master-timeline label's scroll position, in px.
 * Registered by the Director when it builds Layer 1 (the Director owns the
 * timeline; this module owns the scrolling) and self-invalidates when the
 * timeline is reverted, so a stale resolver just falls back to the DOM path.
 */
type LabelResolver = (id: string) => number | null;

let labelResolver: LabelResolver | null = null;

export function setLabelResolver(resolver: LabelResolver | null): void {
  labelResolver = resolver;
}

/**
 * Scroll to a chapter by id (e.g. from nav). Prefers the master-timeline
 * label (lands exactly where the scene's pose settles); falls back to the
 * DOM section when no timeline exists (reduced motion, static tier, or
 * before init).
 */
export function scrollToSection(id: string): void {
  const labelPosition = labelResolver?.(id) ?? null;
  if (labelPosition !== null && activeEngine) {
    activeEngine.scrollTo(labelPosition);
    return;
  }
  const selector = `#${id}`;
  if (activeEngine) {
    activeEngine.scrollTo(selector);
  } else {
    document.querySelector(selector)?.scrollIntoView({ behavior: 'auto' });
  }
}
