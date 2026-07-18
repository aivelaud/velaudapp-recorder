package com.recvelaud.android

import android.app.Application
import android.content.Intent
import android.os.Process
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
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
                // PackageList auto-registers all third-party packages via RN autolinking
                // (react-native-screens, safe-area-context, vector-icons, video, ads, etc.)
                // Custom native modules are added explicitly on top.
                PackageList(this@MainApplication).packages + listOf(
                    RecorderPackage(),
                    FloatingPanelPackage(),
                    VideoLibraryPackage()
                )

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = false  // New Arch kapalı — StatusBarManager crash fix
            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        // Set up crash handler FIRST — before any other init — so we catch
        // exceptions that happen during SoLoader, AdMob, or React initialisation.
        setupCrashHandler()

        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
        // Initialize AdMob SDK. Wrapped in try-catch so that any AdMob
        // initialisation failure does not crash the whole app at startup.
        try {
            MobileAds.initialize(this) {}
        } catch (e: Exception) {
            Log.e("MainApplication", "MobileAds.initialize failed: ${e.message}", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Global uncaught-exception handler
    //
    // Runs on ANY thread that throws an uncaught Throwable (including the
    // React JS thread, the main thread, and background threads).
    //
    // Strategy:
    //   1. Build a human-readable crash report (type + message + stack trace).
    //   2. Write it to external storage so it survives the process restart
    //      (readable with a file-manager app under Android/data/com.recvelaud.android/files/).
    //   3. Launch CrashActivity to show the report as selectable, copyable text.
    //   4. Kill the process cleanly.
    //
    // EVERY step is wrapped in its own try-catch so that this handler can never
    // itself cause a secondary crash or infinite loop.
    // ─────────────────────────────────────────────────────────────────────────
    private fun setupCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val report = buildCrashReport(thread, throwable)

            // 1. Write to file (silently ignore any I/O error)
            try {
                val dir = getExternalFilesDir(null)
                if (dir != null) {
                    val file = File(dir, "crash_log.txt")
                    file.writeText(report)
                    Log.e("CrashHandler", "Crash log written to: ${file.absolutePath}")
                }
            } catch (_: Exception) {}

            // 2. Show CrashActivity
            try {
                val intent = Intent(this, CrashActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_CLEAR_TASK
                    // Trim report to avoid TransactionTooLargeException in the Bundle
                    putExtra("crash_report", report.take(6000))
                }
                startActivity(intent)
            } catch (_: Exception) {}

            // 3. Brief pause to allow CrashActivity to start before we kill the process
            try { Thread.sleep(600) } catch (_: Exception) {}

            // 4. Kill — do NOT call defaultHandler, which would show the system
            //    "App has stopped" dialog on top of our CrashActivity.
            Process.killProcess(Process.myPid())
        }
    }

    private fun buildCrashReport(thread: Thread, throwable: Throwable): String {
        return try {
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            val fullTrace = sw.toString()

            // Pull out lines from our own package for quick diagnosis
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
