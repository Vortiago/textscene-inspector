/**
 * The strict parser's `ParseObserver`: it collects every syntax and format error as a `ParseError`, checks each
 * `[node]` heading, runs the registered property validators and records the lines and heading reads the linter needs.
 */

import type { ParseObserver } from '../../parser/TscnParserCore.js';
import type { BuiltSection } from '../../parser/types.js';
import type { ParseError, SectionLines } from '../types.js';
import { headingResourceReads, type HeadingResourceReads } from './headingResourceReads.js';
import { instancedPaths } from './instancedPaths.js';
import { nodeHeadingErrors } from './nodeHeadingChecks.js';
import { propertyRefusal } from './propertyCheck.js';
import { rootHeadingCounter } from './rootHeading.js';
import { sectionLines } from './sectionLines.js';
import { nodeOwnerOf, sectionOwnerOf, type SectionOwner } from './sectionOwner.js';

export interface StrictObserver {
  observer: ParseObserver;
  /** Filled while the scan runs. */
  errors: ParseError[];
  lines: Map<BuiltSection, SectionLines>;
  headingReads: HeadingResourceReads;
}

export function strictObserver(): StrictObserver {
  const errors: ParseError[] = [];
  const lines = sectionLines();
  const reads = headingResourceReads();
  const instanced = instancedPaths();
  const isRootHeading = rootHeadingCounter();
  // Written on each heading. Every refusal raised while it is set is about that section.
  let owner: SectionOwner | null = null;

  const observer: ParseObserver = {
    onError: (error) => {
      errors.push({
        severity: 'error',
        message: error.message,
        line: error.line,
        column: error.column,
        code: error.code,
        // A malformed heading would have opened a section, so it belongs to none and must not borrow the
        // previous owner. A malformed property line belongs to its section.
        ...(error.code === 'INVALID_PROPERTY_FORMAT' ? owner : null),
      });
    },

    onSectionStart: (heading, section, line) => {
      reads.read(heading);
      lines.start();
      if (section !== 'node') {
        owner = sectionOwnerOf(heading, section);
        return;
      }
      const nodeOwner = nodeOwnerOf(heading);
      owner = nodeOwner;
      const isRoot = isRootHeading();
      instanced.record(heading, isRoot);
      const context = {
        line,
        isRoot,
        owner: nodeOwner,
        hasInstancedAncestor: instanced.hasInstancedAncestor,
      };
      errors.push(...nodeHeadingErrors(heading, context));
    },

    onProperty: (property) => {
      // The key the scan stores the value under, so a reader of the bag finds the line.
      lines.record(property.stored.key, property.line);
      const error = propertyRefusal(property);
      if (error) errors.push({ ...error, ...owner });
    },

    onSectionBuilt: (built, headingLine) => lines.built(built, headingLine),
  };

  return { observer, errors, lines: lines.lines, headingReads: reads.reads };
}
