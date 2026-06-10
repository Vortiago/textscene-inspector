/**
 * Core TSCN parsing logic - the single scanning loop shared by renderer and linter
 *
 * This module contains the shared parsing loop logic without any three.js dependencies.
 * It accepts a node creator callback to allow different implementations for rendering vs.
 * linting, plus an optional ParseObserver so the strict (linting) path can collect
 * errors and run validators without duplicating the loop. With no observer, the loop
 * behaves exactly like the lenient renderer path always has (skip-and-continue recovery).
 */

import type { TscnScene, TscnNode, TscnExternalResource, TscnInternalResource } from './types.js';
import {
  parseHeading,
  parseProperty,
  isHeading,
  isComment,
  isEmpty,
  isIncompleteValue,
} from './utils.js';
import type { ParsedHeading } from './utils.js';
import { parseExternalResource, parseInternalResource } from './resourceParsers.js';
import { buildSceneTree } from './sceneTreeBuilder.js';
import * as logger from '../logger.js';

export type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource';

/**
 * Callback function to create a TscnNode from parsed heading and properties
 * Different implementations:
 * - Renderer: Uses NodeRegistry with three.js
 * - Linter: Creates simple node without three.js dependency
 */
export type NodeCreator = (
  heading: ParsedHeading,
  properties: Record<string, string>
) => TscnNode | null;

/**
 * Hooks into the scanning loop for strict (linting) consumers. The observer is
 * purely additive: it never changes what the lenient loop parses or recovers.
 */
export interface ParseObserver {
  /** Malformed line detected: INVALID_HEADING_FORMAT or INVALID_PROPERTY_FORMAT. */
  onError?(error: { message: string; line: number; column: number; code: string }): void;
  /** A heading parsed successfully and a new section begins. */
  onSectionStart?(heading: ParsedHeading, section: SectionType, line: number): void;
  /**
   * A property value completed (after any multiline accumulation). `line` is the
   * property's STARTING line; `ownerType` is the heading's type attribute for
   * node/sub_resource sections, undefined otherwise; `isMultiline` is true when
   * the value spans multiple physical lines.
   */
  onProperty?(
    section: SectionType,
    ownerType: string | undefined,
    key: string,
    value: string,
    line: number,
    isMultiline: boolean
  ): void;
}

/**
 * Core TSCN parser without three.js dependencies.
 * The ONE scanning loop: lenient rendering uses it bare; strict linting attaches
 * a ParseObserver (see StrictTscnParser) to collect errors and run validators.
 */
export class TscnParserCore {
  /**
   * Parse TSCN content using a custom node creator
   * @param content - Raw TSCN file content
   * @param nodeCreator - Callback to create nodes (renderer-specific or linter-specific)
   * @param observer - Optional hooks for strict consumers (errors, sections, properties)
   * @returns Parsed scene structure
   */
  parse(content: string, nodeCreator: NodeCreator, observer?: ParseObserver): TscnScene {
    logger.info('Starting TSCN parsing');
    // Split on CRLF or LF so Windows-authored .tscn files don't leave a
    // trailing \r on each line (which would otherwise corrupt accumulated
    // multi-line string values).
    const lines = content.split(/\r?\n/);

    const nodes: TscnNode[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ParsedHeading | null = null;
    let currentProperties: Record<string, string> = {};
    // Accumulator for a string value whose opening quote isn't closed on its
    // own line (Godot multi-line text). Subsequent raw lines are appended
    // until the quote balances. Tracks the starting line for the observer.
    let pendingMultiline: { key: string; value: string; startLine: number } | null = null;

    const finalizeSection = () => {
      if (!currentHeading) return;

      if (currentSection === 'node') {
        const node = nodeCreator(currentHeading, currentProperties);
        if (node) {
          nodes.push(node);
        }
      } else if (currentSection === 'ext_resource') {
        const resource = parseExternalResource(currentHeading);
        if (resource) {
          externalResources.push(resource);
        }
      } else if (currentSection === 'sub_resource') {
        const resource = parseInternalResource(currentHeading, currentProperties);
        if (resource) {
          internalResources.push(resource);
        }
      }

      currentHeading = null;
      currentProperties = {};
    };

    // ownerType for the observer: the heading's type attribute, but only for
    // sections whose body properties belong to a typed owner.
    const currentOwnerType = (): string | undefined =>
      currentSection === 'node' || currentSection === 'sub_resource'
        ? currentHeading?.attributes.type
        : undefined;

    const storePending = () => {
      if (pendingMultiline && currentHeading) {
        currentProperties[pendingMultiline.key] = pendingMultiline.value;
        observer?.onProperty?.(
          currentSection,
          currentOwnerType(),
          pendingMultiline.key,
          pendingMultiline.value,
          pendingMultiline.startLine,
          pendingMultiline.value.includes('\n')
        );
      }
      pendingMultiline = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!; // Array access within bounds is safe
      const lineNumber = i + 1;

      // Inside an open multi-line string: append raw lines (preserving blank
      // lines within the string) until the quote balances. A new section
      // heading means the string was never closed — salvage it and fall
      // through so the heading is still processed. Lines here may legitimately
      // start with '[' (array/dict content), so no malformed-heading check.
      if (pendingMultiline) {
        if (isHeading(line)) {
          storePending();
        } else {
          pendingMultiline.value += '\n' + line;
          if (!isIncompleteValue(pendingMultiline.value)) storePending();
          continue;
        }
      }

      if (isEmpty(line) || isComment(line)) {
        continue;
      }

      if (isHeading(line)) {
        finalizeSection();

        currentHeading = parseHeading(line);
        if (currentHeading) {
          currentSection = this.identifySection(currentHeading);
          observer?.onSectionStart?.(currentHeading, currentSection, lineNumber);
        } else {
          observer?.onError?.({
            message: `Invalid heading format: "${line.trim()}"`,
            line: lineNumber,
            column: 1,
            code: 'INVALID_HEADING_FORMAT',
          });
        }
      } else {
        // A line that opens a bracket but never parses as a heading is a
        // malformed heading (e.g. missing the closing ']'). The lenient path
        // keeps its historical recovery below; strict consumers get the error.
        const malformedHeading = line.trim().startsWith('[');
        if (malformedHeading) {
          observer?.onError?.({
            message: `Invalid heading format: "${line.trim()}"`,
            line: lineNumber,
            column: 1,
            code: 'INVALID_HEADING_FORMAT',
          });
        }

        const property = parseProperty(line);
        if (!property) {
          if (!malformedHeading) {
            observer?.onError?.({
              message: `Invalid property format: "${line.trim()}"`,
              line: lineNumber,
              column: 1,
              code: 'INVALID_PROPERTY_FORMAT',
            });
          }
          continue;
        }

        if (currentHeading) {
          if (isIncompleteValue(property.value)) {
            pendingMultiline = { key: property.key, value: property.value, startLine: lineNumber };
          } else {
            currentProperties[property.key] = property.value;
            observer?.onProperty?.(
              currentSection,
              currentOwnerType(),
              property.key,
              property.value,
              lineNumber,
              false
            );
          }
        }
      }
    }

    storePending(); // flush a string that ran to EOF unclosed
    finalizeSection();

    const sceneTree = buildSceneTree(nodes);

    logger.info(`Parsing complete: ${nodes.length} nodes, ${externalResources.length} external resources, ${internalResources.length} internal resources`);

    return {
      nodes: sceneTree,
      externalResources,
      internalResources,
    };
  }

  private identifySection(heading: ParsedHeading | null): SectionType {
    if (!heading) return 'none';

    if (heading.type === 'node') return 'node';
    if (heading.type === 'ext_resource') return 'ext_resource';
    if (heading.type === 'sub_resource') return 'sub_resource';

    return 'none';
  }
}
