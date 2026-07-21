package com.recvelaud.android.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.recvelaud.android.MainActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.Timer
import java.util.TimerTask

class ScreenRecordService : Service() {

    companion object {
        private const val TAG = "ScreenRecordService"
        const val CHANNEL_ID = "velaud_recording"
        const val NOTIF_ID = 1001
        const val ACTION_STOP = "com.recvelaud.android.STOP_RECORDING"
        const val ACTION_PAUSE = "com.recvelaud.android.PAUSE_RECORDING"
        const val ACTION_RESUME = "com.recvelaud.android.RESUME_RECORDING"

        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
        const val EXTRA_WIDTH = "width"
        const val EXTRA_HEIGHT = "height"
        const val EXTRA_FPS = "fps"
        const val EXTRA_INCLUDE_AUDIO = "include_audio"
        const val EXTRA_AUDIO_SOURCE = "audio_source"
        const val EXTRA_VOLUME = "volume"
        const val EXTRA_NOISE_REDUCTION = "noise_reduction"
        const val EXTRA_COUNTDOWN = "countdown"
        const val EXTRA_HIDE_POPUP = "hide_popup"
        const val EXTRA_SHAKE_TO_STOP = "shake_to_stop"
        const val EXTRA_SHAKE_SENSITIVITY = "shake_sensitivity"

        var reactContext: ReactApplicationContext? = null
    }

    inner class RecordBinder : Binder() {
        val service: ScreenRecordService get() = this@ScreenRecordService
    }

    private val binder = RecordBinder()
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var mediaRecorder: MediaRecorder? = null
    private var outputFilePath: String? = null
    // CRITICAL FIX: Keep ParcelFileDescriptor open for the entire recording session.
    // Closing it (via use{}) before stop() causes MediaRecorder to lose write access
    // on some Samsung/Android 14 devices → 0-byte output file.
    private var outputPfd: ParcelFileDescriptor? = null
    private var isRecording = false
    private var isPaused = false
    private var startTimeMs = 0L
    private var pausedDurationMs = 0L
    private var pauseStartMs = 0L
    private var durationTimer: Timer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var projectionCallback: MediaProjection.Callback? = null
    private var sensorManager: SensorManager? = null
    private var shakeListener: SensorEventListener? = null
    private var lastShakeMs = 0L
    private var hidePopup = false

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            durationTimer?.cancel()
            durationTimer = null
            if (isRecording) {
                try { mediaRecorder?.stop() } catch (_: Exception) {}
            }
            mediaRecorder?.release()
            virtualDisplay?.release()
            val cbDestroy = projectionCallback
            if (cbDestroy != null) { mediaProjection?.unregisterCallback(cbDestroy) }
            mediaProjection?.stop()
            try { outputPfd?.close() } catch (_: Exception) {}
        } catch (_: Exception) {
        } finally {
            mediaRecorder = null
            virtualDisplay = null
            mediaProjection = null
            projectionCallback = null
            outputPfd = null
            isRecording = false
            isPaused = false
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent ?: return START_NOT_STICKY
        when (intent.action) {
            ACTION_STOP -> stopRecording()
            ACTION_PAUSE -> pauseRecording()
            ACTION_RESUME -> resumeRecording()
            else -> startRecording(intent)
        }
        return START_STICKY
    }

    private fun startRecording(intent: Intent) {
        if (isRecording) {
            Log.w(TAG, "startRecording called while already recording — ignoring")
            emitStatus()
            return
        }

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1)
        val resultData: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }
        // FIX: Use real device screen dimensions when caller passes 0/invalid values.
        // Previously defaulted to 1920x1080 (PC-style) which produced desktop-aspect videos
        // on phones. Now we honor the actual phone display resolution.
        val metrics = resources.displayMetrics
        val defaultW = metrics.widthPixels
        val defaultH = metrics.heightPixels
        val reqW = intent.getIntExtra(EXTRA_WIDTH, 0)
        val reqH = intent.getIntExtra(EXTRA_HEIGHT, 0)
        val width = if (reqW > 0) reqW else defaultW
        val height = if (reqH > 0) reqH else defaultH
        val fps = intent.getIntExtra(EXTRA_FPS, 30)
        val includeAudio = intent.getBooleanExtra(EXTRA_INCLUDE_AUDIO, true)
        val audioSourceStr = intent.getStringExtra(EXTRA_AUDIO_SOURCE) ?: "microphone"
        val volume = intent.getIntExtra(EXTRA_VOLUME, 100)
        val noiseReduction = intent.getBooleanExtra(EXTRA_NOISE_REDUCTION, false)
        val countdownStr = intent.getStringExtra(EXTRA_COUNTDOWN) ?: "3s"
        hidePopup = intent.getBooleanExtra(EXTRA_HIDE_POPUP, false)
        val shakeToStop = intent.getBooleanExtra(EXTRA_SHAKE_TO_STOP, false)
        val shakeSensitivity = intent.getIntExtra(EXTRA_SHAKE_SENSITIVITY, 50)

        if (resultCode != android.app.Activity.RESULT_OK) {
            Log.e(TAG, "Invalid result code for MediaProjection: $resultCode")
            emitError("Ekran kaydı izni reddedildi")
            stopSelf()
            return
        }

        if (resultData == null) {
            Log.e(TAG, "No result data for MediaProjection")
            emitError("Kayıt izni verisi bulunamadı")
            stopSelf()
            return
        }

        // CRITICAL FIX (Android 10+ / Android 14 enforcement):
        // startForeground MUST include FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION when the
        // manifest declares foregroundServiceType="mediaProjection".
        // Without this, on Android 14+ (API 34) getMediaProjection() throws SecurityException,
        // and on Android 10-13 the OS may silently stop the projection.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIF_ID,
                    buildNotification("Kayıt hazırlanıyor…"),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                )
            } else {
                startForeground(NOTIF_ID, buildNotification("Kayıt hazırlanıyor…"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed: ${e::class.simpleName}: ${e.message}", e)
            emitError("Ön plan servisi başlatılamadı: ${e.message}")
            stopSelf()
            return
        }

        try {
            val projManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projManager.getMediaProjection(resultCode, resultData)

            if (mediaProjection == null) {
                Log.e(TAG, "MediaProjection is null after creation — likely Android 14 type enforcement")
                emitError("Ekran kaydı başlatılamadı (MediaProjection null)")
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }

            // CRITICAL (Android 14 / API 34+): Register MediaProjection.Callback BEFORE
            // creating VirtualDisplay. Without this, the OS invalidates the session.
            projectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.w(TAG, "MediaProjection.onStop() — projection revoked by system/user")
                    handler.post { stopRecording() }
                }
            }
            val cb = projectionCallback
            if (cb != null) {
                mediaProjection?.registerCallback(cb, handler)
            }

            // Set up MediaRecorder
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                try {
                    if (includeAudio) {
                        // Map audio source string to Android AudioSource
                        val asrc = when (audioSourceStr) {
                            "internal" -> MediaRecorder.AudioSource.REMOTE_SUBMIX
                            "both" -> MediaRecorder.AudioSource.MIC // Fallback: MIC captures both on most devices with MediaProjection
                            else -> MediaRecorder.AudioSource.MIC
                        }
                        setAudioSource(asrc)
                    }
                    setVideoSource(MediaRecorder.VideoSource.SURFACE)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)

                    val fileName = "VelaudRec_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())}.mp4"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val values = ContentValues().apply {
                            put(MediaStore.Video.Media.DISPLAY_NAME, fileName)
                            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                            put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/VelaudRecorder")
                            put(MediaStore.Video.Media.IS_PENDING, 1)
                        }
                        val uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                            ?: throw Exception("MediaStore URI oluşturulamadı")
                        outputFilePath = uri.toString()

                        // CRITICAL FIX: Do NOT use use{} — keep the ParcelFileDescriptor open
                        // for the entire recording session. Close it only in stopRecording() / cleanup.
                        // Using use{} closes the fd right after setOutputFile(), which on some devices
                        // causes MediaRecorder to write 0 bytes.
                        val pfd = contentResolver.openFileDescriptor(uri, "rw")
                            ?: throw Exception("FileDescriptor açılamadı")
                        outputPfd = pfd
                        setOutputFile(pfd.fileDescriptor)
                    } else {
                        val dir = android.os.Environment.getExternalStoragePublicDirectory(
                            android.os.Environment.DIRECTORY_MOVIES
                        ).resolve("VelaudRecorder").also {
                            if (!it.exists() && !it.mkdirs()) {
                                throw Exception("Kayıt klasörü oluşturulamadı")
                            }
                        }
                        val file = dir.resolve(fileName)
                        outputFilePath = file.absolutePath
                        setOutputFile(outputFilePath)
                    }

                    setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                    if (includeAudio) {
                        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                        // Volume scaling: 100% = 128kbps, scale linearly up to 200%
                        val audioBitrate = (128_000 * volume / 100).coerceIn(32_000, 384_000)
                        setAudioEncodingBitRate(audioBitrate)
                        setAudioSamplingRate(44100)
                    }
                    setVideoEncodingBitRate(8_000_000)
                    setVideoFrameRate(fps)
                    setVideoSize(width, height)

                    Log.d(TAG, "Calling prepare()…")
                    prepare()
                    Log.d(TAG, "prepare() succeeded")
                } catch (e: Exception) {
                    Log.e(TAG, "MediaRecorder setup failed: ${e::class.simpleName}: ${e.message}", e)
                    throw e
                }
            }

            // Create VirtualDisplay — must use getSurface() AFTER prepare()
            val screenDensity = resources.displayMetrics.densityDpi
            Log.d(TAG, "Creating VirtualDisplay ${width}x${height} density=$screenDensity")
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "VelaudCapture",
                width, height, screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder?.surface, null, null
            )

            if (virtualDisplay == null) {
                throw Exception("VirtualDisplay oluşturulamadı")
            }

            // ── Countdown overlay before recording starts ───────────────────
            // Honors the user's countdown setting (off / 3s / 5s / 10s).
            // Numbers are white with a soft glow for readability on any content.
            val countdownSeconds = when (countdownStr) {
                "off" -> 0
                "5s" -> 5
                "10s" -> 10
                else -> 3
            }
            val onShakeToStop = shakeToStop
            val onShakeSens = shakeSensitivity
            showCountdownOverlay(countdownSeconds) {
                Log.d(TAG, "Calling start()…")
                mediaRecorder?.start()
                Log.i(TAG, "Recording started successfully → $outputFilePath")

                isRecording = true
                isPaused = false
                startTimeMs = System.currentTimeMillis()
                pausedDurationMs = 0L

                updateNotification("⏺ Ekran kaydediliyor…")
                startDurationTimer()
                if (onShakeToStop) startShakeDetection(onShakeSens)
                emitStatus()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording: ${e::class.simpleName}: ${e.message}", e)
            val errorMsg = when {
                e.message?.contains("prepare", ignoreCase = true) == true -> "MediaRecorder hazırlanamadı: ${e.message}"
                e.message?.contains("permission", ignoreCase = true) == true -> "Gerekli izinler verilmemiş"
                e.message?.contains("MediaStore", ignoreCase = true) == true -> "Video dosyası oluşturulamadı"
                e.message?.contains("SecurityException", ignoreCase = true) == true -> "Güvenlik hatası: ${e.message}"
                !e.message.isNullOrBlank() -> e.message!!
                else -> "Kayıt başlatılamadı (${e::class.simpleName})"
            }
            emitError(errorMsg)

            try {
                mediaRecorder?.release()
                virtualDisplay?.release()
                val cbErr = projectionCallback
                if (cbErr != null) { mediaProjection?.unregisterCallback(cbErr) }
                mediaProjection?.stop()
                outputPfd?.close()
            } catch (_: Exception) {}

            mediaRecorder = null
            virtualDisplay = null
            mediaProjection = null
            projectionCallback = null
            outputPfd = null
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    fun stopRecording() {
        if (!isRecording) return
        stopShakeDetection()
        try {
            durationTimer?.cancel()
            durationTimer = null
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            virtualDisplay?.release()
            virtualDisplay = null
            val cbStop = projectionCallback
            if (cbStop != null) { mediaProjection?.unregisterCallback(cbStop) }
            mediaProjection?.stop()
            mediaProjection = null
            projectionCallback = null

            // Close the ParcelFileDescriptor now that recording is done
            try { outputPfd?.close() } catch (_: Exception) {}
            outputPfd = null

            isRecording = false
            isPaused = false

            // Mark media as no longer pending (Android Q+)
            val path = outputFilePath
            if (path != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                path.startsWith("content://")
            ) {
                try {
                    val uri = android.net.Uri.parse(path)
                    val values = ContentValues().apply {
                        put(MediaStore.Video.Media.IS_PENDING, 0)
                    }
                    contentResolver.update(uri, values, null, null)
                    Log.i(TAG, "MediaStore IS_PENDING cleared for $path")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to clear IS_PENDING: ${e.message}")
                }
            }

            emitSaved(outputFilePath ?: "")
            emitStatus()
            Log.i(TAG, "Recording stopped, saved: $outputFilePath")

            // Show native preview overlay on top of any app (XRecorder-style)
            // unless the user has disabled it in Settings.
            if (!hidePopup) {
                try {
                    val ctx = reactContext
                    val path = outputFilePath
                    if (ctx != null && path != null) {
                        val module = ctx.getNativeModule(
                            com.recvelaud.android.modules.PreviewOverlayModule::class.java
                        )
                        module?.showPreviewDirect(path)
                    }
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording: ${e::class.simpleName}: ${e.message}", e)
            emitError("Kayıt durdurulamadı: ${e.message ?: e::class.simpleName}")
        } finally {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    fun pauseRecording() {
        if (!isRecording || isPaused) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            mediaRecorder?.pause()
            isPaused = true
            pauseStartMs = System.currentTimeMillis()
            updateNotification("⏸ Kayıt duraklatıldı")
            emitStatus()
        }
    }

    fun resumeRecording() {
        if (!isRecording || !isPaused) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            mediaRecorder?.resume()
            isPaused = false
            pausedDurationMs += System.currentTimeMillis() - pauseStartMs
            updateNotification("⏺ Ekran kaydediliyor…")
            emitStatus()
        }
    }

    fun isRecordingActive(): Boolean = isRecording

    fun isPausedState(): Boolean = isPaused

    fun getCurrentDuration(): Double = getDurationMs().toDouble()

    fun getOutputPath(): String? = outputFilePath

    private fun getDurationMs(): Long {
        if (!isRecording) return 0L
        val elapsed = System.currentTimeMillis() - startTimeMs - pausedDurationMs
        return if (isPaused) (pauseStartMs - startTimeMs - pausedDurationMs) else elapsed
    }

    private fun startDurationTimer() {
        durationTimer = Timer()
        durationTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                if (isRecording) {
                    emitStatus()
                    handler.post { updateNotificationWithDuration() }
                }
            }
        }, 1000L, 1000L)
    }

    // ── 3-second blue countdown overlay (3 → 2 → 1) before recording starts ─
    private fun showCountdownOverlay(seconds: Int, onComplete: () -> Unit) {
        if (seconds <= 0) { onComplete(); return }
        val ctx = reactContext ?: run { onComplete(); return }
        val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        if (wm == null || !Settings.canDrawOverlays(ctx)) {
            onComplete()
            return
        }

        val density = ctx.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val container = android.widget.FrameLayout(ctx).apply {
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
        }

        val numberView = android.widget.TextView(ctx).apply {
            text = seconds.toString()
            setTextColor(android.graphics.Color.WHITE) // white number — readable on any content
            textSize = 140f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            setShadowLayer(30f, 0f, 0f, 0xCC000000.toInt()) // soft dark glow for contrast
        }
        val labelView = android.widget.TextView(ctx).apply {
            text = "Kayıt başlıyor…"
            setTextColor(0xFFE5E7EB.toInt())
            textSize = 16f
            gravity = android.view.Gravity.CENTER
            setShadowLayer(12f, 0f, 0f, 0xAA000000.toInt())
        }

        val textCol = android.widget.LinearLayout(ctx).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
        }
        textCol.addView(numberView)
        textCol.addView(labelView, android.widget.LinearLayout.LayoutParams(
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(16) })
        container.addView(textCol, android.widget.FrameLayout.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        ))

        val params = android.view.WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") android.view.WindowManager.LayoutParams.TYPE_SYSTEM_OVERLAY
            flags = android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    android.view.WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            width = android.view.WindowManager.LayoutParams.MATCH_PARENT
            height = android.view.WindowManager.LayoutParams.MATCH_PARENT
            format = android.graphics.PixelFormat.TRANSLUCENT
            gravity = android.view.Gravity.CENTER
        }

        try { wm.addView(container, params) } catch (e: Exception) {
            Log.e(TAG, "Countdown overlay addView failed", e)
            onComplete()
            return
        }

        var count = seconds
        val countdownHandler = Handler(Looper.getMainLooper())
        val tick = object : Runnable {
            override fun run() {
                count--
                if (count > 0) {
                    numberView.text = count.toString()
                    // Scale animation for pulse effect
                    numberView.scaleX = 0.5f; numberView.scaleY = 0.5f
                    numberView.animate().scaleX(1f).scaleY(1f).setDuration(300).start()
                    countdownHandler.postDelayed(this, 1000L)
                } else {
                    try { wm.removeView(container) } catch (_: Exception) {}
                    onComplete()
                }
            }
        }

        // Initial scale-in animation for the first number
        numberView.scaleX = 0.5f; numberView.scaleY = 0.5f
        numberView.animate().scaleX(1f).scaleY(1f).setDuration(400).start()
        countdownHandler.postDelayed(tick, 1000L)
    }

    private fun startShakeDetection(sensitivity: Int) {
        val ctx = reactContext ?: return
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
        // Map 10–100 setting → threshold. Higher sensitivity → lower threshold.
        val threshold = (26f - (sensitivity.coerceIn(10, 100) / 100f) * 20f).coerceAtLeast(6f)
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                if (!isRecording || isPaused) return
                val x = event.values[0]; val y = event.values[1]; val z = event.values[2]
                val gForce = Math.sqrt((x*x + y*y + z*z).toDouble()).toFloat()
                val now = System.currentTimeMillis()
                if (gForce > threshold && now - lastShakeMs > 1500L) {
                    lastShakeMs = now
                    Log.i(TAG, "Shake detected (gForce=%.1f, thr=%.1f) → stopping".format(gForce, threshold))
                    stopRecording()
                }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        sm.registerListener(listener, accel, SensorManager.SENSOR_DELAY_GAME)
        sensorManager = sm
        shakeListener = listener
    }

    private fun stopShakeDetection() {
        try { shakeListener?.let { sensorManager?.unregisterListener(it) } } catch (_: Exception) {}
        shakeListener = null
        sensorManager = null
    }

    private fun updateNotificationWithDuration() {
        if (!isRecording) return
        val durationMs = getDurationMs()
        val totalSec = (durationMs / 1000).toInt()
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        val timeStr = String.format("%02d:%02d:%02d", h, m, s)
        val text = if (isPaused) "Duraklatıldı - $timeStr" else "Kayıt yapılıyor - $timeStr"
        updateNotification(text)
    }

    private fun emitStatus() {
        val ctx = reactContext ?: return
        handler.post {
            try {
                val payload = Arguments.createMap().apply {
                    putBoolean("isRecording", isRecording)
                    putBoolean("isPaused", isPaused)
                    putDouble("duration", getDurationMs().toDouble())
                    putString("filePath", outputFilePath ?: "")
                }
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("RecordingStatus", payload)
            } catch (_: Exception) {}
        }
    }

    private fun emitSaved(path: String) {
        val ctx = reactContext ?: return
        handler.post {
            try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("RecordingSaved", path)
            } catch (_: Exception) {}
        }
    }

    private fun emitError(msg: String) {
        val ctx = reactContext ?: return
        handler.post {
            try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("RecordingError", msg)
            } catch (_: Exception) {}
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Ekran Kaydı",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Ekran kaydı sırasında gösterilen bildirim"
            setSound(null, null)
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val stopIntent = Intent(this, ScreenRecordService::class.java).apply { action = ACTION_STOP }
        val stopPending = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val pauseIntent = Intent(this, ScreenRecordService::class.java).apply {
            action = if (isPaused) ACTION_RESUME else ACTION_PAUSE
        }
        val pausePending = PendingIntent.getService(
            this, 1, pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val pauseLabel = if (isPaused) "Devam Et" else "Duraklat"
        val pauseIcon = if (isPaused) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Velaud Recorder")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openPending)
            .addAction(pauseIcon, pauseLabel, pausePending)
            .addAction(android.R.drawable.ic_delete, "Durdur", stopPending)
            .setOngoing(true)
            .setColor(0xFF3B82F6.toInt())
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setUsesChronometer(!isPaused)
            .setWhen(if (!isPaused) System.currentTimeMillis() - getDurationMs() else System.currentTimeMillis())
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }
}
