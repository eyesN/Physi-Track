
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Force, Point } from '../types';
import { Activity, Sigma, Settings2, MoveRight, Thermometer } from 'lucide-react';

interface FBDCanvasProps {
  forces: Force[];
  objectName: string;
  path: Point[];
}

const FBDCanvas: React.FC<FBDCanvasProps> = ({ forces, objectName, path }) => {
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0, angle: 0, velocity: 0 });
  const [muStatic, setMuStatic] = useState(0.5);
  const [muKinetic, setMuKinetic] = useState(0.3);
  const [showSettings, setShowSettings] = useState(false);
  const requestRef = useRef<number>(0);

  // Transform coordinates so start is (0,0) and Y increases upwards
  const transformedPath = useMemo(() => {
    if (path.length === 0) return [];
    const x0 = path[0].x;
    const y0 = path[0].y;
    
    return path.map(p => ({
      ...p,
      relX: p.x - x0,
      relY: -(p.y - y0) // Flip Y so positive is up
    }));
  }, [path]);

  // Identify key forces for dynamic calculations
  const normalForce = useMemo(() => 
    forces.find(f => f.name.toLowerCase().includes('normal') || f.name.toLowerCase().includes('contact')),
    [forces]
  );

  // Logic to determine if object is moving and adjust friction
  const frictionState = useMemo(() => {
    const isMoving = Math.abs(currentPos.velocity) > 0.5;
    const coefficient = isMoving ? muKinetic : muStatic;
    const type = isMoving ? 'Kinetic' : 'Static';
    return { isMoving, coefficient, type };
  }, [currentPos.velocity, muStatic, muKinetic]);

  const filteredForces = useMemo(() => {
    return forces.map(f => {
      const name = f.name.toLowerCase();
      const isFriction = name.includes('friction');
      const isContactForce = name.includes('normal') || name.includes('contact') || isFriction;

      // Handle contact forces disappearance if airborne
      if (isContactForce && currentPos.y > 5.0) {
        return { ...f, magnitude: 0 };
      }

      // Enhance Friction based on Normal Force and current state
      if (isFriction && normalForce) {
        // Friction magnitude = mu * Normal
        const enhancedMagnitude = frictionState.coefficient * normalForce.magnitude;
        return { 
          ...f, 
          magnitude: enhancedMagnitude,
          name: `${frictionState.type} Friction` 
        };
      }
      return f;
    }).filter(f => f.magnitude > 0);
  }, [forces, currentPos.y, normalForce, frictionState]);

  // Calculate Net Force (Vector Sum)
  const netForce = useMemo(() => {
    let sumX = 0;
    let sumY = 0;
    filteredForces.forEach(f => {
      const rad = (f.direction * Math.PI) / 180;
      sumX += f.magnitude * Math.cos(rad);
      sumY += f.magnitude * Math.sin(rad);
    });
    
    const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
    const direction = Math.atan2(sumY, sumX) * (180 / Math.PI);
    
    return { magnitude, direction, name: 'Net Force', color: '#10b981' };
  }, [filteredForces]);

  // Animation Loop with Velocity Calculation
  useEffect(() => {
    if (transformedPath.length < 2) return;

    const startTime = performance.now();
    const duration = (transformedPath[transformedPath.length - 1].timestamp - transformedPath[0].timestamp) * 1000;

    const animate = (time: number) => {
      const elapsed = (time - startTime) % (duration + 1000);
      const currentSimTime = (elapsed / 1000) + transformedPath[0].timestamp;

      let p1 = transformedPath[0];
      let p2 = transformedPath[transformedPath.length - 1];
      let idx = 0;
      
      for (let i = 0; i < transformedPath.length - 1; i++) {
        if (currentSimTime >= transformedPath[i].timestamp && currentSimTime <= transformedPath[i+1].timestamp) {
          p1 = transformedPath[i];
          p2 = transformedPath[i+1];
          idx = i;
          break;
        }
      }

      const getLerpState = (pA: any, pB: any, t: number) => {
        const ratio = (t - pA.timestamp) / (pB.timestamp - pA.timestamp);
        // Calculate velocity as distance / time between current path segment
        const dist = Math.sqrt(Math.pow(pB.relX - pA.relX, 2) + Math.pow(pB.relY - pA.relY, 2));
        const dt = pB.timestamp - pA.timestamp;
        const v = dt > 0 ? dist / dt : 0;

        return {
          x: pA.relX + (pB.relX - pA.relX) * ratio,
          y: pA.relY + (pB.relY - pA.relY) * ratio,
          angle: (pA.angle ?? 0) + ((pB.angle ?? 0) - (pA.angle ?? 0)) * ratio,
          velocity: v
        };
      };

      if (currentSimTime <= transformedPath[0].timestamp) {
        setCurrentPos({ x: transformedPath[0].relX, y: transformedPath[0].relY, angle: transformedPath[0].angle || 0, velocity: 0 });
      } else if (currentSimTime >= transformedPath[transformedPath.length - 1].timestamp) {
        setCurrentPos({ x: transformedPath[transformedPath.length - 1].relX, y: transformedPath[transformedPath.length - 1].relY, angle: transformedPath[transformedPath.length - 1].angle || 0, velocity: 0 });
      } else {
        setCurrentPos(getLerpState(p1, p2, currentSimTime));
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [transformedPath]);

  // Scaling logic
  const forceRenderScale = useMemo(() => {
    const all = [...filteredForces];
    if (netForce.magnitude > 0) all.push(netForce);
    if (all.length === 0) return 1;
    const maxMag = Math.max(...all.map(f => f.magnitude));
    return maxMag === 0 ? 1 : 18 / maxMag; 
  }, [filteredForces, netForce]);

  const fbdViewBox = `-35 -35 70 70`;

  return (
    <div className="flex flex-col bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden font-mono">
      <div className="relative aspect-square md:aspect-video bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-center">
        {/* Settings Toggle */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`absolute top-6 left-6 z-10 p-3 rounded-xl border transition-all ${showSettings ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Settings2 className="w-5 h-5" />
        </button>

        {/* Dynamic Coefficients Panel */}
        {showSettings && (
          <div className="absolute top-20 left-6 z-10 w-64 bg-slate-900/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-left-4">
             <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Material Properties</h5>
             <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Static (μs)</span>
                    <span className="text-xs font-black text-white">{muStatic.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={muStatic} onChange={(e) => setMuStatic(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Kinetic (μk)</span>
                    <span className="text-xs font-black text-white">{muKinetic.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01" 
                    value={muKinetic} onChange={(e) => setMuKinetic(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
             </div>
             <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Active Mode</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${frictionState.isMoving ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                    {frictionState.type.toUpperCase()}
                  </span>
                </div>
             </div>
          </div>
        )}

        {/* Trajectory Thumbnail */}
        {!showSettings && (
          <div className="absolute top-6 left-20 w-32 h-32 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden pointer-events-none opacity-40">
            <svg viewBox="0 0 100 100" className="w-full h-full">
                <path
                  d={`M ${path.map(p => `${p.x},${p.y}`).join(' L ')}`}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                />
                <circle cx={currentPos.x + (path[0]?.x || 0)} cy={-currentPos.y + (path[0]?.y || 0)} r="4" fill="#ef4444" />
            </svg>
            <div className="absolute bottom-2 left-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Global Path</div>
          </div>
        )}

        {/* Main FBD Engine */}
        <svg viewBox={fbdViewBox} className="w-full h-full overflow-visible">
          <defs>
            {filteredForces.map((f, i) => (
              <marker key={i} id={`head-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={f.color} />
              </marker>
            ))}
            <marker id="head-net" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={netForce.color} />
            </marker>
          </defs>
          
          <line x1="-30" y1="0" x2="30" y2="0" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="-30" x2="0" y2="30" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />

          {filteredForces.map((f, i) => {
            const rad = (f.direction * Math.PI) / 180;
            const length = f.magnitude * forceRenderScale;
            const tx = Math.cos(rad) * length;
            const ty = -Math.sin(rad) * length;

            return (
              <g key={i}>
                <line 
                  x1="0" y1="0" x2={tx} y2={ty} 
                  stroke={f.color} strokeWidth="1.5" strokeLinecap="round"
                  markerEnd={`url(#head-${i})`}
                />
                <text 
                  x={tx * 1.25} y={ty * 1.25} 
                  fill={f.color} fontSize="2.8" fontWeight="bold" 
                  textAnchor="middle" alignmentBaseline="middle"
                  className="uppercase tracking-tighter"
                >
                  {f.name}
                </text>
              </g>
            );
          })}

          {netForce.magnitude > 0.1 && (
            <g opacity="0.3">
               <line 
                  x1="0" y1="0" 
                  x2={Math.cos(netForce.direction * Math.PI / 180) * netForce.magnitude * forceRenderScale} 
                  y2={-Math.sin(netForce.direction * Math.PI / 180) * netForce.magnitude * forceRenderScale} 
                  stroke={netForce.color} strokeWidth="2.5" strokeDasharray="2,1"
                  markerEnd="url(#head-net)"
               />
            </g>
          )}

          <g transform={`rotate(${currentPos.angle || 0})`}>
            <rect 
              x="-5" y="-5" width="10" height="10" 
              rx="2" 
              fill="#f8fafc" 
              stroke="#cbd5e1"
              strokeWidth="0.8"
              className="drop-shadow-2xl"
            />
            <circle cx="0" cy="0" r="1.2" fill="#475569" />
          </g>
        </svg>

        <div className="absolute top-6 right-6 flex flex-col items-end gap-3">
          <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
             <Sigma className="w-4 h-4 text-emerald-400" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Vector</span>
                <span className="text-sm font-black text-white italic">ΣF: {netForce.magnitude.toFixed(2)}N</span>
             </div>
          </div>
          <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
             <MoveRight className={`w-4 h-4 ${frictionState.isMoving ? 'text-cyan-400' : 'text-slate-600'}`} />
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Velocity</span>
                <span className="text-sm font-black text-white italic">{currentPos.velocity.toFixed(1)} m/s</span>
             </div>
          </div>
        </div>
      </div>

      <div className="p-8 bg-slate-900/40 backdrop-blur-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
             <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
                <Activity className="w-5 h-5 text-indigo-400" />
             </div>
             <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                  {objectName} Dynamic Analysis
                </h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Coefficient-Driven Resolved Vectors</p>
             </div>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">State</p>
                <p className={`text-lg font-black italic ${frictionState.isMoving ? 'text-cyan-400' : 'text-indigo-400'}`}>
                  {frictionState.type}
                </p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filteredForces.map((f, i) => (
            <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 group transition-all hover:bg-slate-800/80">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }}></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{f.name}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-lg font-black text-white">{f.magnitude.toFixed(1)}<span className="text-[10px] ml-0.5 text-slate-500 italic">N</span></span>
                <span className="text-[10px] font-bold text-slate-500">{f.direction}°</span>
              </div>
            </div>
          ))}
          {/* Active mu display */}
          <div className="flex flex-col p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
             <div className="flex items-center gap-2 mb-2">
                <Thermometer className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Coeff.</span>
             </div>
             <div className="flex justify-between items-end">
                <span className="text-lg font-black text-indigo-400">μ: {frictionState.coefficient.toFixed(2)}</span>
                <span className="text-[10px] font-bold text-slate-500">RES</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FBDCanvas;
