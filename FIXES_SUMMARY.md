# Velaud Recorder - Bug Fixes & Improvements Summary

## Date: July 20, 2026 (v2.3.1, build 16)

### **Critical Bugs Fixed:**

#### 1. **Floating button icon — Velaud app icon instead of ugly red circle** ✅
- **Problem**: The "display over other apps" floating button used an ugly red circle with a camera emoji. It looked unprofessional.
- **Fix**: Replaced the red circle with the actual Velaud app icon (`ic_launcher_foreground`) rendered inside a dark circular container with a subtle pulsing blue ring. The icon is clipped to an oval so it looks clean at any position.

#### 2. **Inverted drag direction on floating button** ✅
- **Problem**: Dragging the floating button right moved it left; dragging down moved it up. Every axis was inverted, making it nearly impossible to position.
- **Root Cause**: The X axis used `params.x - dx` (subtraction) instead of `params.x + dx`, and the Y axis had the same inversion.
- **Fix**: Both axes now use `params.x + dx` and `params.y + dy` so the button follows the finger exactly. Verified for all 8 directions (left, right, up, down, and all four diagonals).

#### 3. **Floating button escaping off-screen / disappearing into infinity** ✅
- **Problem**: The button could be dragged past the screen edges into the system notification area or off-screen entirely. After closing from the notification and reopening the app, the button would start off-screen and be invisible.
- **Fix**:
  - Added `clampPosition()` that restricts X/Y to `[0, screenWidth - buttonSize]` and `[0, screenHeight - buttonSize]` using real `DisplayMetrics`.
  - On show, the panel validates its saved position and clamps it into bounds.
  - Position is persisted in `SharedPreferences` so the button reappears in the same valid spot after restart.

#### 4. **Video recorded at PC/desktop aspect ratio instead of phone screen size** ✅
- **Problem**: Screen recordings came out at 1920x1080 (16:9 desktop aspect) even on portrait phones, producing desktop-sized videos.
- **Root Cause**: `ScreenRecordService` defaulted `EXTRA_WIDTH`/`EXTRA_HEIGHT` to 1920/1080 when the caller passed 0.
- **Fix**:
  - Default resolution changed from `1080p` to `device` in `SettingsManager` and both `HomeScreen` and `SettingsScreen`.
  - `ScreenRecordService` now reads `resources.displayMetrics.widthPixels`/`heightPixels` as the fallback, so recordings match the actual phone display.
  - `RecorderModule` already passes 0 for `device` mode; the service now honors it.

#### 5. **No countdown before recording starts** ✅
- **Problem**: Recording began instantly when the user pressed start, with no visual cue.
- **Fix**: Added a 3-second countdown overlay (`showCountdownOverlay`) that covers the screen with a semi-transparent blue (app brand color) layer and shows a large animated "3 → 2 → 1" number with the label "Kayıt başlıyor…". `MediaRecorder.start()` is only called after the countdown completes.

#### 6. **Floating menu redesign — XRecorder-style clean layout** ✅
- **Problem**: The expanded floating menu had buttons stacked/overlapping ("hepsi iç içe girmiş"), making it hard to tap the right one.
- **Fix**: Completely rebuilt the expanded panel:
  - Clean vertical layout: duration timer on top, single horizontal row of evenly-spaced circular buttons below.
  - Each button (Durdur / Duraklat-Devam / Uygulama / Kapat) is a separate labeled circle with consistent 48dp size and 16dp gaps — no overlap.
  - Dark rounded panel background with subtle border for readability over any app.

### **Files Modified:**

1. `android/app/src/main/java/com/recvelaud/android/modules/FloatingPanelModule.kt` — icon, drag fix, bounds clamping, position persistence, panel redesign
2. `android/app/src/main/java/com/recvelaud/android/services/ScreenRecordService.kt` — device-resolution fallback, 3-second countdown overlay
3. `android/app/src/main/java/com/recvelaud/android/modules/RecorderModule.kt` — (unchanged; already passes 0 for device mode)
4. `src/modules/SettingsManager.ts` — default resolution `device`
5. `src/screens/HomeScreen.tsx` — default settings `device`
6. `src/screens/SettingsScreen.tsx` — default settings `device`
7. `android/app/build.gradle` — version 2.3.1, build 16

### **Testing Recommendations:**

1. **Drag test**: Drag the floating button in all 8 directions — it should follow the finger and never leave the screen.
2. **Restart test**: Drag to a position, close from notification, reopen — button should appear in the same valid spot.
3. **Resolution test**: Record a video on a phone and confirm the output matches the phone's screen aspect ratio.
4. **Countdown test**: Start recording — a blue 3-2-1 overlay should appear before recording begins.
5. **Menu test**: Tap the floating button — a clean row of labeled buttons should appear with no overlap.
