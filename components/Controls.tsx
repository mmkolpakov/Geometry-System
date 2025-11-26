
import React, { useState } from 'react';
import { 
  Settings2, 
  Maximize, 
  Eye, 
  PlayCircle, 
  Info, 
  Atom, 
  Globe,
  Cpu,
  Layers,
  Palette,
  Anchor
} from 'lucide-react';
import { SimulationState, Scientist, SCIENTISTS, UniverseType } from '../types';

interface ControlsProps {
  state: SimulationState;
  updateState: (partial: Partial<SimulationState>) => void;
}

const GlassPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl text-white ${className}`}>
    {children}
  </div>
);

const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full p-2 text-sm transition-all rounded-lg mb-1 ${
      active ? 'bg-indigo-600/40 text-white' : 'hover:bg-white/5 text-gray-300'
    }`}
  >
    <span>{label}</span>
    <div className={`w-3 h-3 rounded-full ${active ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]' : 'bg-gray-600'}`} />
  </button>
);

const Slider: React.FC<{ 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step: number; 
  onChange: (val: number) => void 
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="mb-4">
    <div className="flex justify-between text-xs text-gray-400 mb-1">
      <span>{label}</span>
      <span>{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
    />
  </div>
);

export const Controls: React.FC<ControlsProps> = ({ state, updateState }) => {
  const [selectedScientist, setSelectedScientist] = useState<Scientist | null>(null);

  const getUniverseType = () => {
    if (state.omega > 1.02) return UniverseType.Closed;
    if (state.omega < 0.98) return UniverseType.Open;
    return UniverseType.Flat;
  };

  const getAngleSum = () => {
    if (state.omega > 1.02) return '> 180°';
    if (state.omega < 0.98) return '< 180°';
    return '= 180°';
  };

  return (
    <>
      {/* Top Status Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-2xl">
        <GlassPanel className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full animate-pulse ${
                 state.omega > 1.02 ? 'bg-blue-500' : state.omega < 0.98 ? 'bg-red-500' : 'bg-green-500'
             }`} />
             <span className="font-semibold tracking-wide text-sm md:text-base">
               {getUniverseType()}
             </span>
          </div>
          <div className="text-xs text-gray-400 hidden sm:block">
            Triangle Sum Δ {getAngleSum()}
          </div>
          <div className="text-xs font-mono text-indigo-300">
            Ω = {state.omega.toFixed(2)}
          </div>
        </GlassPanel>
      </div>

      {/* Left Panel: Physics */}
      <div className="absolute top-24 left-4 z-10 w-64 flex flex-col gap-4">
        <GlassPanel className="p-4">
          <div className="flex items-center gap-2 mb-4 text-indigo-300 border-b border-white/10 pb-2">
            <Atom size={18} />
            <h2 className="font-semibold text-sm">Physics Core</h2>
          </div>
          
          <Slider 
            label="Density Parameter (Ω)" 
            value={state.omega} 
            min={0.5} 
            max={1.5} 
            step={0.01} 
            onChange={(v) => {
                if (v > 0.95 && v < 1.05) v = 1.0;
                updateState({ omega: v });
            }} 
          />
          
          <div className="border-t border-white/10 pt-3 mt-2">
            <Toggle 
              label="Chaos Mode (Early Era)" 
              active={state.chaosMode} 
              onClick={() => updateState({ chaosMode: !state.chaosMode })} 
            />
            {state.chaosMode && (
              <Slider 
                label="Chaos Speed" 
                value={state.chaosSpeed} 
                min={0.1} 
                max={5.0} 
                step={0.1} 
                onChange={(v) => updateState({ chaosSpeed: v })} 
              />
            )}
            
            <Toggle 
              label="Local Gravity (Mass)" 
              active={state.enableGravity} 
              onClick={() => updateState({ enableGravity: !state.enableGravity })} 
            />
          </div>
          
          <div className="border-t border-white/10 pt-3 mt-2">
            <div className="flex items-center gap-2 mb-2 text-indigo-300/80">
                <Cpu size={14} />
                <span className="text-xs font-semibold">Simulation Settings</span>
            </div>
             <Slider 
                label="Precision & Resolution" 
                value={state.precision} 
                min={0.0} 
                max={1.0} 
                step={0.1} 
                onChange={(v) => updateState({ precision: v })} 
              />
          </div>
        </GlassPanel>

        <GlassPanel className="p-4">
             <div className="flex items-center gap-2 mb-4 text-indigo-300 border-b border-white/10 pb-2">
                <Globe size={18} />
                <h2 className="font-semibold text-sm">Exploration</h2>
             </div>
             
             <button 
                onClick={() => updateState({ antMode: !state.antMode })}
                className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${
                    state.antMode 
                    ? 'bg-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
             >
                {state.antMode ? <Eye size={18}/> : <Globe size={18} />}
                {state.antMode ? 'Exit Earth View' : 'Earth View'}
             </button>
        </GlassPanel>
      </div>

      {/* Right Panel: View Settings */}
      <div className="absolute top-24 right-4 z-10 w-64 flex flex-col gap-4">
        <GlassPanel className="p-4">
           <div className="flex items-center gap-2 mb-4 text-indigo-300 border-b border-white/10 pb-2">
            <Settings2 size={18} />
            <h2 className="font-semibold text-sm">View Control</h2>
          </div>

          <Slider 
             label="Zoom Factor"
             value={state.zoom}
             min={0.5}
             max={2.5}
             step={0.1}
             onChange={(v) => updateState({ zoom: v })}
          />

          <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
             <div className="flex items-center gap-2 text-indigo-300/80 mb-1">
                <Layers size={14} />
                <span className="text-xs font-semibold">Layers</span>
             </div>
             <Toggle 
               label="Universe Grid" 
               active={state.showUniverseGrid} 
               onClick={() => updateState({ showUniverseGrid: !state.showUniverseGrid })} 
             />
             <Toggle 
               label="2D Triangle (Geodesic)" 
               active={state.showGeometry} 
               onClick={() => updateState({ showGeometry: !state.showGeometry })} 
             />
             <Toggle 
               label="3D Grid (Volumetric)" 
               active={state.showVolumetricGrid} 
               onClick={() => updateState({ showVolumetricGrid: !state.showVolumetricGrid })} 
             />
             <Toggle 
               label="3D Pyramid (Volume)" 
               active={state.show3DFigure} 
               onClick={() => updateState({ show3DFigure: !state.show3DFigure })} 
             />
             <Toggle 
               label="Solar System" 
               active={state.showCelestial} 
               onClick={() => updateState({ showCelestial: !state.showCelestial })} 
             />
             {state.showCelestial && (
                <div className="pl-4 border-l border-white/10 ml-2">
                    <Toggle 
                    label="Orbit Paths" 
                    active={state.showTrajectories} 
                    onClick={() => updateState({ showTrajectories: !state.showTrajectories })} 
                    />
                </div>
             )}
          </div>
          
           <div className="border-t border-white/10 pt-3 mt-2">
              <div className="flex items-center gap-2 text-indigo-300/80 mb-2">
                <Palette size={14} />
                <span className="text-xs font-semibold">Visual Style</span>
             </div>
             <div className="flex bg-black/40 rounded-lg p-1">
                <button 
                    onClick={() => updateState({ colorTheme: 'scientific' })}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-all ${state.colorTheme === 'scientific' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Scientific
                </button>
                <button 
                    onClick={() => updateState({ colorTheme: 'cosmic' })}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-all ${state.colorTheme === 'cosmic' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Cosmic
                </button>
             </div>
           </div>
        </GlassPanel>
      </div>

      {/* Bottom Scientists */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2 sm:gap-4 overflow-x-auto max-w-[95vw] pb-2">
         {SCIENTISTS.map((s) => (
             <button
                key={s.id}
                onClick={() => setSelectedScientist(s)}
                className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 hover:border-indigo-500 transition-all min-w-max"
             >
                <Info size={14} className="text-indigo-400" />
                <span className="text-sm font-medium">{s.name}</span>
             </button>
         ))}
      </div>

      {/* Modal */}
      {selectedScientist && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-[#0f172a] border border-indigo-500/30 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-300">
                <button 
                    onClick={() => setSelectedScientist(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <Maximize className="rotate-45" size={24} />
                </button>
                
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-1">
                    {selectedScientist.name}
                </h2>
                <p className="text-sm text-gray-500 mb-6">{selectedScientist.dates}</p>
                
                <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-lg border-l-2 border-indigo-500">
                        <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">Contribution</h3>
                        <p className="text-gray-300 leading-relaxed text-sm">{selectedScientist.contribution}</p>
                    </div>
                    
                    <div className="relative p-4">
                         <span className="absolute top-0 left-0 text-4xl text-white/10 font-serif">"</span>
                         <p className="text-lg text-white font-serif italic text-center px-4">
                            {selectedScientist.quote}
                         </p>
                         <span className="absolute bottom-0 right-0 text-4xl text-white/10 font-serif">"</span>
                    </div>
                </div>
             </div>
        </div>
      )}
    </>
  );
};
