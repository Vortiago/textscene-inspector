/**
 * Puts the state a chain of canvas items hands down around `children`, for an item drawn without
 * the groups of those items: their modulate and z, the material a `use_parent_material` item
 * takes, and their filter and repeat. The transform stays with the caller, which may hold a solved
 * Control rect the chain does not.
 */

import { useContext, useMemo, type ReactNode } from 'react';
import { SkippedCanvasItemsScope } from '../canvasItemState';
import { TextureSampler2DContext, inheritTextureSampler } from '../canvasItemTextureSampler';
import {
  CanvasItemMaterialProvider,
  useCanvasAncestorMaterial,
} from '../components/canvasItemMaterialContext';
import type { CanvasAncestors } from './canvasAncestors';

export function CanvasAncestorsScope({ chain, children }: { chain: CanvasAncestors; children: ReactNode }) {
  const parentSampler = useContext(TextureSampler2DContext);
  const sampler = useMemo(
    () => inheritTextureSampler(chain.sampler, parentSampler),
    [chain.sampler, parentSampler]
  );
  const material = useCanvasAncestorMaterial(chain.material);
  return (
    <SkippedCanvasItemsScope skipped={chain}>
      <CanvasItemMaterialProvider value={material}>
        <TextureSampler2DContext.Provider value={sampler}>{children}</TextureSampler2DContext.Provider>
      </CanvasItemMaterialProvider>
    </SkippedCanvasItemsScope>
  );
}
