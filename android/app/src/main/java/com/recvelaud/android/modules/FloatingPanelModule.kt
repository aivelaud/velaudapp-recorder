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
import android.graphics.drawable.GradientDrawable
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
                // Don't reject - recording still works, just no floating panel
                promise.resolve(null)
                return
            }
            if (floatingView != null) {
                Log.d(TAG, "Panel already showing")
                promise.resolve(null)
                return
            }

            // Must run on main thread for WindowManager operations
            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            handler.post {
                try {
                    windowManager = reactContext.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
                    buildAndShowPanel()
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
            promise.resolve(null) // Don't reject - recording still works
        }
    }

    @ReactMethod
    fun hidePanel(promise: Promise) {
        try {
            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            handler.post { removePanel() }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "hidePanel error", e)
            promise.resolve(null)
        }
    }

    private fun buildAndShowPanel() {
        val ctx = reactContext.applicationContext

        // Container
        val container = FrameLayout(ctx)

        // Collapsed indicator (small pill)
        val pill = buildPill(ctx)
        container.addView(pill)

        // Expanded panel (hidden initially)
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
            // CRITICAL: Set format to translucent for proper overlay rendering
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
                        // Toggle expand/collapse
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
        val pill = FrameLayout(ctx)
        val bg = GradientDrawable().apply {
            setColor(Color.parseColor("#E06C63FF"))
            cornerRadius = 50f
            setStroke(2, Color.parseColor("#FFFFFFFF"))
        }
        pill.background = bg

        val dot = View(ctx).apply {
            val dotBg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#FFFFFF"))
            }
            background = dotBg
        }
        val dotSize = 14.dp(ctx)
        val dotParams = FrameLayout.LayoutParams(dotSize, dotSize).apply {
            gravity = Gravity.CENTER
            setMargins(16.dp(ctx), 10.dp(ctx), 16.dp(ctx), 10.dp(ctx))
        }
        pill.addView(dot, dotParams)
        
        // Pulsing animation
        android.animation.ObjectAnimator.ofFloat(dot, "alpha", 1f, 0.3f).apply {
            duration = 800
            repeatCount = android.animation.ObjectAnimator.INFINITE
            repeatMode = android.animation.ObjectAnimator.REVERSE
            start()
        }
        
        return pill
    }

    private fun buildExpandedPanel(ctx: android.content.Context): View {
        val panel = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp(ctx), 16.dp(ctx), 20.dp(ctx), 16.dp(ctx))
        }
        val bg = GradientDrawable().apply {
            setColor(Color.parseColor("#F06C63FF"))
            cornerRadius = 20f
            setStroke(2, Color.parseColor("#FFFFFFFF"))
        }
        panel.background = bg

        // Duration text
        val durationTv = TextView(ctx).apply {
            text = "⏺ REC"
            setTextColor(Color.WHITE)
            textSize = 18f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 12.dp(ctx))
        }
        panel.addView(durationTv)

        // Button row
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val pauseBtn = buildPanelButton(ctx, "⏸", "Duraklat") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_PAUSE
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }
        val stopBtn = buildPanelButton(ctx, "⏹", "Durdur") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_STOP
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            handler.postDelayed({ removePanel() }, 300)
        }
        row.addView(pauseBtn)
        
        // Spacer
        val spacer = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(12.dp(ctx), 1)
        }
        row.addView(spacer)
        
        row.addView(stopBtn)
        panel.addView(row)
        return panel
    }

    private fun buildPanelButton(ctx: android.content.Context, icon: String, label: String, onClick: () -> Unit): View {
        val btn = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(16.dp(ctx), 10.dp(ctx), 16.dp(ctx), 10.dp(ctx))
            val btnBg = GradientDrawable().apply {
                setColor(Color.parseColor("#FFFFFF"))
                cornerRadius = 12f
            }
            background = btnBg
            setOnClickListener { onClick() }
        }
        
        val iconTv = TextView(ctx).apply {
            text = icon
            textSize = 22f
            setTextColor(Color.parseColor("#6C63FF"))
            gravity = Gravity.CENTER
        }
        btn.addView(iconTv)
        
        val labelTv = TextView(ctx).apply {
            text = label
            textSize = 10f
            setTextColor(Color.parseColor("#444444"))
            gravity = Gravity.CENTER
            setPadding(0, 4.dp(ctx), 0, 0)
        }
        btn.addView(labelTv)
        
        return btn
    }

    private fun removePanel() {
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