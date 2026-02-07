import { computeFbdArrows, drawFbdOverlay, drawFbdPalette } from './fbdDrawing.js';
import { detectObjects } from './objectDetection.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const paletteCanvas = document.getElementById('paletteCanvas');
const statusText = document.getElementById('statusText');
const cameraOverlay = document.getElementById('cameraOverlay');
const objectCount = document.getElementById('objectCount');
const selectedInfo = document.getElementById('selectedInfo');

const startCameraBtn = document.getElementById('startCamera');
const stopCameraBtn = document.getElementById('stopCamera');
const startTrackingBtn = document.getElementById('startTracking');
const stopTrackingBtn = document.getElementById('stopTracking');

const massInput = document.getElementById('mass');
const thetaInput = document.getElementById('theta');
const muInput = document.getElementById('mu');
const showComponentsInput = document.getElementById('showComponents');

const massValue = document.getElementById('massValue');
const thetaValue = document.getElementById('thetaValue');
const muValue = document.getElementById('muValue');

const paletteCtx = paletteCanvas.getContext('2d');
const overlayCtx = overlay.getContext('2d');

let cameraActive = false;
let tracking = false;
let stream = null;
let animationId = null;
let offscreen = null;
let prevGray = null;

const analysisScale = 0.22;

const updateStatus = (text) => {
  statusText.textContent = text;
};

const updateSliderLabels = () => {
  massValue.textContent = `${Number(massInput.value).toFixed(1)} kg`;
  thetaValue.textContent = `${Number(thetaInput.value).toFixed(0)}°`;
  muValue.textContent = Number(muInput.value).toFixed(2);
};

const getFbdState = () => {
  const mass = Number(massInput.value);
  const thetaDeg = Number(thetaInput.value);
  const mu = Number(muInput.value);
  const showComponents = showComponentsInput.checked;
  return computeFbdArrows({ mass, thetaDeg, mu, showComponents });
};

const clearOverlay = () => {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
};

const stopLoop = () => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
};

const stopCamera = () => {
  stopLoop();
  tracking = false;
  updateStatus('Idle');
  prevGray = null;
  clearOverlay();
  objectCount.textContent = '0';
  selectedInfo.textContent = 'None';

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  video.srcObject = null;
  cameraActive = false;
  cameraOverlay.style.display = 'flex';
};

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });

    video.srcObject = stream;
    await video.play();

    cameraActive = true;
    cameraOverlay.style.display = 'none';
    updateStatus('Camera Ready');
  } catch (err) {
    updateStatus('Camera Error');
    cameraActive = false;
    cameraOverlay.style.display = 'flex';
  }
};

const trackFrame = () => {
  if (!tracking || !cameraActive) return;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    animationId = requestAnimationFrame(trackFrame);
    return;
  }

  if (overlay.width !== vw || overlay.height !== vh) {
    overlay.width = vw;
    overlay.height = vh;
  }

  const aw = Math.max(96, Math.floor(vw * analysisScale));
  const ah = Math.max(96, Math.floor(vh * analysisScale));

  if (!offscreen) {
    offscreen = document.createElement('canvas');
  }

  if (offscreen.width !== aw || offscreen.height !== ah) {
    offscreen.width = aw;
    offscreen.height = ah;
  }

  const offscreenCtx = offscreen.getContext('2d');
  offscreenCtx.drawImage(video, 0, 0, aw, ah);
  const frame = offscreenCtx.getImageData(0, 0, aw, ah);

  const detection = detectObjects(frame, prevGray, {
    edgeThreshold: 170,
    motionThreshold: 0,
    minArea: Math.max(32, Math.floor(aw * ah * 0.002)),
  });

  prevGray = detection.gray;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  objectCount.textContent = String(detection.objects.length);

  const fbdState = getFbdState();
  drawFbdPalette(paletteCtx, fbdState);

  if (detection.objects.length === 0) {
    selectedInfo.textContent = 'None';
    overlayCtx.fillStyle = 'rgba(157, 170, 185, 0.7)';
    overlayCtx.font = '14px "Space Grotesk", "Segoe UI", sans-serif';
    overlayCtx.fillText('No object detected', 16, 28);
  } else {
    const scaleX = overlay.width / aw;
    const scaleY = overlay.height / ah;

    detection.objects.forEach((obj, index) => {
      const boxX = obj.minX * scaleX;
      const boxY = obj.minY * scaleY;
      const boxW = Math.max(1, obj.maxX - obj.minX + 1) * scaleX;
      const boxH = Math.max(1, obj.maxY - obj.minY + 1) * scaleY;

      overlayCtx.strokeStyle = index === 0 ? 'rgba(74, 222, 128, 0.95)' : 'rgba(148, 163, 184, 0.7)';
      overlayCtx.lineWidth = index === 0 ? 3 : 2;
      overlayCtx.strokeRect(boxX, boxY, boxW, boxH);
    });

    const primary = detection.objects[0];
    const cx = primary.centerX * scaleX;
    const cy = primary.centerY * scaleY;

    selectedInfo.textContent = `#1 (${Math.round(primary.area)} px)`;

    drawFbdOverlay(overlayCtx, { x: cx, y: cy }, fbdState.arrows, -fbdState.thetaRad);

    overlayCtx.fillStyle = 'rgba(56, 189, 248, 0.95)';
    overlayCtx.beginPath();
    overlayCtx.arc(cx, cy, 5, 0, Math.PI * 2);
    overlayCtx.fill();
  }

  animationId = requestAnimationFrame(trackFrame);
};

const startTracking = () => {
  if (!cameraActive) return;
  prevGray = null;
  tracking = true;
  updateStatus('Tracking');
  stopLoop();
  animationId = requestAnimationFrame(trackFrame);
};

const stopTracking = () => {
  tracking = false;
  stopLoop();
  updateStatus(cameraActive ? 'Camera Ready' : 'Idle');
};

startCameraBtn.addEventListener('click', startCamera);
stopCameraBtn.addEventListener('click', stopCamera);
startTrackingBtn.addEventListener('click', startTracking);
stopTrackingBtn.addEventListener('click', stopTracking);

[massInput, thetaInput, muInput, showComponentsInput].forEach((input) => {
  input.addEventListener('input', () => {
    updateSliderLabels();
    drawFbdPalette(paletteCtx, getFbdState());
  });
});

updateSliderLabels();
drawFbdPalette(paletteCtx, getFbdState());
