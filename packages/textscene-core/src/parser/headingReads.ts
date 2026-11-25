import type { ParsedHeading } from './utils.js';
import type { ConnectionHeading, HeadingFacts } from './types.js';
import { parseIdTrail } from '../godot/scene/packedScene.js';

export type HeadingReads = Pick<HeadingFacts, 'connections' | 'pathlessEditableLines'>;

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
  /** Records `heading`, and answers the type of the heading before it, null for the first. */
  read(heading: ParsedHeading, line: number): string | null;
} {
  const connections: ConnectionHeading[] = [];
  const pathlessEditableLines: number[] = [];
  let previousHeadingType: string | null = null;
  return {
    reads: { connections, pathlessEditableLines },
    read(heading, line) {
      if (heading.type === 'connection') connections.push(connectionHeading(heading, line));
      if (heading.type === 'editable' && heading.attributes.path === undefined)
        pathlessEditableLines.push(line);
      const previous = previousHeadingType;
      previousHeadingType = heading.type;
      return previous;
    },
  };
}
