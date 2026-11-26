import type { ParsedHeading } from '../../parser/utils.js';
import type { ConnectionHeading, HeadingFacts } from '../../parser/types.js';
import { parseIdTrail } from '../../godot/scene/packedScene.js';

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

/** Only the linter reads these, so the strict observer collects them from each heading in scan order. */
export function headingReads(): {
  reads: HeadingReads;
  read(heading: ParsedHeading, line: number): void;
} {
  const connections: ConnectionHeading[] = [];
  const pathlessEditableLines: number[] = [];
  return {
    reads: { connections, pathlessEditableLines },
    read(heading, line) {
      if (heading.type === 'connection') connections.push(connectionHeading(heading, line));
      if (heading.type === 'editable' && heading.attributes.path === undefined)
        pathlessEditableLines.push(line);
    },
  };
}
