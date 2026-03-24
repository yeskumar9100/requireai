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
             setMessages([{ role: "assistant", content: "I am the Synthetic Architect. I have full context of all requirements, decisions, and stakeholders for this project. How can I assist you?" }]);
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
        const [reqs, stakes, decs] = await Promise.all([
          supabase.from('requirements').select('text, category, priority').eq('project_id', projectId).limit(15),
          supabase.from('stakeholders').select('name, role, influence').eq('project_id', projectId).limit(10),
          supabase.from('decisions').select('text, decided_by').eq('project_id', projectId).limit(10),
        ]);

        const contextStr = [
          reqs.data?.length ? `Requirements:\n${reqs.data.map((r: any) => `- [${r.priority}] ${r.text}`).join('\n')}` : '',
          stakes.data?.length ? `Stakeholders:\n${stakes.data.map((s: any) => `- ${s.name} (${s.role}, influence: ${s.influence})`).join('\n')}` : '',
          decs.data?.length ? `Decisions:\n${decs.data.map((d: any) => `- ${d.text} (by ${d.decided_by})`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n');

        const systemPrompt = `You are RequireAI's intelligent assistant. You help users understand their extracted business requirements.
Here is the project context:
${contextStr || 'No data has been extracted yet for this project.'}

Answer the user's question based on this context. Be concise and professional.`;

        const responseText = await callAIChat([
          { role: 'user', text: systemPrompt },
          { role: 'assistant', text: 'Understood. I have the project context loaded. How can I help?' },
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
                              <p className="mac-body" style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
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
