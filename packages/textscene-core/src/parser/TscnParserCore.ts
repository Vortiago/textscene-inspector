/**
 * The one TSCN scanning loop, shared by renderer and linter, with no three.js
 * dependency. A node-creator callback builds each node. An optional ParseObserver lets
 * the strict path collect errors and run validators. With no observer the loop keeps
 * the lenient skip-and-continue recovery.
 */

import { resolveDeprecatedProperty, type ResolvedProperty } from '../godot/deprecated.js';
import type {
  TscnScene,
  TscnNode,
  TscnExternalResource,
  TscnInternalResource,
  NodeOrigin,
} from './types.js';
import {
  parseHeading,
  parseProperty,
  isHeading,
  isSectionHeading,
  isEmpty,
  scanValueChunk,
  isIncompleteState,
  INITIAL_SCAN_STATE,
  stripLineComment,
} from './utils.js';
import type { ParsedHeading, ValueScanState } from './utils.js';
import { parseExternalResource, parseInternalResource } from './resourceParsers.js';
import {
  buildSceneTree,
  emptyParentHeadings,
  rootDeclaringParent,
  strandedNodes,
} from './sceneTreeBuilder.js';
import * as logger from '../logger.js';

export type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource' | 'resource';

/**
 * Builds a TscnNode from a parsed heading and its properties. The renderer uses
 * NodeRegistry. The linter builds a plain node with no three.js dependency.
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
   * A property value completed, after any multiline accumulation. `line` is its
   * starting line. `ownerType` is the heading's `type=` for node/sub_resource, the
   * `[gd_resource type="…"]` header's for a `[resource]` body, else undefined. `key` and
   * `value` are as written. `stored` is the pair the section's bag holds, a deprecated
   * spelling resolved, so an observer never derives it a second way.
   */
  onProperty?(
    section: SectionType,
    ownerType: string | undefined,
    key: string,
    value: string,
    line: number,
    isMultiline: boolean,
    stored: ResolvedProperty
  ): void;
  /**
   * A `[node]` or `[sub_resource]` section closed, and the scan built `built` from it. `line` is
   * its heading's line. It fires after the section's last `onProperty`, so an observer can file
   * what it collected under the object.
   */
  onSectionBuilt?(built: TscnNode | TscnInternalResource, line: number): void;
}

/**
 * Lenient rendering uses the loop bare. Strict linting attaches a ParseObserver (see
 * StrictTscnParser) to collect errors and run validators.
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
    logger.info('[Parser] Starting TSCN parsing');
    // Split on CRLF or LF: a trailing \r on each line of a Windows-authored file
    // would corrupt accumulated multi-line string values.
    const lines = content.split(/\r?\n/);

    // Every node beside its heading's line, in scan order. The line stays off `TscnNode`:
    // the orphan report reads it here, and a strict observer gets it from `onSectionBuilt`.
    // One array, not a parallel `nodes` list, which two push sites would keep in step.
    const origins: NodeOrigin[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ParsedHeading | null = null;
    let currentHeadingLine = 0;
    // The type a `.tres` header declares. Its `[resource]` body has no type:
    // `res_type` comes from the header (resource_format_text.cpp:1166) and
    // `ClassDB::instantiate(res_type)` builds it when the tag opens (:741). A `.tscn`
    // has no such header, so this stays undefined there.
    let headerResourceType: string | undefined;
    let currentProperties: Record<string, string> = {};
    // A string value whose quote does not close on its own line. Raw lines append
    // until the quote balances. The array is joined once, and `scanState` carries
    // the balance scan forward one chunk at a time: O(total length), where a `+=`
    // plus a full rescan per line is O(length^2).
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
            recoverableById: currentHeading.attributes.parent_id_path !== undefined,
          });
          observer?.onSectionBuilt?.(node, currentHeadingLine);
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
          observer?.onSectionBuilt?.(resource, currentHeadingLine);
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
        // The one join per value: O(total length), not one per appended line.
        const value = pendingMultiline.lines.join('\n');
        const resolved = resolveDeprecatedProperty(currentOwnerType(), pendingMultiline.key, value);
        currentProperties[resolved.key] = resolved.value;
        observer?.onProperty?.(
          currentSection,
          currentOwnerType(),
          pendingMultiline.key,
          value,
          pendingMultiline.startLine,
          pendingMultiline.lines.length > 1,
          resolved
        );
      }
      pendingMultiline = null;
    };

    for (let i = 0; i < lines.length; i++) {
      // A `;` comment ends the line for Godot's reader wherever it sits, so it
      // is gone before the line is read as heading, property or continuation.
      const line = stripLineComment(lines[i]!, pendingMultiline?.scanState.inString ?? false);
      const lineNumber = i + 1;

      // Inside an open string, append raw lines, blank ones included. Only a real
      // section heading means the string never closed: salvage it and process the
      // heading. BBCode tags and bracketed content are string content, so
      // `isSectionHeading`, not `isHeading`, decides.
      if (pendingMultiline) {
        if (isSectionHeading(line)) {
          storePending();
        } else {
          // Scan only this chunk: a `\n` separator affects neither `inString` nor
          // `depth`, so scanning `line` alone yields the state the joined string
          // would.
          pendingMultiline.lines.push(line);
          pendingMultiline.scanState = scanValueChunk(line, pendingMultiline.scanState);
          if (!isIncompleteState(pendingMultiline.scanState)) storePending();
          continue;
        }
      }

      // A comment-only line is already whitespace: `stripLineComment` above is
      // the single place a `;` is understood.
      if (isEmpty(line)) {
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
        // A line that opens a bracket but never parses as a heading is malformed,
        // for example a missing ']'. The lenient path recovers below. Strict
        // consumers get the error.
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
            // Stored under the name and literal the setter receives: a pre-4.0 alias like
            // `frames` is `sprite_frames`, and `extents` is `size` doubled, so every
            // reader sees one key and one value. The observer gets both as written,
            // since a diagnostic names what is in the file, and the stored pair beside them.
            const resolved = resolveDeprecatedProperty(
              currentOwnerType(),
              property.key,
              property.value
            );
            currentProperties[resolved.key] = resolved.value;
            observer?.onProperty?.(
              currentSection,
              currentOwnerType(),
              property.key,
              property.value,
              lineNumber,
              false,
              resolved
            );
          }
        }
      }
    }

    storePending(); // flush a string that ran to EOF unclosed
    finalizeSection();

    const sceneTree = buildSceneTree(origins.map((o) => o.node));
    const orphanedNodes = strandedNodes(origins, sceneTree);
    const rootWithParent = rootDeclaringParent(origins);
    const emptyParents = emptyParentHeadings(origins);
    for (const { node } of orphanedNodes) {
      logger.warn(
        `[Parser] Orphaned node dropped from the scene tree: "${node.name}" (type: ${node.type}, parent: "${node.parent ?? 'none'}", instance: ${node.instance ?? 'none'})`
      );
    }

    logger.info(`[Parser] Parsing complete: ${origins.length} nodes, ${externalResources.length} external resources, ${internalResources.length} internal resources`);

    return {
      nodes: sceneTree,
      externalResources,
      internalResources,
      ...(orphanedNodes.length > 0 ? { orphanedNodes } : {}),
      ...(rootWithParent ? { rootWithParent } : {}),
      ...(emptyParents.length > 0 ? { emptyParentHeadings: emptyParents } : {}),
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
