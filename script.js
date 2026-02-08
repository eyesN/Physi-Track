import { computeFbdArrows, drawFbdPalette } from './fbdDrawing.js';
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

if (!paletteCtx || !overlayCtx) {
  throw new Error('Canvas context unavailable. Check #paletteCanvas and #overlay.');
}

let cameraActive = false;
let tracking = false;
let stream = null;
let animationId = null;
let offscreen = null;
let prevGray = null;
let edgeCanvas = null;

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

  if (!edgeCanvas) {
    edgeCanvas = document.createElement('canvas');
  }
  if (edgeCanvas.width !== aw || edgeCanvas.height !== ah) {
    edgeCanvas.width = aw;
    edgeCanvas.height = ah;
  }

  if (detection.edgeMap) {
    const edgeCtx = edgeCanvas.getContext('2d');
    const edgeImage = edgeCtx.createImageData(aw, ah);
    const edgeData = edgeImage.data;

    for (let i = 0; i < detection.edgeMap.length; i += 1) {
      const value = detection.edgeMap[i];
      if (!value) continue;
      const idx = i * 4;
      edgeData[idx] = 56;
      edgeData[idx + 1] = 189;
      edgeData[idx + 2] = 248;
      edgeData[idx + 3] = 220;
    }

    edgeCtx.putImageData(edgeImage, 0, 0);
    overlayCtx.drawImage(edgeCanvas, 0, 0, overlay.width, overlay.height);
  }

  if (detection.objects.length === 0) {
    selectedInfo.textContent = 'None';
    overlayCtx.fillStyle = 'rgba(157, 170, 185, 0.7)';
    overlayCtx.font = '14px "Space Grotesk", "Segoe UI", sans-serif';
    overlayCtx.fillText('No object detected', 16, 28);

    paletteCtx.save();
    paletteCtx.fillStyle = 'rgba(157, 170, 185, 0.8)';
    paletteCtx.font = '14px "Space Grotesk", "Segoe UI", sans-serif';
    paletteCtx.textAlign = 'center';
    paletteCtx.textBaseline = 'middle';
    paletteCtx.fillText('No object detected', paletteCanvas.width / 2, 24);
    paletteCtx.restore();
  } else {
    const primary = detection.objects[0];
    selectedInfo.textContent = `#1 (${Math.round(primary.area)} px)`;
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
