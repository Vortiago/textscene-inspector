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
import { parseHeading, parseProperty, isHeading, isComment, isEmpty } from '../parser/utils.js';
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
    type: heading.attributes.type || '',
    properties,
    children: [], // Will be populated by buildSceneTree
  };

  // Only set parent if it exists (optional property)
  if (heading.attributes.parent) {
    node.parent = heading.attributes.parent;
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
    const lines = content.split('\n');
    const errors: ParseError[] = [];

    const nodes: TscnNode[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ReturnType<typeof parseHeading> = null;
    let currentProperties: Record<string, string> = {};
    let currentLineNumber = 0;
    let currentNodeType: string | undefined;

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
          if (!currentHeading.attributes.type) {
            errors.push({
              severity: 'error',
              message: 'Node heading must have "type=" attribute',
              line: currentLineNumber,
              column: 1,
              code: 'MISSING_NODE_TYPE',
            });
          } else {
            // Only set currentNodeType if type attribute exists
            currentNodeType = currentHeading.attributes.type;
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

        // Validate property value using registry
        if (currentSection === 'node' && currentNodeType) {
          const validator = validatorRegistry.findValidator(currentNodeType, property.key);
          if (validator) {
            const error = validator(property.key, property.value, currentLineNumber);
            if (error) {
              errors.push(error);
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
