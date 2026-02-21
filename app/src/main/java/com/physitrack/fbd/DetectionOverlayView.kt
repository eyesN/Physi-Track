package com.physitrack.fbd

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import kotlin.math.min

class DetectionOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private val boxPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#32D3BF")
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }

    private val labelBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#AA0E1C2C")
        style = Paint.Style.FILL
    }

    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#EAF3FF")
        textSize = 34f
    }

    private val rect = RectF()
    private var detections: List<DetectionResult> = emptyList()
    private var imageWidth: Int = 1
    private var imageHeight: Int = 1

    fun updateDetections(detections: List<DetectionResult>, imageWidth: Int, imageHeight: Int) {
        this.detections = detections
        this.imageWidth = imageWidth.coerceAtLeast(1)
        this.imageHeight = imageHeight.coerceAtLeast(1)
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (detections.isEmpty()) {
            return
        }

        val scale = min(width.toFloat() / imageWidth.toFloat(), height.toFloat() / imageHeight.toFloat())
        val displayWidth = imageWidth * scale
        val displayHeight = imageHeight * scale
        val offsetX = (width - displayWidth) / 2f
        val offsetY = (height - displayHeight) / 2f

        detections.forEach { detection ->
            rect.set(
                offsetX + detection.boundingBox.left * scale,
                offsetY + detection.boundingBox.top * scale,
                offsetX + detection.boundingBox.right * scale,
                offsetY + detection.boundingBox.bottom * scale
            )

            canvas.drawRoundRect(rect, 16f, 16f, boxPaint)

            val confidenceText = "${(detection.confidence * 100f).toInt()}%"
            val labelText = "${detection.label} $confidenceText"
            val textWidth = textPaint.measureText(labelText)
            val textHeight = textPaint.textSize
            val labelTop = (rect.top - textHeight - 20f).coerceAtLeast(0f)

            canvas.drawRoundRect(
                rect.left,
                labelTop,
                rect.left + textWidth + 30f,
                labelTop + textHeight + 14f,
                10f,
                10f,
                labelBgPaint
            )

            canvas.drawText(labelText, rect.left + 14f, labelTop + textHeight, textPaint)
        }
    }
}
