/**
 * The stage split of a template file: a port of `include_file_in_rd_header` (`glsl_builders.py:24`),
 * which Godot runs at build time. It cuts the file at `#[vertex]`, `#[fragment]` and `#[compute]`,
 * reads each `#include` once per stage, and cuts each line at `//`. Each line keeps the file and
 * line it came from.
 */

import { ShadingLanguageError } from '../language/shadingLanguageError.js';

export type StageName = 'vertex' | 'fragment' | 'compute';

/** One line of a stage, without its line break, and where it starts in Godot's files. */
export interface StageLine {
  readonly text: string;
  readonly file: string;
  /** 1-based. */
  readonly line: number;
}

export type TemplateStages = Partial<Record<StageName, readonly StageLine[]>>;

/** The text of a file of Godot's shaders by its path, as `environment/sky.glsl`, or nothing. */
export type ReadTemplateFile = (path: string) => string | undefined;

const STAGE_MARKERS: readonly (readonly [string, StageName])[] = [
  ['#[vertex]', 'vertex'],
  ['#[fragment]', 'fragment'],
  ['#[compute]', 'compute'],
];

interface SplitState {
  readonly read: ReadTemplateFile;
  readonly stages: Record<StageName, StageLine[]>;
  readonly included: Record<StageName, Set<string>>;
  reading?: StageName;
}

/** The stages of the template at `path`. */
export function splitStages(path: string, read: ReadTemplateFile): TemplateStages {
  const state: SplitState = {
    read,
    stages: { vertex: [], fragment: [], compute: [] },
    included: { vertex: new Set(), fragment: new Set(), compute: new Set() },
  };
  includeFile(path, state);
  const stages: TemplateStages = {};
  for (const [name, lines] of Object.entries(state.stages) as [StageName, StageLine[]][])
    if (lines.length > 0) stages[name] = lines;
  return stages;
}

/** The lines of `path` as Python's `readline` gives them, each with its line break. */
function readLines(path: string, read: ReadTemplateFile): string[] {
  const text = read(path);
  if (text === undefined)
    throw new ShadingLanguageError(`#include "${path}" could not be found!`, {
      file: path,
      line: 1,
      column: 1,
    });
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function includeFile(path: string, state: SplitState): void {
  const lines = readLines(path, state.read);
  let index = 0;
  const next = () => lines[index++] ?? '';
  let line = next();
  while (line !== '') {
    let lineNumber = index;
    const comment = line.indexOf('//');
    if (comment !== -1) line = line.slice(0, comment);
    const marker = STAGE_MARKERS.find(([text]) => line.includes(text));
    if (marker) {
      state.reading = marker[1];
      line = next();
      continue;
    }
    // Godot reads the line after an include as it is: it neither cuts its comment nor looks for a marker.
    while (line.includes('#include ')) {
      includeLine(line, path, lineNumber, state);
      line = next();
      lineNumber = index;
    }
    if (state.reading)
      state.stages[state.reading].push({ text: line.replace(/[\r\n]/g, ''), file: path, line: lineNumber });
    line = next();
  }
}

function includeLine(line: string, path: string, lineNumber: number, state: SplitState): void {
  const target = line.replace('#include ', '').trim().slice(1, -1);
  const included = target.startsWith('thirdparty/') ? target : joinPath(dirname(path), target);
  const reading = state.reading;
  if (!reading || state.included[reading].has(included)) return;
  state.included[reading].add(included);
  if (state.read(included) === undefined)
    throw new ShadingLanguageError(`In file "${path}": #include "${target}" could not be found!`, {
      file: path,
      line: lineNumber,
      column: line.indexOf('#include') + 1,
    });
  includeFile(included, state);
}

const dirname = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));

/** `os.path.relpath` of a joined path: `..` and `.` resolved. */
function joinPath(directory: string, relative: string): string {
  const parts: string[] = [];
  for (const part of `${directory}/${relative}`.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}
