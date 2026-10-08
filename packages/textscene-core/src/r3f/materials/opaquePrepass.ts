/**
 * Where a surface material records Godot's opaque prepass: a shader with `depth_prepass_alpha`
 * or alpha antialiasing cuts its depth draws at the pass's threshold, and the depth prepass before
 * the opaque pass draws it unless its instance's fade forces the alpha pass
 * (`render_forward_clustered.cpp:1128-1134`, `:4080-4083`).
 */

import type * as THREE from 'three';

/** How Godot's depth passes treat one surface material. */
export interface OpaquePrepass {
  /** Whether its depth draws cut at `opaque_prepass_threshold`. */
  readonly cutsDepth: boolean;
  /** Whether the depth prepass draws it. */
  readonly drawsPrepass: boolean;
}

/** A surface with no opaque prepass, and any material this codebase did not mark. */
export const NO_OPAQUE_PREPASS: OpaquePrepass = Object.freeze({ cutsDepth: false, drawsPrepass: false });

/** An unfaded `depth_prepass_alpha` surface: the depth prepass draws it, cut. */
export const DRAWN_OPAQUE_PREPASS: OpaquePrepass = Object.freeze({ cutsDepth: true, drawsPrepass: true });

/** A `depth_prepass_alpha` surface its fade forces into the alpha pass: only its shadow cuts. */
export const FADED_OPAQUE_PREPASS: OpaquePrepass = Object.freeze({ cutsDepth: true, drawsPrepass: false });

const OPAQUE_PREPASS_KEY = 'godotOpaquePrepass';

/** The `userData` that gives a material its opaque prepass. */
export function opaquePrepassUserData(prepass: OpaquePrepass): Record<string, OpaquePrepass> {
  return { [OPAQUE_PREPASS_KEY]: prepass };
}

export function opaquePrepassOf(material: THREE.Material): OpaquePrepass {
  return (material.userData[OPAQUE_PREPASS_KEY] as OpaquePrepass | undefined) ?? NO_OPAQUE_PREPASS;
}
