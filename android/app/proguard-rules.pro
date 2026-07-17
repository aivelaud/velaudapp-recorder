# ─────────────────────────────────────────────────────────────────────────────
# VELAUD RECORDER — ProGuard / R8 rules
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. ATTRIBUTES — must come first ──────────────────────────────────────────
# Without this, @ReactMethod / @ReactModule annotations are stripped at
# compile time and the RN bridge cannot discover any native module methods,
# causing a hard crash on first JS→native call (typically in useEffect after
# first render).
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Exceptions
-keepattributes LineNumberTable,SourceFile
-renamesourcefileattribute SourceFile

# ── 2. REACT NATIVE ───────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-dontwarn com.facebook.**

# Explicitly keep @ReactMethod and @ReactModule annotated elements
# (belt-and-suspenders alongside -keepattributes *Annotation*)
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepclasseswithmembers class * {
    @com.facebook.react.bridge.ReactModule <fields>;
}
-keep @com.facebook.react.bridge.ReactModule class * { *; }

# ── 3. KOTLIN ─────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-keepclassmembers class ** {
    @kotlin.jvm.JvmStatic *;
}
-keepclassmembers class ** implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── 4. OUR APP MODULES (native bridge classes) ───────────────────────────────
-keep class com.recvelaud.android.** { *; }

# ── 5. GOOGLE ADMOB / PLAY SERVICES ──────────────────────────────────────────
-keep public class com.google.android.gms.ads.** { public *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.ump.** { *; }
-dontwarn com.google.android.gms.**

# ── 6. ANDROIDX ──────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ── 7. AUTOLINKED THIRD-PARTY RN PACKAGES ─────────────────────────────────────
# PackageList.kt instantiates these via Class.forName() at runtime.
# R8 must keep them even though they are not referenced by direct import.
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.oblador.vectoricons.** { *; }
-keep class com.brentvatne.react.** { *; }
-keep class com.brentvatne.exoplayer.** { *; }
-keep class io.invertase.googlemobileads.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class cl.json.** { *; }

# react-native-video v6 uses Media3/ExoPlayer internally
-keep class androidx.media3.** { *; }
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn androidx.media3.**
-dontwarn com.google.android.exoplayer2.**

# ── 8. OKHTTP / OKIO (used by React Native networking) ───────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ── 9. MISC ───────────────────────────────────────────────────────────────────
-dontnote **
-ignorewarnings
