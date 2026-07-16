pluginManagement {
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
// (Manual configure fails because ReactSettingsExtension class is not
// on the settings script classpath at compilation/evaluation time.)
plugins {
    id("com.facebook.react.settings")
}

rootProject.name = "VelaudRecorder"
include(":app")
includeBuild("../node_modules/@react-native/gradle-plugin")
