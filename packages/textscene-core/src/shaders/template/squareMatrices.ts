import type {
  Argument,
  BlockNode,
  ConstantNode,
  Expression,
  FunctionNode,
  OperatorNode,
  Statement,
  StructMember,
} from '../language/shaderTree.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { swizzled } from '../language/swizzle.js';
import { withSubExpressions } from '../language/treeWalk.js';
import { constructorRow, operatorRow } from './glslRows.js';
import { glslShapeOf, shapeName, type GlslShape } from './glslTypes.js';
import type { TemplateDeclaration, TemplateStageNode } from './templateTree.js';

const LANES = 'xyzw';

/** TSL has no `mat3x4`: a zero-padded square keeps its zeros through each product, sum and transpose. */
export function withSquareMatrices(stage: TemplateStageNode): TemplateStageNode {
  return { ...stage, declarations: stage.declarations.map(squareDeclaration) };
}

/** The square type a non-square matrix type is held as, or `type` itself. */
function squareType(type: string): string {
  const shape = nonSquareShape(type);
  if (!shape) return type;
  const size = Math.max(shape.columns, shape.rows);
  return shapeName({ ...shape, columns: size, rows: size });
}

function nonSquareShape(type: string): GlslShape | undefined {
  const shape = glslShapeOf(type);
  return shape && shape.columns > 1 && shape.columns !== shape.rows ? shape : undefined;
}

function squareDeclaration(declaration: TemplateDeclaration): TemplateDeclaration {
  switch (declaration.kind) {
    case 'struct':
      return { ...declaration, members: declaration.members.map(squareMember) };
    case 'interface block':
      return {
        ...declaration,
        members: declaration.members.map((member) =>
          member.kind === 'slot' ? member : squareMember(member)
        ),
      };
    case 'global':
      return { ...declaration, type: squareType(declaration.type) };
    case 'prototype':
      return { ...declaration, function: squareSignature(declaration.function) };
    case 'function':
      return { ...squareSignature(declaration), body: squareBlock(declaration.body) };
    default:
      return declaration;
  }
}

const squareMember = <Member extends StructMember>(member: Member): Member => ({
  ...member,
  type: squareType(member.type),
});

function squareSignature<Signature extends Omit<FunctionNode, 'body' | 'kind'>>(
  signature: Signature
): Signature {
  return {
    ...signature,
    returnType: squareType(signature.returnType),
    arguments: signature.arguments.map((argument: Argument) => squareMember(argument)),
  };
}

function squareBlock(block: BlockNode): BlockNode {
  return { ...block, statements: block.statements.map(squareStatement) };
}

function squareStatement(statement: Statement): Statement {
  switch (statement.kind) {
    case 'block':
      return squareBlock(statement);
    case 'control flow':
      return {
        ...statement,
        expressions: statement.expressions.map(squareExpression),
        blocks: statement.blocks.map(squareBlock),
      };
    case 'declaration':
      return {
        ...statement,
        type: squareType(statement.type),
        declarators: statement.declarators.map((declarator) =>
          declarator.value ? { ...declarator, value: squareExpression(declarator.value) } : declarator
        ),
      };
    case 'slot':
      return statement;
    default:
      return squareExpression(statement);
  }
}

/** The parts are squared first, and the original's types say where the lanes go. */
function squareExpression(expression: Expression): Expression {
  const parts = withSubExpressions(expression, squareExpression);
  if (parts.kind !== 'operator') return { ...parts, type: squareType(parts.type) } as Expression;
  const original = expression as OperatorNode;
  if (original.op === 'OP_INDEX') return squareIndex(original, parts as OperatorNode);
  if (original.op === 'OP_MUL') return squareProduct(original, parts as OperatorNode);
  if (original.op === 'OP_CONSTRUCT') return squareConstruction(original, parts as OperatorNode);
  // GLSL's built-ins of the template take no non-square matrix, so a call is a function of the template.
  if (original.op === 'OP_CALL') return { ...parts, type: squareType(parts.type) };
  return squareOperator(original, parts as OperatorNode);
}

/** A column of a matrix of fewer rows than columns has zero lanes after its rows. */
function squareIndex(original: OperatorNode, parts: OperatorNode): Expression {
  const shape = nonSquareShape(original.operands[0]!.type);
  if (!shape || shape.rows >= shape.columns) return { ...parts, type: original.type };
  return lanesOf({ ...parts, type: `vec${shape.columns}` }, shape.rows);
}

/** `matrix * vector` reads as many lanes as the matrix has columns, `vector * matrix` as it has rows. */
function squareProduct(original: OperatorNode, parts: OperatorNode): Expression {
  const [left, right] = original.operands as [Expression, Expression];
  const leftShape = nonSquareShape(left.type);
  const rightShape = nonSquareShape(right.type);
  if (leftShape && isVector(right.type))
    return squareVectorProduct(parts, 1, Math.max(leftShape.columns, leftShape.rows), leftShape.rows);
  if (rightShape && isVector(left.type))
    return squareVectorProduct(parts, 0, Math.max(rightShape.columns, rightShape.rows), rightShape.columns);
  return squareOperator(original, parts);
}

/** The product with its vector operand padded to `size` lanes, read back as `lanes` lanes. */
function squareVectorProduct(parts: OperatorNode, vector: number, size: number, lanes: number): Expression {
  const operands = parts.operands.map((operand, index) =>
    index === vector ? padded(operand, size) : operand
  );
  const square = `vec${size}`;
  const types = operands.map((operand) => operand.type);
  const product: OperatorNode = {
    ...parts,
    operands,
    type: square,
    row: operatorRow('OP_MUL', types, square),
  };
  return lanesOf(product, lanes);
}

/** A non-square matrix of columns: each column padded to the square's rows, then zero columns. */
function squareConstruction(original: OperatorNode, parts: OperatorNode): Expression {
  const shape = nonSquareShape(original.type);
  if (!shape) return squareOperator(original, parts);
  const size = Math.max(shape.columns, shape.rows);
  const columnType = `vec${shape.rows}`;
  const isOfColumns =
    original.operands.length === shape.columns &&
    original.operands.every((operand) => operand.type === columnType);
  if (!isOfColumns)
    throw new ShadingLanguageError(
      `expected a ${original.type} of ${shape.columns} ${columnType} columns, got ${original.type}(${original.operands
        .map((operand) => operand.type)
        .join(',')})`,
      original.position
    );
  const zeroColumn = vectorOf(size, [zero(original)]);
  const columns = [
    ...parts.operands.map((column) => padded(column, size)),
    ...Array.from({ length: size - shape.columns }, () => zeroColumn),
  ];
  const type = squareType(original.type);
  return {
    ...parts,
    type,
    operands: columns,
    row: constructorRow(
      type,
      columns.map((column) => column.type)
    ),
  };
}

/** An operator whose row names a non-square type gets the row of the square types. */
function squareOperator(original: OperatorNode, parts: OperatorNode): Expression {
  const type = squareType(original.type);
  if (!mentionsNonSquare(original)) return { ...parts, type };
  const types = parts.operands.map((operand) => operand.type);
  const row =
    original.op === 'OP_CONSTRUCT' ? constructorRow(type, types) : operatorRow(original.op, types, type);
  return { ...parts, type, row };
}

const mentionsNonSquare = (node: OperatorNode) =>
  [node.type, ...node.operands.map((operand) => operand.type)].some((type) => nonSquareShape(type));

const isVector = (type: string) => {
  const shape = glslShapeOf(type);
  return shape !== undefined && shape.columns === 1 && shape.rows > 1;
};

/** `vector` with zero lanes after its own, up to `size`. */
function padded(vector: Expression, size: number): Expression {
  const lanes = glslShapeOf(vector.type)!.rows;
  if (lanes >= size) return vector;
  return vectorOf(size, [vector, ...Array.from({ length: size - lanes }, () => zero(vector))]);
}

function vectorOf(size: number, operands: readonly Expression[]): Expression {
  const type = `vec${size}`;
  const row = constructorRow(
    type,
    operands.map((operand) => operand.type)
  );
  return { kind: 'operator', type, op: 'OP_CONSTRUCT', row, operands, position: operands[0]!.position };
}

const zero = (at: Expression): ConstantNode => ({
  kind: 'constant',
  type: 'float',
  values: [0],
  position: at.position,
});

/** The first `lanes` lanes of `vector`, or `vector` itself when it has no more. */
function lanesOf(vector: Expression, lanes: number): Expression {
  if (glslShapeOf(vector.type)!.rows <= lanes) return vector;
  const swizzle = swizzled(vector, LANES.slice(0, lanes));
  if (typeof swizzle === 'string') throw new Error(`expected a swizzle of ${vector.type}, got: ${swizzle}`);
  return swizzle;
}
