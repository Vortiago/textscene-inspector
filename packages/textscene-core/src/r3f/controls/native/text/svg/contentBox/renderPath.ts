/**
 * ThorVG's `RenderPath` (`tvgRender.h`): the commands of a shape's outline and the points they
 * take, one point for a move or a line, three for a cubic and none for a close.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { Point } from './math';

export const PathCommand = { Close: 0, MoveTo: 1, LineTo: 2, CubicTo: 3 } as const;
export type PathCommandValue = (typeof PathCommand)[keyof typeof PathCommand];

export interface RenderPath {
  readonly cmds: PathCommandValue[];
  readonly pts: Point[];
}

export const emptyPath = (): RenderPath => ({ cmds: [], pts: [] });
