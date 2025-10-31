/**
 * Core TSCN parsing logic - shared between renderer and linter
 *
 * This module contains the shared parsing loop logic without any three.js dependencies.
 * It accepts a node creator callback to allow different implementations for rendering vs. linting.
 */

import type { TscnScene, TscnNode, TscnExternalResource, TscnInternalResource } from './types.js';
import { parseHeading, parseProperty, isHeading, isComment, isEmpty } from './utils.js';
import type { ParsedHeading } from './utils.js';
import { parseExternalResource, parseInternalResource } from './resourceParsers.js';
import { buildSceneTree } from './sceneTreeBuilder.js';
import * as logger from '../logger.js';

type SectionType = 'none' | 'node' | 'ext_resource' | 'sub_resource';

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
 * Core TSCN parser without three.js dependencies
 * Extracts the shared parsing loop used by both TscnParser (renderer) and StrictTscnParser (linter)
 */
export class TscnParserCore {
  /**
   * Parse TSCN content using a custom node creator
   * @param content - Raw TSCN file content
   * @param nodeCreator - Callback to create nodes (renderer-specific or linter-specific)
   * @returns Parsed scene structure
   */
  parse(content: string, nodeCreator: NodeCreator): TscnScene {
    logger.info('Starting TSCN parsing');
    const lines = content.split('\n');

    const nodes: TscnNode[] = [];
    const externalResources: TscnExternalResource[] = [];
    const internalResources: TscnInternalResource[] = [];

    let currentSection: SectionType = 'none';
    let currentHeading: ParsedHeading | null = null;
    let currentProperties: Record<string, string> = {};

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

    for (const line of lines) {
      if (isEmpty(line) || isComment(line)) {
        continue;
      }

      if (isHeading(line)) {
        finalizeSection();

        currentHeading = parseHeading(line);
        if (currentHeading) {
          currentSection = this.identifySection(currentHeading);
        }
      } else {
        const property = parseProperty(line);
        if (property && currentHeading) {
          currentProperties[property.key] = property.value;
        }
      }
    }

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
