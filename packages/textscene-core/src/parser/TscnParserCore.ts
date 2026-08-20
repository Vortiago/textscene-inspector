/**
 * Core TSCN parsing logic - the single scanning loop shared by renderer and linter
 *
 * This module contains the shared parsing loop logic without any three.js dependencies.
 * It accepts a node creator callback to allow different implementations for rendering vs.
 * linting, plus an optional ParseObserver so the strict (linting) path can collect
 * errors and run validators without duplicating the loop. With no observer, the loop
 * behaves exactly like the lenient renderer path always has (skip-and-continue recovery).
 */

import { canonicalPropertyName } from '../godot/deprecated.js';
import type {
  TscnScene,
  TscnNode,
  TscnExternalResource,
  TscnInternalResource,
  OrphanedNode,
} from './types.js';
import {
  parseHeading,
  parseProperty,
  isHeading,
  isSectionHeading,
  isComment,
  isEmpty,
  scanValueChunk,
  isIncompleteState,
  INITIAL_SCAN_STATE,
} from './utils.js';
import type { ParsedHeading, ValueScanState } from './utils.js';
import { parseExternalResource, parseInternalResource } from './resourceParsers.js';
import { buildSceneTree, strandedNodes } from './sceneTreeBuilder.js';
import * as logger from '../logger.js';

export type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource' | 'resource';

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
   * property's STARTING line; `ownerType` is the type the section's properties
   * belong to — the heading's own `type=` for node/sub_resource, the
   * `[gd_resource type="…"]` header's for a `[resource]` body, undefined
   * elsewhere; `isMultiline` is true when the value spans multiple physical
   * lines.
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

    // Every node beside the line its heading is on, in scan order. The line
    // lives here rather than on `TscnNode` because only the orphan report below
    // reads it, and every node in the tree would otherwise carry a field
    // nothing else uses. One array, not two: a parallel `nodes` list is an
    // invariant two push sites have to keep, and a missed push yields an orphan
    // with no line.
    const origins: OrphanedNode[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ParsedHeading | null = null;
    let currentHeadingLine = 0;
    // The type a standalone `.tres` declares once, in its file header. Its
    // `[resource]` body carries no type of its own — `res_type` comes from the
    // header (resource_format_text.cpp:1166) and is what
    // `ClassDB::instantiate(res_type)` builds when the `resource` tag opens
    // (:741). A `.tscn` has no such header, so this stays undefined there.
    let headerResourceType: string | undefined;
    let currentProperties: Record<string, string> = {};
    // Accumulator for a string value whose opening quote isn't closed on its
    // own line (Godot multi-line text). Subsequent raw lines are appended
    // until the quote balances. Tracks the starting line for the observer.
    // Lines accumulate in an array (joined only once, when the value closes)
    // and `scanState` carries the string/bracket-balance scan forward one
    // chunk at a time — both O(total length) overall, not O(length^2) (a
    // naive `+=` re-copy plus a full rescan from index 0 on every new line).
    let pendingMultiline: {
      key: string;
      lines: string[];
      startLine: number;
      scanState: ValueScanState;
    } | null = null;

    const finalizeSection = () => {
      if (!currentHeading) return;

      if (currentSection === 'node') {
        const node = nodeCreator(currentHeading, currentProperties);
        if (node) {
          origins.push({
            node,
            line: currentHeadingLine,
            declaredParent: currentHeading.attributes.parent,
          });
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

    // ownerType for the observer: the type the current section's body
    // properties belong to, or undefined where the section names none.
    const currentOwnerType = (): string | undefined => {
      if (currentSection === 'node' || currentSection === 'sub_resource') {
        return currentHeading?.attributes.type;
      }
      return currentSection === 'resource' ? headerResourceType : undefined;
    };

    const storePending = () => {
      if (pendingMultiline && currentHeading) {
        // Join happens exactly once per value, here — O(total length), not
        // per appended line.
        const value = pendingMultiline.lines.join('\n');
        currentProperties[canonicalPropertyName(currentOwnerType(), pendingMultiline.key)] =
          value;
        observer?.onProperty?.(
          currentSection,
          currentOwnerType(),
          pendingMultiline.key,
          value,
          pendingMultiline.startLine,
          pendingMultiline.lines.length > 1
        );
      }
      pendingMultiline = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!; // Array access within bounds is safe
      const lineNumber = i + 1;

      // Inside an open multi-line string: append raw lines (preserving blank
      // lines within the string) until the quote balances. Only a REAL section
      // heading (`[node …]`, `[ext_resource …]`, …) means the string was never
      // closed — salvage it and fall through so the heading is still processed.
      // Lines that merely look like headings — BBCode tags (`[u]…[/u]`,
      // `[center]`) and bracketed array/dict content — are string CONTENT and
      // must keep accumulating; `isSectionHeading` (not `isHeading`) draws that
      // line.
      if (pendingMultiline) {
        if (isSectionHeading(line)) {
          storePending();
        } else {
          // Append the line (not a re-concatenated string) and advance the
          // scan by just this chunk — a `\n` line separator affects neither
          // `inString` nor `depth`, so scanning `line` alone (without joining
          // it in first) yields the identical state as scanning the joined
          // string would.
          pendingMultiline.lines.push(line);
          pendingMultiline.scanState = scanValueChunk(line, pendingMultiline.scanState);
          if (!isIncompleteState(pendingMultiline.scanState)) storePending();
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
          currentHeadingLine = lineNumber;
          if (currentHeading.type === 'gd_resource') {
            headerResourceType = currentHeading.attributes.type;
          }
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
          const scanState = scanValueChunk(property.value, INITIAL_SCAN_STATE);
          if (isIncompleteState(scanState)) {
            pendingMultiline = {
              key: property.key,
              lines: [property.value],
              startLine: lineNumber,
              scanState,
            };
          } else {
            // Stored under the name the SETTER writes: a pre-4.0 alias like
            // `frames` is the same field as `sprite_frames` to the engine, so
            // every reader downstream — typed parser, render component and
            // rule alike — sees one key. The observer still receives the key as
            // written, because a diagnostic must name what is in the file.
            currentProperties[canonicalPropertyName(currentOwnerType(), property.key)] =
              property.value;
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

    const sceneTree = buildSceneTree(origins.map((o) => o.node));
    const orphanedNodes = strandedNodes(origins, sceneTree);
    for (const { node } of orphanedNodes) {
      logger.warn(
        `Orphaned node dropped from the scene tree: "${node.name}" (type: ${node.type}, parent: "${node.parent ?? 'none'}", instance: ${node.instance ?? 'none'})`
      );
    }

    logger.info(`Parsing complete: ${origins.length} nodes, ${externalResources.length} external resources, ${internalResources.length} internal resources`);

    return {
      nodes: sceneTree,
      externalResources,
      internalResources,
      ...(orphanedNodes.length > 0 ? { orphanedNodes } : {}),
    };
  }

  private identifySection(heading: ParsedHeading | null): SectionType {
    if (!heading) return 'none';

    if (heading.type === 'node') return 'node';
    if (heading.type === 'ext_resource') return 'ext_resource';
    if (heading.type === 'sub_resource') return 'sub_resource';
    if (heading.type === 'resource') return 'resource';

    return 'none';
  }
}
