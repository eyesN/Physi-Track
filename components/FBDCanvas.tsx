
import React from 'react';
import { Force } from '../types';

interface FBDCanvasProps {
  forces: Force[];
  objectName: string;
}

const FBDCanvas: React.FC<FBDCanvasProps> = ({ forces, objectName }) => {
  const size = 300;
  const center = size / 2;
  const scale = 50; // pixels per unit of magnitude

  return (
    <div className="flex flex-col items-center bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl">
      <h3 className="text-lg font-semibold mb-4 text-indigo-300">Free Body Diagram: {objectName}</h3>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* The Object (Central Node) */}
        <circle cx={center} cy={center} r="10" fill="white" className="animate-pulse" />
        
        {/* Forces */}
        {forces.map((force, index) => {
          const rad = (force.direction * Math.PI) / 180;
          // In SVG, y increases downwards, so we negate the sin component for "up" to be negative Y
          const targetX = center + Math.cos(rad) * force.magnitude * scale;
          const targetY = center - Math.sin(rad) * force.magnitude * scale;

          return (
            <g key={index}>
              <line
                x1={center}
                y1={center}
                x2={targetX}
                y2={targetY}
                stroke={force.color}
                strokeWidth="4"
                markerEnd={`url(#arrowhead-${index})`}
              />
              <defs>
                <marker
                  id={`arrowhead-${index}`}
                  markerWidth="10"
                  markerHeight="7"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill={force.color} />
                </marker>
              </defs>
              <text
                x={targetX + (targetX > center ? 10 : -70)}
                y={targetY + (targetY > center ? 15 : -10)}
                fill={force.color}
                fontSize="12"
                fontWeight="bold"
                className="select-none"
              >
                {force.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-8 grid grid-cols-2 gap-4 w-full">
        {forces.map((f, i) => (
          <div key={i} className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: f.color }}></div>
            <span className="text-slate-300 font-medium">{f.name}:</span>
            <span className="text-slate-400">{f.magnitude.toFixed(1)} N @ {f.direction}°</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FBDCanvas;
