import { describe, it, expect } from 'vitest';
import {
  buildThemePrompt,
  buildRolePrompt,
  buildEdgeLabelPrompt,
  buildDescriptionPrompt,
  parseFlatJson,
} from './micro-prompts';

describe('parseFlatJson', () => {
  it('parses valid JSON object', () => {
    expect(parseFlatJson('{"a": "hello"}')).toEqual({ a: 'hello' });
  });

  it('parses markdown-wrapped JSON', () => {
    expect(parseFlatJson('```json\n{"a": "hello"}\n```')).toEqual({ a: 'hello' });
  });

  it('parses markdown-wrapped JSON without language tag', () => {
    expect(parseFlatJson('```\n{"key": "val"}\n```')).toEqual({ key: 'val' });
  });

  it('returns null on invalid input', () => {
    expect(parseFlatJson('not json at all')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseFlatJson('"just a string"')).toBeNull();
  });

  it('returns null for JSON array', () => {
    expect(parseFlatJson('[1, 2, 3]')).toBeNull();
  });

  it('returns null for null JSON', () => {
    expect(parseFlatJson('null')).toBeNull();
  });

  it('handles surrounding whitespace', () => {
    expect(parseFlatJson('  \n  {"x": "y"}  \n  ')).toEqual({ x: 'y' });
  });
});

describe('buildThemePrompt', () => {
  it('includes title and cluster names with node labels', () => {
    const prompt = buildThemePrompt('Test Title', {
      'cluster-0': ['Node A', 'Node B'],
      'cluster-1': ['Node C'],
    });
    expect(prompt).toContain('Test Title');
    expect(prompt).toContain('cluster-0');
    expect(prompt).toContain('cluster-1');
    expect(prompt).toContain('Node A');
    expect(prompt).toContain('Node B');
    expect(prompt).toContain('Node C');
    expect(prompt).toContain('JSON');
  });

  it('asks for 1-3 word names', () => {
    const prompt = buildThemePrompt('X', { 'c-0': ['A'] });
    expect(prompt).toMatch(/1.?3 word/i);
  });
});

describe('buildRolePrompt', () => {
  it('includes mode roles and story focus', () => {
    const roles = [
      { id: 'core', label: 'Core', description: 'Main idea' },
      { id: 'supporting', label: 'Supporting', description: 'Detail' },
    ];
    const prompt = buildRolePrompt(
      ['Node A', 'Node B'],
      roles,
      'Classify by importance',
    );
    expect(prompt).toContain('core');
    expect(prompt).toContain('supporting');
    expect(prompt).toContain('Classify by importance');
    expect(prompt).toContain('Node A');
    expect(prompt).toContain('Node B');
    expect(prompt).toContain('JSON');
  });

  it('lists all role IDs with descriptions', () => {
    const roles = [
      { id: 'premise', label: 'Premise', description: 'Starting point' },
      { id: 'conclusion', label: 'Conclusion', description: 'End point' },
    ];
    const prompt = buildRolePrompt(['X'], roles, '');
    expect(prompt).toContain('premise');
    expect(prompt).toContain('conclusion');
    expect(prompt).toContain('Starting point');
    expect(prompt).toContain('End point');
  });
});

describe('buildEdgeLabelPrompt', () => {
  it('lists edge pairs', () => {
    const prompt = buildEdgeLabelPrompt([
      { source: 'A', target: 'B' },
      { source: 'C', target: 'D' },
    ]);
    expect(prompt).toContain('A');
    expect(prompt).toContain('B');
    expect(prompt).toContain('C');
    expect(prompt).toContain('D');
    expect(prompt).toContain('JSON');
  });

  it('uses arrow notation', () => {
    const prompt = buildEdgeLabelPrompt([{ source: 'X', target: 'Y' }]);
    // Should contain some arrow-like separator
    expect(prompt).toMatch(/X.*→.*Y|X.*->.*Y/);
  });

  it('asks for 2-4 word labels', () => {
    const prompt = buildEdgeLabelPrompt([{ source: 'A', target: 'B' }]);
    expect(prompt).toMatch(/2.?4 word/i);
  });
});

describe('buildDescriptionPrompt', () => {
  it('includes node labels', () => {
    const prompt = buildDescriptionPrompt(['Alpha', 'Beta', 'Gamma']);
    expect(prompt).toContain('Alpha');
    expect(prompt).toContain('Beta');
    expect(prompt).toContain('Gamma');
    expect(prompt).toContain('JSON');
  });

  it('asks for 1-sentence descriptions', () => {
    const prompt = buildDescriptionPrompt(['X']);
    expect(prompt).toMatch(/1.?sentence/i);
  });
});
