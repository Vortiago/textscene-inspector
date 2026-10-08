/**
 * The `ExtResource` uses a heading's own fields carry, which the loader reads but no section body holds. Only the
 * linter asks, so the strict parser collects them from `onSectionStart` and the shared scan never does.
 */

import type { ParsedHeading } from '../../parser/utils.js';
import type { HeadingFacts } from '../../parser/types.js';

export type HeadingResourceReads = Pick<HeadingFacts, 'connectionBinds' | 'instancesOutsideNodeBody'>;

/** A collector to feed each parsed heading in scan order, and the reads it has gathered so far. */
export function headingResourceReads(): { reads: HeadingResourceReads; read(heading: ParsedHeading): void } {
  const connectionBinds: string[] = [];
  const instancesOutsideNodeBody: string[] = [];
  // Only a `[node]` body reads the heading after it leniently, so the previous heading's type decides.
  let previousHeadingType: string | null = null;
  return {
    reads: { connectionBinds, instancesOutsideNodeBody },
    read(heading) {
      const { binds, instance } = heading.attributes;
      if (heading.type === 'connection' && binds !== undefined) connectionBinds.push(binds);
      if (heading.type === 'node' && previousHeadingType !== 'node' && instance !== undefined) {
        instancesOutsideNodeBody.push(instance);
      }
      previousHeadingType = heading.type;
    },
  };
}
