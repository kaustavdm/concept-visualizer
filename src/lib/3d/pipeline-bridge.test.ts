// src/lib/3d/pipeline-bridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createPipelineBridge } from './pipeline-bridge';

describe('PipelineBridge', () => {
	it('calls extractor then mode renderer', async () => {
		const mockSchema = {
			type: 'graph' as const,
			title: 'Test',
			description: 'Test',
			nodes: [{ id: 'a', label: 'A' }],
			edges: [],
			metadata: { concepts: [], relationships: [] },
		};

		const mockExtract = vi.fn().mockResolvedValue(mockSchema);
		const mockRender = vi.fn().mockReturnValue([]);

		const bridge = createPipelineBridge(
			{ extract: mockExtract },
			{
				getMode: () => ({
					id: 'graph',
					name: 'Graph',
					description: '',
					render: mockRender,
				}),
			},
		);

		await bridge.process('test text', 'graph', { theme: 'light' });

		expect(mockExtract).toHaveBeenCalledWith('test text', null);
		expect(mockRender).toHaveBeenCalledWith(
			mockSchema,
			expect.objectContaining({ theme: 'light' }),
		);
	});

	it('returns layers from mode renderer', async () => {
		const mockLayers = [
			{
				id: 'l1',
				name: 'Test',
				visible: true,
				entities: [],
				text: '',
				position: 'n',
				source: { type: 'manual' as const },
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		];
		const mockSchema = {
			type: 'graph' as const,
			title: 'Test',
			description: 'Test',
			nodes: [],
			edges: [],
			metadata: { concepts: [], relationships: [] },
		};

		const bridge = createPipelineBridge(
			{ extract: vi.fn().mockResolvedValue(mockSchema) },
			{
				getMode: () => ({
					id: 'graph',
					name: 'Graph',
					description: '',
					render: () => mockLayers,
				}),
			},
		);

		const result = await bridge.process('some text', 'graph', { theme: 'dark' });
		expect(result).toEqual(mockLayers);
	});

	it('throws if mode not found', async () => {
		const bridge = createPipelineBridge(
			{ extract: vi.fn() },
			{ getMode: () => undefined },
		);

		await expect(bridge.process('text', 'unknown', { theme: 'light' })).rejects.toThrow();
	});
});
