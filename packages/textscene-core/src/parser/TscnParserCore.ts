/**
 * The one TSCN scanning loop, shared by renderer and linter, with no three.js
 * dependency. A node-creator callback builds each node. An optional ParseObserver lets
 * the strict path collect errors and run validators. With no observer the loop keeps
 * the lenient skip-and-continue recovery.
 */

import { headingOrder } from './headingOrder.js';
import { resolveDeprecatedProperty, type ResolvedProperty } from '../godot/classdb/deprecated.js';
import type {
  TscnScene,
  SceneNode,
  TscnExternalResource,
  TscnInternalResource,
  TscnMainResource,
  NodeOrigin,
  BuiltSection,
  FileValue,
} from './types.js';
import {
  parseHeading,
  parseProperty,
  isHeading,
  isSectionHeading,
  scanValueChunk,
  isIncompleteState,
  INITIAL_SCAN_STATE,
  stripLineComment,
  leadingSpace,
  godotIndent,
  isGodotBlank,
  splitLines,
} from './utils.js';
import type { ParsedHeading, ValueScanState } from './utils.js';
import { HEADER_READING, readTag, SECTION_READING, type TagField } from '../godot/variant/tagReader.js';
import { isEscapedNewline, strToVar } from '../godot/variant/strToVar.js';
import { VARIANT_TYPE } from '../godot/variant/variantType.js';
import { parseExternalResource, parseInternalResource } from './resourceParsers.js';
import { seatScene, type SceneSeating } from './sceneTreeBuilder.js';
import { refusesToInstantiate } from './instantiateRefusal.js';
import * as logger from '../logger.js';
import { nodeOrigin } from './rawNode.js';
import { simplifiedNodePath } from '../godot/string/nodePath.js';
import { GodotError } from '../godot/variant/parseError.js';

export type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource' | 'resource';

/**
 * Builds a node from a parsed heading and its properties. The renderer builds a `TscnNode`
 * through NodeRegistry. The linter builds a `RawNode` with no three.js dependency.
 */
export type NodeCreator<N extends SceneNode<N>> = (
  heading: ParsedHeading,
  properties: Record<string, string>
) => N | null;

/** What one scan returns: the tree, and the headings it was built from. */
interface CoreParseResult<N extends SceneNode<N>> {
  scene: TscnScene<N>;
  /**
   * Each `[node]` heading's node beside its line, in scan order, for checks against the tree. A
   * heading whose node creator returns null is absent, so index 0 is Godot's root only when the
   * creator builds every node.
   */
  origins: readonly NodeOrigin<N>[];
  /** The seating of `origins`: the tree, and the copy each heading's node became in it. */
  seating: SceneSeating<N>;
}

/** One property value the scan completed, after any multiline accumulation. */
export interface ParsedProperty {
  section: SectionType;
  /**
   * The heading's `type=` for node/sub_resource, the `[gd_resource type="…"]` header's for a
   * `[resource]` body, else undefined.
   */
  ownerType: string | undefined;
  /** The key as written. */
  key: string;
  /** The value as written. */
  value: string;
  /** The line the key sits on. */
  line: number;
  /** The 0-based column the key starts at, past a heading's `]` where it follows one. */
  column: number;
  /** The line and 0-based column the value's text starts at, a later line where it starts after its key's. */
  valueStart: { line: number; column: number };
  /** The line the value ends on, a later line where the value starts after its key's line. */
  endLine: number;
  isMultiline: boolean;
  /** The pair the section's bag holds, a deprecated spelling resolved, so no observer derives it again. */
  stored: ResolvedProperty;
}

/** The 0-based columns a heading spans on its first line, the end exclusive. */
export interface HeadingColumns {
  start: number;
  end: number;
}

/**
 * Hooks into the scanning loop for strict (linting) consumers. The observer is
 * purely additive: it never changes what the lenient loop parses or recovers.
 */
export interface ParseObserver {
  /** Malformed line detected: INVALID_HEADING_FORMAT or INVALID_PROPERTY_FORMAT. */
  onError?(error: { message: string; line: number; column: number; code: string }): void;
  /** A heading parsed successfully and a new section begins. `columns` spans its text on its first line. */
  onSectionStart?(heading: ParsedHeading, section: SectionType, line: number, columns: HeadingColumns): void;
  /** A property value completed. */
  onProperty?(property: ParsedProperty): void;
  /**
   * An `[ext_resource]`, `[sub_resource]`, `[node]` or `[resource]` section closed, and the scan
   * built `built` from it. `line` is its heading's line. It fires after the section's last `onProperty`, so an
   * observer can file what it collected under the object.
   */
  onSectionBuilt?(built: BuiltSection, line: number): void;
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
   * @returns The scene and its headings
   */
  parse<N extends SceneNode<N>>(
    content: string,
    nodeCreator: NodeCreator<N>,
    observer?: ParseObserver
  ): CoreParseResult<N> {
    // Debug, not info: an editor host parses on each keystroke.
    logger.debug('[Parser] Starting TSCN parsing');
    const lines = splitLines(content);
    const lineStarts = lineStartsOf(content);

    // Every node beside its heading's line, in scan order. The line stays off the node:
    // the orphan report reads it here, and a strict observer gets it from `onSectionBuilt`.
    // One array, not a parallel `nodes` list, which two push sites would keep in step.
    const origins: NodeOrigin<N>[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];
    // One per file: the loader refuses any tag after the `[resource]` body
    // (`resource_format_text.cpp:837-841`), so a later one is a corrupt file, and the last one read stays.
    let mainResource: TscnMainResource | undefined;
    const editableInstances: string[] = [];
    const headings = headingOrder();
    const fileValues: FileValue[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ParsedHeading | null = null;
    let currentHeadingLine = 0;
    let currentHeadingColumn = 1;
    // Where the next pass starts on its line: past a heading's `]`, Godot reads the rest of the line as body.
    let resumeColumn = 0;
    // The newlines a string escapes so far, which Godot's line counter skips (variant_parser.cpp:386).
    let skippedLines = 0;
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
      /** The length of `lines` joined, so the offset of the newline after the last line. */
      joinedLength: number;
      /** The offset of each newline in the joined value that a string escapes. */
      skippedNewlines: number[];
      startLine: number;
      startColumn: number;
      valueStart: { line: number; column: number };
      endLine: number;
      godotStartLine: number;
      scanState: ValueScanState;
    } | null = null;

    const finalizeSection = () => {
      if (!currentHeading) return;

      if (currentSection === 'node') {
        const node = nodeCreator(currentHeading, currentProperties);
        if (node) {
          origins.push(
            nodeOrigin(currentHeading, node, { line: currentHeadingLine, column: currentHeadingColumn })
          );
          observer?.onSectionBuilt?.(node, currentHeadingLine);
        }
      } else if (currentSection === 'ext_resource') {
        const resource = parseExternalResource(currentHeading);
        if (resource) {
          externalResources.push(resource);
          observer?.onSectionBuilt?.(resource, currentHeadingLine);
        }
      } else if (currentSection === 'sub_resource') {
        const resource = parseInternalResource(currentHeading, currentProperties);
        if (resource) {
          internalResources.push(resource);
          observer?.onSectionBuilt?.(resource, currentHeadingLine);
        }
      } else if (currentSection === 'resource') {
        mainResource = { data: currentProperties };
        observer?.onSectionBuilt?.(mainResource, currentHeadingLine);
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

    // The value as written, not as stored: the loader parses the text the file holds.
    const addFileValue = (
      value: Omit<FileValue, 'subResourcesNamed' | 'extResourcesBefore'>,
      subResourcesNamed: number
    ) => {
      // Every read names `Resource`, so a value without it holds no read and costs no object.
      if (headings.isStopped() || !value.text.includes('Resource')) return;
      fileValues.push({ ...value, subResourcesNamed, extResourcesBefore: externalResources.length });
    };
    // A body is read after the file opens, so no body value sits in the opening tag.
    const addBodyValue = (text: string, line: number, skippedNewlines: readonly number[] = []) => {
      const place = currentSection === 'node' ? 'node' : 'section';
      // The loader names a `[sub_resource]` before it reads the body (resource_format_text.cpp:629).
      const ownSection = currentSection === 'sub_resource' ? 1 : 0;
      if (currentSection === 'node' || currentSection === 'sub_resource' || currentSection === 'resource')
        addFileValue(
          { text, line, place, isOpeningTag: false, isHeadingField: false, skippedNewlines },
          internalResources.length + ownSection
        );
    };

    const storePending = () => {
      if (pendingMultiline && currentHeading) {
        // The one join per value: O(total length), not one per appended line.
        const joined = pendingMultiline.lines.join('\n');
        // A complete value ends where its key's line would trim it, so a value reads the same on either line.
        const value = isIncompleteState(pendingMultiline.scanState) ? joined : joined.trimEnd();
        const resolved = resolveDeprecatedProperty(currentOwnerType(), pendingMultiline.key, value);
        currentProperties[resolved.key] = resolved.value;
        addBodyValue(value, pendingMultiline.godotStartLine, pendingMultiline.skippedNewlines);
        observer?.onProperty?.({
          section: currentSection,
          ownerType: currentOwnerType(),
          key: pendingMultiline.key,
          value,
          line: pendingMultiline.startLine,
          column: pendingMultiline.startColumn,
          valueStart: pendingMultiline.valueStart,
          endLine: pendingMultiline.endLine,
          isMultiline: pendingMultiline.endLine > pendingMultiline.startLine,
          stored: resolved,
        });
      }
      pendingMultiline = null;
    };

    // Every field the loader parses in a heading, read before the heading opens its section.
    const addFieldValues = (fields: readonly TagField[], type: string, previous: string | null) => {
      const isOpeningTag = previous === 'gd_scene' || previous === 'gd_resource';
      const place =
        previous === null
          ? 'header'
          : type === 'connection'
            ? 'binds'
            : previous === 'node'
              ? 'node'
              : 'section';
      for (const { start, end, line } of fields) {
        // A field is one value, so one that opens with a quote is a string and holds no read.
        if (content[start] !== '"') {
          const text = withoutComments(content.slice(start, end));
          const skippedNewlines = escapedNewlinesIn(text);
          addFileValue(
            { text, line, place, isOpeningTag, isHeadingField: true, skippedNewlines },
            internalResources.length
          );
        }
      }
    };

    const openSection = (
      heading: ParsedHeading,
      line: number,
      columns: HeadingColumns,
      endLine: number,
      fields: readonly TagField[]
    ) => {
      currentHeading = heading;
      currentSection = this.identifySection(heading);
      currentHeadingLine = line;
      currentHeadingColumn = columns.start + 1;
      if (heading.type === 'gd_resource') headerResourceType = heading.attributes.type;
      const editablePath = heading.type === 'editable' ? heading.attributes.path : undefined;
      if (editablePath !== undefined) editableInstances.push(simplifiedNodePath(editablePath));
      addFieldValues(fields, heading.type, headings.previous());
      // Godot judges a tag once it has read the `]`, so a refusal names the line it ends on.
      headings.read(heading.type, endLine);
      observer?.onSectionStart?.(heading, currentSection, line, columns);
    };

    for (let i = 0; i < lines.length; i++) {
      // A `;` comment ends the line for Godot's reader wherever it sits, so it
      // is gone before the line is read as heading, property or continuation.
      const column = resumeColumn;
      resumeColumn = 0;
      const line = stripLineComment(lines[i]!.slice(column), pendingMultiline?.scanState.inString ?? false);
      const lineNumber = i + 1;
      const godotLine = lineNumber - skippedLines;

      // Inside an open string, append raw lines, blank ones included. Only a real
      // section heading means the string never closed: salvage it and process the
      // heading. BBCode tags and bracketed content are string content, so
      // `isSectionHeading`, not `isHeading`, decides.
      if (pendingMultiline) {
        const awaitsValue = pendingMultiline.lines.length === 0;
        if (isSectionHeading(line) || (awaitsValue && opensKey(line))) {
          // The lenient path keeps the next key, so an empty value stays empty.
          storePending();
        } else if (awaitsValue && isGodotBlank(line)) {
          continue;
        } else {
          // Godot reads the value from the token after the `=`, so a value on a later line starts there.
          const indent = awaitsValue ? leadingSpace(line) : 0;
          const chunk = line.slice(indent);
          if (awaitsValue) {
            pendingMultiline.godotStartLine = godotLine;
            pendingMultiline.valueStart = { line: lineNumber, column: column + indent };
          }
          // A `\n` separator moves neither `inString` nor `depth`, so this chunk gives the joined state.
          pendingMultiline.joinedLength += (awaitsValue ? 0 : 1) + chunk.length;
          pendingMultiline.lines.push(chunk);
          pendingMultiline.endLine = lineNumber;
          pendingMultiline.scanState = scanValueChunk(chunk, pendingMultiline.scanState);
          if (pendingMultiline.scanState.inString && escapesItsNewline(content, lineStarts, i)) {
            pendingMultiline.skippedNewlines.push(pendingMultiline.joinedLength);
            skippedLines++;
          }
          if (!isIncompleteState(pendingMultiline.scanState)) storePending();
          continue;
        }
      }

      // Godot reads the header from the first token, so any text before it, a BOM too, is a refused tag.
      const readsHeader = headings.previous() === null && !headings.isStopped();
      const indent = readsHeader ? headerIndent(line) : godotIndent(line);
      // A comment-only line is already blank: `stripLineComment` above is the one place a `;` is read.
      if (readsHeader ? indent === line.length : isGodotBlank(line)) continue;

      const opensTag = readsHeader || line[indent] === '[';
      if (opensTag) {
        const reading = headings.previous() === null ? HEADER_READING : SECTION_READING;
        const tag = readTag(content, lineStarts[i]! + column + indent, godotLine, reading);
        if (tag && !('error' in tag)) {
          const end = lineAndColumnOf(lineStarts, tag.end, i);
          finalizeSection();
          skippedLines = end.line + 1 - tag.endLine;
          const columns = { start: column + indent, end: end.line === i ? end.column : column + line.length };
          openSection(
            parseHeading(headingText(lines, i, column, end))!,
            lineNumber,
            columns,
            tag.endLine,
            tag.fields
          );
          // Text after the `]` is the section's body, so the next pass reads the rest of that line.
          const hasRest = !isGodotBlank(lines[end.line]!.slice(end.column));
          resumeColumn = hasRest ? end.column : 0;
          i = hasRest ? end.line - 1 : end.line;
          continue;
        }
        // The section before closes as the tag opens, so a field reads what it declared.
        finalizeSection();
        if (tag) {
          addFieldValues(tag.fields, tag.name ?? '', headings.previous());
          headings.refuse({ error: tag.error, code: tag.code, line: tag.line });
        } else if (readsHeader) {
          // `open` prints the empty message of a header that meets the end (resource_format_text.cpp:1131).
          headings.refuse({ error: '', code: GodotError.FileEof, line: godotLine });
        }
        observer?.onError?.({
          message: `Invalid heading format: "${line.trim()}"`,
          line: lineNumber,
          column: column + indent + 1,
          code: 'INVALID_HEADING_FORMAT',
        });
        // A header refused past its line still names its type, so the file reads as a resource.
        if (tag?.name === 'gd_resource' && !isHeading(line))
          headerResourceType = typeField(content, tag.fields);
        // The lenient path draws what it can of a heading Godot refuses.
        if (isHeading(line)) {
          openSection(
            parseHeading(line)!,
            lineNumber,
            { start: column + indent, end: column + line.length },
            godotLine,
            []
          );
          continue;
        }
        // An unclosed heading draws nothing, and the lines its tag read are no section's body.
        if (tag) {
          const stopLine = lineAndColumnOf(lineStarts, tag.stop, i).line;
          // The lenient tree reads a heading on the stop line, wherever on it the tag stopped.
          const opensNextTag =
            (content[tag.stop] === '[' &&
              tag.stop === lineStarts[stopLine]! + godotIndent(lines[stopLine]!)) ||
            (stopLine > i && isSectionHeading(stripLineComment(lines[stopLine]!)));
          i = Math.max(i, opensNextTag ? stopLine - 1 : stopLine);
        }
        continue;
      }
      const property = parseProperty(line);
      if (!property) {
        observer?.onError?.({
          message: `Invalid property format: "${line.trim()}"`,
          line: lineNumber,
          column: column + leadingSpace(line) + 1,
          code: 'INVALID_PROPERTY_FORMAT',
        });
        continue;
      }

      if (currentHeading) {
        const scanState = scanValueChunk(property.value, INITIAL_SCAN_STATE);
        const awaitsValue = property.value === '';
        if (awaitsValue || isIncompleteState(scanState)) {
          pendingMultiline = {
            key: property.key,
            lines: awaitsValue ? [] : [property.value],
            joinedLength: property.value.length,
            skippedNewlines: [],
            startLine: lineNumber,
            startColumn: column + leadingSpace(line),
            valueStart: { line: lineNumber, column: column + valueOffset(line) },
            endLine: lineNumber,
            godotStartLine: godotLine,
            scanState,
          };
          if (scanState.inString && escapesItsNewline(content, lineStarts, i)) {
            pendingMultiline.skippedNewlines.push(property.value.length);
            skippedLines++;
          }
        } else {
          // Stored as the setter takes it, `frames` as `sprite_frames`. A diagnostic names the text.
          const resolved = resolveDeprecatedProperty(currentOwnerType(), property.key, property.value);
          currentProperties[resolved.key] = resolved.value;
          addBodyValue(property.value, godotLine);
          observer?.onProperty?.({
            section: currentSection,
            ownerType: currentOwnerType(),
            key: property.key,
            value: property.value,
            line: lineNumber,
            column: column + leadingSpace(line),
            valueStart: { line: lineNumber, column: column + valueOffset(line) },
            endLine: lineNumber,
            isMultiline: false,
            stored: resolved,
          });
        }
      }
    }

    storePending(); // flush a string that ran to EOF unclosed
    finalizeSection();

    // Each lookup by id indexes a table once (`utils/keyedLookup.ts`), so a table never changes after the scan.
    Object.freeze(origins);
    const headingStop = headings.stop();
    Object.freeze(externalResources);
    Object.freeze(internalResources);
    const seating = seatScene(origins);

    logger.debug(
      `[Parser] Parsing complete: ${origins.length} nodes, ${externalResources.length} external resources, ${internalResources.length} internal resources`
    );

    return {
      scene: {
        nodes: seating.roots,
        externalResources,
        internalResources,
        refusesToInstantiate: refusesToInstantiate(origins),
        ...(headerResourceType !== undefined ? { resourceType: headerResourceType } : {}),
        ...(editableInstances.length > 0 ? { editableInstances } : {}),
        ...(fileValues.length > 0 ? { fileValues } : {}),
        ...(headingStop ? { headingStop } : {}),
        ...(mainResource ? { mainResource } : {}),
      },
      origins,
      seating,
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

/** The `type=` string a tag read before it stopped, or undefined where it read none. */
function typeField(content: string, fields: readonly TagField[]): string | undefined {
  const field = fields.find(({ key }) => key === 'type');
  const value = field && strToVar(content.slice(field.start, field.end));
  return value?.type === VARIANT_TYPE.STRING ? value.value : undefined;
}

/** Where the header tag starts: a NUL before it ends the stream (measured), but a body line skips one. */
function headerIndent(line: string): number {
  const nul = line.indexOf('\0');
  const indent = godotIndent(line);
  return nul === -1 ? indent : Math.min(nul, indent);
}

/** True when line `at` ends on an odd run of backslashes with nothing, not even `\r`, before its `\n`. */
function escapesItsNewline(content: string, lineStarts: readonly number[], at: number): boolean {
  const next = lineStarts[at + 1];
  return next !== undefined && isEscapedNewline(content, next - 1);
}

/** A field over several lines without the `;` comments the tag reader skips, so no read sits in one. */
function withoutComments(text: string): string {
  if (!text.includes(';')) return text;
  let state = INITIAL_SCAN_STATE;
  return text
    .split('\n')
    .map((part) => {
      const code = stripLineComment(part, state.inString);
      state = scanValueChunk(code, state);
      return code;
    })
    .join('\n');
}

/** True when `line` starts with a bare key and its `=`, not a value such as `"x=y"` that holds one. */
function opensKey(line: string): boolean {
  return /^\s*[^\s"'[\](){},=]+\s*=/.test(line);
}

/** The offset of each newline in raw `text` that Godot's counter skips. */
function escapedNewlinesIn(text: string): number[] {
  const skipped: number[] = [];
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1))
    if (isEscapedNewline(text, at)) skipped.push(at);
  return skipped;
}

/** The offset each line of `content` starts at, as `splitLines` splits it. */
function lineStartsOf(content: string): number[] {
  const starts = [0];
  for (let at = content.indexOf('\n'); at !== -1; at = content.indexOf('\n', at + 1)) starts.push(at + 1);
  return starts;
}

/** Where a property line's value starts: past its `=` and the white space `parseProperty` trims. */
function valueOffset(line: string): number {
  const afterEquals = line.indexOf('=') + 1;
  return afterEquals + leadingSpace(line.slice(afterEquals));
}

/** The 0-based line and column of `offset`, searched forward from line `from`. */
function lineAndColumnOf(
  lineStarts: readonly number[],
  offset: number,
  from: number
): { line: number; column: number } {
  let line = from;
  while (line + 1 < lineStarts.length && lineStarts[line + 1]! <= offset) line++;
  return { line, column: offset - lineStarts[line]! };
}

/** A heading's text to its `]`, comments gone. The `]` is code, so no comment strip on its line is needed. */
function headingText(
  lines: readonly string[],
  first: number,
  column: number,
  end: { line: number; column: number }
): string {
  // One line holds no comment before its `]`, since the tag reader skips a comment to the line's end.
  if (end.line === first) return lines[first]!.slice(column, end.column);
  const spanned = lines.slice(first, end.line + 1);
  spanned[0] = spanned[0]!.slice(column);
  spanned[spanned.length - 1] = lines[end.line]!.slice(0, end.column);
  return withoutComments(spanned.join('\n'));
}
