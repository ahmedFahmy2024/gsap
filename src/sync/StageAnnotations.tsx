import { Html } from '@react-three/drei';
import { createPortal } from '@react-three/fiber';
import { Fragment, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '../state/store';
import {
  getStageObject,
  getStageRegistryVersion,
  subscribeStageObjects,
} from '../stage/registry/registry';
import { allAnnotations, type SceneAnnotation } from '../story/scenes';

/**
 * DOM↔3D Sync Layer, annotation pass (§7, Tier 1): drei `<Html>` labels
 * portaled onto the named anchor objects the stage registered, so they ride
 * the model's physical points through the whole choreography. Projection and
 * raycast occlusion are drei's per-frame work; *when* a label may be seen is
 * the Director's call (descriptor visibleRange → store.visibleAnnotations).
 *
 * Tier 1 is budgeted for ≤ ~6 simultaneous labels (per-instance matrix work
 * and DOM mutation); the Tier-2 single-pass projection pool is the Phase 5
 * fallback if these show up in profiles.
 */
export function StageAnnotations() {
  // Re-render on registry changes (registration frequency, not per-frame),
  // so anchors can be resolved during render no matter when they register —
  // including a future Suspense-loaded glTF committing after this layer.
  useSyncExternalStore(subscribeStageObjects, getStageRegistryVersion);

  return (
    <>
      {allAnnotations.flatMap((annotation) => {
        const anchor = getStageObject(annotation.anchor);
        if (!anchor) {
          return [];
        }
        return (
          <Fragment key={annotation.id}>
            {createPortal(<AnnotationLabel annotation={annotation} />, anchor)}
          </Fragment>
        );
      })}
    </>
  );
}

function AnnotationLabel({ annotation }: { annotation: SceneAnnotation }) {
  // Boundary-cross frequency (Director toggles it), not per-frame — a
  // reactive subscription is correct here (§8).
  const active = useAppStore((s) =>
    s.visibleAnnotations.includes(annotation.id),
  );
  // drei raycast-occludes against the scene and hands the result to
  // onOcclude instead of hard-toggling display — occlusion flips are
  // discrete (the object turns slowly), so this state write is in the same
  // class as a trigger toggle, and CSS gets to fade instead of pop.
  const [occluded, setOccluded] = useState(false);

  const shown = active && !occluded;

  return (
    <Html occlude onOcclude={setOccluded} style={{ pointerEvents: 'none' }}>
      <div
        className={shown ? 'annotation annotation--visible' : 'annotation'}
        aria-hidden="true"
      >
        <span className="annotation__dot" />
        {annotation.text}
      </div>
    </Html>
  );
}
