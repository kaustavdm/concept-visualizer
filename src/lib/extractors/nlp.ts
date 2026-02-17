import nlp from 'compromise';
import type { VisualizationSchema, VisualizationType, VisualizationNode, VisualizationEdge } from '$lib/types';
import type { ConceptExtractor } from './types';

// Sequential signal words
const SEQUENTIAL_SIGNALS = ['then', 'next', 'after', 'finally', 'first', 'second', 'third', 'subsequently', 'lastly'];
// Containment signal verbs/phrases
const CONTAINMENT_SIGNALS = ['includes', 'contains', 'consists of', 'comprises', 'is made of', 'is part of'];
// Hierarchical signals
const HIERARCHY_SIGNALS = ['is a', 'is an', 'are a', 'are an', 'type of', 'kind of', 'subclass of'];

function detectVizType(text: string, crossSentenceEdges: number, totalEdges: number): VisualizationType {
  const lower = text.toLowerCase();

  // Check for sequential signals
  const seqCount = SEQUENTIAL_SIGNALS.filter(s => lower.includes(s)).length;
  if (seqCount >= 2) return 'flowchart';

  // Check for containment signals
  const containCount = CONTAINMENT_SIGNALS.filter(s => lower.includes(s)).length;
  if (containCount >= 2) return 'hierarchy';

  // Check for is-a relationships
  const hierCount = HIERARCHY_SIGNALS.filter(s => lower.includes(s)).length;
  if (hierCount >= 2) return 'tree';

  // Default: many cross-sentence connections = graph
  if (crossSentenceEdges > 0 && crossSentenceEdges >= totalEdges * 0.3) return 'graph';

  return 'graph';
}

export class CompromiseExtractor implements ConceptExtractor {
  id = 'nlp';
  name = 'NLP (compromise)';

  async extract(text: string): Promise<VisualizationSchema> {
    if (!text.trim()) {
      return {
        type: 'graph',
        title: 'NLP Analysis',
        description: 'No content to analyze',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] }
      };
    }

    const doc = nlp(text);
    const sentences = doc.sentences().out('array') as string[];

    // Extract nouns and noun phrases as candidate nodes
    const nodeMap = new Map<string, { label: string; count: number; sentences: number[] }>();

    sentences.forEach((sentence, sentIdx) => {
      const sentDoc = nlp(sentence);

      // Get nouns and noun phrases
      const nouns = sentDoc.nouns().out('array') as string[];

      for (const noun of nouns) {
        const key = noun.toLowerCase().trim();
        if (key.length < 2) continue;

        const existing = nodeMap.get(key);
        if (existing) {
          existing.count++;
          existing.sentences.push(sentIdx);
        } else {
          nodeMap.set(key, {
            label: noun.trim(),
            count: 1,
            sentences: [sentIdx]
          });
        }
      }
    });

    // Take top nodes by frequency (max 15)
    const sortedNodes = [...nodeMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    const nodes: VisualizationNode[] = sortedNodes.map(([key], i) => ({
      id: `nlp-${i}`,
      label: nodeMap.get(key)!.label,
      type: 'concept',
      details: `Mentioned ${nodeMap.get(key)!.count} time(s)`
    }));

    // Build key-to-id mapping
    const keyToId = new Map<string, string>();
    sortedNodes.forEach(([key], i) => {
      keyToId.set(key, `nlp-${i}`);
    });

    // Extract edges from subject-verb-object patterns
    const edges: VisualizationEdge[] = [];
    const edgeSet = new Set<string>();
    let crossSentenceEdges = 0;

    sentences.forEach((sentence) => {
      const sentDoc = nlp(sentence);
      const verbs = sentDoc.verbs().out('array') as string[];

      // Find nouns in this sentence that are in our node set
      const sentNouns = sentDoc.nouns().out('array') as string[];
      const sentNodeKeys = sentNouns
        .map(n => n.toLowerCase().trim())
        .filter(k => keyToId.has(k));

      // Connect consecutive noun pairs in the sentence with the verb
      for (let i = 0; i < sentNodeKeys.length - 1; i++) {
        const sourceId = keyToId.get(sentNodeKeys[i])!;
        const targetId = keyToId.get(sentNodeKeys[i + 1])!;
        const edgeKey = `${sourceId}-${targetId}`;

        if (sourceId !== targetId && !edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: sourceId,
            target: targetId,
            label: verbs[0] ?? 'relates to',
            type: 'relates'
          });
        }
      }
    });

    // Check for cross-sentence connections (same noun in multiple sentences)
    for (const [key, data] of nodeMap) {
      if (data.sentences.length > 1 && keyToId.has(key)) {
        crossSentenceEdges++;
      }
    }

    const vizType = detectVizType(text, crossSentenceEdges, edges.length);

    const concepts = nodes.map(n => n.label);
    const relationships = edges.map(e => {
      const src = nodes.find(n => n.id === e.source)?.label ?? e.source;
      const tgt = nodes.find(n => n.id === e.target)?.label ?? e.target;
      return `${src} ${e.label} ${tgt}`;
    });

    return {
      type: vizType,
      title: concepts.slice(0, 3).join(', '),
      description: `NLP analysis of ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}`,
      nodes,
      edges,
      metadata: { concepts, relationships }
    };
  }
}
