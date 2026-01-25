
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Activity, RefreshCw, AlertCircle, Play, Square, FileVideo, Loader2, Info } from 'lucide-react';
import { analyzeMotion } from './services/geminiService';
import { Point, Force, PhysicsAnalysis, AppState } from './types';
import FBDCanvas from './components/FBDCanvas';
import MotionGraph from './components/MotionGraph';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [analysis, setAnalysis] = useState<PhysicsAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordingInterval = useRef<number | null>(null);
  const framesRef = useRef<{ data: string; timestamp: number }[]>([]);

  // Camera initialization
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
        setAppState(AppState.IDLE);
        setError(null);
      }
    } catch (err) {
      setError("Failed to access camera. Please check permissions.");
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
    const startTime = Date.now();

    recordingInterval.current = window.setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          // Downscale for API efficiency
          const scale = 0.5;
          canvasRef.current.width = videoRef.current.videoWidth * scale;
          canvasRef.current.height = videoRef.current.videoHeight * scale;
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
          framesRef.current.push({ data: dataUrl, timestamp: (Date.now() - startTime) / 1000 });
          
          // Limit to 15 frames to prevent payload size issues
          if (framesRef.current.length >= 15) {
            handleStopRecording();
          }
        }
      }
    }, 400); // ~2.5 FPS for a few seconds is enough for motion tracking
  };

  const handleStopRecording = async () => {
    if (recordingInterval.current) {
      window.clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    setAppState(AppState.ANALYZING);
    performAnalysis(framesRef.current);
  };

  const performAnalysis = async (frames: { data: string; timestamp: number }[]) => {
    try {
      if (frames.length < 3) {
        throw new Error("Not enough motion captured. Record for at least 2-3 seconds.");
      }
      const result = await analyzeMotion(frames);
      setAnalysis(result);
      setAppState(AppState.RESULTS);
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again with a clearer view of the object.");
      setAppState(AppState.IDLE);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAppState(AppState.ANALYZING);
    setError(null);

    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const duration = video.duration;
      const numFrames = 10;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        frames.push({ data: dataUrl, timestamp: video.currentTime });
        currentFrameIdx++;
        captureNext();
      };

      captureNext();
    };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">PhysiTrack</h1>
            <p className="text-slate-400 text-sm">Visual Motion & FBD Analysis Engine</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <label className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl cursor-pointer transition-all border border-slate-700">
            <FileVideo className="w-5 h-5" />
            <span className="font-medium">Upload Video</span>
            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => { setAnalysis(null); setAppState(AppState.IDLE); startCamera(); }}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-semibold border border-slate-700 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-center space-x-3 text-red-200 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Camera / Results */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 aspect-video group">
            <video 
              ref={videoRef} 
              className={`w-full h-full object-cover ${appState === AppState.RESULTS ? 'opacity-30' : 'opacity-100'} transition-opacity`}
              muted 
              playsInline 
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {appState === AppState.IDLE && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="bg-slate-900/80 p-6 rounded-2xl border border-white/10 text-center max-w-xs animate-in zoom-in duration-500">
                  <Camera className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">Ready to Track?</h2>
                  <p className="text-slate-300 text-sm mb-6">Position your object in frame and click start. We'll track its path automatically.</p>
                  <button 
                    onClick={startRecording}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-xl shadow-indigo-600/20 transition-all"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Start Tracking</span>
                  </button>
                </div>
              </div>
            )}

            {appState === AppState.RECORDING && (
              <div className="absolute top-6 left-6 flex items-center space-x-3 bg-red-600 px-4 py-2 rounded-full animate-pulse">
                <div className="w-3 h-3 bg-white rounded-full"></div>
                <span className="text-white font-bold text-sm tracking-wider">RECORDING PATH...</span>
              </div>
            )}

            {appState === AppState.RECORDING && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <button 
                  onClick={handleStopRecording}
                  className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold flex items-center space-x-2 shadow-2xl hover:bg-slate-100 transition-all scale-110"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>Stop & Analyze</span>
                </button>
              </div>
            )}

            {appState === AppState.ANALYZING && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-white">Gemini is Thinking...</h2>
                <p className="text-slate-400 mt-2">Analyzing frames and calculating physics...</p>
                <div className="mt-8 w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
                </div>
              </div>
            )}

            {appState === AppState.RESULTS && analysis && (
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl">
                  <h2 className="text-2xl font-bold text-white mb-2">{analysis.objectName} Analysis</h2>
                  <p className="text-slate-300 line-clamp-3 italic">"{analysis.summary}"</p>
                </div>
              </div>
            )}
          </div>

          {appState === AppState.RESULTS && analysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">Inferred Velocity</p>
                  <p className="text-2xl font-mono font-bold text-indigo-400">{analysis.calculatedVelocity.toFixed(2)} units/s</p>
               </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">Inferred Accel.</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">{analysis.calculatedAcceleration.toFixed(2)} units/s²</p>
               </div>
            </div>
          )}
        </div>

        {/* Right Column: Physics Visuals */}
        <div className="lg:col-span-5 space-y-6">
          {appState === AppState.RESULTS && analysis ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
              <MotionGraph path={analysis.path} />
              <FBDCanvas forces={analysis.forces} objectName={analysis.objectName} />
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-800">
              <div className="bg-slate-800 p-4 rounded-full mb-4">
                <Info className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-slate-400 font-semibold text-lg">Physics Insights</h3>
              <p className="text-slate-500 text-sm max-w-[240px] mt-2">
                Capture some motion to see path tracking and automated Free Body Diagrams here.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-16 text-center text-slate-600 text-xs border-t border-slate-800 pt-8 pb-4">
        <p>Built with Gemini Vision Pro & React • Physics Engine v2.5</p>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
};

export default App;
