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
 * Autolinking shim — direct imports, no reflection.
 *
 * WHY NO REFLECTION:
 * The previous version used Class.forName() + newInstance(). In a release build
 * R8/ProGuard may silently strip or fail to initialise packages that are only
 * referenced via reflection even when -keep rules are present, because the
 * constructor invocation chain can throw at runtime (e.g. TurboReactPackage
 * subclass constructors with internal state) and the generic catch block swallows
 * the error without registering the package. Direct imports are resolved by the
 * compiler, so R8 always keeps the classes and instantiation failures surface
 * immediately instead of being silently ignored.
 *
 * WHY MainReactPackage IS FIRST:
 * RN 0.74 moved StatusBarModule (StatusBarManager) and NativeAnimatedModule out
 * of CoreModulesPackage into MainReactPackage. Without it, TurboModuleRegistry
 * can't find them → fatal crash on launch.
 *
 * ⚠  Keep this list in sync with package.json dependencies.
 */
class PackageList(private val application: Application) {

    val packages: List<ReactPackage>
        get() = listOf(
            // ── Core (must be first) ─────────────────────────────────────────
            MainReactPackage(),

            // ── Third-party (autolinking order) ─────────────────────────────
            RNScreensPackage(),                         // react-native-screens
            SafeAreaContextPackage(),                   // react-native-safe-area-context
            VectorIconsPackage(),                      // react-native-vector-icons
            ReactVideoPackage(),                        // react-native-video
            ReactNativeGoogleMobileAdsPackage(),        // react-native-google-mobile-ads
            AsyncStoragePackage(),                      // @react-native-async-storage/async-storage
            RNSharePackage(),                           // react-native-share
        )
}
