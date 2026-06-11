import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAppStore } from '../../state/store';
import { ease, duration, stagger, revealDistance } from '../../story/motion';

gsap.registerPlugin(ScrollTrigger);

export interface DirectorOptions {
  reducedMotion: boolean;
}

/**
 * The single creation site for every ScrollTrigger in the app
 * (docs/ENGINEERING_DESIGN.md §6 — no component creates its own).
 *
 * Phase 1 builds Layer 2 of the timeline model: toggle-based reveal
 * timelines per `[data-section]`, animating its `[data-reveal]` children,
 * plus chapter tracking for the UI. Layer 1 (the master 3D scrub) arrives
 * in Phase 3 and will be built here too.
 *
 * Must run inside a gsap context (useDirector wraps it in useGSAP) so
 * everything created here is reverted on unmount/rebuild.
 */
export function buildStory(scope: HTMLElement, options: DirectorOptions): void {
  const sections = gsap.utils.toArray<HTMLElement>('[data-section]', scope);

  sections.forEach((section, index) => {
    // Chapter tracking is information, not motion — runs in both modes.
    // setCurrentChapter is low-frequency (fires on boundary cross only),
    // so writing reactive state from this callback is within the §8 rules.
    ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => {
        if (self.isActive) {
          useAppStore.getState().setCurrentChapter(index);
        }
      },
    });

    if (options.reducedMotion) {
      return; // content stays in its CSS resting state — fully visible
    }

    const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]', section);
    if (targets.length === 0) {
      return;
    }

    // Toggle-based, not scrubbed: reveals play a designed beat when their
    // moment arrives and reverse on the way back up (§6 Layer 2).
    gsap
      .timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      })
      .fromTo(
        targets,
        { autoAlpha: 0, y: revealDistance },
        {
          autoAlpha: 1,
          y: 0,
          duration: duration.reveal,
          ease: ease.reveal,
          stagger: stagger.text,
        },
      );
  });
}
