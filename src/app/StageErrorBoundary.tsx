import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useAppStore } from '../state/store';
import { track } from '../systems/analytics/analytics';

interface StageErrorBoundaryProps {
  children: ReactNode;
}

interface StageErrorBoundaryState {
  failed: boolean;
}

/**
 * Resilience fence around the 3D stage (design §11 Phase 6): if anything
 * inside the canvas subtree throws — a driver quirk, a shader compile
 * failure, a future glTF that doesn't match its manifest — the error must
 * not unwind to the root and take the DOM story with it. The boundary
 * swallows the subtree and demotes to the static tier, the same fallback
 * as WebGL-unavailable, which the rest of the app already treats as a
 * complete experience (§9).
 *
 * Render errors are treated as deterministic: no retry/remount path (that
 * would loop), unlike context loss, which StageContextGuard does recover.
 *
 * Class component by necessity — error boundaries have no hook equivalent.
 */
export class StageErrorBoundary extends Component<
  StageErrorBoundaryProps,
  StageErrorBoundaryState
> {
  state: StageErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): StageErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      '[stage] render error — demoting to the static tier',
      error,
      info.componentStack,
    );
    track('stage_fault', { reason: 'render-error', message: error.message });
    useAppStore.getState().setQualityTier('static');
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
