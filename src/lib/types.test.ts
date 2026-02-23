import { describe, it, expect } from 'vitest';
import type { VisualizationNode, VisualizationSchema, VisualizationType } from './types';

describe('extended types', () => {
  it('VisualizationType includes logicalflow and storyboard', () => {
    // Compile-time: assigning these values confirms they are in the union.
    // Runtime: verify the list of valid types is complete.
    const all: VisualizationType[] = ['graph', 'tree', 'flowchart', 'hierarchy', 'logicalflow', 'storyboard'];
    expect(all).toContain('logicalflow');
    expect(all).toContain('storyboard');
    expect(all).toHaveLength(6);
  });

  it('VisualizationNode accepts logicalRole and storyRole', () => {
    // Compile-time check: TypeScript errors here if the fields don't exist.
    const n: VisualizationNode = {
      id: 'a',
      label: 'A',
      logicalRole: 'premise',
      storyRole: 'scene'
    };
    expect(n.logicalRole).toBe('premise');
    expect(n.storyRole).toBe('scene');
  });

  it('VisualizationSchema accepts renderOptions', () => {
    const schema: Partial<VisualizationSchema> = {
      renderOptions: { orientation: 'vertical' }
    };
    expect(schema.renderOptions?.orientation).toBe('vertical');
  });

  it('VisualizationNode accepts modeRole field', () => {
    const node: VisualizationNode = {
      id: 'n1',
      label: 'Test',
      modeRole: 'agent',
    };
    expect(node.modeRole).toBe('agent');
  });

});
