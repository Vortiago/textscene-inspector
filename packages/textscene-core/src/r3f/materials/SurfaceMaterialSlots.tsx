/**
 * One `SurfaceMaterialSlot` per surface of a mesh, each attached to its own draw group, and the
 * two rules every per-surface slot keeps: the default surface and the attach key.
 */
import type { MaterialSource } from './materialSource';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';
import type { PointPlacement } from './godotPoint';
import type { ParticleProgram } from './godotParticles';

const DEFAULT_SURFACE: readonly (MaterialSource | undefined)[] = [undefined];

/** The sources to draw: a mesh that declares no surface material still draws Godot's default one. */
export function surfaceSources(
  sources: readonly (MaterialSource | undefined)[]
): readonly (MaterialSource | undefined)[] {
  return sources.length === 0 ? DEFAULT_SURFACE : sources;
}

/**
 * The attach key of draw group `index`. A mesh of one surface keeps the singular key, so
 * `mesh.material` stays one material rather than a length-1 array.
 */
export function surfaceAttach(index: number, surfaceCount: number): string {
  return surfaceCount > 1 ? `material-${index}` : 'material';
}

interface SurfaceMaterialSlotsProps {
  /** `sources[i]` is the material of draw group `i`. */
  sources: readonly (MaterialSource | undefined)[];
  /** Where the points sit when the mesh draws `THREE.Points`, so each material also sizes them. */
  points?: PointPlacement;
  /** The mesh draws a particle emitter's instances: the patch that colours them and cuts the flipbook frame. */
  particles?: ParticleProgram;
}

export function SurfaceMaterialSlots({ sources, points, particles }: SurfaceMaterialSlotsProps) {
  const slotSources = surfaceSources(sources);
  return (
    <>
      {slotSources.map((source, i) => (
        <SurfaceMaterialSlot
          key={i}
          source={source}
          attach={surfaceAttach(i, slotSources.length)}
          points={points}
          particles={particles}
        />
      ))}
    </>
  );
}
