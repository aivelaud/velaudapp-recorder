package com.recvelaud.android.modules

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

class LiveStreamModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LiveStreamModule"
        private const val REQUEST_MEDIA_PROJECTION = 2001
    }

    override fun getName(): String = "LiveStreamModule"

    private var pendingPromise: Promise? = null
    private var pendingConfig: ReadableMap? = null
    private var mediaProjection: MediaProjection? = null
    private var videoEncoder: MediaCodec? = null
    private var audioEncoder: MediaCodec? = null
    private var virtualDisplay: android.hardware.display.VirtualDisplay? = null
    private val handler = Handler(Looper.getMainLooper())
    private val isStreaming = AtomicBoolean(false)
    private var rtmpClient: RtmpClient? = null

    private var videoWidth = 1280
    private var videoHeight = 720
    private var videoFps = 30
    private var videoBitrate = 2_500_000
    private var audioBitrate = 128_000
    private var audioSampleRate = 44100
    private var audioChannelCount = 2
    private var includeAudio = true
    private var startTimeMs = 0L

    private val activityResultListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode == REQUEST_MEDIA_PROJECTION) {
                val promise = pendingPromise ?: return
                pendingPromise = null
                if (resultCode == Activity.RESULT_OK && data != null) {
                    startStreamingService(resultCode, data, pendingConfig, promise)
                } else {
                    promise.resolve(false)
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityResultListener)
    }

    @ReactMethod
    fun startStream(config: ReadableMap, promise: Promise) {
        try {
            if (isStreaming.get()) {
                promise.resolve(true)
                return
            }
            val activity = currentActivity ?: run {
                promise.reject("NO_ACTIVITY", "Activity not available")
                return
            }
            pendingPromise = promise
            pendingConfig = config

            val projManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE)
                as MediaProjectionManager
            val captureIntent = projManager.createScreenCaptureIntent()
            activity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        } catch (e: Exception) {
            Log.e(TAG, "startStream error", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    private fun startStreamingService(resultCode: Int, resultData: Intent, config: ReadableMap?, promise: Promise) {
        try {
            // Parse config
            val rtmpUrl = config?.getString("rtmpUrl") ?: ""
            val streamKey = config?.getString("streamKey") ?: ""

            if (rtmpUrl.isBlank() || streamKey.isBlank()) {
                promise.reject("INVALID_CONFIG", "rtmpUrl and streamKey required")
                return
            }

            // Parse RTMP URL: rtmp://host:port/app
            val parsed = parseRtmpUrl(rtmpUrl)
            if (parsed == null) {
                promise.reject("INVALID_URL", "Cannot parse RTMP URL")
                return
            }

            videoWidth = if (config?.hasKey("width") == true) config.getInt("width") else 1280
            videoHeight = if (config?.hasKey("height") == true) config.getInt("height") else 720
            videoFps = if (config?.hasKey("fps") == true) config.getInt("fps") else 30
            videoBitrate = if (config?.hasKey("videoBitrate") == true) config.getInt("videoBitrate") else 2_500_000
            audioBitrate = if (config?.hasKey("audioBitrate") == true) config.getInt("audioBitrate") else 128_000
            includeAudio = if (config?.hasKey("includeAudio") == true) config.getBoolean("includeAudio") else true

            // Connect RTMP in background thread
            Thread {
                try {
                    rtmpClient = RtmpClient(parsed.host, parsed.port, parsed.app, streamKey)
                    val ok = rtmpClient?.connect() ?: false
                    if (!ok) {
                        handler.post {
                            promise.resolve(false)
                            emitError("RTMP connection failed")
                        }
                        return@Thread
                    }

                    // Set up MediaProjection
                    val projManager = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE)
                        as MediaProjectionManager
                    mediaProjection = projManager.getMediaProjection(resultCode, resultData)

                    if (mediaProjection == null) {
                        handler.post {
                            promise.resolve(false)
                            emitError("MediaProjection failed")
                        }
                        return@Thread
                    }

                    mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                        override fun onStop() {
                            handler.post { stopStreamInternal() }
                        }
                    }, handler)

                    setupVideoEncoder()
                    if (includeAudio) setupAudioEncoder()
                    setupVirtualDisplay()

                    isStreaming.set(true)
                    startTimeMs = System.currentTimeMillis()
                    startEncoderLoops()

                    handler.post {
                        promise.resolve(true)
                        emitStatus()
                    }
                    Log.i(TAG, "Streaming started → $rtmpUrl")
                } catch (e: Exception) {
                    Log.e(TAG, "startStreamingService error", e)
                    handler.post {
                        promise.resolve(false)
                        emitError(e.message ?: "Stream start failed")
                    }
                }
            }.start()
        } catch (e: Exception) {
            Log.e(TAG, "startStreamingService error", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    private data class RtmpUrl(val host: String, val port: Int, val app: String)

    private fun parseRtmpUrl(url: String): RtmpUrl? {
        // rtmp://host:port/app/streamkey  OR  rtmp://host/app
        try {
            val withoutScheme = url.removePrefix("rtmp://").removePrefix("rtmps://")
            val slashIdx = withoutScheme.indexOf('/')
            val hostPort = if (slashIdx > 0) withoutScheme.substring(0, slashIdx) else withoutScheme
            val appPart = if (slashIdx > 0) withoutScheme.substring(slashIdx + 1) else ""

            val (host, port) = if (hostPort.contains(':')) {
                val parts = hostPort.split(':')
                Pair(parts[0], parts[1].toIntOrNull() ?: 1935)
            } else {
                Pair(hostPort, 1935)
            }

            // App is everything before the stream key (last path segment)
            val appSegments = appPart.split('/').filter { it.isNotEmpty() }
            val app = if (appSegments.size > 1) {
                appSegments.dropLast(1).joinToString("/")
            } else {
                appSegments.firstOrNull() ?: "live"
            }

            return RtmpUrl(host, port, app)
        } catch (e: Exception) {
            Log.e(TAG, "parseRtmpUrl error: ${e.message}")
            return null
        }
    }

    private fun setupVideoEncoder() {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, videoWidth, videoHeight)
        format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        format.setInteger(MediaFormat.KEY_BIT_RATE, videoBitrate)
        format.setInteger(MediaFormat.KEY_FRAME_RATE, videoFps)
        format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)

        videoEncoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        videoEncoder?.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        videoEncoder?.start()
        Log.d(TAG, "Video encoder started: ${videoWidth}x${videoHeight}@${videoFps}fps")
    }

    private fun setupAudioEncoder() {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, audioSampleRate, audioChannelCount)
        format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        format.setInteger(MediaFormat.KEY_BIT_RATE, audioBitrate)
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)

        audioEncoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        audioEncoder?.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        audioEncoder?.start()
        Log.d(TAG, "Audio encoder started: ${audioSampleRate}Hz ${audioChannelCount}ch")
    }

    private fun setupVirtualDisplay() {
        val density = reactContext.resources.displayMetrics.densityDpi
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "VelaudLiveStream",
            videoWidth, videoHeight, density,
            android.hardware.display.DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            videoEncoder?.createInputSurface(),
            null, null
        )
    }

    private fun startEncoderLoops() {
        // Video encoder loop
        Thread {
            val info = MediaCodec.BufferInfo()
            var spsSent = false
            var sps: ByteArray? = null
            var pps: ByteArray? = null

            while (isStreaming.get()) {
                try {
                    val encoder = videoEncoder ?: break
                    val outIndex = encoder.dequeueOutputBuffer(info, 10_000)
                    if (outIndex >= 0) {
                        val buf = encoder.getOutputBuffer(outIndex) ?: continue
                        val data = ByteArray(info.size)
                        buf.position(info.offset)
                        buf.get(data)

                        val isConfig = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                        val isKeyframe = (info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME) != 0

                        if (isConfig) {
                            // Parse SPS and PPS from config data
                            val parsed = parseAvcConfig(data)
                            if (parsed != null) {
                                sps = parsed.first
                                pps = parsed.second
                            }
                        } else {
                            if (!spsSent && sps != null && pps != null) {
                                rtmpClient?.sendVideoSequenceHeader(0, sps, pps)
                                if (includeAudio) {
                                    sendAacConfig()
                                }
                                spsSent = true
                            }
                            val ts = (System.currentTimeMillis() - startTimeMs).toInt()
                            // Convert NALU to FLV format (remove start codes, add length prefix)
                            val flvData = naluToFlv(data)
                            rtmpClient?.sendVideoData(ts, flvData, isKeyframe)
                        }
                        encoder.releaseOutputBuffer(outIndex, false)
                    }
                } catch (e: Exception) {
                    if (isStreaming.get()) Log.e(TAG, "Video encoder loop error: ${e.message}")
                    break
                }
            }
        }.start()

        // Audio encoder loop (only if audio enabled)
        if (includeAudio) {
            Thread {
                val info = MediaCodec.BufferInfo()
                while (isStreaming.get()) {
                    try {
                        val encoder = audioEncoder ?: break
                        val outIndex = encoder.dequeueOutputBuffer(info, 10_000)
                        if (outIndex >= 0) {
                            val buf = encoder.getOutputBuffer(outIndex) ?: continue
                            val data = ByteArray(info.size)
                            buf.position(info.offset)
                            buf.get(data)

                            if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                                val ts = (System.currentTimeMillis() - startTimeMs).toInt()
                                // Strip ADTS header if present (7 bytes)
                                val rawAac = stripAdts(data)
                                rtmpClient?.sendAudioData(ts, rawAac)
                            }
                            encoder.releaseOutputBuffer(outIndex, false)
                        }
                    } catch (e: Exception) {
                        if (isStreaming.get()) Log.e(TAG, "Audio encoder loop error: ${e.message}")
                        break
                    }
                }
            }.start()

            // Audio capture thread — read from AudioRecord and feed encoder
            startAudioCapture()
        }
    }

    private var audioRecord: android.media.AudioRecord? = null

    private fun startAudioCapture() {
        try {
            val minBuf = android.media.AudioRecord.getMinBufferSize(
                audioSampleRate,
                android.media.AudioFormat.CHANNEL_IN_STEREO,
                android.media.AudioFormat.ENCODING_PCM_16BIT
            )
            val bufSize = minBuf.coerceAtLeast(8192)
            audioRecord = android.media.AudioRecord(
                android.media.MediaRecorder.AudioSource.MIC,
                audioSampleRate,
                android.media.AudioFormat.CHANNEL_IN_STEREO,
                android.media.AudioFormat.ENCODING_PCM_16BIT,
                bufSize * 2
            )
            audioRecord?.startRecording()

            Thread {
                val buffer = ByteArray(bufSize)
                while (isStreaming.get()) {
                    try {
                        val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                        if (read > 0) {
                            val encoder = audioEncoder ?: break
                            val inIndex = encoder.dequeueInputBuffer(10_000)
                            if (inIndex >= 0) {
                                val inBuf = encoder.getInputBuffer(inIndex)
                                if (inBuf != null) {
                                    inBuf.clear()
                                    inBuf.put(buffer, 0, read)
                                    encoder.queueInputBuffer(inIndex, 0, read,
                                        (System.currentTimeMillis() - startTimeMs) * 1000, 0)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        if (isStreaming.get()) Log.e(TAG, "Audio capture error: ${e.message}")
                        break
                    }
                }
            }.start()
        } catch (e: Exception) {
            Log.e(TAG, "startAudioCapture error: ${e.message}")
        }
    }

    private fun sendAacConfig() {
        // AAC AudioSpecificConfig for 44.1kHz stereo LC
        // For 44100 Hz: samplingFrequencyIndex = 4 (0x04), channelConfiguration = 2
        // 01010 000 01001 00 0 = 0x12 0x10... let's compute properly
        // Object type = 2 (LC), samplingFreqIndex depends on rate, channelConfig = 2
        val freqIdx = when (audioSampleRate) {
            44100 -> 4
            48000 -> 3
            22050 -> 7
            24000 -> 6
            else -> 4
        }
        val config = ByteArray(2)
        config[0] = ((2 shl 3) or (freqIdx shr 1)).toByte() // AAC-LC (2), freq index
        config[1] = (((freqIdx and 1) shl 7) or (audioChannelCount shl 3)).toByte()
        rtmpClient?.sendAudioSequenceHeader(0, config)
        Log.d(TAG, "AAC config sent")
    }

    private fun parseAvcConfig(data: ByteArray): Pair<ByteArray, ByteArray>? {
        // AVCDecoderConfigurationRecord or raw SPS/PPS NALUs
        try {
            // Check if it's AVCC format (starts with 0x01)
            if (data.size > 10 && data[0].toInt() == 0x01) {
                val numSps = data[5].toInt() and 0x1F
                var offset = 6
                var sps: ByteArray? = null
                for (i in 0 until numSps) {
                    if (offset + 2 > data.size) break
                    val spsLen = ((data[offset].toInt() and 0xFF) shl 8) or (data[offset + 1].toInt() and 0xFF)
                    offset += 2
                    if (offset + spsLen > data.size) break
                    sps = data.sliceArray(offset until offset + spsLen)
                    offset += spsLen
                }
                if (offset >= data.size) return null
                val numPps = data[offset].toInt() and 0x03
                offset++
                var pps: ByteArray? = null
                for (i in 0 until numPps) {
                    if (offset + 2 > data.size) break
                    val ppsLen = ((data[offset].toInt() and 0xFF) shl 8) or (data[offset + 1].toInt() and 0xFF)
                    offset += 2
                    if (offset + ppsLen > data.size) break
                    pps = data.sliceArray(offset until offset + ppsLen)
                    offset += ppsLen
                }
                if (sps != null && pps != null) return Pair(sps, pps)
            }

            // Fallback: parse start-code-delimited NALUs
            val nalus = mutableListOf<ByteArray>()
            var i = 0
            while (i < data.size - 4) {
                if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 &&
                    data[i + 2].toInt() == 0 && data[i + 3].toInt() == 1) {
                    val start = i + 4
                    var end = data.size
                    var j = start
                    while (j < data.size - 3) {
                        if (data[j].toInt() == 0 && data[j + 1].toInt() == 0 &&
                            data[j + 2].toInt() == 0 && data[j + 3].toInt() == 1) {
                            end = j; break
                        }
                        j++
                    }
                    if (end > start) nalus.add(data.sliceArray(start until end))
                    i = end
                } else {
                    i++
                }
            }
            var sps: ByteArray? = null
            var pps: ByteArray? = null
            for (nalu in nalus) {
                val naluType = nalu[0].toInt() and 0x1F
                if (naluType == 7) sps = nalu
                else if (naluType == 8) pps = nalu
            }
            if (sps != null && pps != null) return Pair(sps, pps)
        } catch (e: Exception) {
            Log.e(TAG, "parseAvcConfig error: ${e.message}")
        }
        return null
    }

    private fun naluToFlv(data: ByteArray): ByteArray {
        // Convert start-code delimited NALUs to length-prefix format for FLV
        val nalus = mutableListOf<ByteArray>()
        var i = 0
        while (i < data.size - 4) {
            if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 &&
                data[i + 2].toInt() == 0 && data[i + 3].toInt() == 1) {
                val start = i + 4
                var end = data.size
                var j = start
                while (j < data.size - 3) {
                    if (data[j].toInt() == 0 && data[j + 1].toInt() == 0 &&
                        data[j + 2].toInt() == 0 && data[j + 3].toInt() == 1) {
                        end = j; break
                    }
                    j++
                }
                if (end > start) nalus.add(data.sliceArray(start until end))
                i = end
            } else if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 &&
                data[i + 2].toInt() == 1) {
                // 3-byte start code
                val start = i + 3
                var end = data.size
                var j = start
                while (j < data.size - 2) {
                    if (data[j].toInt() == 0 && data[j + 1].toInt() == 0 &&
                        data[j + 2].toInt() == 1) {
                        end = j; break
                    }
                    j++
                }
                if (end > start) nalus.add(data.sliceArray(start until end))
                i = end
            } else {
                i++
            }
        }
        // If no start codes found, data is already a single NALU
        if (nalus.isEmpty()) {
            return data
        }

        val baos = java.io.ByteArrayOutputStream()
        for (nalu in nalus) {
            baos.write(0)
            baos.write((nalu.size shr 24) and 0xFF)
            baos.write((nalu.size shr 16) and 0xFF)
            baos.write((nalu.size shr 8) and 0xFF)
            baos.write(nalu.size and 0xFF)
            baos.write(nalu)
        }
        return baos.toByteArray()
    }

    private fun stripAdts(data: ByteArray): ByteArray {
        // ADTS header is 7 bytes (or 9 with CRC). Check for sync word 0xFFF
        if (data.size > 2 && (data[0].toInt() and 0xFF) == 0xFF &&
            (data[1].toInt() and 0xF0) == 0xF0) {
            val headerLen = if ((data[1].toInt() and 0x01) == 0) 7 else 9
            return if (data.size > headerLen) data.sliceArray(headerLen until data.size) else data
        }
        return data
    }

    @ReactMethod
    fun stopStream(promise: Promise) {
        stopStreamInternal()
        promise.resolve(null)
    }

    private fun stopStreamInternal() {
        isStreaming.set(false)
        try {
            audioRecord?.stop()
            audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null
        try { videoEncoder?.stop(); videoEncoder?.release() } catch (_: Exception) {}
        try { audioEncoder?.stop(); audioEncoder?.release() } catch (_: Exception) {}
        videoEncoder = null
        audioEncoder = null
        virtualDisplay?.release()
        virtualDisplay = null
        mediaProjection?.stop()
        mediaProjection = null
        rtmpClient?.close()
        rtmpClient = null
        emitStatus()
        Log.i(TAG, "Streaming stopped")
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("isStreaming", isStreaming.get())
            putDouble("duration", if (isStreaming.get())
                (System.currentTimeMillis() - startTimeMs).toDouble() else 0.0)
        })
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun emitStatus() {
        val ctx = reactContext
        handler.post {
            try {
                val payload = Arguments.createMap().apply {
                    putBoolean("isStreaming", isStreaming.get())
                    putDouble("duration", if (isStreaming.get())
                        (System.currentTimeMillis() - startTimeMs).toDouble() else 0.0)
                }
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LiveStreamStatus", payload)
            } catch (_: Exception) {}
        }
    }

    private fun emitError(msg: String) {
        handler.post {
            try {
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LiveStreamError", msg)
            } catch (_: Exception) {}
        }
    }
}
