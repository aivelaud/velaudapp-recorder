package com.recvelaud.android

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/**
 * Full-screen crash reporter Activity.
 *
 * Launched by the global UncaughtExceptionHandler in MainApplication when a
 * Java/Kotlin exception escapes to the top of any thread. Shows the error type,
 * message, and the full stack trace as selectable, copyable text so the user
 * can screenshot or copy the report and share it with the developer.
 *
 * This Activity is intentionally written with zero external dependencies —
 * no React Native, no third-party libraries — so it can survive crashes that
 * occur during React initialisation.
 */
class CrashActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val report = intent?.getStringExtra("crash_report") ?: "(no crash report received)"

        // ── Root layout ───────────────────────────────────────────────────────
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0D0D0D"))
            setPadding(dp(16), dp(24), dp(16), dp(16))
        }

        // ── Header ────────────────────────────────────────────────────────────
        val header = TextView(this).apply {
            text = "⚠ Velaud Recorder Çöktü"
            setTextColor(Color.parseColor("#FF5252"))
            textSize = 18f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        root.addView(header, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).also { it.bottomMargin = dp(8) })

        val sub = TextView(this).apply {
            text = "Aşağıdaki hata metnini kopyalayıp geliştiriciye gönderin."
            setTextColor(Color.parseColor("#AAAAAA"))
            textSize = 13f
            gravity = Gravity.CENTER
        }
        root.addView(sub, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).also { it.bottomMargin = dp(12) })

        // ── Crash text scroll area ─────────────────────────────────────────
        val scrollView = ScrollView(this)
        val crashText = TextView(this).apply {
            text = report
            setTextColor(Color.parseColor("#E0E0E0"))
            textSize = 11f
            setTypeface(Typeface.MONOSPACE)
            setTextIsSelectable(true)
            setBackgroundColor(Color.parseColor("#1A1A1A"))
            setPadding(dp(10), dp(10), dp(10), dp(10))
            movementMethod = ScrollingMovementMethod()
        }
        scrollView.addView(crashText)
        root.addView(scrollView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ).also { it.bottomMargin = dp(12) })

        // ── Button row ────────────────────────────────────────────────────────
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        val copyBtn = Button(this).apply {
            text = "Kopyala"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#E53935"))
            setOnClickListener {
                try {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("crash_report", report))
                    Toast.makeText(this@CrashActivity, "Panoya kopyalandı", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {}
            }
        }
        btnRow.addView(copyBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            .also { it.rightMargin = dp(8) })

        val closeBtn = Button(this).apply {
            text = "Uygulamayı Kapat"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#333333"))
            setOnClickListener {
                finishAffinity()
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
        btnRow.addView(closeBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        root.addView(btnRow, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        setContentView(root)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
