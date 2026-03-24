import { supabase } from './supabase';
import { extractFromChunk, generateSummary } from './ai-provider';
import { pipelineController } from './pipeline-controller';
import { rateLimiter } from './rate-limiter';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Config ───
const WORDS_PER_CHUNK = 20000;  // Increased to 20k words — Gemini 2.5 Flash has 1M context
const MAX_CHUNKS = 15;          // 15 chunks @ 20k words = 300k words capacity

async function logAgent(runId: string, agentName: string, message: string) {
  try {
    await supabase.from('agent_logs').insert({
      extraction_run_id: runId,
      agent_name: agentName,
      message,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Pipeline] Log failed (non-critical):', e);
  }
}

async function updateRun(runId: string, updates: any) {
  try {
    await supabase.from('extraction_runs').update(updates).eq('id', runId);
  } catch (e) {
    console.warn('[Pipeline] Run update failed:', e);
  }
}

/**
 * Split content into chunks of ~WORDS_PER_CHUNK words.
 * Respects paragraph boundaries when possible.
 */
function smartChunk(content: string): string[] {
  // Split by paragraph breaks first
  const paragraphs = content.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).length;

    // If a single paragraph exceeds the limit, split it by word count
    if (paraWords > WORDS_PER_CHUNK) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentWordCount = 0;
      }
      // Split the large paragraph
      const words = para.trim().split(/\s+/);
      for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
        chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
      }
      continue;
    }

    // Would adding this paragraph exceed the limit?
    if (currentWordCount + paraWords > WORDS_PER_CHUNK && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      currentWordCount = 0;
    }

    currentChunk += (currentChunk ? '\n\n' : '') + para.trim();
    currentWordCount += paraWords;
  }

  // Flush remaining
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Main extraction pipeline.
 * Called from Upload.tsx (which creates source + extraction_run first)
 * or from runPipeline() which creates them automatically.
 */
export async function runExtractionClientSide(
  projectId: string,
  sourceId: string,
  content: string,
  runId: string
) {
  // Register with pipeline controller for cancellation support
  const signal = pipelineController.register(runId, projectId);

  try {
    // ── Phase 1: Coordinator ──
    await logAgent(runId, 'Coordinator Agent', 'Pipeline started. Loading sources...');
    await updateRun(runId, { current_phase: 1, processed_chunks: 0 });
    await delay(800);

    // ── Phase 2: Parser ──
    await logAgent(runId, 'Parser Agent', 'Parsing documents into chunks...');
    await updateRun(runId, { current_phase: 2 });

    // Smart chunking — no arbitrary cap
    const allChunks = smartChunk(content);
    const chunksToProcess = allChunks.slice(0, MAX_CHUNKS);
    const totalChunks = chunksToProcess.length;
    const skippedChunks = allChunks.length - totalChunks;

    // Update total_chunks so Pipeline.tsx can calculate %
    await updateRun(runId, { total_chunks: totalChunks });

    const wordCount = content.split(/\s+/).length;
    await logAgent(runId, 'Parser Agent',
      `Document: ~${wordCount.toLocaleString()} words → ${totalChunks} chunks for analysis.` +
      (skippedChunks > 0 ? ` (${skippedChunks} chunks skipped due to safety limit)` : ''));

    // Estimate time and log it
    const estimatedMinutes = Math.ceil(rateLimiter.estimateTime(totalChunks) / 60);
    await logAgent(runId, 'Coordinator Agent',
      `Estimated processing time: ~${estimatedMinutes} minute${estimatedMinutes > 1 ? 's' : ''} (rate-limited to respect API quotas).`);

    await delay(800);

    // ── Phase 3: Filter ──
    await logAgent(runId, 'Filter Agent', 'Scoring content relevance...');
    await updateRun(runId, { current_phase: 3 });
    await delay(800);

    // ── Phases 4-7: Extraction (per chunk) ──
    await updateRun(runId, { current_phase: 4 });

    // Log which AI provider/model is being used
    try {
      const { getActiveProviderName } = await import('./ai-provider');
      const providerName = await getActiveProviderName();
      await logAgent(runId, 'Coordinator Agent', `AI Engine: ${providerName}`);
    } catch (_) {
      await logAgent(runId, 'Coordinator Agent', 'AI Engine: Unknown');
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalChunks; i++) {
      // ── Cancellation check ──
      if (signal.aborted) {
        await logAgent(runId, 'Coordinator Agent', `Pipeline cancelled at chunk ${i + 1}/${totalChunks}. Partial data preserved.`);
        console.log(`[Pipeline] Cancelled at chunk ${i + 1}/${totalChunks}`);
        return; // Exit cleanly — pipeline-controller already updated DB
      }

      const chunk = chunksToProcess[i];

      const agentNames = ['Extraction Agent', 'Extraction Agent', 'People Agent', 'Decision Agent', 'Timeline Agent'];
      const agentName = agentNames[Math.min(Math.floor((i / totalChunks) * agentNames.length), agentNames.length - 1)];
      const phaseVal = Math.min(4 + Math.floor((i / totalChunks) * 4), 7);

      await logAgent(runId, agentName, `Processing chunk ${i + 1}/${totalChunks}...`);
      await updateRun(runId, { current_phase: phaseVal, processed_chunks: i + 1 });

      let retryCount = 0;
      const maxRetries = 10; // Be much more patient with rate limits
      let lastChunkError: any = null;

      while (retryCount < maxRetries) {
        // Check cancellation before each retry too
        if (signal.aborted) {
          await logAgent(runId, 'Coordinator Agent', `Pipeline cancelled during retry. Partial data preserved.`);
          return;
        }

        try {
          // Rate limiter is now inside callAI, no need for manual delay
          const extracted = await extractFromChunk(chunk, signal);
          console.log(`[Pipeline] Chunk ${i + 1}/${totalChunks} extracted data:`, {
            isRelevant: extracted.isRelevant,
            requirements: extracted.requirements?.length || 0,
            stakeholders: extracted.stakeholders?.length || 0,
            decisions: extracted.decisions?.length || 0,
          });

          if (extracted?.isRelevant) {
            if (extracted.requirements?.length > 0) {
              const { error: reqErr } = await supabase.from('requirements').insert(
                extracted.requirements.map((r: any) => ({
                  project_id: projectId, source_id: sourceId,
                  text: r.text || 'Untitled Requirement', category: r.category || 'Functional',
                  priority: (r.priority || 'medium').toLowerCase(), confidence: typeof r.confidence === 'number' ? r.confidence : parseFloat(r.confidence) || 0.8,
                }))
              );
              if (reqErr) {
                console.error('[Pipeline] Error saving requirements:', reqErr);
              }
            }

            if (extracted.stakeholders?.length > 0) {
              await supabase.from('stakeholders').insert(
                extracted.stakeholders.map((s: any) => ({
                  project_id: projectId, name: s.name,
                  role: s.role || 'Unknown', influence: (s.influence || 'medium').toLowerCase(),
                  sentiment: (s.sentiment || 'neutral').toLowerCase(),
                }))
              );
            }

            if (extracted.decisions?.length > 0) {
              await supabase.from('decisions').insert(
                extracted.decisions.map((d: any) => ({
                  project_id: projectId, text: d.text,
                  decided_by: d.decidedBy || 'Unknown', rationale: d.rationale || '',
                }))
              );
            }

            if (extracted.timeline?.length > 0) {
              await supabase.from('timeline_events').insert(
                extracted.timeline.map((t: any) => ({
                  project_id: projectId, milestone: t.milestone,
                  date: (() => {
                    if (!t.date) return null;
                    try { return new Date(t.date).toISOString(); }
                    catch { return t.date; } // Keep raw string if not parseable
                  })(),
                }))
              );
            }

            await logAgent(runId, agentName,
              `Chunk ${i + 1}: Found ${extracted.requirements?.length || 0} requirements, ${extracted.stakeholders?.length || 0} stakeholders`);
            successCount++;
          } else {
            await logAgent(runId, 'Filter Agent', `Chunk ${i + 1} has no relevant data.`);
            successCount++;
          }
          lastChunkError = null;
          break; // success — exit retry loop

        } catch (chunkErr: any) {
          // If cancelled, exit immediately
          if (chunkErr.name === 'AbortError') {
            await logAgent(runId, 'Coordinator Agent', 'Pipeline cancelled. Partial data preserved.');
            return;
          }

          // If daily limit exhausted, stop pipeline gracefully
          if (chunkErr.message?.includes('Daily API limit reached')) {
            await logAgent(runId, 'Coordinator Agent',
              `⚠️ Daily API limit reached after ${i} chunks. ${successCount} chunks processed successfully. Partial data preserved.`);
            await updateRun(runId, {
              status: 'failed',
              completed_at: new Date().toISOString(),
            });
            await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);
            return;
          }

          lastChunkError = chunkErr;
          retryCount++;
          console.warn(`[Pipeline] Chunk ${i + 1} attempt ${retryCount} failed:`, chunkErr.message);
          if (retryCount < maxRetries) {
            const backoff = 5000 * retryCount; // 5s, 10s, 15s
            await logAgent(runId, agentName, `Chunk ${i + 1} retry ${retryCount}/${maxRetries - 1} (waiting ${backoff / 1000}s)...`);
            await delay(backoff);
          }
        }
      }

      if (lastChunkError) {
        failCount++;
        console.error(`[Pipeline] Chunk ${i + 1} failed after ${maxRetries} attempts:`, lastChunkError);
        await logAgent(runId, agentName, `Chunk ${i + 1} could not be processed — skipping (${lastChunkError.message}).`);
      }

      // No manual rate limit delay needed — rateLimiter.waitForSlot() in callAI handles it
    }

    // ── Check cancellation before final phases ──
    if (signal.aborted) {
      await logAgent(runId, 'Coordinator Agent', 'Pipeline cancelled before final phases. Partial data preserved.');
      return;
    }

    // Log extraction summary
    await logAgent(runId, 'Coordinator Agent',
      `Extraction complete: ${successCount} chunks processed, ${failCount} failed.`);

    // ── Phase 8: Conflict Detection ──
    await logAgent(runId, 'Conflict Agent', 'Checking for contradictions...');
    await updateRun(runId, { current_phase: 8 });

    const { data: allReqs } = await supabase.from('requirements').select('*').eq('project_id', projectId);
    console.log('[Pipeline] Total requirements for conflict detection:', allReqs?.length || 0);

    if (allReqs && allReqs.length > 1 && allReqs.length <= 30) {
      // Use AI to detect conflicts between requirements (only for reasonable counts)
      try {
        const reqSummaries = allReqs.map((r: any, i: number) => 
          `REQ-${String(i + 1).padStart(3, '0')}: [${r.priority}] ${r.text}`
        ).join('\n');

        const conflictPrompt = `Analyze these business requirements for contradictions, conflicts, or overlapping scope.
Return ONLY valid JSON, no markdown:
{
  "conflicts": [
    {"req1": "REQ-001", "req2": "REQ-005", "description": "brief description of the conflict", "severity": "high"}
  ]
}
If no conflicts found, return: {"conflicts": []}
Severity levels: "high", "medium", "low"

Requirements:
${reqSummaries}`;

        const { callAI } = await import('./ai-provider');
        const conflictResponse = await callAI(conflictPrompt, { signal });
        const clean = conflictResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (parsed.conflicts && parsed.conflicts.length > 0) {
          await supabase.from('conflicts').insert(
            parsed.conflicts.map((c: any) => ({
              project_id: projectId,
              description: c.description || 'Conflict detected',
              severity: (c.severity || 'medium').toLowerCase(),
              req1: c.req1 || '',
              req2: c.req2 || '',
            }))
          );
          await logAgent(runId, 'Conflict Agent',
            `Found ${parsed.conflicts.length} potential conflict${parsed.conflicts.length > 1 ? 's' : ''} between requirements.`);
        } else {
          await logAgent(runId, 'Conflict Agent', `Analyzed ${allReqs.length} requirements. No conflicts detected.`);
        }
      } catch (conflictErr: any) {
        console.warn('[Pipeline] Conflict detection failed:', conflictErr.message);
        await logAgent(runId, 'Conflict Agent', `Conflict analysis skipped: ${conflictErr.message}`);
      }
    } else if (allReqs && allReqs.length > 30) {
      await logAgent(runId, 'Conflict Agent', `${allReqs.length} requirements — skipping AI conflict detection to conserve API quota.`);
    } else {
      await logAgent(runId, 'Conflict Agent', 'Not enough requirements for conflict analysis.');
    }
    await delay(1000);

    // ── Check cancellation before BRD generation ──
    if (signal.aborted) {
      await logAgent(runId, 'Coordinator Agent', 'Pipeline cancelled before BRD generation. Partial data preserved.');
      return;
    }

    // ── Phase 9: BRD Generation ──
    await logAgent(runId, 'BRD Agent', 'Generating executive summary...');
    await updateRun(runId, { current_phase: 9 });

    const { data: finalReqs } = await supabase.from('requirements').select('*').eq('project_id', projectId);
    const { data: finalStakeholders } = await supabase.from('stakeholders').select('*').eq('project_id', projectId);
    const { data: finalDecisions } = await supabase.from('decisions').select('*').eq('project_id', projectId);
    const { data: finalTimeline } = await supabase.from('timeline_events').select('*').eq('project_id', projectId);
    const { data: finalConflicts } = await supabase.from('conflicts').select('*').eq('project_id', projectId);

    console.log('[Pipeline] Final counts for BRD:', {
      reqs: finalReqs?.length || 0,
      stakes: finalStakeholders?.length || 0,
      decs: finalDecisions?.length || 0,
    });

    await delay(2000);
    const summary = await generateSummary(finalReqs || []);

    const brdContent = {
      executiveSummary: summary,
      stakeholders: finalStakeholders || [],
      functionalRequirements: (finalReqs || []).filter((r: any) => 
        r.category?.toLowerCase() === 'functional' || r.category === 'Functional'
      ),
      nonFunctionalRequirements: (finalReqs || []).filter((r: any) => 
        r.category?.toLowerCase() !== 'functional' && r.category !== 'Functional'
      ),
      decisions: finalDecisions || [],
      conflicts: finalConflicts || [],
      timeline: finalTimeline || [],
      generatedAt: new Date().toISOString(),
      totalRequirements: finalReqs?.length || 0,
      totalStakeholders: finalStakeholders?.length || 0,
    };

    await supabase.from('documents').insert({
      project_id: projectId, title: 'Business Requirements Document',
      content: brdContent, type: 'BRD', version: 1,
    });

    await supabase.from('projects').update({
      status: 'ready',
      requirement_count: finalReqs?.length || 0,
      stakeholder_count: finalStakeholders?.length || 0,
    }).eq('id', projectId);

    // Mark complete
    await updateRun(runId, {
      status: 'complete',
      current_phase: 9,
      processed_chunks: totalChunks,
      completed_at: new Date().toISOString(),
    });
    await logAgent(runId, 'BRD Agent',
      `BRD complete! ${finalReqs?.length || 0} requirements, ${finalStakeholders?.length || 0} stakeholders.`);

    // Clear the pipeline controller
    pipelineController.clear();

  } catch (error: any) {
    // Don't treat cancellation as a fatal error
    if (error.name === 'AbortError') {
      console.log('[Pipeline] Cancelled gracefully.');
      return;
    }

    console.error('[Pipeline] Fatal error:', error);
    await logAgent(runId, 'Coordinator Agent', `Pipeline error: ${error.message}`);
    try {
      await updateRun(runId, { status: 'failed', completed_at: new Date().toISOString() });
      await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);
    } catch (dbErr) {
      console.error('[Pipeline] Failed to update failure status:', dbErr);
    }
    pipelineController.clear();
  }
}

/**
 * Auto-start pipeline: reads sources from Supabase,
 * creates its own extraction_run, and processes everything.
 * Called from Pipeline.tsx when no existing run is found.
 */
export async function runPipeline(projectId: string): Promise<{ runId: string }> {
  console.log("=== RUN PIPELINE CALLED ===");
  console.log("projectId:", projectId);

  const { data: sources, error: srcError } = await supabase
    .from('sources')
    .select('*')
    .eq('project_id', projectId);

  console.log("Sources in runPipeline:", sources?.length, "Error:", srcError);

  if (srcError) {
    console.error("Source fetch error:", srcError);
    throw new Error('DB error: ' + srcError.message);
  }

  if (!sources || sources.length === 0) {
    console.error("No sources found in runPipeline");
    throw new Error('No files uploaded for this project');
  }

  // Create extraction run — ONLY valid columns
  console.log("Creating extraction_run...");
  const { data: run, error: runError } = await supabase
    .from('extraction_runs')
    .insert({
      project_id: projectId,
      status: 'running',
      current_phase: 1,
      total_chunks: 1, // Will be updated once chunking is done
      processed_chunks: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  console.log("Run creation result:", run, "Error:", runError);

  if (runError) {
    console.error("FAILED TO CREATE RUN:", runError);
    throw new Error('Cannot create run: ' + runError.message);
  }

  if (!run) {
    throw new Error('Run creation returned null');
  }

  const runId = run.id;
  console.log("✅ Run created:", runId);

  const allContent = sources.map((s: any) => s.content || '').join('\n\n');
  const firstSourceId = sources[0].id;

  await supabase.from('projects').update({ status: 'processing' }).eq('id', projectId);

  console.log("Launching extraction pipeline...");
  runExtractionClientSide(projectId, firstSourceId, allContent, runId);

  return { runId };
}
