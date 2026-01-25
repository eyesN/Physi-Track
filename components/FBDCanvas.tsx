
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Force, Point } from '../types';
import { Activity } from 'lucide-react';

interface FBDCanvasProps {
  forces: Force[];
  objectName: string;
  path: Point[];
}

const FBDCanvas: React.FC<FBDCanvasProps> = ({ forces, objectName, path }) => {
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0, angle: 0 });
  const requestRef = useRef<number>(0);
  const forceScale = 40;

  // Transform coordinates so start is (0,0) and Y increases upwards
  const transformedPath = useMemo(() => {
    if (path.length === 0) return [];
    const x0 = path[0].x;
    const y0 = path[0].y;
    
    return path.map(p => ({
      ...p,
      relX: p.x - x0,
      relY: -(p.y - y0) // Invert Y: screen down is negative, up is positive
    }));
  }, [path]);

  // Find bounds for scaling the graph
  const bounds = useMemo(() => {
    if (transformedPath.length === 0) return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const xs = transformedPath.map(p => p.relX);
    const ys = transformedPath.map(p => p.relY);
    return {
      minX: Math.min(0, ...xs) - 5,
      maxX: Math.max(0, ...xs) + 5,
      minY: Math.min(0, ...ys) - 5,
      maxY: Math.max(0, ...ys) + 5
    };
  }, [transformedPath]);

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

      if (currentSimTime <= transformedPath[0].timestamp) {
        setCurrentPos({ x: transformedPath[0].relX, y: transformedPath[0].relY, angle: transformedPath[0].angle || 0 });
      } else if (currentSimTime >= transformedPath[transformedPath.length - 1].timestamp) {
        setCurrentPos({ x: transformedPath[transformedPath.length - 1].relX, y: transformedPath[transformedPath.length - 1].relY, angle: transformedPath[transformedPath.length - 1].angle || 0 });
      } else {
        const ratio = (currentSimTime - p1.timestamp) / (p2.timestamp - p1.timestamp);
        setCurrentPos({
          x: p1.relX + (p2.relX - p1.relX) * ratio,
          y: p1.relY + (p2.relY - p1.relY) * ratio,
          angle: (p1.angle ?? 0) + ((p2.angle ?? 0) - (p1.angle ?? 0)) * ratio
        });
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [transformedPath]);

  // Viewbox setup for SVG
  const width = 100;
  const height = width * 0.5625; // 16:9
  const viewBox = `${bounds.minX} ${-bounds.maxY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;

  return (
    <div className="flex flex-col bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden font-mono">
      <div className="relative aspect-video bg-slate-950 p-4 border-b border-slate-800">
        {/* Grid and Axes are drawn in SVG to stay relative */}
        <svg viewBox={viewBox} className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
            </pattern>
            <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
              <rect width="25" height="25" fill="url(#smallGrid)"/>
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#334155" strokeWidth="1"/>
            </pattern>
          </defs>
          
          <rect x={bounds.minX} y={-bounds.maxY} width={bounds.maxX - bounds.minX} height={bounds.maxY - bounds.minY} fill="url(#grid)" />
          
          {/* Axes */}
          <line x1={bounds.minX} y1="0" x2={bounds.maxX} y2="0" stroke="#475569" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1={-bounds.maxY} x2="0" y2={-bounds.minY} stroke="#475569" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Trajectory Curve */}
          <path
            d={`M ${transformedPath.map(p => `${p.relX},${-p.relY}`).join(' L ')}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="1"
            strokeLinejoin="round"
            className="opacity-40"
          />

          {/* Animated Object & FBD */}
          <g transform={`translate(${currentPos.x}, ${-currentPos.y})`}>
            {/* Origin Point Indicator at (0,0) */}
            <circle cx={-currentPos.x} cy={currentPos.y} r="0.8" fill="#ef4444" className="opacity-50" />
            
            <g transform={`rotate(${currentPos.angle || 0})`}>
              <rect 
                x="-3" y="-3" width="6" height="6" 
                rx="1" 
                fill="#f8fafc" 
                className="shadow-2xl"
              />
              
              {/* Force Vectors */}
              {forces.map((force, index) => {
                const rad = (force.direction * Math.PI) / 180;
                // Counter-rotate the force so it stays in global physics frame
                const globalRad = rad - ((currentPos.angle || 0) * Math.PI / 180);
                const targetX = Math.cos(globalRad) * force.magnitude * 2; // scaled for SVG units
                const targetY = -Math.sin(globalRad) * force.magnitude * 2;

                return (
                  <g key={index}>
                    <line
                      x1="0" y1="0"
                      x2={targetX} y2={targetY}
                      stroke={force.color}
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      markerEnd={`url(#arrowhead-${index})`}
                    />
                    <defs>
                      <marker
                        id={`arrowhead-${index}`}
                        markerWidth="4"
                        markerHeight="3"
                        refX="4"
                        refY="1.5"
                        orient="auto"
                      >
                        <polygon points="0 0, 4 1.5, 0 3" fill={force.color} />
                      </marker>
                    </defs>
                    <g transform={`rotate(${-currentPos.angle || 0}, ${targetX * 1.5}, ${targetY * 1.5})`}>
                      <text
                        x={targetX * 1.5}
                        y={targetY * 1.5}
                        fill={force.color}
                        fontSize="2"
                        fontWeight="900"
                        textAnchor="middle"
                        className="uppercase"
                      >
                        {force.name}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </g>

          {/* Labels for origin */}
          <text x="1" y="-1" fill="#ef4444" fontSize="2" fontWeight="bold">(0,0)</text>
        </svg>

        <div className="absolute top-6 left-6 flex flex-col gap-1">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Cartesian Motion Model</span>
          <span className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.3em]">Origin Shifted to T=0</span>
        </div>
      </div>

      <div className="p-8 bg-slate-900/40 backdrop-blur-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
             <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                <Activity className="w-5 h-5 text-emerald-400" />
             </div>
             <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                  {objectName} Pathing
                </h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Dynamic Equilibrium Analysis</p>
             </div>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">X-Delta</p>
                <p className="text-xl font-black text-white italic">{currentPos.x.toFixed(1)}</p>
             </div>
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Y-Delta</p>
                <p className="text-xl font-black text-white italic">{currentPos.y.toFixed(1)}</p>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {forces.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }}></div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{f.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FBDCanvas;
