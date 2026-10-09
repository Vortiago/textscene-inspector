/**
 * The two materials of one surface that a geometry instance's fade picks between before each
 * render: the unfaded one, and the alpha-pass one with the fade alpha written into its opacity.
 * Godot holds the fade per instance and per viewport, so each render, a SubViewport's included,
 * draws the fade its own camera measures.
 */

import type * as THREE from 'three';
import { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { fadeAlpha, forcesAlphaPass } from '../../godot/fadeAlpha';
import type { FadePass, FadeVariants } from './fadeVariants';

/** A surface whose draw state a geometry instance's fade sets. */
export interface FadedSurface {
  /** Sets the surface for `fade` (`geometryFade`), for the render about to draw. */
  applyFade(fade: number): void;
}

/** The surfaces a geometry instance's fade sets, which its drawer adds to. */
export interface FadedSurfaces {
  /** Adds `surface` until the returned function runs. */
  add(surface: FadedSurface): () => void;
}

/** Null outside a GeometryInstance3D drawer, where nothing fades a surface. */
export const FadedSurfacesContext = createContext<FadedSurfaces | null>(null);
FadedSurfacesContext.displayName = 'FadedSurfacesContext';

/** What a material attaches to: a mesh, whose `material` holds one per draw group when it has several. */
interface MaterialHost {
  material: THREE.Material | THREE.Material[];
}

/** R3F's function `attach`: it attaches `material` to `host` and returns the detach. */
export type MaterialAttach = (host: MaterialHost, material: THREE.Material) => () => void;

const ATTACH_PATTERN = /^material(?:-(\d+))?$/;

/** The draw group an R3F `attach` key names: null for the mesh's one material. */
function drawGroupOf(attach: string | undefined): number | null {
  const match = ATTACH_PATTERN.exec(attach ?? 'material');
  if (!match) throw new Error(`expected a material attach key such as material-1, got ${attach}`);
  return match[1] === undefined ? null : Number(match[1]);
}

/**
 * A material's opacity as its owner, React, sets it, with the fade alpha multiplied in place. A
 * value other than the one last written is the owner's.
 */
class FadedOpacity {
  private owned: number;
  private written = Number.NaN;

  constructor(private readonly material: THREE.Material) {
    this.owned = material.opacity;
  }

  /** The opacity the owner last set. */
  get ownerValue(): number {
    if (this.material.opacity !== this.written) this.owned = this.material.opacity;
    return this.owned;
  }

  /** Draws the material at its owner's opacity times `alpha`. */
  scaleBy(alpha: number): void {
    this.written = this.ownerValue * alpha;
    this.material.opacity = this.written;
  }
}

class SwappedMaterials implements FadedSurface {
  private host: MaterialHost | null = null;
  private readonly variants: Partial<FadeVariants<THREE.Material>> = {};
  private unfadedOpacity: FadedOpacity | null = null;
  private fade = 1;

  constructor(private readonly drawGroup: number | null) {}

  attach(pass: FadePass, host: MaterialHost, material: THREE.Material): () => void {
    this.host = host;
    this.variants[pass] = material;
    if (pass === 'unfaded') this.unfadedOpacity = new FadedOpacity(material);
    this.place();
    return () => {
      if (this.variants[pass] !== material) return;
      delete this.variants[pass];
      // The next holder of the material reads its owner's opacity.
      if (pass === 'unfaded') this.releaseUnfaded();
      this.place();
    };
  }

  applyFade(fade: number): void {
    this.fade = fade;
    this.place();
  }

  private releaseUnfaded(): void {
    this.unfadedOpacity?.scaleBy(1);
    this.unfadedOpacity = null;
  }

  /**
   * Puts the variant for the current fade on the host, at its owner's opacity times the fade
   * alpha. Godot starts ALPHA from the fade byte in every pass (`scene_forward_clustered.glsl:1251`),
   * so a fade short of a full byte lowers what a cut keeps in the surface's own pass too.
   */
  private place(): void {
    const { host, variants, unfadedOpacity } = this;
    const { unfaded, alphaPass } = variants;
    if (!host || !unfaded || !unfadedOpacity) return;
    const alpha = fadeAlpha(this.fade);
    const drawn = forcesAlphaPass(this.fade) && alphaPass ? alphaPass : unfaded;
    if (drawn === alphaPass) alphaPass.opacity = unfadedOpacity.ownerValue * alpha;
    else unfadedOpacity.scaleBy(alpha);
    if (this.drawGroup === null) {
      host.material = drawn;
      return;
    }
    if (!Array.isArray(host.material)) host.material = [];
    host.material[this.drawGroup] = drawn;
  }
}

/**
 * The function attaches of a surface's two materials, mounted at `attach`, or null outside a
 * GeometryInstance3D drawer, where the surface mounts one material at `attach`. A new `attach`
 * key gives new functions, so a material element keys on it.
 */
export function useSwappedMaterials(attach: string | undefined): FadeVariants<MaterialAttach> | null {
  const surfaces = useContext(FadedSurfacesContext);
  const swapped = useMemo(
    () => (surfaces ? new SwappedMaterials(drawGroupOf(attach)) : null),
    [surfaces, attach]
  );
  useLayoutEffect(() => (swapped ? surfaces!.add(swapped) : undefined), [surfaces, swapped]);
  return useMemo(
    () =>
      swapped && {
        unfaded: (host, material) => swapped.attach('unfaded', host, material),
        alphaPass: (host, material) => swapped.attach('alphaPass', host, material),
      },
    [swapped]
  );
}
