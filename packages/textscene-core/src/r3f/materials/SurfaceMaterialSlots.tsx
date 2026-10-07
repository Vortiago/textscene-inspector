/**
 * One `SurfaceMaterialSlot` per surface of a mesh, each attached to its own draw group.
 */
import type { MaterialSource } from './materialSource';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';

const DEFAULT_SURFACE: readonly (MaterialSource | undefined)[] = [undefined];

/**
 * `sources[i]` is the material of draw group `i`. No sources draws Godot's default surface.
 * A mesh of one surface keeps the singular attach key, so `mesh.material` stays one material
 * rather than a length-1 array.
 */
export function SurfaceMaterialSlots({ sources }: { sources: readonly (MaterialSource | undefined)[] }) {
  const slotSources = sources.length === 0 ? DEFAULT_SURFACE : sources;
  const isMultiSurface = slotSources.length > 1;
  return (
    <>
      {slotSources.map((source, i) => (
        <SurfaceMaterialSlot key={i} source={source} attach={isMultiSurface ? `material-${i}` : 'material'} />
      ))}
    </>
  );
}
