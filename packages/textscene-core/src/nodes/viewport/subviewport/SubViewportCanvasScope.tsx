/**
 * The viewport defaults a SubViewport gives its canvas items: the filter and repeat that a
 * PARENT_NODE item with no ancestor to defer to resolves to. The root viewport takes the project's
 * (`editor_node.cpp:451-460`), and a SubViewport its own properties (`viewport.cpp:3974-4017`).
 */
import { useMemo, type ReactNode } from 'react';
import { ViewportSamplerProvider } from '../../../r3f/canvasItemTextureSampler';
import { CHAIN_START_PARENT, CanvasParentProvider } from '../../../r3f/canvasItemPass/inheritedCanvasState';
import { viewportCanvasItemTextureDefaults } from '../../../godot/scene/viewport';
import type { SubViewportProperties } from './types';

interface SubViewportCanvasScopeProps {
  properties: Pick<
    SubViewportProperties,
    'canvas_item_default_texture_filter' | 'canvas_item_default_texture_repeat'
  >;
  children: ReactNode;
}

export function SubViewportCanvasScope({ properties, children }: SubViewportCanvasScopeProps) {
  const { canvas_item_default_texture_filter: filter, canvas_item_default_texture_repeat: repeat } =
    properties;
  const defaults = useMemo(() => viewportCanvasItemTextureDefaults(filter, repeat), [filter, repeat]);
  // A chain starts too: a SubViewport is no CanvasItem, so nothing above it is an ancestor to defer to.
  return (
    <ViewportSamplerProvider value={defaults}>
      <CanvasParentProvider value={CHAIN_START_PARENT}>{children}</CanvasParentProvider>
    </ViewportSamplerProvider>
  );
}
