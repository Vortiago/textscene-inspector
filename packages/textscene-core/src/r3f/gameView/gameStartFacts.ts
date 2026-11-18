import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { useCurrentCamera3D } from '../currentCamera.js';
import { isClaimedByNode3DEditor } from '../nodeWorkspaceVisibility.js';
import { useLiveSceneNodes } from '../useLiveSceneTree.js';
import { keepsChildrenInViewport } from '../viewportRender/viewportBoundary.js';
import { holdsResource } from '../../godot/scene/resourceLiteral.js';
import type { TscnNode } from '../../parser/types.js';

/** What the In-game view cannot show of the game's first frame. */
export interface GameStartFacts {
  /** Nodes whose script Godot readies before the first frame (`node.cpp:273`). This view runs none. */
  scriptedNodes: number;
  /** 3D content in the root window, and no current Camera3D to draw it (`renderer_viewport.cpp:362`). */
  lacksCamera3D: boolean;
}

/** Module level, so the memo of `useLiveSceneNodes` holds. */
const holdsScript = (node: TscnNode): boolean => holdsResource(node.rawProperties.script);
const is3DContent = (node: TscnNode): boolean => isClaimedByNode3DEditor(node.type);

/** A script inside a SubViewport runs too, and 3D content there draws through that viewport's camera. */
export function useGameStartFacts(): GameStartFacts {
  const scripted = useLiveSceneNodes(holdsScript).length;
  const rootWindow3D = useLiveSceneNodes(is3DContent, keepsChildrenInViewport).length;
  const currentCamera3D = useCurrentCamera3D(ROOT_VIEWPORT_PATH);
  return { scriptedNodes: scripted, lacksCamera3D: rootWindow3D > 0 && currentCamera3D === null };
}
