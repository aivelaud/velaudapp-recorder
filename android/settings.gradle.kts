pluginManagement {
    includeBuild("../node_modules/@react-native/gradle-plugin")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("com.facebook.react.settings")
}

rootProject.name = "VelaudRecorder"
include(":app")

// ── MANUAL AUTOLINKING (PERMANENT FIX) ────────────────────────────────────────
//
// ROOT CAUSE: The com.facebook.react.settings plugin calls
// autolinkLibrariesFromCommandOrDefault() which runs "react-native config" in
// CI but silently produces ZERO results — confirmed by 4+ build logs showing
// no ":react-native-screens:*" or any other third-party native module tasks.
// Without these sub-project includes, native module classes are never compiled
// into the APK → ClassNotFoundException at runtime.
//
// EXCLUDED: react-native-google-mobile-ads — v14.x requires new arch
// (ViewGroupManager(reactApplicationContext) constructor) and fails to compile
// with newArchEnabled=false. Ads require a separate fix (either enable new arch
// or patch the package). The package was also never in the APK before this fix.
//
// FUTURE SAFETY: If autolinkLibrariesFromCommandOrDefault() ever starts working
// in CI, Gradle will error "Project included more than once" — loud, easy to fix.
// ─────────────────────────────────────────────────────────────────────────────

include(":react-native-screens")
project(":react-native-screens").projectDir =
    File("../node_modules/react-native-screens/android")

include(":react-native-safe-area-context")
project(":react-native-safe-area-context").projectDir =
    File("../node_modules/react-native-safe-area-context/android")

include(":react-native-vector-icons")
project(":react-native-vector-icons").projectDir =
    File("../node_modules/react-native-vector-icons/android")

include(":react-native-video")
project(":react-native-video").projectDir =
    File("../node_modules/react-native-video/android")

include(":react-native-async-storage")
project(":react-native-async-storage").projectDir =
    File("../node_modules/@react-native-async-storage/async-storage/android")

include(":react-native-share")
project(":react-native-share").projectDir =
    File("../node_modules/react-native-share/android")

includeBuild("../node_modules/@react-native/gradle-plugin")
