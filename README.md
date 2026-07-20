# Velaud Recorder

Gerçek, çalışan üretim kalitesinde Android ekran kaydedici uygulaması. XRecorder tarzı, sade ve reklamı abartmayan bir alternatif.

## Özellikler

- 📹 **Ekran Kaydı** — MediaProjection API + MediaRecorder, Foreground Service
- 🎤 **Ses Kaydı** — Mikrofon ile birlikte kayıt
- 🎛️ **Kayan Panel** — Kayıt sırasında sürüklenebilir overlay kontrol paneli
- 📁 **Galeri** — Kaydedilen videolar, thumbnail önizleme, oynat/paylaş/sil
- ⚙️ **Ayarlar** — Çözünürlük (720p/1080p/cihaz), FPS (30/60), ses, dokunma göstergesi
- 📢 **AdMob** — Test banner reklamı (test ID ile)
- 🔒 **Gizlilik** — Tüm veriler cihazda, internet gerektirmez

## Teknik Stack

- **React Native** 0.74.x (bare workflow, Expo yok)
- **Kotlin** — native modüller
- **Android MediaProjection API** — ekran kaydı
- **Foreground Service** — arka planda kayıt
- **WindowManager overlay** — kayan panel (Auto Clicker benzeri)
- **MediaStore** — scoped storage (Android 10+)
- **React Navigation** — bottom tabs + stack
- **AdMob** — Google Mobile Ads SDK

## Paket Adı

`com.recvelaud.android`

## Build

### Gereksinimler
- JDK 17
- Android SDK (compileSdk 35, minSdk 24)
- Gradle 8.6
- Node.js 20+

### Yerel Build

```bash
npm install
cd android && ./gradlew assembleDebug
```

### Release Build (ADIM A — Gradle splits)

```bash
cd android && ./gradlew assembleRelease
```

### Release Build (ADIM B — AAB + bundletool)

```bash
cd android && ./gradlew bundleRelease
bundletool build-apks --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=app-release.apks --mode=universal
```

## GitHub Actions

Push yapıldığında otomatik olarak:
1. ADIM A: `assembleRelease` → ABI/density split APK'ları
2. ADIM B: `bundleRelease` → `.aab` + bundletool ile `base.apk` ve `split_config.*.apk`
3. Debug APK
4. Tüm çıktılar Artifacts olarak yüklenir

## Klasör Yapısı

```
velaud-recorder/
├── src/
│   ├── App.tsx
│   ├── navigation/AppNavigator.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx      — Ana kayıt ekranı
│   │   ├── VideosScreen.tsx    — Kaydedilen videolar galerisi
│   │   └── SettingsScreen.tsx  — Ayarlar
│   ├── modules/
│   │   ├── RecorderModule.ts   — Native bridge (JS tarafı)
│   │   ├── VideoLibraryModule.ts
│   │   └── SettingsManager.ts
│   └── theme/colors.ts
├── android/
│   └── app/src/main/java/com/recvelaud/android/
│       ├── MainActivity.kt
│       ├── MainApplication.kt
│       ├── services/
│       │   └── ScreenRecordService.kt  — Foreground Service + MediaProjection
│       └── modules/
│           ├── RecorderModule.kt       — Native module (kayıt başlat/durdur/duraklat)
│           ├── FloatingPanelModule.kt  — WindowManager overlay panel
│           └── VideoLibraryModule.kt  — MediaStore sorgu + thumbnail
└── .github/workflows/build.yml         — CI/CD
```
