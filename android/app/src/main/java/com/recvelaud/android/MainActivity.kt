package com.recvelaud.android

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    companion object {
        private const val REQUEST_OVERLAY_PERMISSION = 1234
    }

    override fun getMainComponentName(): String = "VelaudRecorder"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        
        // Check overlay permission on app start for Android 6.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                android.util.Log.w("MainActivity", "Overlay permission not granted")
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_OVERLAY_PERMISSION) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    android.util.Log.i("MainActivity", "Overlay permission granted")
                } else {
                    android.util.Log.w("MainActivity", "Overlay permission denied")
                }
            }
        }
    }
}
