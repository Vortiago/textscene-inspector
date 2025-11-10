/**
 * WorldEnvironment parser tests
 */

import { describe, it, expect } from 'vitest';
import { isWorldEnvironment, parseWorldEnvironment } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

describe('WorldEnvironment Parser', () => {
  describe('isWorldEnvironment', () => {
    it('should identify WorldEnvironment nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
        },
      };
      expect(isWorldEnvironment(heading)).toBe(true);
    });

    it('should reject non-WorldEnvironment nodes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Root',
          type: 'Node3D',
        },
      };
      expect(isWorldEnvironment(heading)).toBe(false);
    });

    it('should reject other node types', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };
      expect(isWorldEnvironment(heading)).toBe(false);
    });
  });

  describe('parseWorldEnvironment', () => {
    it('should parse basic WorldEnvironment with environment reference', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
        },
      };

      const props = parseWorldEnvironment(heading, {
        environment: 'SubResource("Environment_1")',
      });

      expect(props.name).toBe('WorldEnvironment');
      expect(props.environment).toBe('SubResource("Environment_1")');
      expect(props.camera_attributes).toBeUndefined();
    });

    it('should parse WorldEnvironment with camera_attributes', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
        },
      };

      const props = parseWorldEnvironment(heading, {
        environment: 'SubResource("Environment_1")',
        camera_attributes: 'SubResource("CameraAttributes_1")',
      });

      expect(props.environment).toBe('SubResource("Environment_1")');
      expect(props.camera_attributes).toBe('SubResource("CameraAttributes_1")');
    });

    it('should handle missing environment reference with empty string', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
        },
      };

      const props = parseWorldEnvironment(heading, {});

      expect(props.environment).toBe('');
      expect(props.camera_attributes).toBeUndefined();
    });

    it('should extract environment reference correctly', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'WorldEnvironment',
          type: 'WorldEnvironment',
        },
      };

      const props = parseWorldEnvironment(heading, {
        environment: 'SubResource("Environment_12345")',
      });

      expect(props.environment).toBe('SubResource("Environment_12345")');
    });

    it('should inherit Node3D properties', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'MyEnvironment',
          type: 'WorldEnvironment',
          parent: 'Root',
        },
      };

      const props = parseWorldEnvironment(heading, {
        environment: 'SubResource("Environment_1")',
        transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
      });

      expect(props.name).toBe('MyEnvironment');
      expect(props.parent).toBe('Root');
      expect(props.transform).toBeDefined();
      expect(props.environment).toBe('SubResource("Environment_1")');
    });
  });
});
