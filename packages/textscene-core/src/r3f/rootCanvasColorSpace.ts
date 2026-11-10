/**
 * The canvas colour space of the root viewport: linear under the project's `rendering/viewport/hdr_2d`
 * (`scene_tree.cpp:2088-2089`), sRGB otherwise. The root canvas provides it to its items and draws its
 * frame in it.
 */

import { projectUsesHdr2D } from '../parser/projectSettingsParser';
import { useProjectSettings } from './contexts/ProjectSettingsContext';
import { canvasColorSpaceOf, type CanvasColorSpace } from './canvasColorSpace';

export function useRootCanvasColorSpace(): CanvasColorSpace {
  return canvasColorSpaceOf(projectUsesHdr2D(useProjectSettings().settings));
}
