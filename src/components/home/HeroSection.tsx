import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function HeroSection() {
  return (
    <div className="relative bg-slate-900 overflow-hidden py-28 lg:py-36 flex flex-col justify-center items-center text-center">
      {/* Animated glowing background orbs & gradients matching Auctions page */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 30, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-40 -left-40 w-96 h-96 bg-primary/25 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px]"
        />
      </div>

      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12 flex flex-col items-center">
        <div className="max-w-4xl flex flex-col items-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-7xl mb-8 leading-tight max-w-3xl">
            Bringing Auctions <br />to the Masses
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl text-slate-300 leading-relaxed mb-12 max-w-2xl font-light">
            Empowering everyone with simple, secure, and transparent eAuctions and MSTC auctions—one bid at a time.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/auctions"
              className="inline-flex items-center justify-center px-10 py-5 border border-transparent text-lg font-semibold rounded-xl text-white bg-primary hover:bg-primary/95 transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-primary/45 hover:-translate-y-0.5 cursor-pointer"
            >
              View Auctions
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
