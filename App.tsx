
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Activity, RefreshCw, AlertCircle, Play, Square, FileVideo, Loader2, ChevronRight, Zap, ShieldCheck } from 'lucide-react';
import { analyzeMotion } from './services/analysisService';
import { Point, Force, PhysicsAnalysis, AppState } from './types';
import FBDCanvas from './components/FBDCanvas';
import MotionGraph from './components/MotionGraph';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [cameraActive, setCameraActive] = useState(false);
  const [analysis, setAnalysis] = useState<PhysicsAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingInterval = useRef<number | null>(null);
  const framesRef = useRef<{ data: string; timestamp: number }[]>([]);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        setCameraActive(true);
        setAppState(AppState.IDLE);
      }
    } catch (err) {
      setError("Camera access was denied or is unavailable. Please check your browser permissions.");
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingInterval.current) window.clearInterval(recordingInterval.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = () => {
    setAppState(AppState.RECORDING);
    framesRef.current = [];
    
    const startTime = Date.now();
    recordingInterval.current = window.setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const scale = 0.5;
          canvasRef.current.width = videoRef.current.videoWidth * scale;
          canvasRef.current.height = videoRef.current.videoHeight * scale;
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
          framesRef.current.push({ data: dataUrl, timestamp: (Date.now() - startTime) / 1000 });
          
          if (framesRef.current.length >= 15) handleStopRecording();
        }
      }
    }, 300);
  };

  const handleStopRecording = () => {
    if (recordingInterval.current) {
      window.clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    setAppState(AppState.ANALYZING);
    performAnalysis(framesRef.current);
  };

  const performAnalysis = async (frames: { data: string; timestamp: number }[]) => {
    try {
      if (frames.length < 3) throw new Error("Capture sequence too brief.");
      const result = await analyzeMotion(frames);
      setAnalysis(result);
      setAppState(AppState.RESULTS);
    } catch (err: any) {
      setError(err.message || "Motion analysis failed.");
      setAppState(AppState.IDLE);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAppState(AppState.ANALYZING);
    setError(null);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const duration = video.duration;
      const numFrames = 15;
      const step = duration / numFrames;
      const frames: { data: string; timestamp: number }[] = [];
      let currentFrameIdx = 0;

      const captureNext = () => {
        if (currentFrameIdx >= numFrames) {
          performAnalysis(frames);
          return;
        }
        video.currentTime = currentFrameIdx * step;
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth * 0.5;
        canvas.height = video.videoHeight * 0.5;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        frames.push({ data: dataUrl, timestamp: video.currentTime });
        currentFrameIdx++;
        captureNext();
      };
      captureNext();
    };
  };

  const reset = () => {
    setAnalysis(null);
    setAppState(AppState.IDLE);
    setVideoUrl(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 antialiased selection:bg-indigo-500/30">
      <header className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
        <div className="flex items-center space-x-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-slate-900 p-4 rounded-2xl border border-white/5 shadow-2xl">
              <Activity className="w-10 h-10 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic leading-[0.8]">PhysiTrack</h1>
            <p className="text-slate-500 text-[10px] font-black tracking-[0.5em] uppercase mt-3 ml-1">Vector Modeling Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center space-x-3 bg-slate-800 hover:bg-slate-700 text-slate-100 px-8 py-4 rounded-3xl cursor-pointer transition-all border border-slate-700 font-black text-xs shadow-xl uppercase tracking-widest">
            <FileVideo className="w-4 h-4" />
            <span>Process Video</span>
            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={reset}
            className="flex items-center space-x-3 bg-slate-900 hover:bg-slate-800 text-slate-400 px-8 py-4 rounded-3xl font-black border border-slate-800 transition-all text-xs uppercase tracking-widest"
            title="Reset Simulation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-10 p-6 bg-red-950/40 border-l-8 border-red-500 rounded-r-3xl flex items-center space-x-6 text-red-100 animate-in fade-in slide-in-from-top-4 shadow-2xl">
          <AlertCircle className="w-8 h-8 shrink-0 text-red-400" />
          <p className="text-sm font-black uppercase tracking-tight">{error}</p>
        </div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-6 space-y-10">
          <div className={`relative bg-black rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] border-[10px] border-slate-900 aspect-square lg:aspect-video transition-all duration-700 ${appState === AppState.RESULTS ? 'scale-90 opacity-40 blur-sm pointer-events-none' : ''}`}>
            
            <div className={`w-full h-full bg-slate-950 transition-opacity duration-1000 ${cameraActive ? 'opacity-100' : 'opacity-100'}`}>
              <video 
                ref={videoRef} 
                className={`w-full h-full object-cover transition-opacity duration-1000 ${cameraActive ? 'opacity-100' : 'opacity-0'} ${appState === AppState.ANALYZING ? 'opacity-20' : ''}`}
                muted 
                playsInline 
              />
            </div>

            <canvas ref={canvasRef} className="hidden" />
            
            {!cameraActive && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
                 <div className="bg-slate-900/90 p-12 rounded-[3rem] border border-white/5 text-center max-w-sm shadow-2xl border-dashed border-indigo-500/30">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                       <ShieldCheck className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-4 uppercase italic tracking-tighter">Sensor Offline</h2>
                    <p className="text-slate-500 text-xs mb-10 font-bold leading-relaxed uppercase tracking-widest">Privacy control active. Grant camera permissions to initialize real-time vector sampling.</p>
                    <button 
                      onClick={startCamera}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] flex items-center justify-center space-x-4 shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Zap className="w-5 h-5 fill-indigo-200" />
                      <span>Activate Sensor</span>
                    </button>
                 </div>
               </div>
            )}

            {cameraActive && appState === AppState.IDLE && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="bg-slate-900/95 p-12 rounded-[3rem] border border-white/5 text-center max-w-sm shadow-2xl">
                  <Camera className="w-14 h-14 text-indigo-500 mx-auto mb-8" />
                  <h2 className="text-3xl font-black text-white mb-6 uppercase italic tracking-tighter">Ready to capture</h2>
                  <p className="text-slate-500 text-xs mb-12 font-bold leading-relaxed uppercase tracking-widest">Identify the target object and record its displacement. The engine will solve the vectors.</p>
                  <button 
                    onClick={startRecording}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] flex items-center justify-center space-x-4 shadow-2xl transition-all"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Initiate Scan</span>
                  </button>
                </div>
              </div>
            )}

            {appState === AppState.RECORDING && (
              <div className="absolute top-12 left-12 flex items-center space-x-6 bg-red-600 px-8 py-4 rounded-full backdrop-blur-2xl shadow-2xl animate-pulse border border-red-400/50">
                <div className="w-5 h-5 bg-white rounded-full"></div>
                <span className="text-white font-black text-xs tracking-[0.5em] uppercase">Recording Data</span>
              </div>
            )}

            {appState === AppState.RECORDING && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
                <button 
                  onClick={handleStopRecording}
                  className="bg-white text-slate-950 px-14 py-6 rounded-[2.5rem] font-black uppercase tracking-[0.4em] flex items-center space-x-4 shadow-2xl transition-all scale-110"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>Compute</span>
                </button>
              </div>
            )}

            {appState === AppState.ANALYZING && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-3xl">
                <Loader2 className="w-24 h-24 text-indigo-500 animate-spin mb-10" />
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Neural Resolution</h2>
                <div className="mt-12 w-64 h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 animate-[loading_1.5s_infinite]" style={{ width: '40%' }}></div>
                </div>
              </div>
            )}
          </div>

          {appState === AppState.RESULTS && analysis && (
            <div className="p-10 bg-slate-900/50 rounded-[3rem] border border-slate-800/50 relative">
               <div className="absolute top-8 left-8 w-1 h-16 bg-indigo-600 rounded-full"></div>
               <h4 className="text-slate-300 font-black mb-6 uppercase italic tracking-[0.2em] ml-8">Contextual Summary</h4>
               <p className="text-slate-500 text-sm font-medium leading-loose italic ml-8">
                 {analysis.summary}
               </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 space-y-12">
          {appState === AppState.RESULTS && analysis ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-right-16 duration-1000">
              <FBDCanvas forces={analysis.forces} objectName={analysis.objectName} path={analysis.path} />
              <MotionGraph path={analysis.path} />
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-20 bg-slate-900/20 rounded-[4rem] border-4 border-dashed border-slate-800/60">
              <div className="w-24 h-24 bg-slate-800/50 rounded-[2.5rem] flex items-center justify-center mb-10">
                <ChevronRight className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-slate-500 font-black text-2xl uppercase tracking-tighter italic">Physics Playground</h3>
              <p className="text-slate-700 text-xs font-black max-w-[280px] mt-6 leading-relaxed uppercase tracking-[0.3em]">
                Capture real-world motion to reconstruct kinematic models and force diagrams.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-40 py-16 border-t border-slate-800 flex flex-col items-center">
        <div className="flex items-center space-x-6 text-slate-800 font-black italic uppercase text-[12px] tracking-[0.6em] mb-4 opacity-50">
          <Activity className="w-5 h-5" />
          <span>PhysiTrack Build 3.4.5_REL</span>
        </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
};

export default App;
