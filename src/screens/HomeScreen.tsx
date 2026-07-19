import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {Colors} from '../theme/colors';
import {Recorder, FloatingPanel, RecordingStatus, RecordingConfig} from '../modules/RecorderModule';
import {SettingsManager, AppSettings} from '../modules/SettingsManager';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
};

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const [status, setStatus] = useState<RecordingStatus>({
    isRecording: false,
    isPaused: false,
    duration: 0,
  });
  const [settings, setSettings] = useState<AppSettings>({
    resolution: '1080p',
    fps: 30,
    includeAudio: true,
    showTouches: false,
    saveFolder: 'Movies/VelaudRecorder',
  });
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    SettingsManager.load().then(setSettings);

    const statusSub = Recorder.onRecordingStatus(s => setStatus(s));
    const savedSub = Recorder.onRecordingSaved(filePath => {
      ToastAndroid.show('Video kaydedildi!', ToastAndroid.SHORT);
    });
    const errorSub = Recorder.onRecordingError(err => {
      Alert.alert('Kayıt Hatası', err);
    });

    return () => {
      statusSub.remove();
      savedSub.remove();
      errorSub.remove();
    };
  }, []);

  useEffect(() => {
    if (status.isRecording && !status.isPaused) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.15, duration: 700, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 700, useNativeDriver: true}),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoop.current?.stop();
    };
  }, [status.isRecording, status.isPaused]);

  const requestAudioPermission = async (): Promise<boolean> => {
    if (!settings.includeAudio) return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Mikrofon İzni',
        message: 'Ses kayıt için mikrofon izni gerekli.',
        buttonPositive: 'İzin Ver',
        buttonNegative: 'Reddet',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleStartRecording = useCallback(async () => {
    try {
      // 1. Check overlay permission for floating panel
      const overlayOk = await FloatingPanel.checkOverlayPermission();
      if (!overlayOk) {
        Alert.alert(
          'Gerekli İzin',
          'Kayıt sırasında ekran üzerinde kontrol paneli göstermek için "Diğer uygulamaların üzerinde göster" iznine ihtiyaç var.\n\nBu izin olmadan kayıt yapamaz ve kontrolleri göremezsiniz.',
          [
            {
              text: 'Ayarlara Git',
              onPress: async () => {
                await FloatingPanel.requestOverlayPermission();
                ToastAndroid.show(
                  'Lütfen izni verin ve geri gelin',
                  ToastAndroid.LONG,
                );
              },
            },
            {text: 'İptal', style: 'cancel'},
          ],
        );
        return;
      }

      // 2. Audio permission
      if (settings.includeAudio) {
        const audioOk = await requestAudioPermission();
        if (!audioOk) {
          ToastAndroid.show('Ses kaydı devre dışı bırakıldı.', ToastAndroid.SHORT);
        }
      }

      // 3. Start recording (shows MediaProjection dialog natively)
      const dims = SettingsManager.getResolutionDimensions(settings.resolution);
      const config: RecordingConfig = {
        width: dims.width || undefined,
        height: dims.height || undefined,
        fps: settings.fps,
        includeAudio: settings.includeAudio,
        showTouches: settings.showTouches,
      };

      const started = await Recorder.startRecording(config);
      if (!started) {
        Alert.alert(
          'Kayıt Başlatılamadı',
          'Ekran kaydı izni reddedildi. Kayıt yapmak için izin vermeniz gerekiyor.',
        );
        return;
      }

      // 4. Show floating panel
      await FloatingPanel.showPanel();
      ToastAndroid.show('Kayıt başladı!', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error('Recording start error:', e);
      Alert.alert('Kayıt Hatası', e?.message ?? 'Bilinmeyen bir hata oluştu.');
    }
  }, [settings]);

  const handleStopRecording = useCallback(async () => {
    await Recorder.stopRecording();
    await FloatingPanel.hidePanel();
  }, []);

  const handlePauseResume = useCallback(async () => {
    if (status.isPaused) {
      await Recorder.resumeRecording();
    } else {
      await Recorder.pauseRecording();
    }
  }, [status.isPaused]);

  const resolutionLabel =
    settings.resolution === 'device' ? 'Cihaz Çözünürlüğü' : settings.resolution;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Velaud Recorder</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <View style={styles.gearIcon} />
        </TouchableOpacity>
      </View>

      {/* Settings Summary */}
      <TouchableOpacity
        style={styles.settingsSummary}
        onPress={() => navigation.navigate('Settings')}>
        <View style={styles.settingChip}>
          <Text style={styles.settingChipText}>{resolutionLabel}</Text>
        </View>
        <View style={styles.settingChip}>
          <Text style={styles.settingChipText}>{settings.fps} FPS</Text>
        </View>
        <View style={styles.settingChip}>
          <View style={[styles.dot, {backgroundColor: settings.includeAudio ? Colors.success : Colors.error}]} />
          <Text style={styles.settingChipText}>{settings.includeAudio ? 'Ses Açık' : 'Sessiz'}</Text>
        </View>
      </TouchableOpacity>

      {/* Main Recording Button Area */}
      <View style={styles.centerArea}>
        {status.isRecording && (
          <Text style={[styles.duration, {color: status.isPaused ? Colors.paused : Colors.recording}]}>
            {formatDuration(status.duration)}
          </Text>
        )}
        {status.isRecording && (
          <Text style={styles.statusLabel}>
            {status.isPaused ? '⏸  DURAKLATILDI' : '⏺  KAYIT YAPILIYOR'}
          </Text>
        )}

        {/* Big Record Button */}
        <Animated.View style={[styles.buttonRing, {transform: [{scale: pulseAnim}]}]}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              status.isRecording && !status.isPaused && styles.recordButtonActive,
              status.isPaused && styles.recordButtonPaused,
            ]}
            onPress={status.isRecording ? handleStopRecording : handleStartRecording}
            activeOpacity={0.85}>
            <View style={styles.recordButtonInner}>
              {status.isRecording ? (
                <View style={styles.stopSquare} />
              ) : (
                <>
                  <View style={styles.cameraBody} />
                  <View style={styles.cameraLens}>
                    <View style={styles.cameraLensInner} />
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.recordLabel}>
          {status.isRecording ? 'Kaydı Bitir' : 'Kaydı Başlat'}
        </Text>

        {/* Pause/Resume only when recording */}
        {status.isRecording && (
          <TouchableOpacity style={styles.pauseBtn} onPress={handlePauseResume}>
            <Text style={styles.pauseBtnText}>
              {status.isPaused ? '▶  Devam Et' : '⏸  Duraklat'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* AdMob Banner Placeholder */}
      <View style={styles.adBanner}>
        <Text style={styles.adText}>Reklam</Text>
        {/* AdMob BannerAd goes here */}
      </View>

      {/* Build info — small, unobtrusive, helps identify which APK is installed */}
      <Text style={styles.buildInfo}>v1.0.2 (build 3)</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    padding: 4,
  },
  gearIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
  },
  settingsSummary: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  settingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  settingChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  duration: {
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
  },
  buttonRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  recordButtonActive: {
    backgroundColor: Colors.primaryDark,
    shadowColor: Colors.primaryDark,
  },
  recordButtonPaused: {
    backgroundColor: Colors.warning,
    shadowColor: Colors.warning,
  },
  recordButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 60,
    height: 50,
  },
  cameraBody: {
    width: 40,
    height: 30,
    backgroundColor: Colors.white,
    borderRadius: 6,
    position: 'absolute',
    left: 0,
  },
  cameraLens: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
    position: 'absolute',
    right: 0,
    top: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLensInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.recording,
  },
  stopSquare: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: Colors.white,
  },
  recordLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  pauseBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pauseBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  adBanner: {
    height: 52,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  buildInfo: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    paddingBottom: 4,
    opacity: 0.5,
  },
});
