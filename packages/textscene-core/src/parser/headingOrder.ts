import type { ParseErrorCode } from '../godot/variant/strToVar.js';

/** Why the loader refuses a heading, each with the error Godot prints for it. */
export type MisplacedReason = 'unknown tag' | 'extra tag' | 'resource in scene' | 'node in resource';

export interface MisplacedHeading {
  readonly type: string;
  readonly line: number;
  readonly reason: MisplacedReason;
}

/** The loader call that reads a tag, named by what it read before: each prints its own error line. */
export type TagReader = 'header' | 'opening tag' | 'node body' | 'section';

/** A heading `parse_tag` refuses: its error, its code and its line. */
export interface UnparsedHeading {
  readonly error: string;
  readonly code: ParseErrorCode;
  readonly line: number;
  readonly readBy: TagReader;
}

/** Where the loader stops at a heading: one it refuses for its place, or one it cannot parse. */
export type HeadingStop = MisplacedHeading | UnparsedHeading;

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

function readerAfter(previous: string | null): TagReader {
  if (previous === null) return 'header';
  if (previous === 'gd_scene' || previous === 'gd_resource') return 'opening tag';
  return previous === 'node' ? 'node body' : 'section';
}

/** A tracker to feed each heading in file order. A file whose first heading is no header is never judged. */
export function headingOrder(): {
  read(type: string, line: number): void;
  /** The type of the last heading read, null before the first. */
  previous(): string | null;
  /** Records a heading `parse_tag` refuses, where the loader reads no further. */
  refuse(unparsed: Omit<UnparsedHeading, 'readBy'>): void;
  /** The first heading the loader stops at. */
  stop(): HeadingStop | null;
  /** True past a heading that does not parse. */
  isStopped(): boolean;
} {
  let previous: string | null = null;
  let isScene: boolean | null = null;
  let phase: Phase = 'ext_resource';
  let stop: HeadingStop | null = null;
  let isUnparsed = false;
  const judge = (type: string, line: number) => {
    if (isScene === null || stop) return;
    const reason = refusalOf(phase, type, isScene);
    if (reason) stop = { type, line, reason };
    else phase = phaseAfter(phase, type);
  };
  return {
    read(type, line) {
      if (previous === null) {
        if (type === 'gd_scene' || type === 'gd_resource') isScene = type === 'gd_scene';
      } else judge(type, line);
      previous = type;
    },
    previous: () => previous,
    refuse(unparsed) {
      if (isUnparsed) return;
      isUnparsed = true;
      if (!stop && (previous === null || isScene !== null))
        stop = { ...unparsed, readBy: readerAfter(previous) };
    },
    stop: () => stop,
    isStopped: () => isUnparsed,
  };
}
