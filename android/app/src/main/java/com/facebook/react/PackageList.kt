package com.facebook.react

import android.app.Application
import android.util.Log
import com.facebook.react.ReactPackage

/**
 * Hand-written autolinking shim for this project.
 *
 * The @react-native/gradle-plugin does NOT generate PackageList.kt automatically
 * in this Gradle 8.4 + RN 0.74 configuration (autolinking resolves native
 * modules as runtime-only dependencies — classes are present in the final DEX
 * but are absent from the compile classpath, so direct imports fail at build time).
 *
 * This file is committed to source and provides an identical public API to the
 * generated version. Third-party packages are instantiated via reflection so that
 * compile-time classpath visibility is not required.
 *
 * ⚠  Update the class-name list below whenever you add or remove a native RN dep.
 */
class PackageList(private val application: Application) {

    /**
     * All autolinked native packages for this project.
     * Evaluated lazily once on first access; errors are logged and skipped.
     */
    val packages: List<ReactPackage> by lazy {
        buildList {
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
                // Some packages take an Application in their constructor
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
