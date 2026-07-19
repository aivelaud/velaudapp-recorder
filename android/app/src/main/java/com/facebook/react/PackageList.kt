package com.facebook.react

import android.app.Application
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.swmansion.rnscreens.RNScreensPackage
import com.th3rdwave.safeareacontext.SafeAreaContextPackage
import com.oblador.vectoricons.VectorIconsPackage
import com.brentvatne.react.ReactVideoPackage
import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsPackage
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage
import cl.json.RNSharePackage

/**
 * Hand-written package list — permanent replacement for broken autolinking.
 *
 * WHY THIS FILE EXISTS:
 * The standard autolinking system (com.facebook.react.settings plugin) is
 * supposed to generate a PackageList.java in the build directory. However,
 * in this project's CI environment the discovery command ("react-native config")
 * runs but produces zero results — 4 consecutive build logs show NO
 * ":react-native-screens:*" or other third-party native-module tasks.
 * Without explicit Gradle sub-project includes (now in settings.gradle.kts),
 * those classes never compile into the APK, causing ClassNotFoundException.
 *
 * With `newArchEnabled=false` the codegen step that generates PackageList.java
 * is SKIPPED (confirmed: "generateCodegenArtifactsFromSchema SKIPPED" in CI
 * logs), so this file is the sole PackageList — no duplicate-class conflict.
 *
 * WHY DIRECT IMPORTS (NOT REFLECTION):
 * All packages are now declared as explicit Gradle sub-projects in
 * settings.gradle.kts and as `implementation project(...)` deps in
 * app/build.gradle. Their classes are on the Kotlin compile classpath, so
 * direct imports are compile-time safe. Any missing class → BUILD FAILURE,
 * not a runtime crash — the error is caught before an APK is ever produced.
 *
 * WHY MainReactPackage IS FIRST:
 * RN 0.74 moved StatusBarModule and NativeAnimatedModule out of
 * CoreModulesPackage into MainReactPackage. Without it in old-arch (bridge)
 * mode, TurboModuleRegistry.getEnforcing() throws a fatal crash on launch.
 * MainReactPackage is in the react-android AAR — always available.
 *
 * ⚠  Keep this list in sync with:
 *    • package.json dependencies
 *    • settings.gradle.kts manual autolinking section
 *    • android/app/build.gradle implementation project(...) deps
 */
class PackageList(private val application: Application) {

    val packages: List<ReactPackage> = listOf(
        // Core (must be first) — from react-android AAR
        MainReactPackage(),

        // Third-party — compiled as explicit Gradle sub-projects via
        // the manual autolinking section in settings.gradle.kts
        RNScreensPackage(),                      // react-native-screens
        SafeAreaContextPackage(),                // react-native-safe-area-context
        VectorIconsPackage(),                    // react-native-vector-icons
        ReactVideoPackage(),                     // react-native-video
        ReactNativeGoogleMobileAdsPackage(),     // react-native-google-mobile-ads
        AsyncStoragePackage(),                   // @react-native-async-storage/async-storage
        RNSharePackage(),                        // react-native-share
    )
}
