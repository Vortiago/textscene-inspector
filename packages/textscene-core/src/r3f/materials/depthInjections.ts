/**
 * What a surface's draw adds to its depth program, which three's own depth material lacks. A draw
 * records each injection on the material's userData, and every reader of a draw's depth asks here.
 */

import { composeInjections, type ProgramInjection } from '../materialProgramInputs';

const DEPTH_INJECTIONS_KEY = 'godotDepthInjections';

/** A surface's depth injections, on either side of the surface's alpha cut. */
export interface DrawDepthInjections {
  /** What the cut does not read, as a points surface's size. */
  readonly beforeCut?: ProgramInjection;
  /** What edits a chunk the cut adds, as a particle colour multiplies the vertex colour. */
  readonly afterCut?: ProgramInjection;
}

const NONE: DrawDepthInjections = Object.freeze({});

/** The depth injections `userData`'s draw recorded, none for a surface that recorded none. */
export function drawDepthInjections(userData: Record<string, unknown>): DrawDepthInjections {
  return (userData[DEPTH_INJECTIONS_KEY] as DrawDepthInjections | undefined) ?? NONE;
}

/** Whether `userData`'s draw adds anything to its depth program. */
export function addsDepthInjections(userData: Record<string, unknown>): boolean {
  return drawDepthInjections(userData) !== NONE;
}

/** `userData` with `injection` after the injections already on `slot`, in a new object. */
export function withDepthInjection(
  userData: Record<string, unknown>,
  slot: keyof DrawDepthInjections,
  injection: ProgramInjection
): Record<string, unknown> {
  const recorded = drawDepthInjections(userData);
  return {
    ...userData,
    [DEPTH_INJECTIONS_KEY]: { ...recorded, [slot]: composeInjections([recorded[slot], injection]) },
  };
}
