package com.facebook.react

import android.app.Application
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage

/**
 * Hand-written autolinking shim for this project.
 *
 * WHY THIS FILE EXISTS:
 * The standard autolinking system (com.facebook.react.settings plugin) generates
 * a PackageList.java in the build directory. However, in this project's CI
 * environment that generated file is not reliably placed on the compile classpath,
 * so we maintain this explicit shim instead.
 *
 * WHY REFLECTION FOR THIRD-PARTY PACKAGES:
 * Direct imports (e.g. `import com.swmansion.rnscreens.RNScreensPackage`) fail
 * at compile time in CI because autolinking sub-projects are not resolved as
 * compile-time classpath entries in the CI Gradle configuration. Reflection
 * defers class lookup to runtime, where the AARs are always present (included
 * by the autolinking Gradle plugin).
 *
 * WHY MainReactPackage IS ADDED DIRECTLY:
 * RN 0.74 moved StatusBarModule (StatusBarManager) and NativeAnimatedModule out
 * of CoreModulesPackage into MainReactPackage (com.facebook.react.shell).
 * Without it in old-arch (bridge) mode, TurboModuleRegistry.getEnforcing()
 * throws a fatal "could not be found" crash on launch.
 * MainReactPackage is in the react-android AAR, so it IS on the compile
 * classpath and can be imported directly.
 *
 * WHY REFLECTION THROWS ON FAILURE:
 * Previous version swallowed instantiation exceptions silently (catch + Log.e),
 * causing packages to be silently dropped → "RNCSafeAreaProvider not found in
 * UIManager" crash with no clear indication of which package failed.
 * Now any failure throws immediately with the root cause, so the crash log
 * identifies exactly what went wrong.
 *
 * WHY ProGuard KEEP RULES ARE NEEDED:
 * R8 does not treat Class.forName("...") string literals as class references
 * for tree-shaking purposes. Without explicit -keep rules in proguard-rules.pro,
 * R8 strips the package classes as "unreachable code" → ClassNotFoundException
 * at runtime. See the -keep rules in proguard-rules.pro (section 7).
 *
 * ⚠  Keep this list in sync with package.json dependencies.
 * ⚠  Add a corresponding -keep rule in proguard-rules.pro for every new entry.
 */
class PackageList(private val application: Application) {

    val packages: List<ReactPackage> by lazy {
        buildList {
            // ── CORE (must be first) ──────────────────────────────────────────
            // react-android AAR → direct import OK
            add(MainReactPackage())

            // ── THIRD-PARTY (via autolinking AARs) ───────────────────────────
            // Instantiated via reflection; proguard-rules.pro keeps these classes.
            // Any failure throws RuntimeException immediately (no silent drops).

            reflectAdd("com.swmansion.rnscreens.RNScreensPackage")          // react-native-screens
            reflectAdd("com.th3rdwave.safeareacontext.SafeAreaContextPackage") // react-native-safe-area-context
            reflectAdd("com.oblador.vectoricons.VectorIconsPackage")          // react-native-vector-icons
            reflectAdd("com.brentvatne.react.ReactVideoPackage")              // react-native-video
            reflectAdd("io.invertase.googlemobileads.ReactNativeGoogleMobileAdsPackage") // react-native-google-mobile-ads
            reflectAdd("com.reactnativecommunity.asyncstorage.AsyncStoragePackage")       // @react-native-async-storage/async-storage
            reflectAdd("cl.json.RNSharePackage")                              // react-native-share
        }
    }

    /**
     * Instantiates a ReactPackage by class name via reflection and adds it
     * to the receiver list.
     *
     * Tries no-arg constructor first; falls back to single-Application-arg
     * constructor. Any failure (ClassNotFound, instantiation error, etc.)
     * throws RuntimeException — callers must NOT swallow this so the crash
     * log clearly identifies the failing package.
     */
    private fun MutableList<ReactPackage>.reflectAdd(className: String) {
        try {
            @Suppress("UNCHECKED_CAST")
            val clazz = Class.forName(className) as Class<out ReactPackage>
            val instance: ReactPackage = try {
                clazz.getDeclaredConstructor().newInstance()
            } catch (_: NoSuchMethodException) {
                // Some packages require Application context in their constructor
                clazz.getDeclaredConstructor(Application::class.java).newInstance(application)
            }
            add(instance)
            Log.d("PackageList", "✓ Registered $className")
        } catch (e: ClassNotFoundException) {
            // Package class is missing from the APK — likely a ProGuard strip
            // or the AAR was not included by autolinking. Throw immediately
            // so the crash log names the culprit.
            throw RuntimeException(
                "PackageList: ClassNotFoundException for '$className'. " +
                "Check that (a) the package is in package.json, (b) npm install ran, " +
                "and (c) proguard-rules.pro has a -keep rule for this class.",
                e
            )
        } catch (e: Exception) {
            // Constructor or static-initializer threw — surface it immediately.
            throw RuntimeException(
                "PackageList: failed to instantiate '$className'. " +
                "Root cause: ${e.javaClass.simpleName}: ${e.message}",
                e
            )
        }
    }
}
