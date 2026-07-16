# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# Kotlin
-keep class kotlin.** { *; }
-keepclassmembers class ** {
    @kotlin.jvm.JvmStatic *;
}

# Our modules
-keep class com.recvelaud.android.** { *; }

# Google AdMob / Play Services
-keep public class com.google.android.gms.ads.** { public *; }
-keep class com.google.android.gms.** { *; }

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── Autolinked third-party RN packages ──────────────────────────────────────
# PackageList.kt instantiates these via reflection at runtime. R8 must keep
# them even though they are not referenced by direct import in source code.
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.oblador.vectoricons.** { *; }
-keep class com.brentvatne.react.** { *; }
-keep class io.invertase.googlemobileads.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class cl.json.** { *; }

# Suppress warnings
-dontwarn okhttp3.**
-dontwarn okio.**
-dontnote **
