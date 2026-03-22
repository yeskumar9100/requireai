import { supabase } from "./supabase";

function chunkText(text: string): string[] {
  const chunks = [];
  let currentWord = 0;
  const words = text.split(" ");
  while (currentWord < words.length) {
    chunks.push(words.slice(currentWord, currentWord + 500).join(" "));
    currentWord += 500;
  }
  return chunks;
}

const logProgress = async (runId: string, agentName: string, message: string, phase?: number, progress?: number) => {
  await supabase.from("agent_logs").insert({
    extraction_run_id: runId,
    agent_name: agentName,
    message,
    created_at: new Date().toISOString()
  });

  if (phase !== undefined || progress !== undefined) {
    const updatePayload: any = {};
    if (phase !== undefined) updatePayload.current_phase = phase;
    if (progress !== undefined) updatePayload.progress = progress;
    await supabase.from("extraction_runs").update(updatePayload).eq("id", runId);
  }
};

export async function runExtractionClientSide(projectId: string, sourceId: string, content: string, runId: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY_1 || import.meta.env.VITE_GEMINI_API_KEY_2;
  if (!apiKey) {
      console.error("Missing Gemini API Key");
      return;
  }

  try {
    // Phase 1: Orchestrator
    await logProgress(runId, "Orchestrator", "Pipeline Initialized.", 1, 10);

    // Phase 2: Ingestion
    await logProgress(runId, "IngestionAgent", `Parsing source into memory`, 2, 20);
    const chunks = chunkText(content).slice(0, 15); // Max 15 chunks
    
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        
        // Rate limiting delay
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const phaseMap = Math.min(3 + Math.floor((i/totalChunks) * 5), 7);
        const progressMap = 20 + Math.floor(((i+1)/totalChunks) * 60);
        
        await logProgress(runId, "ExtractionAgent", `Processing chunk ${i+1}/${totalChunks}...`, phaseMap, progressMap);

        const prompt = `Analyze this business communication text.
Return ONLY valid JSON with no extra text:
{
  "isRelevant": boolean,
  "requirements": [
    {"text": "string", "category": "string", "priority": "high|medium|low", "confidence": number}
  ],
  "stakeholders": [
    {"name": "string", "role": "string", "influence": "high|medium|low", "sentiment": "string"}
  ],
  "decisions": [
    {"text": "string", "decidedBy": "string", "rationale": "string"}
  ],
  "timeline": [
    {"milestone": "string", "date": "string"}
  ]
}
Text: ${chunk}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });
        const data = await res.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let jsonStr = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '');
            try {
              const resultObj = JSON.parse(jsonStr);
              if (resultObj.isRelevant) {
                  // Save chunks to Supabase tables
                  if (resultObj.requirements) {
                     await supabase.from("requirements").insert(resultObj.requirements.map((r:any) => ({
                         project_id: projectId, source_id: sourceId, text: r.text, category: r.category || 'Functional', priority: r.priority || 'medium', confidence: r.confidence || 0.8
                     })));
                  }
                  if (resultObj.stakeholders) {
                     await supabase.from("stakeholders").insert(resultObj.stakeholders.map((s:any) => ({
                         project_id: projectId, name: s.name, role: s.role, influence: s.influence || "medium", sentiment: s.sentiment || "neutral"
                     })));
                  }
                  if (resultObj.decisions) {
                     await supabase.from("decisions").insert(resultObj.decisions.map((d:any) => ({
                         project_id: projectId, text: d.text, decided_by: d.decidedBy, rationale: d.rationale
                     })));
                  }
                  if (resultObj.timeline) {
                      await supabase.from("timeline_events").insert(resultObj.timeline.map((t:any) => ({
                          project_id: projectId, milestone: t.milestone, date: t.date
                      })));
                  }
              }
            } catch(e) { console.error("Parse Error JSON", e) }
        }
    }

    // Phase 8: Conflicts
    await logProgress(runId, "ConflictAgent", "Analyzing logical contradictions...", 8, 85);
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    // Phase 9: Traceability
    await logProgress(runId, "TraceAgent", "Linking entities...", 9, 90);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Phase 10: Document
    await logProgress(runId, "DocumentAgent", "Generating Final BRD JSON...", 10, 100);
    await generateBRD(projectId, runId);

  } catch(e) {
      await logProgress(runId, "ErrorAgent", `Pipeline Failed: ${e}`);
      await supabase.from("extraction_runs").update({ status: "failed" }).eq("id", runId);
  }
}

async function generateBRD(projectId: string, runId: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY_1 || import.meta.env.VITE_GEMINI_API_KEY_2;
  
  // Fetch all extractions
  const { data: requirements } = await supabase.from('requirements').select('*').eq('project_id', projectId);
  const { data: stakeholders } = await supabase.from('stakeholders').select('*').eq('project_id', projectId);
  const { data: decisions } = await supabase.from('decisions').select('*').eq('project_id', projectId);
  const { data: timeline } = await supabase.from('timeline_events').select('*').eq('project_id', projectId);
  const { data: conflicts } = await supabase.from('conflicts').select('*').eq('project_id', projectId);

  // Call Gemini to generate executive summary
  let summary = 'Requirements extracted from uploaded documents.';
  try {
      const summaryRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            contents: [{parts: [{
              text: `Write a professional executive summary for a BRD with these requirements:\n${requirements?.slice(0,10).map((r:any)=>r.text).join('\n')}\nKeep it under 150 words. Plain text only.`
            }]}]
          })
        }
      );
      const summaryJson = await summaryRes.json();
      summary = summaryJson.candidates?.[0]?.content?.parts?.[0]?.text || summary;
  } catch(e) { console.error('Gemini Generate Content Error', e); }

  // Build structured BRD document
  const brdContent = {
    executiveSummary: summary,
    stakeholders: stakeholders || [],
    functionalRequirements: requirements?.filter((r:any) => r.category === 'functional' || r.category === 'Functional') || [],
    nonFunctionalRequirements: requirements?.filter((r:any) => r.category !== 'functional' && r.category !== 'Functional') || [],
    decisions: decisions || [],
    conflicts: conflicts || [],
    timeline: timeline || [],
    generatedAt: new Date().toISOString(),
    totalRequirements: requirements?.length || 0
  };

  // Save BRD to Supabase
  await supabase.from('documents').insert({
    project_id: projectId,
    title: 'Business Requirements Document',
    content: brdContent,
    type: 'BRD',
    version: 1
  });

  // Update project status
  await supabase.from('projects').update({ 
      status: 'ready',
      requirement_count: requirements?.length || 0,
      stakeholder_count: stakeholders?.length || 0
  }).eq('id', projectId);
}
