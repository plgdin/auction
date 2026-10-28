import { useState, useEffect } from 'react';
import { 
  Radio, Volume2, VolumeX, Gavel, Users, 
  X, Sparkles, Send
} from 'lucide-react';
import clsx from 'clsx';

interface LiveAuctionRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionTitle?: string;
  referenceNumber?: string;
  currentPrice?: number;
}

export function LiveAuctionRoomModal({
  isOpen,
  onClose,
  auctionTitle = "Heavy Industrial Lathe Machine CNC-500",
  referenceNumber = "AUC-2026-9042",
  currentPrice = 2850000
}: LiveAuctionRoomModalProps) {
  const [price, setPrice] = useState(currentPrice);
  const [bids, setBids] = useState([
    { id: '1', bidder: 'Bidder #418 (Gujarat Metals)', amount: currentPrice - 50000, time: '1 min ago' },
    { id: '2', bidder: 'Bidder #109 (Apex Machining)', amount: currentPrice - 20000, time: '34s ago' },
    { id: '3', bidder: 'Bidder #882 (Precision Corp)', amount: currentPrice, time: 'Just now' },
  ]);
  const [countdown, setCountdown] = useState(45);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [simulatedViewers] = useState(64);

  const [gavelStrike, setGavelStrike] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState([
    { user: 'Auctioneer Desk', text: 'Lot #42 opened at reserve. Bidding increment ₹25,000.', isMod: true },
    { user: 'Bidder #418', text: 'Inspected yesterday, clean gear train.', isMod: false },
    { user: 'System Bot', text: 'Fair Warning: 45 seconds on the clock.', isMod: true },
  ]);

  // Periodic countdown simulation
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 45; // loop for demo
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handlePlaceBid = (increment: number) => {
    const newPrice = price + increment;
    setPrice(newPrice);
    setCountdown(45); // reset timer on bid
    setGavelStrike(true);
    setTimeout(() => setGavelStrike(false), 800);

    const newBid = {
      id: Date.now().toString(),
      bidder: 'You (Sandbox Buyer #007)',
      amount: newPrice,
      time: 'Just now'
    };
    setBids((prev) => [newBid, ...prev.slice(0, 5)]);
    setChatLog((prev) => [
      ...prev,
      { user: 'Live Gavel', text: `New Top Bid: ₹${newPrice.toLocaleString('en-IN')} by You!`, isMod: true }
    ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    setChatLog((prev) => [
      ...prev,
      { user: 'You (Buyer #007)', text: chatMessage.trim(), isMod: false }
    ]);
    setChatMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[820px]">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider animate-pulse">
              <Radio className="w-3.5 h-3.5" /> Live Floor (Beta)
            </span>
            <div className="truncate">
              <h2 className="text-sm font-bold text-white truncate">{auctionTitle}</h2>
              <span className="text-xs text-slate-400 font-mono">REF: {referenceNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>{simulatedViewers} Online</span>
            </span>
            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Development Banner Note */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Feature In Active Development:</strong> Interactive WebRTC video stream & distributed consensus engine preview.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono text-[10px] font-bold">
            Mock Sandbox
          </span>
        </div>

        {/* Modal Main Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
          {/* Stream & Gavel Panel (2 Cols) */}
          <div className="lg:col-span-2 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/60 p-4 sm:p-6 overflow-y-auto">
            {/* Simulated Stream Box */}
            <div className="relative aspect-video w-full rounded-xl bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 border border-slate-800 overflow-hidden flex flex-col justify-between p-4 shadow-inner">
              <div className="flex items-center justify-between z-10">
                <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-[11px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  FEED 01 • 1080p 60FPS
                </span>
                <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-[11px] font-mono text-amber-300 border border-amber-500/30">
                  LATENCY: 42ms
                </span>
              </div>

              {/* Center Simulated Auctioneer Silhouette / Visual */}
              <div className="my-auto flex flex-col items-center justify-center text-center py-6">
                <div className={clsx(
                  "w-20 h-20 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 shadow-xl",
                  gavelStrike ? "bg-amber-500 scale-125 rotate-12 text-slate-950" : "bg-slate-800 text-amber-400 border border-slate-700"
                )}>
                  <Gavel className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-white text-base">Auctioneer Podium Room</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Live audio/video broker integration in development. Live bidding events synchronize instantaneously.
                </p>
              </div>

              {/* Stream Overlay: Timer & Price */}
              <div className="flex items-end justify-between z-10 bg-slate-950/80 backdrop-blur p-3 rounded-lg border border-slate-800">
                <div>
                  <p className="text-[11px] uppercase font-bold text-slate-400">Current Highest Bid</p>
                  <p className="text-2xl font-black text-amber-400 font-mono">
                    ₹{price.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase font-bold text-slate-400">Hammer Clock</p>
                  <p className={clsx(
                    "text-2xl font-black font-mono",
                    countdown <= 10 ? "text-red-500 animate-pulse" : "text-white"
                  )}>
                    00:{countdown < 10 ? `0${countdown}` : countdown}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Bid Increment Buttons */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Quick Bid Placement (Simulated Sandbox)
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => handlePlaceBid(25000)}
                  className="py-3 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-amber-400 font-mono">+₹25,000</span>
                  <span className="text-[10px] text-slate-400 font-normal">Next: ₹{(price + 25000).toLocaleString('en-IN')}</span>
                </button>
                <button
                  onClick={() => handlePlaceBid(50000)}
                  className="py-3 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  <span className="font-mono">+₹50,000</span>
                  <span className="text-[10px] text-slate-900 font-medium">Power Bid</span>
                </button>
                <button
                  onClick={() => handlePlaceBid(100000)}
                  className="py-3 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center transition-all hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-indigo-200 font-mono">+₹1,00,000</span>
                  <span className="text-[10px] text-indigo-300 font-normal">Jump Bid</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Live Ticker & Chat (1 Col) */}
          <div className="flex flex-col bg-slate-900 overflow-hidden">
            {/* Live Bids History Ticker */}
            <div className="p-4 border-b border-slate-800 shrink-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Recent Bid Ticker</span>
                <span className="text-[10px] font-mono text-emerald-400">● Live Feed</span>
              </h4>
              <div className="mt-2.5 space-y-2">
                {bids.map((b, i) => (
                  <div 
                    key={b.id} 
                    className={clsx(
                      "flex items-center justify-between p-2 rounded-lg text-xs font-mono border transition-all",
                      i === 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-slate-950/40 border-slate-800/80 text-slate-400"
                    )}
                  >
                    <div className="truncate pr-2">
                      <p className="font-semibold truncate">{b.bidder}</p>
                      <span className="text-[10px] text-slate-500">{b.time}</span>
                    </div>
                    <span className="font-bold text-white shrink-0">
                      ₹{b.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Floor Chat */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Floor Audio & Chat Stream
              </h4>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {chatLog.map((c, i) => (
                  <div 
                    key={i} 
                    className={clsx(
                      "p-2 rounded-lg leading-relaxed",
                      c.isMod ? "bg-slate-800 border border-slate-700 text-amber-300" : "bg-slate-950/60 text-slate-300"
                    )}
                  >
                    <span className="font-bold block text-[11px] text-slate-400">{c.user}</span>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="mt-3 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Send floor query..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
