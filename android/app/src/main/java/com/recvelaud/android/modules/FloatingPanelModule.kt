package com.recvelaud.android.modules

import android.content.Context
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
import android.util.DisplayMetrics
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.bridge.*
import com.recvelaud.android.services.ScreenRecordService

class FloatingPanelModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "FloatingPanelModule"
        private const val PREFS_NAME = "velaud_floating_panel"
        private const val KEY_POS_X = "pos_x"
        private const val KEY_POS_Y = "pos_y"
        private const val DEFAULT_X = 24
        private const val DEFAULT_Y = 300
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
    private var smallCircle: View? = null
    private var expandedPanel: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null

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
                        Context.WINDOW_SERVICE
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

    private fun getScreenWidth(): Int {
        val metrics = DisplayMetrics()
        windowManager?.defaultDisplay?.getRealMetrics(metrics)
        return metrics.widthPixels
    }

    private fun getScreenHeight(): Int {
        val metrics = DisplayMetrics()
        windowManager?.defaultDisplay?.getRealMetrics(metrics)
        return metrics.heightPixels
    }

    private fun loadSavedPosition(): Pair<Int, Int> {
        val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return Pair(prefs.getInt(KEY_POS_X, DEFAULT_X), prefs.getInt(KEY_POS_Y, DEFAULT_Y))
    }

    private fun savePosition(x: Int, y: Int) {
        val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_POS_X, x).putInt(KEY_POS_Y, y).apply()
    }

    private fun clampPosition(x: Int, y: Int, viewWidth: Int, viewHeight: Int): Pair<Int, Int> {
        val screenW = getScreenWidth()
        val screenH = getScreenHeight()
        val clampedX = x.coerceIn(0, (screenW - viewWidth).coerceAtLeast(0))
        val clampedY = y.coerceIn(0, (screenH - viewHeight).coerceAtLeast(0))
        return Pair(clampedX, clampedY)
    }

    // ── XRecorder-style small draggable circle with Velaud app icon ─────────
    private fun buildAndShowPanel() {
        val ctx = reactContext.applicationContext

        val container = FrameLayout(ctx)

        // Collapsed: small circle with Velaud app icon
        val circle = buildSmallCircle(ctx)
        container.addView(circle)
        smallCircle = circle

        // Expanded: control panel
        val expanded = buildExpandedPanel(ctx)
        expanded.visibility = View.GONE
        container.addView(expanded)
        expandedPanel = expanded

        val (savedX, savedY) = loadSavedPosition()

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
            gravity = Gravity.TOP or Gravity.START
            x = savedX
            y = savedY
            format = PixelFormat.TRANSLUCENT
        }
        layoutParams = params

        var downX = 0f
        var downY = 0f
        var isDragging = false

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
                        // FIX: Both axes now move in the same direction as the finger.
                        // Previously x was inverted (params.x - dx) causing opposite movement.
                        val newSize = container.width.coerceAtLeast(48.dp(ctx))
                        val (cx, cy) = clampPosition(
                            params.x + dx.toInt(),
                            params.y + dy.toInt(),
                            newSize,
                            newSize
                        )
                        params.x = cx
                        params.y = cy
                        downX = event.rawX; downY = event.rawY
                        try { windowManager?.updateViewLayout(container, params) } catch (_: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (isDragging) {
                        savePosition(params.x, params.y)
                    } else {
                        isExpanded = !isExpanded
                        circle.visibility = if (isExpanded) View.GONE else View.VISIBLE
                        expanded.visibility = if (isExpanded) View.VISIBLE else View.GONE
                        if (isExpanded) startDurationTimer()
                    }
                    true
                }
                else -> false
            }
        }

        windowManager?.addView(container, params)
        floatingView = container

        // Ensure the panel starts within screen bounds
        container.post {
            val (cx, cy) = clampPosition(params.x, params.y, container.width, container.height)
            if (cx != params.x || cy != params.y) {
                params.x = cx
                params.y = cy
                try { windowManager?.updateViewLayout(container, params) } catch (_: Exception) {}
                savePosition(cx, cy)
            }
        }
    }

    // ── Small circle with Velaud app icon (XRecorder collapsed state) ────────
    private fun buildSmallCircle(ctx: Context): View {
        val size = 52.dp(ctx)
        val wrapper = FrameLayout(ctx).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xE6161620.toInt())
                setStroke(2, 0x55FFFFFF.toInt())
            }
        }

        // Use the Velaud app icon (ic_launcher_foreground) instead of ugly red circle
        val icon = ImageView(ctx).apply {
            setImageResource(
                ctx.resources.getIdentifier("ic_launcher_foreground", "mipmap", ctx.packageName)
            )
            scaleType = ImageView.ScaleType.CENTER_CROP
            clipToOutline = true
            outlineProvider = object : android.view.ViewOutlineProvider() {
                override fun getOutline(view: View, outline: android.graphics.Outline) {
                    val s = view.width.coerceAtMost(view.height)
                    outline.setOval(0, 0, s, s)
                }
            }
        }

        val iconSize = size - 8.dp(ctx)
        val iconLp = FrameLayout.LayoutParams(iconSize, iconSize).apply {
            gravity = Gravity.CENTER
        }
        wrapper.addView(icon, iconLp)

        // Subtle pulsing ring around the icon
        val ring = View(ctx).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.TRANSPARENT)
                setStroke(2, 0x443B82F6.toInt())
            }
            alpha = 0.6f
        }
        val ringSize = size + 6.dp(ctx)
        wrapper.addView(ring, FrameLayout.LayoutParams(ringSize, ringSize).apply {
            gravity = Gravity.CENTER
        })

        android.animation.ObjectAnimator.ofFloat(ring, "scaleX", 1f, 1.15f, 1f).apply {
            duration = 1800
            repeatCount = android.animation.ObjectAnimator.INFINITE
            start()
        }
        android.animation.ObjectAnimator.ofFloat(ring, "scaleY", 1f, 1.15f, 1f).apply {
            duration = 1800
            repeatCount = android.animation.ObjectAnimator.INFINITE
            start()
        }
        android.animation.ObjectAnimator.ofFloat(ring, "alpha", 0.5f, 0.15f, 0.5f).apply {
            duration = 1800
            repeatCount = android.animation.ObjectAnimator.INFINITE
            start()
        }

        return wrapper
    }

    // ── Expanded control panel (XRecorder style - clean, no overlap) ────────
    private fun buildExpandedPanel(ctx: Context): View {
        val panel = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(16.dp(ctx), 14.dp(ctx), 16.dp(ctx), 14.dp(ctx))
            background = GradientDrawable().apply {
                setColor(0xF0181825.toInt())
                cornerRadius = 24f
                setStroke(1, 0x33FFFFFF.toInt())
            }
        }

        // Duration text at top
        val durationTv = TextView(ctx).apply {
            text = "00:00"
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 14.dp(ctx))
        }
        panel.addView(durationTv)
        durationTextView = durationTv

        // Horizontal row of buttons — clean, evenly spaced, no overlap
        val buttonRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 0)
        }

        // Stop button
        val stopBtn = buildCircleButton(ctx, "\u23F9", "Durdur", 0xFFFF4757.toInt()) {
            durationTimer?.cancel()
            durationTimer = null
            durationTextView?.text = "00:00"
            sendServiceAction(ScreenRecordService.ACTION_STOP)
            Handler(Looper.getMainLooper()).postDelayed({ removePanel() }, 300)
        }
        buttonRow.addView(stopBtn, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { marginEnd = 16.dp(ctx) })

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
        buttonRow.addView(pauseBtn, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { marginEnd = 16.dp(ctx) })

        // Home (open app)
        val homeBtn = buildCircleButton(ctx, "\u2302", "Uygulama", 0xFF3B82F6.toInt()) {
            val intent = reactContext.packageManager
                .getLaunchIntentForPackage(reactContext.packageName)
            intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (intent != null) reactContext.startActivity(intent)
        }
        buttonRow.addView(homeBtn, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { marginEnd = 16.dp(ctx) })

        // Close (minimize back to small circle)
        buttonRow.addView(buildCircleButton(ctx, "\u2715", "Kapat", 0xFF444466.toInt()) {
            isExpanded = false
            smallCircle?.visibility = View.VISIBLE
            expandedPanel?.visibility = View.GONE
        })

        panel.addView(buttonRow)

        return panel
    }

    private fun buildCircleButton(
        ctx: Context,
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
            textSize = 20f
            gravity = Gravity.CENTER
            setBackgroundDrawable(GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(bgColor)
                setStroke(1, 0x33FFFFFF.toInt())
            })
            layoutParams = LinearLayout.LayoutParams(48.dp(ctx), 48.dp(ctx)).apply {
                gravity = Gravity.CENTER
            }
        }
        val lbl = TextView(ctx).apply {
            text = label
            setTextColor(0xFFB0B0C0.toInt())
            textSize = 10f
            setPadding(0, 5.dp(ctx), 0, 0)
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
        smallCircle = null
        expandedPanel = null
        val v = floatingView ?: return
        try { windowManager?.removeView(v) } catch (_: Exception) {}
        floatingView = null
        isExpanded = false
    }

    private fun Int.dp(ctx: Context): Int =
        (this * ctx.resources.displayMetrics.density).toInt()

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
