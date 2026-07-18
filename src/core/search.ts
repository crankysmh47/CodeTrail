import type { CodeEdge, CodeEdgeKind, CodeNode, SearchCandidate, SearchResult, WorkspaceIndex } from './contracts.js';

const stopWords = new Set(['a', 'an', 'and', 'does', 'for', 'how', 'is', 'of', 'the', 'to', 'what', 'whether']);
const synonyms: Readonly<Record<string, string>> = {
  called: 'call',
  caller: 'call',
  callers: 'call',
  calls: 'call',
  choose: 'pick',
  chooses: 'pick',
  choosing: 'pick',
  dispatched: 'dispatch',
  dispatches: 'dispatch',
  dispatching: 'dispatch',
  eligibility: 'eligible',
  guarded: 'guard',
  guards: 'guard',
  reads: 'read',
  reading: 'read',
  registered: 'register',
  registers: 'register',
  registering: 'register',
  registration: 'register',
  schedule: 'sched',
  scheduled: 'sched',
  scheduler: 'sched',
  scheduling: 'sched',
  select: 'pick',
  selects: 'pick',
  selection: 'pick',
  writes: 'write',
  writing: 'write',
};
const relationshipIntent: Readonly<Record<string, CodeEdgeKind>> = {
  call: 'calls',
  dispatch: 'dispatches-to',
  guard: 'guarded-by',
  read: 'reads',
  register: 'registers',
  write: 'writes',
};
const relatedEdgeBoost: Readonly<Record<CodeEdgeKind, number>> = {
  calls: 0,
  'dispatches-to': 50,
  registers: 60,
  reads: 0,
  writes: 0,
  contains: 0,
  documents: 0,
  'guarded-by': 10,
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

function editDistanceOne(left: string, right: string): boolean {
  if (left === right || Math.abs(left.length - right.length) > 1) {
    return false;
  }
  if (left.length === right.length) {
    const differences: number[] = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        differences.push(index);
      }
    }
    if (
      differences.length === 2 &&
      differences[1] === differences[0]! + 1 &&
      left[differences[0]!] === right[differences[1]!] &&
      left[differences[1]!] === right[differences[0]!]
    ) {
      return true;
    }
  }
  const rows = left.length + 1;
  const columns = right.length + 1;
  const previous = Array.from({ length: columns }, (_, index) => index);
  for (let row = 1; row < rows; row += 1) {
    const current = [row];
    let rowMin = row;
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(current[column - 1]! + 1, previous[column]! + 1, previous[column - 1]! + cost);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > 1) {
      return false;
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] === 1;
}

function typoMatches(nodeTokens: readonly string[], queryTokens: readonly string[]): readonly [string, string][] {
  const matches: Array<[string, string]> = [];
  for (const queryToken of queryTokens) {
    if (queryToken.length < 4 || nodeTokens.includes(queryToken)) {
      continue;
    }
    const nodeToken = nodeTokens.find((candidate) => candidate.length >= 4 && editDistanceOne(queryToken, candidate));
    if (nodeToken) {
      matches.push([queryToken, nodeToken]);
    }
  }
  return matches;
}

function takePathDiverse(
  candidates: readonly SearchCandidate[],
  count: number,
  nodesById: ReadonlyMap<string, CodeNode>,
): readonly SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const selectedIds = new Set<string>();
  const pathCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const path = nodesById.get(candidate.nodeId)?.path ?? '';
    const pathCount = pathCounts.get(path) ?? 0;
    if (pathCount >= 2) {
      continue;
    }
    selected.push(candidate);
    selectedIds.add(candidate.nodeId);
    pathCounts.set(path, pathCount + 1);
    if (selected.length >= count) {
      return selected;
    }
  }
  for (const candidate of candidates) {
    if (selectedIds.has(candidate.nodeId)) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= count) {
      break;
    }
  }
  return selected;
}

function scoreRelationships(node: CodeNode, edges: readonly CodeEdge[], queryTokens: readonly string[]): SearchCandidate {
  const reasons: string[] = [];
  let score = 0;
  for (const token of queryTokens) {
    const kind = relationshipIntent[token];
    if (!kind) {
      continue;
    }
    const outgoing = edges.some((edge) => edge.kind === kind && edge.sourceId === node.id);
    const incoming = edges.some((edge) => edge.kind === kind && edge.targetId === node.id);
    if (outgoing) {
      score += 80;
      reasons.push(`relationship source: ${kind}`);
    } else if (incoming) {
      score += 10;
      reasons.push(`relationship target: ${kind}`);
    }
  }
  if (score > 0 && node.kind === 'function') {
    score += 5;
  }
  return { nodeId: node.id, score, reasons };
}

function scoreNode(
  node: CodeNode,
  edges: readonly CodeEdge[],
  queryTokens: readonly string[],
): SearchCandidate | undefined {
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

  const fuzzyMatches = typoMatches(node.tokens, queryTokens);
  for (const [queryToken, nodeToken] of fuzzyMatches) {
    score += 14;
    reasons.push(`identifier typo: ${queryToken} → ${nodeToken}`);
  }

  const relationship = scoreRelationships(node, edges, queryTokens);
  score += relationship.score;
  reasons.push(...relationship.reasons);

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

  const nodesById = new Map<string, CodeNode>();
  for (const node of index.nodes) {
    if (!nodesById.has(node.id)) {
      nodesById.set(node.id, node);
    }
  }
  const directCandidates = [...nodesById.values()]
    .map((node) => scoreNode(node, index.edges, queryTokens))
    .filter((candidate): candidate is SearchCandidate => candidate !== undefined);
  const directById = new Map(directCandidates.map((candidate) => [candidate.nodeId, candidate]));
  const relatedById = new Map<string, { score: number; reasons: string[] }>();
  for (const edge of [...index.edges].sort((left, right) => left.id.localeCompare(right.id))) {
    const sourceMatch = directById.get(edge.sourceId);
    const targetMatch = directById.get(edge.targetId);
    const matched = sourceMatch ?? targetMatch;
    const relatedId = sourceMatch ? edge.targetId : targetMatch ? edge.sourceId : '';
    if (!matched || relatedId.length === 0 || directById.has(relatedId)) {
      continue;
    }
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    if (!source || !target) {
      continue;
    }
    const reason = `related via ${edge.kind}: ${source.name} → ${target.name}`;
    const relatedScore = Math.max(1, Math.floor(matched.score / 4)) + relatedEdgeBoost[edge.kind];
    const existing = relatedById.get(relatedId);
    if (existing) {
      existing.score = Math.max(existing.score, relatedScore);
      if (!existing.reasons.includes(reason)) {
        existing.reasons.push(reason);
      }
    } else {
      relatedById.set(relatedId, {
        score: relatedScore,
        reasons: [reason],
      });
    }
  }
  const compareCandidates = (left: SearchCandidate, right: SearchCandidate): number => {
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
  };
  const sortedDirect = [...directCandidates].sort(compareCandidates);
  const sortedRelated = [...relatedById.entries()]
    .map(([nodeId, candidate]): SearchCandidate => ({ nodeId, ...candidate }))
    .sort(compareCandidates);
  let candidates: readonly SearchCandidate[];
  if (queryTokens.length === 1 && sortedDirect.length >= limit && sortedRelated.length > 0) {
    const relatedCount = Math.min(sortedRelated.length, limit - 1, Math.ceil(limit / 3));
    candidates = [
      ...takePathDiverse(sortedDirect, limit - relatedCount, nodesById),
      ...takePathDiverse(sortedRelated, relatedCount, nodesById),
    ];
  } else {
    candidates = [...sortedDirect, ...sortedRelated].slice(0, limit);
  }

  return { normalizedQuery, candidates };
}
