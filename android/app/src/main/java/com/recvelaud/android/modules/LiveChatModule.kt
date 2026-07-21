package com.recvelaud.android.modules

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.Socket
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import java.util.Timer
import java.util.TimerTask

class LiveChatModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LiveChatModule"
        private const val TWITCH_IRC_HOST = "irc.chat.twitch.tv"
        private const val TWITCH_IRC_PORT = 6667
        private const val KICK_CHAT_WS = "wss://chat.kick.com/ws"
    }

    override fun getName(): String = "LiveChatModule"

    private val handler = Handler(Looper.getMainLooper())
    private var chatThread: Thread? = null
    private var isActive = AtomicBoolean(false)
    private var viewerTimer: Timer? = null
    private var currentPlatform: String = ""
    private var currentChannel: String = ""

    @ReactMethod
    fun startChat(config: ReadableMap, promise: Promise) {
        try {
            val platform = config.getString("platform") ?: ""
            val channel = config.getString("channel") ?: ""
            val token = if (config.hasKey("token")) config.getString("token") else null

            if (platform.isBlank() || channel.isBlank()) {
                promise.reject("INVALID_CONFIG", "platform and channel required")
                return
            }

            stopChatInternal()
            currentPlatform = platform
            currentChannel = channel
            isActive.set(true)

            when (platform) {
                "twitch" -> startTwitchChat(channel, token)
                "kick" -> startKickChat(channel)
                "youtube" -> startYouTubeChat(channel, token)
                else -> {
                    promise.reject("UNKNOWN_PLATFORM", "Unknown platform: $platform")
                    return
                }
            }

            startViewerPolling(platform, channel, token)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "startChat error", e)
            promise.reject("CHAT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopChat(promise: Promise) {
        stopChatInternal()
        promise.resolve(null)
    }

    @ReactMethod
    fun sendMessage(config: ReadableMap, message: String, promise: Promise) {
        try {
            val platform = config.getString("platform") ?: ""
            val channel = config.getString("channel") ?: ""
            val token = if (config.hasKey("token")) config.getString("token") else null
            val username = if (config.hasKey("username")) config.getString("username") else channel

            when (platform) {
                "twitch" -> sendTwitchMessage(channel, token, username, message)
                "kick" -> sendKickMessage(channel, token, message)
                "youtube" -> sendYouTubeMessage(channel, token, message)
                else -> promise.reject("UNKNOWN_PLATFORM", "Unknown platform")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "sendMessage error", e)
            promise.reject("SEND_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun stopChatInternal() {
        isActive.set(false)
        try { chatThread?.interrupt() } catch (_: Exception) {}
        chatThread = null
        viewerTimer?.cancel()
        viewerTimer = null
    }

    // ── Twitch IRC ────────────────────────────────────────────────────────────
    private fun startTwitchChat(channel: String, token: String?) {
        chatThread = Thread {
            var socket: Socket? = null
            var reader: BufferedReader? = null
            var writer: OutputStreamWriter? = null
            try {
                socket = Socket(TWITCH_IRC_HOST, TWITCH_IRC_PORT)
                reader = BufferedReader(InputStreamReader(socket.getInputStream()))
                writer = OutputStreamWriter(socket.getOutputStream())

                val nickname = if (token != null) "justinfan${(10000..99999).random()}" else "justinfan${(10000..99999).random()}"
                // If token provided, use it for sending; otherwise read-only
                writer.write("CAP REQ :twitch.tv/tags twitch.tv/commands\r\n")
                writer.write("NICK $nickname\r\n")
                writer.write("JOIN #$channel\r\n")
                writer.flush()

                emitChatStatus("connected")

                var line: String?
                while (isActive.get() && reader.readLine().also { line = it } != null) {
                    val msg = line ?: continue
                    if (msg.startsWith("PING")) {
                        writer.write("PONG :${msg.substringAfter("PING ")}\r\n")
                        writer.flush()
                    } else if (msg.contains("PRIVMSG")) {
                        val chatMsg = parseTwitchPrivmsg(msg)
                        if (chatMsg != null) emitChatMessage(chatMsg)
                    }
                }
            } catch (e: Exception) {
                if (isActive.get()) {
                    Log.e(TAG, "Twitch chat error: ${e.message}")
                    emitChatError(e.message ?: "Twitch chat error")
                }
            } finally {
                try { writer?.close() } catch (_: Exception) {}
                try { reader?.close() } catch (_: Exception) {}
                try { socket?.close() } catch (_: Exception) {}
            }
        }.also { it.start() }
    }

    private fun parseTwitchPrivmsg(raw: String): ChatMessage? {
        try {
            // Format: :nick!nick@nick.tmi.twitch.tv PRIVMSG #channel :message
            // With tags: @tag=value;tag2=value2 :nick!... PRIVMSG #channel :message
            val nickPart = raw.substringAfter(" :").substringBefore("!")
            val msgText = raw.substringAfter("PRIVMSG #").substringAfter(" :")
            return ChatMessage(nickPart, msgText, System.currentTimeMillis())
        } catch (e: Exception) {
            return null
        }
    }

    private fun sendTwitchMessage(channel: String, token: String?, username: String, message: String) {
        // Requires OAuth token with chat:edit scope
        if (token == null) throw Exception("Twitch OAuth token required to send messages")
        val socket = Socket(TWITCH_IRC_HOST, TWITCH_IRC_PORT)
        val writer = OutputStreamWriter(socket.getOutputStream())
        writer.write("PASS oauth:$token\r\n")
        writer.write("NICK $username\r\n")
        writer.write("JOIN #$channel\r\n")
        writer.flush()
        Thread.sleep(500)
        writer.write("PRIVMSG #$channel :$message\r\n")
        writer.flush()
        Thread.sleep(200)
        writer.write("PART #$channel\r\n")
        writer.write("QUIT\r\n")
        writer.flush()
        writer.close()
        socket.close()
    }

    // ── Kick Chat (via REST API polling) ──────────────────────────────────────
    private fun startKickChat(channel: String) {
        chatThread = Thread {
            try {
                emitChatStatus("connected")
                var lastMessageId: String? = null

                while (isActive.get()) {
                    try {
                        // Get channel info to find chatroom ID
                        val channelUrl = URL("https://kick.com/api/v2/channels/$channel")
                        val conn = channelUrl.openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                        conn.connectTimeout = 10000
                        conn.readTimeout = 10000

                        if (conn.responseCode == 200) {
                            val response = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                            val json = JSONObject(response)
                            val chatroomId = json.optJSONObject("chatroom")?.optInt("id") ?: 0

                            if (chatroomId > 0) {
                                // Poll recent messages
                                val msgUrl = URL("https://kick.com/api/v2/chatrooms/$chatroomId/messages")
                                val msgConn = msgUrl.openConnection() as HttpURLConnection
                                msgConn.requestMethod = "GET"
                                msgConn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                msgConn.connectTimeout = 10000
                                msgConn.readTimeout = 10000

                                if (msgConn.responseCode == 200) {
                                    val msgResp = BufferedReader(InputStreamReader(msgConn.inputStream)).readText()
                                    val msgJson = JSONObject(msgResp)
                                    val messages = msgJson.optJSONArray("data") ?: JSONArray()

                                    val newMessages = mutableListOf<ChatMessage>()
                                    for (i in 0 until messages.length()) {
                                        val m = messages.optJSONObject(i) ?: continue
                                        val id = m.optString("id")
                                        if (id == lastMessageId) break
                                        val sender = m.optJSONObject("sender")?.optString("username") ?: "Unknown"
                                        val content = m.optString("content")
                                        newMessages.add(ChatMessage(sender, content, System.currentTimeMillis()))
                                    }
                                    if (messages.length() > 0) {
                                        lastMessageId = messages.optJSONObject(0)?.optString("id")
                                    }
                                    // Emit in reverse order (oldest first)
                                    newMessages.reversed().forEach { emitChatMessage(it) }
                                }
                                msgConn.disconnect()
                            }
                        }
                        conn.disconnect()
                    } catch (e: Exception) {
                        Log.d(TAG, "Kick poll error: ${e.message}")
                    }
                    Thread.sleep(3000)
                }
            } catch (e: Exception) {
                if (isActive.get()) emitChatError(e.message ?: "Kick chat error")
            }
        }.also { it.start() }
    }

    private fun sendKickMessage(channel: String, token: String?, message: String) {
        if (token == null) throw Exception("Kick auth token required to send messages")
        val channelUrl = URL("https://kick.com/api/v2/channels/$channel")
        val conn = channelUrl.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("User-Agent", "Mozilla/5.0")
        conn.connect()
        val resp = BufferedReader(InputStreamReader(conn.inputStream)).readText()
        val chatroomId = JSONObject(resp).optJSONObject("chatroom")?.optInt("id") ?: 0
        conn.disconnect()

        val postUrl = URL("https://kick.com/api/v2/chatrooms/$chatroomId/messages")
        val postConn = postUrl.openConnection() as HttpURLConnection
        postConn.requestMethod = "POST"
        postConn.setRequestProperty("Authorization", "Bearer $token")
        postConn.setRequestProperty("Content-Type", "application/json")
        postConn.setRequestProperty("User-Agent", "Mozilla/5.0")
        postConn.doOutput = true
        val body = JSONObject().put("content", message).put("type", "message").toString()
        OutputStreamWriter(postConn.outputStream).use { it.write(body) }
        postConn.connect()
        postConn.disconnect()
    }

    // ── YouTube Live Chat (via API) ───────────────────────────────────────────
    private fun startYouTubeChat(videoId: String, token: String?) {
        chatThread = Thread {
            try {
                emitChatStatus("connected")
                var pageToken: String? = null

                while (isActive.get()) {
                    try {
                        // First get the live chat ID from the video
                        val videoUrl = URL("https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=$videoId&key=${token ?: ""}")
                        val conn = videoUrl.openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.connectTimeout = 10000
                        conn.readTimeout = 10000

                        if (conn.responseCode == 200) {
                            val resp = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                            val json = JSONObject(resp)
                            val items = json.optJSONArray("items")
                            if (items != null && items.length() > 0) {
                                val liveDetails = items.optJSONObject(0)?.optJSONObject("liveStreamingDetails")
                                val chatId = liveDetails?.optString("activeLiveChatId") ?: ""

                                if (chatId.isNotEmpty()) {
                                    val chatUrl = URL("https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=$chatId&part=snippet,authorDetails&maxResults=5${if (pageToken != null) "&pageToken=$pageToken" else ""}&key=${token ?: ""}")
                                    val chatConn = chatUrl.openConnection() as HttpURLConnection
                                    chatConn.requestMethod = "GET"
                                    chatConn.connectTimeout = 10000
                                    chatConn.readTimeout = 10000

                                    if (chatConn.responseCode == 200) {
                                        val chatResp = BufferedReader(InputStreamReader(chatConn.inputStream)).readText()
                                        val chatJson = JSONObject(chatResp)
                                        pageToken = chatJson.optString("nextPageToken")
                                        val msgs = chatJson.optJSONArray("items") ?: JSONArray()

                                        for (i in 0 until msgs.length()) {
                                            val m = msgs.optJSONObject(i) ?: continue
                                            val author = m.optJSONObject("authorDetails")
                                            val displayName = author?.optString("displayName") ?: "Unknown"
                                            val snippet = m.optJSONObject("snippet")
                                            val text = snippet?.optString("displayMessage") ?: ""
                                            emitChatMessage(ChatMessage(displayName, text, System.currentTimeMillis()))
                                        }
                                    }
                                    chatConn.disconnect()
                                }
                            }
                        }
                        conn.disconnect()
                    } catch (e: Exception) {
                        Log.d(TAG, "YouTube poll error: ${e.message}")
                    }
                    // YouTube requires polling interval from API, default 5s
                    Thread.sleep(5000)
                }
            } catch (e: Exception) {
                if (isActive.get()) emitChatError(e.message ?: "YouTube chat error")
            }
        }.also { it.start() }
    }

    private fun sendYouTubeMessage(videoId: String, token: String?, message: String) {
        if (token == null) throw Exception("YouTube OAuth token required to send messages")
        // Get chat ID first
        val videoUrl = URL("https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=$videoId&key=$token")
        val conn = videoUrl.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connect()
        val resp = BufferedReader(InputStreamReader(conn.inputStream)).readText()
        val chatId = JSONObject(resp).optJSONArray("items")?.optJSONObject(0)
            ?.optJSONObject("liveStreamingDetails")?.optString("activeLiveChatId") ?: ""
        conn.disconnect()

        val postUrl = URL("https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet&key=$token")
        val postConn = postUrl.openConnection() as HttpURLConnection
        postConn.requestMethod = "POST"
        postConn.setRequestProperty("Content-Type", "application/json")
        postConn.setRequestProperty("Authorization", "Bearer $token")
        postConn.doOutput = true
        val body = JSONObject()
            .put("snippet", JSONObject()
                .put("liveChatId", chatId)
                .put("type", "textMessageEvent")
                .put("textMessageDetails", JSONObject().put("messageText", message)))
            .toString()
        OutputStreamWriter(postConn.outputStream).use { it.write(body) }
        postConn.connect()
        postConn.disconnect()
    }

    // ── Viewer count polling ──────────────────────────────────────────────────
    private fun startViewerPolling(platform: String, channel: String, token: String?) {
        viewerTimer = Timer()
        viewerTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                try {
                    val count = when (platform) {
                        "twitch" -> getTwitchViewers(channel)
                        "kick" -> getKickViewers(channel)
                        "youtube" -> getYouTubeViewers(channel)
                        else -> 0
                    }
                    emitViewerCount(count)
                } catch (e: Exception) {
                    Log.d(TAG, "Viewer poll error: ${e.message}")
                }
            }
        }, 0, 30000) // every 30 seconds
    }

    private fun getTwitchViewers(channel: String): Int {
        return try {
            val url = URL("https://www.twitch.tv/$channel")
            // Use Twitch Helix API if token available, otherwise scrape
            // For simplicity, use an unofficial endpoint
            val apiUrl = URL("https://decapi.me/twitch/viewercount/$channel")
            val conn = apiUrl.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            if (conn.responseCode == 200) {
                val text = BufferedReader(InputStreamReader(conn.inputStream)).readText().trim()
                conn.disconnect()
                text.toIntOrNull() ?: 0
            } else {
                conn.disconnect()
                0
            }
        } catch (e: Exception) { 0 }
    }

    private fun getKickViewers(channel: String): Int {
        return try {
            val url = URL("https://kick.com/api/v2/channels/$channel")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            if (conn.responseCode == 200) {
                val resp = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                conn.disconnect()
                JSONObject(resp).optInt("livestream", JSONObject())?.let {
                    it.optInt("viewer_count")
                } ?: 0
            } else {
                conn.disconnect()
                0
            }
        } catch (e: Exception) { 0 }
    }

    private fun getYouTubeViewers(videoId: String): Int {
        return try {
            val url = URL("https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=$videoId&key=AIzaSyDummyKey")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            if (conn.responseCode == 200) {
                val resp = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                conn.disconnect()
                val json = JSONObject(resp)
                val items = json.optJSONArray("items")
                if (items != null && items.length() > 0) {
                    val liveDetails = items.optJSONObject(0)?.optJSONObject("liveStreamingDetails")
                    return liveDetails?.optInt("concurrentViewers") ?: 0
                }
            }
            conn.disconnect()
            0
        } catch (e: Exception) { 0 }
    }

    // ── Emit events to JS ─────────────────────────────────────────────────────
    private data class ChatMessage(val username: String, val message: String, val timestamp: Long)

    private fun emitChatMessage(msg: ChatMessage) {
        handler.post {
            try {
                val payload = Arguments.createMap().apply {
                    putString("username", msg.username)
                    putString("message", msg.message)
                    putDouble("timestamp", msg.timestamp.toDouble())
                }
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LiveChatMessage", payload)
            } catch (_: Exception) {}
        }
    }

    private fun emitChatStatus(status: String) {
        handler.post {
            try {
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LiveChatStatus", status)
            } catch (_: Exception) {}
        }
    }

    private fun emitChatError(error: String) {
        handler.post {
            try {
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LiveChatError", error)
            } catch (_: Exception) {}
        }
    }

    private fun emitViewerCount(count: Int) {
        handler.post {
            try {
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("LiveChatViewerCount", count)
            } catch (_: Exception) {}
        }
    }
}
