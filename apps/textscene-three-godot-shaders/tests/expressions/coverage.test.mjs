/**
 * The Expression set holds every operator registration and every constructor registration an
 * Expression text can reach, and Godot answers each one with a value at least once on a live run.
 */

import { describe, expect, it } from 'vitest';
import { constructorFor } from '../../../../packages/textscene-core/src/godot/variant/construct/construct.ts';
import { constructorSignature } from '../../../../packages/textscene-core/src/godot/variant/construct/constructorSignature.ts';
import {
  CONSTRUCTOR_REGISTRATIONS,
  OPERATOR_REGISTRATIONS,
} from '../../../../packages/textscene-core/src/godot/variant/registrations.generated.ts';
import { godotAnswers } from '../godotAnswers.mjs';
import { constructorKey, EXPRESSIONS, UNREACHABLE_OPERATORS } from './expressionSet.mjs';

const ANSWERS = godotAnswers();
const RECORD = ANSWERS.expressions;

const operatorKey = ([operator, left, right]) => `${operator} ${left} ${right}`;
const UNREACHABLE = new Set(UNREACHABLE_OPERATORS.map(operatorKey));
const REACHABLE_OPERATORS = OPERATOR_REGISTRATIONS.map(operatorKey).filter((key) => !UNREACHABLE.has(key));

// An Object an expression makes is null, so `in` on one never finds a property (variant_op.h).
const ALWAYS_INVALID = new Set(['OP_IN STRING OBJECT', 'OP_IN STRING_NAME OBJECT']);

const SIGNATURES = CONSTRUCTOR_REGISTRATIONS.map(constructorSignature);

/** The row `Variant::construct` runs for the argument types of `signature`: a row before it can take them. */
const reachedBy = (signature) => constructorFor(signature.type, signature.arguments);

const casesOf = (field, key) => EXPRESSIONS.filter((test) => test[field] === key);
const hasValue = (field, key) =>
  casesOf(field, key).some((test) => RECORD.cases[test.id]?.verdict === 'value');

describe('the Expression set', () => {
  it('holds cases of every operator registration a text can spell', () => {
    expect(REACHABLE_OPERATORS.filter((key) => casesOf('operator', key).length === 0)).toEqual([]);
  });

  it.runIf(ANSWERS.live)('has a value from Godot for every reachable operator registration', () => {
    const missing = REACHABLE_OPERATORS.filter(
      (key) => !ALWAYS_INVALID.has(key) && !hasValue('operator', key)
    );
    expect(missing).toEqual([]);
  });

  it('holds cases of every constructor registration', () => {
    const keys = CONSTRUCTOR_REGISTRATIONS.map(constructorKey);
    expect(keys.filter((key) => casesOf('constructor', key).length === 0)).toEqual([]);
  });

  it('reaches each constructor registration or one before it that takes the same arguments', () => {
    const unreached = SIGNATURES.filter((signature) => {
      const reached = reachedBy(signature);
      return reached === undefined || reached.index > signature.index;
    });
    expect(unreached.map((signature) => signature.index)).toEqual([]);
  });

  it.runIf(ANSWERS.live)('has a value from Godot for every constructor registration a text reaches', () => {
    const reached = SIGNATURES.filter((signature) => reachedBy(signature).index === signature.index);
    const keys = reached.map((signature) =>
      constructorKey(CONSTRUCTOR_REGISTRATIONS[signature.index], signature.index)
    );
    expect(keys.filter((key) => !hasValue('constructor', key))).toEqual([]);
  });
});
