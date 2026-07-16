package com.recvelaud.android

import android.app.Application
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
            override fun getPackages(): List<ReactPackage> = listOf(
                // Custom native modules — autolinked PackageList removed because
                // com.facebook.react plugin's generatePackageList task does not
                // register its output as a Kotlin source directory in AGP 8.x.
                // Add any third-party ReactPackage instances here explicitly if
                // their JS-side APIs are needed at runtime.
                RecorderPackage(),
                FloatingPanelPackage(),
                VideoLibraryPackage()
            )

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            // fabricEnabled was removed in RN 0.74; use BuildConfig fields instead.
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
        // Initialize AdMob
        MobileAds.initialize(this) {}
    }
}
