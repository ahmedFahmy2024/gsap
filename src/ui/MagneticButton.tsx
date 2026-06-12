import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import type { ComponentPropsWithoutRef, PointerEvent } from 'react';
import { useAppStore } from '../state/store';
import { duration, ease } from '../story/motion';

/** Fraction of the cursor-to-center distance the button travels. < 1 so the
 *  attraction converges instead of chasing its own moved center. */
const PULL = 0.3;
const HOVER_SCALE = 1.04;

/**
 * Magnetic CTA (§11 Phase 4): the button leans toward the cursor while
 * hovered and springs back on release. One persistent quickTo tween per
 * axis with the elastic house ease handles BOTH — following trails
 * springily, and release is just a retarget to 0 — so a pointermove burst
 * never stacks tweens and no two tweens ever own the same property (§8).
 * Everything lives in a useGSAP context that reverts inline transforms on
 * unmount or reduced-motion flip.
 *
 * The pointer math reads the UNTRANSFORMED wrapper, not the moving button,
 * so the attraction has a stable origin. Mouse pointers only — on touch
 * there is no hover, and under reduced motion the handlers no-op (the
 * button stays a plain button).
 */
export function MagneticButton({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'button'>) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const quickX = useRef<gsap.QuickToFunc | null>(null);
  const quickY = useRef<gsap.QuickToFunc | null>(null);
  const quickScale = useRef<gsap.QuickToFunc | null>(null);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  // All three persistent tweens are created inside the context (collected
  // for revert); under reduced motion they stay null and every handler
  // below degrades to a no-op.
  useGSAP(
    () => {
      quickX.current = null;
      quickY.current = null;
      quickScale.current = null;
      if (reducedMotion || !button.current) {
        return;
      }
      const spring = { duration: duration.spring, ease: ease.magnetic };
      quickX.current = gsap.quickTo(button.current, 'x', spring);
      quickY.current = gsap.quickTo(button.current, 'y', spring);
      quickScale.current = gsap.quickTo(button.current, 'scale', {
        duration: duration.fast,
        ease: ease.follow,
      });
    },
    { scope: wrapper, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      quickScale.current?.(HOVER_SCALE);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    const rect = wrapper.current!.getBoundingClientRect();
    quickX.current?.((event.clientX - (rect.left + rect.width / 2)) * PULL);
    quickY.current?.((event.clientY - (rect.top + rect.height / 2)) * PULL);
  };

  const onPointerLeave = () => {
    quickX.current?.(0);
    quickY.current?.(0);
    quickScale.current?.(1);
  };

  return (
    <span
      ref={wrapper}
      className="magnetic"
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <button
        {...rest}
        ref={button}
        type="button"
        className={
          className ? `${className} button--magnetic` : 'button--magnetic'
        }
      >
        {children}
      </button>
    </span>
  );
}
