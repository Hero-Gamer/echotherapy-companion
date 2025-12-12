import React, { useEffect, useState } from 'react';
import { FlowerConfig } from '../types';

interface MoodFlowerProps {
  config: FlowerConfig;
  onClick?: () => void;
}

export const MoodFlower: React.FC<MoodFlowerProps> = ({ config, onClick }) => {
  const [scale, setScale] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    // Bloom animation on mount
    const timer = setTimeout(() => {
      setScale(1);
    }, 100);

    // Continuous gentle rotation if not calm (calm is steady) or trembling
    const shouldRotate = config.style !== 'calm';
    const rotationInterval = setInterval(() => {
        if(shouldRotate) setRotation(prev => (prev + 0.2) % 360);
    }, 50);

    return () => {
      clearTimeout(timer);
      clearInterval(rotationInterval);
    };
  }, [config.style]);

  // Generate petals based on style
  const numPetals = Math.max(6, Math.min(24, config.intensity * 2.5));
  const petals = [];
  const angleStep = 360 / numPetals;

  const getPetalPath = (style: string) => {
    switch (style) {
      case 'spiky': // Sharp, aggressive
        return "M0,0 Q15,-60 0,-120 Q-15,-60 0,0"; 
      case 'drooping': // Heavy, sad
        return "M0,0 C30,-30 50,40 60,60 C40,50 20,30 0,0";
      case 'trembling': // Nervous, thin
        return "M0,0 Q5,-40 0,-80 Q-5,-40 0,0";
      case 'particle': // Open, round (Happy)
        return "M0,0 C30,-50 70,-50 100,0 C70,50 30,50 0,0";
      case 'calm': // Balanced, lotus-like
      default:
        return "M0,0 C20,-40 60,-40 80,0 C60,40 20,40 0,0";
    }
  };

  const pathD = getPetalPath(config.style);

  for (let i = 0; i < numPetals; i++) {
    const angle = i * angleStep;
    
    let transform = `rotate(${angle}) translate(0, -${10 + config.intensity}) scale(${0.5 + config.intensity * 0.1})`;
    
    // Custom transforms per style
    if (config.style === 'drooping') {
       // Rotate so they point somewhat down/out
       transform = `rotate(${angle}) translate(0, 20) scale(${0.6})`;
    }

    petals.push(
      <path
        key={i}
        d={pathD}
        fill={config.baseColor}
        fillOpacity={0.7}
        transform={transform}
        className={`flower-petal ${config.style === 'trembling' ? 'animate-tremble' : ''}`}
        style={{
          transitionDelay: `${i * (300 / config.bloomSpeed / numPetals)}ms`,
          transformOrigin: '0 0',
          animationDelay: `${Math.random()}s`, // For tremble randomness
          filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))'
        }}
      />
    );
  }

  // Particle effects for happy/particle style
  const particles = [];
  if (config.style === 'particle') {
    for (let i = 0; i < 12; i++) {
      particles.push(
        <circle 
          key={`p-${i}`}
          r={Math.random() * 4 + 2}
          fill={config.baseColor}
          className="particle"
          style={{
             animationDelay: `${Math.random() * 2}s`,
             transformBox: 'fill-box',
             transformOrigin: 'center'
          }}
          cx={(Math.random() - 0.5) * 150}
          cy={(Math.random() - 0.5) * 150}
        />
      );
    }
  }

  return (
    <div 
      id="mood-flower-container" 
      onClick={onClick}
      className="relative w-80 h-80 flex items-center justify-center cursor-pointer group hover:scale-105 transition-transform duration-700 ease-out"
    >
      <svg
        viewBox="-150 -150 300 300"
        className="w-full h-full overflow-visible"
        style={{
          transform: `scale(${scale}) rotate(${config.style === 'drooping' ? 0 : rotation}deg)`, // Don't rotate drooping flowers
          transition: `transform ${3 / config.bloomSpeed}s cubic-bezier(0.34, 1.56, 0.64, 1)`
        }}
      >
        <defs>
          <radialGradient id="centerGrad">
            <stop offset="0%" stopColor="#FFF" stopOpacity="1" />
            <stop offset="100%" stopColor={config.baseColor} stopOpacity="0.2" />
          </radialGradient>
        </defs>
        
        <g className="filter drop-shadow-xl">
           {/* Center Core */}
          <circle 
            r={15 + config.intensity} 
            fill="url(#centerGrad)" 
            className={`${config.style === 'calm' ? 'animate-pulse' : ''}`}
          >
            {config.style === 'calm' && (
               <animate attributeName="r" values={`${15 + config.intensity};${20 + config.intensity};${15 + config.intensity}`} dur="4s" repeatCount="indefinite" />
            )}
          </circle>
          
          {petals}
          {particles}
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
         <span className="text-slate-600 font-semibold drop-shadow-sm bg-white/80 px-5 py-2 rounded-full text-sm backdrop-blur-md shadow-lg transform translate-y-2">
             Tap to Replay
         </span>
      </div>
    </div>
  );
};