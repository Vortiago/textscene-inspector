/**
 * ADR-0055's second port trigger: the edits the installed patches make to three's light and shadow
 * chunks. Past the limit, the lit surface is ported to Godot's own shader, as the ADR states.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChunkEditsPatch } from './chunkPatch';
import { installShaderPatches } from './installShaderPatches';

/** Written only by the `installChunkEdits` mock below: each patch it saw, by patch name. */
const installedPatches = new Map<string, ChunkEditsPatch<never>>();

vi.mock('./chunkPatch', async (importOriginal) => {
  const original = await importOriginal<typeof import('./chunkPatch')>();
  return {
    ...original,
    installChunkEdits: (patch: ChunkEditsPatch<never>) => {
      installedPatches.set(patch.patch, patch);
      return original.installChunkEdits(patch);
    },
  };
});

/** The edits whose anchors a three.js upgrade most often moves. ADR-0055 counts these. */
const LIGHT_AND_SHADOW_CHUNK = /^(lights_|shadowmap_|shadowmask_|envmap_physical_pars_fragment$)/;

/** ADR-0055 trigger 2: more edits than this starts the lit-surface port. */
const PORT_TRIGGER_EDITS = 80;

describe('the light and shadow chunk edits', () => {
  it('stay at or below the ADR-0055 port trigger', () => {
    installShaderPatches();
    const edits = [...installedPatches.values()]
      .flatMap((patch) => patch.edits ?? [])
      .filter((edit) => LIGHT_AND_SHADOW_CHUNK.test(edit.chunk));
    expect(edits.length, 'ADR-0055 trigger 2 holds: start the lit-surface port').toBeLessThanOrEqual(
      PORT_TRIGGER_EDITS
    );
  });
});
