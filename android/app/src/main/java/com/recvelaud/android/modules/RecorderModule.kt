package com.recvelaud.android.modules

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.recvelaud.android.services.ScreenRecordService

class RecorderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "RecorderModule"
        private const val REQUEST_MEDIA_PROJECTION = 1001
    }

    override fun getName(): String = "ScreenRecorderModule"

    private var pendingPromise: Promise? = null
    private var pendingConfig: ReadableMap? = null
    private var serviceConnection: ServiceConnection? = null
    private var recordService: ScreenRecordService? = null

    init {
        ScreenRecordService.reactContext = reactContext
    }

    private val activityResultListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode == REQUEST_MEDIA_PROJECTION) {
                val promise = pendingPromise ?: return
                pendingPromise = null
                if (resultCode == Activity.RESULT_OK && data != null) {
                    startRecordingService(resultCode, data, pendingConfig, promise)
                } else {
                    Log.w(TAG, "MediaProjection permission denied by user")
                    promise.resolve(false)
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityResultListener)
    }

    @ReactMethod
    fun startRecording(config: ReadableMap, promise: Promise) {
        try {
            if (recordService?.isRecordingActive() == true) {
                Log.w(TAG, "startRecording called while already active — ignoring")
                promise.resolve(true)
                return
            }
            val activity = currentActivity ?: run {
                promise.reject("NO_ACTIVITY", "Activity not available")
                return
            }
            pendingPromise = promise
            pendingConfig = config

            val projManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val captureIntent = projManager.createScreenCaptureIntent()
            activity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        } catch (e: Exception) {
            Log.e(TAG, "startRecording error", e)
            pendingPromise = null
            promise.reject("START_ERROR", e.message)
        }
    }

    private fun startRecordingService(resultCode: Int, resultData: Intent, config: ReadableMap?, promise: Promise) {
        try {
            val activity = currentActivity ?: run {
                promise.reject("NO_ACTIVITY", "Activity gone")
                return
            }
            val metrics = activity.resources.displayMetrics
            val width = if (config?.hasKey("width") == true && config.getInt("width") > 0)
                config.getInt("width") else metrics.widthPixels
            val height = if (config?.hasKey("height") == true && config.getInt("height") > 0)
                config.getInt("height") else metrics.heightPixels
            val fps = if (config?.hasKey("fps") == true) config.getInt("fps") else 30
            val includeAudio = config?.getBoolean("includeAudio") ?: true
            val audioSource = config?.getString("audioSource") ?: "microphone"
            val volume = if (config?.hasKey("volume") == true) config.getInt("volume") else 100
            val noiseReduction = config?.getBoolean("noiseReduction") ?: false

            val intent = Intent(reactApplicationContext, ScreenRecordService::class.java).apply {
                putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode)
                putExtra(ScreenRecordService.EXTRA_RESULT_DATA, resultData)
                putExtra(ScreenRecordService.EXTRA_WIDTH, width)
                putExtra(ScreenRecordService.EXTRA_HEIGHT, height)
                putExtra(ScreenRecordService.EXTRA_FPS, fps)
                putExtra(ScreenRecordService.EXTRA_INCLUDE_AUDIO, includeAudio)
                putExtra(ScreenRecordService.EXTRA_AUDIO_SOURCE, audioSource)
                putExtra(ScreenRecordService.EXTRA_VOLUME, volume)
                putExtra(ScreenRecordService.EXTRA_NOISE_REDUCTION, noiseReduction)
            }

            // CRITICAL: Use startForegroundService on Android O+ to ensure the
            // service can call startForeground() within the time limit
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }

            // Bind to service for pause/resume control
            val conn = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                    recordService = (binder as? ScreenRecordService.RecordBinder)?.service
                    Log.i(TAG, "Service connected, recording active: ${recordService?.isRecordingActive()}")
                    promise.resolve(true)
                }
                override fun onServiceDisconnected(name: ComponentName?) {
                    Log.w(TAG, "Service disconnected unexpectedly")
                    recordService = null
                }
            }
            serviceConnection = conn
            reactApplicationContext.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        } catch (e: Exception) {
            Log.e(TAG, "startRecordingService error", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            val svc = recordService
            if (svc != null) {
                svc.stopRecording()
            } else {
                // Fallback: send stop action to service directly
                val intent = Intent(reactApplicationContext, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.ACTION_STOP
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        reactApplicationContext.startForegroundService(intent)
                    } catch (_: Exception) {
                        reactApplicationContext.startService(intent)
                    }
                } else {
                    reactApplicationContext.startService(intent)
                }
            }
            // Unbind service
            try {
                serviceConnection?.let { reactApplicationContext.unbindService(it) }
            } catch (_: Exception) {}
            serviceConnection = null
            recordService = null
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "stopRecording error", e)
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun pauseRecording(promise: Promise) {
        try {
            recordService?.pauseRecording()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun resumeRecording(promise: Promise) {
        try {
            recordService?.resumeRecording()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val svc = recordService
            if (svc != null) {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("isRecording", svc.isRecordingActive())
                    putBoolean("isPaused", svc.isPausedState())
                    putDouble("duration", svc.getCurrentDuration())
                    putString("filePath", svc.getOutputPath() ?: "")
                })
            } else {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("isRecording", false)
                    putBoolean("isPaused", false)
                    putDouble("duration", 0.0)
                    putString("filePath", "")
                })
            }
        } catch (e: Exception) {
            Log.e(TAG, "getStatus error", e)
            promise.reject("STATUS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val overlayGranted = android.provider.Settings.canDrawOverlays(reactApplicationContext)
            promise.resolve(overlayGranted)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        try {
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${reactApplicationContext.packageName}")
            ).apply { addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK) }
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun getDeviceCapabilities(promise: Promise) {
        try {
            val metrics = reactContext.resources.displayMetrics
            val w = metrics.widthPixels
            val h = metrics.heightPixels
            val maxDim = maxOf(w, h)

            // Cap resolution by physical screen height
            val maxRes: String = when {
                maxDim >= 1920 -> "1080p"
                maxDim >= 1280 -> "720p"
                maxDim >= 854 -> "480p"
                maxDim >= 640 -> "360p"
                maxDim >= 426 -> "240p"
                else -> "144p"
            }

            // Refresh rate → max FPS cap
            val display = (reactContext.currentActivity?.getSystemService(android.content.Context.WINDOW_SERVICE)
                as? android.view.WindowManager)?.defaultDisplay
            val refreshRate = display?.refreshRate ?: 60f
            val maxFps: Int = when {
                refreshRate >= 115f -> 120
                refreshRate >= 85f -> 90
                refreshRate >= 55f -> 60
                else -> 30
            }

            val map = Arguments.createMap().apply {
                putString("maxResolution", maxRes)
                putInt("maxFps", maxFps)
                putDouble("refreshRate", refreshRate.toDouble())
            }
            promise.resolve(map)
        } catch (e: Exception) {
            // Safe fallback
            val map = Arguments.createMap().apply {
                putString("maxResolution", "1080p")
                putInt("maxFps", 60)
                putDouble("refreshRate", 60.0)
            }
            promise.resolve(map)
        }
    }
}