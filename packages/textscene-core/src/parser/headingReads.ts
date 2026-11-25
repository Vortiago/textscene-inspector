import type { ParsedHeading } from './utils.js';
import type { ConnectionHeading, HeadingFacts } from './types.js';
import { parseIdTrail } from '../godot/scene/packedScene.js';

export type HeadingReads = Pick<
  HeadingFacts,
  'connections' | 'pathlessEditableLines' | 'instancesOutsideNodeBody'
>;

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
export function headingReads(): {
  reads: HeadingReads;
  /** Records `heading`, and answers whether its `instance=` sits outside a node body. */
  read(heading: ParsedHeading, line: number): boolean;
} {
  const connections: ConnectionHeading[] = [];
  const pathlessEditableLines: number[] = [];
  const instancesOutsideNodeBody: string[] = [];
  // Only a `[node]` body reads the heading after it leniently, so the previous heading's type decides.
  let previousHeadingType: string | null = null;
  return {
    reads: { connections, pathlessEditableLines, instancesOutsideNodeBody },
    read(heading, line) {
      const { instance } = heading.attributes;
      if (heading.type === 'connection') connections.push(connectionHeading(heading, line));
      if (heading.type === 'editable' && heading.attributes.path === undefined)
        pathlessEditableLines.push(line);
      const isOutsideNodeBody =
        heading.type === 'node' && previousHeadingType !== 'node' && instance !== undefined;
      if (isOutsideNodeBody) instancesOutsideNodeBody.push(instance);
      previousHeadingType = heading.type;
      return isOutsideNodeBody;
    },
  };
}
