import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Sparkles, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CopilotFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // For now, redirect to the chat page with the message
    navigate('/chat', { state: { initialMessage: message } });
    setIsOpen(false);
    setMessage('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-80 bg-[#0D0D14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">AI Copilot</div>
                  <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold">TraceLayer Enabled</div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-xs text-white/60 mb-4 leading-relaxed">
                How can I help you with your requirements today? You can ask me to summarize documents, find conflicts, or map stakeholders.
              </p>
              
              <form onSubmit={handleSend} className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask anything... (Ctrl+J)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-lg text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
            
            <div className="px-4 py-2 bg-white/5 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] text-white/30">Powered by Gemini Pro</span>
              <button 
                onClick={() => navigate('/chat')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Full Chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
          isOpen 
            ? 'bg-white text-black rotate-90' 
            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-4 border-[#050508] rounded-full" />
        )}
      </motion.button>
    </div>
  );
}
