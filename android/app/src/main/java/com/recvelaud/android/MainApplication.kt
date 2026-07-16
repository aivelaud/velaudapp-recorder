package com.recvelaud.android

import android.app.Application
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

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
        MobileAds.initialize(this) {}
    }
}
