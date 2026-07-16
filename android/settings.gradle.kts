// Root-level includeBuild exposes BOTH settings plugins (com.facebook.react.settings)
// AND project plugins (com.facebook.react.rootproject, com.facebook.react) to the
// entire build.
//
// Why NOT inside pluginManagement: Gradle 8.4 deduplicates includeBuild by canonical
// path. When the same path appears inside pluginManagement{} AND at root level, Gradle
// collapses them into a single "plugin-management build" that only runs the tasks
// needed for settings-phase resolution (i.e. settings-plugin). The project-phase
// plugin (react-native-gradle-plugin → com.facebook.react.rootproject) is never
// compiled, so apply plugin: "com.facebook.react.rootproject" in build.gradle fails
// with "Plugin not found".
//
// Keeping a SINGLE root-level includeBuild avoids deduplication: Gradle treats it as a
// regular composite build, compiles all subprojects on demand, and makes every plugin
// available in both settings and project scripts.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// Must come before plugins{} so the plugin can be resolved from this composite build.
includeBuild("../node_modules/@react-native/gradle-plugin")

// com.facebook.react.settings plugin registers "react" extension and
// automatically calls autolinkLibrariesFromCommandOrDefault() via
// settingsEvaluated hook — no manual extensions.configure needed.
plugins {
    id("com.facebook.react.settings")
}

rootProject.name = "VelaudRecorder"
include(":app")
