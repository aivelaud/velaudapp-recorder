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
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
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

    private val activityResultListener = BaseActivityEventListener { requestCode, resultCode, data ->
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            val promise = pendingPromise ?: return@BaseActivityEventListener
            pendingPromise = null
            if (resultCode == Activity.RESULT_OK && data != null) {
                startRecordingService(resultCode, data, pendingConfig, promise)
            } else {
                promise.resolve(false)
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityResultListener)
    }

    @ReactMethod
    fun startRecording(config: ReadableMap, promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "Activity not available")
            return
        }
        pendingPromise = promise
        pendingConfig = config

        val projManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val captureIntent = projManager.createScreenCaptureIntent()
        activity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
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

            val intent = Intent(reactApplicationContext, ScreenRecordService::class.java).apply {
                putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode)
                putExtra(ScreenRecordService.EXTRA_RESULT_DATA, resultData)
                putExtra(ScreenRecordService.EXTRA_WIDTH, width)
                putExtra(ScreenRecordService.EXTRA_HEIGHT, height)
                putExtra(ScreenRecordService.EXTRA_FPS, fps)
                putExtra(ScreenRecordService.EXTRA_INCLUDE_AUDIO, includeAudio)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }

            // Bind to service for pause/resume
            val conn = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                    recordService = (binder as? ScreenRecordService.RecordBinder)?.service
                    promise.resolve(true)
                }
                override fun onServiceDisconnected(name: ComponentName?) {
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
                val intent = Intent(reactApplicationContext, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.ACTION_STOP
                }
                reactApplicationContext.startService(intent)
            }
            serviceConnection?.let { reactApplicationContext.unbindService(it) }
            serviceConnection = null
            recordService = null
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun pauseRecording(promise: Promise) {
        recordService?.pauseRecording()
        promise.resolve(null)
    }

    @ReactMethod
    fun resumeRecording(promise: Promise) {
        recordService?.resumeRecording()
        promise.resolve(null)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("isRecording", false)
            putBoolean("isPaused", false)
            putDouble("duration", 0.0)
            putString("filePath", "")
        })
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
