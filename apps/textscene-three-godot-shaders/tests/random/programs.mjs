/**
 * The random program generator: functions that are correct by type, built from the signatures
 * of the instruction table's transpiled rows, so the set grows with each slice and needs no list
 * of its own. A seed fixes the programs. A program is a probe: `pnpm godot:probes` records
 * Godot's answers to it, and the real-GL test compares the transpiler's bits with them.
 */

import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { LANE_COUNT } from '../../../../scripts/godot-probes/probeShader.mjs';
import { WRITES_OPERAND, operatorOf } from '../operators/operatorText.mjs';
import { FLOAT_VALUES } from '../probes/inputs.mjs';
import { isAnswerable } from './answerable.mjs';
import { PROBES } from '../probes/probes.mjs';
import { programSource, rowsOf } from './programTree.mjs';
import { seededRandom } from './seededRandom.mjs';

/** The rows a probe names, each once: the transpiled rows, as the coverage test counts them. */
const PROBED_IDS = new Set(PROBES.flatMap((probe) => probe.rows));
export const TRANSPILED_ROWS = INSTRUCTION_TABLE.filter((row) => PROBED_IDS.has(row.id));

/** The types the probe harness passes in and reads out. */
const HARNESS_TYPES = Object.keys(LANE_COUNT);

/** The deepest a tree grows below its root, which keeps a program short enough to read. */
const DEPTH_AT_MOST = 4;

/** The chance that a node with depth left ends in a leaf, which mixes short and long branches. */
const LEAF_CHANCE = 0.3;

/** The chance of brackets that no priority needs: Godot and the transpiler must ignore them. */
const SPARE_BRACKET_CHANCE = 0.15;

/** The input rows of a program: enough to vary each lane, few enough to keep the record small. */
const INPUT_ROWS = 12;

/** The draws of a tree before the generator gives up: most trees Godot answers, so a few suffice. */
const ATTEMPTS_AT_MOST = 100;

/** The chance that an input lane is one of the probes' edge values: zeros, a subnormal, NaN. */
const EDGE_VALUE_CHANCE = 0.2;

/** The scalar type of a vector's lanes, read from its name as Godot names them. */
export function componentType(type) {
  const prefix = /^([biu]?)vec\d$/.exec(type)?.[1];
  if (prefix === undefined) return type;
  return { '': 'float', b: 'bool', i: 'int', u: 'uint' }[prefix];
}

/** The type of `size` lanes of `component`: the scalar for one lane. */
export function vectorType(component, size) {
  if (size === 1) return component;
  const prefix = { float: '', bool: 'b', int: 'i', uint: 'u' }[component];
  return `${prefix}vec${size}`;
}

/** The literal row of each type, and the text of a random literal of it. */
const LITERALS = {
  'float literal': { type: 'float', text: floatLiteralText },
  'int literal': { type: 'int', text: (random) => String(random.below(100)) },
  'uint literal': { type: 'uint', text: (random) => `${random.below(100)}u` },
  true: { type: 'bool', text: () => 'true' },
  false: { type: 'bool', text: () => 'false' },
};

/** A float literal in one of the forms Godot's tokenizer reads: `2.5`, `.5`, `3.0f`, `1e-2`. */
function floatLiteralText(random) {
  const whole = random.below(100);
  const fraction = String(random.below(1000));
  switch (random.below(4)) {
    case 0:
      return `${whole}.${fraction}`;
    case 1:
      return `.${fraction}`;
    case 2:
      return `${whole}.${fraction}f`;
    default:
      return `${whole}.${fraction}e${random.pick(['-', '+', ''])}${random.below(4)}`;
  }
}

/**
 * The producers of each type: one entry per transpiled row that gives it, and per swizzle row
 * and lane count. A swizzle row names a base type and a letter set, and reads one to four lanes.
 */
function producersByType(rows) {
  const producers = new Map();
  const add = (type, producer) => {
    if (!producers.has(type)) producers.set(type, []);
    producers.get(type).push(producer);
  };
  for (const row of rows) {
    if (row.family === 'swizzle') {
      const [base, letters] = row.id.split('.');
      for (let size = 1; size <= 4; size += 1) {
        add(vectorType(componentType(base), size), {
          row,
          kind: 'swizzle',
          base,
          letters,
          size,
          inputs: [base],
        });
      }
    } else if (row.family in PRODUCER_KINDS && row.args?.length) {
      add(row.returns, { row, kind: PRODUCER_KINDS[row.family], args: row.args, inputs: row.args });
    }
  }
  return producers;
}

/** How each family of rows with operands is written. */
const PRODUCER_KINDS = { operator: 'operator', constructor: 'call', function: 'call' };

/** Whether `row` is an operator that writes its first operand, which must be a parameter. */
const writesOperand = (row) => row.family === 'operator' && WRITES_OPERAND.has(operatorOf(row));

export const PRODUCERS = producersByType(TRANSPILED_ROWS);
const PRODUCED_ROWS = new Set([...PRODUCERS.values()].flat().map((producer) => producer.row));

/**
 * The transpiled rows a program can stand on at its root: a literal, a swizzle or a row with
 * operands. A type, a qualifier, a statement or a tree node row is in every program as its frame.
 */
export const ROOT_ROWS = TRANSPILED_ROWS.filter((row) => row.id in LITERALS || PRODUCED_ROWS.has(row));

/**
 * A fresh random program generator over the transpiled rows, and over `producers` when a program
 * declares functions of its own. `parameters` holds the types of the variables in reach, and
 * `names`, when set, their names: a parameter `a<index>` otherwise.
 */
export class ProgramWriter {
  constructor(random, producers = PRODUCERS) {
    this.random = random;
    this.producers = producers;
    /** The literal rows of each type: `true` and `false` both give a `bool`. */
    this.literals = Map.groupBy(
      TRANSPILED_ROWS.filter((row) => row.id in LITERALS),
      (row) => LITERALS[row.id].type
    );
    this.minDepth = this.leastDepths();
  }

  /**
   * The least depth that gives each type with no parameter in reach, by a fixpoint over the
   * producers. A parameter's type is a leaf as well, as each program declares its own.
   */
  leastDepths() {
    const depths = new Map([...this.literals.keys(), ...HARNESS_TYPES].map((type) => [type, 0]));
    for (let changed = true; changed;) {
      changed = false;
      for (const [type, producers] of this.producers) {
        for (const producer of producers) {
          const { inputs } = producer;
          if (!inputs.every((input) => depths.has(input))) continue;
          const depth = 1 + Math.max(...inputs.map((input) => depths.get(input)));
          if (depth < (depths.get(type) ?? Infinity)) {
            depths.set(type, depth);
            changed = true;
          }
        }
      }
    }
    return depths;
  }

  /** A program whose root applies `rootRow`, or a random root when `rootRow` is absent. */
  program(name, rootRow) {
    const returns = rootRow ? this.readableTypeOf(rootRow) : this.random.pick(this.readableTypes());
    const parameters = Array.from({ length: 1 + this.random.below(3) }, () =>
      this.random.pick(this.readableTypes())
    );
    // The first parameter feeds the root: the operand it writes, or the last, so a divisor or a
    // vector can be a parameter that Godot gives values for.
    if (rootRow?.args?.length) parameters[0] = writesOperand(rootRow) ? rootRow.args[0] : rootRow.args.at(-1);
    this.parameters = parameters;
    const tree = this.answerableTree(() =>
      rootRow ? this.rooted(rootRow, returns) : this.expression(returns, DEPTH_AT_MOST)
    );
    const program = { returns, parameters, tree };
    return {
      name,
      rows: rowsOf(tree),
      source: programSource(program),
      inputs: this.inputs(parameters),
      ...program,
    };
  }

  /** A tree from `write` that Godot gives values for, drawn again until one is. */
  answerableTree(write) {
    for (let attempt = 0; attempt < ATTEMPTS_AT_MOST; attempt += 1) {
      const tree = write();
      if (isAnswerable(tree)) return tree;
    }
    throw new Error(`expected a tree Godot gives values for within ${ATTEMPTS_AT_MOST} attempts, found none`);
  }

  /** The harness types the transpiled rows can give. */
  readableTypes() {
    return HARNESS_TYPES.filter((type) => this.minDepth.has(type));
  }

  /** A harness type that `row` gives: its return type, or a lane count of a swizzle row. */
  readableTypeOf(row) {
    if (row.id in LITERALS) return this.readable(LITERALS[row.id].type, row);
    if (row.family !== 'swizzle') return this.readable(row.returns, row);
    const component = componentType(row.id.split('.')[0]);
    return this.readable(vectorType(component, 1 + this.random.below(4)), row);
  }

  readable(type, row) {
    if (HARNESS_TYPES.includes(type)) return type;
    throw new Error(
      `expected row ${row.id} to give a type the probe harness reads (${HARNESS_TYPES.join(', ')}), got ${type}`
    );
  }

  /** An expression of `type` whose root applies `row`. */
  rooted(row, type) {
    if (row.id in LITERALS) return this.literal(type, row);
    const producer = this.producers.get(type)?.find((each) => each.row === row);
    if (!producer) {
      throw new Error(
        `expected row ${row.id} to be a literal, operator, call or swizzle the generator writes, got family ${row.family}`
      );
    }
    return this.applied(producer, DEPTH_AT_MOST);
  }

  /** A random expression of `type` that is at most `depth` deep. */
  expression(type, depth) {
    const leaf = this.leaf(type);
    if (leaf && (depth <= 0 || this.random.chance(LEAF_CHANCE))) return leaf;
    const fitting = (this.producers.get(type) ?? []).filter((producer) => this.fits(producer, depth));
    if (fitting.length === 0) {
      if (leaf) return leaf;
      throw new Error(`expected a transpiled row that gives ${type} within depth ${depth}, found none`);
    }
    const node = this.applied(this.random.pick(fitting), depth);
    return this.random.chance(SPARE_BRACKET_CHANCE) ? { ...node, bracketed: true } : node;
  }

  /**
   * Whether `producer`'s inputs can be built in `depth - 1`, and its operand can be written. A
   * row that writes its operand stands only at the root: Godot writes an assignment or a step
   * without brackets, which the GPU compiler reads another way inside a larger expression.
   */
  fits(producer, depth) {
    if (writesOperand(producer.row)) {
      if (depth < DEPTH_AT_MOST || !this.parameters.includes(producer.args[0])) return false;
    }
    return producer.inputs.every(
      (input) => (this.minDepth.get(input) ?? Infinity) <= depth - 1 || this.leaf(input)
    );
  }

  applied(producer, depth) {
    const { row } = producer;
    if (producer.kind === 'swizzle') {
      const letters = Array.from({ length: producer.size }, () =>
        this.random.pick([...producer.letters])
      ).join('');
      const base = this.expression(producer.base, depth - 1);
      return {
        kind: 'swizzle',
        type: vectorType(componentType(producer.base), producer.size),
        row,
        letters,
        base,
      };
    }
    const op = operatorOf(row);
    const children = producer.args.map((arg, index) =>
      index === 0 && WRITES_OPERAND.has(op) ? this.parameter(arg) : this.expression(arg, depth - 1)
    );
    if (producer.kind === 'operator')
      return { kind: 'operator', type: row.returns, row, op, operands: children };
    return { kind: 'call', type: row.returns, row, name: producer.name ?? op, args: children };
  }

  /** A parameter of `type` or a literal of it, or nothing when the program has neither. */
  leaf(type) {
    const choices = [];
    if (this.parameters.includes(type)) choices.push(() => this.parameter(type));
    if (this.literals.has(type)) choices.push(() => this.literal(type));
    return choices.length === 0 ? undefined : this.random.pick(choices)();
  }

  parameter(type) {
    const indices = this.parameters.flatMap((each, index) => (each === type ? [index] : []));
    const index = this.random.pick(indices);
    if (this.names === undefined) return { kind: 'parameter', type, index };
    return { kind: 'parameter', type, index, name: this.names[index] };
  }

  /** A literal of `type`: of `row`, or of a random literal row of the type. */
  literal(type, row = this.random.pick(this.literals.get(type))) {
    return { kind: 'literal', type, row, text: LITERALS[row.id].text(this.random) };
  }

  /** The input rows: each lane an ordinary value of a few digits, or one of the edge values. */
  inputs(parameters) {
    return Array.from({ length: INPUT_ROWS }, () =>
      parameters.map((type) => {
        const lanes = Array.from({ length: LANE_COUNT[type] }, () => this.inputValue());
        return lanes.length === 1 ? lanes[0] : lanes;
      })
    );
  }

  inputValue() {
    if (this.random.chance(EDGE_VALUE_CHANCE)) return this.random.pick(FLOAT_VALUES);
    const sign = this.random.chance(0.5) ? -1 : 1;
    return (sign * this.random.below(100000)) / 10 ** this.random.below(5);
  }
}

/**
 * The programs of `seed`: one rooted at each row of `ROOT_ROWS`, so every such row is in the set,
 * then `count` with random roots.
 */
export function generatePrograms({ seed, count }) {
  const writer = new ProgramWriter(seededRandom(seed));
  const name = (index) => `random-${seed}-${index}`;
  const rooted = ROOT_ROWS.map((row, index) => writer.program(name(index), row));
  const random = Array.from({ length: count }, (_, index) => writer.program(name(rooted.length + index)));
  return [...rooted, ...random];
}
