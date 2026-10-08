/**
 * The line of each section's heading and of each of its properties, filed under what the section builds, so a
 * diagnostic lands on its line.
 */

import type { BuiltSection } from '../../parser/types.js';
import type { SectionLines } from '../types.js';

export interface SectionLineRecorder {
  readonly lines: Map<BuiltSection, SectionLines>;
  /** Opens a section. Its property lines start empty. */
  start(): void;
  /** Records a property of the open section under the key the scan stores its value under. */
  record(key: string, line: number): void;
  /** Files the open section's lines under what it built. */
  built(section: BuiltSection, headingLine: number): void;
}

export function sectionLines(): SectionLineRecorder {
  const lines = new Map<BuiltSection, SectionLines>();
  // A fresh map per heading, since the finished one is kept.
  let propertyLines = new Map<string, number>();
  return {
    lines,
    start() {
      propertyLines = new Map();
    },
    record(key, line) {
      propertyLines.set(key, line);
    },
    built(section, headingLine) {
      lines.set(section, { heading: headingLine, properties: propertyLines });
    },
  };
}
