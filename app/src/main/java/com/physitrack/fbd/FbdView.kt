package com.physitrack.fbd

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

class FbdView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#0C1B2D")
        style = Paint.Style.FILL
    }

    private val panelBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#25466A")
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }

    private val planePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#4D78A1")
        strokeWidth = 6f
    }

    private val blockPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#1E88E5")
        style = Paint.Style.FILL
    }

    private val blockStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#CFE7FF")
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }

    private val infoPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#D7E9FF")
        textSize = 34f
    }

    private val arrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
    }

    private val arrowFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private var tiltDegrees: Float = 0f
    private var objectLabel: String = "None"

    fun updateState(label: String?, tiltDegrees: Float) {
        objectLabel = label?.takeIf { it.isNotBlank() } ?: "None"
        this.tiltDegrees = tiltDegrees.coerceIn(-45f, 45f)
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val widthF = width.toFloat()
        val heightF = height.toFloat()
        if (widthF <= 0f || heightF <= 0f) {
            return
        }

        canvas.drawRect(0f, 0f, widthF, heightF, backgroundPaint)
        canvas.drawRect(0f, 0f, widthF, heightF, panelBorderPaint)

        val theta = Math.toRadians(tiltDegrees.toDouble()).toFloat()
        val tangentX = cos(theta)
        val tangentY = -sin(theta)
        val normalX = -sin(theta)
        val normalY = -cos(theta)

        val centerX = widthF * 0.5f
        val centerY = heightF * 0.62f
        val planeHalfLength = widthF * 0.38f

        canvas.drawLine(
            centerX - tangentX * planeHalfLength,
            centerY - tangentY * planeHalfLength,
            centerX + tangentX * planeHalfLength,
            centerY + tangentY * planeHalfLength,
            planePaint
        )

        val blockWidth = widthF * 0.2f
        val blockHeight = heightF * 0.12f
        val blockCenterX = centerX + normalX * (blockHeight * 0.45f)
        val blockCenterY = centerY + normalY * (blockHeight * 0.45f)

        canvas.save()
        canvas.translate(blockCenterX, blockCenterY)
        canvas.rotate((-Math.toDegrees(theta.toDouble())).toFloat())
        canvas.drawRoundRect(
            -blockWidth / 2f,
            -blockHeight / 2f,
            blockWidth / 2f,
            blockHeight / 2f,
            16f,
            16f,
            blockPaint
        )
        canvas.drawRoundRect(
            -blockWidth / 2f,
            -blockHeight / 2f,
            blockWidth / 2f,
            blockHeight / 2f,
            16f,
            16f,
            blockStrokePaint
        )
        canvas.restore()

        val anchorX = blockCenterX
        val anchorY = blockCenterY

        val baseWeight = min(widthF, heightF) * 0.2f
        val normalMagnitude = baseWeight * abs(cos(theta))
        val slopeMagnitude = baseWeight * abs(sin(theta))
        val frictionMagnitude = min(normalMagnitude * 0.6f, slopeMagnitude)

        val gravityAlongSlope = (0f * tangentX) + (1f * tangentY)
        val downSlopeX: Float
        val downSlopeY: Float
        if (gravityAlongSlope >= 0f) {
            downSlopeX = tangentX
            downSlopeY = tangentY
        } else {
            downSlopeX = -tangentX
            downSlopeY = -tangentY
        }
        val frictionX = -downSlopeX
        val frictionY = -downSlopeY

        drawArrow(canvas, anchorX, anchorY, 0f, 1f, baseWeight, "W", "#F97316")
        drawArrow(canvas, anchorX, anchorY, normalX, normalY, normalMagnitude, "N", "#60A5FA")

        if (frictionMagnitude > 5f) {
            drawArrow(canvas, anchorX, anchorY, frictionX, frictionY, frictionMagnitude, "f", "#34D399")
            drawArrow(canvas, anchorX, anchorY, downSlopeX, downSlopeY, slopeMagnitude, "W||", "#FACC15")
        }

        canvas.drawText(String.format(Locale.US, "Tilt: %.1f deg", tiltDegrees), 20f, 42f, infoPaint)
        canvas.drawText("Object: $objectLabel", 20f, 84f, infoPaint)
    }

    private fun drawArrow(
        canvas: Canvas,
        startX: Float,
        startY: Float,
        directionX: Float,
        directionY: Float,
        magnitude: Float,
        label: String,
        colorHex: String
    ) {
        val length = magnitude.coerceAtLeast(1f)
        val endX = startX + directionX * length
        val endY = startY + directionY * length

        arrowPaint.color = Color.parseColor(colorHex)
        arrowFillPaint.color = Color.parseColor(colorHex)

        canvas.drawLine(startX, startY, endX, endY, arrowPaint)

        val headLength = 20f
        val angle = Math.atan2((endY - startY).toDouble(), (endX - startX).toDouble())
        val leftX = (endX - headLength * cos(angle - Math.PI / 7.0)).toFloat()
        val leftY = (endY - headLength * sin(angle - Math.PI / 7.0)).toFloat()
        val rightX = (endX - headLength * cos(angle + Math.PI / 7.0)).toFloat()
        val rightY = (endY - headLength * sin(angle + Math.PI / 7.0)).toFloat()

        val path = android.graphics.Path()
        path.moveTo(endX, endY)
        path.lineTo(leftX, leftY)
        path.lineTo(rightX, rightY)
        path.close()
        canvas.drawPath(path, arrowFillPaint)

        canvas.drawText(label, endX + 8f, endY - 8f, infoPaint)
    }
}
