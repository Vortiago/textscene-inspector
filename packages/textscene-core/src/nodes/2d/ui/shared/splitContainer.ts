/**
 * Shared SplitContainer properties and their parse for the HSplit/VSplit slices, in pure `.ts` that
 * both parsers can import inside the linter graph. `splitContainerSolver.ts` lays the children out.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { packedArrayBody, packedArrayForms } from '../../../../godot/index.js';
import { ruleInt } from '../../../../godot/int.js';
import type { ControlProperties } from '../control/types';
import { parseControl } from '../control/parser';

export interface SplitContainerProperties extends ControlProperties {
  /**
   * Pixels each dragger is displaced from its computed rest position, one
   * entry per dragger (Godot default `[0]`: the constructor pushes one zero,
   * `split_container.cpp:1336`). It carries whatever the deprecated scalar `split_offset`
   * wrote into entry 0.
   */
  splitOffsets?: number[];
  /** The deprecated scalar spelling alone (`split_container.cpp:1330`), for a reader that wants the authored key rather than the resolved array. */
  splitOffset?: number;
  /** True pins the split at its rest position, and `split_offset` is not read. */
  collapsed?: boolean;
  /** 0=VISIBLE, 1=HIDDEN, 2=HIDDEN_COLLAPSED. Only 2 removes the separation. */
  draggerVisibility?: number;
}

/** All three spellings a PACKED_INT32_ARRAY slot converts (`godot/variantParser.ts`). */
const SPLIT_OFFSETS_FORMS = packedArrayForms('PackedInt32Array');

/**
 * `split_offsets` and the deprecated `split_offset`, resolved as the engine does: the constructor
 * seeds `[0]` (`split_container.cpp:1336`), `set_split_offsets` replaces the array (`:1071-1077`)
 * and `set_split_offset` writes entry 0 (`:1056-1064`, from the compat property at `:1330`). The
 * saver writes `split_offsets` first (`:1295`), so file order decides and the bag is read in order.
 */
function parseSplitOffsets(properties: Record<string, string>): number[] | undefined {
  let offsets: number[] | undefined;
  for (const key of Object.keys(properties)) {
    if (key === 'split_offsets') {
      const matched = packedArrayBody(SPLIT_OFFSETS_FORMS, properties['split_offsets']!);
      if (!matched) continue;
      offsets = matched.body
        .split(',')
        .map((element) => element.trim())
        .filter((element) => element.length > 0)
        .map((element) => ruleInt(element) ?? 0);
    } else if (key === 'split_offset') {
      const scalar = parseOptionalInt(properties['split_offset']);
      if (scalar === undefined) continue;
      const base = offsets ?? [0];
      // `set_split_offset`'s `ERR_FAIL_INDEX(0, split_offsets.size())`: an explicitly empty array
      // has no entry 0, so it swallows the scalar.
      if (base.length === 0) continue;
      offsets = [...base];
      offsets[0] = scalar;
    }
  }
  return offsets;
}

export function parseSplitContainer(
  heading: ParsedHeading,
  properties: Record<string, string>
): SplitContainerProperties {
  const result: SplitContainerProperties = { ...parseControl(heading, properties) };
  result.splitOffset = parseOptionalInt(properties.split_offset);
  result.splitOffsets = parseSplitOffsets(properties);
  result.collapsed = parseOptionalBool(properties.collapsed);
  result.draggerVisibility = parseOptionalInt(properties.dragger_visibility);
  return result;
}

/** This container's authored offsets, or the constructor's own single zero (`split_container.cpp:1336`). */
export function splitOffsetsOf(props: SplitContainerProperties): readonly number[] {
  return props.splitOffsets ?? [props.splitOffset ?? 0];
}
