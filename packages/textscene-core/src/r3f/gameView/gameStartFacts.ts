import { useMemo } from 'react';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { useCurrentCamera2D, useCurrentCamera3D } from '../currentCamera.js';
import { liveTreeOf } from '../liveSceneTree.js';
import { isClaimedByNode3DEditor } from '../nodeWorkspaceVisibility.js';
import { useLiveSceneNodes, useLiveTreeSelection, type SharedLiveTree } from '../useLiveSceneTree.js';
import { keepsChildrenInViewport } from '../viewportRender/viewportBoundary.js';
import { holdsResource } from '../../godot/scene/resourceLiteral.js';
import { LOAD_OUTCOMES } from '../../resources/fileKinds.js';
import { nodeReference, type ResourceSnapshot } from '../../resources/reading/index.js';
import { SCRIPT_FILE } from '../../resources/script/kind.js';
import type { SceneScope, TscnNode } from '../../parser/types.js';
import type { ViewSettled } from '../viewStatus/viewStatus.js';

/** What the In-game view cannot show of the game's first frame: the facts of `settled`, and one more. */
export interface GameStartFacts extends Omit<ViewSettled, 'missingFiles'> {
  /** 3D content in the root window, and no current Camera3D to draw it (`renderer_viewport.cpp:362`). */
  lacksCamera3D: boolean;
}

/** Module level, so the memo of `useLiveSceneNodes` holds. */
const is3DContent = (node: TscnNode): boolean => isClaimedByNode3DEditor(node.type);

/** Whether Godot readies the script `script` names: not when its file fails to load. */
function readiesScript(script: string, scope: SceneScope, snapshot: ResourceSnapshot): boolean {
  const { value } = snapshot.read(nodeReference(script, scope), SCRIPT_FILE);
  if (!value?.address) return true;
  return snapshot.loaded(LOAD_OUTCOMES, value.address).value?.isFailed !== true;
}

/** The live nodes whose script Godot readies, each script read in the scope of the file that wrote it. */
function scriptedNodesOf({ roots, ctx }: SharedLiveTree, snapshot: ResourceSnapshot): number {
  let scripted = 0;
  liveTreeOf(roots, ctx).fold<void, void>(undefined, ({ raw, step }, _, descendInto) => {
    if (raw.isUnowned) return;
    const script = step.node.rawProperties.script;
    if (holdsResource(script) && readiesScript(script!, step.scope, snapshot)) scripted++;
    descendInto();
  });
  return scripted;
}

/** A script inside a SubViewport runs too, and 3D content there draws through that viewport's camera. */
export function useGameStartFacts(): GameStartFacts {
  const scriptedNodeCount = useLiveTreeSelection(scriptedNodesOf, Object.is) ?? 0;
  const rootWindow3D = useLiveSceneNodes(is3DContent, keepsChildrenInViewport).length;
  const currentCamera3D = useCurrentCamera3D(ROOT_VIEWPORT_PATH);
  const currentCamera2D = useCurrentCamera2D(ROOT_VIEWPORT_PATH);
  return useMemo(
    () => ({
      scriptedNodeCount,
      hasCurrentCamera: currentCamera3D !== null || currentCamera2D !== null,
      lacksCamera3D: rootWindow3D > 0 && currentCamera3D === null,
    }),
    [scriptedNodeCount, currentCamera3D, currentCamera2D, rootWindow3D]
  );
}
