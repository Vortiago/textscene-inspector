/**
 * The expressions the port answers as Godot's Expression class does: hand cases of the tokenizer
 * and the parser, cases of every operator registration and every constructor, and type pairs no
 * operator takes. Each case names the registration it covers, so a test shows the set holds them all.
 */

import {
  CONSTRUCTOR_REGISTRATIONS,
  OPERATOR_REGISTRATIONS,
} from '../../../../packages/textscene-core/src/godot/variant/registrations.generated.ts';
import { constructorSignature } from '../../../../packages/textscene-core/src/godot/variant/construct/constructorSignature.ts';
import {
  VARIANT_TYPE,
  variantTypeName,
} from '../../../../packages/textscene-core/src/godot/variant/variantType.ts';
import { seededRandom } from '../random/seededRandom.mjs';
import { HAND_CASES } from './handCases.mjs';
import { containerHolding, formatText, VALUE_TYPES, valueText } from './values.mjs';

const SEED = 0x7e57;
const CASES_PER_REGISTRATION = 4;
const UNREGISTERED_PAIRS_PER_OPERATOR = 6;

/** The Expression spelling of each operator. OP_POSITIVE and OP_XOR have none (expression.cpp:1034). */
export const OPERATOR_TEXT = {
  OP_EQUAL: '==',
  OP_NOT_EQUAL: '!=',
  OP_LESS: '<',
  OP_LESS_EQUAL: '<=',
  OP_GREATER: '>',
  OP_GREATER_EQUAL: '>=',
  OP_ADD: '+',
  OP_SUBTRACT: '-',
  OP_MULTIPLY: '*',
  OP_DIVIDE: '/',
  OP_NEGATE: '-',
  OP_MODULE: '%',
  OP_POWER: '**',
  OP_SHIFT_LEFT: '<<',
  OP_SHIFT_RIGHT: '>>',
  OP_BIT_AND: '&',
  OP_BIT_OR: '|',
  OP_BIT_XOR: '^',
  OP_BIT_NEGATE: '~',
  OP_AND: 'and',
  OP_OR: 'or',
  OP_NOT: 'not',
  OP_IN: 'in',
};

const UNARY = new Set(['OP_NEGATE', 'OP_BIT_NEGATE', 'OP_NOT', 'OP_POSITIVE']);

/**
 * The registrations no Expression text reaches: their operator has no spelling, or `~`, which the
 * parser takes only between two operands (expression.cpp:833), where it fails.
 */
export const UNREACHABLE_OPERATORS = OPERATOR_REGISTRATIONS.filter(
  ([operator]) => !(operator in OPERATOR_TEXT) || operator === 'OP_BIT_NEGATE'
);

const operatorKey = ([operator, left, right]) => `${operator} ${left} ${right}`;

function operatorText(operator, leftText, rightText) {
  const spelling = OPERATOR_TEXT[operator];
  return UNARY.has(operator) ? `${spelling} (${leftText})` : `(${leftText}) ${spelling} (${rightText})`;
}

function operatorCases(random) {
  return OPERATOR_REGISTRATIONS.filter(([operator]) => operator in OPERATOR_TEXT).flatMap((row) => {
    const [operator, left, right] = row;
    return Array.from({ length: CASES_PER_REGISTRATION }, (_, index) => {
      const isFormat = operator === 'OP_MODULE' && (left === 'STRING' || left === 'STRING_NAME');
      if (isFormat && index === 0) return formatCase(row, random);
      const leftText =
        isFormat && index < CASES_PER_REGISTRATION - 1 ? formatText(left, random) : valueText(left, random);
      const holds = operator === 'OP_IN' && index % 2 === 0;
      const rightText = holds ? containerHolding(right, leftText, random) : valueText(right, random);
      return {
        id: `operator ${operatorKey(row)} ${index}`,
        text: operatorText(operator, leftText, rightText),
        operator: operatorKey(row),
      };
    });
  });
}

/** A `%s` format of one value, which every right type formats: an Array right holds that value. */
function formatCase(row, random) {
  const [operator, left, right] = row;
  const value = right === 'ARRAY' ? `[${valueText('INT', random)}]` : valueText(right, random);
  return {
    id: `operator ${operatorKey(row)} 0`,
    text: operatorText(operator, formatText(left, random, '"%s"'), value),
    operator: operatorKey(row),
  };
}

/** Pairs of types no registration takes, which Godot refuses with "Invalid operands". */
function unregisteredCases(random) {
  const registered = new Set(OPERATOR_REGISTRATIONS.map(operatorKey));
  return Object.keys(OPERATOR_TEXT).flatMap((operator) => {
    const rights = UNARY.has(operator) ? ['NIL'] : VALUE_TYPES;
    const pairs = VALUE_TYPES.flatMap((left) => rights.map((right) => [left, right])).filter(
      ([left, right]) => !registered.has(`${operator} ${left} ${right}`)
    );
    if (pairs.length === 0) return [];
    return Array.from({ length: UNREGISTERED_PAIRS_PER_OPERATOR }, (_, index) => {
      const [left, right] = random.pick(pairs);
      const text = operatorText(operator, valueText(left, random), valueText(right, random));
      return { id: `unregistered ${operator} ${left} ${right} ${index}`, text };
    });
  });
}

/** The id of a constructor row: its place in the table, its class and its C++ types. */
export function constructorKey([constructor, types], index) {
  return `${index} ${constructor}<${types.join(', ')}>`;
}

/** The Expression name of a Variant type: `Nil`, `bool`, `int`, `float`, or the class name. */
function typeName(type) {
  return variantTypeName(VARIANT_TYPE[type]);
}

/** An argument text of `type`. A NIL argument takes a value of any type. */
function argumentText(type, random) {
  if (type === 'NIL') return random.pick(['null', '1', '"x"']);
  return valueText(type, random);
}

function constructorCases(random) {
  return CONSTRUCTOR_REGISTRATIONS.flatMap((row, index) => {
    const signature = constructorSignature(row, index);
    const key = constructorKey(row, index);
    return Array.from({ length: CASES_PER_REGISTRATION }, (_, caseIndex) => {
      const argumentsText = signature.arguments.map((type) => argumentText(type, random));
      return {
        id: `constructor ${key} ${caseIndex}`,
        text: `${typeName(signature.type)}(${argumentsText.join(', ')})`,
        constructor: key,
      };
    });
  });
}

/** Every case, in a fixed order: one seed gives the same texts on every platform. */
export function expressionSet() {
  const random = seededRandom(SEED);
  return [...HAND_CASES, ...operatorCases(random), ...unregisteredCases(random), ...constructorCases(random)];
}

export const EXPRESSIONS = expressionSet();
