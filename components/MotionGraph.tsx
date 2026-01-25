
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Point } from '../types';
import { Zap, MoveRight } from 'lucide-react';

interface MotionGraphProps {
  path: Point[];
}

const MotionGraph: React.FC<MotionGraphProps> = ({ path }) => {
  const chartData = useMemo(() => {
    return path.map((p, i) => {
      let v = 0;
      let a = 0;

      if (i > 0) {
        const prev = path[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const dt = p.timestamp - prev.timestamp;
        const dist = Math.sqrt(dx * dx + dy * dy);
        v = dt > 0 ? dist / dt : 0;

        // Calculate acceleration if we have 3 points for a second derivative approximation
        if (i > 1) {
          const prevPrev = path[i - 2];
          const prevDx = prev.x - prevPrev.x;
          const prevDy = prev.y - prevPrev.y;
          const prevDt = prev.timestamp - prevPrev.timestamp;
          const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
          const prevV = prevDt > 0 ? prevDist / prevDt : 0;
          
          const dt2 = p.timestamp - prev.timestamp;
          a = dt2 > 0 ? (v - prevV) / dt2 : 0;
        }
      }

      return {
        ...p,
        yDisplay: 100 - p.y, // Revert for Cartesian view (0,0 is bottom-left)
        velocity: v,
        acceleration: a
      };
    });
  }, [path]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-mono min-w-[200px] animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Time Stamp</p>
               <p className="text-sm font-black text-indigo-400 italic">{data.timestamp.toFixed(2)}s</p>
            </div>
            <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tighter">Pos X</span>
                <span className="text-xs text-white font-black italic">{data.x.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-tighter">Pos Y</span>
                <span className="text-xs text-white font-black italic">{data.yDisplay.toFixed(1)}%</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-cyan-500/10 flex items-center justify-center">
                    <MoveRight className="w-3 h-3 text-cyan-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">Velocity</span>
                </div>
                <span className="text-xs text-cyan-400 font-black italic">{data.velocity.toFixed(2)} <span className="text-[8px] text-slate-600">u/s</span></span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">Acceleration</span>
                </div>
                <span className="text-xs text-amber-400 font-black italic">{data.acceleration.toFixed(2)} <span className="text-[8px] text-slate-600">u/s²</span></span>
              </div>
            </div>

            {data.angle !== undefined && (
              <div className="pt-2 flex justify-between items-center text-[10px]">
                 <span className="text-slate-500 uppercase font-black">Rotation Vector</span>
                 <span className="text-indigo-400 font-black italic">{data.angle.toFixed(1)}°</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl h-[450px] relative overflow-hidden group">
      {/* Decorative background accent */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-1000"></div>
      
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Kinematic Trace</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Time-Series Displacement Analysis</p>
        </div>
        <div className="flex gap-4">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 rounded-full border border-slate-700/50">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Calculated Vectors</span>
           </div>
        </div>
      </div>
      
      <div className="h-72 w-full relative z-10">
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
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '4 4', stroke: '#334155', strokeWidth: 1 }} />
            <Scatter 
              name="Path" 
              data={chartData} 
              fill="#10b981" 
              line={{ stroke: '#10b981', strokeWidth: 3, strokeDasharray: '6 4' }}
              shape={(props: any) => {
                const { cx, cy } = props;
                return (
                  <circle 
                    cx={cx} cy={cy} r={5} 
                    fill="#10b981" stroke="#064e3b" strokeWidth={1}
                    className="cursor-crosshair hover:r-8 transition-all duration-300 outline-none" 
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 flex justify-between items-center px-6 py-4 bg-slate-950/50 rounded-2xl border border-slate-800 relative z-10">
         <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
           Projection Mode: 2D Cartesian
         </span>
         <div className="flex gap-8">
            <div className="flex flex-col border-l border-slate-800 pl-4">
               <span className="text-[8px] font-bold text-slate-500 uppercase mb-0.5">Displacement Origin</span>
               <span className="text-xs font-black text-white italic">{path[0]?.x.toFixed(0)}%, {(100 - path[0]?.y).toFixed(0)}%</span>
            </div>
            <div className="flex flex-col border-l border-slate-800 pl-4">
               <span className="text-[8px] font-bold text-slate-500 uppercase mb-0.5">Final Terminal</span>
               <span className="text-xs font-black text-white italic">{path[path.length-1]?.x.toFixed(0)}%, {(100 - path[path.length-1]?.y).toFixed(0)}%</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MotionGraph;
