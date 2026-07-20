package com.recvelaud.android.modules

import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
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
    private var panelStartTimeMs = 0L
    private var pauseBtnIcon: TextView? = null
    private var pauseBtnLabel: TextView? = null
    private var isPanelPaused = false

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            promise.resolve(Settings.canDrawOverlays(reactContext))
        } catch (e: Exception) {
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
            promise.reject("PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun showPanel(promise: Promise) {
        try {
            if (!Settings.canDrawOverlays(reactContext)) {
                promise.resolve(null)
                return
            }
            if (floatingView != null) {
                promise.resolve(null)
                return
            }
            Handler(Looper.getMainLooper()).post {
                try {
                    windowManager = reactContext.getSystemService(
                        android.content.Context.WINDOW_SERVICE
                    ) as WindowManager
                    panelStartTimeMs = System.currentTimeMillis()
                    isPanelPaused = false
                    buildAndShowPanel()
                } catch (e: Exception) {
                    Log.e(TAG, "Error showing panel", e)
                    floatingView = null
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun hidePanel(promise: Promise) {
        Handler(Looper.getMainLooper()).post { removePanel() }
        promise.resolve(null)
    }

    private fun startDurationTimer() {
        durationTimer?.cancel()
        durationTimer = java.util.Timer()
        durationTimer?.scheduleAtFixedRate(object : java.util.TimerTask() {
            override fun run() {
                Handler(Looper.getMainLooper()).post { updateDurationDisplay() }
            }
        }, 0L, 1000L)
    }

    private fun updateDurationDisplay() {
        val tv = durationTextView ?: return
        val elapsed = System.currentTimeMillis() - panelStartTimeMs
        val totalSec = (elapsed / 1000).toInt()
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        tv.text = if (isPanelPaused) "|| ${String.format("%02d:%02d", m, s)}"
                  else String.format("%02d:%02d", m, s)
    }

    // ── XRecorder-style small draggable circle ─────────────────────────────
    private fun buildAndShowPanel() {
        val ctx = reactContext.applicationContext

        val container = FrameLayout(ctx)

        // Collapsed: small red circle (XRecorder style)
        val circle = buildSmallCircle(ctx)
        container.addView(circle)

        // Expanded: control panel
        val expandedPanel = buildExpandedPanel(ctx)
        expandedPanel.visibility = View.GONE
        container.addView(expandedPanel)

        var downX = 0f
        var downY = 0f
        var isDragging = false

        val params = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            width = WindowManager.LayoutParams.WRAP_CONTENT
            height = WindowManager.LayoutParams.WRAP_CONTENT
            gravity = Gravity.TOP or Gravity.END
            x = 12
            y = 300
            format = PixelFormat.TRANSLUCENT
        }

        container.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.rawX; downY = event.rawY; isDragging = false; true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downX
                    val dy = event.rawY - downY
                    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                        isDragging = true
                        params.x = (params.x - dx).toInt()
                        params.y = (params.y + dy).toInt()
                        params.gravity = Gravity.TOP or Gravity.START
                        downX = event.rawX; downY = event.rawY
                        try { windowManager?.updateViewLayout(container, params) } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        isExpanded = !isExpanded
                        circle.visibility = if (isExpanded) View.GONE else View.VISIBLE
                        expandedPanel.visibility = if (isExpanded) View.VISIBLE else View.GONE
                        if (isExpanded) startDurationTimer()
                    }
                    true
                }
                else -> false
            }
        }

        windowManager?.addView(container, params)
        floatingView = container
    }

    // ── Small red circle (XRecorder collapsed state) ───────────────────────
    private fun buildSmallCircle(ctx: android.content.Context): View {
        val size = 48.dp(ctx)
        val circle = View(ctx).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#FF4757"))
                setStroke(3, Color.WHITE)
            }
        }

        // Pulsing animation
        android.animation.ObjectAnimator.ofFloat(circle, "scaleX", 1f, 1.15f, 1f).apply {
            duration = 1200
            repeatCount = android.animation.ObjectAnimator.INFINITE
            start()
        }
        android.animation.ObjectAnimator.ofFloat(circle, "scaleY", 1f, 1.15f, 1f).apply {
            duration = 1200
            repeatCount = android.animation.ObjectAnimator.INFINITE
            start()
        }

        val wrapper = FrameLayout(ctx).apply {
            addView(circle, FrameLayout.LayoutParams(size, size).apply { gravity = Gravity.CENTER })
        }
        return wrapper
    }

    // ── Expanded control panel (XRecorder style) ───────────────────────────
    private fun buildExpandedPanel(ctx: android.content.Context): View {
        val panel = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(10.dp(ctx), 12.dp(ctx), 10.dp(ctx), 12.dp(ctx))
            background = GradientDrawable().apply {
                setColor(0xF0161620.toInt())
                cornerRadius = 28f
                setStroke(1, 0x33FFFFFF.toInt())
            }
        }

        // Duration text
        val durationTv = TextView(ctx).apply {
            text = "00:00"
            setTextColor(Color.WHITE)
            textSize = 20f
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 12.dp(ctx))
        }
        panel.addView(durationTv)
        durationTextView = durationTv

        // Stop button
        val stopBtn = buildCircleButton(ctx, "\u23F9", "Durdur", 0xFFFF4757.toInt()) {
            sendServiceAction(ScreenRecordService.ACTION_STOP)
            Handler(Looper.getMainLooper()).postDelayed({ removePanel() }, 300)
        }
        val stopLp = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 10.dp(ctx) }
        panel.addView(stopBtn, stopLp)

        // Pause/Resume
        val pauseBtn = buildCircleButton(ctx, "\u23F8", "Duraklat", 0xFFFFA500.toInt()) {
            isPanelPaused = !isPanelPaused
            sendServiceAction(
                if (isPanelPaused) ScreenRecordService.ACTION_PAUSE
                else ScreenRecordService.ACTION_RESUME
            )
            pauseBtnIcon?.text = if (isPanelPaused) "\u25B6" else "\u23F8"
            pauseBtnLabel?.text = if (isPanelPaused) "Devam" else "Duraklat"
        }
        pauseBtnIcon = pauseBtn.getChildAt(0) as? TextView
        pauseBtnLabel = pauseBtn.getChildAt(1) as? TextView
        val pauseLp = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 10.dp(ctx) }
        panel.addView(pauseBtn, pauseLp)

        // Home (open app)
        val homeBtn = buildCircleButton(ctx, "\u2302", "Uygulama", 0xFF2A2A3A.toInt()) {
            val intent = reactContext.packageManager
                .getLaunchIntentForPackage(reactContext.packageName)
            intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (intent != null) reactContext.startActivity(intent)
        }
        val homeLp = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 10.dp(ctx) }
        panel.addView(homeBtn, homeLp)

        // Close (minimize)
        panel.addView(buildCircleButton(ctx, "\u2715", "Kapat", 0xFF2A2A3A.toInt()) {
            isExpanded = false
            val parent = panel.parent as? ViewGroup
            parent?.let { p ->
                for (i in 0 until p.childCount) {
                    val child = p.getChildAt(i)
                    child.visibility = if (child == panel) View.GONE else View.VISIBLE
                }
            }
        })

        return panel
    }

    private fun buildCircleButton(
        ctx: android.content.Context,
        icon: String,
        label: String,
        bgColor: Int,
        onClick: () -> Unit,
    ): LinearLayout {
        val col = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setOnClickListener { onClick() }
        }
        val circle = TextView(ctx).apply {
            text = icon
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setBackgroundDrawable(GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(bgColor)
                setStroke(1, 0x33FFFFFF.toInt())
            })
            layoutParams = LinearLayout.LayoutParams(44.dp(ctx), 44.dp(ctx)).apply {
                gravity = Gravity.CENTER
            }
        }
        val lbl = TextView(ctx).apply {
            text = label
            setTextColor(0xFFB0B0C0.toInt())
            textSize = 9f
            setPadding(0, 4.dp(ctx), 0, 0)
            gravity = Gravity.CENTER
        }
        col.addView(circle)
        col.addView(lbl)
        return col
    }

    private fun sendServiceAction(action: String) {
        val ctx = reactContext.applicationContext
        val intent = Intent(ctx, ScreenRecordService::class.java).apply { this.action = action }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent)
        else ctx.startService(intent)
    }

    private fun removePanel() {
        durationTimer?.cancel()
        durationTimer = null
        durationTextView = null
        pauseBtnIcon = null
        pauseBtnLabel = null
        val v = floatingView ?: return
        try { windowManager?.removeView(v) } catch (_: Exception) {}
        floatingView = null
        isExpanded = false
    }

    private fun Int.dp(ctx: android.content.Context): Int =
        (this * ctx.resources.displayMetrics.density).toInt()

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
