/**
 * The names of a material in the linked text, as Godot's shader compiler writes them: each name
 * of a function, an argument, a local, a struct and a member as `_mkid` gives it
 * (`servers/rendering/shader_compiler.cpp:175`), so no name of a material meets a template's.
 */

import type {
  Argument,
  BlockNode,
  CallNode,
  Declarator,
  Expression,
  FunctionNode,
  Statement,
  StructMember,
  StructNode,
} from '../language/shaderTree.js';
import { isCall, withSubExpressions } from '../language/treeWalk.js';

/** `m_` and the name, with each `__` as `_dus_`: GLSL reserves a double underscore. */
const godotId = (name: string): string => `m_${name.replaceAll('__', '_dus_')}`.replaceAll('__', '_dus_');

/** The trees of a material's structs and functions with Godot's ids. */
export class GodotIds {
  private readonly structNames: ReadonlySet<string>;

  constructor(structs: readonly StructNode[]) {
    this.structNames = new Set(structs.map((struct) => struct.name));
  }

  struct(struct: StructNode): StructNode {
    return {
      ...struct,
      name: godotId(struct.name),
      members: struct.members.map((member) => this.member(member)),
    };
  }

  function(definition: FunctionNode): FunctionNode {
    return {
      ...definition,
      name: godotId(definition.name),
      rname: godotId(definition.rname),
      returnType: this.type(definition.returnType),
      arguments: definition.arguments.map((argument) => this.argument(argument)),
      body: this.block(definition.body),
    };
  }

  block(block: BlockNode): BlockNode {
    return { ...block, statements: block.statements.map((statement) => this.statement(statement)) };
  }

  /** `expression` with Godot's ids. A built-in keeps its name, which the link step replaces. */
  expression(expression: Expression): Expression {
    const inner = withSubExpressions(expression, (part) => this.expression(part));
    const typed = { ...inner, type: this.type(inner.type) } as Expression;
    if (isCall(typed)) {
      const call: CallNode = { ...typed, function: godotId(typed.function), rname: godotId(typed.rname) };
      return call;
    }
    if (typed.kind === 'field') return { ...typed, name: godotId(typed.name) };
    if (typed.kind === 'variable' && !typed.builtIn) return { ...typed, name: godotId(typed.name) };
    return typed;
  }

  private statement(statement: Statement): Statement {
    switch (statement.kind) {
      case 'block':
        return this.block(statement);
      case 'control flow':
        return {
          ...statement,
          expressions: statement.expressions.map((expression) => this.expression(expression)),
          blocks: statement.blocks.map((block) => this.block(block)),
        };
      case 'declaration':
        return {
          ...statement,
          type: this.type(statement.type),
          declarators: statement.declarators.map((declarator) => this.declarator(declarator)),
        };
      case 'slot':
        return statement;
      default:
        return this.expression(statement);
    }
  }

  private declarator(declarator: Declarator): Declarator {
    const value = declarator.value && this.expression(declarator.value);
    return { ...declarator, name: godotId(declarator.name), ...(value ? { value } : {}) };
  }

  private argument(argument: Argument): Argument {
    return { ...argument, name: godotId(argument.name), type: this.type(argument.type) };
  }

  private member(member: StructMember): StructMember {
    return { ...member, name: godotId(member.name), type: this.type(member.type) };
  }

  private type(type: string): string {
    return this.structNames.has(type) ? godotId(type) : type;
  }
}
