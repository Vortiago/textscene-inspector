/**
 * What a heading's own fields carry, which no section body holds: each `[connection]` heading, and the `ExtResource`
 * uses of a node's `instance=`. Only the linter asks, so the strict parser collects them from `onSectionStart` and the
 * shared scan never does.
 */

import type { ParsedHeading } from '../../parser/utils.js';
import type { ConnectionHeading, HeadingFacts } from '../../parser/types.js';
import { parseIdTrail } from '../../godot/scene/packedScene.js';

export type HeadingResourceReads = Pick<HeadingFacts, 'connections' | 'instancesOutsideNodeBody'>;

function connectionHeading({ attributes }: ParsedHeading, line: number): ConnectionHeading {
  return {
    line,
    signal: attributes.signal,
    from: attributes.from,
    to: attributes.to,
    method: attributes.method,
    binds: attributes.binds,
    fromIdTrail: parseIdTrail(attributes.from_uid_path),
    toIdTrail: parseIdTrail(attributes.to_uid_path),
  };
}

/** A collector to feed each parsed heading in scan order, and the reads it has gathered so far. */
export function headingResourceReads(): {
  reads: HeadingResourceReads;
  read(heading: ParsedHeading, line: number): void;
} {
  const connections: ConnectionHeading[] = [];
  const instancesOutsideNodeBody: string[] = [];
  // Only a `[node]` body reads the heading after it leniently, so the previous heading's type decides.
  let previousHeadingType: string | null = null;
  return {
    reads: { connections, instancesOutsideNodeBody },
    read(heading, line) {
      const { instance } = heading.attributes;
      if (heading.type === 'connection') connections.push(connectionHeading(heading, line));
      if (heading.type === 'node' && previousHeadingType !== 'node' && instance !== undefined) {
        instancesOutsideNodeBody.push(instance);
      }
      previousHeadingType = heading.type;
    },
  };
}
