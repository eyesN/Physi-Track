import React, { useEffect, useRef, useState } from 'react';

const App: React.FC = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const pathRef = useRef<Array<{ x: number; y: number }>>([]);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackingRef = useRef(false);

  const stopLoop = () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const clearOverlay = () => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const stopCamera = () => {
    stopLoop();
    trackingRef.current = false;
    setTracking(false);
    setStatus('Idle');
    prevFrameRef.current = null;
    pathRef.current = [];
    clearOverlay();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setStatus('Camera Ready');
    } catch (err) {
      setError('Camera access was denied or is unavailable.');
      setCameraActive(false);
      setStatus('Idle');
    }
  };

  const stopTracking = () => {
    trackingRef.current = false;
    setTracking(false);
    setStatus(cameraActive ? 'Camera Ready' : 'Idle');
    stopLoop();
  };

  const trackFrame = () => {
    if (!trackingRef.current) return;

    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) {
      animationRef.current = requestAnimationFrame(trackFrame);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      animationRef.current = requestAnimationFrame(trackFrame);
      return;
    }

    if (overlay.width !== vw || overlay.height !== vh) {
      overlay.width = vw;
      overlay.height = vh;
    }

    const overlayCtx = overlay.getContext('2d');
    if (!overlayCtx) {
      animationRef.current = requestAnimationFrame(trackFrame);
      return;
    }

    const analysisScale = 0.2;
    const aw = Math.max(64, Math.floor(vw * analysisScale));
    const ah = Math.max(64, Math.floor(vh * analysisScale));

    const offscreen = offscreenRef.current ?? document.createElement('canvas');
    offscreenRef.current = offscreen;

    if (offscreen.width !== aw || offscreen.height !== ah) {
      offscreen.width = aw;
      offscreen.height = ah;
    }

    const offscreenCtx = offscreen.getContext('2d');
    if (!offscreenCtx) {
      animationRef.current = requestAnimationFrame(trackFrame);
      return;
    }

    offscreenCtx.drawImage(video, 0, 0, aw, ah);
    const frame = offscreenCtx.getImageData(0, 0, aw, ah);
    const data = frame.data;
    const prev = prevFrameRef.current;

    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    if (prev) {
      let minX = aw;
      let minY = ah;
      let maxX = 0;
      let maxY = 0;
      let changed = 0;
      const threshold = 38;

      for (let i = 0; i < data.length; i += 4) {
        const diff =
          Math.abs(data[i] - prev[i]) +
          Math.abs(data[i + 1] - prev[i + 1]) +
          Math.abs(data[i + 2] - prev[i + 2]);

        if (diff > threshold) {
          const idx = i / 4;
          const x = idx % aw;
          const y = Math.floor(idx / aw);

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;

          changed++;
        }
      }

      const motionPixels = aw * ah * 0.002;

      if (changed > motionPixels) {
        const scaleX = overlay.width / aw;
        const scaleY = overlay.height / ah;
        const boxX = minX * scaleX;
        const boxY = minY * scaleY;
        const boxW = Math.max(1, maxX - minX) * scaleX;
        const boxH = Math.max(1, maxY - minY) * scaleY;

        overlayCtx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(boxX, boxY, boxW, boxH);

        const cx = (minX + maxX) / 2 * scaleX;
        const cy = (minY + maxY) / 2 * scaleY;

        pathRef.current.push({ x: cx, y: cy });
        if (pathRef.current.length > 160) {
          pathRef.current.shift();
        }

        overlayCtx.beginPath();
        pathRef.current.forEach((p, idx) => {
          if (idx === 0) overlayCtx.moveTo(p.x, p.y);
          else overlayCtx.lineTo(p.x, p.y);
        });
        overlayCtx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        overlayCtx.lineWidth = 2;
        overlayCtx.stroke();

        overlayCtx.fillStyle = 'rgba(56, 189, 248, 0.9)';
        overlayCtx.beginPath();
        overlayCtx.arc(cx, cy, 5, 0, Math.PI * 2);
        overlayCtx.fill();
      } else {
        overlayCtx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        overlayCtx.font = '14px ui-sans-serif, system-ui, sans-serif';
        overlayCtx.fillText('No motion detected', 16, 28);
      }
    } else {
      overlayCtx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      overlayCtx.font = '14px ui-sans-serif, system-ui, sans-serif';
      overlayCtx.fillText('Initializing tracker...', 16, 28);
    }

    prevFrameRef.current = new Uint8ClampedArray(data);
    animationRef.current = requestAnimationFrame(trackFrame);
  };

  const startTracking = () => {
    if (!cameraActive) return;

    prevFrameRef.current = null;
    pathRef.current = [];
    trackingRef.current = true;
    setTracking(true);
    setStatus('Tracking');

    stopLoop();
    animationRef.current = requestAnimationFrame(trackFrame);
  };

  useEffect(() => {
    return () => {
      stopLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">PhysiTrack Browser Tracker</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Local-only motion tracking in the browser. No external APIs or uploads.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 h-full w-full pointer-events-none"
            />

            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                <div className="text-center px-6">
                  <p className="text-lg font-bold">Camera is off</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Start the camera to begin tracking motion in real time.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500">Controls</div>
            <button
              onClick={startCamera}
              disabled={cameraActive}
              className="w-full rounded-xl bg-emerald-500/90 px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Camera
            </button>
            <button
              onClick={stopCamera}
              disabled={!cameraActive}
              className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop Camera
            </button>
            <button
              onClick={startTracking}
              disabled={!cameraActive || tracking}
              className="w-full rounded-xl bg-cyan-500/90 px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Tracking
            </button>
            <button
              onClick={stopTracking}
              disabled={!tracking}
              className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop Tracking
            </button>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Status</div>
              <div className="mt-1 font-semibold text-slate-200">{status}</div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              Tips: good lighting, stable camera, and distinct object colors improve detection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
