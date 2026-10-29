/**
 * Whether this canvas draws the 3D passes: the tonemap pass and the fog. Godot composites canvas
 * items after `_render_buffers_post_process_and_tonemap`, so a 2D canvas gets neither, and every
 * canvas item there blends.
 */

import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';

export function useDraws3D(): boolean {
  return useCanvasWorkspace() !== '2d';
}
