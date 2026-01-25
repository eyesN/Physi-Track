
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Activity, RefreshCw, AlertCircle, Play, Square, FileVideo, Loader2, Info, ChevronRight } from 'lucide-react';
import { analyzeMotion } from './services/geminiService';
import { Point, Force, PhysicsAnalysis, AppState } from './types';
import FBDCanvas from './components/FBDCanvas';
import MotionGraph from './components/MotionGraph';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysis, setAnalysis] = useState<PhysicsAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingInterval = useRef<number | null>(null);
  const framesRef = useRef<{ data: string; timestamp: number }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        setAppState(AppState.IDLE);
        setError(null);
      }
    } catch (err) {
      setError("Camera access denied. Check browser permissions.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (recordingInterval.current) window.clearInterval(recordingInterval.current);
    };
  }, []);

  const startRecording = () => {
    setAppState(AppState.RECORDING);
    framesRef.current = [];
    recordedChunksRef.current = [];
    
    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setVideoUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current.start();
    }

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
    }, 300); // Faster sampling for better tilt detection
  };

  const handleStopRecording = () => {
    if (recordingInterval.current) {
      window.clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
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
      setError(err.message || "Motion analysis failed. Ensure object is clearly visible.");
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
      const numFrames = 15; // Increased frames for better granularity
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
    startCamera();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 antialiased selection:bg-indigo-500/30">
      <header className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
        <div className="flex items-center space-x-5">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900 p-3.5 rounded-2xl shadow-xl border border-white/5">
              <Activity className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">PhysiTrack Pro</h1>
            <p className="text-slate-500 text-[10px] font-black tracking-[0.4em] uppercase mt-2">Dynamic Vector Intelligence</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center space-x-3 bg-slate-800 hover:bg-slate-700 text-slate-100 px-6 py-3 rounded-2xl cursor-pointer transition-all border border-slate-700 font-black text-xs shadow-lg uppercase tracking-wider">
            <FileVideo className="w-4 h-4" />
            <span>Import Footage</span>
            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={reset}
            className="flex items-center space-x-3 bg-slate-900 hover:bg-slate-800 text-slate-300 px-6 py-3 rounded-2xl font-black border border-slate-700 transition-all text-xs shadow-lg uppercase tracking-wider"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-5 bg-red-950/40 border-l-4 border-red-500 rounded-r-2xl flex items-center space-x-4 text-red-100 animate-in fade-in slide-in-from-top-4 shadow-xl">
          <AlertCircle className="w-6 h-6 shrink-0 text-red-400" />
          <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
        </div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-8">
          <div className="relative bg-slate-950 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border-[8px] border-slate-900 aspect-video group">
            {appState === AppState.RESULTS && videoUrl ? (
              <video 
                src={videoUrl} 
                className="w-full h-full object-contain"
                autoPlay 
                loop 
                muted 
                playsInline
              />
            ) : (
              <video 
                ref={videoRef} 
                className={`w-full h-full object-cover transition-opacity duration-1000 ${appState === AppState.ANALYZING ? 'opacity-10' : 'opacity-100'}`}
                muted 
                playsInline 
              />
            )}
            
            <canvas ref={canvasRef} className="hidden" />
            
            {appState === AppState.IDLE && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] transition-all duration-700">
                <div className="bg-slate-900/95 p-10 rounded-[2.5rem] border border-white/5 text-center max-w-sm animate-in zoom-in duration-700 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-indigo-500/20">
                    <Camera className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter">Ready to capture</h2>
                  <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">Position target object and initiate high-frequency tracking. Our neural engine handles the vectors.</p>
                  <button 
                    onClick={startRecording}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] flex items-center justify-center space-x-4 shadow-2xl shadow-indigo-600/40 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Start Sampling</span>
                  </button>
                </div>
              </div>
            )}

            {appState === AppState.RECORDING && (
              <div className="absolute top-10 left-10 flex items-center space-x-5 bg-red-600/90 px-6 py-3 rounded-full backdrop-blur-xl shadow-2xl animate-pulse border border-red-400/50">
                <div className="w-4 h-4 bg-white rounded-full"></div>
                <span className="text-white font-black text-xs tracking-[0.3em] uppercase">Sampling Reality</span>
              </div>
            )}

            {appState === AppState.RECORDING && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                <button 
                  onClick={handleStopRecording}
                  className="bg-white hover:bg-slate-100 text-slate-900 px-12 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] flex items-center space-x-4 shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-all scale-110 border-[6px] border-white/10"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>Finalize Buffer</span>
                </button>
              </div>
            )}

            {appState === AppState.ANALYZING && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-3xl">
                <div className="relative mb-12">
                  <div className="absolute inset-0 bg-indigo-500/30 blur-[100px] rounded-full animate-pulse"></div>
                  <Loader2 className="w-24 h-24 text-indigo-500 animate-spin relative" />
                </div>
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Vectorizing</h2>
                <p className="text-slate-500 font-black mt-3 uppercase tracking-[0.4em] text-[10px]">Processing Multi-Frame Dynamics</p>
                <div className="mt-16 w-80 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-indigo-500 animate-[loading_1s_infinite_ease-in-out]" style={{ width: '35%' }}></div>
                </div>
              </div>
            )}
          </div>

          {appState === AppState.RESULTS && analysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8 duration-700">
               <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors"></div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black">Velocity Scalar</p>
                    <Activity className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-4xl font-black text-white tracking-tighter italic">{analysis.calculatedVelocity.toFixed(3)} <span className="text-slate-600 text-sm not-italic font-black tracking-normal ml-1">V_unit</span></p>
               </div>
               <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors"></div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black">Net Accel.</p>
                    <ChevronRight className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-4xl font-black text-white tracking-tighter italic">{analysis.calculatedAcceleration.toFixed(3)} <span className="text-slate-600 text-sm not-italic font-black tracking-normal ml-1">A_unit</span></p>
               </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-10">
          {appState === AppState.RESULTS && analysis ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-16 duration-1000">
              <FBDCanvas forces={analysis.forces} objectName={analysis.objectName} videoSrc={videoUrl} path={analysis.path} />
              <MotionGraph path={analysis.path} />
              <div className="p-10 bg-slate-900 rounded-[2.5rem] border border-slate-800 relative shadow-2xl">
                <div className="absolute top-8 left-8 w-1 h-12 bg-indigo-600 rounded-full"></div>
                <h4 className="text-slate-100 font-black mb-6 uppercase italic tracking-wider flex items-center gap-3 ml-6">
                  Theoretical Context
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed font-medium italic ml-6">
                  {analysis.summary}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-16 bg-slate-900/40 rounded-[4rem] border-4 border-dashed border-slate-800/80 transition-all">
              <div className="bg-slate-800 p-8 rounded-[2.5rem] mb-10 shadow-2xl">
                <ChevronRight className="w-12 h-12 text-slate-500" />
              </div>
              <h3 className="text-slate-400 font-black text-2xl uppercase tracking-tighter italic">Intelligence Awaiting</h3>
              <p className="text-slate-600 text-sm font-bold max-w-[320px] mt-6 leading-relaxed uppercase tracking-widest">
                Capture object motion to begin vector reconstruction and force mapping.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-32 py-16 border-t border-slate-800 flex flex-col items-center">
        <div className="flex items-center space-x-4 text-slate-800 font-black italic uppercase text-[11px] tracking-[0.5em] mb-6">
          <Activity className="w-4 h-4" />
          <span>PhysiTrack Engine v3.2.0-STABLE</span>
        </div>
        <p className="text-slate-900 text-[10px] font-black uppercase tracking-widest">GEMINI MULTIMODAL CORE • REALTIME VECTOR INFERENCE</p>
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
