import type { Binding } from '../uniforms/bindingTable.js';

const DATA = 'implementation_data_block.data';

/** `ImplementationData` members a frame holds: the previewer draws no SSAO, SSIL, SSR or volumetric fog. */
export const EFFECT_SPECIALISATIONS: readonly Binding<unknown>[] = [
  { uniform: `${DATA}.ss_effects_flags`, godot: 'render_forward_clustered.cpp:749-769', value: () => 0 },
  {
    uniform: `${DATA}.volumetric_fog_enabled`,
    godot: 'render_forward_clustered.cpp:721, 731',
    value: () => false,
  },
];

/** The block members `EFFECT_SPECIALISATIONS` writes, which the emitter folds as literals (ADR-0088). */
export const SPECIALISED_MEMBERS: ReadonlySet<string> = new Set(
  EFFECT_SPECIALISATIONS.map(({ uniform }) => uniform)
);
