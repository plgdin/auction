import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Mic, MicOff, Volume2, VolumeX, X, Minimize2, Sparkles } from 'lucide-react';
import { publicService } from '../../services/publicService';
import { INVERTED_SYNONYM_MAP } from '../../services/nlpSearchUtils';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export function Chatbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Hi! I'm your Lelam & MSTC assistant. Ask me anything about MSTC eAuctions, EMD refunds, or how Lelam helps you calculate costs!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [faqs, setFaqs] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBubbleRef = useRef<HTMLDivElement>(null);

  // Fetch FAQ database on mount
  useEffect(() => {
    publicService.getActiveFaqs().then((data) => {
      setFaqs(data || []);
    }).catch((err) => {
      console.warn("Failed to load FAQs for Chatbot router:", err);
    });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Browser Speech Synthesis
  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      
      // Clean up text from markdown links or symbols to sound natural
      const cleanText = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_`#]/g, '');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      
      // Look for natural English voice
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || 
                             voices.find(v => v.lang.startsWith('en')) || 
                             voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis failed:", e);
      setIsSpeaking(false);
    }
  };

  // Browser Speech Recognition (Speech to Text)
  const startListening = () => {
    if (isListening) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Failed to start Speech Recognition:", e);
      setIsListening(false);
    }
  };

  // Local FAQ keyword router
  const findLocalFaqResponse = (query: string): string | null => {
    if (!faqs || faqs.length === 0) return null;
    const cleanQuery = query.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();

    // Friendly greetings & generic help
    const greetings = ['hi', 'hello', 'hey', 'greetings', 'hola', 'sup', 'yo', 'hi there'];
    if (greetings.includes(cleanQuery)) {
      return "Hello! How can I help you today with MSTC eAuctions or the Lelam platform?";
    }

    const CHATBOT_STOP_WORDS = new Set([
      'how', 'to', 'for', 'is', 'the', 'and', 'what', 'should', 'i', 'do', 'if', 'my', 
      'why', 'often', 'run', 'or', 'go', 'into', 'on', 'about', 'with', 'any', 'does', 
      'it', 'work', 'here', 'we', 'are', 'in', 'of', 'a', 'an', 'at', 'by', 'this', 'that',
      'you', 'your', 'me', 'help'
    ]);

    let bestMatch: any = null;
    let highestScore = 0;

    for (const faq of faqs) {
      const q = faq.question.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
      let score = 0;

      // Exact substring match (high value)
      if (q.includes(cleanQuery)) {
        score += 0.9;
      }

      // Word overlapping calculation excluding structural stop words
      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 2 && !CHATBOT_STOP_WORDS.has(w));
      const faqWords = q.split(/\s+/).filter(w => w.length >= 2 && !CHATBOT_STOP_WORDS.has(w));

      if (queryWords.length === 0) continue;

      let overlap = 0;
      for (const qw of queryWords) {
        let matched = false;
        
        // 1. Direct exact or stem/substring word match
        for (const fw of faqWords) {
          if (qw === fw || (qw.length > 3 && fw.length > 3 && (fw.includes(qw) || qw.includes(fw)))) {
            overlap += 1.0;
            matched = true;
            break;
          }
        }

        // 2. Check synonyms if not directly matched
        if (!matched) {
          const synonyms = INVERTED_SYNONYM_MAP[qw] || [];
          for (const syn of synonyms) {
            const cleanSyn = syn.toLowerCase();
            for (const fw of faqWords) {
              if (fw === cleanSyn || (cleanSyn.length > 3 && fw.length > 3 && (fw.includes(cleanSyn) || cleanSyn.includes(fw)))) {
                overlap += 0.8;
                matched = true;
                break;
              }
            }
            if (matched) break;
          }
        }
      }

      const ratio = overlap / queryWords.length;
      score += ratio * 0.95;

      if (score > highestScore) {
        highestScore = score;
        bestMatch = faq;
      }
    }

    // Minimum match threshold (0.6 ensures we don't return random pages for partial matches)
    if (highestScore >= 0.6 && bestMatch) {
      return bestMatch.answer;
    }
    return null;
  };

  // Ask Qwen via OpenRouter API
  const askQwen = async (query: string): Promise<string> => {
    const token = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!token) {
      throw new Error("No OpenRouter API Key configured");
    }

    const systemPrompt = `You are a helpful expert chatbot for Lelam and MSTC eAuctions.

GUARDRAILS:
1. Only answer queries related to MSTC eAuctions, Lelam features, scrap metal, machinery, or bidding calculators.
2. If the user asks general, coding, or unrelated queries, politely decline: "I can only assist with queries related to Lelam and MSTC eAuctions."
3. NO TECH JARGON: Do NOT use technical words like "scrape", "scraping", "crawls", "crawler", "indexes", "database", "NLP", "regression models", "algorithm", or "normalization" to explain how Lelam works. Instead, say Lelam "compiles", "aggregates", "organizes", "analyzes", or "presents" public eAuction information to make it easier to read.
4. REPHRASE CONTEXT: The FAQ context below contains technical jargon (e.g. 'scrapes', 'NLP'). You MUST rephrase any FAQ answers to completely remove these technical words in your response.

MSTC KNOWLEDGE BASE:
- MSTC India is a government-owned e-commerce platform. Lelam is independent and not affiliated with it.
- Bids can ONLY be placed on the official MSTC e-commerce portal.
- Pre-Bid EMD (Earnest Money Deposit) refunds are handled directly by MSTC. Delays happen if deposits are late (>3 days) or multiple transactions share one RTGS/NEFT challan reference.
- Auto-Extensions occur if a bid is placed in the final minutes of a lot's timer.
- PCB (Pollution Control Board) passbooks/certificates are required for hazardous scrap (e.g., e-waste, lead batteries) and must be submitted to MSTC officers.

PRICING & CALCULATORS:
- Live/Real-time rates: You do not have internet search for live pricing. Clarify that Lelam uses metal market indices (like LME and local hubs) to calculate statistical price predictions on catalog pages.
- Cost calculations: Remind users to use Lelam's Live Bid & Cost Calculator to compute total landed costs (bid price + GST + TCS + loading + transport).

FAQ context:
${JSON.stringify(faqs.map(f => ({ q: f.question, a: f.answer })))}

Answer queries concisely in 3-4 sentences maximum.`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173", // Optional, for OpenRouter analytics
          "X-Title": "Lelam Chatbot"
        },
        body: JSON.stringify({
          model: "qwen/qwen-2.5-7b-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter Qwen API error: ${response.status} - ${errText}`);
    }

    const resData = await response.json();
    const botReply = resData.choices?.[0]?.message?.content;
    if (!botReply) throw new Error("Empty response from OpenRouter API");

    return botReply;
  };

  // Process user message submission
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    // Add user message
    const userMsg: Message = { sender: 'user', text: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    setIsThinking(true);
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    try {
      // Always use Qwen
      const qwenAnswer = await askQwen(query);
      setMessages(prev => [...prev, { sender: 'bot', text: qwenAnswer, timestamp: new Date() }]);
      speakText(qwenAnswer);
    } catch (error) {
      console.error("Chatbot Qwen response error:", error);
      // Handle rate limits or other Hugging Face failures gracefully
      const errorMsg = "I have encountered an error try again later";
      setMessages(prev => [...prev, { sender: 'bot', text: errorMsg, timestamp: new Date() }]);
      speakText(errorMsg);
    } finally {
      setIsThinking(false);
    }
  };

  // Determine current active animation state of fluid inside the orb
  const getOrbStateClass = () => {
    if (isListening) return 'orb-state-listening';
    if (isSpeaking) return 'orb-state-speaking';
    if (isThinking) return 'orb-state-thinking';
    return 'orb-state-idle';
  };

  return (
    <>
      <style>{`
        @keyframes wave-move-1 {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes wave-move-2 {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        
        /* State specific variations */
        .orb-state-idle .wave-1 {
          animation: wave-move-1 5s linear infinite;
          height: 55%;
          fill: rgba(56, 189, 248, 0.4);
        }
        .orb-state-idle .wave-2 {
          animation: wave-move-2 3.2s linear infinite;
          height: 48%;
          fill: rgba(14, 165, 233, 0.55);
        }

        .orb-state-thinking .wave-1 {
          animation: wave-move-1 1.6s linear infinite;
          height: 68%;
          fill: rgba(56, 189, 248, 0.65);
        }
        .orb-state-thinking .wave-2 {
          animation: wave-move-2 1s linear infinite;
          height: 62%;
          fill: rgba(14, 165, 233, 0.8);
        }

        .orb-state-speaking .wave-1 {
          animation: wave-move-1 2.8s linear infinite;
          height: 60%;
          fill: rgba(56, 189, 248, 0.5);
        }
        .orb-state-speaking .wave-2 {
          animation: wave-move-2 1.8s linear infinite;
          height: 54%;
          fill: rgba(14, 165, 233, 0.65);
        }

        .orb-state-listening .wave-1 {
          animation: wave-move-1 1.2s linear infinite;
          height: 42%;
          fill: rgba(56, 189, 248, 0.7);
        }
        .orb-state-listening .wave-2 {
          animation: wave-move-2 0.8s linear infinite;
          height: 36%;
          fill: rgba(14, 165, 233, 0.85);
        }
      `}</style>

      {/* Floating Widget Container */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end pointer-events-none select-none font-sans">
        
        {/* Closed state bubble pop up */}
        {!isOpen && showBubble && (
          <div 
            ref={chatBubbleRef}
            className="pointer-events-auto bg-gradient-to-br from-slate-900/95 to-slate-950/95 backdrop-blur-md text-slate-100 p-4 rounded-2xl border border-sky-500/35 shadow-[0_12px_35px_rgba(14,165,233,0.25)] max-w-xs mb-4 mr-1 transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-2 relative animate-bounce"
            style={{ animationDuration: '4s' }}
          >
            <Sparkles size={14} className="text-sky-400 animate-pulse mt-0.5 shrink-0" />
            <div className="flex-1 text-xs font-semibold leading-relaxed pr-4 text-slate-200">
              I'll help you with any queries related to MSTC and Lelam
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowBubble(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors absolute top-2 right-2 cursor-pointer"
            >
              <X size={14} />
            </button>
            <div className="absolute right-6 -bottom-2 w-4 h-4 bg-slate-950 border-r border-b border-sky-500/35 transform rotate-45"></div>
          </div>
        )}

        {/* Opened Chat window */}
        {isOpen && (
          <div className="pointer-events-auto w-96 h-[500px] bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 border border-slate-800/85 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(14,165,233,0.15)] flex flex-col mb-4 mr-1 overflow-hidden transition-all duration-300">
            
            {/* Chatbox Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900/90 to-slate-950/90 border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Header Animated Orb */}
                <div className={`relative w-8 h-8 rounded-full overflow-hidden bg-slate-950 border border-sky-400/60 shadow-[0_0_10px_rgba(56,189,248,0.4)] ${getOrbStateClass()}`}>
                  {isSpeaking && (
                    <div className="absolute inset-0 rounded-full border border-sky-400/80 animate-ping opacity-60"></div>
                  )}
                  {isListening && (
                    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse"></div>
                  )}
                  
                  {/* Fluid Wave Layers inside Header Orb */}
                  <div className="absolute bottom-0 left-0 right-0 h-full overflow-hidden rounded-full">
                    <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute bottom-0 w-[200%] wave-1 transition-all duration-300">
                      <path d="M 0 50 C 25 35, 75 65, 100 50 C 125 35, 175 65, 200 50 L 200 100 L 0 100 Z"></path>
                    </svg>
                    <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute bottom-0 w-[200%] wave-2 transition-all duration-300">
                      <path d="M 0 50 C 25 65, 75 35, 100 50 C 125 65, 175 35, 200 50 L 200 100 L 0 100 Z"></path>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-sky-300/5 to-sky-300/20 rounded-full"></div>
                </div>
                
                <div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    Lelam AI Bot
                    <span className="inline-flex w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium font-mono tracking-wide">
                    {isListening ? 'Listening to voice...' : isSpeaking ? 'Speaking...' : isThinking ? 'Formulating response...' : 'Online & Ready'}
                  </div>
                </div>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setVoiceEnabled(prev => !prev)}
                  className={`p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 ${voiceEnabled ? 'text-sky-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'}`}
                  title={voiceEnabled ? 'Mute Voice Responses' : 'Enable Voice Responses'}
                >
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>

            {/* Chatbox Messages List */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed font-medium transition-all ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-sky-600 to-blue-600 text-white rounded-tr-none shadow-[0_4px_12px_rgba(2,132,199,0.35)] hover:brightness-105'
                        : 'bg-slate-900/90 border border-slate-850 text-slate-100 rounded-tl-none shadow-[0_4px_10px_rgba(0,0,0,0.15)] hover:border-slate-800/80'
                    }`}
                  >
                    {msg.text.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>
                        {line}
                      </p>
                    ))}
                    {index === 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 pointer-events-auto">
                        {[
                          'EMD Refund Policy',
                          'How Lelam Assists',
                          'Scrap price valuation',
                          'PCB documents submission'
                        ].map((sug) => (
                          <button
                            key={sug}
                            onClick={() => handleSendMessage(sug)}
                            className="px-3 py-1 rounded-full bg-sky-950/45 hover:bg-sky-900/65 border border-sky-500/25 text-[10px] text-sky-300 font-semibold hover:text-white transition-all cursor-pointer hover:border-sky-400/40 hover:scale-102"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-3 max-w-[80%] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chatbox Input Bar */}
            <div className="p-3 bg-slate-900/60 border-t border-slate-800/40 flex items-center gap-2">
              <button
                onClick={startListening}
                className={`p-2 rounded-xl transition-all duration-300 ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title="Speak to Bot"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Ask about MSTC, Lelam or EMD..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className={`p-2 rounded-xl transition-colors ${
                  inputText.trim()
                    ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-[0_0_10px_rgba(2,132,199,0.3)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Outer Floating Orb trigger button */}
        <button
          onClick={() => {
            setIsOpen(prev => !prev);
            setShowBubble(false);
          }}
          className={`pointer-events-auto relative w-14 h-14 rounded-full overflow-hidden bg-slate-950 border-2 border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.5)] hover:shadow-[0_0_25px_rgba(56,189,248,0.8)] transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer ${getOrbStateClass()}`}
        >
          {/* Glowing pulse rings for active speech or listening states */}
          {isSpeaking && (
            <div 
              className="absolute inset-0 rounded-full border-2 border-sky-400 animate-ping opacity-60"
              style={{ animationDuration: '1.5s' }}
            />
          )}
          {isListening && (
            <div 
              className="absolute inset-0 rounded-full bg-red-500/25 animate-ping"
              style={{ animationDuration: '1.2s' }}
            />
          )}

          {/* Fluid Wave layers inside Orb */}
          <div className="absolute bottom-0 left-0 right-0 h-full overflow-hidden rounded-full pointer-events-none">
            <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute bottom-0 w-[200%] wave-1 transition-all duration-500">
              <path d="M 0 50 C 25 35, 75 65, 100 50 C 125 35, 175 65, 200 50 L 200 100 L 0 100 Z"></path>
            </svg>
            <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute bottom-0 w-[200%] wave-2 transition-all duration-500">
              <path d="M 0 50 C 25 65, 75 35, 100 50 C 125 65, 175 35, 200 50 L 200 100 L 0 100 Z"></path>
            </svg>
          </div>

          {/* Sparkle highlight overlays when bot is thinking */}
          {isThinking && (
            <div className="absolute inset-0 flex items-center justify-center text-sky-300 animate-pulse">
              <Sparkles size={18} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          )}

          {/* Glass glare highlight */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-sky-300/5 to-sky-300/25 rounded-full pointer-events-none"></div>

          {/* Hover state icon indicator */}
          {!isSpeaking && !isListening && !isThinking && (
            <div className="absolute inset-0 flex items-center justify-center text-sky-100 opacity-0 hover:opacity-100 transition-opacity bg-slate-950/40">
              <MessageSquare size={20} className="text-sky-300 shadow-sm" />
            </div>
          )}
        </button>

      </div>
    </>
  );
}
