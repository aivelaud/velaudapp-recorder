package com.facebook.react

import android.app.Application
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage

/**
 * Hand-written autolinking shim for this project.
 *
 * ROOT CAUSE OF CRASH (fixed here):
 * In RN 0.74, StatusBarModule and NativeAnimatedModule live in MainReactPackage
 * (com.facebook.react.shell). They are NOT in CoreModulesPackage. When old-arch
 * bridge mode is active, TurboModuleRegistry.requireModule() first checks
 * NativeModules[name]. If MainReactPackage is absent, StatusBarManager and
 * NativeAnimatedModule are never registered → TurboModuleRegistry.getEnforcing()
 * throws the fatal "could not be found" crash.
 *
 * FIX: Always add MainReactPackage() first. Third-party packages follow via
 * reflection (autolinking includes their AARs even with newArchEnabled=false).
 *
 * ⚠ Update the reflection list below whenever you add or remove a native RN dep.
 */
class PackageList(private val application: Application) {

    val packages: List<ReactPackage> by lazy {
        buildList {
            // ── CORE: must be first ───────────────────────────────────────────
            // Provides StatusBarModule (StatusBarManager), NativeAnimatedModule,
            // and other built-in RN native modules that are NOT in CoreModulesPackage.
            add(MainReactPackage())

            // ── THIRD-PARTY (autolinked) ──────────────────────────────────────
            // Instantiated via reflection so compile-time classpath visibility
            // is not required (autolinking includes AARs at link time).

            // react-native-screens ^3.35.0
            reflectAdd("com.swmansion.rnscreens.RNScreensPackage")
            // react-native-safe-area-context ^4.12.0
            reflectAdd("com.th3rdwave.safeareacontext.SafeAreaContextPackage")
            // react-native-vector-icons ^10.2.0
            reflectAdd("com.oblador.vectoricons.VectorIconsPackage")
            // react-native-video ^6.5.2
            reflectAdd("com.brentvatne.react.ReactVideoPackage")
            // react-native-google-mobile-ads ^14.4.0
            reflectAdd("io.invertase.googlemobileads.ReactNativeGoogleMobileAdsPackage")
            // @react-native-async-storage/async-storage ^2.1.0
            reflectAdd("com.reactnativecommunity.asyncstorage.AsyncStoragePackage")
            // react-native-share ^10.1.3
            reflectAdd("cl.json.RNSharePackage")
        }
    }

    private fun MutableList<ReactPackage>.reflectAdd(className: String) {
        try {
            @Suppress("UNCHECKED_CAST")
            val clazz = Class.forName(className) as Class<out ReactPackage>
            val instance = try {
                clazz.getDeclaredConstructor().newInstance()
            } catch (_: NoSuchMethodException) {
                clazz.getDeclaredConstructor(Application::class.java).newInstance(application)
            }
            add(instance)
            Log.d("PackageList", "Registered $className")
        } catch (e: ClassNotFoundException) {
            Log.w("PackageList", "Not found (may be auto-linked differently): $className")
        } catch (e: Exception) {
            Log.e("PackageList", "Failed to register $className", e)
        }
    }
}
