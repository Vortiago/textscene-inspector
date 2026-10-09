/**
 * Mounts one surface's material: inside a GeometryInstance3D drawer, its unfaded and alpha-pass
 * pair, which the instance's fade swaps before each render, and elsewhere the unfaded one alone.
 */

import { Fragment, type ReactNode } from 'react';
import type { FadePass } from './fadeVariants';
import { useSwappedMaterials, type MaterialAttach } from './swappedMaterials';

interface FadedMaterialsProps {
  /** The R3F `attach` key of the surface's slot, or none for the mesh's one material. */
  attach?: string;
  /** The material element for `pass`, mounted at `attach`. */
  children: (pass: FadePass, attach: string | MaterialAttach | undefined) => ReactNode;
}

export function FadedMaterials({ attach, children }: FadedMaterialsProps) {
  const swapped = useSwappedMaterials(attach);
  if (!swapped) return children('unfaded', attach);
  // Keyed on `attach` too: it names the draw group the function attaches swap.
  return (
    <>
      <Fragment key={`unfaded:${attach}`}>{children('unfaded', swapped.unfaded)}</Fragment>
      <Fragment key={`alphaPass:${attach}`}>{children('alphaPass', swapped.alphaPass)}</Fragment>
    </>
  );
}
