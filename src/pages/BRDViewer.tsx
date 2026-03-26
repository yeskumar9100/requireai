import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, Share2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { motion } from "framer-motion";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

export default function BRDViewer() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [requirements, setRequirements] = useState<any[]>([]);
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noPipelineRun, setNoPipelineRun] = useState(false);

  const [activeSection, setActiveSection] = useState('executive-summary');
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadBRDData();
    }
  }, [projectId]);

  useEffect(() => {
    const sectionsObj = [
      { id: 'executive-summary' },
      { id: 'project-overview' },
      { id: 'scope' },
      { id: 'stakeholders' },
      { id: 'functional' },
      { id: 'non-functional' },
      { id: 'decisions' },
      { id: 'conflicts' },
      { id: 'timeline' },
      { id: 'confidence' },
      { id: 'appendix' }
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-100px 0px -60% 0px' }
    );
    sectionsObj.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [requirements, loading, noPipelineRun]);

  const loadBRDData = async () => {
    setLoading(true);
    console.log('Loading BRD for project:', projectId);

    try {
      // Load all data in parallel
      const [
        projectRes,
        docRes,
        reqRes,
        stakeRes,
        decRes,
        timelineRes,
        conflictRes,
        sourceRes
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single().then(r => r, e => ({ data: null, error: e })),
        supabase.from('documents').select('*').eq('project_id', projectId).eq('type', 'BRD').order('generated_at', { ascending: false }).limit(1).maybeSingle().then(r => r, e => ({ data: null, error: e })),
        supabase.from('requirements').select('*').eq('project_id', projectId).order('priority', { ascending: false }).then(r => r, e => ({ data: null, error: e })),
        supabase.from('stakeholders').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('decisions').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('timeline_events').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('conflicts').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e })),
        supabase.from('sources').select('*').eq('project_id', projectId).then(r => r, e => ({ data: null, error: e }))
      ]);

      console.log('BRD Data loaded:', {
        project: projectRes.data?.name,
        document: docRes.data?.id,
        requirements: reqRes.data?.length,
        stakeholders: stakeRes.data?.length,
        decisions: decRes.data?.length,
        timeline: timelineRes.data?.length,
        conflicts: conflictRes.data?.length,
        sources: sourceRes.data?.length,
        errors: {
          proj: projectRes.error?.message,
          doc: docRes.error?.message,
          req: reqRes.error?.message
        }
      });

      setProject(projectRes.data);
      if (projectRes.data?.share_token) setShareToken(projectRes.data.share_token);
      if (sourceRes.data) setSources(sourceRes.data);

      if (docRes.data?.content) {
        const content = docRes.data.content;
        if (typeof content === 'object' && content.executiveSummary) {
          setExecutiveSummary(content.executiveSummary);
        } else if (typeof content === 'string') {
          setExecutiveSummary(content);
        } else {
          setExecutiveSummary(JSON.stringify(content));
        }
      } else if (reqRes.data && reqRes.data.length > 0) {
        setExecutiveSummary(
          `This BRD contains ${reqRes.data.length} requirements extracted from uploaded business communications. The analysis identified ${stakeRes.data?.length || 0} stakeholders and ${decRes.data?.length || 0} key decisions.`
        );
      } else {
        setExecutiveSummary('Run the AI pipeline to generate your BRD.');
      }

      setRequirements(reqRes.data || []);
      setStakeholders(stakeRes.data || []);
      setDecisions(decRes.data || []);
      setTimeline(timelineRes.data || []);
      setConflicts(conflictRes.data || []);

      // Check if pipeline has run
      if (!reqRes.data || reqRes.data.length === 0) {
        setNoPipelineRun(true);
      }

      setLoading(false);

    } catch (err: any) {
      console.error('BRD load error:', err);
      setLoading(false);
    }
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return "badge-green";
    if (conf >= 0.5) return "badge-orange";
    return "badge-red";
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site');
      return;
    }

    // STEP 1: Extract all values into plain variables BEFORE building HTML string
    const projectName = project?.name || 'Project BRD';
    const projectDesc = project?.description || 'Generated by RequireAI Intelligence Engine';
    const projectStatus = project?.status || 'Active';
    const totalReqs = requirements?.length || 0;
    const totalStakeholders = stakeholders?.length || 0;
    const totalDecisions = decisions?.length || 0;
    const totalConflicts = conflicts?.length || 0;
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const generatedTime = new Date().toLocaleTimeString('en-GB');

    const fReqs = (requirements || []).filter(r =>
      r.category?.toLowerCase() === 'functional' || r.category === 'Functional'
    );
    const nfReqs = (requirements || []).filter(r =>
      r.category?.toLowerCase() !== 'functional' && r.category !== 'Functional'
    );

    const avgConfidence = totalReqs > 0
      ? Math.round((requirements || []).reduce((sum, r) => sum + (r.confidence || 0.8), 0) / totalReqs * 100)
      : 0;
    const highConfCount = (requirements || []).filter(r => (r.confidence || 0.8) >= 0.8).length;
    const medConfCount = (requirements || []).filter(r => { const c = r.confidence || 0.8; return c >= 0.5 && c < 0.8; }).length;
    const lowConfCount = (requirements || []).filter(r => (r.confidence || 0.8) < 0.5).length;

    // STEP 2: Build HTML sections as plain string variables
    let reqTableRows = '';
    (requirements || []).forEach((r, i) => {
      const num = String(i + 1).padStart(3, '0');
      const text = (r.text || '').substring(0, 55) + ((r.text || '').length > 55 ? '...' : '');
      const priority = r.priority || 'medium';
      const category = r.category || 'functional';
      const conf = Math.round((r.confidence || 0.8) * 100);
      reqTableRows += '<tr><td>REQ-' + num + '</td><td>' + text + '</td><td>' + priority + '</td><td>' + category + '</td><td>' + conf + '%</td></tr>';
    });

    let functionalCards = '';
    if (fReqs.length === 0) {
      functionalCards = '<p>No functional requirements extracted.</p>';
    } else {
      fReqs.forEach((r, i) => {
        const num = String(i + 1).padStart(3, '0');
        const priority = r.priority || 'medium';
        const category = r.category || 'functional';
        const conf = Math.round((r.confidence || 0.8) * 100);
        functionalCards += '<div class="req-card ' + priority + '"><div class="req-header"><span class="req-id">REQ-' + num + '</span><div class="req-badges"><span class="badge badge-' + priority + '">' + priority + '</span><span class="badge badge-func">' + category + '</span></div></div><div class="req-text">' + (r.text || '') + '</div><div class="req-confidence">Confidence: ' + conf + '%</div></div>';
      });
    }

    let nfCards = '';
    if (nfReqs.length === 0) {
      nfCards = '<p>No non-functional requirements extracted.</p>';
    } else {
      nfReqs.forEach((r, i) => {
        const num = String(i + 1).padStart(3, '0');
        const priority = r.priority || 'medium';
        const category = r.category || 'non-functional';
        const conf = Math.round((r.confidence || 0.8) * 100);
        nfCards += '<div class="req-card ' + priority + '"><div class="req-header"><span class="req-id">NFR-' + num + '</span><div class="req-badges"><span class="badge badge-' + priority + '">' + priority + '</span><span class="badge badge-nf">' + category + '</span></div></div><div class="req-text">' + (r.text || '') + '</div><div class="req-confidence">Confidence: ' + conf + '%</div></div>';
      });
    }

    let stakeholderRows = '';
    if ((stakeholders || []).length === 0) {
      stakeholderRows = '<tr><td colspan="5" style="text-align:center;color:#8E8E93;">No stakeholders identified</td></tr>';
    } else {
      (stakeholders || []).forEach((s, i) => {
        stakeholderRows += '<tr><td>' + (i + 1) + '</td><td>' + (s.name || 'Unknown') + '</td><td>' + (s.role || 'Unknown') + '</td><td>' + (s.influence || 'medium') + '</td><td>' + (s.sentiment || 'neutral') + '</td></tr>';
      });
    }

    let decisionRows = '';
    if ((decisions || []).length === 0) {
      decisionRows = '<tr><td colspan="4" style="text-align:center;color:#8E8E93;">No decisions captured</td></tr>';
    } else {
      (decisions || []).forEach((d, i) => {
        const num = String(i + 1).padStart(3, '0');
        decisionRows += '<tr><td>DEC-' + num + '</td><td>' + (d.text || '') + '</td><td>' + (d.decided_by || 'Unknown') + '</td><td>' + (d.status || 'confirmed') + '</td></tr>';
      });
    }

    let conflictsHtml = '';
    if ((conflicts || []).length === 0) {
      conflictsHtml = '<div style="text-align:center;padding:40px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;"><div style="font-size:32px;margin-bottom:12px;">&#10003;</div><div style="font-size:16px;font-weight:700;color:#166534;">No conflicts detected</div><p style="color:#166534;margin-top:8px;">Your requirements are consistent</p></div>';
    } else {
      (conflicts || []).forEach((c, i) => {
        const num = String(i + 1).padStart(3, '0');
        const desc = c.description || 'Conflict detected';
        const severity = c.severity || 'medium';
        conflictsHtml += '<div class="conflict-card"><div class="conflict-title">CON-' + num + ': ' + desc.substring(0, 60) + '</div><span class="conflict-severity">' + severity + '</span><p>' + desc + '</p></div>';
      });
    }

    let timelineHtml = '';
    if ((timeline || []).length === 0) {
      timelineHtml = '<p>No timeline events extracted.</p>';
    } else {
      (timeline || []).forEach(t => {
        timelineHtml += '<div class="timeline-item"><div class="timeline-dot"></div><div><div style="font-size:14px;font-weight:700;color:#1C1C1E;">' + (t.milestone || 'Milestone') + '</div><div style="font-size:12px;color:#6366F1;font-weight:600;margin-top:2px;">' + (t.event_date || t.date || 'TBD') + '</div></div></div>';
      });
    }

    let confRows = '';
    (requirements || []).forEach((r, i) => {
      const num = String(i + 1).padStart(3, '0');
      const conf = Math.round((r.confidence || 0.8) * 100);
      const level = conf >= 80 ? 'High' : conf >= 50 ? 'Medium' : 'Low';
      const text = (r.text || '').substring(0, 45) + '...';
      confRows += '<tr><td>REQ-' + num + '</td><td>' + text + '</td><td>' + conf + '%</td><td>' + level + '</td></tr>';
    });

    let sourceRows = '';
    if ((sources || []).length === 0) {
      sourceRows = '<tr><td colspan="3" style="text-align:center;color:#8E8E93;">No sources recorded</td></tr>';
    } else {
      (sources || []).forEach((s, i) => {
        sourceRows += '<tr><td>' + (i + 1) + '</td><td>' + (s.file_name || 'Unknown') + '</td><td>' + (s.type || 'document') + '</td></tr>';
      });
    }

    const execSummary = executiveSummary || 'This Business Requirements Document was generated by RequireAI Intelligence Engine using a 9-phase multi-agent AI pipeline.';

    // STEP 3: Build final HTML using plain string concatenation ONLY
    const css = '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #1C1C1E; background: #fff; }' +
      '.cover { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 40px; border-bottom: 3px solid #6366F1; page-break-after: always; }' +
      '.cover-logo { font-size: 13px; font-weight: 700; color: #6366F1; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 48px; }' +
      '.cover-badge { display: inline-block; background: #F0F0FF; color: #6366F1; font-size: 11px; font-weight: 700; padding: 6px 16px; border-radius: 4px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 20px; }' +
      '.cover-title { font-size: 40px; font-weight: 800; color: #0A0A0F; letter-spacing: -1.5px; margin-bottom: 10px; }' +
      '.cover-version { font-size: 18px; color: #6366F1; margin-bottom: 40px; }' +
      '.cover-stats { display: flex; gap: 40px; justify-content: center; margin-bottom: 40px; }' +
      '.stat-item { text-align: center; }' +
      '.stat-num { font-size: 36px; font-weight: 800; color: #6366F1; letter-spacing: -1px; }' +
      '.stat-lbl { font-size: 11px; color: #8E8E93; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }' +
      '.cover-footer { font-size: 12px; color: #8E8E93; }' +
      '.toc-page { padding: 60px; page-break-after: always; }' +
      '.toc-title { font-size: 28px; font-weight: 800; color: #0A0A0F; margin-bottom: 28px; padding-bottom: 12px; border-bottom: 2px solid #6366F1; }' +
      '.toc-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 0.5px solid #F0F0F0; font-size: 13px; color: #3C3C43; }' +
      '.toc-num { color: #6366F1; font-weight: 700; margin-right: 12px; min-width: 28px; }' +
      '.page { padding: 60px; page-break-before: always; }' +
      '.section-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #6366F1; }' +
      '.section-num { font-size: 12px; font-weight: 800; color: #6366F1; text-transform: uppercase; letter-spacing: 0.08em; }' +
      '.section-title { font-size: 24px; font-weight: 800; color: #0A0A0F; letter-spacing: -0.5px; }' +
      'p { font-size: 13px; line-height: 1.8; color: #3C3C43; margin-bottom: 12px; }' +
      'table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }' +
      'th { background: #F8F8FF; color: #6366F1; font-weight: 700; padding: 10px 12px; text-align: left; border: 0.5px solid #E8E8F0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }' +
      'td { padding: 10px 12px; border: 0.5px solid #E8E8F0; color: #3C3C43; vertical-align: top; }' +
      'tr:nth-child(even) td { background: #FAFAFA; }' +
      '.req-card { border: 0.5px solid #E8E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }' +
      '.req-card.high { border-left: 4px solid #EF4444; }' +
      '.req-card.medium { border-left: 4px solid #F59E0B; }' +
      '.req-card.low { border-left: 4px solid #10B981; }' +
      '.req-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }' +
      '.req-id { font-size: 12px; font-weight: 800; color: #6366F1; }' +
      '.req-badges { display: flex; gap: 6px; }' +
      '.badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; text-transform: uppercase; }' +
      '.badge-high { background: #FEE2E2; color: #991B1B; }' +
      '.badge-medium { background: #FEF3C7; color: #92400E; }' +
      '.badge-low { background: #D1FAE5; color: #065F46; }' +
      '.badge-func { background: #EDE9FE; color: #4C1D95; }' +
      '.badge-nf { background: #F3F4F6; color: #374151; }' +
      '.req-text { font-size: 13px; color: #1C1C1E; font-weight: 500; margin-bottom: 6px; }' +
      '.req-confidence { font-size: 11px; color: #6366F1; font-weight: 600; }' +
      '.conflict-card { border: 0.5px solid #FEE2E2; border-left: 4px solid #EF4444; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #FFF8F8; }' +
      '.conflict-title { font-size: 14px; font-weight: 700; color: #991B1B; margin-bottom: 8px; }' +
      '.conflict-severity { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; background: #FEE2E2; color: #991B1B; text-transform: uppercase; margin-bottom: 8px; }' +
      '.timeline-item { display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; }' +
      '.timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: #6366F1; flex-shrink: 0; margin-top: 4px; }' +
      '.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }' +
      '.info-box { background: #F8F8FF; border: 0.5px solid #E8E8F0; border-radius: 8px; padding: 14px; }' +
      '.info-box-label { font-size: 10px; font-weight: 700; color: #6366F1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }' +
      '.info-box-value { font-size: 13px; color: #1C1C1E; }' +
      '@media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .page { page-break-before: always; } }';

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + projectName + ' - BRD</title><style>' + css + '</style></head><body>' +

      // COVER PAGE
      '<div class="cover">' +
      '<div class="cover-logo">RequireAI Intelligence Engine</div>' +
      '<div class="cover-badge">Business Requirements Document</div>' +
      '<div class="cover-title">' + projectName + '</div>' +
      '<div class="cover-version">Version 1.0</div>' +
      '<div class="cover-stats">' +
      '<div class="stat-item"><div class="stat-num">' + totalReqs + '</div><div class="stat-lbl">Requirements</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + totalStakeholders + '</div><div class="stat-lbl">Stakeholders</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + totalDecisions + '</div><div class="stat-lbl">Decisions</div></div>' +
      '<div class="stat-item"><div class="stat-num">' + totalConflicts + '</div><div class="stat-lbl">Conflicts</div></div>' +
      '</div>' +
      '<div class="cover-footer">Generated: ' + generatedDate + ' by RequireAI Intelligence Engine</div>' +
      '</div>' +

      // TABLE OF CONTENTS
      '<div class="toc-page"><div class="toc-title">Table of Contents</div>' +
      '<div class="toc-item"><span><span class="toc-num">01.</span>Executive Summary</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">02.</span>Project Overview</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">03.</span>Requirements Summary</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">04.</span>Stakeholder Analysis</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">05.</span>Functional Requirements</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">06.</span>Non-Functional Requirements</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">07.</span>Decision Analysis</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">08.</span>Detected Conflicts</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">09.</span>Timeline and Milestones</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">10.</span>Confidence Report</span></div>' +
      '<div class="toc-item"><span><span class="toc-num">11.</span>Source Appendix</span></div>' +
      '</div>' +

      // SECTION 01: EXECUTIVE SUMMARY
      '<div class="page"><div class="section-header"><span class="section-num">Section 01</span><span class="section-title">Executive Summary</span></div>' +
      '<p>' + execSummary + '</p>' +
      '<div class="info-grid">' +
      '<div class="info-box"><div class="info-box-label">Total Requirements</div><div class="info-box-value">' + totalReqs + ' extracted</div></div>' +
      '<div class="info-box"><div class="info-box-label">Stakeholders</div><div class="info-box-value">' + totalStakeholders + ' identified</div></div>' +
      '<div class="info-box"><div class="info-box-label">Decisions</div><div class="info-box-value">' + totalDecisions + ' captured</div></div>' +
      '<div class="info-box"><div class="info-box-label">Conflicts</div><div class="info-box-value">' + totalConflicts + ' flagged</div></div>' +
      '</div></div>' +

      // SECTION 02: PROJECT OVERVIEW
      '<div class="page"><div class="section-header"><span class="section-num">Section 02</span><span class="section-title">Project Overview</span></div>' +
      '<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>' +
      '<tr><td>Project Name</td><td>' + projectName + '</td></tr>' +
      '<tr><td>Status</td><td>' + projectStatus + '</td></tr>' +
      '<tr><td>Generated</td><td>' + generatedDate + '</td></tr>' +
      '<tr><td>AI Pipeline</td><td>9-Phase RequireAI Engine</td></tr>' +
      '<tr><td>Requirements</td><td>' + totalReqs + '</td></tr>' +
      '<tr><td>Avg Confidence</td><td>' + avgConfidence + '%</td></tr>' +
      '</tbody></table>' +
      '<p>' + projectDesc + '</p>' +
      '</div>' +

      // SECTION 03: REQUIREMENTS SUMMARY
      '<div class="page"><div class="section-header"><span class="section-num">Section 03</span><span class="section-title">Requirements Summary</span></div>' +
      '<table><thead><tr><th>ID</th><th>Requirement</th><th>Priority</th><th>Category</th><th>Confidence</th></tr></thead><tbody>' +
      reqTableRows + '</tbody></table></div>' +

      // SECTION 04: STAKEHOLDERS
      '<div class="page"><div class="section-header"><span class="section-num">Section 04</span><span class="section-title">Stakeholder Analysis</span></div>' +
      '<table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Influence</th><th>Sentiment</th></tr></thead><tbody>' +
      stakeholderRows + '</tbody></table></div>' +

      // SECTION 05: FUNCTIONAL REQUIREMENTS
      '<div class="page"><div class="section-header"><span class="section-num">Section 05</span><span class="section-title">Functional Requirements</span></div>' +
      functionalCards + '</div>' +

      // SECTION 06: NON-FUNCTIONAL REQUIREMENTS
      '<div class="page"><div class="section-header"><span class="section-num">Section 06</span><span class="section-title">Non-Functional Requirements</span></div>' +
      nfCards + '</div>' +

      // SECTION 07: DECISIONS
      '<div class="page"><div class="section-header"><span class="section-num">Section 07</span><span class="section-title">Decision Analysis</span></div>' +
      '<table><thead><tr><th>ID</th><th>Decision</th><th>Decided By</th><th>Status</th></tr></thead><tbody>' +
      decisionRows + '</tbody></table></div>' +

      // SECTION 08: CONFLICTS
      '<div class="page"><div class="section-header"><span class="section-num">Section 08</span><span class="section-title">Detected Conflicts</span></div>' +
      conflictsHtml + '</div>' +

      // SECTION 09: TIMELINE
      '<div class="page"><div class="section-header"><span class="section-num">Section 09</span><span class="section-title">Timeline and Milestones</span></div>' +
      timelineHtml + '</div>' +

      // SECTION 10: CONFIDENCE REPORT
      '<div class="page"><div class="section-header"><span class="section-num">Section 10</span><span class="section-title">Confidence Report</span></div>' +
      '<div class="info-grid">' +
      '<div class="info-box"><div class="info-box-label">Overall Confidence</div><div class="info-box-value" style="font-size:28px;font-weight:800;color:#6366F1;">' + avgConfidence + '%</div></div>' +
      '<div class="info-box"><div class="info-box-label">High Confidence</div><div class="info-box-value">' + highConfCount + ' requirements</div></div>' +
      '<div class="info-box"><div class="info-box-label">Medium Confidence</div><div class="info-box-value">' + medConfCount + ' requirements</div></div>' +
      '<div class="info-box"><div class="info-box-label">Low Confidence</div><div class="info-box-value">' + lowConfCount + ' requirements</div></div>' +
      '</div>' +
      '<table><thead><tr><th>ID</th><th>Requirement</th><th>Confidence</th><th>Level</th></tr></thead><tbody>' +
      confRows + '</tbody></table></div>' +

      // SECTION 11: SOURCE APPENDIX
      '<div class="page"><div class="section-header"><span class="section-num">Section 11</span><span class="section-title">Source Appendix</span></div>' +
      '<p>Generated by RequireAI Intelligence Engine on ' + generatedDate + ' at ' + generatedTime + '.</p>' +
      '<p>' + totalReqs + ' requirements extracted using 9-phase multi-agent AI pipeline.</p>' +
      '<table><thead><tr><th>#</th><th>Source Name</th><th>Type</th></tr></thead><tbody>' +
      sourceRows + '</tbody></table>' +
      '<div style="margin-top:40px;text-align:center;padding:20px;background:#F8F8FF;border-radius:8px;border:0.5px solid #E8E8F0;">' +
      '<div style="font-size:12px;color:#8E8E93;">Generated by RequireAI Intelligence Engine</div>' +
      '<div style="font-size:11px;color:#8E8E93;margin-top:4px;">Powered by Google Gemini</div>' +
      '</div></div>' +

      '<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>' +
      '</body></html>';

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportMarkdown = () => {
    try {
      const lines: string[] = [];
      lines.push(`# Business Requirements Document`);
      lines.push(`**Project:** ${project?.name || 'Untitled'}`);
      lines.push(`**Generated:** ${new Date().toLocaleDateString()}`);
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## Executive Summary');
      lines.push('');
      lines.push(executiveSummary || 'No summary available.');
      lines.push('');
      lines.push('## Stakeholders');
      lines.push('');
      lines.push('| Name | Role | Influence | Sentiment |');
      lines.push('|------|------|-----------|-----------|');
      stakeholders.forEach(s => {
        lines.push(`| ${s.name} | ${s.role} | ${s.influence} | ${s.sentiment || 'neutral'} |`);
      });
      lines.push('');
      lines.push('## Functional Requirements');
      lines.push('');
      requirements.filter(r => r.category === 'functional' || r.category === 'Functional').forEach((r, i) => {
        lines.push(`**REQ-${String(i+1).padStart(3,'0')}** ${r.text}`);
        lines.push(`- Priority: ${r.priority} | Confidence: ${Math.round((r.confidence||0)*100)}%`);
        lines.push('');
      });
      lines.push('## Non-Functional Requirements');
      lines.push('');
      requirements.filter(r => r.category !== 'functional' && r.category !== 'Functional').forEach((r, i) => {
        lines.push(`**NFR-${String(i+1).padStart(3,'0')}** ${r.text}`);
        lines.push(`- Category: ${r.category} | Priority: ${r.priority}`);
        lines.push('');
      });
      lines.push('## Decisions Log');
      lines.push('');
      lines.push('| Decision | Decided By | Rationale |');
      lines.push('|----------|-----------|-----------|');
      decisions.forEach(d => {
        lines.push(`| ${d.text} | ${d.decided_by||'Unknown'} | ${d.rationale||'-'} |`);
      });
      lines.push('');
      lines.push('## Timeline');
      lines.push('');
      timeline.forEach(t => {
        lines.push(`- **${t.milestone}** — ${t.date || t.event_date || 'TBD'}`);
      });
      lines.push('');
      lines.push('---');
      lines.push('*Generated by RequireAI — BRD Intelligence Platform*');
    
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'BRD'}-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Markdown export failed:", err);
      alert("Failed to export Markdown document.");
    }
  };

  const handleExportDOCX = async () => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: 'Business Requirements Document',
              heading: HeadingLevel.TITLE
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Project: ${project?.name || 'Untitled'}`,
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated: ${new Date().toLocaleDateString()}`
                })
              ]
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Executive Summary',
              heading: HeadingLevel.HEADING_1
            }),
            ...(executiveSummary || 'No summary available.').split('\n').map(line => new Paragraph({ text: line })),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Functional Requirements',
              heading: HeadingLevel.HEADING_1
            }),
            ...requirements
              .filter(r => r.category === 'functional' || r.category === 'Functional')
              .map((r, i) => new Paragraph({
                children: [
                  new TextRun({ 
                    text: `REQ-${String(i+1).padStart(3,'0')}: `,
                    bold: true 
                  }),
                  new TextRun({ text: r.text })
                ]
              })),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Non-Functional Requirements',
              heading: HeadingLevel.HEADING_1
            }),
            ...requirements
              .filter(r => r.category !== 'functional' && r.category !== 'Functional')
              .map((r, i) => new Paragraph({
                children: [
                  new TextRun({ 
                    text: `NFR-${String(i+1).padStart(3,'0')}: `,
                    bold: true 
                  }),
                  new TextRun({ text: r.text })
                ]
              })),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Stakeholders',
              heading: HeadingLevel.HEADING_1
            }),
            ...stakeholders.map(s => new Paragraph({
              children: [
                new TextRun({ text: `${s.name} `, bold: true }),
                new TextRun({ 
                  text: `— ${s.role} (${s.influence} influence)`
                })
              ]
            })),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Decisions Log',
              heading: HeadingLevel.HEADING_1
            }),
            ...decisions.map((d, i) => new Paragraph({
              children: [
                new TextRun({ 
                  text: `${i+1}. `, bold: true 
                }),
                new TextRun({ text: d.text }),
                new TextRun({ 
                  text: ` — ${d.decided_by || 'Unknown'}`,
                  italics: true
                })
              ]
            })),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Timeline',
              heading: HeadingLevel.HEADING_1
            }),
            ...timeline.map(t => new Paragraph({
              children: [
                new TextRun({ 
                  text: `${t.milestone}: `, bold: true 
                }),
                new TextRun({ 
                  text: t.date || t.event_date || 'TBD'
                })
              ]
            })),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Generated by RequireAI — BRD Intelligence Platform',
                  italics: true,
                  color: '666666'
                })
              ]
            })
          ]
        }]
      });
    
      const blob = await Packer.toBlob(doc);
      saveAs(
        blob,
        `${project?.name || 'BRD'}-${new Date().toISOString().split('T')[0]}.docx`
      );
    } catch (err) {
      console.error("Word export failed:", err);
      alert("Failed to export Word document. See console for details.");
    }
  };

  // LOADING
  if (loading) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <Loader2 className="animate-spin" style={{ color: "var(--blue)", width: 24, height: 24 }} />
        <div style={{ fontSize: 13, color: "var(--text2)" }}>Loading BRD...</div>
      </motion.div>
    );
  }

  // NO PIPELINE RUN
  if (noPipelineRun) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: 16
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text)'
        }}>
          BRD not generated yet
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--text2)',
          textAlign: 'center',
          maxWidth: 360
        }}>
          Run the AI pipeline first to extract 
          requirements and generate your BRD
        </div>
        <button
          onClick={() => navigate(`/pipeline/${projectId}`)}
          style={{
            background: 'var(--blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Go to Pipeline
        </button>
      </motion.div>
    );
  }

  const functionalReqs = requirements.filter(r =>
    r.category?.toLowerCase() === 'functional' || r.category === 'Functional'
  );
  const nonFunctionalReqs = requirements.filter(r =>
    r.category?.toLowerCase() !== 'functional' && r.category !== 'Functional'
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ margin: "0 auto", display: 'flex' }}
    >
      <div style={{
        width: 240,
        background: '#0D0D14',
        borderRight: '0.5px solid rgba(255,255,255,0.07)',
        padding: '24px 12px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        flexShrink: 0
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: 'rgba(255,255,255,0.25)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '0 10px',
          marginBottom: 16
        }}>
          Table of Contents
        </div>
        {[
          { id: 'executive-summary', num: '01', title: 'Executive Summary' },
          { id: 'project-overview', num: '02', title: 'Project Overview' },
          { id: 'scope', num: '03', title: 'Scope Definition' },
          { id: 'stakeholders', num: '04', title: 'Stakeholder Analysis' },
          { id: 'functional', num: '05', title: 'Functional Requirements' },
          { id: 'non-functional', num: '06', title: 'Non-Functional Requirements' },
          { id: 'decisions', num: '07', title: 'Decision Analysis' },
          { id: 'conflicts', num: '08', title: 'Detected Conflicts' },
          { id: 'timeline', num: '09', title: 'Timeline' },
          { id: 'confidence', num: '10', title: 'Confidence Report' },
          { id: 'appendix', num: '11', title: 'Source Appendix' },
        ].map(s => (
          <div
            key={s.id}
            onClick={() => {
              document.getElementById(s.id)
                ?.scrollIntoView({ behavior: 'smooth' });
              setActiveSection(s.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              marginBottom: 2,
              background: activeSection === s.id
                ? 'rgba(99,102,241,0.15)'
                : 'transparent',
              borderLeft: activeSection === s.id
                ? '2px solid #6366F1'
                : '2px solid transparent'
            }}
          >
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: '#6366F1',
              minWidth: 20
            }}>
              {s.num}
            </span>
            <span style={{
              fontSize: 12,
              color: activeSection === s.id
                ? '#818CF8'
                : 'rgba(255,255,255,0.45)',
              lineHeight: 1.4
            }}>
              {s.title}
            </span>
          </div>
        ))}

        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '0.5px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <button
            onClick={async () => {
              try {
                let token = shareToken;
                if (!token) {
                  token = crypto.randomUUID();
                  const { error } = await supabase
                    .from('projects')
                    .update({ share_token: token })
                    .eq('id', projectId);
                  if (error) {
                    console.error('Failed to save share token:', error);
                    return;
                  }
                  setShareToken(token);
                }
                const shareUrl = `${window.location.origin}/share/${token}`;
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch (err) {
                console.error('Share failed:', err);
              }
            }}
            style={{
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)',
              color: copied ? '#10B981' : '#818CF8',
              border: copied ? '0.5px solid rgba(16,185,129,0.3)' : '0.5px solid rgba(99,102,241,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
          >
            {copied ? <><Check size={13} /> Link Copied!</> : <><Share2 size={13} /> Share BRD</>}
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              background: '#6366F1',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Export PDF
          </button>
          <button
            onClick={handleExportMarkdown}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Export Markdown
          </button>
          <button
            onClick={handleExportDOCX}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Export DOCX
          </button>
        </div>
      </div>

      <article id="brd-content-area" style={{ flex: 1, padding: '40px 60px', display: 'flex', flexDirection: 'column', gap: '60px', maxWidth: '1000px', margin: '0 auto' }}>
        <header style={{ paddingBottom: "32px", borderBottom: "0.5px solid var(--border)" }}>
          <div className="badge badge-gray" style={{ marginBottom: "12px", border: "0.5px solid var(--border)" }}>BUSINESS REQUIREMENTS DOCUMENT</div>
          <h1 className="mac-page-title" style={{ fontSize: "40px", letterSpacing: '-1px' }}>{project?.name || "Project BRD"}</h1>
          <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 8 }}>
            {requirements.length} requirements · {stakeholders.length} stakeholders · {decisions.length} decisions
          </div>
        </header>

        {/* IDEA VALIDATOR SCORE */}
        {requirements.length > 0 && (() => {
          const completeness = Math.min(100, Math.round((requirements.length / 10) * 100));
          const feasibility = conflicts.length === 0 ? 95 : Math.max(40, 95 - (conflicts.length * 15));
          const clarity = requirements.length > 0 ? Math.round(requirements.reduce((s, r) => s + (r.confidence || 0.8), 0) / requirements.length * 100) : 0;
          const coverage = Math.min(100, Math.round(
            ((stakeholders.length > 0 ? 25 : 0) + (decisions.length > 0 ? 25 : 0) + (requirements.length > 0 ? 25 : 0) + (timeline.length > 0 ? 25 : 0))
          ));
          const overall = Math.round((completeness + feasibility + clarity + coverage) / 4);
          const scores = [
            { label: 'Completeness', value: completeness, color: '#6366F1' },
            { label: 'Feasibility', value: feasibility, color: '#10B981' },
            { label: 'Clarity', value: clarity, color: '#06B6D4' },
            { label: 'Coverage', value: coverage, color: '#A855F7' },
          ];
          return (
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06))', border: '0.5px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: 28, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Idea Validator Score</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 56, fontWeight: 800, color: overall >= 70 ? '#10B981' : overall >= 40 ? '#F59E0B' : '#EF4444', letterSpacing: '-2px', lineHeight: 1 }}>{overall}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>/ 100</div>
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {scores.map((s, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.value}%`, background: s.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        <section id="executive-summary">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            01. Executive Summary
          </h2>
          <p className="mac-body" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{executiveSummary}</p>
        </section>

        <section id="project-overview">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            02. Project Overview
          </h2>
          <div className="mac-card">
            <p className="mac-body" style={{ marginBottom: 16 }}>{project?.description || 'No description provided.'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="mac-secondary">Status: <span style={{color: '#fff'}}>{project?.status || 'Active'}</span></div>
              <div className="mac-secondary">Generated: <span style={{color: '#fff'}}>{new Date().toLocaleDateString('en-GB')}</span></div>
            </div>
          </div>
        </section>

        <section id="scope">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            03. Scope Definition
          </h2>
          <div className="mac-card">
            <h4 style={{ color: "var(--text)", marginBottom: 12, fontSize: 14 }}>In Scope</h4>
            {functionalReqs.slice(0, 3).map((r, i) => (
              <p key={i} className="mac-body" style={{ marginBottom: 8 }}>• {r.text}</p>
            ))}
          </div>
        </section>

        <section id="stakeholders">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            04. Stakeholder Analysis
          </h2>
          <div className="mac-table-wrapper">
            <table className="mac-table">
              <thead><tr><th>Name</th><th>Role</th><th>Influence</th><th>Sentiment</th></tr></thead>
              <tbody>
                {stakeholders.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text2)" }}>No stakeholders detected</td></tr>}
                {stakeholders.map((s, i) => (
                  <tr key={i} className="hoverable">
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td className="mac-secondary">{s.role}</td>
                    <td><span className="badge badge-blue">{s.influence}</span></td>
                    <td className="mac-secondary">{s.sentiment || "neutral"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="functional">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            05. Functional Requirements
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {functionalReqs.length === 0 && <div className="mac-secondary">No functional requirements detected</div>}
            {functionalReqs.map((req, idx) => (
              <div key={idx} className="mac-card mac-card-hover">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontWeight: 600, color: "var(--blue)" }}>REQ-{idx + 1}</span>
                    <span className="badge badge-gray" style={{ textTransform: "uppercase" }}>{req.category}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`badge ${req.priority === "high" ? "badge-red" : req.priority === "medium" ? "badge-orange" : "badge-blue"}`} style={{ textTransform: "uppercase" }}>{req.priority}</span>
                    {req.confidence != null && <span className={`badge ${getConfidenceColor(req.confidence)}`}>Conf: {((req.confidence || 0) * 100).toFixed(0)}%</span>}
                  </div>
                </div>
                <p className="mac-body" style={{ lineHeight: 1.6 }}>{req.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="non-functional">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            06. Non-Functional Requirements
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {nonFunctionalReqs.length === 0 && <div className="mac-secondary">No non-functional requirements detected</div>}
            {nonFunctionalReqs.map((req, idx) => (
              <div key={idx} className="mac-card mac-card-hover">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontWeight: 600, color: "var(--blue)" }}>NFR-{idx + 1}</span>
                    <span className="badge badge-gray" style={{ textTransform: "uppercase" }}>{req.category}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`badge ${req.priority === "high" ? "badge-red" : req.priority === "medium" ? "badge-orange" : "badge-blue"}`} style={{ textTransform: "uppercase" }}>{req.priority}</span>
                    {req.confidence != null && <span className={`badge ${getConfidenceColor(req.confidence)}`}>Conf: {((req.confidence || 0) * 100).toFixed(0)}%</span>}
                  </div>
                </div>
                <p className="mac-body" style={{ lineHeight: 1.6 }}>{req.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="decisions">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            07. Decision Analysis ({decisions.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {decisions.length === 0 && <div className="mac-secondary">No decisions recorded</div>}
            {decisions.map((d, i) => (
              <div key={i} className="mac-card">
                <p className="mac-body" style={{ marginBottom: 6 }}>{d.text}</p>
                <div className="mac-secondary" style={{ fontSize: 12 }}>Decided by: {d.decided_by || "Team"}{d.rationale ? ` · ${d.rationale}` : ""}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="conflicts">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            08. Detected Conflicts ({conflicts.length})
          </h2>
          {conflicts.length === 0 ? (
            <div className="mac-card" style={{ borderColor: 'var(--green)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle size={24} style={{ color: 'var(--green)' }} />
              <div>
                <h4 style={{ color: 'var(--green)', margin: 0 }}>No Conflicts Detected</h4>
                <div className="mac-secondary" style={{ marginTop: 4 }}>Your requirements are consistent.</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {conflicts.map((c, i) => (
                <div key={i} className="mac-card" style={{ borderLeft: '3px solid var(--red)' }}>
                  <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{c.severity || 'Medium'} Conflict</div>
                  <p className="mac-body" style={{ marginBottom: 6 }}>{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="timeline">
          <h2 className="mac-page-title" style={{ marginBottom: "16px" }}>09. Timeline ({timeline.length})</h2>
          <div className="mac-card">
            {timeline.length === 0 && <div className="mac-secondary">No timeline events found</div>}
            {timeline.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < timeline.length - 1 ? "0.5px solid var(--border)" : "none", alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--orange)", flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{t.milestone}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", whiteSpace: "nowrap" }}>{t.date || t.event_date || "TBD"}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="confidence">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            10. Confidence Report
          </h2>
          <div className="mac-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
               <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>Overall Average</div>
               <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--blue)' }}>
                  {requirements.length > 0 ? 
                    Math.round(requirements.reduce((sum, r) => sum + (r.confidence || 0.8), 0) / requirements.length * 100) : 0}%
               </div>
            </div>
            <div>
               <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>High Confidence</div>
               <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{requirements.filter(r => (r.confidence||0.8) >= 0.8).length}</div>
            </div>
          </div>
        </section>

        <section id="appendix">
          <h2 className="mac-page-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            11. Source Appendix
          </h2>
          <div className="mac-table-wrapper">
            <table className="mac-table">
              <thead><tr><th>Source</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {sources.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text2)" }}>No sources appended</td></tr>}
                {sources.map((s, i) => (
                  <tr key={i} className="hoverable">
                    <td style={{ fontWeight: 500 }}>{s.file_name}</td>
                    <td className="mac-secondary">{s.type || 'document'}</td>
                    <td><span className="badge badge-green">Processed</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* WHAT'S NEXT SECTION */}
        {requirements.length > 0 && (
          <section id="whats-next" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(6,182,212,0.06))', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 28 }}>
            <h2 className="mac-page-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              What's Next?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
              Based on your extracted requirements, here are recommended next steps:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: 1, title: 'Validate with stakeholders', desc: `Share this BRD with your ${stakeholders.length || 'identified'} stakeholders and collect feedback on priorities.`, done: false },
                { step: 2, title: 'Resolve conflicts', desc: conflicts.length > 0 ? `You have ${conflicts.length} conflict(s) to resolve before moving forward.` : 'No conflicts detected — you\'re clear to proceed!', done: conflicts.length === 0 },
                { step: 3, title: 'Create wireframes', desc: `Use the ${functionalReqs.length} functional requirements as a basis for your UI/UX design.`, done: false },
                { step: 4, title: 'Build your MVP', desc: 'Focus on high-priority requirements first. Defer low-priority items to a future release.', done: false },
                { step: 5, title: 'Test with real users', desc: 'Conduct usability testing with at least 5-10 target users and iterate.', done: false },
              ].map((item) => (
                <div key={item.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: 10, border: item.done ? '0.5px solid rgba(16,185,129,0.3)' : '0.5px solid rgba(255,255,255,0.06)' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: item.done ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                    color: item.done ? '#10B981' : '#818CF8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700
                  }}>
                    {item.done ? '✓' : item.step}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </article>
    </motion.div>
  );
}
