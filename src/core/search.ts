import type { CodeNode, SearchCandidate, SearchResult, WorkspaceIndex } from './contracts.js';

const stopWords = new Set(['a', 'an', 'and', 'does', 'how', 'is', 'of', 'the', 'to', 'what']);
const synonyms: Readonly<Record<string, string>> = {
  choose: 'pick',
  chooses: 'pick',
  choosing: 'pick',
  select: 'pick',
  selects: 'pick',
  selection: 'pick',
};

function tokenize(value: string): readonly string[] {
  const expanded = value.replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const tokens = expanded.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  return tokens
    .filter((token) => !stopWords.has(token))
    .map((token) => synonyms[token] ?? token);
}

function intersection(left: readonly string[], right: ReadonlySet<string>): readonly string[] {
  return [...new Set(left.filter((token) => right.has(token)))];
}

function scoreNode(node: CodeNode, queryTokens: readonly string[]): SearchCandidate | undefined {
  const querySet = new Set(queryTokens);
  const symbolMatches = intersection(node.tokens, querySet);
  const signatureMatches = intersection(tokenize(node.signature), querySet);
  const pathMatches = intersection(tokenize(node.path), querySet);
  const summaryMatches = intersection(tokenize(node.summary), querySet);
  const reasons: string[] = [];
  let score = 0;

  if (symbolMatches.length > 0) {
    score += symbolMatches.length * 25;
    reasons.push(`symbol tokens: ${symbolMatches.join(', ')}`);
  }
  if (signatureMatches.length > 0) {
    score += signatureMatches.length * 8;
    reasons.push(`signature: ${signatureMatches.join(', ')}`);
  }
  if (pathMatches.length > 0) {
    score += pathMatches.length * 6;
    reasons.push(`path: ${pathMatches.join(', ')}`);
  }
  if (summaryMatches.length > 0) {
    score += summaryMatches.length * 4;
    reasons.push(`summary: ${summaryMatches.join(', ')}`);
  }

  const normalizedName = tokenize(node.name).join(' ');
  const normalizedQuery = queryTokens.join(' ');
  if (normalizedName === normalizedQuery) {
    score += 200;
    reasons.unshift('exact symbol phrase');
  }
  if (score === 0) {
    return undefined;
  }
  return { nodeId: node.id, score, reasons };
}

export function searchIndex(index: WorkspaceIndex, query: string, limit: number): SearchResult {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error(`Search limit must be an integer between 1 and 20; received ${limit}`);
  }
  const queryTokens = tokenize(query);
  const normalizedQuery = queryTokens.join(' ');
  if (normalizedQuery.length === 0) {
    return { normalizedQuery: '', candidates: [] };
  }

  const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
  const candidates = index.nodes
    .map((node) => scoreNode(node, queryTokens))
    .filter((candidate): candidate is SearchCandidate => candidate !== undefined)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      const leftNode = nodesById.get(left.nodeId);
      const rightNode = nodesById.get(right.nodeId);
      if (!leftNode || !rightNode) {
        return left.nodeId.localeCompare(right.nodeId);
      }
      return (
        leftNode.path.localeCompare(rightNode.path) ||
        leftNode.range.lineStart - rightNode.range.lineStart ||
        leftNode.id.localeCompare(rightNode.id)
      );
    })
    .slice(0, limit);

  return { normalizedQuery, candidates };
}
