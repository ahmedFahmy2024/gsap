import { chapters } from '../story/sections';
import { useAppStore } from '../state/store';
import { navigateToSection } from './navigation';

/**
 * Fixed progress dots. Subscribes to currentChapter — a deliberate,
 * low-frequency reactive read (changes ~once per section, not per frame).
 */
export function ChapterIndicator() {
  const currentChapter = useAppStore((s) => s.currentChapter);

  return (
    <nav className="chapters" aria-label="Reading progress">
      {chapters.map((chapter, index) => (
        <button
          key={chapter.id}
          type="button"
          className="chapters__dot"
          aria-label={chapter.label}
          // 'true'/undefined, not true/false: a literal aria-current="false"
          // on every other dot is noise for AT (Phase 6 aria audit).
          aria-current={index === currentChapter ? 'true' : undefined}
          onClick={() => navigateToSection(chapter.id)}
        />
      ))}
    </nav>
  );
}
