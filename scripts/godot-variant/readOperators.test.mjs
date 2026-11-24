import { describe, expect, it } from 'vitest';
import { operatorRegistrations } from './readOperators.mjs';

const source = (body) => `#define register_string_op(m_op_type, m_op_code)                               \\
	if constexpr (true) {                                                                      \\
		register_op<m_op_type<String, String>>(m_op_code, Variant::STRING, Variant::STRING);   \\
		register_op<m_op_type<String, StringName>>(m_op_code, Variant::STRING, Variant::STRING_NAME); \\
	} else                                                                                     \\
		((void)0)

void Variant::_register_variant_operators() {
	memset(operator_return_type_table, 0, sizeof(operator_return_type_table));
${body}
}
`;

describe('operatorRegistrations', () => {
  it('reads a register_op line as its operator, types and evaluator', () => {
    const rows = operatorRegistrations(
      source(
        '\tregister_op<OperatorEvaluatorAdd<double, int64_t, double>>(Variant::OP_ADD, Variant::INT, Variant::FLOAT);'
      )
    );
    expect(rows).toEqual([
      {
        operator: 'OP_ADD',
        left: 'INT',
        right: 'FLOAT',
        evaluator: 'OperatorEvaluatorAdd',
        types: ['double', 'int64_t', 'double'],
        line: 10,
      },
    ]);
  });

  it('expands a macro of register_op lines with its arguments', () => {
    const rows = operatorRegistrations(
      source('\tregister_string_op(OperatorEvaluatorStringConcat, Variant::OP_ADD);')
    );
    expect(rows.map(({ evaluator, types, right }) => [evaluator, types, right])).toEqual([
      ['OperatorEvaluatorStringConcat', ['String', 'String'], 'STRING'],
      ['OperatorEvaluatorStringConcat', ['String', 'StringName'], 'STRING_NAME'],
    ]);
  });

  it('reads an evaluator with no template arguments', () => {
    const [row] = operatorRegistrations(
      source('\tregister_op<OperatorEvaluatorAddArray>(Variant::OP_ADD, Variant::ARRAY, Variant::ARRAY);')
    );
    expect([row?.evaluator, row?.types]).toEqual(['OperatorEvaluatorAddArray', []]);
  });

  it('refuses a statement it does not understand, so no row drops in silence', () => {
    expect(() => operatorRegistrations(source('\tregister_other(Variant::OP_ADD);'))).toThrow(
      /register_other/
    );
  });
});
