import type Parser from 'web-tree-sitter';
import {
  createNodeId,
  createRange,
  normalizeWorkspacePath,
  type AnalysisWarning,
  type CodeNode,
  type CodeNodeKind,
  type FileAnalysis,
  type SourceRange,
  type UnresolvedReference,
} from '../core/contracts.js';

export type AnalyzeCFileInput = Readonly<{
  parser: Parser;
  path: string;
  source: string;
  nodeCountMax: number;
}>;

type VisitContext = Readonly<{
  functionName: string;
  guard: string;
}>;

const depthMax = 512;

function toRange(node: Parser.SyntaxNode): SourceRange {
  return createRange(
    node.startPosition.row + 1,
    node.startPosition.column + 1,
    node.endPosition.row + 1,
    node.endPosition.column + 1,
  );
}

function splitTokens(value: string): readonly string[] {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function firstDescendant(
  node: Parser.SyntaxNode,
  types: readonly string[],
): Parser.SyntaxNode | undefined {
  const pending: Parser.SyntaxNode[] = [node];
  let inspected = 0;

  while (pending.length > 0 && inspected < 1_000) {
    const candidate = pending.pop();
    if (!candidate) {
      break;
    }
    inspected += 1;
    if (types.includes(candidate.type)) {
      return candidate;
    }
    for (let index = candidate.namedChildren.length - 1; index >= 0; index -= 1) {
      const child = candidate.namedChildren[index];
      if (child) {
        pending.push(child);
      }
    }
  }
  return undefined;
}

function declaratorName(node: Parser.SyntaxNode): string {
  const declarator = node.childForFieldName('declarator') ?? node;
  return firstDescendant(declarator, ['identifier', 'field_identifier', 'type_identifier'])?.text ?? '';
}

function signatureFor(node: Parser.SyntaxNode): string {
  return node.text.split('{', 1)[0]?.replaceAll(/\s+/g, ' ').trim().slice(0, 240) ?? '';
}

function createNode(
  path: string,
  kind: CodeNodeKind,
  name: string,
  node: Parser.SyntaxNode,
): CodeNode {
  const normalizedPath = normalizeWorkspacePath(path);
  return {
    id: createNodeId('c', normalizedPath, kind, name),
    language: 'c',
    kind,
    name,
    qualifiedName: name,
    path: normalizedPath,
    range: toRange(node),
    signature: signatureFor(node),
    summary: `${kind} ${name}`,
    tokens: splitTokens(name),
  };
}

function guardFor(node: Parser.SyntaxNode): string {
  const condition = node.childForFieldName('condition');
  if (condition) {
    return condition.text.trim();
  }
  const firstLine = node.text.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.replace(/^#\s*(ifndef|ifdef|if)\s*/, '').trim();
}

function directCallTarget(node: Parser.SyntaxNode): string {
  const target = node.childForFieldName('function');
  if (!target) {
    return '';
  }
  if (target.type === 'identifier') {
    return target.text;
  }
  const field = firstDescendant(target, ['field_identifier']);
  return field?.text ?? target.text.replaceAll(/\s+/g, ' ').trim();
}

export async function analyzeCFile(input: AnalyzeCFileInput): Promise<FileAnalysis> {
  if (input.nodeCountMax < 1 || input.nodeCountMax > 1_000_000) {
    throw new Error(`nodeCountMax must be between 1 and 1000000; received ${input.nodeCountMax}`);
  }

  const normalizedPath = normalizeWorkspacePath(input.path);
  const tree = input.parser.parse(input.source);
  const nodes: CodeNode[] = [];
  const unresolvedReferences: UnresolvedReference[] = [];
  const warnings: AnalysisWarning[] = [];
  let visited = 0;
  let isTruncated = false;

  function visit(node: Parser.SyntaxNode, context: VisitContext, depth: number): void {
    if (visited >= input.nodeCountMax || depth > depthMax) {
      isTruncated = true;
      return;
    }
    visited += 1;

    let childContext = context;
    if (node.type === 'preproc_if' || node.type === 'preproc_ifdef' || node.type === 'preproc_ifndef') {
      const guard = guardFor(node);
      childContext = { ...context, guard };
      if (guard.length > 0) {
        nodes.push(createNode(normalizedPath, 'macro', guard, node));
      }
    }

    if (node.type === 'function_definition') {
      const name = declaratorName(node);
      if (name.length > 0) {
        nodes.push(createNode(normalizedPath, 'function', name, node));
        childContext = { ...childContext, functionName: name };
      }
    } else if (node.type === 'struct_specifier' && node.childForFieldName('body')) {
      const name = node.childForFieldName('name')?.text ?? '';
      if (name.length > 0) {
        nodes.push(createNode(normalizedPath, 'struct', name, node));
      }
    } else if (node.type === 'field_declaration') {
      const fields = node.descendantsOfType('field_identifier');
      for (const field of fields) {
        nodes.push(createNode(normalizedPath, 'field', field.text, field));
      }
    } else if (node.type === 'preproc_def' || node.type === 'preproc_function_def') {
      const name = node.childForFieldName('name')?.text ?? '';
      if (name.length > 0) {
        nodes.push(createNode(normalizedPath, 'macro', name, node));
      }
    } else if (node.type === 'call_expression' && childContext.functionName.length > 0) {
      const targetName = directCallTarget(node);
      if (targetName.length > 0) {
        unresolvedReferences.push({
          sourceName: childContext.functionName,
          targetName,
          kind: 'calls',
          path: normalizedPath,
          range: toRange(node),
          guard: childContext.guard,
          evidence: node.text.slice(0, 240),
        });
      }
    } else if (node.type === 'initializer_pair') {
      const designator = node.childForFieldName('designator');
      const value = node.childForFieldName('value');
      const fieldName = designator
        ? firstDescendant(designator, ['field_identifier'])?.text ?? ''
        : '';
      const targetName = value ? firstDescendant(value, ['identifier'])?.text ?? '' : '';
      if (fieldName.length > 0 && targetName.length > 0) {
        unresolvedReferences.push({
          sourceName: fieldName,
          targetName,
          kind: 'registers',
          path: normalizedPath,
          range: toRange(node),
          guard: childContext.guard,
          evidence: node.text.slice(0, 240),
        });
      }
    }

    for (const child of node.namedChildren) {
      visit(child, childContext, depth + 1);
      if (isTruncated) {
        break;
      }
    }
  }

  visit(tree.rootNode, { functionName: '', guard: '' }, 0);

  if (tree.rootNode.hasError()) {
    warnings.push({
      code: 'C_PARSE_PARTIAL',
      message: 'The file contains syntax errors; CodeTrail kept the structure it could verify.',
      path: normalizedPath,
    });
  }
  if (isTruncated) {
    warnings.push({
      code: 'C_NODE_LIMIT',
      message: `Structural analysis stopped at ${input.nodeCountMax} syntax nodes.`,
      path: normalizedPath,
    });
  }

  tree.delete();
  return { path: normalizedPath, nodes, unresolvedReferences, warnings };
}
