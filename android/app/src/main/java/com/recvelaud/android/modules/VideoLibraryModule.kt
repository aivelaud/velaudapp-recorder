package com.recvelaud.android.modules

import android.content.ContentUris
import android.graphics.Bitmap
import android.media.ThumbnailUtils
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class VideoLibraryModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VideoLibraryModule"

    companion object {
        private const val TAG = "VideoLibraryModule"
        private const val THUMB_DIR = "velaud_thumbs"
    }

    @ReactMethod
    fun getRecordedVideos(promise: Promise) {
        try {
            val results = Arguments.createArray()
            val projection = arrayOf(
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.TITLE,
                MediaStore.Video.Media.DATA,
                MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.DATE_ADDED,
                MediaStore.Video.Media.WIDTH,
                MediaStore.Video.Media.HEIGHT,
            )
            val selection = "${MediaStore.Video.Media.RELATIVE_PATH} LIKE ?"
            val selectionArgs = arrayOf("Movies/VelaudRecorder%")
            val sortOrder = "${MediaStore.Video.Media.DATE_ADDED} DESC"

            val uri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            val cursor = reactContext.contentResolver.query(
                uri, projection,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) selection else null,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) selectionArgs else null,
                sortOrder
            )

            cursor?.use { c ->
                val idCol = c.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
                val nameCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)
                val titleCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.TITLE)
                val dataCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DATA)
                val durCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)
                val sizeCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)
                val dateCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_ADDED)
                val widthCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH)
                val heightCol = c.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT)

                while (c.moveToNext()) {
                    val id = c.getLong(idCol)
                    val filePath = c.getString(dataCol) ?: ""

                    // Filter by folder name for older Android
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
                        !filePath.contains("VelaudRecorder", ignoreCase = true)
                    ) continue

                    val thumbPath = generateThumbnail(filePath, id)
                    val map = Arguments.createMap().apply {
                        putString("id", id.toString())
                        putString("displayName", c.getString(nameCol) ?: "")
                        putString("title", c.getString(titleCol) ?: "")
                        putString("filePath", filePath)
                        putDouble("duration", c.getLong(durCol).toDouble())
                        putDouble("size", c.getLong(sizeCol).toDouble())
                        putDouble("dateAdded", c.getLong(dateCol) * 1000.0)
                        putInt("width", c.getInt(widthCol))
                        putInt("height", c.getInt(heightCol))
                        putString("thumbnailPath", thumbPath)
                    }
                    results.pushMap(map)
                }
            }
            promise.resolve(results)
        } catch (e: Exception) {
            Log.e(TAG, "getRecordedVideos error", e)
            promise.reject("QUERY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun deleteVideo(filePath: String, promise: Promise) {
        try {
            val deleted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val uri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                val rows = reactContext.contentResolver.delete(
                    uri,
                    "${MediaStore.Video.Media.DATA} = ?",
                    arrayOf(filePath)
                )
                rows > 0
            } else {
                val file = File(filePath)
                file.exists() && file.delete()
            }
            promise.resolve(deleted)
        } catch (e: Exception) {
            promise.reject("DELETE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getVideoThumbnail(filePath: String, timeMs: Int, promise: Promise) {
        val id = filePath.hashCode().toLong()
        val path = generateThumbnail(filePath, id)
        promise.resolve(path)
    }

    private fun generateThumbnail(filePath: String, id: Long): String? {
        return try {
            val thumbDir = File(reactContext.cacheDir, THUMB_DIR).also { it.mkdirs() }
            val thumbFile = File(thumbDir, "thumb_$id.jpg")
            if (thumbFile.exists()) return thumbFile.absolutePath

            val bitmap: Bitmap? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ThumbnailUtils.createVideoThumbnail(File(filePath), Size(320, 180), CancellationSignal())
            } else {
                @Suppress("DEPRECATION")
                ThumbnailUtils.createVideoThumbnail(filePath, android.provider.MediaStore.Video.Thumbnails.MINI_KIND)
            }

            bitmap?.let {
                FileOutputStream(thumbFile).use { out ->
                    it.compress(Bitmap.CompressFormat.JPEG, 80, out)
                }
                it.recycle()
                thumbFile.absolutePath
            }
        } catch (e: Exception) {
            Log.w(TAG, "Thumbnail error for $filePath: ${e.message}")
            null
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}
    @ReactMethod
    fun removeListeners(count: Int) {}
}
