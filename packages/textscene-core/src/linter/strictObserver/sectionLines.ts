/**
 * The line of each section's heading and of each of its properties, filed under what the section builds, so a
 * diagnostic lands on its line.
 */

import type { BuiltSection } from '../../parser/types.js';
import type { SectionLines } from '../types.js';

interface SectionLineRecorder {
  readonly lines: Map<BuiltSection, SectionLines>;
  /** Opens a section whose heading starts at the 1-based `column`. Its property lines start empty. */
  start(column: number): void;
  /** Records a property of the open section under the key the scan stores its value under. */
  record(key: string, line: number, column: number): void;
  /** Files the open section's lines under what it built. */
  built(section: BuiltSection, headingLine: number): void;
}

export function sectionLines(): SectionLineRecorder {
  const lines = new Map<BuiltSection, SectionLines>();
  // A fresh map per heading, since the finished one is kept.
  let propertyLines = new Map<string, number>();
  let propertyColumns = new Map<string, number>();
  let headingColumn = 1;
  return {
    lines,
    start(column) {
      propertyLines = new Map();
      propertyColumns = new Map();
      headingColumn = column;
    },
    record(key, line, column) {
      propertyLines.set(key, line);
      propertyColumns.set(key, column);
    },
    built(section, headingLine) {
      lines.set(section, { heading: headingLine, headingColumn, properties: propertyLines, propertyColumns });
    },
  };
}
