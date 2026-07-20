package com.recvelaud.android.modules

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
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
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File

class PreviewOverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "PreviewOverlayModule"
        private var windowManager: WindowManager? = null
        private var overlayView: View? = null
    }

    override fun getName(): String = "PreviewOverlayModule"

    @ReactMethod
    fun showPreview(filePath: String, promise: Promise) {
        try {
            if (!android.provider.Settings.canDrawOverlays(reactContext)) {
                Log.w(TAG, "Overlay permission not granted")
                promise.resolve(false)
                return
            }
            Handler(Looper.getMainLooper()).post {
                try {
                    windowManager = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                    buildAndShowOverlay(filePath)
                    Log.i(TAG, "Preview overlay shown for $filePath")
                } catch (e: Exception) {
                    Log.e(TAG, "Error showing preview overlay", e)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "showPreview error", e)
            promise.resolve(false)
        }
    }

    fun showPreviewDirect(filePath: String) {
        if (!android.provider.Settings.canDrawOverlays(reactContext)) {
            Log.w(TAG, "Overlay permission not granted, cannot show preview")
            return
        }
        Handler(Looper.getMainLooper()).post {
            try {
                removeOverlay()
                windowManager = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                buildAndShowOverlay(filePath)
                Log.i(TAG, "Preview overlay shown (direct) for $filePath")
            } catch (e: Exception) {
                Log.e(TAG, "Error showing preview overlay (direct)", e)
            }
        }
    }

    @ReactMethod
    fun hidePreview(promise: Promise) {
        try {
            Handler(Looper.getMainLooper()).post { removeOverlay() }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "hidePreview error", e)
            promise.resolve(null)
        }
    }

    private fun buildAndShowOverlay(filePath: String) {
        val ctx = reactContext.applicationContext
        val dm = ctx.resources.displayMetrics
        val screenW = dm.widthPixels

        val container = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xF0101014.toInt())
            gravity = Gravity.CENTER
        }

        val cardW = (screenW * 0.82).toInt()
        val card = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundDrawable(GradientDrawable().apply {
                setColor(0xFF1C1C24.toInt())
                cornerRadius = 24f
                setStroke(1, 0xFF2A2A38.toInt())
            })
            setPadding(16.dp(ctx), 14.dp(ctx), 16.dp(ctx), 16.dp(ctx))
            gravity = Gravity.CENTER_HORIZONTAL
        }

        // Header
        val headerRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 10.dp(ctx))
        }
        val titleTv = TextView(ctx).apply {
            text = "Kayıt Tamamlandı"
            setTextColor(Color.WHITE)
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        headerRow.addView(titleTv)
        val closeBtn = TextView(ctx).apply {
            text = "\u2715"
            setTextColor(0xFF9999AA.toInt())
            textSize = 20f
            setPadding(12.dp(ctx), 4.dp(ctx), 4.dp(ctx), 12.dp(ctx))
            setOnClickListener { removeOverlay() }
        }
        headerRow.addView(closeBtn)
        card.addView(headerRow)

        // Thumbnail
        val thumbW = cardW - 32.dp(ctx)
        val thumbH = (thumbW * 9f / 16f).toInt()
        val thumbFrame = FrameLayout(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(thumbW, thumbH)
            setBackgroundDrawable(GradientDrawable().apply {
                setColor(0xFF000000.toInt())
                cornerRadius = 14f
            })
            clipToOutline = true
        }
        val bitmap = generateThumbnail(filePath)
        if (bitmap != null) {
            val imgView = ImageView(ctx).apply {
                layoutParams = FrameLayout.LayoutParams(thumbW, thumbH)
                scaleType = ImageView.ScaleType.CENTER_CROP
                setImageBitmap(bitmap)
            }
            thumbFrame.addView(imgView)
        }
        val playBtn = TextView(ctx).apply {
            text = "\u25B6"
            setTextColor(Color.WHITE)
            textSize = 36f
            gravity = Gravity.CENTER
            val lp = FrameLayout.LayoutParams(64.dp(ctx), 64.dp(ctx), Gravity.CENTER)
            layoutParams = lp
            setBackgroundDrawable(GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0x99000000.toInt())
                setStroke(2, Color.WHITE)
            })
            setOnClickListener { openExternalPlayer(filePath) }
        }
        thumbFrame.addView(playBtn)
        card.addView(thumbFrame)

        // Duration
        val duration = getVideoDurationMs(filePath)
        val durTv = TextView(ctx).apply {
            text = formatDuration(duration)
            setTextColor(0xFFB0B0C0.toInt())
            textSize = 12f
            setPadding(0, 8.dp(ctx), 0, 8.dp(ctx))
        }
        card.addView(durTv)

        // Action buttons
        val btnRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 6.dp(ctx), 0, 0)
        }
        val btnConfigs = listOf(
            Triple("\u2715", "Sil") { confirmAndDelete(filePath) },
            Triple("\u270E", "Düzenle") { openInEditor(filePath) },
            Triple("\u2702", "Kırp") { openInEditor(filePath) },
            Triple("\u2197", "Paylaş") { shareVideo(filePath) },
        )
        for ((icon, label, action) in btnConfigs) {
            btnRow.addView(buildActionButton(ctx, icon, label, action))
        }
        card.addView(btnRow)
        container.addView(card)

        container.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                val cardLocation = IntArray(2)
                card.getLocationOnScreen(cardLocation)
                val inCard = event.rawX >= cardLocation[0] &&
                    event.rawX <= cardLocation[0] + card.width &&
                    event.rawY >= cardLocation[1] &&
                    event.rawY <= cardLocation[1] + card.height
                if (!inCard) removeOverlay()
            }
            true
        }

        val params = WindowManager.LayoutParams().apply {
            type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            flags = WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            width = WindowManager.LayoutParams.MATCH_PARENT
            height = WindowManager.LayoutParams.MATCH_PARENT
            format = android.graphics.PixelFormat.TRANSLUCENT
            gravity = Gravity.CENTER
        }
        windowManager?.addView(container, params)
        overlayView = container
    }

    private fun buildActionButton(
        ctx: Context,
        icon: String,
        label: String,
        onClick: () -> Unit,
    ): View {
        val col = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(10.dp(ctx), 8.dp(ctx), 10.dp(ctx), 8.dp(ctx))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val iconCircle = TextView(ctx).apply {
            text = icon
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setBackgroundDrawable(GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xFF2A2A3A.toInt())
                setStroke(1, 0xFF3A3A4A.toInt())
            })
            val lp = LinearLayout.LayoutParams(42.dp(ctx), 42.dp(ctx))
            lp.gravity = Gravity.CENTER
            layoutParams = lp
        }
        val labelTv = TextView(ctx).apply {
            text = label
            setTextColor(0xFFB0B0C0.toInt())
            textSize = 10f
            setPadding(0, 5.dp(ctx), 0, 0)
            gravity = Gravity.CENTER
        }
        col.addView(iconCircle)
        col.addView(labelTv)
        col.setOnClickListener { onClick() }
        return col
    }

    private fun generateThumbnail(filePath: String): Bitmap? {
        return try {
            val retriever = MediaMetadataRetriever()
            if (filePath.startsWith("content://")) {
                retriever.setDataSource(reactContext, Uri.parse(filePath))
            } else {
                retriever.setDataSource(filePath)
            }
            val bmp = retriever.getFrameAtTime(1_000_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            retriever.release()
            bmp
        } catch (e: Exception) {
            Log.w(TAG, "Thumbnail error: ${e.message}")
            null
        }
    }

    private fun getVideoDurationMs(filePath: String): Long {
        return try {
            val retriever = MediaMetadataRetriever()
            if (filePath.startsWith("content://")) {
                retriever.setDataSource(reactContext, Uri.parse(filePath))
            } else {
                retriever.setDataSource(filePath)
            }
            val d = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_DURATION
            )?.toLongOrNull() ?: 0L
            retriever.release()
            d
        } catch (_: Exception) { 0L }
    }

    private fun formatDuration(ms: Long): String {
        val s = ms / 1000
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) String.format("%d:%02d:%02d", h, m, sec)
        else String.format("%02d:%02d", m, sec)
    }

    private fun uriFor(filePath: String): Uri {
        return if (filePath.startsWith("content://")) {
            Uri.parse(filePath)
        } else {
            FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                File(filePath)
            )
        }
    }

    private fun openExternalPlayer(filePath: String) {
        try {
            val uri = uriFor(filePath)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "openExternalPlayer error: ${e.message}")
        }
    }

    private fun shareVideo(filePath: String) {
        try {
            val uri = uriFor(filePath)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "video/mp4"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(
                Intent.createChooser(intent, "Paylaş").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "shareVideo error: ${e.message}")
        }
    }

    private fun openInEditor(filePath: String) {
        try {
            val uri = uriFor(filePath)
            val intent = Intent(Intent.ACTION_EDIT).apply {
                setDataAndType(uri, "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            openExternalPlayer(filePath)
        }
    }

    private fun confirmAndDelete(filePath: String) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (filePath.startsWith("content://")) {
                    reactContext.contentResolver.delete(Uri.parse(filePath), null, null)
                } else {
                    reactContext.contentResolver.delete(
                        MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
                        "${MediaStore.Video.Media.DATA} = ?",
                        arrayOf(filePath)
                    )
                }
            } else {
                File(filePath).delete()
            }
            removeOverlay()
        } catch (e: Exception) {
            Log.e(TAG, "delete error: ${e.message}")
        }
    }

    private fun removeOverlay() {
        val v = overlayView ?: return
        try { windowManager?.removeView(v) } catch (_: Exception) {}
        overlayView = null
    }

    private fun Int.dp(ctx: Context): Int =
        (this * ctx.resources.displayMetrics.density).toInt()

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
