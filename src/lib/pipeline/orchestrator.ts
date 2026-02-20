import { analyzeText, topRecommendation } from './analyzer';
import { pipelineStore } from './store';
import type { VisualizationType, AppSettings, VisualizationSchema } from '$lib/types';
import type { ExtractionEngineId } from '$lib/extractors/types';

interface ExtractorRegistryLike {
  getEngine(id: ExtractionEngineId): { extract(text: string, vizType?: VisualizationType | null): Promise<VisualizationSchema> };
}

export class RenderingPipeline {
  private registry: ExtractorRegistryLike;
  private getSettings: () => AppSettings;
  private abortController: AbortController | null = null;

  constructor(
    registry: ExtractorRegistryLike,
    getSettings: () => AppSettings
  ) {
    this.registry = registry;
    this.getSettings = getSettings;
  }

  async run(
    text: string,
    vizType: VisualizationType,
    engineId: ExtractionEngineId
  ): Promise<VisualizationSchema> {
    // Cancel any previous run
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    pipelineStore.reset();

    const settings = this.getSettings();

    try {
      // Stage 1: Analyze (auto mode only)
      if (settings.pipelineMode === 'auto') {
        pipelineStore.setStage('analyzing');
        this.checkAborted(signal);

        const scores = analyzeText(text);
        pipelineStore.setScores(scores);

        const rec = topRecommendation(scores);
        pipelineStore.setRecommendation(rec);
      }

      // Stage 2: Refine (auto + llmRefinement only) — placeholder for future LLM call
      if (settings.pipelineMode === 'auto' && settings.llmRefinement) {
        pipelineStore.setStage('refining');
        this.checkAborted(signal);
        // Future: send classification prompt to LLM with 2s timeout
        // For now, heuristic recommendation stands
      }

      // Stage 3: Extract
      pipelineStore.setStage('extracting');
      this.checkAborted(signal);

      const engine = this.registry.getEngine(engineId);
      const schema = await this.raceWithAbort(engine.extract(text, vizType), signal);

      // Stage 4: Render (signal to UI)
      pipelineStore.setStage('rendering');

      // Mark complete
      pipelineStore.setStage('complete');

      return schema;
    } catch (err) {
      if (err instanceof Error && err.message === 'Pipeline aborted') {
        pipelineStore.setStage('idle');
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown pipeline error';
      pipelineStore.setError(message);
      throw err;
    }
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private checkAborted(signal: AbortSignal): void {
    if (signal.aborted) throw new Error('Pipeline aborted');
  }

  private raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Pipeline aborted'));
        return;
      }
      const onAbort = () => reject(new Error('Pipeline aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      promise
        .then(result => {
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        })
        .catch(err => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        });
    });
  }
}
