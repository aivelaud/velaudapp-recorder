package com.recvelaud.android.modules

import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.net.Socket
import java.security.MessageDigest
import java.util.Random

/**
 * Minimal RTMP client for live screen streaming.
 * Implements: handshake (C0/C1/C2, S0/S1/S2), connect command, releaseStream,
 * createStream, publish command, and FLV tag sending (video/audio data).
 *
 * Supports both plain RTMP (rtmp://) — TLS is not implemented.
 */
class RtmpClient(
    private val host: String,
    private val port: Int,
    private val app: String,
    private val streamKey: String,
) {
    companion object {
        private const val TAG = "RtmpClient"
        private const val CHUNK_SIZE = 4096
        private const val CHUNK_STREAM_PROTOCOL = 2
        private const val CHUNK_STREAM_AUDIO = 4
        private const val CHUNK_STREAM_VIDEO = 6
        private const val RTMP_DEFAULT_CHUNK_SIZE = 128
    }

    private var socket: Socket? = null
    private var out: DataOutputStream? = null
    private var inp: DataInputStream? = null
    @Volatile private var connected = false
    private var transactionId = 1
    private var chunkSize = RTMP_DEFAULT_CHUNK_SIZE

    // Message stream id for the publish stream
    private var streamId = 0

    fun connect(): Boolean {
        return try {
            Log.i(TAG, "Connecting to $host:$port app=$app")
            socket = Socket(host, port)
            socket?.tcpNoDelay = true
            socket?.soTimeout = 10000
            out = DataOutputStream(socket?.getOutputStream())
            inp = DataInputStream(socket?.getInputStream())

            handshake()
            sendChunkSize(CHUNK_SIZE)
            connectApp()
            releaseStream()
            createStream()
            publish()

            connected = true
            Log.i(TAG, "RTMP connected and publishing")
            true
        } catch (e: Exception) {
            Log.e(TAG, "RTMP connect failed: ${e.message}", e)
            connected = false
            false
        }
    }

    // ── Handshake ─────────────────────────────────────────────────────────────
    private fun handshake() {
        val o = out ?: throw IOException("no output stream")
        val i = inp ?: throw IOException("no input stream")

        // C0: version (1 byte = 0x03)
        o.writeByte(0x03)

        // C1: time (4) + zero (4) + random (1528) = 1536 bytes
        val c1 = ByteArray(1536)
        val rand = Random()
        // time
        c1[0] = 0; c1[1] = 0; c1[2] = 0; c1[3] = 0
        // zero
        c1[4] = 0; c1[5] = 0; c1[6] = 0; c1[7] = 0
        rand.nextBytes(c1.sliceArray(8 until 1536))
        o.write(c1)
        o.flush()

        // S0
        val s0 = i.readUnsignedByte()
        if (s0 != 0x03) throw IOException("RTMP version mismatch: $s0")

        // S1 (1536)
        val s1 = ByteArray(1536)
        i.readFully(s1)

        // S2 (1536) — echo of C1
        val s2 = ByteArray(1536)
        i.readFully(s2)

        // C2 — echo of S1
        o.write(s1)
        o.flush()
        Log.d(TAG, "Handshake complete")
    }

    // ── Chunk encoding ────────────────────────────────────────────────────────

    /**
     * Write a single RTMP message as one or more chunks.
     * Basic header: fmt (2 bits) + cs id (6 bits)
     * Message header depends on fmt:
     *   0 = timestamp(3) + msg length(3) + msg type id(1) + msg stream id(4 LE) = 11 bytes
     *   1 = timestamp delta(3) = 3 bytes (same type/length/stream as previous)
     *   2 = timestamp delta(3) = 3 bytes (same type/length/stream)
     *   3 = no header (continuation)
     */
    private fun writeMessage(
        csId: Int,
        msgType: Int,
        streamId: Int,
        timestamp: Int,
        payload: ByteArray,
    ) {
        val o = out ?: throw IOException("no output")
        val totalLen = payload.size
        var offset = 0

        // First chunk: fmt=0 (full header)
        o.writeByte(csId and 0x3F) // fmt=0 in high 2 bits, csId in low 6 bits
        write24BE(o, timestamp)
        write24BE(o, totalLen)
        o.writeByte(msgType)
        write32LE(o, streamId)

        val firstChunkLen = minOf(chunkSize, totalLen)
        o.write(payload, 0, firstChunkLen)
        offset = firstChunkLen

        // Subsequent chunks: fmt=3 (continuation)
        while (offset < totalLen) {
            o.writeByte(0xC0 or (csId and 0x3F)) // fmt=3
            val len = minOf(chunkSize, totalLen - offset)
            o.write(payload, offset, len)
            offset += len
        }
        o.flush()
    }

    private fun write24BE(o: DataOutputStream, value: Int) {
        o.writeByte((value shr 16) and 0xFF)
        o.writeByte((value shr 8) and 0xFF)
        o.writeByte(value and 0xFF)
    }

    private fun write32LE(o: DataOutputStream, value: Int) {
        o.writeByte(value and 0xFF)
        o.writeByte((value shr 8) and 0xFF)
        o.writeByte((value shr 16) and 0xFF)
        o.writeByte((value shr 24) and 0xFF)
    }

    private fun write32BE(o: DataOutputStream, value: Int) {
        o.writeByte((value shr 24) and 0xFF)
        o.writeByte((value shr 16) and 0xFF)
        o.writeByte((value shr 8) and 0xFF)
        o.writeByte(value and 0xFF)
    }

    // ── AMF0 encoding ─────────────────────────────────────────────────────────

    private fun amfString(s: String): ByteArray {
        val baos = ByteArrayOutputStream()
        baos.write(0x02) // AMF0 string type
        val bytes = s.toByteArray(Charsets.UTF_8)
        baos.write((bytes.size shr 8) and 0xFF)
        baos.write(bytes.size and 0xFF)
        baos.write(bytes)
        return baos.toByteArray()
    }

    private fun amfNumber(n: Double): ByteArray {
        val baos = ByteArrayOutputStream()
        baos.write(0x00) // AMF0 number type
        val bits = java.lang.Double.doubleToLongBits(n)
        for (i in 7 downTo 0) {
            baos.write(((bits shr (i * 8)) and 0xFF).toInt())
        }
        return baos.toByteArray()
    }

    private fun amfBoolean(b: Boolean): ByteArray {
        val baos = ByteArrayOutputStream()
        baos.write(0x01) // AMF0 boolean
        baos.write(if (b) 0x01 else 0x00)
        return baos.toByteArray()
    }

    private fun amfNull(): ByteArray = byteArrayOf(0x05)

    private fun amfObject(pairs: List<Pair<String, ByteArray>>): ByteArray {
        val baos = ByteArrayOutputStream()
        baos.write(0x03) // AMF0 object
        for ((key, value) in pairs) {
            val keyBytes = key.toByteArray(Charsets.UTF_8)
            baos.write((keyBytes.size shr 8) and 0xFF)
            baos.write(keyBytes.size and 0xFF)
            baos.write(keyBytes)
            baos.write(value)
        }
        // End marker
        baos.write(0x00)
        baos.write(0x00)
        baos.write(0x09) // object end marker
        return baos.toByteArray()
    }

    // ── Protocol control messages ─────────────────────────────────────────────

    /** Set Chunk Size (type 1) */
    private fun sendChunkSize(size: Int) {
        val payload = ByteArray(4)
        payload[0] = ((size shr 24) and 0xFF).toByte()
        payload[1] = ((size shr 16) and 0xFF).toByte()
        payload[2] = ((size shr 8) and 0xFF).toByte()
        payload[3] = (size and 0xFF).toByte()
        writeMessage(2, 1, 0, 0, payload)
        chunkSize = size
        Log.d(TAG, "Chunk size set to $size")
    }

    // ── Command messages ──────────────────────────────────────────────────────

    /** "connect" command — negotiate app connection */
    private fun connectApp() {
        val baos = ByteArrayOutputStream()
        baos.write(amfString("connect"))
        baos.write(amfNumber(transactionId++.toDouble()))
        val appObj = amfObject(listOf(
            "app" to amfString(app),
            "flashVer" to amfString("FMLE/3.0 (compatible; Velaud)"),
            "tcUrl" to amfString("rtmp://$host:$port/$app"),
            "fpad" to amfBoolean(false),
            "capabilities" to amfNumber(15.0),
            "audioCodecs" to amfNumber(4071.0),
            "videoCodecs" to amfNumber(252.0),
            "videoFunction" to amfNumber(1.0),
        ))
        baos.write(appObj)
        writeMessage(3, 20, 0, 0, baos.toByteArray())
        Log.d(TAG, "connect sent")

        // Read response — wait for _result
        readUntilResult()
    }

    /** "releaseStream" command */
    private fun releaseStream() {
        val baos = ByteArrayOutputStream()
        baos.write(amfString("releaseStream"))
        baos.write(amfNumber(transactionId++.toDouble()))
        baos.write(amfNull())
        baos.write(amfString(streamKey))
        writeMessage(3, 20, 0, 0, baos.toByteArray())
        Log.d(TAG, "releaseStream sent")
        readUntilResult()
    }

    /** "createStream" command */
    private fun createStream() {
        val baos = ByteArrayOutputStream()
        baos.write(amfString("createStream"))
        baos.write(amfNumber(transactionId++.toDouble()))
        baos.write(amfNull())
        writeMessage(3, 20, 0, 0, baos.toByteArray())
        Log.d(TAG, "createStream sent")
        streamId = readCreateStreamResult()
    }

    /** "publish" command */
    private fun publish() {
        val baos = ByteArrayOutputStream()
        baos.write(amfString("publish"))
        baos.write(amfNumber(0.0)) // transaction id 0
        baos.write(amfNull())
        baos.write(amfString(streamKey))
        baos.write(amfString("live"))
        writeMessage(3, 20, streamId, 0, baos.toByteArray())
        Log.d(TAG, "publish sent (live)")
    }

    // ── Read responses ────────────────────────────────────────────────────────

    private fun readUntilResult() {
        val i = inp ?: return
        try {
            // Read chunk header
            val firstByte = i.readUnsignedByte()
            val fmt = (firstByte shr 6) and 0x03
            val csId = firstByte and 0x3F

            // Read message header based on fmt
            var timestamp = 0
            var msgLen = 0
            var msgType = 0
            var msgStreamId = 0

            when (fmt) {
                0 -> {
                    timestamp = (i.readUnsignedByte() shl 16) or (i.readUnsignedByte() shl 8) or i.readUnsignedByte()
                    msgLen = (i.readUnsignedByte() shl 16) or (i.readUnsignedByte() shl 8) or i.readUnsignedByte()
                    msgType = i.readUnsignedByte()
                    msgStreamId = i.readInt() // 32-bit LE
                }
                1 -> {
                    i.readUnsignedByte(); i.readUnsignedByte(); i.readUnsignedByte() // delta
                    msgLen = (i.readUnsignedByte() shl 16) or (i.readUnsignedByte() shl 8) or i.readUnsignedByte()
                    msgType = i.readUnsignedByte()
                }
                2 -> {
                    i.readUnsignedByte(); i.readUnsignedByte(); i.readUnsignedByte()
                }
                3 -> { /* continuation, no header */ }
            }

            // Read payload
            val payload = ByteArray(msgLen)
            var read = 0
            while (read < msgLen) {
                val toRead = minOf(chunkSize, msgLen - read)
                i.readFully(payload, read, toRead)
                read += toRead
                if (read < msgLen) {
                    // Read next chunk header (fmt=3)
                    i.readUnsignedByte()
                }
            }
            Log.d(TAG, "Response: type=$msgType len=$msgLen")
        } catch (e: Exception) {
            Log.w(TAG, "readUntilResult error: ${e.message}")
        }
    }

    private fun readCreateStreamResult(): Int {
        val i = inp ?: return 1
        try {
            val firstByte = i.readUnsignedByte()
            val fmt = (firstByte shr 6) and 0x03
            val csId = firstByte and 0x3F
            var msgLen = 0
            var msgType = 0
            when (fmt) {
                0 -> {
                    i.readUnsignedByte(); i.readUnsignedByte(); i.readUnsignedByte()
                    msgLen = (i.readUnsignedByte() shl 16) or (i.readUnsignedByte() shl 8) or i.readUnsignedByte()
                    msgType = i.readUnsignedByte()
                    i.readInt()
                }
                1 -> {
                    i.readUnsignedByte(); i.readUnsignedByte(); i.readUnsignedByte()
                    msgLen = (i.readUnsignedByte() shl 16) or (i.readUnsignedByte() shl 8) or i.readUnsignedByte()
                    msgType = i.readUnsignedByte()
                }
                else -> {
                    i.readUnsignedByte(); i.readUnsignedByte(); i.readUnsignedByte()
                    msgLen = (i.readUnsignedByte() shl 16) or (i.readUnsignedByte() shl 8) or i.readUnsignedByte()
                    msgType = i.readUnsignedByte()
                }
            }
            val payload = ByteArray(msgLen)
            var read = 0
            while (read < msgLen) {
                val toRead = minOf(chunkSize, msgLen - read)
                i.readFully(payload, read, toRead)
                read += toRead
                if (read < msgLen) i.readUnsignedByte()
            }
            // Parse AMF0 to find the stream id number (3rd element: _result, txnId, null, streamId)
            // Simple search: skip strings, find number
            var idx = 0
            // Skip command name (string)
            if (payload.size > 1 && payload[0].toInt() == 0x02) {
                val strLen = ((payload[1].toInt() and 0xFF) shl 8) or (payload[2].toInt() and 0xFF)
                idx = 3 + strLen
            }
            // Skip transaction id (number = 8 bytes + 1 type byte)
            if (idx < payload.size && payload[idx].toInt() == 0x00) idx += 9
            // Skip null
            if (idx < payload.size && payload[idx].toInt() == 0x05) idx += 1
            // Read stream id (number)
            if (idx < payload.size && payload[idx].toInt() == 0x00) {
                idx++
                var bits = 0L
                for (j in 0 until 8) {
                    bits = (bits shl 8) or (payload[idx + j].toLong() and 0xFF)
                }
                return java.lang.Double.longBitsToDouble(bits).toInt()
            }
        } catch (e: Exception) {
            Log.w(TAG, "readCreateStreamResult error: ${e.message}")
        }
        return 1
    }

    // ── Send media data ───────────────────────────────────────────────────────

    /**
     * Send video data as an RTMP video message (type 9).
     * @param timestamp in milliseconds
     * @param payload FLV video tag payload (first byte: frame type + codec, then H264 data)
     * @param isKeyframe true if this is a keyframe
     */
    fun sendVideoData(timestamp: Int, payload: ByteArray, isKeyframe: Boolean) {
        if (!connected) return
        try {
            val firstByte = (if (isKeyframe) 0x17 else 0x27) // keyframe=0x10, inter=0x20; AVC=0x07
            val flvPayload = ByteArray(1 + payload.size)
            flvPayload[0] = firstByte.toByte()
            System.arraycopy(payload, 0, flvPayload, 1, payload.size)
            writeMessage(CHUNK_STREAM_VIDEO, 9, streamId, timestamp, flvPayload)
        } catch (e: Exception) {
            Log.e(TAG, "sendVideoData error: ${e.message}")
            connected = false
        }
    }

    /**
     * Send audio data as an RTMP audio message (type 8).
     * @param timestamp in milliseconds
     * @param payload AAC raw frame data
     */
    fun sendAudioData(timestamp: Int, payload: ByteArray) {
        if (!connected) return
        try {
            val firstByte = 0xAF // AAC (0x0A) + 44.1kHz (0x03<<2) + 16-bit (0x01<<1) + stereo (0x01)
            val flvPayload = ByteArray(1 + payload.size)
            flvPayload[0] = firstByte.toByte()
            System.arraycopy(payload, 0, flvPayload, 1, payload.size)
            writeMessage(CHUNK_STREAM_AUDIO, 8, streamId, timestamp, flvPayload)
        } catch (e: Exception) {
            Log.e(TAG, "sendAudioData error: ${e.message}")
            connected = false
        }
    }

    /**
     * Send AAC sequence header (AudioSpecificConfig).
     */
    fun sendAudioSequenceHeader(timestamp: Int, config: ByteArray) {
        if (!connected) return
        try {
            val firstByte = 0xAF
            val flvPayload = ByteArray(2 + config.size)
            flvPayload[0] = firstByte.toByte()
            flvPayload[1] = 0x00 // AAC sequence header
            System.arraycopy(config, 0, flvPayload, 2, config.size)
            writeMessage(CHUNK_STREAM_AUDIO, 8, streamId, timestamp, flvPayload)
        } catch (e: Exception) {
            Log.e(TAG, "sendAudioSeqHeader error: ${e.message}")
        }
    }

    /**
     * Send AVC sequence header (SPS+PPS in AVCC format).
     */
    fun sendVideoSequenceHeader(timestamp: Int, sps: ByteArray, pps: ByteArray) {
        if (!connected) return
        try {
            // FLV video tag: frame type+codec (1) + AVCPacketType (1) + CompositionTime (3) + AVCC data
            // AVCC: configVersion(1) + profile(1) + compat(1) + level(1) + lengthSizeMinusOne(1) +
            //       numOfSPS(1) + spsLen(2) + sps + numOfPPS(1) + ppsLen(2) + pps
            val avcc = ByteArrayOutputStream()
            avcc.write(0x01) // configurationVersion
            avcc.write(sps[1].toInt()) // AVCProfileIndicate
            avcc.write(sps[2].toInt()) // profile_compatibility
            avcc.write(sps[3].toInt()) // AVCLevelIndication
            avcc.write(0xFF) // 6 bits reserved + lengthSizeMinusOne = 4-1=3 → 0xFF
            avcc.write(0xE1) // 3 bits reserved + numOfSPS = 1
            avcc.write((sps.size shr 8) and 0xFF)
            avcc.write(sps.size and 0xFF)
            avcc.write(sps)
            avcc.write(0x01) // numOfPPS = 1
            avcc.write((pps.size shr 8) and 0xFF)
            avcc.write(pps.size and 0xFF)
            avcc.write(pps)

            val avccBytes = avcc.toByteArray()
            val flvPayload = ByteArray(5 + avccBytes.size)
            flvPayload[0] = 0x17.toByte() // keyframe + AVC
            flvPayload[1] = 0x00.toByte() // AVC sequence header
            flvPayload[2] = 0x00; flvPayload[3] = 0x00; flvPayload[4] = 0x00 // composition time
            System.arraycopy(avccBytes, 0, flvPayload, 5, avccBytes.size)
            writeMessage(CHUNK_STREAM_VIDEO, 9, streamId, timestamp, flvPayload)
            Log.d(TAG, "Video sequence header sent (SPS=${sps.size} PPS=${pps.size})")
        } catch (e: Exception) {
            Log.e(TAG, "sendVideoSeqHeader error: ${e.message}")
        }
    }

    fun isConnected(): Boolean = connected

    fun close() {
        connected = false
        try { out?.close() } catch (_: Exception) {}
        try { inp?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        socket = null; out = null; inp = null
        Log.i(TAG, "RTMP closed")
    }
}
