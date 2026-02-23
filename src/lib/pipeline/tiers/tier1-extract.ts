/**
 * Tier 1 — Pure JS concept extraction (<50ms, no API calls).
 *
 * Combines RAKE keyword extraction, compromise NLP noun phrases,
 * TF-IDF weighting, and co-occurrence / SVO edges to produce
 * 5-15 nodes with weights and edges from raw text.
 */
import nlp from 'compromise';
import type {
  VisualizationSchema,
  VisualizationNode,
  VisualizationEdge,
} from '$lib/types';
import type { TierFn } from './types';
import { analyzeText, topRecommendation } from '../analyzer';

// ---------------------------------------------------------------------------
// Stopwords (shared RAKE set — copied from extractors/keywords.ts)
// ---------------------------------------------------------------------------
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
  'makes', 'made',
]);

// ---------------------------------------------------------------------------
// Sentence splitting & tokenization
// ---------------------------------------------------------------------------

/** Split text into sentences using regex. */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenize a sentence into lowercase words. */
function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// ---------------------------------------------------------------------------
// RAKE helpers
// ---------------------------------------------------------------------------

/** Extract candidate keyword phrases from tokenized words. */
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

/** Score phrases using RAKE: sum(word_degree + word_freq) / word_freq. */
function scorePhrases(
  tokenizedSentences: string[][],
): Map<string, number> {
  const wordFreq = new Map<string, number>();
  const wordDegree = new Map<string, number>();

  const allPhrases: string[][] = [];
  for (const words of tokenizedSentences) {
    const phrases = extractPhrases(words);
    allPhrases.push(...phrases);
  }

  for (const phrase of allPhrases) {
    const degree = phrase.length - 1;
    for (const word of phrase) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      wordDegree.set(word, (wordDegree.get(word) ?? 0) + degree);
    }
  }

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

// ---------------------------------------------------------------------------
// Compromise NLP helpers
// ---------------------------------------------------------------------------

interface NlpNoun {
  label: string;
  key: string;
  sentences: number[];
}

/** Extract nouns/noun-phrases via compromise, keyed by lowercased form. */
function extractNlpNouns(
  text: string,
  sentences: string[],
): Map<string, NlpNoun> {
  const nodeMap = new Map<string, NlpNoun>();
  const doc = nlp(text);
  const sentTexts =
    sentences.length > 0 ? sentences : (doc.sentences().out('array') as string[]);

  sentTexts.forEach((sentence, sentIdx) => {
    const sentDoc = nlp(sentence);
    const nouns = sentDoc.nouns().out('array') as string[];

    for (const noun of nouns) {
      const key = noun.toLowerCase().trim();
      if (key.length < 2) continue;

      const existing = nodeMap.get(key);
      if (existing) {
        existing.sentences.push(sentIdx);
      } else {
        nodeMap.set(key, {
          label: noun.trim(),
          key,
          sentences: [sentIdx],
        });
      }
    }
  });

  return nodeMap;
}

/** Extract SVO (subject-verb-object) edges from sentences via compromise. */
function extractSvoEdges(
  sentences: string[],
  keyToId: Map<string, string>,
): VisualizationEdge[] {
  const edges: VisualizationEdge[] = [];
  const edgeSet = new Set<string>();

  for (const sentence of sentences) {
    const sentDoc = nlp(sentence);
    const verbs = sentDoc.verbs().out('array') as string[];
    const nouns = sentDoc.nouns().out('array') as string[];

    const sentNodeKeys = nouns
      .map((n) => n.toLowerCase().trim())
      .filter((k) => keyToId.has(k));

    // Connect consecutive noun pairs with the first verb in the sentence
    for (let i = 0; i < sentNodeKeys.length - 1; i++) {
      const sourceId = keyToId.get(sentNodeKeys[i])!;
      const targetId = keyToId.get(sentNodeKeys[i + 1])!;
      if (sourceId === targetId) continue;

      const edgeKey = `${sourceId}->${targetId}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      edges.push({
        source: sourceId,
        target: targetId,
        label: verbs[0] ?? 'relates to',
        type: 'relates',
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// TF-IDF
// ---------------------------------------------------------------------------

/**
 * Compute TF-IDF scores for a set of terms across sentences.
 * Returns scores normalized to 0-1 range.
 */
function computeTfIdf(
  tokenizedSentences: string[][],
  terms: string[],
): Map<string, number> {
  const numDocs = tokenizedSentences.length;
  if (numDocs === 0) return new Map();

  // Flatten all words for corpus-level term frequency
  const allWords = tokenizedSentences.flat();
  const totalWords = allWords.length;
  if (totalWords === 0) return new Map();

  // Term frequency: count of term in whole corpus / total words
  const termCounts = new Map<string, number>();
  for (const w of allWords) {
    termCounts.set(w, (termCounts.get(w) ?? 0) + 1);
  }

  // Document frequency: number of sentences containing each term
  const docFreq = new Map<string, number>();
  for (const term of terms) {
    // A term (potentially multi-word) may contain several tokens
    const tokens = term.split(' ');
    let df = 0;
    for (const sent of tokenizedSentences) {
      const sentStr = sent.join(' ');
      if (tokens.every((t) => sentStr.includes(t))) {
        df++;
      }
    }
    docFreq.set(term, df);
  }

  // TF-IDF per term
  const raw = new Map<string, number>();
  let maxScore = 0;
  for (const term of terms) {
    const tokens = term.split(' ');
    // TF = sum of token frequencies / total words
    let tf = 0;
    for (const t of tokens) {
      tf += (termCounts.get(t) ?? 0) / totalWords;
    }
    // IDF = log(N / (1 + df))
    const df = docFreq.get(term) ?? 0;
    const idf = Math.log((numDocs + 1) / (1 + df));
    const score = tf * idf;
    raw.set(term, score);
    if (score > maxScore) maxScore = score;
  }

  // Normalize to 0-1
  const normalized = new Map<string, number>();
  for (const [term, score] of raw) {
    normalized.set(term, maxScore > 0 ? score / maxScore : 0);
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Co-occurrence edges
// ---------------------------------------------------------------------------

/** Build co-occurrence edges from sentences. Returns edge key → count. */
function buildCoOccurrence(
  tokenizedSentences: string[][],
  phraseKeys: Set<string>,
): Map<string, number> {
  const coOccurrence = new Map<string, number>();

  for (const words of tokenizedSentences) {
    const phrases = extractPhrases(words);
    const keys = phrases
      .map((p) => p.join(' '))
      .filter((k) => phraseKeys.has(k));

    // De-dup within sentence
    const unique = [...new Set(keys)];

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const edgeKey = [unique[i], unique[j]].sort().join('|||');
        coOccurrence.set(edgeKey, (coOccurrence.get(edgeKey) ?? 0) + 1);
      }
    }
  }

  return coOccurrence;
}

// ---------------------------------------------------------------------------
// Merge & dedup
// ---------------------------------------------------------------------------

interface Candidate {
  label: string;
  key: string;
  score: number;
}

/**
 * Fuzzy dedup: if one label is a substring of another, merge them
 * (keep the shorter label, sum scores).
 */
function dedup(candidates: Candidate[]): Candidate[] {
  // Sort by label length ascending so shorter labels come first
  const sorted = [...candidates].sort(
    (a, b) => a.key.length - b.key.length,
  );
  const merged: Candidate[] = [];

  for (const c of sorted) {
    const existing = merged.find(
      (m) => m.key.includes(c.key) || c.key.includes(m.key),
    );
    if (existing) {
      existing.score += c.score;
      // Keep the shorter label
      if (c.key.length < existing.key.length) {
        existing.label = c.label;
        existing.key = c.key;
      }
    } else {
      merged.push({ ...c });
    }
  }

  return merged;
}

/** Capitalize each word. */
function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Main tier 1 function
// ---------------------------------------------------------------------------

function emptyResult(): VisualizationSchema {
  return {
    type: 'graph',
    title: '',
    description: '',
    nodes: [],
    edges: [],
    metadata: { concepts: [], relationships: [] },
  };
}

export const tier1Extract: TierFn = async (_schema, ctx) => {
  const { text } = ctx;
  if (!text.trim()) return emptyResult();

  ctx.onStage('tier1-extracting');

  // 1. Split sentences
  const sentences = splitSentences(text);
  if (sentences.length === 0) return emptyResult();

  const tokenizedSentences = sentences.map(tokenize);

  // 2. RAKE extraction → scored phrases
  const rakeScores = scorePhrases(tokenizedSentences);

  // 3. Compromise NLP → nouns
  const nlpNouns = extractNlpNouns(text, sentences);

  // 4. Merge RAKE phrases + NLP nouns into unified candidate list
  const candidateMap = new Map<string, Candidate>();

  // Add RAKE phrases
  for (const [phrase, score] of rakeScores) {
    candidateMap.set(phrase, {
      label: titleCase(phrase),
      key: phrase,
      score,
    });
  }

  // Merge NLP nouns (add their score or create new candidates)
  for (const [key, noun] of nlpNouns) {
    const existing = candidateMap.get(key);
    if (existing) {
      // Boost: NLP confirmed this is a noun phrase
      existing.score += noun.sentences.length;
    } else {
      candidateMap.set(key, {
        label: noun.label,
        key,
        score: noun.sentences.length,
      });
    }
  }

  // 5. Dedup, sort, cap at 15
  let candidates = dedup([...candidateMap.values()]);
  candidates.sort((a, b) => b.score - a.score);
  candidates = candidates.slice(0, 15);

  if (candidates.length === 0) return emptyResult();

  // 6. TF-IDF weighting → node weights (0-1)
  const tfidfScores = computeTfIdf(
    tokenizedSentences,
    candidates.map((c) => c.key),
  );

  // Build nodes
  const nodes: VisualizationNode[] = candidates.map((c, i) => ({
    id: `t1-${i}`,
    label: titleCase(c.label),
    weight: tfidfScores.get(c.key) ?? 0,
  }));

  // Build key → nodeId mapping
  const keyToId = new Map<string, string>();
  candidates.forEach((c, i) => {
    keyToId.set(c.key, `t1-${i}`);
  });

  // Also map NLP noun keys to node IDs (for SVO edge extraction)
  for (const [nlpKey] of nlpNouns) {
    if (keyToId.has(nlpKey)) continue;
    // Check if this NLP key is a substring of any candidate
    for (const c of candidates) {
      if (c.key.includes(nlpKey) || nlpKey.includes(c.key)) {
        const id = keyToId.get(c.key);
        if (id) {
          keyToId.set(nlpKey, id);
          break;
        }
      }
    }
  }

  // 7. Co-occurrence edges
  const phraseKeys = new Set(candidates.map((c) => c.key));
  const coOcc = buildCoOccurrence(tokenizedSentences, phraseKeys);
  const maxCoOcc = Math.max(1, ...coOcc.values());

  const edges: VisualizationEdge[] = [];
  const edgeSet = new Set<string>();

  for (const [edgeKey, count] of coOcc) {
    const [a, b] = edgeKey.split('|||');
    const sourceId = keyToId.get(a);
    const targetId = keyToId.get(b);
    if (sourceId && targetId && sourceId !== targetId) {
      const sortedKey = [sourceId, targetId].sort().join('->');
      if (!edgeSet.has(sortedKey)) {
        edgeSet.add(sortedKey);
        edges.push({
          source: sourceId,
          target: targetId,
          label: 'co-occurs',
          type: 'relates',
          strength: count / maxCoOcc,
        });
      }
    }
  }

  // 8. SVO edges from compromise
  const svoEdges = extractSvoEdges(sentences, keyToId);
  for (const edge of svoEdges) {
    const sortedKey = [edge.source, edge.target].sort().join('->');
    if (!edgeSet.has(sortedKey)) {
      edgeSet.add(sortedKey);
      edges.push({
        ...edge,
        strength: 0.5, // Default strength for SVO edges
      });
    }
  }

  // 9. Signal-word viz type detection
  const scores = analyzeText(text);
  const { type: vizType } = topRecommendation(scores);

  // 10. Assemble schema
  const concepts = nodes.map((n) => n.label);
  const relationships = edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source)?.label ?? e.source;
    const tgt = nodes.find((n) => n.id === e.target)?.label ?? e.target;
    return `${src} ${e.label ?? 'relates to'} ${tgt}`;
  });

  const title = concepts.slice(0, 3).join(', ');
  const description = `${concepts.length} concepts from ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}`;

  ctx.onStage('tier1-complete');

  return {
    type: vizType,
    title,
    description,
    nodes,
    edges,
    metadata: { concepts, relationships },
  };
};
