/**
 * The test cases every generated slice starts from: one happy, one error and
 * one edge case per base, plus the lenient-parser round trip.
 */

export const NODE3D_PARSER_TEST_CASES = (typeName) => `  it('parses name, parent, and transform (happy path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'My${typeName}', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('My${typeName}');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'Bad' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parse${typeName}({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });`;

export const CONTROL_PARSER_TEST_CASES = (typeName) => `  it('parses name, parent, and the anchor/offset layout (happy path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'My${typeName}', parent: '.' }),
      { anchor_right: '1.0', offset_left: '8', offset_right: '-8' }
    );
    expect(result.name).toBe('My${typeName}');
    expect(result.parent).toBe('.');
    expect(result.anchorRight).toBe(1);
    expect(result.offsetLeft).toBe(8);
  });

  it('leaves a malformed offset undefined rather than guessing (error path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'Bad' }),
      { offset_left: 'not-a-number' }
    );
    expect(result.offsetLeft).toBeUndefined();
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parse${typeName}({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.anchorRight).toBeUndefined();
  });`;

export const NODE2D_PARSER_TEST_CASES = (typeName) => `  it('parses name, parent, and the 2D transform (happy path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'My${typeName}', parent: '.' }),
      { position: 'Vector2(10, 20)', rotation: '0.5' }
    );
    expect(result.name).toBe('My${typeName}');
    expect(result.parent).toBe('.');
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.rotation).toBeCloseTo(0.5, 5);
  });

  it('falls back to the identity transform on a malformed transform (error path)', () => {
    const result = parse${typeName}(
      heading('${typeName}', { name: 'Bad' }),
      { transform: 'Transform2D(not, valid)' }
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.scale).toEqual({ x: 1, y: 1 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parse${typeName}({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.position).toEqual({ x: 0, y: 0 });
  });`;
