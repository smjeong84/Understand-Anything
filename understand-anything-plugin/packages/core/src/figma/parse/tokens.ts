import type { GraphNode, GraphEdge, FigmaMeta } from "../../types.js";
import type { FigmaDocument, FigmaNode, FigmaStyles } from "../source/types.js";

const STYLE_KIND: Record<string, NonNullable<FigmaMeta["tokenKind"]>> = {
  FILL: "color", TEXT: "type", EFFECT: "effect", GRID: "grid",
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function extractTokens(
  doc: FigmaDocument,
  styles: FigmaStyles,
  structuralNodes: GraphNode[],
  fileKey: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const tokenByStyleKey = new Map<string, string>();

  // Only published styles/variables become token nodes (bounded set).
  for (const s of styles.meta?.styles ?? []) {
    const kind = STYLE_KIND[s.style_type] ?? "color";
    const id = `token:${kind}:${slug(s.name)}`;
    if (!tokenByStyleKey.has(s.key)) tokenByStyleKey.set(s.key, id);
    if (!nodes.some((n) => n.id === id)) {
      nodes.push({
        id, type: "token", name: s.name, summary: s.name,
        tags: ["token", kind], complexity: "simple",
        figmaMeta: { fileKey, tokenKind: kind },
      });
    }
  }

  const graphIdByFigmaId = new Map<string, string>();
  for (const n of structuralNodes) {
    if (n.figmaMeta?.nodeId) graphIdByFigmaId.set(n.figmaMeta.nodeId, n.id);
  }

  const usesSeen = new Set<string>();
  function walk(n: FigmaNode) {
    const consumerId = graphIdByFigmaId.get(n.id);
    if (consumerId && n.styles) {
      for (const styleKey of Object.values(n.styles)) {
        const tokenId = tokenByStyleKey.get(styleKey);
        if (tokenId) {
          const dedupe = `${consumerId}|${tokenId}`;
          if (!usesSeen.has(dedupe)) {
            usesSeen.add(dedupe);
            edges.push({ source: consumerId, target: tokenId, type: "uses_token", direction: "forward", weight: 0.5 });
          }
        }
      }
    }
    for (const c of n.children ?? []) walk(c);
  }
  walk(doc.document);

  return { nodes, edges };
}
