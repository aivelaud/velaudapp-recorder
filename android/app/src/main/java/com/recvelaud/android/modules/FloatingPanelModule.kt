package com.recvelaud.android.modules

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.recvelaud.android.services.ScreenRecordService

class FloatingPanelModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "FloatingPanelModule"
    }

    override fun getName(): String = "FloatingPanelModule"

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var isExpanded = false
    private var durationTextView: TextView? = null
    private var durationTimer: java.util.Timer? = null
    private var panelStartTimeMs: Long = 0L
    private var pauseBtnLabel: TextView? = null
    private var pauseBtnIcon: TextView? = null
    private var isPanelPaused = false

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            val canDraw = Settings.canDrawOverlays(reactContext)
            Log.d(TAG, "checkOverlayPermission: $canDraw")
            promise.resolve(canDraw)
        } catch (e: Exception) {
            Log.e(TAG, "checkOverlayPermission error", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactContext.packageName}")
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "requestOverlayPermission error", e)
            promise.reject("PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun showPanel(promise: Promise) {
        try {
            if (!Settings.canDrawOverlays(reactContext)) {
                Log.w(TAG, "Overlay permission not granted")
                promise.resolve(null)
                return
            }
            if (floatingView != null) {
                Log.d(TAG, "Panel already showing")
                promise.resolve(null)
                return
            }

            val handler = Handler(Looper.getMainLooper())
            handler.post {
                try {
                    windowManager = reactContext.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
                    panelStartTimeMs = System.currentTimeMillis()
                    isPanelPaused = false
                    buildAndShowPanel()
                    startDurationTimer()
                    Log.i(TAG, "Panel shown successfully")
                } catch (e: WindowManager.BadTokenException) {
                    Log.e(TAG, "BadTokenException - overlay permission may need re-grant", e)
                    floatingView = null
                } catch (e: Exception) {
                    Log.e(TAG, "Error showing panel on main thread", e)
                    floatingView = null
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "showPanel error", e)
            floatingView = null
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun hidePanel(promise: Promise) {
        try {
            val handler = Handler(Looper.getMainLooper())
            handler.post { removePanel() }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "hidePanel error", e)
            promise.resolve(null)
        }
    }

    private fun startDurationTimer() {
        durationTimer?.cancel()
        durationTimer = java.util.Timer()
        durationTimer?.scheduleAtFixedRate(object : java.util.TimerTask() {
            override fun run() {
                Handler(Looper.getMainLooper()).post {
                    updateDurationDisplay()
                }
            }
        }, 0L, 1000L)
    }

    private fun updateDurationDisplay() {
        val tv = durationTextView ?: return
        val elapsed = System.currentTimeMillis() - panelStartTimeMs
        val totalSec = (elapsed / 1000).toInt()
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        val timeStr = String.format("%02d:%02d:%02d", h, m, s)
        tv.text = if (isPanelPaused) "|| $timeStr" else timeStr
    }

    private fun buildAndShowPanel() {
        val ctx = reactContext.applicationContext

        // Container
        val container = FrameLayout(ctx)

        // Collapsed indicator (small pill with time)
        val pill = buildPill(ctx)
        container.addView(pill)

        // Expanded panel
        val expandedPanel = buildExpandedPanel(ctx)
        expandedPanel.visibility = View.GONE
        container.addView(expandedPanel)

        // Touch handling for drag + tap
        var downX = 0f
        var downY = 0f
        var isDragging = false

        val params = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            width = WindowManager.LayoutParams.WRAP_CONTENT
            height = WindowManager.LayoutParams.WRAP_CONTENT
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 300
            format = android.graphics.PixelFormat.TRANSLUCENT
        }

        container.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX
                    downY = event.rawY
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                        isDragging = true
                        params.x = (params.x + dx).toInt()
                        params.y = (params.y + dy).toInt()
                        downX = event.rawX
                        downY = event.rawY
                        try {
                            windowManager?.updateViewLayout(container, params)
                        } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        isExpanded = !isExpanded
                        pill.visibility = if (isExpanded) View.GONE else View.VISIBLE
                        expandedPanel.visibility = if (isExpanded) View.VISIBLE else View.GONE
                    }
                    true
                }
                else -> false
            }
        }

        windowManager?.addView(container, params)
        floatingView = container
    }

    private fun buildPill(ctx: android.content.Context): View {
        val pill = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(14.dp(ctx), 8.dp(ctx), 14.dp(ctx), 8.dp(ctx))
        }
        val bg = GradientDrawable().apply {
            setColor(Color.parseColor("#E8FF4757"))
            cornerRadius = 50f
            setStroke(2, Color.parseColor("#CCFFFFFF"))
        }
        pill.background = bg

        // Recording dot
        val dot = View(ctx).apply {
            val dotBg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.WHITE)
            }
            background = dotBg
        }
        val dotSize = 10.dp(ctx)
        val dotParams = LinearLayout.LayoutParams(dotSize, dotSize).apply {
            marginEnd = 8.dp(ctx)
        }
        pill.addView(dot, dotParams)

        // Pulsing animation on dot
        android.animation.ObjectAnimator.ofFloat(dot, "alpha", 1f, 0.3f).apply {
            duration = 800
            repeatCount = android.animation.ObjectAnimator.INFINITE
            repeatMode = android.animation.ObjectAnimator.REVERSE
            start()
        }

        // Duration text in pill
        val pillDuration = TextView(ctx).apply {
            text = "00:00:00"
            setTextColor(Color.WHITE)
            textSize = 13f
            typeface = Typeface.MONOSPACE
        }
        pill.addView(pillDuration)
        durationTextView = pillDuration

        return pill
    }

    private fun buildExpandedPanel(ctx: android.content.Context): View {
        val panel = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp(ctx), 16.dp(ctx), 20.dp(ctx), 16.dp(ctx))
            gravity = Gravity.CENTER_HORIZONTAL
        }
        val bg = GradientDrawable().apply {
            setColor(Color.parseColor("#F0191927"))
            cornerRadius = 20f
            setStroke(2, Color.parseColor("#806C63FF"))
        }
        panel.background = bg

        // Duration text (large)
        val durationTv = TextView(ctx).apply {
            text = "00:00:00"
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 14.dp(ctx))
        }
        panel.addView(durationTv)

        // Update durationTextView to point to expanded one when visible
        // We'll update both via timer
        val originalDurationTv = durationTextView
        durationTextView = durationTv

        // We need to update both pill and expanded duration
        // Store reference to pill duration separately
        // Actually let's just keep one reference and update it
        // The pill's textview will be updated via a secondary reference
        // For simplicity, we'll track both
        val pillDurationRef = originalDurationTv

        // Override updateDurationDisplay to update both
        durationTimer?.cancel()
        durationTimer = java.util.Timer()
        durationTimer?.scheduleAtFixedRate(object : java.util.TimerTask() {
            override fun run() {
                Handler(Looper.getMainLooper()).post {
                    val elapsed = System.currentTimeMillis() - panelStartTimeMs
                    val totalSec = (elapsed / 1000).toInt()
                    val h = totalSec / 3600
                    val m = (totalSec % 3600) / 60
                    val s = totalSec % 60
                    val timeStr = String.format("%02d:%02d:%02d", h, m, s)
                    val displayStr = if (isPanelPaused) "|| $timeStr" else timeStr
                    durationTv.text = displayStr
                    pillDurationRef?.text = displayStr
                }
            }
        }, 0L, 1000L)

        // Button row
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        // Pause button
        val pauseBtn = buildPanelButton(ctx, "\u23F8", "Duraklat") {
            isPanelPaused = !isPanelPaused
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = if (isPanelPaused) ScreenRecordService.ACTION_PAUSE else ScreenRecordService.ACTION_RESUME
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            // Update button label
            pauseBtnIcon?.text = if (isPanelPaused) "\u25B6" else "\u23F8"
            pauseBtnLabel?.text = if (isPanelPaused) "Devam" else "Duraklat"
        }
        row.addView(pauseBtn)

        // Spacer
        val spacer = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(14.dp(ctx), 1)
        }
        row.addView(spacer)

        // Stop button
        val stopBtn = buildPanelButton(ctx, "\u23F9", "Durdur") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_STOP
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            Handler(Looper.getMainLooper()).postDelayed({ removePanel() }, 300)
        }
        row.addView(stopBtn)

        // Spacer
        val spacer2 = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(14.dp(ctx), 1)
        }
        row.addView(spacer2)

        // Close panel button (minimize)
        val closeBtn = buildPanelButton(ctx, "\u2715", "Kapat") {
            isExpanded = false
            // Find pill and expanded in parent
            val parent = panel.parent as? ViewGroup
            if (parent != null) {
                for (i in 0 until parent.childCount) {
                    val child = parent.getChildAt(i)
                    if (child == panel) {
                        child.visibility = View.GONE
                    } else {
                        child.visibility = View.VISIBLE
                    }
                }
            }
        }
        row.addView(closeBtn)

        panel.addView(row)
        return panel
    }

    private fun buildPanelButton(ctx: android.content.Context, icon: String, label: String, onClick: () -> Unit): View {
        val btn = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(14.dp(ctx), 10.dp(ctx), 14.dp(ctx), 10.dp(ctx))
            val btnBg = GradientDrawable().apply {
                setColor(Color.parseColor("#2A2A3E"))
                cornerRadius = 12f
                setStroke(1, Color.parseColor("#3A3A50"))
            }
            background = btnBg
            setOnClickListener { onClick() }
        }

        val iconTv = TextView(ctx).apply {
            text = icon
            textSize = 20f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        btn.addView(iconTv)

        val labelTv = TextView(ctx).apply {
            text = label
            textSize = 9f
            setTextColor(Color.parseColor("#B0B0C8"))
            gravity = Gravity.CENTER
            setPadding(0, 4.dp(ctx), 0, 0)
        }
        btn.addView(labelTv)

        // Store references for pause button
        if (label == "Duraklat") {
            pauseBtnIcon = iconTv
            pauseBtnLabel = labelTv
        }

        return btn
    }

    private fun removePanel() {
        durationTimer?.cancel()
        durationTimer = null
        durationTextView = null
        pauseBtnIcon = null
        pauseBtnLabel = null
        val v = floatingView ?: return
        try {
            windowManager?.removeView(v)
        } catch (_: Exception) {}
        floatingView = null
        isExpanded = false
    }

    private fun Int.dp(ctx: android.content.Context): Int =
        (this * ctx.resources.displayMetrics.density).toInt()

    @ReactMethod
    fun addListener(eventName: String) {}
    @ReactMethod
    fun removeListeners(count: Int) {}
}