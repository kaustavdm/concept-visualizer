import type { VisualizationSchema, VisualizationNode, VisualizationEdge } from '$lib/types';
import type { ConceptExtractor } from './types';

// Common English stopwords for RAKE filtering
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom', 'how', 'when', 'where', 'why', 'not', 'no', 'nor',
  'if', 'then', 'else', 'so', 'as', 'than', 'too', 'very', 'just',
  'about', 'above', 'after', 'again', 'all', 'also', 'am', 'any',
  'because', 'before', 'between', 'both', 'each', 'few', 'get',
  'got', 'here', 'into', 'more', 'most', 'much', 'must', 'new',
  'now', 'off', 'old', 'once', 'only', 'other', 'over', 'own',
  'same', 'some', 'still', 'such', 'take', 'there', 'through',
  'under', 'up', 'while', 'come', 'comes', 'go', 'goes', 'make',
  'makes', 'made'
]);

/** Split text into sentences */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Tokenize a sentence into lowercase words */
function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/** Extract candidate keyword phrases from a sentence */
function extractPhrases(words: string[]): string[][] {
  const phrases: string[][] = [];
  let current: string[] = [];

  for (const word of words) {
    if (STOPWORDS.has(word)) {
      if (current.length > 0) {
        phrases.push([...current]);
        current = [];
      }
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) {
    phrases.push(current);
  }

  return phrases;
}

/** Score phrases using RAKE: sum of word degree / word frequency */
function scorePhrases(sentences: string[][]): Map<string, number> {
  const wordFreq = new Map<string, number>();
  const wordDegree = new Map<string, number>();

  // Collect all phrases from all sentences
  const allPhrases: string[][] = [];
  for (const words of sentences) {
    const phrases = extractPhrases(words);
    allPhrases.push(...phrases);
  }

  // Calculate word frequency and degree
  for (const phrase of allPhrases) {
    const degree = phrase.length - 1;
    for (const word of phrase) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      wordDegree.set(word, (wordDegree.get(word) ?? 0) + degree);
    }
  }

  // Score each phrase
  const phraseScores = new Map<string, number>();
  for (const phrase of allPhrases) {
    const key = phrase.join(' ');
    if (phraseScores.has(key)) continue;

    let score = 0;
    for (const word of phrase) {
      const freq = wordFreq.get(word) ?? 1;
      const deg = wordDegree.get(word) ?? 0;
      score += (deg + freq) / freq;
    }
    phraseScores.set(key, score);
  }

  return phraseScores;
}

/** Build co-occurrence edges from sentences */
function buildCoOccurrence(sentences: string[][], phraseKeys: Set<string>): Map<string, number> {
  const coOccurrence = new Map<string, number>();

  for (const words of sentences) {
    const phrases = extractPhrases(words);
    const keys = phrases.map(p => p.join(' ')).filter(k => phraseKeys.has(k));

    // Every pair of phrases in the same sentence co-occurs
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const edgeKey = [keys[i], keys[j]].sort().join('|||');
        coOccurrence.set(edgeKey, (coOccurrence.get(edgeKey) ?? 0) + 1);
      }
    }
  }

  return coOccurrence;
}

export class RAKEExtractor implements ConceptExtractor {
  id = 'keywords';
  name = 'Keywords (RAKE)';

  async extract(text: string): Promise<VisualizationSchema> {
    const sentences = splitSentences(text);
    if (sentences.length === 0) {
      return {
        type: 'graph',
        title: 'Keywords',
        description: 'No content to analyze',
        nodes: [],
        edges: [],
        metadata: { concepts: [], relationships: [] }
      };
    }

    // Tokenize each sentence
    const tokenizedSentences = sentences.map(tokenize);

    // Score phrases
    const phraseScores = scorePhrases(tokenizedSentences);

    // Take top phrases as nodes (max 15)
    const sorted = [...phraseScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const phraseKeys = new Set(sorted.map(([key]) => key));

    // Build nodes
    const nodes: VisualizationNode[] = sorted.map(([phrase], i) => ({
      id: `kw-${i}`,
      label: phrase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: 'concept',
      details: `Score: ${sorted[i][1].toFixed(1)}`
    }));

    // Map phrase keys to node IDs
    const phraseToId = new Map<string, string>();
    sorted.forEach(([phrase], i) => {
      phraseToId.set(phrase, `kw-${i}`);
    });

    // Build edges from co-occurrence
    const coOccurrence = buildCoOccurrence(tokenizedSentences, phraseKeys);
    const edges: VisualizationEdge[] = [];
    for (const [edgeKey, count] of coOccurrence) {
      const [a, b] = edgeKey.split('|||');
      const sourceId = phraseToId.get(a);
      const targetId = phraseToId.get(b);
      if (sourceId && targetId) {
        edges.push({
          source: sourceId,
          target: targetId,
          label: `co-occurs (${count})`,
          type: 'relates'
        });
      }
    }

    const concepts = nodes.map(n => n.label);
    const relationships = edges.map(e => {
      const src = nodes.find(n => n.id === e.source)?.label ?? e.source;
      const tgt = nodes.find(n => n.id === e.target)?.label ?? e.target;
      return `${src} ${e.label} ${tgt}`;
    });

    return {
      type: 'graph',
      title: concepts.slice(0, 3).join(', '),
      description: `Keyword extraction from ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}`,
      nodes,
      edges,
      metadata: { concepts, relationships }
    };
  }
}
