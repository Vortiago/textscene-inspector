/**
 * One `SurfaceMaterialSlot` per surface of a mesh, each attached to its own draw group.
 */
import type { MaterialSource } from './materialSource';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';

/**
 * `sources[i]` is the material of draw group `i`. A mesh of one surface keeps the singular
 * attach key, so `mesh.material` stays one material rather than a length-1 array.
 */
export function SurfaceMaterialSlots({ sources }: { sources: readonly (MaterialSource | undefined)[] }) {
  const isMultiSurface = sources.length > 1;
  return (
    <>
      {sources.map((source, i) => (
        <SurfaceMaterialSlot key={i} source={source} attach={isMultiSurface ? `material-${i}` : 'material'} />
      ))}
    </>
  );
}
