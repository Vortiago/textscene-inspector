/**
 * Godot's operator type rules, read by running `_validate_operator` (`shader_language.cpp:1557`)
 * over every operand type. A small interpreter runs the function's C++ cases: the rules stay
 * Godot's text, and a statement it does not know throws, so no rule is dropped in silence.
 * Operands are never arrays here: an array operand is a type rule of the statements family.
 */

import { enumMembers, lineAt } from './cppText.mjs';

/** Operators `_validate_operator` does not type: each is one row with no operands. */
const UNTYPED_OPERATORS = ['OP_SELECT_ELSE', 'OP_CALL', 'OP_CONSTRUCT', 'OP_STRUCT', 'OP_INDEX', 'OP_EMPTY'];

/**
 * Each operand signature Godot accepts, `{ op, args, returns, line }`, in the order of the
 * `Operator` enum, then of `types`. An untyped operator gives one row with no `args`.
 */
export function operatorSignatures({ header, language }, types) {
  const order = {
    types: enumMembers(header, 'DataType').map(({ name }) => name),
    operators: enumMembers(header, 'Operator').map(({ name }) => name),
  };
  const cases = operatorCases(language);
  const operators = order.operators.filter((name) => name !== 'OP_MAX');
  const typeIndex = (name) => order.types.indexOf(name);
  return operators.flatMap((op) => {
    if (UNTYPED_OPERATORS.includes(op)) return [{ op, args: [], returns: null, line: cases.functionLine }];
    const rule = cases.byOperator.get(op);
    if (!rule) throw new Error(`expected a case for ${op} in _validate_operator, found none`);
    const statements = parseStatements(tokenize(rule.body));
    return operandTuples(types, operandCount(rule.body)).flatMap((args) => {
      const outcome = runCase(statements, order, op, args.map(typeIndex));
      if (!outcome.valid) return [];
      return [{ op, args, returns: order.types[outcome.returnType], line: rule.line }];
    });
  });
}

/** One `case` label and the space after it, a line comment allowed, read where it stands. */
const CASE_LABEL = /case (OP_\w+):\s*(?:\/\/[^\n]*)?\s*/y;

/**
 * Each group of `case` labels in `body` that a `{` follows: its labels, where its first label
 * starts, and where its `{` stands. Each label is read once, so the scan takes linear time.
 */
export function caseGroups(body) {
  const groups = [];
  let next = body.indexOf('case ');
  while (next !== -1) {
    const start = next;
    const labels = [];
    let end = start;
    CASE_LABEL.lastIndex = start;
    for (let label = CASE_LABEL.exec(body); label !== null; label = CASE_LABEL.exec(body)) {
      labels.push(label[1]);
      end = CASE_LABEL.lastIndex;
    }
    if (labels.length > 0 && body[end] === '{') groups.push({ labels, start, open: end });
    next = body.indexOf('case ', Math.max(end, start + 1));
  }
  return groups;
}

/**
 * The case groups of `_validate_operator`'s switch: for each operator the body of its group and
 * the line of its first label.
 */
function operatorCases(cpp) {
  const start = cpp.indexOf('bool ShaderLanguage::_validate_operator(');
  if (start === -1) throw new Error('expected _validate_operator in shader_language.cpp, found none');
  const switchStart = cpp.indexOf('switch (p_op->op) {', start);
  const bodyStart = cpp.indexOf('{', switchStart) + 1;
  const body = cpp.slice(bodyStart, matchingBrace(cpp, bodyStart - 1));
  const byOperator = new Map();
  let after = 0;
  for (const group of caseGroups(body)) {
    if (group.start < after) continue;
    const close = matchingBrace(body, group.open);
    const caseBody = body.slice(group.open + 1, close);
    const line = lineAt(cpp, bodyStart + group.start);
    for (const label of group.labels) byOperator.set(label, { body: caseBody, line });
    after = close;
  }
  return { byOperator, functionLine: lineAt(cpp, start) };
}

function matchingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`expected a closing brace for the one at ${open}, found none`);
}

/** How many operands a case reads: the highest `arguments[n]` plus one. */
function operandCount(body) {
  const indices = [...body.matchAll(/arguments\[(\d)\]/g)].map((match) => Number(match[1]));
  return Math.max(...indices) + 1;
}

function operandTuples(types, arity) {
  if (arity === 0) return [[]];
  return operandTuples(types, arity - 1).flatMap((rest) => types.map((type) => [...rest, type]));
}

/** Runs one parsed case body for operands of `operandTypes`, and answers `{ valid, returnType }`. */
function runCase(statements, order, op, operandTypes) {
  const state = {
    vars: { valid: false, ret_type: 0, ret_size: 0 },
    order,
    op: indexIn(order.operators, op),
    operandTypes,
  };
  try {
    runStatements(statements, state);
  } catch (signal) {
    if (signal !== BREAK) throw signal;
  }
  return { valid: Boolean(state.vars.valid), returnType: state.vars.ret_type };
}

const BREAK = Symbol('break');

/** The index of `name` in an enum, which `p_op->op >= OP_BIT_AND` and `na > TYPE_BVEC4` compare. */
function indexIn(members, name) {
  const index = members.indexOf(name);
  if (index === -1) throw new Error(`expected a member of the enum, got ${name}`);
  return index;
}

function tokenize(body) {
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const pattern = /\s*(->|==|!=|<=|>=|&&|\|\||[A-Za-z_]\w*|\d+|[{}()[\];,=<>!.])/gy;
  const tokens = [];
  let match;
  let index = 0;
  while (index < withoutComments.length) {
    pattern.lastIndex = index;
    match = pattern.exec(withoutComments);
    if (!match) {
      if (/^\s*$/.test(withoutComments.slice(index))) break;
      throw new Error(`expected a C++ token, got ${withoutComments.slice(index, index + 20)}`);
    }
    tokens.push(match[1]);
    index = pattern.lastIndex;
  }
  return tokens;
}

/** A recursive-descent reader of the statement forms `_validate_operator` uses. */
function parseStatements(tokens) {
  let position = 0;
  const peek = () => tokens[position];
  const take = (expected) => {
    const token = tokens[position];
    if (expected !== undefined && token !== expected) {
      throw new Error(
        `expected ${expected} in _validate_operator, got ${token} before ${tokens.slice(position, position + 8).join(' ')}`
      );
    }
    position += 1;
    return token;
  };

  function statement() {
    const token = peek();
    if (token === '{') {
      take('{');
      const body = [];
      while (peek() !== '}') body.push(statement());
      take('}');
      return { kind: 'block', body };
    }
    if (token === 'break') {
      take('break');
      take(';');
      return { kind: 'break' };
    }
    if (token === 'if') {
      take('if');
      take('(');
      const condition = expression();
      take(')');
      const then = statement();
      let otherwise = null;
      if (peek() === 'else') {
        take('else');
        otherwise = statement();
      }
      return { kind: 'if', condition, then, otherwise };
    }
    if (token === 'SWAP') {
      take('SWAP');
      take('(');
      const a = take();
      take(',');
      const b = take();
      take(')');
      take(';');
      return { kind: 'swap', a, b };
    }
    if (['DataType', 'int', 'bool', 'String'].includes(token)) {
      take();
      const name = take();
      take('=');
      const value = expression();
      take(';');
      return { kind: 'assign', name, value };
    }
    const name = take();
    if (!/^[A-Za-z_]\w*$/.test(name))
      throw new Error(`expected a statement in _validate_operator, got ${name}`);
    take('=');
    const value = expression();
    take(';');
    return { kind: 'assign', name, value };
  }

  function expression() {
    let left = conjunction();
    while (peek() === '||') {
      take('||');
      left = { kind: 'binary', op: '||', left, right: conjunction() };
    }
    return left;
  }

  function conjunction() {
    let left = comparison();
    while (peek() === '&&') {
      take('&&');
      left = { kind: 'binary', op: '&&', left, right: comparison() };
    }
    return left;
  }

  function comparison() {
    const left = unary();
    if (['==', '!=', '<', '<=', '>', '>='].includes(peek())) {
      const op = take();
      return { kind: 'binary', op, left, right: unary() };
    }
    return left;
  }

  function unary() {
    if (peek() === '!') {
      take('!');
      return { kind: 'not', operand: unary() };
    }
    if (peek() === '(') {
      take('(');
      const inner = expression();
      take(')');
      return inner;
    }
    return primary();
  }

  /** A name, a number, `p_op->op`, or a call on `p_op->arguments[n]`. */
  function primary() {
    const token = take();
    if (/^\d+$/.test(token)) return { kind: 'number', value: Number(token) };
    if (token === 'p_op') {
      take('->');
      const member = take();
      if (member === 'op') return { kind: 'operator' };
      if (member !== 'arguments')
        throw new Error(`expected p_op->op or p_op->arguments, got p_op->${member}`);
      take('[');
      const index = Number(take());
      take(']');
      take('->');
      const method = take();
      take('(');
      take(')');
      return { kind: 'operand', index, method };
    }
    if (token === 'DataType' && peek() === '(') {
      take('(');
      const inner = expression();
      take(')');
      return inner;
    }
    if (peek() === '(') {
      take('(');
      const argument = expression();
      take(')');
      return { kind: 'call', name: token, argument };
    }
    return { kind: 'name', name: token };
  }

  const statements = [];
  while (position < tokens.length) statements.push(statement());
  return statements;
}

function runStatements(statements, state) {
  for (const statement of statements) runStatement(statement, state);
}

function runStatement(statement, state) {
  switch (statement.kind) {
    case 'block':
      runStatements(statement.body, state);
      return;
    case 'break':
      throw BREAK;
    case 'if':
      if (evaluate(statement.condition, state)) runStatement(statement.then, state);
      else if (statement.otherwise) runStatement(statement.otherwise, state);
      return;
    case 'swap': {
      const a = state.vars[statement.a];
      state.vars[statement.a] = state.vars[statement.b];
      state.vars[statement.b] = a;
      return;
    }
    case 'assign':
      state.vars[statement.name] = evaluate(statement.value, state);
      return;
    default:
      throw new Error(`expected a statement kind, got ${statement.kind}`);
  }
}

function evaluate(node, state) {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'operator':
      return state.op;
    case 'operand':
      return operandValue(node, state);
    case 'not':
      return !evaluate(node.operand, state);
    case 'call':
      return callValue(node, state);
    case 'name':
      return nameValue(node.name, state);
    case 'binary':
      return binaryValue(node, state);
    default:
      throw new Error(`expected an expression kind, got ${node.kind}`);
  }
}

/**
 * An operand's type, and the facts a non-array operand gives: it is indexed, its array size is
 * 0, and its type name is the empty string (struct names only matter for `struct`).
 */
function operandValue({ index, method }, state) {
  if (method === 'get_datatype') return state.operandTypes[index];
  if (method === 'is_indexed') return true;
  if (method === 'get_array_size') return 0;
  if (method === 'get_datatype_name') return '';
  throw new Error(`expected a known operand method, got ${method}`);
}

function callValue({ name, argument }, state) {
  if (name === 'is_sampler_type') {
    const type = state.order.types[evaluate(argument, state)];
    return /SAMPLER/.test(type);
  }
  throw new Error(`expected a known call in _validate_operator, got ${name}`);
}

function nameValue(name, state) {
  if (name === 'true') return true;
  if (name === 'false') return false;
  if (name in state.vars) return state.vars[name];
  if (name.startsWith('TYPE_')) return indexIn(state.order.types, name);
  if (name.startsWith('OP_')) return indexIn(state.order.operators, name);
  throw new Error(`expected a known name in _validate_operator, got ${name}`);
}

function binaryValue({ op, left, right }, state) {
  if (op === '&&') return evaluate(left, state) && evaluate(right, state);
  if (op === '||') return evaluate(left, state) || evaluate(right, state);
  const a = evaluate(left, state);
  const b = evaluate(right, state);
  switch (op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      throw new Error(`expected a comparison, got ${op}`);
  }
}
