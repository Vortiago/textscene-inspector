/**
 * The project's clear colour over the project frame, under every canvas item. Godot clears each
 * opaque viewport to it before it draws (`servers/rendering/renderer_viewport.cpp:371`), so an
 * additive, subtractive or multiplying item blends with it. A CSS background behind the
 * transparent canvas would only show through, and such an item would blend with black.
 */

import { useMemo } from 'react';
import { useProjectClearColor } from '../../useProjectClearColor.js';
import { useGameViewportRect } from '../../gameViewportRect.js';
import { materialProgramInputs } from '../../materialProgramInputs.js';

/**
 * Below every canvas key, which starts at 0 (`canvasPaintOrder.ts`). The quad is also opaque,
 * and three draws its opaque list before the transparent list that holds every canvas item.
 */
const CLEAR_RENDER_ORDER = -1;

export function ProjectClearColor() {
  const { x, y, w, h } = useGameViewportRect();
  const color = useProjectClearColor();
  const program = useMemo(
    () => materialProgramInputs({ props: { color, depthWrite: false, depthTest: false, toneMapped: false } }),
    [color]
  );
  // Godot's +Y is down, hence the negated centre.
  return (
    <mesh name="ProjectClearColor" position={[x + w / 2, -(y + h / 2), 0]} renderOrder={CLEAR_RENDER_ORDER}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}
