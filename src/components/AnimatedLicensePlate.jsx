import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function AnimatedLicensePlate({ placa }) {
  const [copied, setCopied] = useState(false);

  if (!placa) return null;

  // Format plate slightly if it's like "UNIT-6" to "UNIT - 6" or just uppercase
  const formattedPlate = placa.toUpperCase().replace('-', ' - ');

  const handleCopy = (e) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(placa.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="relative flex items-center justify-center shrink-0 perspective-1000 group"
      style={{ perspective: '1000px' }}
    >
      {/* Plate Container */}
      <div 
        onClick={handleCopy}
        role="button"
        tabIndex={0}
        className="relative overflow-hidden bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] 
                   rounded-lg border-[3px] border-[#cbd5e1] 
                   shadow-[0_8px_16px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.8)]
                   w-auto min-w-[150px] sm:min-w-[180px] px-5 py-2 sm:px-6 sm:py-2.5
                   cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-transform duration-200"
        style={{
          animation: 'plate-entry 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          transformStyle: 'preserve-3d',
          opacity: 0, // Starts hidden for animation
        }}
        title="Copiar placa"
      >
        
        {/* Top bar (e.g. state or garage name) */}
        <div className="absolute top-0 inset-x-0 h-[8px] bg-sky-600/90" />
        <div className="absolute top-[6px] inset-x-0 text-[7px] sm:text-[9px] font-bold text-center tracking-widest text-sky-700/80 uppercase">
          Sanchez Auto
        </div>

        {/* Screw holes */}
        <div className="absolute top-1 left-2 w-1.5 h-1.5 rounded-full bg-[#94a3b8] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
        <div className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-[#94a3b8] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
        <div className="absolute bottom-1 left-2 w-1.5 h-1.5 rounded-full bg-[#94a3b8] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
        <div className="absolute bottom-1 right-2 w-1.5 h-1.5 rounded-full bg-[#94a3b8] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />

        {/* Plate Number */}
        <div className="mt-3.5 mb-1.5 relative z-10 flex items-center justify-center">
          <span 
            className="font-mono text-xl sm:text-2xl font-black tracking-[0.1em] text-[#334155]"
            style={{
              textShadow: '1px 1px 0px rgba(255,255,255,0.7), -1px -1px 0px rgba(0,0,0,0.3), 0px 2px 2px rgba(0,0,0,0.2)'
            }}
          >
            {formattedPlate}
          </span>
        </div>

        {/* Shine Sweep Animation */}
        <div 
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
            width: '50%',
            height: '100%',
            animation: 'plate-shine 2s 0.5s ease-in-out forwards',
            transform: 'translateX(-150%) skewX(-20deg)',
          }}
        />

        {/* Hover/Copied Overlay */}
        <div className={`absolute inset-0 z-30 flex items-center justify-center 
                         bg-white/80 backdrop-blur-[1px] transition-opacity duration-200
                         ${copied ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'}`}>
          {copied ? (
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs sm:text-sm bg-emerald-50 px-2.5 py-1 rounded-full shadow-sm border border-emerald-200/50">
              <Check size={14} strokeWidth={3} /> Copiada
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sky-600 font-bold text-xs sm:text-sm bg-sky-50 px-2.5 py-1 rounded-full shadow-sm border border-sky-200/50">
              <Copy size={14} strokeWidth={2.5} /> Copiar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
