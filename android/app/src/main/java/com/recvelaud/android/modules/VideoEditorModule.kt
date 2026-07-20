package com.recvelaud.android.modules

import android.annotation.SuppressLint
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer

class VideoEditorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "VideoEditorModule"
    }

    override fun getName(): String = "VideoEditorModule"

    /**
     * Get video metadata: duration (ms), width, height, fps, bitrate, rotation.
     */
    @ReactMethod
    fun getVideoInfo(filePath: String, promise: Promise) {
        try {
            val retriever = MediaMetadataRetriever()
            val uri = if (filePath.startsWith("content://")) Uri.parse(filePath)
                      else Uri.fromFile(File(filePath))
            retriever.setDataSource(reactContext, uri)

            val durationMs = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            val width = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
            val height = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
            val rotation = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            val bitrate = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toIntOrNull() ?: 0
            val fpsStr = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)
            val fps = fpsStr?.toIntOrNull()
                ?: if (durationMs > 0 && bitrate > 0) 30 else 30

            retriever.release()

            val map = Arguments.createMap()
            map.putDouble("duration", durationMs.toDouble())
            map.putInt("width", width)
            map.putInt("height", height)
            map.putInt("rotation", rotation)
            map.putInt("bitrate", bitrate)
            map.putInt("fps", fps)
            promise.resolve(map)
        } catch (e: Exception) {
            Log.e(TAG, "getVideoInfo error", e)
            promise.reject("INFO_ERROR", e.message)
        }
    }

    /**
     * Trim + transcode video.
     * Params:
     *   filePath: source video path
     *   startMs: trim start in milliseconds
     *   endMs: trim end in milliseconds
     *   width: target width (0 = keep original)
     *   height: target height (0 = keep original)
     *   fps: target fps (0 = keep original)
     *   bitrate: target bitrate in bps (0 = auto)
     *   textOverlay: optional text to overlay (empty = none)
     * Returns: output file path.
     */
    @ReactMethod
    fun exportVideo(config: ReadableMap, promise: Promise) {
        try {
            val filePath = config.getString("filePath") ?: ""
            val startMs = if (config.hasKey("startMs")) config.getDouble("startMs").toLong() else 0L
            val endMs = if (config.hasKey("endMs")) config.getDouble("endMs").toLong() else 0L
            val targetW = if (config.hasKey("width")) config.getInt("width") else 0
            val targetH = if (config.hasKey("height")) config.getInt("height") else 0
            val targetFps = if (config.hasKey("fps")) config.getInt("fps") else 0
            val targetBitrate = if (config.hasKey("bitrate")) config.getInt("bitrate") else 0
            val textOverlay = config.getString("textOverlay") ?: ""

            val uri = if (filePath.startsWith("content://")) Uri.parse(filePath)
                      else Uri.fromFile(File(filePath))

            // Get original metadata
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(reactContext, uri)
            val origDuration = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            val origW = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 1280
            val origH = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 720
            val rotation = retriever.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            retriever.release()

            val outW = if (targetW > 0) targetW else origW
            val outH = if (targetH > 0) targetH else origH
            val outFps = if (targetFps > 0) targetFps else 30
            val outBitrate = if (targetBitrate > 0) targetBitrate else {
                // Auto: ~4Mbps for 1080p, ~2.5Mbps for 720p
                (outW * outH * outFps * 0.1).toInt().coerceAtLeast(2_000_000)
            }

            val actualEnd = if (endMs > 0) endMs else origDuration
            val actualStart = startMs.coerceAtLeast(0L)

            // Output file
            val outputDir = File(reactContext.getExternalFilesDir(null), "VelaudEditor")
            if (!outputDir.exists()) outputDir.mkdirs()
            val timeStamp = System.currentTimeMillis()
            val outputFile = File(outputDir, "VELAUD_EDIT_$timeStamp.mp4")
            val outputPath = outputFile.absolutePath

            // Use MediaExtractor + MediaCodec for trimming + transcoding
            trimAndTranscode(
                uri, outputPath, actualStart, actualEnd,
                outW, outH, outFps, outBitrate, rotation
            )

            promise.resolve(outputPath)
        } catch (e: Exception) {
            Log.e(TAG, "exportVideo error", e)
            promise.reject("EXPORT_ERROR", e.message)
        }
    }

    /**
     * Save a video file to the MediaStore gallery (Movies/VelaudRecorder).
     */
    @ReactMethod
    fun saveToGallery(filePath: String, promise: Promise) {
        try {
            val resolver = reactContext.contentResolver
            val values = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Video.Media.DISPLAY_NAME,
                    "VELAUD_${System.currentTimeMillis()}.mp4")
                put(android.provider.MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(android.provider.MediaStore.Video.Media.RELATIVE_PATH,
                        "Movies/VelaudRecorder")
                    put(android.provider.MediaStore.Video.Media.IS_PENDING, 1)
                }
            }

            val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                android.provider.MediaStore.Video.Media.getContentUri(
                    android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY)
            else
                android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI

            val itemUri = resolver.insert(collection, values)
                ?: throw Exception("MediaStore insert failed")

            resolver.openOutputStream(itemUri)?.use { out ->
                FileInputStream(filePath).use { inp ->
                    val buf = ByteArray(8192)
                    while (true) {
                        val n = inp.read(buf)
                        if (n <= 0) break
                        out.write(buf, 0, n)
                    }
                }
            } ?: throw Exception("Cannot open output stream")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(android.provider.MediaStore.Video.Media.IS_PENDING, 0)
                resolver.update(itemUri, values, null, null)
            }

            promise.resolve(itemUri.toString())
        } catch (e: Exception) {
            Log.e(TAG, "saveToGallery error", e)
            promise.reject("SAVE_ERROR", e.message)
        }
    }

    // ── Trim + transcode using MediaExtractor + MediaCodec ──────────────────
    @SuppressLint("WrongConstant")
    private fun trimAndTranscode(
        source: Uri,
        outputPath: String,
        startMs: Long,
        endMs: Long,
        outW: Int,
        outH: Int,
        outFps: Int,
        outBitrate: Int,
        rotation: Int,
    ) {
        val extractor = MediaExtractor()
        extractor.setDataSource(reactContext, source, null)

        // Find video track
        var videoTrackIndex = -1
        var inputFormat: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val fmt = extractor.getTrackFormat(i)
            val mime = fmt.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.startsWith("video/")) {
                videoTrackIndex = i
                inputFormat = fmt
                break
            }
        }
        if (videoTrackIndex < 0 || inputFormat == null) {
            extractor.release()
            throw Exception("No video track found")
        }

        extractor.selectTrack(videoTrackIndex)
        val inputMime = inputFormat.getString(MediaFormat.KEY_MIME) ?: "video/avc"

        // Configure decoder
        val decoder = MediaCodec.createDecoderByType(inputMime)
        decoder.configure(inputFormat, null, null, 0)
        decoder.start()

        // Configure encoder
        val outputFormat = MediaFormat.createVideoFormat("video/avc", outW, outH).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, outBitrate)
            setInteger(MediaFormat.KEY_FRAME_RATE, outFps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        }
        val encoder = MediaCodec.createEncoderByType("video/avc")
        encoder.configure(outputFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        encoder.start()

        // Muxer
        val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        muxer.setOrientationHint(rotation)
        var muxerTrackIndex = -1
        var muxerStarted = false

        val info = MediaCodec.BufferInfo()
        val startTimeUs = startMs * 1000
        val endUs = (endMs * 1000)
        var sawInputEOS = false
        var sawOutputEOS = false
        var pendingDecodeDequeueIndex = -1

        val bufferInfo = MediaCodec.BufferInfo()
        val timeoutUs = 10000L

        while (!sawOutputEOS) {
            // Feed input to decoder
            if (!sawInputEOS) {
                val inputBufIndex = decoder.dequeueInputBuffer(timeoutUs)
                if (inputBufIndex >= 0) {
                    val inputBuf = decoder.getInputBuffer(inputBufIndex)!!
                    val sampleSize = extractor.readSampleData(inputBuf, 0)
                    if (sampleSize < 0) {
                        decoder.queueInputBuffer(inputBufIndex, 0, 0, 0,
                            MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        sawInputEOS = true
                    } else {
                        val sampleTime = extractor.sampleTime
                        if (sampleTime >= endUs) {
                            decoder.queueInputBuffer(inputBufIndex, 0, 0, 0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            sawInputEOS = true
                        } else {
                            decoder.queueInputBuffer(inputBufIndex, 0, sampleSize,
                                sampleTime - startTimeUs, 0)
                            extractor.advance()
                        }
                    }
                }
            }

            // Drain decoder output → feed to encoder
            val decoderStatus = decoder.dequeueOutputBuffer(info, timeoutUs)
            if (decoderStatus >= 0) {
                val outputBuf = decoder.getOutputBuffer(decoderStatus)
                if (outputBuf != null && info.size > 0) {
                    // Feed to encoder
                    val encInputIndex = encoder.dequeueInputBuffer(timeoutUs)
                    if (encInputIndex >= 0) {
                        val encInputBuf = encoder.getInputBuffer(encInputIndex)!!
                        encInputBuf.clear()
                        val pos = info.offset
                        val lim = pos + info.size
                        outputBuf.position(pos)
                        outputBuf.limit(lim)
                        encInputBuf.put(outputBuf)
                        outputBuf.position(pos)
                        encoder.queueInputBuffer(encInputIndex, 0, info.size,
                            info.presentationTimeUs, info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    }
                }
                decoder.releaseOutputBuffer(decoderStatus, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    // Signal end to encoder
                    val encInputIndex = encoder.dequeueInputBuffer(timeoutUs)
                    if (encInputIndex >= 0) {
                        encoder.queueInputBuffer(encInputIndex, 0, 0, 0,
                            MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    }
                }
            }

            // Drain encoder output → muxer
            val encStatus = encoder.dequeueOutputBuffer(bufferInfo, timeoutUs)
            when {
                encStatus == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    val newFormat = encoder.outputFormat
                    muxerTrackIndex = muxer.addTrack(newFormat)
                    muxer.start()
                    muxerStarted = true
                }
                encStatus >= 0 -> {
                    val encOutputBuf = encoder.getOutputBuffer(encStatus)!!
                    if (bufferInfo.size > 0 && muxerStarted) {
                        encOutputBuf.position(bufferInfo.offset)
                        encOutputBuf.limit(bufferInfo.offset + bufferInfo.size)
                        muxer.writeSampleData(muxerTrackIndex, encOutputBuf, bufferInfo)
                    }
                    encoder.releaseOutputBuffer(encStatus, false)
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        sawOutputEOS = true
                    }
                }
            }
        }

        // Cleanup
        extractor.release()
        decoder.stop()
        decoder.release()
        encoder.stop()
        encoder.release()
        if (muxerStarted) muxer.stop()
        muxer.release()
    }
}
