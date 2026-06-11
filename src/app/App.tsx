import { useRef } from 'react';
import { CtaSection } from '../sections/CtaSection';
import { HeroSection } from '../sections/HeroSection';
import { StorySection } from '../sections/StorySection';
import { useReducedMotionSync } from '../hooks/useReducedMotionSync';
import { storySections } from '../story/sections';
import { useDirector } from '../systems/director/useDirector';
import { useScrollEngine } from '../systems/scroll/useScrollEngine';
import { ChapterIndicator } from '../ui/ChapterIndicator';
import { SiteHeader } from '../ui/SiteHeader';

export default function App() {
  const pageRef = useRef<HTMLDivElement>(null);

  useReducedMotionSync();
  useScrollEngine();
  useDirector(pageRef);

  return (
    <div ref={pageRef}>
      <SiteHeader />
      <ChapterIndicator />
      {/* The fixed 3D stage mounts here in Phase 2, at --z-stage,
          behind the scrolling content. */}
      <main>
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
