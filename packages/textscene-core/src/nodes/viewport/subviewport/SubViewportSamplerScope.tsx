/**
 * The viewport default a SubViewport gives its canvas items: the filter and repeat that a
 * PARENT_NODE item with no ancestor to defer to resolves to. The root viewport takes the project's
 * (`editor_node.cpp:451-460`), and a SubViewport its own properties (`viewport.cpp:3974-4017`).
 */
import { useMemo, type ReactNode } from 'react';
import {
  ROOT_TEXTURE_SAMPLER,
  TextureSampler2DContext,
  ViewportSamplerProvider,
} from '../../../r3f/canvasItemTextureSampler';
import { viewportCanvasItemTextureDefaults } from '../../../godot/scene/viewport';
import type { SubViewportProperties } from './types';

interface SubViewportSamplerScopeProps {
  properties: Pick<
    SubViewportProperties,
    'canvas_item_default_texture_filter' | 'canvas_item_default_texture_repeat'
  >;
  children: ReactNode;
}

export function SubViewportSamplerScope({ properties, children }: SubViewportSamplerScopeProps) {
  const { canvas_item_default_texture_filter: filter, canvas_item_default_texture_repeat: repeat } =
    properties;
  const defaults = useMemo(() => viewportCanvasItemTextureDefaults(filter, repeat), [filter, repeat]);
  // The ambient resets too: a SubViewport is no CanvasItem, so nothing above it is an ancestor to defer to.
  return (
    <ViewportSamplerProvider value={defaults}>
      <TextureSampler2DContext.Provider value={ROOT_TEXTURE_SAMPLER}>
        {children}
      </TextureSampler2DContext.Provider>
    </ViewportSamplerProvider>
  );
}
