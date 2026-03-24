/**
 * Pipeline Controller — manages pipeline lifecycle and cancellation.
 * 
 * Uses AbortController to signal cancellation to the extraction loop.
 * The extraction loop checks the signal before each chunk.
 */

import { supabase } from './supabase';

interface PipelineRun {
  runId: string;
  projectId: string;
  controller: AbortController;
}

class PipelineController {
  private activeRun: PipelineRun | null = null;

  /**
   * Register a new pipeline run.
   * Returns the AbortSignal that the extraction loop should check.
   */
  register(runId: string, projectId: string): AbortSignal {
    // Cancel any existing run first
    if (this.activeRun) {
      console.warn('[PipelineController] Cancelling previous run before starting new one.');
      this.activeRun.controller.abort();
    }

    const controller = new AbortController();
    this.activeRun = { runId, projectId, controller };
    console.log(`[PipelineController] Registered run ${runId} for project ${projectId}`);
    return controller.signal;
  }

  /**
   * Cancel the currently active pipeline run.
   * Updates DB status to 'cancelled' and project status to 'draft'.
   */
  async cancel(): Promise<void> {
    if (!this.activeRun) {
      console.warn('[PipelineController] No active run to cancel.');
      return;
    }

    const { runId, projectId, controller } = this.activeRun;
    console.log(`[PipelineController] Cancelling run ${runId}`);

    // Signal abort to the extraction loop
    controller.abort();

    try {
      // Mark run as cancelled in DB
      await supabase.from('extraction_runs').update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      }).eq('id', runId);

      // Reset project status to 'draft' so user can restart
      await supabase.from('projects').update({
        status: 'draft',
      }).eq('id', projectId);

      // Log the cancellation
      await supabase.from('agent_logs').insert({
        extraction_run_id: runId,
        agent_name: 'Coordinator Agent',
        message: 'Pipeline cancelled by user. Partial data has been preserved.',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[PipelineController] Error updating cancellation status:', err);
    }

    this.activeRun = null;
  }

  /**
   * Check if there is an active run.
   */
  isRunning(): boolean {
    return this.activeRun !== null && !this.activeRun.controller.signal.aborted;
  }

  /**
   * Get the current run ID.
   */
  getActiveRunId(): string | null {
    return this.activeRun?.runId || null;
  }

  /**
   * Clear the active run reference (called when pipeline completes normally).
   */
  clear(): void {
    this.activeRun = null;
  }
}

// Singleton instance
export const pipelineController = new PipelineController();
