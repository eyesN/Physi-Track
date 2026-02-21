package com.physitrack.fbd

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : AppCompatActivity(), SensorEventListener {

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: DetectionOverlayView
    private lateinit var fbdView: FbdView
    private lateinit var statusText: TextView
    private lateinit var telemetryText: TextView

    private lateinit var cameraExecutor: ExecutorService
    private lateinit var sensorManager: SensorManager
    private var rotationSensor: Sensor? = null

    @Volatile
    private var tiltDegrees: Float = 0f

    @Volatile
    private var currentObject: String? = null

    private val rotationMatrix = FloatArray(9)
    private val orientationAngles = FloatArray(3)

    private val detector by lazy {
        val options = ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            .enableMultipleObjects()
            .enableClassification()
            .build()
        ObjectDetection.getClient(options)
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startCamera()
        } else {
            statusText.text = "Camera permission denied"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        previewView = findViewById(R.id.previewView)
        overlayView = findViewById(R.id.overlayView)
        fbdView = findViewById(R.id.fbdView)
        statusText = findViewById(R.id.statusText)
        telemetryText = findViewById(R.id.telemetryText)

        cameraExecutor = Executors.newSingleThreadExecutor()

        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        if (rotationSensor == null) {
            statusText.text = "Rotation sensor unavailable. Tilt-based forces disabled"
        }
    }

    override fun onResume() {
        super.onResume()
        rotationSensor?.also {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    override fun onPause() {
        sensorManager.unregisterListener(this)
        super.onPause()
    }

    override fun onDestroy() {
        detector.close()
        cameraExecutor.shutdown()
        super.onDestroy()
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) {
            return
        }

        SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
        SensorManager.getOrientation(rotationMatrix, orientationAngles)

        val rollDegrees = Math.toDegrees(orientationAngles[2].toDouble()).toFloat().coerceIn(-45f, 45f)
        tiltDegrees = (tiltDegrees * 0.85f) + (rollDegrees * 0.15f)

        fbdView.updateState(currentObject, tiltDegrees)
        updateTelemetry()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            bindCameraUseCases(cameraProvider)
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases(cameraProvider: ProcessCameraProvider) {
        val preview = Preview.Builder().build().also {
            it.surfaceProvider = previewView.surfaceProvider
        }

        val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        analysis.setAnalyzer(cameraExecutor, FrameAnalyzer())

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                this,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analysis
            )
            statusText.text = "Camera running. Detecting objects"
        } catch (exception: Exception) {
            statusText.text = "Camera initialization failed"
        }
    }

    private fun updateTelemetry() {
        val objectText = currentObject ?: "none"
        telemetryText.text = String.format(Locale.US, "Tilt: %.1f deg | Object: %s", tiltDegrees, objectText)
    }

    private fun mapDetection(result: com.google.mlkit.vision.objects.DetectedObject): DetectionResult {
        val topLabel = result.labels.maxByOrNull { it.confidence ?: 0f }
        val labelText = topLabel?.text?.takeIf { it.isNotBlank() } ?: "Object"
        val confidence = topLabel?.confidence ?: 0f
        return DetectionResult(
            label = labelText,
            confidence = confidence,
            boundingBox = result.boundingBox
        )
    }

    private inner class FrameAnalyzer : ImageAnalysis.Analyzer {
        private val isProcessing = AtomicBoolean(false)

        override fun analyze(imageProxy: ImageProxy) {
            if (isProcessing.getAndSet(true)) {
                imageProxy.close()
                return
            }

            val mediaImage = imageProxy.image
            if (mediaImage == null) {
                isProcessing.set(false)
                imageProxy.close()
                return
            }

            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            detector.process(image)
                .addOnSuccessListener { results ->
                    val detections = results.map { mapDetection(it) }
                    val primary = detections.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                    currentObject = primary?.label

                    runOnUiThread {
                        overlayView.updateDetections(detections, image.width, image.height)
                        fbdView.updateState(currentObject, tiltDegrees)
                        statusText.text = if (detections.isEmpty()) {
                            "No objects detected"
                        } else {
                            "Detected ${detections.size} object(s)"
                        }
                        updateTelemetry()
                    }
                }
                .addOnFailureListener {
                    runOnUiThread {
                        statusText.text = "Object detection failed"
                    }
                }
                .addOnCompleteListener {
                    isProcessing.set(false)
                    imageProxy.close()
                }
        }
    }
}
