package com.recvelaud.android

import android.app.Application
import android.content.Intent
import android.os.Process
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.google.android.gms.ads.MobileAds
import com.recvelaud.android.modules.RecorderPackage
import com.recvelaud.android.modules.FloatingPanelPackage
import com.recvelaud.android.modules.VideoLibraryPackage
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this@MainApplication).packages + listOf(
                    RecorderPackage(),
                    FloatingPanelPackage(),
                    VideoLibraryPackage()
                )

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isHermesEnabled: Boolean = true

            // Explicitly disable New Architecture (legacy bridge).
            // This ensures StatusBarManager and all core RN modules are
            // registered as NativeModules (not TurboModules), fixing the
            // "StatusBarManager could not be found" crash on startup.
            override val isNewArchEnabled: Boolean = false
        }

    override fun onCreate() {
        setupCrashHandler()
        super.onCreate()
        SoLoader.init(this, false)
        try {
            MobileAds.initialize(this) {}
        } catch (e: Exception) {
            Log.e("MainApplication", "MobileAds.initialize failed: ${e.message}", e)
        }
    }

    private fun setupCrashHandler() {
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val report = buildCrashReport(thread, throwable)

            try {
                val dir = getExternalFilesDir(null)
                if (dir != null) {
                    val file = File(dir, "crash_log.txt")
                    file.writeText(report)
                    Log.e("CrashHandler", "Crash log written to: ${file.absolutePath}")
                }
            } catch (_: Exception) {}

            try {
                val intent = Intent(this, CrashActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_CLEAR_TASK
                    putExtra("crash_report", report.take(6000))
                }
                startActivity(intent)
            } catch (_: Exception) {}

            try { Thread.sleep(600) } catch (_: Exception) {}

            Process.killProcess(Process.myPid())
        }
    }

    private fun buildCrashReport(thread: Thread, throwable: Throwable): String {
        return try {
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            val fullTrace = sw.toString()

            val ourLines = fullTrace.lines()
                .filter { it.contains("com.recvelaud") || it.contains("com.facebook.react") }
                .take(30)
                .joinToString("\n")

            val timestamp = try {
                SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
            } catch (_: Exception) { "unknown time" }

            buildString {
                appendLine("=== VELAUD RECORDER CRASH REPORT ===")
                appendLine("Zaman    : $timestamp")
                appendLine("Thread   : ${thread.name}")
                appendLine("Versiyon : ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})")
                appendLine("Hata tipi: ${throwable::class.java.name}")
                appendLine("Mesaj    : ${throwable.message}")
                appendLine()
                appendLine("--- Uygulama satırları (hızlı özet) ---")
                appendLine(ourLines.ifBlank { "(yok)" })
                appendLine()
                appendLine("--- Tam stack trace ---")
                appendLine(fullTrace)
            }
        } catch (e: Exception) {
            "Crash report oluşturulamadı: ${e.message}\nOrijinal hata: ${throwable.message}"
        }
    }
}
