import { describe, it, expect } from 'vitest';
import { analyzeText } from './analyzer';

describe('analyzeText', () => {
  it('returns scores for all 6 viz types', () => {
    const scores = analyzeText('Some sample text about things.');
    expect(Object.keys(scores)).toHaveLength(6);
    expect(scores).toHaveProperty('graph');
    expect(scores).toHaveProperty('tree');
    expect(scores).toHaveProperty('flowchart');
    expect(scores).toHaveProperty('hierarchy');
    expect(scores).toHaveProperty('logicalflow');
    expect(scores).toHaveProperty('storyboard');
  });

  it('all scores are between 0 and 1', () => {
    const scores = analyzeText('First, we gather data. Then, we analyze it. Next, we report findings. Finally, we make decisions.');
    for (const score of Object.values(scores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('ranks flowchart highest for sequential text', () => {
    const text = 'First, gather the requirements. Then, design the solution. Next, implement the code. After that, test the code. Finally, deploy to production.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('flowchart');
  });

  it('ranks tree highest for taxonomic text', () => {
    const text = 'A dog is a type of mammal. A cat is a kind of mammal. A mammal is a type of animal. A reptile is a kind of animal. A snake is a subclass of reptile.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('tree');
  });

  it('ranks hierarchy highest for containment text', () => {
    const text = 'The library contains fiction and non-fiction sections. Fiction includes novels and short stories. Non-fiction comprises biographies and textbooks. Each section consists of multiple shelves.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('hierarchy');
  });

  it('ranks logicalflow highest for argument text', () => {
    const text = 'Because the climate is warming, therefore sea levels are rising. However, some regions may experience cooling. The evidence suggests that carbon emissions are the primary cause. We can conclude that action is needed.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('logicalflow');
  });

  it('ranks storyboard highest for narrative text', () => {
    const text = 'In the first scene, Alice enters the room. Meanwhile, Bob is waiting outside. The conflict arises when they disagree about the plan. The resolution comes when they find common ground in the final scene.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('storyboard');
  });

  it('returns graph as default for unstructured text', () => {
    const text = 'Machine learning is connected to data science. Natural language processing relates to artificial intelligence. Computer vision shares methods with pattern recognition.';
    const scores = analyzeText(text);
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    expect(entries[0][0]).toBe('graph');
  });

  it('handles empty text without throwing', () => {
    const scores = analyzeText('');
    expect(scores.graph).toBeGreaterThanOrEqual(0);
  });
});
