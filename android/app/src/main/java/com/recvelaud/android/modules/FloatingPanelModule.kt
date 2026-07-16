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
        if (!Settings.canDrawOverlays(reactContext)) {
            promise.reject("NO_PERMISSION", "SYSTEM_ALERT_WINDOW permission not granted")
            return
        }
        if (floatingView != null) {
            promise.resolve(null)
            return
        }
        try {
            windowManager = reactContext.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
            buildAndShowPanel()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PANEL_ERROR", e.message)
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
            setColor(Color.parseColor("#CC1A1A1A"))
            cornerRadius = 40f
        }
        pill.background = bg

        val dot = View(ctx).apply {
            val dotBg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#E53935"))
            }
            background = dotBg
        }
        val dotSize = 18.dp(ctx)
        val dotParams = FrameLayout.LayoutParams(dotSize, dotSize).apply {
            gravity = Gravity.CENTER
            setMargins(12.dp(ctx), 8.dp(ctx), 12.dp(ctx), 8.dp(ctx))
        }
        pill.addView(dot, dotParams)
        return pill
    }

    private fun buildExpandedPanel(ctx: android.content.Context): View {
        val panel = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp(ctx), 12.dp(ctx), 16.dp(ctx), 12.dp(ctx))
        }
        val bg = GradientDrawable().apply {
            setColor(Color.parseColor("#E0141414"))
            cornerRadius = 16f
        }
        panel.background = bg

        // Duration text
        val durationTv = TextView(ctx).apply {
            text = "00:00:00"
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
        }
        panel.addView(durationTv)

        // Button row
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val pauseBtn = buildPanelButton(ctx, "⏸") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_PAUSE
            }
            ctx.startService(intent)
        }
        val stopBtn = buildPanelButton(ctx, "⏹") {
            val intent = Intent(ctx, ScreenRecordService::class.java).apply {
                action = ScreenRecordService.ACTION_STOP
            }
            ctx.startService(intent)
            removePanel()
        }
        row.addView(pauseBtn)
        row.addView(stopBtn)
        panel.addView(row)
        return panel
    }

    private fun buildPanelButton(ctx: android.content.Context, label: String, onClick: () -> Unit): View {
        val tv = TextView(ctx).apply {
            text = label
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(18.dp(ctx), 10.dp(ctx), 18.dp(ctx), 10.dp(ctx))
            setOnClickListener { onClick() }
        }
        return tv
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
