package com.recvelaud.android.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Intent
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
import android.provider.MediaStore
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.recvelaud.android.MainActivity
import com.recvelaud.android.R
import org.json.JSONObject
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
    private var isRecording = false
    private var isPaused = false
    private var startTimeMs = 0L
    private var pausedDurationMs = 0L
    private var pauseStartMs = 0L
    private var durationTimer: Timer? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
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
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1)
        val resultData: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }
        val width = intent.getIntExtra(EXTRA_WIDTH, 1920)
        val height = intent.getIntExtra(EXTRA_HEIGHT, 1080)
        val fps = intent.getIntExtra(EXTRA_FPS, 30)
        val includeAudio = intent.getBooleanExtra(EXTRA_INCLUDE_AUDIO, true)

        if (resultData == null) {
            Log.e(TAG, "No result data for MediaProjection")
            stopSelf()
            return
        }

        // Start foreground immediately
        startForeground(NOTIF_ID, buildNotification("Kayıt hazırlanıyor…"))

        try {
            val projManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projManager.getMediaProjection(resultCode, resultData)

            // Set up MediaRecorder
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                if (includeAudio) {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                }
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)

                // Output file via MediaStore (scoped storage)
                val fileName = "VelaudRec_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())}.mp4"

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Video.Media.DISPLAY_NAME, fileName)
                        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                        put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/VelaudRecorder")
                        put(MediaStore.Video.Media.IS_PENDING, 1)
                    }
                    val uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                    outputFilePath = uri?.toString() ?: ""
                    if (uri != null) {
                        contentResolver.openFileDescriptor(uri, "w")?.use { pfd ->
                            setOutputFile(pfd.fileDescriptor)
                        }
                    }
                } else {
                    val dir = android.os.Environment.getExternalStoragePublicDirectory(
                        android.os.Environment.DIRECTORY_MOVIES
                    ).resolve("VelaudRecorder").also { it.mkdirs() }
                    val file = dir.resolve(fileName)
                    outputFilePath = file.absolutePath
                    setOutputFile(outputFilePath)
                }

                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                if (includeAudio) {
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioEncodingBitRate(128_000)
                    setAudioSamplingRate(44100)
                }
                setVideoEncodingBitRate(8_000_000)
                setVideoFrameRate(fps)
                setVideoSize(width, height)
                prepare()
            }

            // Create VirtualDisplay
            val screenDensity = resources.displayMetrics.densityDpi
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "VelaudCapture",
                width, height, screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder?.surface, null, null
            )

            mediaRecorder?.start()
            isRecording = true
            isPaused = false
            startTimeMs = System.currentTimeMillis()
            pausedDurationMs = 0L

            updateNotification("⏺ Ekran kaydediliyor…")
            startDurationTimer()
            emitStatus()

            Log.i(TAG, "Recording started → $outputFilePath")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            emitError(e.message ?: "Bilinmeyen hata")
            stopSelf()
        }
    }

    fun stopRecording() {
        if (!isRecording) return
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
            mediaProjection?.stop()
            mediaProjection = null
            isRecording = false
            isPaused = false

            // Mark media as no longer pending (Android Q+)
            val path = outputFilePath
            if (path != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                path.startsWith("content://")
            ) {
                val uri = android.net.Uri.parse(path)
                val values = ContentValues().apply {
                    put(MediaStore.Video.Media.IS_PENDING, 0)
                }
                contentResolver.update(uri, values, null, null)
            }

            emitSaved(outputFilePath ?: "")
            emitStatus()
            Log.i(TAG, "Recording stopped, saved: $outputFilePath")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
            emitError(e.message ?: "Durdurulamadı")
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

    private fun getDurationMs(): Long {
        val elapsed = System.currentTimeMillis() - startTimeMs - pausedDurationMs
        return if (isPaused) (pauseStartMs - startTimeMs - pausedDurationMs) else elapsed
    }

    private fun startDurationTimer() {
        durationTimer = Timer()
        durationTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                if (isRecording) emitStatus()
            }
        }, 1000L, 1000L)
    }

    private fun emitStatus() {
        val ctx = reactContext ?: return
        handler.post {
            try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("RecordingStatus", mapOf(
                        "isRecording" to isRecording,
                        "isPaused" to isPaused,
                        "duration" to getDurationMs(),
                        "filePath" to (outputFilePath ?: "")
                    ))
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
        val stopPending = PendingIntent.getService(this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val openIntent = Intent(this, MainActivity::class.java)
        val openPending = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Velaud Recorder")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_media_pause, "Durdur", stopPending)
            .setOngoing(true)
            .setColor(0xE53935.toInt())
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isRecording) stopRecording()
    }
}
