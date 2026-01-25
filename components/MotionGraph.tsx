
import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Point } from '../types';

interface MotionGraphProps {
  path: Point[];
}

const MotionGraph: React.FC<MotionGraphProps> = ({ path }) => {
  // Flip Y for traditional graph view (top is higher y)
  const chartData = path.map(p => ({
    ...p,
    yDisplay: 100 - p.y
  }));

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl h-80">
      <h3 className="text-lg font-semibold mb-4 text-emerald-300">Trajectory Analysis</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" dataKey="x" name="X Position" unit="%" stroke="#94a3b8" domain={[0, 100]} />
          <YAxis type="number" dataKey="yDisplay" name="Y Position" unit="%" stroke="#94a3b8" domain={[0, 100]} />
          <ZAxis type="number" range={[50, 400]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter 
            name="Path" 
            data={chartData} 
            fill="#10b981" 
            line={{ stroke: '#10b981', strokeWidth: 2 }}
            shape="circle" 
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MotionGraph;
