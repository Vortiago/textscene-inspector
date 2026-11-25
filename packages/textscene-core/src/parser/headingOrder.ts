/** Why the loader refuses a heading, each with the error Godot prints for it. */
export type MisplacedReason = 'unknown tag' | 'extra tag' | 'resource in scene' | 'node in resource';

export interface MisplacedHeading {
  readonly type: string;
  readonly line: number;
  readonly reason: MisplacedReason;
}

/** The headings the loader takes next: `[ext_resource]`, then `[sub_resource]`, then the main tag. */
type Phase = 'ext_resource' | 'sub_resource' | 'node' | 'resource';

/** Null where the loader takes `type` in `phase` (resource_format_text.cpp:415, :719-728, :840, :869-903). */
function refusalOf(phase: Phase, type: string, isScene: boolean): MisplacedReason | null {
  if (phase === 'resource') return 'extra tag';
  if (type === 'ext_resource') return phase === 'ext_resource' ? null : 'unknown tag';
  if (type === 'sub_resource') return phase === 'node' ? 'unknown tag' : null;
  if (phase === 'node')
    return type === 'node' || type === 'connection' || type === 'editable' ? null : 'unknown tag';
  if (type === 'resource') return isScene ? 'resource in scene' : null;
  if (type === 'node') return isScene ? null : 'node in resource';
  return 'unknown tag';
}

function phaseAfter(phase: Phase, type: string): Phase {
  if (type === 'sub_resource' || type === 'node' || type === 'resource') return type;
  return phase;
}

/** A tracker to feed each heading in file order. A file with no header line is never judged. */
export function headingOrder(): {
  /** Records the heading, and answers the type of the heading before it, null for the first. */
  read(type: string, line: number): string | null;
  misplaced(): MisplacedHeading | null;
} {
  let previous: string | null = null;
  let isScene: boolean | null = null;
  let phase: Phase = 'ext_resource';
  let misplaced: MisplacedHeading | null = null;
  const judge = (type: string, line: number) => {
    if (isScene === null || misplaced) return;
    const reason = refusalOf(phase, type, isScene);
    if (reason) misplaced = { type, line, reason };
    else phase = phaseAfter(phase, type);
  };
  return {
    read(type, line) {
      if (previous === null) {
        if (type === 'gd_scene' || type === 'gd_resource') isScene = type === 'gd_scene';
      } else judge(type, line);
      const before = previous;
      previous = type;
      return before;
    },
    misplaced: () => misplaced,
  };
}
