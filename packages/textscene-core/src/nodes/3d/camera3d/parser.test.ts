/**
 * Camera3D parser tests
 */

import { describe, it, expect } from 'vitest';
import { parseCamera3D } from './parser';
import { ProjectionMode, KeepAspectMode } from './types';
import type { ParsedHeading } from '../../../parser/utils';

describe('Camera3D Parser', () => {
  describe('parseCamera3D', () => {
    it('should parse perspective camera with defaults', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {});

      expect(props.projection).toBe(ProjectionMode.PROJECTION_PERSPECTIVE);
      expect(props.fov).toBe(75.0);
      expect(props.near).toBe(0.05);
      expect(props.far).toBe(4000.0);
      expect(props.keep_aspect).toBe(KeepAspectMode.KEEP_HEIGHT);
      expect(props.current).toBe(false);
    });

    it('should parse perspective camera with custom values', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        projection: '0',
        fov: '60.0',
        near: '0.1',
        far: '1000.0',
        keep_aspect: '1',
        current: 'true',
      });

      expect(props.projection).toBe(ProjectionMode.PROJECTION_PERSPECTIVE);
      expect(props.fov).toBe(60.0);
      expect(props.near).toBe(0.1);
      expect(props.far).toBe(1000.0);
      expect(props.keep_aspect).toBe(KeepAspectMode.KEEP_HEIGHT);
      expect(props.current).toBe(true);
    });

    it('should parse orthographic camera', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'OrthoCamera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        projection: '1',
        size: '10.0',
        near: '0.1',
        far: '100.0',
        keep_aspect: '0',
      });

      expect(props.projection).toBe(ProjectionMode.PROJECTION_ORTHOGONAL);
      expect(props.size).toBe(10.0);
      expect(props.near).toBe(0.1);
      expect(props.far).toBe(100.0);
      expect(props.keep_aspect).toBe(KeepAspectMode.KEEP_WIDTH);
    });

    it('should parse frustum offset', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        frustum_offset: 'Vector2(1.5, -2.0)',
      });

      expect(props.frustum_offset.x).toBe(1.5);
      expect(props.frustum_offset.y).toBe(-2.0);
    });

    it('should parse frustum offset with scientific notation', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        frustum_offset: 'Vector2(1.5e-3, -2.0E+2)',
      });

      expect(props.frustum_offset.x).toBe(0.0015);
      expect(props.frustum_offset.y).toBe(-200.0);
    });

    it('should parse h_offset and v_offset', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        h_offset: '5.0',
        v_offset: '-3.0',
      });

      expect(props.h_offset).toBe(5.0);
      expect(props.v_offset).toBe(-3.0);
    });

    it('should parse cull_mask and doppler_tracking', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        cull_mask: '1023',
        doppler_tracking: '2',
      });

      expect(props.cull_mask).toBe(1023);
      expect(props.doppler_tracking).toBe(2);
    });

    it('should parse PROJECTION_FRUSTUM mode', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        projection: '2',
      });

      expect(props.projection).toBe(ProjectionMode.PROJECTION_FRUSTUM);
    });

    it('should parse KEEP_ASPECT_DISABLED mode', () => {
      const heading: ParsedHeading = {
        type: 'node',
        attributes: {
          name: 'Camera',
          type: 'Camera3D',
        },
      };

      const props = parseCamera3D(heading, {
        keep_aspect: '2',
      });

      expect(props.keep_aspect).toBe(KeepAspectMode.KEEP_ASPECT_DISABLED);
    });
  });
});
