import { describe, it, expectTypeOf } from 'vitest';
import type { VisualizationType, VisualizationNode, VisualizationEdge, VisualizationSchema, ConceptFile } from './types';

describe('extended types', () => {
  it('VisualizationType includes logicalflow and storyboard', () => {
    const t1: VisualizationType = 'logicalflow';
    const t2: VisualizationType = 'storyboard';
    expectTypeOf(t1).toEqualTypeOf<VisualizationType>();
    expectTypeOf(t2).toEqualTypeOf<VisualizationType>();
  });

  it('VisualizationNode accepts logicalRole and storyRole', () => {
    const n: VisualizationNode = {
      id: 'a', label: 'A',
      logicalRole: 'premise',
      storyRole: 'scene'
    };
    expectTypeOf(n.logicalRole).toEqualTypeOf<'premise' | 'inference' | 'conclusion' | 'evidence' | 'objection' | undefined>();
    expectTypeOf(n.storyRole).toEqualTypeOf<'scene' | 'event' | 'conflict' | 'resolution' | undefined>();
  });

  it('VisualizationSchema accepts renderOptions', () => {
    const s: Pick<VisualizationSchema, 'renderOptions'> = {
      renderOptions: { orientation: 'vertical' }
    };
    expectTypeOf(s.renderOptions?.orientation).toEqualTypeOf<'horizontal' | 'vertical' | undefined>();
  });

  it('ConceptFile accepts cachedSchemas', () => {
    const f: Pick<ConceptFile, 'cachedSchemas'> = {
      cachedSchemas: {
        logicalflow: { schema: {} as any, contentHash: 'abc' }
      }
    };
    expectTypeOf(f.cachedSchemas).not.toBeUndefined();
  });
});
