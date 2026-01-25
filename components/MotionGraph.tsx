
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Point } from '../types';

interface MotionGraphProps {
  path: Point[];
}

const MotionGraph: React.FC<MotionGraphProps> = ({ path }) => {
  const chartData = useMemo(() => {
    return path.map(p => ({
      ...p,
      yDisplay: 100 - p.y // Revert for Cartesian view (0,0 is bottom-left)
    }));
  }, [path]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl font-mono">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Data Point @ {data.timestamp.toFixed(2)}s</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-[10px] text-slate-400">X Position:</span>
            <span className="text-[10px] text-white font-bold">{data.x.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">Y Position:</span>
            <span className="text-[10px] text-white font-bold">{data.yDisplay.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">Tilt Angle:</span>
            <span className="text-[10px] text-indigo-400 font-bold">{data.angle.toFixed(1)}°</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl h-[450px]">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Kinematic Trace</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Time-Series Displacement</p>
        </div>
        <div className="flex gap-4">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Object Path</span>
           </div>
        </div>
      </div>
      
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
            <XAxis 
              type="number" 
              dataKey="x" 
              name="X" 
              unit="%" 
              stroke="#475569" 
              domain={[0, 100]} 
              tick={{ fontSize: 10, fontWeight: 'bold' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              type="number" 
              dataKey="yDisplay" 
              name="Y" 
              unit="%" 
              stroke="#475569" 
              domain={[0, 100]} 
              tick={{ fontSize: 10, fontWeight: 'bold' }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" range={[100, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter 
              name="Path" 
              data={chartData} 
              fill="#10b981" 
              line={{ stroke: '#10b981', strokeWidth: 3, strokeDasharray: '5 5' }}
              shape={(props: any) => {
                const { cx, cy } = props;
                return (
                  <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="#064e3b" strokeWidth={1} />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 flex justify-between items-center px-4 py-3 bg-slate-950/50 rounded-2xl border border-slate-800">
         <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Projection Mode: 2D Cartesian</span>
         <div className="flex gap-6">
            <div className="flex flex-col">
               <span className="text-[8px] font-bold text-slate-500 uppercase">Start</span>
               <span className="text-xs font-black text-white italic">{path[0]?.x.toFixed(0)}%, {(100 - path[0]?.y).toFixed(0)}%</span>
            </div>
            <div className="flex flex-col">
               <span className="text-[8px] font-bold text-slate-500 uppercase">End</span>
               <span className="text-xs font-black text-white italic">{path[path.length-1]?.x.toFixed(0)}%, {(100 - path[path.length-1]?.y).toFixed(0)}%</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MotionGraph;
