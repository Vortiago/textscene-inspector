/**
 * The printer of a template stage: its tree back to GLSL text. Godot's own GLSL compiler gives the
 * same SPIR-V for this text as for the template's, which proves that the tree holds every token of
 * the template and the right types: each implicit conversion is written as its constructor.
 */

import { printExpression } from '../language/printer.js';
import type {
  Argument,
  BlockNode,
  ControlFlowNode,
  DeclarationNode,
  Expression,
  FunctionNode,
  Statement,
  StructNode,
} from '../language/shaderTree.js';
import { isEmpty } from '../language/treeWalk.js';
import { RUNTIME_SIZED } from './parseGlslExpression.js';
import type {
  BlockMember,
  GlobalNode,
  GlobalQualifiers,
  InterfaceBlockNode,
  SlotNode,
  TemplateDeclaration,
  TemplateStageNode,
} from './templateTree.js';

/** The GLSL text of `stage`, with each slot left empty as Godot leaves an empty code section. */
export function printTemplateStage(stage: TemplateStageNode): string {
  const directives = stage.directives.map((directive) => `#${directive.name} ${directive.text}\n`);
  return directives.join('') + stage.declarations.map(printDeclaration).join('\n') + '\n';
}

function printDeclaration(declaration: TemplateDeclaration): string {
  switch (declaration.kind) {
    case 'interface block':
      return printBlockDeclaration(declaration);
    case 'global':
      return printGlobal(declaration);
    case 'default layout':
      return `${printQualifiers(declaration.qualifiers)};`;
    case 'precision':
      return `precision ${declaration.precision} ${declaration.type};`;
    case 'invariant':
      return `invariant ${declaration.names.join(', ')};`;
    case 'prototype':
      return `${printHead(declaration.function)};`;
    case 'struct':
      return printStruct(declaration);
    case 'function':
      return printFunction(declaration);
    case 'slot':
      return '';
  }
}

function printQualifiers(qualifiers: GlobalQualifiers): string {
  const layout =
    qualifiers.layout.length === 0
      ? []
      : [
          `layout(${qualifiers.layout
            .map((entry) => (entry.value ? `${entry.name} = ${printExpression(entry.value)}` : entry.name))
            .join(', ')})`,
        ];
  return [...layout, ...qualifiers.words].join(' ');
}

const prefixed = (qualifiers: GlobalQualifiers) => {
  const text = printQualifiers(qualifiers);
  return text === '' ? '' : `${text} `;
};

const sizeText = (size: number | undefined) =>
  size === undefined ? '' : size === RUNTIME_SIZED ? '[]' : `[${size}]`;

function printMember(member: BlockMember | SlotNode): string {
  if (member.kind === 'slot') return '';
  return `\t${prefixed(member.qualifiers)}${member.type} ${member.name}${sizeText(member.arraySize)};\n`;
}

function printBlockDeclaration(block: InterfaceBlockNode): string {
  const instance = block.instanceName ? ` ${block.instanceName}${sizeText(block.arraySize)}` : '';
  return `${prefixed(block.qualifiers)}${block.blockName} {\n${block.members.map(printMember).join('')}}${instance};`;
}

function printGlobal(global: GlobalNode): string {
  const names = global.declarators.map((declarator) => {
    const value = declarator.value ? ` = ${printExpression(declarator.value)}` : '';
    return `${declarator.name}${sizeText(declarator.arraySize)}${value}`;
  });
  return `${prefixed(global.qualifiers)}${global.type} ${names.join(', ')};`;
}

function printStruct(struct: StructNode): string {
  const members = struct.members.map(
    (member) => `\t${member.type} ${member.name}${sizeText(member.arraySize)};\n`
  );
  return `struct ${struct.name} {\n${members.join('')}};`;
}

function printArgument(argument: Argument): string {
  const words = [
    ...(argument.isConst ? ['const'] : []),
    argument.qualifier,
    ...(argument.words ?? []),
    argument.type,
    `${argument.name}${sizeText(argument.arraySize)}`,
  ];
  return words.join(' ');
}

function printHead(head: Omit<FunctionNode, 'body' | 'kind'>): string {
  return `${head.returnType}${sizeText(head.returnArraySize)} ${head.rname}(${head.arguments.map(printArgument).join(', ')})`;
}

function printFunction(definition: FunctionNode): string {
  return `${printHead(definition)} ${printBlock(definition.body, '')}`;
}

function printBlock(block: BlockNode, indent: string): string {
  const inner = `${indent}\t`;
  return `{\n${block.statements.map((statement) => `${inner}${printStatement(statement, inner)}\n`).join('')}${indent}}`;
}

function printStatement(statement: Statement, indent: string): string {
  switch (statement.kind) {
    case 'block':
      return printBlock(statement, indent);
    case 'declaration':
      return `${printDeclarationStatement(statement)};`;
    case 'control flow':
      return printFlow(statement, indent);
    case 'slot':
      return '';
    default:
      return isEmpty(statement) ? ';' : `${printExpression(statement)};`;
  }
}

function printDeclarationStatement(declaration: DeclarationNode): string {
  const words = [...(declaration.isConst ? ['const'] : []), ...(declaration.words ?? []), declaration.type];
  const names = declaration.declarators.map((declarator) => {
    const value = declarator.value ? ` = ${printExpression(declarator.value)}` : '';
    return `${declarator.name}${sizeText(declarator.arraySize)}${value}`;
  });
  return `${words.join(' ')} ${names.join(', ')}`;
}

function printFlow(flow: ControlFlowNode, indent: string): string {
  const attributes = flow.attributes ? `[[${flow.attributes.join(', ')}]] ` : '';
  return attributes + printFlowBody(flow, indent);
}

function printFlowBody(flow: ControlFlowNode, indent: string): string {
  const [first] = flow.expressions;
  const [block, second] = flow.blocks;
  const text = (expression: Expression) => printExpression(expression);
  switch (flow.flow) {
    case 'FLOW_OP_RETURN':
      return first === undefined ? 'return;' : `return ${text(first)};`;
    case 'FLOW_OP_BREAK':
      return 'break;';
    case 'FLOW_OP_CONTINUE':
      return 'continue;';
    case 'FLOW_OP_DISCARD':
      return 'discard;';
    case 'FLOW_OP_IF': {
      const then = `if (${text(first!)}) ${printBlock(block!, indent)}`;
      return second === undefined ? then : `${then} else ${printBlock(second, indent)}`;
    }
    case 'FLOW_OP_WHILE':
      return `while (${text(first!)}) ${printBlock(block!, indent)}`;
    case 'FLOW_OP_DO':
      return `do ${printBlock(block!, indent)} while (${text(first!)});`;
    case 'FLOW_OP_FOR':
      return printFor(flow, indent);
    case 'FLOW_OP_SWITCH':
      return `switch (${text(first!)}) ${printBlock(block!, indent)}`;
    case 'FLOW_OP_CASE':
      return `case ${text(first!)}:`;
    case 'FLOW_OP_DEFAULT':
      return 'default:';
  }
}

function printFor(flow: ControlFlowNode, indent: string): string {
  const [init, conditions, steps, body] = flow.blocks as [BlockNode, BlockNode, BlockNode, BlockNode];
  const [first] = init.statements;
  const initText = first === undefined ? ';' : printStatement(first, indent);
  const parts = (block: BlockNode) =>
    block.statements.map((part) => printExpression(part as Expression)).join(', ');
  return `for (${initText} ${parts(conditions)}; ${parts(steps)}) ${printBlock(body, indent)}`;
}
