import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { callAIChat, getActiveProviderName } from "../lib/ai-provider";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.2, 0, 0, 1] as any } },
  exit: { opacity: 0, y: -8 }
};

export default function Chat() {
  const { id: projectId } = useParams();
  const [messages, setMessages] = useState<{role: string, content: string, created_at?: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [providerName, setProviderName] = useState("Loading...");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     const fetchHistory = async () => {
         if (!projectId) return;
         const { data } = await supabase.from("chat_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
         if (data && data.length > 0) {
             setMessages(data);
         } else {
              setMessages([{ role: "assistant", content: "I'm your project assistant. I've read through all your extracted requirements, stakeholders, and decisions. Ask me anything — I can summarize, analyze, suggest improvements, or help you plan next steps." }]);
         }
     }
     fetchHistory();
     // Resolve provider name
     getActiveProviderName().then(name => setProviderName(name));
  }, [projectId]);

  useEffect(() => {
     endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
      if (!input.trim() || loading || !projectId) return;
      
      const userMsg = input;
      setInput("");
      
      const userMessageObj = { project_id: projectId, role: "user", content: userMsg };
      setMessages(prev => [...prev, userMessageObj]);
      await supabase.from("chat_messages").insert(userMessageObj);
      setLoading(true);

      try {
        // Fetch project context from Supabase
        const [reqs, stakes, decs, conflictsRes] = await Promise.all([
          supabase.from('requirements').select('text, category, priority, confidence').eq('project_id', projectId).limit(50),
          supabase.from('stakeholders').select('name, role, influence').eq('project_id', projectId).limit(20),
          supabase.from('decisions').select('text, decided_by, rationale').eq('project_id', projectId).limit(15),
          supabase.from('conflicts').select('description, severity').eq('project_id', projectId).limit(10),
        ]);

        const contextStr = [
          reqs.data?.length ? `Requirements (${reqs.data.length} total):\n${reqs.data.map((r: any) => `- [${r.priority}] ${r.text}`).join('\n')}` : '',
          stakes.data?.length ? `Stakeholders (${stakes.data.length}):\n${stakes.data.map((s: any) => `- ${s.name} (${s.role}, influence: ${s.influence})`).join('\n')}` : '',
          decs.data?.length ? `Decisions (${decs.data.length}):\n${decs.data.map((d: any) => `- ${d.text} (by ${d.decided_by})`).join('\n')}` : '',
          conflictsRes.data?.length ? `Conflicts (${conflictsRes.data.length}):\n${conflictsRes.data.map((c: any) => `- [${c.severity}] ${c.description}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n');

        const systemPrompt = `You are RequireAI's project assistant. A user has uploaded documents or described an app idea, and our AI pipeline has extracted structured data from it. Your job is to help them understand their project in simple, clear language.

IMPORTANT RULES FOR YOUR RESPONSES:
- Write like a friendly, knowledgeable advisor — NOT a database query.
- NEVER just list raw data. Instead, summarize and explain in natural language.
- Use short paragraphs. Group related items together with brief headings if helpful.
- When summarizing requirements, describe what the project is about and what it needs to do, in your own words. Don't just copy the requirement text.
- When answering questions, give practical, actionable advice.
- Keep responses 3-5 paragraphs max. Be helpful but not verbose.
- Use **bold** for emphasis and bullet points sparingly (only when listing 3+ distinct items).

EXAMPLE - if asked "Summarize my requirements":
BAD: "Here are your requirements: [high] Control TV only, [high] Easy switching..."
GOOD: "Your project is about building a universal remote control. The core focus is on simplicity — the remote should control only one TV and make switching between functions effortless. Key features include channel/volume control, on/off, and a 'find my remote' feature with a light or beep. There's also a more advanced side: an LCD screen for digital TV menus and program guides, which would need navigation keys. Overall, the requirements strongly emphasize being user-friendly and easy to learn."

Here is the project context data:
${contextStr || 'No data has been extracted yet for this project.'}`;

        const responseText = await callAIChat([
          { role: 'user', text: systemPrompt },
          { role: 'assistant', text: 'Got it! I\'ve loaded your project context. What would you like to know?' },
          { role: 'user', text: userMsg }
        ]);

        const aiMessageObj = { project_id: projectId, role: "assistant", content: responseText };
        setMessages(prev => [...prev, aiMessageObj]);
        await supabase.from("chat_messages").insert(aiMessageObj);
      } catch (err) {
        console.error('Chat API error:', err);
        const errorMsg = { project_id: projectId, role: "assistant", content: "Sorry, I encountered an error processing your request. Please check the API configuration and try again." };
        setMessages(prev => [...prev, errorMsg]);
      }
      
      setLoading(false);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-24px -28px' }}
    >
      <header style={{ padding: '16px 28px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="mac-page-title" style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
             <MessageSquare size={18} style={{ color: "var(--text2)" }}/> AI Intelligence Agent
          </h1>
          <div className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12}/> {providerName}
          </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* SUGGESTED PROMPTS — shown when only the welcome message exists */}
              {messages.length <= 1 && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Try asking:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600 }}>
                    {[
                      'Summarize all my requirements',
                      'List all high-priority items',
                      'What conflicts exist?',
                      'Suggest missing requirements',
                      'Who are the key stakeholders?',
                      'What are the key deadlines?',
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(prompt.replace(/^.\s/, '')); }}
                        style={{
                          background: 'var(--bg2)', border: '0.5px solid var(--border)',
                          color: 'var(--text2)', padding: '8px 14px', borderRadius: 20,
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        className="hover:bg-white/10"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                  <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={i} 
                      style={{ display: 'flex', gap: '16px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                  >
                      {msg.role === 'assistant' && (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '0.5px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px' }}>
                             <Sparkles size={14} style={{ color: "var(--blue)" }} />
                          </div>
                      )}
                      
                      {msg.role === 'assistant' ? (
                          <div className="mac-card" style={{ padding: '12px 16px', maxWidth: '80%', borderRadius: '14px' }}>
                              <div className="mac-body" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: msg.content
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/^- (.+)/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
                                .replace(/^(\d+)\. (.+)/gm, '<li style="margin-left:16px;list-style:decimal">$2</li>')
                                .replace(/`([^`]+)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
                                .replace(/\n/g, '<br />')
                              }} />
                          </div>
                      ) : (
                          <div style={{ background: 'var(--blue)', color: '#fff', padding: '12px 16px', maxWidth: '80%', borderRadius: '14px', border: '0.5px solid var(--blue)', boxShadow: 'var(--shadow-sm)' }}>
                              <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#fff' }}>{msg.content}</p>
                          </div>
                      )}
                  </motion.div>
              ))}
              
              {loading && (
                  <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '0.5px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '4px' }}>
                          <Sparkles size={14} style={{ color: "var(--blue)" }} className="animate-pulse" />
                      </div>
                      <div className="mac-card" style={{ padding: '16px', borderRadius: '14px', height: 'max-content', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text2)' }} className="animate-bounce"></div>
                           <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text2)', animationDelay: '0.2s' }} className="animate-bounce"></div>
                           <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text2)', animationDelay: '0.4s' }} className="animate-bounce"></div>
                      </div>
                  </div>
              )}
              <div ref={endRef} />
          </div>
      </div>

      <div style={{ padding: '16px', borderTop: '0.5px solid var(--border)', background: 'var(--bg)', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '800px', position: 'relative' }}>
              <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Ask about requirements, request a summary, or add new contexts..."
                  className="mac-input"
                  style={{ borderRadius: "20px", padding: "12px 16px", paddingRight: "48px", height: "44px", boxShadow: "var(--shadow-sm)" }}
              />
              <button 
                 onClick={handleSend}
                 disabled={!input.trim()}
                 className="btn-icon !border-0"
                 style={{ position: 'absolute', right: '8px', top: '8px', width: '28px', height: '28px', color: 'var(--blue)' }}
              >
                  <Send size={16} />
              </button>
          </div>
      </div>
    </motion.div>
  );
}
