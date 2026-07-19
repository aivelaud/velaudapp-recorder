pluginManagement {
    // includeBuild here makes com.facebook.react.settings available for the
    // plugins{} block below (pluginManagement composite builds feed the
    // settings-file plugin resolver).
    includeBuild("../node_modules/@react-native/gradle-plugin")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// com.facebook.react.settings plugin registers "react" extension and
// automatically calls autolinkLibrariesFromCommandOrDefault() via
// settingsEvaluated hook — no manual extensions.configure needed.
plugins {
    id("com.facebook.react.settings")
}

rootProject.name = "VelaudRecorder"
include(":app")

// ── MANUAL AUTOLINKING (PERMANENT FIX) ────────────────────────────────────────
//
// ROOT CAUSE: The com.facebook.react.settings plugin calls
// autolinkLibrariesFromCommandOrDefault() in a settingsEvaluated hook. This
// runs "node ... react-native config" to discover native packages. In CI that
// command runs but silently produces zero results — confirmed by 4 consecutive
// build logs that show ZERO ":react-native-screens:*" or any other
// third-party native module tasks. Without these sub-project includes, the
// native module classes are never compiled, never packaged into the APK, and
// Class.forName() at runtime throws ClassNotFoundException.
//
// FIX: Declare each native module as an explicit Gradle sub-project here.
// This is equivalent to what autolinking should have done, but done
// deterministically — no `react-native config` command, no silent failure.
//
// FUTURE SAFETY: If autolinkLibrariesFromCommandOrDefault() ever starts
// working in CI and tries to include these again, Gradle will error with
// "Project included more than once" — a loud, clear error. Fix by removing
// the manual entries below for whichever projects the auto-linker now handles.
//
// SYSTEMIC: Direct imports in PackageList.kt (compile-time checked) replace
// reflection — any missing class now fails at BUILD time, not at app launch.
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

include(":react-native-google-mobile-ads")
project(":react-native-google-mobile-ads").projectDir =
    File("../node_modules/react-native-google-mobile-ads/android")

include(":react-native-async-storage")
project(":react-native-async-storage").projectDir =
    File("../node_modules/@react-native-async-storage/async-storage/android")

include(":react-native-share")
project(":react-native-share").projectDir =
    File("../node_modules/react-native-share/android")

// A second includeBuild at root level makes the react-native-gradle-plugin
// subproject (com.facebook.react.rootproject, com.facebook.react) available
// to project build scripts via the plugins{} block.
// NOTE: apply plugin: "com.facebook.react.rootproject" (legacy mechanism)
// does NOT resolve from composite builds — only plugins{} does.
// See android/build.gradle for the correct plugins{} usage.
includeBuild("../node_modules/@react-native/gradle-plugin")
