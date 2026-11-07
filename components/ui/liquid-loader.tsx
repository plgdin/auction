import React, { useState, useEffect } from 'react';

export interface LiquidLoadingProps {
  className?: string;
  variant?: "website" | "rainbow";
  colors?: string[];
  glowColors?: string[];
  size?: "sm" | "md" | "lg";
}

const RAINBOW_COLORS = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-purple-500', 
  'from-cyan-400 to-blue-500',
  'from-green-400 to-cyan-400',
  'from-yellow-400 to-green-400',
  'from-orange-400 to-yellow-400',
  'from-red-500 to-orange-400'
];

const RAINBOW_GLOWS = [
  '#a855f7',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#eab308',
  '#f97316',
  '#ef4444'
];

const WEBSITE_COLORS = [
  'from-[#5d6446] to-[#828b61]',
  'from-[#3f6b46] to-[#5d6446]',
  'from-[#4f7c56] to-[#828b61]',
  'from-[#8a6420] to-[#c89b3c]',
  'from-[#c89b3c] to-[#e0b55c]',
  'from-[#828b61] to-[#b4be93]',
  'from-[#6a744a] to-[#8a6420]',
];

const WEBSITE_GLOWS = [
  '#6d7751',
  '#4a7251',
  '#648a60',
  '#c89b3c',
  '#e0b55c',
  '#8ea16c',
  '#8a6420',
];

export const LiquidLoading: React.FC<LiquidLoadingProps> = ({
  className = "",
  variant = "website",
  colors: customColors,
  glowColors: customGlows,
  size = "md",
}) => {
  const [heights, setHeights] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [droplets, setDroplets] = useState([false, false, false, false, false, false, false]);

  const activeColors = customColors || (variant === "rainbow" ? RAINBOW_COLORS : WEBSITE_COLORS);
  const activeGlows = customGlows || (variant === "rainbow" ? RAINBOW_GLOWS : WEBSITE_GLOWS);

  const getGlowColor = (index: number) => {
    if (activeGlows[index]) return activeGlows[index];
    const c = activeColors[index] || "";
    if (c.includes('purple')) return '#a855f7';
    if (c.includes('blue')) return '#3b82f6';
    if (c.includes('cyan')) return '#06b6d4';
    if (c.includes('green')) return '#10b981';
    if (c.includes('yellow')) return '#eab308';
    if (c.includes('orange')) return '#f97316';
    if (c.includes('red')) return '#ef4444';
    return '#5d6446';
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(prev => prev.map((_height, index) => {
        const maxHeight = 80;
        const delay = index * 0.8; // Increased delay for slower wave propagation
        const time = Date.now() * 0.001; // Much slower base speed
        
        // Primary wave with bounce effect
        const primaryWave = Math.sin(time + delay);
        
        // Secondary bounce wave (higher frequency, lower amplitude)
        const bounceWave = Math.sin(time * 4 + delay) * 0.15;
        
        // Tertiary ripple effect
        const ripple = Math.sin(time * 8 + delay) * 0.05;
        
        // Combine waves for liquid bounce effect
        const combinedWave = primaryWave + bounceWave + ripple;
        
        return maxHeight * combinedWave;
      }));

      // Animate droplets with liquid timing
      setDroplets(prev => prev.map((_, index) => {
        const delay = index * 0.8;
        const time = Date.now() * 0.001;
        const waveValue = Math.sin(time + delay);
        return waveValue > 0.8; // Show droplet at peak with tighter threshold
      }));
    }, 32); // Slower frame rate for more liquid feel

    return () => clearInterval(interval);
  }, []);

  const sizeScale = size === "sm" ? "scale-75" : size === "lg" ? "scale-110 sm:scale-125" : "scale-90 sm:scale-100";

  return (
    <div className={`flex items-end space-x-3 sm:space-x-4 p-4 sm:p-8 origin-bottom ${sizeScale} ${className}`}>
      {heights.map((height, index) => {
        const glow = getGlowColor(index);
        return (
          <div key={index} className="relative flex flex-col items-center">
            {/* Droplet with liquid physics */}
            <div 
              className={`w-3.5 sm:w-4 h-3.5 sm:h-4 rounded-full bg-gradient-to-r ${activeColors[index]} mb-3 transition-all duration-500 ease-out ${
                droplets[index] ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                animationDelay: `${index * 0.2}s`,
                filter: 'blur(0.5px)',
                transform: droplets[index] 
                  ? `translateY(${Math.sin(Date.now() * 0.008 + index * 0.5) * 3}px) scale(${0.8 + Math.sin(Date.now() * 0.006 + index * 0.3) * 0.4})` 
                  : 'translateY(10px) scale(0.5)',
                boxShadow: droplets[index] ? `0 0 15px ${glow}50` : 'none'
              }}
            />
            
            {/* Main liquid bar with enhanced physics */}
            <div
              className={`w-8 sm:w-10 bg-gradient-to-t ${activeColors[index]} rounded-full transition-all duration-200 ease-out relative overflow-hidden shadow-lg`}
              style={{ 
                height: `${Math.abs(height)}px`,
                transform: height < 0 ? 'scaleY(-1)' : 'scaleY(1)',
                transformOrigin: 'bottom',
                filter: 'blur(0.3px)',
                boxShadow: `0 0 20px ${glow}55, inset 0 0 20px rgba(255,255,255,0.18)`
              }}
            >
              {/* Liquid surface tension effect */}
              <div 
                className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/40 to-transparent rounded-full"
                style={{
                  transform: `translateY(${Math.sin(Date.now() * 0.003 + index * 0.5) * 1}px) scaleY(${0.8 + Math.sin(Date.now() * 0.004 + index * 0.3) * 0.3})`
                }}
              />
              
              {/* Liquid wave effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-t from-white/20 via-white/10 to-transparent rounded-full"
                style={{
                  transform: `translateY(${Math.sin(Date.now() * 0.002 + index * 0.5) * 2}px)`,
                  background: `linear-gradient(0deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)`
                }}
              />
              
              {/* Shimmer effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full"
                style={{
                  transform: `translateX(${Math.sin(Date.now() * 0.0015 + index * 0.7) * 8}px)`,
                  width: '140%',
                  left: '-20%'
                }}
              />
              
              {/* Bubble effect */}
              <div 
                className="absolute w-2 h-2 bg-white/30 rounded-full"
                style={{
                  top: `${20 + Math.sin(Date.now() * 0.003 + index * 0.8) * 10}%`,
                  left: `${30 + Math.sin(Date.now() * 0.002 + index * 0.6) * 20}%`,
                  transform: `scale(${0.5 + Math.sin(Date.now() * 0.004 + index * 0.4) * 0.5})`,
                  opacity: Math.sin(Date.now() * 0.005 + index * 0.9) * 0.3 + 0.3
                }}
              />
            </div>
            
            {/* Enhanced base droplet with liquid physics */}
            <div 
              className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-gradient-to-r ${activeColors[index]} mt-2 transition-all duration-300`}
              style={{
                opacity: Math.sin(Date.now() * 0.003 + index * 0.9) * 0.4 + 0.6,
                transform: `scale(${0.6 + Math.sin(Date.now() * 0.002 + index * 0.6) * 0.4}) translateY(${Math.sin(Date.now() * 0.004 + index * 0.8) * 1}px)`,
                filter: 'blur(0.2px)',
                boxShadow: `0 2px 8px ${glow}50`
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default LiquidLoading;
