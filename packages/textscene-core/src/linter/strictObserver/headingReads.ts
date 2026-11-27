import type { ParsedHeading } from '../../parser/utils.js';
import type { ConnectionHeading, HeadingFacts } from '../../parser/types.js';
import { parseIdTrail } from '../../godot/scene/packedScene.js';

export type HeadingReads = Pick<HeadingFacts, 'connections' | 'pathlessEditables'>;

function connectionHeading({ attributes }: ParsedHeading, line: number, column: number): ConnectionHeading {
  return {
    line,
    column,
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
  read(heading: ParsedHeading, line: number, column: number): void;
} {
  const connections: ConnectionHeading[] = [];
  const pathlessEditables: { line: number; column: number }[] = [];
  return {
    reads: { connections, pathlessEditables },
    read(heading, line, column) {
      if (heading.type === 'connection') connections.push(connectionHeading(heading, line, column));
      if (heading.type === 'editable' && heading.attributes.path === undefined)
        pathlessEditables.push({ line, column });
    },
  };
}
