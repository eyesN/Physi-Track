
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Force, Point } from '../types';
import { Activity, Sigma } from 'lucide-react';

interface FBDCanvasProps {
  forces: Force[];
  objectName: string;
  path: Point[];
}

const FBDCanvas: React.FC<FBDCanvasProps> = ({ forces, objectName, path }) => {
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0, angle: 0 });
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

  // Dynamic ground level logic: if object is above its starting position, it's potentially airborne.
  const filteredForces = useMemo(() => {
    return forces.filter(f => {
      const name = f.name.toLowerCase();
      const isContactForce = name.includes('normal') || name.includes('contact') || name.includes('friction');
      if (isContactForce) {
        // If the object has moved up significantly from its origin, contact forces vanish.
        return currentPos.y <= 2.0; 
      }
      return true;
    });
  }, [forces, currentPos.y]);

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

  // Animation Loop
  useEffect(() => {
    if (transformedPath.length < 2) return;

    const startTime = performance.now();
    const duration = (transformedPath[transformedPath.length - 1].timestamp - transformedPath[0].timestamp) * 1000;

    const animate = (time: number) => {
      const elapsed = (time - startTime) % (duration + 1000);
      const currentSimTime = (elapsed / 1000) + transformedPath[0].timestamp;

      let p1 = transformedPath[0];
      let p2 = transformedPath[transformedPath.length - 1];
      
      for (let i = 0; i < transformedPath.length - 1; i++) {
        if (currentSimTime >= transformedPath[i].timestamp && currentSimTime <= transformedPath[i+1].timestamp) {
          p1 = transformedPath[i];
          p2 = transformedPath[i+1];
          break;
        }
      }

      const getLerpPos = (pA: any, pB: any, t: number) => {
        const ratio = (t - pA.timestamp) / (pB.timestamp - pA.timestamp);
        return {
          x: pA.relX + (pB.relX - pA.relX) * ratio,
          y: pA.relY + (pB.relY - pA.relY) * ratio,
          angle: (pA.angle ?? 0) + ((pB.angle ?? 0) - (pA.angle ?? 0)) * ratio
        };
      };

      if (currentSimTime <= transformedPath[0].timestamp) {
        setCurrentPos({ x: transformedPath[0].relX, y: transformedPath[0].relY, angle: transformedPath[0].angle || 0 });
      } else if (currentSimTime >= transformedPath[transformedPath.length - 1].timestamp) {
        setCurrentPos({ x: transformedPath[transformedPath.length - 1].relX, y: transformedPath[transformedPath.length - 1].relY, angle: transformedPath[transformedPath.length - 1].angle || 0 });
      } else {
        setCurrentPos(getLerpPos(p1, p2, currentSimTime));
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
    return maxMag === 0 ? 1 : 15 / maxMag; // Target max arrow length of 15 units
  }, [filteredForces, netForce]);

  // Standard FBD Viewport (Centered on object)
  const fbdViewBox = `-30 -30 60 60`;

  return (
    <div className="flex flex-col bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden font-mono">
      <div className="relative aspect-square md:aspect-video bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-center">
        {/* Trajectory Thumbnail (Small inset) */}
        <div className="absolute top-6 left-6 w-32 h-32 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden pointer-events-none opacity-40">
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

        {/* Main FBD Engine */}
        <svg viewBox={fbdViewBox} className="w-full h-full overflow-visible">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="context-fill" />
            </marker>
            {filteredForces.map((f, i) => (
              <marker key={i} id={`head-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={f.color} />
              </marker>
            ))}
            <marker id="head-net" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={netForce.color} />
            </marker>
          </defs>
          
          {/* Reference Crosshairs */}
          <line x1="-25" y1="0" x2="25" y2="0" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="-25" x2="0" y2="25" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Forces (Drawn from Center, Absolute Directions) */}
          {filteredForces.map((f, i) => {
            const rad = (f.direction * Math.PI) / 180;
            const length = f.magnitude * forceRenderScale;
            const tx = Math.cos(rad) * length;
            const ty = -Math.sin(rad) * length; // SVG Y is down

            return (
              <g key={i}>
                <line 
                  x1="0" y1="0" x2={tx} y2={ty} 
                  stroke={f.color} strokeWidth="1.2" strokeLinecap="round"
                  markerEnd={`url(#head-${i})`}
                />
                <text 
                  x={tx * 1.2} y={ty * 1.2} 
                  fill={f.color} fontSize="2.5" fontWeight="bold" 
                  textAnchor="middle" alignmentBaseline="middle"
                  className="uppercase tracking-tighter"
                >
                  {f.name}
                </text>
              </g>
            );
          })}

          {/* Net Force Vector (Optional/Distinct) */}
          {netForce.magnitude > 0.1 && (
            <g opacity="0.4">
               <line 
                  x1="0" y1="0" 
                  x2={Math.cos(netForce.direction * Math.PI / 180) * netForce.magnitude * forceRenderScale} 
                  y2={-Math.sin(netForce.direction * Math.PI / 180) * netForce.magnitude * forceRenderScale} 
                  stroke={netForce.color} strokeWidth="2" strokeDasharray="2,1"
                  markerEnd="url(#head-net)"
               />
            </g>
          )}

          {/* The Object (Rotated according to motion) */}
          <g transform={`rotate(${currentPos.angle || 0})`}>
            <rect 
              x="-4" y="-4" width="8" height="8" 
              rx="1.5" 
              fill="#f8fafc" 
              stroke="#cbd5e1"
              strokeWidth="0.5"
              className="drop-shadow-lg"
            />
            {/* Center of Mass point */}
            <circle cx="0" cy="0" r="0.8" fill="#475569" />
          </g>
        </svg>

        <div className="absolute top-6 right-6 flex flex-col items-end">
          <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
             <Sigma className="w-4 h-4 text-emerald-400" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Force Vector</span>
                <span className="text-sm font-black text-white italic">ΣF: {netForce.magnitude.toFixed(2)}N @ {netForce.direction.toFixed(0)}°</span>
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
                  {objectName} Mechanics
                </h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Inertial Frame Resolution</p>
             </div>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">X-Pos</p>
                <p className="text-xl font-black text-white italic">{currentPos.x.toFixed(1)}%</p>
             </div>
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tilt</p>
                <p className="text-xl font-black text-white italic">{(currentPos.angle || 0).toFixed(0)}°</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filteredForces.map((f, i) => (
            <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 group transition-all hover:bg-slate-800/80">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }}></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{f.name}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-lg font-black text-white">{f.magnitude.toFixed(1)}<span className="text-[10px] ml-0.5 text-slate-500 italic">N</span></span>
                <span className="text-[10px] font-bold text-slate-500">{f.direction}°</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FBDCanvas;
