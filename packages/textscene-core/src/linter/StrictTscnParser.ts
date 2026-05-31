/**
 * Strict TSCN parser for linting
 *
 * Unlike the forgiving renderer parser, this parser validates format strictly
 * and reports all syntax/format errors as ParseError[].
 *
 * Note: This parser has its own loop for strict validation. While this creates some
 * duplication with TscnParserCore, it's necessary because strict validation requires
 * line-by-line error collection and immediate validation, which differs from the
 * forgiving parsing approach used for rendering.
 */

import type { TscnNode, TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import type { ParseError, StrictParseResult } from './types.js';
import {
  parseHeading,
  parseProperty,
  isHeading,
  isComment,
  isEmpty,
  isUnterminatedString,
} from '../parser/utils.js';
import type { ParsedHeading } from '../parser/utils.js';
import { parseExternalResource, parseInternalResource } from '../parser/resourceParsers.js';
import { buildSceneTree } from '../parser/sceneTreeBuilder.js';
import { validatorRegistry } from './ValidatorRegistry.js';

type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource';

/**
 * Creates a simple TscnNode without using NodeRegistry (avoids three.js dependency)
 */
function createSimpleNode(heading: ParsedHeading, properties: Record<string, string>): TscnNode {
  const node: TscnNode = {
    name: heading.attributes.name || '',
    // Use type if available, otherwise use index or instance identifier
    // Note: For index=/instance= nodes, type may be inferred from parent scene or remain as identifier
    type: heading.attributes.type || heading.attributes.index || heading.attributes.instance || '',
    properties,
    children: [], // Will be populated by buildSceneTree
  };

  // Only set parent if it exists (optional property)
  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
  }

  // Store special attributes if present
  if (heading.attributes.index) {
    (node.properties as Record<string, unknown>)['__instance_index'] = heading.attributes.index;
  }
  if (heading.attributes.instance) {
    (node.properties as Record<string, unknown>)['__instance'] = heading.attributes.instance;
  }

  return node;
}

export class StrictTscnParser {
  /**
   * Strictly parse TSCN content
   * @param content - TSCN file content
   * @returns Parse result with errors or parsed scene
   */
  parse(content: string): StrictParseResult {
    const lines = content.split(/\r?\n/);
    const errors: ParseError[] = [];

    const nodes: TscnNode[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ReturnType<typeof parseHeading> = null;
    let currentProperties: Record<string, string> = {};
    let currentLineNumber = 0;
    let currentNodeType: string | undefined;
    let currentResourceType: string | undefined;

    const finalizeSection = () => {
      if (!currentHeading) return;

      if (currentSection === 'node') {
        // Create simple node without NodeRegistry (avoids three.js dependency)
        const node = createSimpleNode(currentHeading, currentProperties);
        nodes.push(node);
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
      currentNodeType = undefined;
      currentResourceType = undefined;
    };

    for (let i = 0; i < lines.length; i++) {
      currentLineNumber = i + 1;
      const line = lines[i]!; // Array access within bounds is safe

      if (isEmpty(line) || isComment(line)) {
        continue;
      }

      if (isHeading(line)) {
        finalizeSection();

        currentHeading = parseHeading(line);
        if (!currentHeading) {
          errors.push({
            severity: 'error',
            message: `Invalid heading format: "${line.trim()}"`,
            line: currentLineNumber,
            column: 1,
            code: 'INVALID_HEADING_FORMAT',
          });
          continue;
        }

        currentSection = this.identifySection(currentHeading);

        // Strict validation for node headings
        if (currentSection === 'node') {
          if (!currentHeading.attributes.name) {
            errors.push({
              severity: 'error',
              message: 'Node heading must have "name=" attribute',
              line: currentLineNumber,
              column: 1,
              code: 'MISSING_NODE_NAME',
            });
          }
          // Nodes must have one of: type= (new nodes), index= (instanced scene child mods), or instance= (PackedScene instantiation)
          if (!currentHeading.attributes.type && !currentHeading.attributes.index && !currentHeading.attributes.instance) {
            errors.push({
              severity: 'error',
              message: 'Node heading must have "type=", "index=", or "instance=" attribute',
              line: currentLineNumber,
              column: 1,
              code: 'MISSING_NODE_IDENTIFIER',
            });
          }

          // Set currentNodeType for type-specific validation (only if type exists)
          if (currentHeading.attributes.type) {
            currentNodeType = currentHeading.attributes.type;
          } else {
            // For index= or instance= nodes, skip type-specific validation (type may be unknown)
            currentNodeType = undefined;
          }
        } else if (currentSection === 'sub_resource') {
          // Set currentResourceType for type-specific validation of SubResources
          if (currentHeading.attributes.type) {
            currentResourceType = currentHeading.attributes.type;
          } else {
            currentResourceType = undefined;
          }
        }
      } else {
        // Parse property
        const property = parseProperty(line);
        if (!property) {
          errors.push({
            severity: 'error',
            message: `Invalid property format: "${line.trim()}"`,
            line: currentLineNumber,
            column: 1,
            code: 'INVALID_PROPERTY_FORMAT',
          });
          continue;
        }

        // Handle multi-line string properties (e.g., shader code, label text).
        // Uses the SAME unescaped-quote-parity test as the lenient parser
        // (shared `isUnterminatedString`) so both agree on string termination —
        // including strings containing escaped quotes (`\"`) or trailing
        // backslashes (`\\"`).
        if (isUnterminatedString(property.value)) {
          let fullValue = property.value;

          // Keep appending lines until the quote parity balances.
          while (i + 1 < lines.length) {
            i++;
            currentLineNumber = i + 1;
            fullValue += '\n' + lines[i]!;
            if (!isUnterminatedString(fullValue)) {
              break; // string closed
            }
          }

          // Update property value with full multi-line content
          property.value = fullValue;
        }

        // Validate property value using registry (skip validation for multi-line strings like shader code)
        const isMultiLineString = property.value.includes('\n');
        if (!isMultiLineString) {
          // Validate node properties
          if (currentSection === 'node' && currentNodeType) {
            const validator = validatorRegistry.findValidator(currentNodeType, property.key);
            if (validator) {
              const error = validator(property.key, property.value, currentLineNumber);
              if (error) {
                errors.push(error);
              }
            }
          }
          // Validate SubResource properties
          if (currentSection === 'sub_resource' && currentResourceType) {
            const validator = validatorRegistry.findValidator(currentResourceType, property.key);
            if (validator) {
              const error = validator(property.key, property.value, currentLineNumber);
              if (error) {
                errors.push(error);
              }
            }
          }
        }

        if (currentHeading) {
          currentProperties[property.key] = property.value;
        }
      }
    }

    finalizeSection();

    // If errors found, return them without building scene tree
    if (errors.length > 0) {
      return { errors };
    }

    // Build scene tree and return
    const sceneTree = buildSceneTree(nodes);

    return {
      errors: [],
      scene: {
        nodes: sceneTree,
        externalResources,
        internalResources,
      },
    };
  }

  private identifySection(heading: ReturnType<typeof parseHeading>): SectionType {
    if (!heading) return 'none';

    if (heading.type === 'node') return 'node';
    if (heading.type === 'ext_resource') return 'ext_resource';
    if (heading.type === 'sub_resource') return 'sub_resource';

    return 'none';
  }
}
