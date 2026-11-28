import { lazy } from 'react';
import { PendingSuspense } from '../../resources/PendingSuspense.js';
import { editorHelperUserData } from '../editorHelpers.js';
import { useRootScene } from '../hooks/useRootScene.js';
import { useViewShow } from '../viewShow/ViewShowContext.js';

// Lazy, so the glyph engine and the parse of the prompt load only for an empty canvas.
const EmptyScenePrompt = lazy(() => import('./emptyScenePrompt.js'));

/** The 3D mode's ground grid, and a prompt for an empty scene: a black canvas reads as a crash. */
export function EditorGround() {
  const { nodes } = useRootScene();
  return nodes === null || nodes.length === 0 ? <EmptySceneIndicator /> : <ContentGroundGrid />;
}

/** The 10-unit grid frames no mesh-free scene, such as a lone Path3D, and a SubViewport draws none of it. */
function GroundGrid() {
  return <gridHelper args={[10, 10, 0x444444, 0x222222]} userData={GROUND_GRID_USER_DATA} />;
}

/** One object, as R3F assigns a new `userData` object on each render. */
const GROUND_GRID_USER_DATA = { tscnEmptyState: true, ...editorHelperUserData() };

/** A child component, so a change of `show` re-renders this and not the node tree. */
function ContentGroundGrid() {
  const { grid } = useViewShow();
  return grid ? <GroundGrid /> : null;
}

function EmptySceneIndicator() {
  // paint-order-safe: mounted where no scene, and so no canvas item, exists.
  return (
    <group userData={{ tscnEmptyState: true }}>
      <GroundGrid />
      <PendingSuspense>
        <EmptyScenePrompt />
      </PendingSuspense>
    </group>
  );
}
