const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const fbdCanvas = document.getElementById("fbd");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const permissionHint = document.getElementById("permissionHint");

const overlayCtx = overlay.getContext("2d");
const fbdCtx = fbdCanvas.getContext("2d");

let model = null;
let stream = null;
let running = false;
let detectTimer = null;
let fbdSize = { width: 0, height: 0 };
let modelReady = false;

const SCORE_THRESHOLD = 0.5;
const DETECT_INTERVAL = 180;

function setStatus(text) {
  statusEl.textContent = text;
}

function setButtons(active) {
  startBtn.disabled = active || !modelReady;
  stopBtn.disabled = !active;
}

function resizeCanvases() {
  if (video.videoWidth && video.videoHeight) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }

  const rect = fbdCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  fbdCanvas.width = Math.round(rect.width * dpr);
  fbdCanvas.height = Math.round(rect.height * dpr);
  fbdCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fbdSize = { width: rect.width, height: rect.height };
}

function drawOverlay(predictions) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.lineWidth = 3;
  overlayCtx.strokeStyle = "rgba(45, 212, 191, 0.9)";
  overlayCtx.font = "16px 'Space Grotesk', sans-serif";
  overlayCtx.textBaseline = "top";

  predictions.forEach((pred) => {
    const [x, y, width, height] = pred.bbox;
    overlayCtx.strokeRect(x, y, width, height);

    const label = `${pred.class} ${Math.round(pred.score * 100)}%`;
    const textWidth = overlayCtx.measureText(label).width;
    const textPadding = 6;

    overlayCtx.fillStyle = "rgba(15, 23, 42, 0.75)";
    overlayCtx.fillRect(x, y - 24, textWidth + textPadding * 2, 22);
    overlayCtx.fillStyle = "#e2e8f0";
    overlayCtx.fillText(label, x + textPadding, y - 22);
  });
}

function drawArrow(ctx, fromX, fromY, toX, toY, label) {
  const headLength = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.lineTo(toX, toY);
  ctx.fill();

  if (label) {
    ctx.fillText(label, toX + 6, toY + 6);
  }
}

function drawFbd(prediction) {
  const { width, height } = fbdSize;
  fbdCtx.clearRect(0, 0, width, height);

  fbdCtx.fillStyle = "rgba(56, 189, 248, 0.12)";
  fbdCtx.strokeStyle = "rgba(226, 232, 240, 0.9)";
  fbdCtx.lineWidth = 2;
  fbdCtx.font = "16px 'Space Grotesk', sans-serif";

  if (!prediction) {
    fbdCtx.fillStyle = "rgba(148, 163, 184, 0.8)";
    fbdCtx.textAlign = "center";
    fbdCtx.fillText("No object detected", width / 2, height / 2);
    fbdCtx.textAlign = "left";
    return;
  }

  const bodyWidth = width * 0.3;
  const bodyHeight = height * 0.18;
  const centerX = width / 2;
  const centerY = height / 2;
  const bodyX = centerX - bodyWidth / 2;
  const bodyY = centerY - bodyHeight / 2;

  fbdCtx.fillStyle = "rgba(45, 212, 191, 0.2)";
  fbdCtx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
  fbdCtx.strokeRect(bodyX, bodyY, bodyWidth, bodyHeight);

  fbdCtx.fillStyle = "rgba(226, 232, 240, 0.9)";
  fbdCtx.textAlign = "center";
  fbdCtx.fillText(prediction.class.toUpperCase(), centerX, bodyY + bodyHeight + 22);
  fbdCtx.textAlign = "left";

  fbdCtx.strokeStyle = "rgba(226, 232, 240, 0.9)";
  fbdCtx.fillStyle = "rgba(226, 232, 240, 0.9)";

  drawArrow(fbdCtx, centerX, bodyY, centerX, bodyY - 60, "N");
  drawArrow(fbdCtx, centerX, bodyY + bodyHeight, centerX, bodyY + bodyHeight + 60, "W");
  drawArrow(fbdCtx, bodyX, centerY, bodyX - 80, centerY, "f");
  drawArrow(fbdCtx, bodyX + bodyWidth, centerY, bodyX + bodyWidth + 80, centerY, "F");
}

function selectPrimary(predictions) {
  if (!predictions.length) return null;
  return predictions.reduce((max, pred) => {
    const area = pred.bbox[2] * pred.bbox[3];
    const maxArea = max.bbox[2] * max.bbox[3];
    return area > maxArea ? pred : max;
  });
}

async function detectLoop() {
  if (!running || !model) return;

  if (video.readyState < 2) {
    detectTimer = window.setTimeout(detectLoop, DETECT_INTERVAL);
    return;
  }

  const predictions = await model.detect(video);
  const filtered = predictions.filter((pred) => pred.score >= SCORE_THRESHOLD);

  drawOverlay(filtered);
  drawFbd(selectPrimary(filtered));

  detectTimer = window.setTimeout(detectLoop, DETECT_INTERVAL);
}

async function startCamera() {
  try {
    permissionHint.hidden = true;
    setStatus("Starting camera...");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera not supported in this browser.");
      return;
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    resizeCanvases();
    running = true;
    setButtons(true);
    setStatus("Detecting objects...");
    detectLoop();
  } catch (error) {
    setStatus("Camera access blocked. Please allow permission.");
    permissionHint.hidden = false;
    setButtons(false);
    running = false;
  }
}

function stopCamera() {
  running = false;
  window.clearTimeout(detectTimer);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  drawFbd(null);

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  setButtons(false);
  setStatus("Camera stopped.");
}

async function init() {
  modelReady = false;
  setButtons(false);
  setStatus("Loading model...");
  try {
    model = await cocoSsd.load();
    modelReady = true;
    setButtons(false);
    setStatus("Model ready. Start the camera.");
  } catch (error) {
    setStatus("Failed to load model. Check your connection.");
  }
  resizeCanvases();
  drawFbd(null);
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
window.addEventListener("resize", resizeCanvases);

init();
