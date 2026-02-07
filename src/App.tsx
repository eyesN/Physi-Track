import React, { useEffect, useRef, useState } from 'react';
import { detectEdgesAndCenter, drawFbdOverlay, type FbdArrow } from './fbdDetection';

const App: React.FC = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState<string | null>(null);

  const [mass, setMass] = useState(5);
  const [theta, setTheta] = useState(20);
  const [mu, setMu] = useState(0.3);
  const [showComponents, setShowComponents] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const prevGrayRef = useRef<Float32Array | null>(null);
  const pathRef = useRef<Array<{ x: number; y: number }>>([]);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackingRef = useRef(false);
  const fbdOverlayRef = useRef<{ arrows: FbdArrow[]; rotation: number }>({
    arrows: [],
    rotation: 0,
  });

  const g = 9.81;
  const thetaRad = (theta * Math.PI) / 180;
  const weight = mass * g;
  const normal = weight * Math.cos(thetaRad);
  const weightParallel = weight * Math.sin(thetaRad);
  const friction = mu * normal;

  const format = (value: number) => value.toFixed(2);

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
    prevGrayRef.current = null;
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
    const isPriming = !prevGrayRef.current;
    const minEdgeCount = Math.max(40, Math.floor(aw * ah * 0.002));

    const detection = detectEdgesAndCenter(frame, prevGrayRef.current, {
      edgeThreshold: 180,
      motionThreshold: 0,
      minEdgeCount,
    });

    prevGrayRef.current = detection.gray;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    if (isPriming) {
      overlayCtx.fillStyle = 'rgba(157, 170, 185, 0.7)';
      overlayCtx.font = '14px "Space Grotesk", "Segoe UI", sans-serif';
      overlayCtx.fillText('Initializing tracker...', 16, 28);
    } else if (detection.center && detection.bounds) {
      const scaleX = overlay.width / aw;
      const scaleY = overlay.height / ah;
      const boxX = detection.bounds.minX * scaleX;
      const boxY = detection.bounds.minY * scaleY;
      const boxW = Math.max(1, detection.bounds.maxX - detection.bounds.minX + 1) * scaleX;
      const boxH = Math.max(1, detection.bounds.maxY - detection.bounds.minY + 1) * scaleY;

      overlayCtx.strokeStyle = 'rgba(74, 222, 128, 0.95)';
      overlayCtx.lineWidth = 3;
      overlayCtx.strokeRect(boxX, boxY, boxW, boxH);

      const cx = detection.center.x * scaleX;
      const cy = detection.center.y * scaleY;

      pathRef.current.push({ x: cx, y: cy });
      if (pathRef.current.length > 160) {
        pathRef.current.shift();
      }

      overlayCtx.beginPath();
      pathRef.current.forEach((p, idx) => {
        if (idx === 0) overlayCtx.moveTo(p.x, p.y);
        else overlayCtx.lineTo(p.x, p.y);
      });
      overlayCtx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
      overlayCtx.lineWidth = 2;
      overlayCtx.stroke();

      const overlayState = fbdOverlayRef.current;
      if (overlayState.arrows.length > 0) {
        drawFbdOverlay(overlayCtx, { x: cx, y: cy }, overlayState.arrows, {
          rotation: overlayState.rotation,
        });
      }

      overlayCtx.fillStyle = 'rgba(56, 189, 248, 0.95)';
      overlayCtx.beginPath();
      overlayCtx.arc(cx, cy, 5, 0, Math.PI * 2);
      overlayCtx.fill();
    } else {
      overlayCtx.fillStyle = 'rgba(157, 170, 185, 0.7)';
      overlayCtx.font = '14px "Space Grotesk", "Segoe UI", sans-serif';
      overlayCtx.fillText('No object detected', 16, 28);
    }

    animationRef.current = requestAnimationFrame(trackFrame);
  };

  const startTracking = () => {
    if (!cameraActive) return;

    prevGrayRef.current = null;
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

  const diagramSize = 320;
  const center = { x: diagramSize / 2, y: diagramSize / 2 };
  const uParallel = { x: Math.cos(thetaRad), y: -Math.sin(thetaRad) };
  const uNormal = { x: -Math.sin(thetaRad), y: -Math.cos(thetaRad) };

  const weightLen = 80;
  const scale = weight > 0 ? weightLen / weight : 0;
  const len = (value: number) => Math.max(0, Math.min(110, value * scale));

  const arrows = [
    {
      id: 'weight',
      label: 'W',
      color: '#f87171',
      vec: { x: 0, y: 1 },
      length: len(weight),
      dashed: false,
    },
    {
      id: 'normal',
      label: 'N',
      color: '#34d399',
      vec: uNormal,
      length: len(normal),
      dashed: false,
    },
    {
      id: 'friction',
      label: 'F',
      color: '#fbbf24',
      vec: uParallel,
      length: len(friction),
      dashed: false,
    },
  ];

  if (showComponents) {
    arrows.push(
      {
        id: 'wcos',
        label: 'W cos θ',
        color: '#38bdf8',
        vec: { x: -uNormal.x, y: -uNormal.y },
        length: len(normal),
        dashed: true,
      },
      {
        id: 'wsin',
        label: 'W sin θ',
        color: '#38bdf8',
        vec: { x: -uParallel.x, y: -uParallel.y },
        length: len(weightParallel),
        dashed: true,
      }
    );
  }

  const planeHalf = 140;
  const planeX1 = center.x - uParallel.x * planeHalf;
  const planeY1 = center.y - uParallel.y * planeHalf;
  const planeX2 = center.x + uParallel.x * planeHalf;
  const planeY2 = center.y + uParallel.y * planeHalf;

  const markerDefs = [
    { id: 'weight', color: '#f87171' },
    { id: 'normal', color: '#34d399' },
    { id: 'friction', color: '#fbbf24' },
    { id: 'wcos', color: '#38bdf8' },
    { id: 'wsin', color: '#38bdf8' },
  ];

  useEffect(() => {
    const overlayScale = 0.55;
    const overlayArrows: FbdArrow[] = arrows.map((arrow) => ({
      label: arrow.label,
      color: arrow.color,
      vec: arrow.vec,
      length: arrow.length * overlayScale,
      dashed: arrow.dashed,
    }));

    fbdOverlayRef.current = { arrows: overlayArrows, rotation: -thetaRad };
  }, [arrows, thetaRad]);

  return (
    <div className="app">
      <div className="container">
        <header className="hero">
          <div>
            <p className="eyebrow">Physi-Track</p>
            <h1>Edge-Based Motion + Free Body Diagram</h1>
            <p className="subhead">
              Grayscale edge detection finds the object center of mass, then overlays the FBD
              directly on the moving target.
            </p>
          </div>
          <div className="status-card">
            <span>Status</span>
            <strong>{status}</strong>
          </div>
        </header>

        {error && <div className="alert">{error}</div>}

        <div className="grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Free Body Diagram</h2>
                <p>Normal, weight, and friction forces on an incline.</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showComponents}
                  onChange={(e) => setShowComponents(e.target.checked)}
                />
                <span>Show components</span>
              </label>
            </div>

            <div className="diagram">
              <svg width={diagramSize} height={diagramSize} viewBox={`0 0 ${diagramSize} ${diagramSize}`}>
                <defs>
                  {markerDefs.map((marker) => (
                    <marker
                      key={marker.id}
                      id={`arrow-${marker.id}`}
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L10,3 L0,6 Z" fill={marker.color} />
                    </marker>
                  ))}
                </defs>

                <line
                  x1={planeX1}
                  y1={planeY1}
                  x2={planeX2}
                  y2={planeY2}
                  stroke="#43546d"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                <g transform={`translate(${center.x}, ${center.y}) rotate(${-theta})`}>
                  <rect
                    x="-18"
                    y="-12"
                    width="36"
                    height="24"
                    rx="4"
                    fill="#e2e8f0"
                    stroke="#94a3b8"
                    strokeWidth="2"
                  />
                </g>

                {arrows.map((arrow) => {
                  if (arrow.length <= 0) return null;
                  const endX = center.x + arrow.vec.x * arrow.length;
                  const endY = center.y + arrow.vec.y * arrow.length;
                  const labelX = center.x + arrow.vec.x * (arrow.length + 14);
                  const labelY = center.y + arrow.vec.y * (arrow.length + 14);

                  return (
                    <g key={arrow.id}>
                      <line
                        x1={center.x}
                        y1={center.y}
                        x2={endX}
                        y2={endY}
                        stroke={arrow.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={arrow.dashed ? '6 4' : undefined}
                        markerEnd={`url(#arrow-${arrow.id})`}
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        fill={arrow.color}
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {arrow.label}
                      </text>
                    </g>
                  );
                })}

                <text x="20" y={diagramSize - 20} fill="#a6b2c2" fontSize="12">
                  θ = {theta.toFixed(0)}°
                </text>
              </svg>
            </div>

            <div className="values">
              <div className="value-card">
                <span>Weight (W)</span>
                <strong>{format(weight)} N</strong>
              </div>
              <div className="value-card">
                <span>Normal (N)</span>
                <strong>{format(normal)} N</strong>
              </div>
              <div className="value-card">
                <span>Friction</span>
                <strong>{format(friction)} N</strong>
              </div>
              <div className="value-card">
                <span>W sin θ</span>
                <strong>{format(weightParallel)} N</strong>
              </div>
              <div className="value-card">
                <span>W cos θ</span>
                <strong>{format(normal)} N</strong>
              </div>
            </div>

            <div className="sliders">
              <label>
                Mass (kg)
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={mass}
                  onChange={(e) => setMass(parseFloat(e.target.value))}
                />
                <span>{mass.toFixed(1)} kg</span>
              </label>
              <label>
                Angle θ (deg)
                <input
                  type="range"
                  min={0}
                  max={45}
                  step={1}
                  value={theta}
                  onChange={(e) => setTheta(parseFloat(e.target.value))}
                />
                <span>{theta.toFixed(0)}°</span>
              </label>
              <label>
                Friction μ
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mu}
                  onChange={(e) => setMu(parseFloat(e.target.value))}
                />
                <span>{mu.toFixed(2)}</span>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Live Camera Feed</h2>
                <p>Edge detection + center of mass tracking.</p>
              </div>
            </div>

            <div className="video-wrapper">
              <video ref={videoRef} muted playsInline />
              <canvas ref={overlayRef} />
              {!cameraActive && (
                <div className="video-overlay">
                  <div>
                    <strong>Camera is off</strong>
                    <p>Start the camera to begin tracking.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="controls">
              <button className="button primary" onClick={startCamera} disabled={cameraActive}>
                Start Camera
              </button>
              <button className="button" onClick={stopCamera} disabled={!cameraActive}>
                Stop Camera
              </button>
              <button className="button accent" onClick={startTracking} disabled={!cameraActive || tracking}>
                Start Tracking
              </button>
              <button className="button" onClick={stopTracking} disabled={!tracking}>
                Stop Tracking
              </button>
            </div>

            <div className="tips">
              Tips: strong lighting, high-contrast objects, and a steady camera improve detection.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
