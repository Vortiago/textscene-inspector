/**
 * The random programs that declare functions of their own: `in`, `const in`, `out` and `inout`
 * parameters, struct and array arguments and results, `void` functions, early returns in a
 * branch and in a loop, and chains of calls with no recursion. The expressions come from the
 * expression generator, so they hold every transpiled row it writes.
 */

import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { expressionText, rowsOf } from './programTree.mjs';
import { PRODUCERS, ProgramWriter, componentType, vectorType } from './programs.mjs';
import { seededRandom } from './seededRandom.mjs';

/** The functions a program declares before `probe`: enough for a chain of three calls. */
const HELPERS_AT_MOST = 3;

const PARAMETERS_AT_MOST = 3;

/** The calls `probe` makes, beside the calls each function makes of an earlier one. */
const PROBE_CALLS_AT_MOST = 3;

/** The depth of each expression: shallow, so a program of several functions stays readable. */
const EXPRESSION_DEPTH = 2;

/** The chances of the parts of a program, each high enough that 100 programs hold it often. */
const STRUCT_CHANCE = 0.5;
const STRUCT_SHAPE_CHANCE = 0.2;
const ARRAY_SHAPE_CHANCE = 0.15;
const ARRAY_SIZES = [2, 3];
const VOID_CHANCE = 0.3;
const EARLY_WRITE_CHANCE = 0.5;
const EARLY_RETURN_CHANCE = 0.6;
const LOOP_CHANCE = 0.5;
const INNER_CALL_CHANCE = 0.6;
const INDEXED_PLACE_CHANCE = 0.5;

/** The chances of each qualifier, `const in` among them, which Godot reads as `in`. */
const QUALIFIERS = ['in', 'in', 'const in', 'out', 'out', 'inout', 'inout'];

/** The chance that an `out` or `inout` argument is a part of a variable rather than all of it. */
const PART_PLACE_CHANCE = 0.5;

/**
 * The size of an array whose element a call writes. Its index variable starts at 0 or 1, so the
 * index stays inside the array whatever the call writes to the variable.
 */
const INDEXED_ARRAY_SIZE = 2;

/**
 * The chance that a function writes an `int` before another value, so that a caller may index
 * the second argument's array with the first argument's variable.
 */
const INDEX_BEFORE_A_PLACE_CHANCE = 0.25;

/** The chance that `probe` returns the type of a value a call wrote, so the return reads it. */
const RETURN_AN_OUTPUT_CHANCE = 0.7;

/** The rows a program uses for the frame of its functions, beside the rows of its expressions. */
const FRAME_ROWS = { call: 'OP_CALL', void: 'void', if: 'if', for: 'for', return: 'return' };
const CALL_ROW = INSTRUCTION_TABLE.find((row) => row.id === FRAME_ROWS.call);

const LETTERS = 'xyzw';

/** The scalar or vector types an array element or a struct member takes. */
const isScalarOrVector = (type) => !type.startsWith('mat');

const valueShape = (type) => ({ kind: 'value', type });

/** The text of a shape as a type: `vec2`, `S0` or `float[3]`. */
function typeText(shape) {
  if (shape.kind === 'array') return `${shape.element}[${shape.size}]`;
  return shape.kind === 'struct' ? shape.name : shape.type;
}

/** The declaration of `name` of `shape`: an array takes its size after the name. */
function declaration(shape, name) {
  if (shape.kind === 'array') return `${shape.element} ${name}[${shape.size}]`;
  return `${typeText(shape)} ${name}`;
}

/** The value places of a variable of `shape`: itself, each member or each element. */
function placesOf(shape, name) {
  if (shape.kind === 'struct')
    return shape.members.map((type, index) => ({ type, name: `${name}.m${index}` }));
  if (shape.kind === 'array') {
    return Array.from({ length: shape.size }, (_, index) => ({
      type: shape.element,
      name: `${name}[${index}]`,
    }));
  }
  return [{ type: shape.type, name }];
}

const isWritten = (qualifier) => qualifier === 'out' || qualifier === 'inout';

/**
 * The variables in reach in one function, and the functions it may call. A value an argument
 * wrote is in `names` twice, so an expression reads it more often than an input.
 */
class Scope {
  constructor(writer, rows) {
    this.writer = writer;
    this.rows = rows;
    this.places = [];
    this.localCount = 0;
  }

  add(places, weight = 1) {
    for (let copy = 0; copy < weight; copy += 1) this.places.push(...places);
  }

  without(places) {
    this.places = this.places.filter((place) => !places.includes(place));
  }

  local() {
    const name = `l${this.localCount}`;
    this.localCount += 1;
    return name;
  }

  /** The text of a random expression of value type `type` over the places in reach. */
  expression(type) {
    const { writer } = this;
    writer.parameters = this.places.map((place) => place.type);
    writer.names = this.places.map((place) => place.name);
    const tree = writer.answerableTree(() => writer.expression(type, EXPRESSION_DEPTH));
    for (const id of rowsOf(tree)) this.rows.add(id);
    return expressionText(tree);
  }

  /** The text of a random value of `shape`: an expression, or a struct or array constructor. */
  value(shape) {
    if (shape.kind === 'value') return this.expression(shape.type);
    const parts = placesOf(shape, '').map((place) => this.expression(place.type));
    return `${typeText(shape)}(${parts.join(', ')})`;
  }
}

/** A fresh writer of programs with functions of their own, all drawn from `random`. */
class FunctionProgramWriter {
  constructor(random) {
    this.random = random;
    this.expressions = new ProgramWriter(random);
    this.types = this.expressions.readableTypes();
  }

  program(name) {
    this.rows = new Set();
    this.struct = this.random.chance(STRUCT_CHANCE) ? this.structShape() : undefined;
    this.helpers = [];
    this.producers = new Map(PRODUCERS);
    const helperCount = 1 + this.random.below(HELPERS_AT_MOST);
    const helperTexts = Array.from({ length: helperCount }, (_, index) => this.helper(`h${index}`));
    const parameters = Array.from({ length: 1 + this.random.below(PARAMETERS_AT_MOST) }, () =>
      this.random.pick(this.types)
    );
    const { returns, text } = this.probe(parameters);
    const structText = this.struct
      ? [`struct S0 { ${this.struct.members.map((type, index) => `${type} m${index};`).join(' ')} };`]
      : [];
    return {
      name,
      rows: [...this.rows],
      source: [...structText, ...helperTexts, text].join('\n'),
      inputs: this.expressions.inputs(parameters),
      returns,
      parameters,
      functions: helperCount,
    };
  }

  structShape() {
    const members = Array.from({ length: 2 + this.random.below(2) }, () => this.random.pick(this.parts()));
    return { kind: 'struct', name: 'S0', members };
  }

  /** The types a member or an element takes. */
  parts() {
    return this.types.filter(isScalarOrVector);
  }

  /** A random shape for a parameter or a result: a value, the struct or an array. */
  shape() {
    const roll = this.random.next();
    if (this.struct && roll < STRUCT_SHAPE_CHANCE) return this.struct;
    if (roll < STRUCT_SHAPE_CHANCE + ARRAY_SHAPE_CHANCE) {
      return { kind: 'array', element: this.random.pick(this.parts()), size: this.random.pick(ARRAY_SIZES) };
    }
    return valueShape(this.random.pick(this.types));
  }

  /** A scope over the producers and the functions declared so far. */
  scope() {
    const writer = new ProgramWriter(this.random, this.producers);
    return new Scope(writer, this.rows);
  }

  /**
   * The text of function `name`, which it adds to the functions later ones may call. Its
   * parameters are `b0` and on: the harness names its uniforms `p0` and on.
   */
  helper(name) {
    const parameters = Array.from({ length: 1 + this.random.below(PARAMETERS_AT_MOST) }, (_, index) => ({
      qualifier: this.random.pick(QUALIFIERS),
      shape: this.shape(),
      name: `b${index}`,
    }));
    if (parameters.length > 1 && this.random.chance(INDEX_BEFORE_A_PLACE_CHANCE)) {
      parameters[0] = { ...parameters[0], qualifier: 'out', shape: valueShape('int') };
      parameters[1] = {
        ...parameters[1],
        qualifier: this.random.pick(['out', 'inout']),
        shape: valueShape(this.random.pick(this.parts())),
      };
    }
    const returns = this.random.chance(VOID_CHANCE) ? undefined : this.shape();
    if (returns === undefined && !parameters.some((parameter) => isWritten(parameter.qualifier))) {
      parameters[0].qualifier = 'out';
    }
    const scope = this.scope();
    for (const parameter of parameters) {
      this.rows.add(parameter.qualifier.replace('const ', ''));
      if (parameter.qualifier !== 'out') scope.add(placesOf(parameter.shape, parameter.name));
    }
    const lines = this.helperBody(scope, parameters, returns);
    const signature = parameters
      .map((parameter) => `${parameter.qualifier} ${declaration(parameter.shape, parameter.name)}`)
      .join(', ');
    this.declare(name, parameters, returns);
    if (returns === undefined) this.rows.add(FRAME_ROWS.void);
    const returnType = returns === undefined ? 'void' : typeText(returns);
    return `${returnType} ${name}(${signature}) { ${lines.join(' ')} }`;
  }

  /**
   * The statements of a function. Each `out` parameter is written first, so an early return
   * leaves none unwritten, which GLSL would leave undefined. A write after the early return
   * makes the early return change what the caller reads.
   */
  helperBody(scope, parameters, returns) {
    const lines = [];
    for (const parameter of parameters.filter((each) => each.qualifier === 'out')) {
      lines.push(`${parameter.name} = ${scope.value(parameter.shape)};`);
      scope.add(placesOf(parameter.shape, parameter.name));
    }
    if (this.helpers.length > 0 && this.random.chance(INNER_CALL_CHANCE)) {
      lines.push(...this.callStatement(scope, this.random.pick(this.helpers)));
    }
    const writable = parameters
      .filter((parameter) => isWritten(parameter.qualifier))
      .flatMap((parameter) => placesOf(parameter.shape, parameter.name));
    for (const place of writable.filter(() => this.random.chance(EARLY_WRITE_CHANCE))) {
      lines.push(this.write(scope, place));
    }
    if (this.random.chance(EARLY_RETURN_CHANCE)) lines.push(this.earlyReturn(scope, returns, writable));
    if (writable.length > 0) lines.push(this.write(scope, this.random.pick(writable)));
    if (returns !== undefined) {
      this.rows.add(FRAME_ROWS.return);
      lines.push(`return ${scope.value(returns)};`);
    }
    return lines;
  }

  /** A return inside a branch, or inside a branch in a loop whose counter the return may read. */
  earlyReturn(scope, returns, writable) {
    this.rows.add(FRAME_ROWS.if);
    this.rows.add(FRAME_ROWS.return);
    const returnText = () => (returns === undefined ? 'return;' : `return ${scope.value(returns)};`);
    if (!this.random.chance(LOOP_CHANCE)) return `if (${scope.expression('bool')}) ${returnText()}`;
    this.rows.add(FRAME_ROWS.for);
    const counter = { type: 'int', name: 'i' };
    scope.add([counter]);
    const branch = `if (${scope.expression('bool')}) ${returnText()}`;
    const step = writable.length > 0 ? this.write(scope, this.random.pick(writable)) : '';
    scope.without([counter]);
    return `for (int i = 0; i < ${2 + this.random.below(3)}; i++) { ${branch} ${step} }`;
  }

  write(scope, place) {
    return `${place.name} = ${scope.expression(place.type)};`;
  }

  /**
   * Adds function `name` to those a later one may call. A function of `in` values that returns
   * a value is also a producer, so an expression may call it inside another.
   */
  declare(name, parameters, returns) {
    this.helpers.push({ name, parameters, returns });
    const takesValues = parameters.every(
      (parameter) => !isWritten(parameter.qualifier) && parameter.shape.kind === 'value'
    );
    if (!takesValues || returns?.kind !== 'value') return;
    const args = parameters.map((parameter) => parameter.shape.type);
    const producer = { row: CALL_ROW, kind: 'call', name, args, inputs: args };
    this.producers.set(returns.type, [...(this.producers.get(returns.type) ?? []), producer]);
  }

  /**
   * The statements that call `helper` and declare the variables its `out` and `inout` arguments
   * write. Each written value is in reach after the call, twice over.
   */
  callStatement(scope, helper) {
    this.rows.add(FRAME_ROWS.call);
    const lines = [];
    const written = [];
    const indices = [];
    const args = helper.parameters.map((parameter) => {
      if (!isWritten(parameter.qualifier)) return scope.value(parameter.shape);
      const place = this.place(scope, parameter, indices);
      lines.push(...place.lines);
      written.push(...place.places);
      return place.argument;
    });
    const call = `${helper.name}(${args.join(', ')})`;
    if (helper.returns === undefined) {
      lines.push(`${call};`);
    } else {
      const result = scope.local();
      lines.push(`${declaration(helper.returns, result)} = ${call};`);
      written.push(...placesOf(helper.returns, result));
    }
    scope.add(written, 2);
    return lines;
  }

  /**
   * A place for a written argument: a new variable, or a member, element or swizzle of one. An
   * `int` variable may index a later argument's array element, which GLSL reads at the call.
   */
  place(scope, parameter, indices) {
    const { shape, qualifier } = parameter;
    const name = scope.local();
    const whole = (initial) => ({
      lines: [
        initial === undefined ? `${declaration(shape, name)};` : `${declaration(shape, name)} = ${initial};`,
      ],
      places: placesOf(shape, name),
      argument: name,
    });
    if (shape.kind !== 'value' || !isScalarOrVector(shape.type))
      return whole(qualifier === 'inout' ? scope.value(shape) : undefined);
    if (indices.length > 0 && this.random.chance(INDEXED_PLACE_CHANCE))
      return this.element(scope, shape.type, name, this.random.pick(indices));
    if (shape.type === 'int' && qualifier === 'out') {
      indices.push(name);
      return whole(String(this.random.below(INDEXED_ARRAY_SIZE)));
    }
    if (!this.random.chance(PART_PLACE_CHANCE))
      return whole(qualifier === 'inout' ? scope.value(shape) : undefined);
    return this.partPlace(scope, shape.type, name);
  }

  /** A member, element or swizzle of a new variable, as the place of a scalar or vector argument. */
  partPlace(scope, type, name) {
    const component = componentType(type);
    const size = component === type ? 1 : Number(type.at(-1));
    const choices = ['element'];
    if (size < 4) choices.push('swizzle');
    if (this.struct?.members.includes(type)) choices.push('member');
    const choice = this.random.pick(choices);
    if (choice === 'member') {
      const member = this.struct.members.indexOf(type);
      return {
        lines: [`S0 ${name} = ${scope.value(this.struct)};`],
        places: placesOf(this.struct, name),
        argument: `${name}.m${member}`,
      };
    }
    if (choice === 'swizzle') {
      const wide = size + 1 + this.random.below(4 - size);
      const wideType = vectorType(component, wide);
      const letters = [...LETTERS.slice(0, wide)];
      const picked = Array.from(
        { length: size },
        () => letters.splice(this.random.below(letters.length), 1)[0]
      );
      return {
        lines: [`${wideType} ${name} = ${scope.expression(wideType)};`],
        places: [{ type: wideType, name }],
        argument: `${name}.${picked.join('')}`,
      };
    }
    return this.element(scope, type, name, String(this.random.below(INDEXED_ARRAY_SIZE)));
  }

  /** An element of a new array of `type`, at the literal or variable `index`. */
  element(scope, type, name, index) {
    const array = { kind: 'array', element: type, size: INDEXED_ARRAY_SIZE };
    return {
      lines: [`${declaration(array, name)} = ${scope.value(array)};`],
      places: placesOf(array, name),
      argument: `${name}[${index}]`,
    };
  }

  /** The text of `probe`, which calls the last function first so that each function is reached. */
  probe(parameters) {
    const scope = this.scope();
    scope.add(parameters.map((type, index) => ({ type, name: `a${index}` })));
    const calls = [this.helpers.at(-1)];
    const callCount = this.random.below(PROBE_CALLS_AT_MOST);
    for (let index = 0; index < callCount; index += 1) calls.push(this.random.pick(this.helpers));
    const before = scope.places.length;
    const lines = calls.flatMap((helper) => this.callStatement(scope, helper));
    const outputs = scope.places.slice(before).filter((place) => this.types.includes(place.type));
    const returns =
      outputs.length > 0 && this.random.chance(RETURN_AN_OUTPUT_CHANCE)
        ? this.random.pick(outputs).type
        : this.random.pick(this.types);
    const list = parameters.map((type, index) => `${type} a${index}`).join(', ');
    return {
      returns,
      text: `${returns} probe(${list}) { ${lines.join(' ')} return ${scope.expression(returns)}; }`,
    };
  }
}

/**
 * The `count` programs with functions of `seed`, named apart from the expression programs. Their
 * own random stream keeps the expression programs of the seed as they were.
 */
export function generateFunctionPrograms({ seed, count }) {
  const writer = new FunctionProgramWriter(seededRandom(~seed));
  return Array.from({ length: count }, (_, index) => writer.program(`random-${seed}-function-${index}`));
}
