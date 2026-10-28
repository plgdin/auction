import { useState, useEffect } from 'react';
import { 
  Radio, Volume2, VolumeX, Gavel, Send
} from 'lucide-react';
import clsx from 'clsx';


export function LiveAuctionFloor() {
  const [currentPrice, setCurrentPrice] = useState(4250000);
  const [countdown, setCountdown] = useState(38);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [gavelStrike, setGavelStrike] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [bids, setBids] = useState([
    { id: '1', bidder: 'Bidder #781 (Mahindra Steel & Forge)', amount: 4150000, time: '2m ago' },
    { id: '2', bidder: 'Bidder #302 (Reliance Infra Ltd)', amount: 4200000, time: '45s ago' },
    { id: '3', bidder: 'Bidder #994 (Tata Projects Cons.)', amount: 4250000, time: '12s ago' },
  ]);
  const [chatLog, setChatLog] = useState([
    { user: 'Chief Auctioneer', text: 'Lot #108: Heavy Hydraulic Press 1200T open for bids.', isMod: true },
    { user: 'Bidder #781', text: 'Is the hydraulic manifold inspected?', isMod: false },
    { user: 'Desk Tech', text: 'Yes, inspection report verified in document vault.', isMod: true },
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 40 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const placeBid = (increment: number) => {
    const nextVal = currentPrice + increment;
    setCurrentPrice(nextVal);
    setCountdown(40);
    setGavelStrike(true);
    setTimeout(() => setGavelStrike(false), 700);

    setBids((prev) => [
      { id: Date.now().toString(), bidder: 'You (Sandbox Buyer #007)', amount: nextVal, time: 'Just now' },
      ...prev.slice(0, 5)
    ]);
    setChatLog((prev) => [
      ...prev,
      { user: 'Floor Gavel', text: `Live Bid Placed: ₹${nextVal.toLocaleString('en-IN')} by You!`, isMod: true }
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Dev Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">Live Auction Bidding Floor (Beta)</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase">
                Under Development
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Interactive WebRTC auctioneer room & sub-second latency bidding engine sandbox preview.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 text-amber-400 font-bold">
            Simulated Sandbox Mode
          </span>
        </div>
      </div>

      {/* Main Floor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stream & Bidding Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Simulated Video Broadcast */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-6 text-white relative overflow-hidden shadow-xl aspect-video flex flex-col justify-between">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-wider animate-pulse">
                  <Radio className="w-3.5 h-3.5" /> Live Broadcast
                </span>
                <span className="text-xs text-slate-400 bg-black/50 px-2 py-1 rounded">
                  Lot #108: Heavy Hydraulic Press 1200T
                </span>
              </div>
              <button
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>

            {/* Podium Center Graphic */}
            <div className="my-auto text-center flex flex-col items-center">
              <div className={clsx(
                "w-24 h-24 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 shadow-2xl",
                gavelStrike ? "bg-amber-500 scale-110 text-slate-950" : "bg-slate-900 border border-slate-800 text-amber-400"
              )}>
                <Gavel className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-white">Live Central Auctioneer Stage</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Audio & video multiplex stream preview. All connected bidders receive real-time sync.
              </p>
            </div>

            {/* Price & Countdown Overlay */}
            <div className="bg-slate-900/90 backdrop-blur border border-slate-800 p-4 rounded-xl flex items-center justify-between z-10">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Current Bid</p>
                <p className="text-3xl font-black text-amber-400 font-mono">₹{currentPrice.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Timer to Hammer</p>
                <p className={clsx("text-3xl font-black font-mono", countdown <= 10 ? "text-red-500 animate-ping" : "text-white")}>
                  00:{countdown < 10 ? `0${countdown}` : countdown}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Bid Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Place Fast Bid (Dev Sandbox Bidding)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => placeBid(25000)}
                className="p-4 rounded-xl border border-slate-200 hover:border-primary hover:bg-primary/5 text-slate-800 font-bold text-center transition-all"
              >
                <span className="block text-primary text-base font-mono">+₹25,000</span>
                <span className="text-xs text-slate-500 font-normal">Next: ₹{(currentPrice + 25000).toLocaleString('en-IN')}</span>
              </button>
              <button
                onClick={() => placeBid(50000)}
                className="p-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-center transition-all shadow-md shadow-amber-500/20"
              >
                <span className="block text-base font-mono">+₹50,000</span>
                <span className="text-xs text-slate-900 font-medium">Power Bid</span>
              </button>
              <button
                onClick={() => placeBid(100000)}
                className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-center transition-all"
              >
                <span className="block text-amber-300 text-base font-mono">+₹1,00,000</span>
                <span className="text-xs text-slate-400 font-normal">Next: ₹{(currentPrice + 100000).toLocaleString('en-IN')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Ticker & Chat (1 col) */}
        <div className="space-y-6">
          {/* Recent Bids Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-3">
              <span>Live Bids Feed</span>
              <span className="text-emerald-600 text-[11px] font-mono font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Realtime
              </span>
            </h3>
            <div className="space-y-2.5">
              {bids.map((b, i) => (
                <div 
                  key={b.id} 
                  className={clsx(
                    "p-3 rounded-xl border text-xs flex items-center justify-between transition-all",
                    i === 0 ? "bg-amber-50 border-amber-200 text-amber-950 font-semibold" : "bg-slate-50 border-slate-200 text-slate-700"
                  )}
                >
                  <div className="truncate pr-2">
                    <p className="truncate font-bold">{b.bidder}</p>
                    <span className="text-[10px] text-slate-500">{b.time}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 shrink-0">
                    ₹{b.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Chat */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col h-[320px]">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Floor Discussion & System Events
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {chatLog.map((c, i) => (
                <div key={i} className={clsx("p-2.5 rounded-lg", c.isMod ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-slate-50 text-slate-800")}>
                  <span className="font-bold block text-[11px] text-slate-500">{c.user}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask auctioneer desk..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary-700 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
