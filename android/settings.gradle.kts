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

// A second includeBuild at root level makes the react-native-gradle-plugin
// subproject (com.facebook.react.rootproject, com.facebook.react) available
// to project build scripts via the plugins{} block.
// NOTE: apply plugin: "com.facebook.react.rootproject" (legacy mechanism)
// does NOT resolve from composite builds — only plugins{} does.
// See android/build.gradle for the correct plugins{} usage.
includeBuild("../node_modules/@react-native/gradle-plugin")
