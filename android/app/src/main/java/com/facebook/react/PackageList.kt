package com.facebook.react

import android.app.Application
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.swmansion.rnscreens.RNScreensPackage
import com.th3rdwave.safeareacontext.SafeAreaContextPackage
import com.oblador.vectoricons.VectorIconsPackage
import com.brentvatne.react.ReactVideoPackage
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage
import cl.json.RNSharePackage

/**
 * Hand-written package list — permanent replacement for broken autolinking.
 *
 * WHY THIS FILE EXISTS:
 * The com.facebook.react.settings plugin runs "react-native config" in CI
 * but silently produces zero results — 4+ consecutive build logs show NO
 * third-party native-module tasks. Classes never compiled → ClassNotFoundException.
 * settings.gradle.kts now declares all native modules as explicit Gradle
 * sub-projects. With newArchEnabled=false, generateCodegenArtifactsFromSchema
 * is SKIPPED, so no generated PackageList.java is produced — no class conflict.
 *
 * WHY DIRECT IMPORTS (NOT REFLECTION):
 * All packages are declared as explicit Gradle sub-projects in settings.gradle.kts
 * and as implementation project(...) deps in build.gradle. Their classes are on the
 * Kotlin compile classpath → build fails (not runtime crash) if any class is missing.
 *
 * NOTE — react-native-google-mobile-ads:
 * Excluded because v14.x uses ViewGroupManager(ReactApplicationContext) which only
 * exists in new arch. With newArchEnabled=false, the package fails to compile.
 * Ads need a separate fix: either enable new arch or patch the package.
 *
 * ⚠  Keep in sync with settings.gradle.kts and app/build.gradle.
 */
class PackageList(private val application: Application) {

    val packages: List<ReactPackage> = listOf(
        // Core — from react-android AAR (must be first for StatusBarModule)
        MainReactPackage(),

        // Third-party — compiled as explicit Gradle sub-projects
        RNScreensPackage(),                // react-native-screens
        SafeAreaContextPackage(),          // react-native-safe-area-context
        VectorIconsPackage(),              // react-native-vector-icons
        ReactVideoPackage(),               // react-native-video
        AsyncStoragePackage(),             // @react-native-async-storage/async-storage
        RNSharePackage(),                  // react-native-share

        // react-native-google-mobile-ads: EXCLUDED (new arch only, see note above)
    )
}
