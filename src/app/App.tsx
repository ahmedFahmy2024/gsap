import { useRef } from 'react';
import { StageMount } from './StageMount';
import { CtaSection } from '../sections/CtaSection';
import { HeroSection } from '../sections/HeroSection';
import { StorySection } from '../sections/StorySection';
import { usePointerSync } from '../hooks/usePointerSync';
import { useReducedMotionSync } from '../hooks/useReducedMotionSync';
import { storySections } from '../story/sections';
import { useAnalytics } from '../systems/analytics/useAnalytics';
import { useDirector } from '../systems/director/useDirector';
import { useScrollEngine } from '../systems/scroll/useScrollEngine';
import { ChapterIndicator } from '../ui/ChapterIndicator';
import { SiteHeader } from '../ui/SiteHeader';

export default function App() {
  const pageRef = useRef<HTMLDivElement>(null);

  useReducedMotionSync();
  usePointerSync();
  useScrollEngine();
  useDirector(pageRef);
  useAnalytics();

  return (
    <div ref={pageRef}>
      {/* First focusable on the page (Phase 6 a11y). Native anchor jump —
          instant, and Lenis keeps native scroll behavior intact (§6). */}
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <ChapterIndicator />
      {/* Scene environment tint (§5) — the Director tweens its color on the
          master timeline. Before <StageMount /> so the canvas paints above. */}
      <div className="backdrop" data-backdrop aria-hidden="true" />
      {/* The fixed 3D stage — at --z-stage, behind the scrolling content */}
      <StageMount />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        {storySections.map((content) => (
          <StorySection key={content.id} content={content} />
        ))}
        <CtaSection />
      </main>
      <footer className="site-footer">
        <span>ORBE — a fictional product, built as a craft exercise.</span>
        <span>© 2026</span>
      </footer>
    </div>
  );
}
