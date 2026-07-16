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

# Suppress warnings
-dontwarn okhttp3.**
-dontwarn okio.**
-dontnote **
