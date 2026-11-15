/** The texture of one of the eight CheckButton icons: the Control's themed icon, else the vendored default. */
import type * as THREE from 'three';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CHECK_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { CHECK_BUTTON_ICON_THEME_NAME, type CheckButtonIconKey } from './nativeSolver';

export function useCheckButtonIcon(solveNode: SolveNode, iconKey: CheckButtonIconKey): THREE.Texture | null {
  return useNodeIcon(solveNode.icons[CHECK_BUTTON_ICON_THEME_NAME[iconKey]], CHECK_BUTTON_ICONS[iconKey]);
}
