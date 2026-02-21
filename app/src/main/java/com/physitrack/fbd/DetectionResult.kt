package com.physitrack.fbd

import android.graphics.Rect

data class DetectionResult(
    val label: String,
    val confidence: Float,
    val boundingBox: Rect
)
