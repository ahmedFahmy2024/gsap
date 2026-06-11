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
  scrollTo: (target: string) => void;
  destroy: () => void;
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

/** Scroll to a section by DOM id (e.g. from nav). Safe before init. */
export function scrollToSection(id: string): void {
  const selector = `#${id}`;
  if (activeEngine) {
    activeEngine.scrollTo(selector);
  } else {
    document.querySelector(selector)?.scrollIntoView({ behavior: 'auto' });
  }
}
