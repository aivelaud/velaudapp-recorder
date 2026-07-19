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
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import com.facebook.react.bridge.*
import com.recvelaud.android.services.ScreenRecordService

class FloatingPanelModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FloatingPanelModule"

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var isExpanded = false

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}")
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        reactContext.startActivity(intent)
        promise.resolve(null)
    }

    @ReactMethod
    fun showPanel(promise: Promise) {
        try {
            if (!Settings.canDrawOverlays(reactContext)) {
                android.util.Log.w("FloatingPanelModule", "Overlay permission not granted, requesting...")
                // Don't reject immediately - panel will be shown after user grants permission
                promise.resolve(null)
                return
            }
            if (floatingView != null) {
                android.util.Log.d("FloatingPanelModule", "Panel already showing")
                promise.resolve(null)
                return
            }
            windowManager = reactContext.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
            buildAndShowPanel()
            android.util.Log.i("FloatingPanelModule", "Panel shown successfully")
            promise.resolve(null)
        } catch (e: WindowManager.BadTokenException) {
            // Overlay permission looked granted but the OS refused to attach the
            // window (can happen right after the user grants the permission,
            // before the app process re-syncs). Never let this crash recording.
            android.util.Log.e("FloatingPanelModule", "BadTokenException adding overlay window", e)
            floatingView = null
            promise.reject("PANEL_ERROR", "Kontrol paneli eklenemedi, izin ayarını tekrar kontrol edin.")
        } catch (e: Exception) {
            android.util.Log.e("FloatingPanelModule", "Error showing panel", e)
            floatingView = null
            promise.reject("PANEL_ERROR", "Panel gösterilemedi: ${e.message}")
        }
    }

    @ReactMethod
    fun hidePanel(promise: Promise) {
        removePanel()
        promise.resolve(null)
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

        // Toggle expand/collapse on single tap
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
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            width = WindowManager.LayoutParams.WRAP_CONTENT
            height = WindowManager.LayoutParams.WRAP_CONTENT
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 300
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
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        isDragging = true
                        params.x = (params.x + dx).toInt()
                        params.y = (params.y + dy).toInt()
                        downX = event.rawX
                        downY = event.rawY
                        windowManager?.updateViewLayout(container, params)
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
            setColor(Color.parseColor("#E0E53935"))
            cornerRadius = 50f
            setStroke(3, Color.parseColor("#FFFFFFFF"))
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
        
        // Add pulsing animation to the dot
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
            setColor(Color.parseColor("#F0E53935"))
            cornerRadius = 20f
            setStroke(3, Color.parseColor("#FFFFFFFF"))
        }
        panel.background = bg

        // Duration text
        val durationTv = TextView(ctx).apply {
            text = "00:00:00"
            setTextColor(Color.WHITE)
            textSize = 22f
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
        val pauseBtn = buildPanelButton(ctx, "⏸", "Pause") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_PAUSE
            }
            ctx.startService(intent)
        }
        val stopBtn = buildPanelButton(ctx, "⏹", "Stop") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_STOP
            }
            ctx.startService(intent)
            removePanel()
        }
        row.addView(pauseBtn)
        
        // Add spacing between buttons
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
            setPadding(16.dp(ctx), 12.dp(ctx), 16.dp(ctx), 12.dp(ctx))
            val btnBg = GradientDrawable().apply {
                setColor(Color.parseColor("#FFFFFF"))
                cornerRadius = 12f
            }
            background = btnBg
            setOnClickListener { onClick() }
        }
        
        val iconTv = TextView(ctx).apply {
            text = icon
            textSize = 24f
            setTextColor(Color.parseColor("#E53935"))
            gravity = Gravity.CENTER
        }
        btn.addView(iconTv)
        
        val labelTv = TextView(ctx).apply {
            text = label
            textSize = 11f
            setTextColor(Color.parseColor("#666666"))
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
