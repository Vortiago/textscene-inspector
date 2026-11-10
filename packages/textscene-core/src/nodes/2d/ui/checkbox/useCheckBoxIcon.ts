/** The texture of one of the eight CheckBox icons: the Control's themed icon, else the vendored default. */
import type * as THREE from 'three';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CHECK_BOX_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { CHECK_BOX_ICON_THEME_NAME, type CheckBoxIconKey } from './nativeSolver';

export function useCheckBoxIcon(solveNode: SolveNode, iconKey: CheckBoxIconKey): THREE.Texture | null {
  return useNodeIcon(solveNode.icons[CHECK_BOX_ICON_THEME_NAME[iconKey]], CHECK_BOX_ICONS[iconKey]);
}
