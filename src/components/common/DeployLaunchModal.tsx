import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

const PILLAR_COUNT = 8;

export function DeployLaunchModal() {
  const [deployDone, setDeployDone] = useState<boolean>(() => {
    return localStorage.getItem('lelam_official_launch_completed') === 'true';
  });

  const [inputVal, setInputVal] = useState('');
  const [stage, setStage] = useState<'prompt' | 'logo_reveal' | 'pillars_reveal'>('prompt');
  const [errorMsg, setErrorMsg] = useState('');

  // Expose dev utility to reset and re-test if needed
  useEffect(() => {
    (window as any).resetDeployLaunch = () => {
      localStorage.removeItem('lelam_official_launch_completed');
      setDeployDone(false);
      window.location.reload();
    };
  }, []);

  // Only allow launch modal if URL has ?launch=1, on localhost, on a Vercel deployment, or on lelam.co (prevents regular visitors from seeing it)
  const isLaunchTriggered = typeof window !== 'undefined' && (
    window.location.search.includes('launch=1') ||
    window.location.search.includes('deploy=1') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.vercel.app') ||
    window.location.hostname.includes('vercel') ||
    window.location.hostname === 'lelam.co' ||
    window.location.hostname.endsWith('.lelam.co')
  );

  if (!isLaunchTriggered || deployDone) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim().toUpperCase() === 'DEPLOY') {
      setErrorMsg('');
      setStage('logo_reveal');

      // Stage 2: Show logo on bright blue screen for 2 seconds
      setTimeout(() => {
        setStage('pillars_reveal');

        // Stage 3: Solid blue pillars retract upwards one by one (~1.6s)
        setTimeout(() => {
          localStorage.setItem('lelam_official_launch_completed', 'true');
          setDeployDone(true);
        }, 1600);
      }, 2200);
    } else {
      setErrorMsg('Please type "DEPLOY" to launch.');
    }
  };

  return (
    <>
      {/* 1. White Modal Dialog Prompt */}
      <AnimatePresence>
        {stage === 'prompt' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 font-sans select-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Background accent glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />

              {/* Lelam Logo */}
              <div className="mb-6">
                <img
                  src="/png_lelam_1.webp"
                  alt="Lelam Logo"
                  width={200}
                  height={40}
                  className="h-9 w-auto object-contain mx-auto"
                />
              </div>

              {/* Icon badge */}
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-6 h-6" />
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-2 text-slate-900">
                Deployment Authorization
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                Platform deployment ready. Type <span className="font-mono text-blue-600 font-bold">DEPLOY</span> below to initialize system.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder='Type "DEPLOY"'
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3.5 text-center text-slate-900 font-mono font-bold tracking-widest placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 outline-hidden uppercase transition-all"
                  />
                  {errorMsg && (
                    <div className="flex items-center text-red-600 text-xs font-semibold mt-2 px-1">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>Launch Platform</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>One-time deployment verification</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Bright Blue Logo Screen (shows logo centered on blue background) */}
      <AnimatePresence>
        {stage === 'logo_reveal' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#3b82f6] text-white p-4 font-sans select-none overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1.05, opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="relative z-10 text-center"
            >
              <img
                src="/png_lelam_1.webp"
                alt="Lelam Logo"
                className="w-80 sm:w-[500px] max-w-[90vw] h-auto object-contain mx-auto brightness-0 invert drop-shadow-xl mb-8"
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex items-center justify-center gap-2 text-xs font-mono font-bold tracking-[0.3em] uppercase text-white/90"
              >
                <span>Initializing Platform</span>
                <span className="inline-flex space-x-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce [animation-delay:0.2s]">.</span>
                  <span className="animate-bounce [animation-delay:0.4s]">.</span>
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Solid Bright Blue Pillars Retracting Upwards in Steps */}
      <AnimatePresence>
        {stage === 'pillars_reveal' && (
          <div className="fixed inset-0 z-[99999] pointer-events-none flex overflow-hidden">
            {Array.from({ length: PILLAR_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: 0 }}
                animate={{ y: '-100%' }}
                transition={{
                  duration: 0.85,
                  delay: i * 0.1,
                  ease: [0.76, 0, 0.24, 1],
                }}
                className="h-full bg-[#3b82f6] border-r border-blue-400/40 relative shadow-lg"
                style={{ width: `${100 / PILLAR_COUNT}%` }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
