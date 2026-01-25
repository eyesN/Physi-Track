
import React, { useRef, useEffect, useState } from 'react';
import { Force, Point } from '../types';

interface FBDCanvasProps {
  forces: Force[];
  objectName: string;
  videoSrc: string | null;
  path: Point[];
}

const FBDCanvas: React.FC<FBDCanvasProps> = ({ forces, objectName, videoSrc, path }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentPos, setCurrentPos] = useState<Point>(path[0] || { x: 50, y: 50, angle: 0, timestamp: 0 });
  const requestRef = useRef<number>(0);
  const scale = 50;

  // Linear interpolation for smooth movement
  const interpolate = (p1: Point, p2: Point, time: number) => {
    const ratio = (time - p1.timestamp) / (p2.timestamp - p1.timestamp);
    return {
      x: p1.x + (p2.x - p1.x) * ratio,
      y: p1.y + (p2.y - p1.y) * ratio,
      angle: (p1.angle ?? 0) + ((p2.angle ?? 0) - (p1.angle ?? 0)) * ratio,
      timestamp: time
    };
  };

  const updateFrame = () => {
    if (videoRef.current && path.length > 1) {
      const time = videoRef.current.currentTime;
      
      // Find bounding points
      let p1 = path[0];
      let p2 = path[path.length - 1];
      
      for (let i = 0; i < path.length - 1; i++) {
        if (time >= path[i].timestamp && time <= path[i+1].timestamp) {
          p1 = path[i];
          p2 = path[i+1];
          break;
        }
      }

      // If time is before first or after last, clamp
      if (time <= path[0].timestamp) {
        setCurrentPos(path[0]);
      } else if (time >= path[path.length - 1].timestamp) {
        setCurrentPos(path[path.length - 1]);
      } else {
        setCurrentPos(interpolate(p1, p2, time));
      }
    }
    requestRef.current = requestAnimationFrame(updateFrame);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [path]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play();
    }
  }, [videoSrc]);

  return (
    <div className="flex flex-col bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden group">
      <div className="relative aspect-video bg-black">
        {videoSrc && (
          <video 
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain opacity-70"
            loop
            muted
            playsInline
          />
        )}
        
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {/* Fading Trail */}
          <polyline
            points={path.map(p => `${p.x}%,${p.y}%`).join(' ')}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4,4"
            className="opacity-20"
          />
          
          {/* Dynamic FBD Hub */}
          <g transform={`translate(${currentPos.x}%, ${currentPos.y}%) rotate(${currentPos.angle || 0})`}>
             {/* Object Representation */}
             <rect 
               x="-15" y="-15" width="30" height="30" 
               rx="4" 
               fill="white" 
               className="shadow-xl" 
               style={{ filter: 'drop-shadow(0px 0px 8px rgba(255,255,255,0.4))' }}
             />
             
             {/* Dynamic Forces - Arrows that rotate with tilt or remain static based on direction */}
             {forces.map((force, index) => {
                const rad = (force.direction * Math.PI) / 180;
                // Arrows always point in global physics direction, regardless of tilt
                // So we counteract the parent rotation
                const globalRad = rad - ((currentPos.angle || 0) * Math.PI / 180);
                const targetX = Math.cos(globalRad) * force.magnitude * scale;
                const targetY = -Math.sin(globalRad) * force.magnitude * scale;

                return (
                  <g key={index}>
                    <line
                      x1="0" y1="0"
                      x2={targetX} y2={targetY}
                      stroke={force.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      markerEnd={`url(#arrowhead-${index})`}
                    />
                    <defs>
                      <marker
                        id={`arrowhead-${index}`}
                        markerWidth="8"
                        markerHeight="6"
                        refX="8"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 8 3, 0 6" fill={force.color} />
                      </marker>
                    </defs>
                    <g transform={`rotate(${-currentPos.angle || 0}, ${targetX * 1.3}, ${targetY * 1.3})`}>
                      <text
                        x={targetX * 1.3}
                        y={targetY * 1.3}
                        fill={force.color}
                        fontSize="9"
                        fontWeight="black"
                        textAnchor="middle"
                        className="drop-shadow-md select-none uppercase"
                      >
                        {force.name}
                      </text>
                    </g>
                  </g>
                );
             })}
          </g>
        </svg>

        <div className="absolute top-4 right-4 bg-emerald-500/90 text-slate-950 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase">
          Live Tracking Enabled
        </div>
      </div>

      <div className="p-5 bg-slate-900/60 backdrop-blur-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-white uppercase italic tracking-wider">
            Vector Dynamics: {objectName}
          </h3>
          <span className="text-[10px] font-mono text-slate-500">TILT: {currentPos.angle?.toFixed(1)}°</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {forces.map((f, i) => (
            <div key={i} className="flex items-center p-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <div className="w-1.5 h-6 rounded-full mr-3 shrink-0" style={{ backgroundColor: f.color }}></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-200 uppercase tracking-tighter">{f.name}</span>
                <span className="text-[9px] font-bold text-slate-500">{f.magnitude.toFixed(2)} N</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FBDCanvas;
