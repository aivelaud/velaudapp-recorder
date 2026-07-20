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
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {Colors} from '../theme/colors';
import {Recorder, FloatingPanel, RecordingStatus, RecordingConfig} from '../modules/RecorderModule';
import {SettingsManager, AppSettings} from '../modules/SettingsManager';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');

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
  const [permissionChecked, setPermissionChecked] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    SettingsManager.load().then(setSettings);

    const statusSub = Recorder.onRecordingStatus(s => setStatus(s));
    const savedSub = Recorder.onRecordingSaved(_filePath => {
      ToastAndroid.show('✅ Video başarıyla kaydedildi!', ToastAndroid.SHORT);
    });
    const errorSub = Recorder.onRecordingError(err => {
      Alert.alert('Kayıt Hatası', err);
    });

    // Check overlay permission on mount
    FloatingPanel.checkOverlayPermission().then(granted => {
      setPermissionChecked(true);
      if (!granted) {
        // Show a non-blocking toast
        ToastAndroid.show(
          'Ekran üstü izni gerekli - Ayarlardan verin',
          ToastAndroid.LONG,
        );
      }
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
          Animated.timing(pulseAnim, {toValue: 1.08, duration: 800, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 800, useNativeDriver: true}),
        ]),
      );
      pulseLoop.current.start();

      glowLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {toValue: 1, duration: 1000, useNativeDriver: true}),
          Animated.timing(glowAnim, {toValue: 0.4, duration: 1000, useNativeDriver: true}),
        ]),
      );
      glowLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      glowLoop.current?.stop();
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
    return () => {
      pulseLoop.current?.stop();
      glowLoop.current?.stop();
    };
  }, [status.isRecording, status.isPaused]);

  const requestAudioPermission = async (): Promise<boolean> => {
    if (!settings.includeAudio) return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Mikrofon İzni',
        message: 'Ses kaydı için mikrofon erişimi gereklidir.',
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
          'Ekran Üstü İzni Gerekli',
          'Kayıt sırasında kontrol panelini göstermek için "Diğer uygulamaların üzerinde göster" iznini vermeniz gerekiyor.\n\nBu izin olmadan kayıt başlatılamaz.',
          [
            {
              text: 'Ayarlara Git',
              onPress: async () => {
                await FloatingPanel.requestOverlayPermission();
                ToastAndroid.show(
                  'İzni verdikten sonra geri dönün',
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

      // 3. Start recording
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
          'Ekran kaydı izni reddedildi veya başka bir hata oluştu.',
        );
        return;
      }

      // 4. Show floating panel (non-blocking)
      try {
        await FloatingPanel.showPanel();
      } catch (panelErr: any) {
        console.warn('Floating panel error:', panelErr);
        ToastAndroid.show(
          'Kayıt başladı! Durdurmak için bildirim çubuğunu kullanın.',
          ToastAndroid.LONG,
        );
      }
      ToastAndroid.show('🔴 Kayıt başladı!', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error('Recording start error:', e);
      Alert.alert('Hata', e?.message ?? 'Bilinmeyen bir hata oluştu.');
    }
  }, [settings]);

  const handleStopRecording = useCallback(async () => {
    try {
      await Recorder.stopRecording();
      await FloatingPanel.hidePanel();
      ToastAndroid.show('⏹ Kayıt durduruldu', ToastAndroid.SHORT);
    } catch (e: any) {
      console.error('Stop recording error:', e);
    }
  }, []);

  const handlePauseResume = useCallback(async () => {
    try {
      if (status.isPaused) {
        await Recorder.resumeRecording();
        ToastAndroid.show('▶ Kayıt devam ediyor', ToastAndroid.SHORT);
      } else {
        await Recorder.pauseRecording();
        ToastAndroid.show('⏸ Kayıt duraklatıldı', ToastAndroid.SHORT);
      }
    } catch (e: any) {
      console.error('Pause/Resume error:', e);
    }
  }, [status.isPaused]);

  const resolutionLabel =
    settings.resolution === 'device' ? 'Cihaz' : settings.resolution;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.headerTitle}>Velaud</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Settings Chips */}
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.chipText}>📐 {resolutionLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.chipText}>🎬 {settings.fps} FPS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, settings.includeAudio ? styles.chipActive : styles.chipInactive]}
          onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.chipText}>
            {settings.includeAudio ? '🎙️ Ses Açık' : '🔇 Sessiz'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.centerArea}>
        {/* Duration Display */}
        {status.isRecording && (
          <View style={styles.durationContainer}>
            <View style={[
              styles.statusDot,
              {backgroundColor: status.isPaused ? Colors.paused : Colors.recording},
            ]} />
            <Text style={[
              styles.duration,
              {color: status.isPaused ? Colors.paused : Colors.recording},
            ]}>
              {formatDuration(status.duration)}
            </Text>
          </View>
        )}

        {status.isRecording && (
          <Text style={styles.statusLabel}>
            {status.isPaused ? 'DURAKLATILDI' : 'KAYIT YAPILIYOR'}
          </Text>
        )}

        {!status.isRecording && (
          <Text style={styles.readyText}>Kayda Hazır</Text>
        )}

        {/* Main Record Button */}
        <View style={styles.buttonContainer}>
          {status.isRecording && (
            <Animated.View style={[
              styles.glowRing,
              {
                opacity: glowAnim,
                borderColor: status.isPaused ? Colors.paused : Colors.recording,
              },
            ]} />
          )}
          <Animated.View style={[
            styles.buttonOuter,
            {transform: [{scale: pulseAnim}]},
            status.isRecording && !status.isPaused && styles.buttonOuterRecording,
            status.isPaused && styles.buttonOuterPaused,
          ]}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                status.isRecording && !status.isPaused && styles.recordButtonActive,
                status.isPaused && styles.recordButtonPaused,
              ]}
              onPress={status.isRecording ? handleStopRecording : handleStartRecording}
              activeOpacity={0.8}>
              {status.isRecording ? (
                <View style={styles.stopIcon} />
              ) : (
                <View style={styles.recordIcon} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.buttonLabel}>
          {status.isRecording ? 'Kaydı Durdur' : 'Kaydı Başlat'}
        </Text>

        {/* Pause/Resume Button */}
        {status.isRecording && (
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              status.isPaused && styles.secondaryBtnResume,
            ]}
            onPress={handlePauseResume}
            activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>
              {status.isPaused ? '▶  Devam Et' : '⏸  Duraklat'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Info */}
      <View style={styles.bottomBar}>
        <Text style={styles.versionText}>Velaud Recorder v2.0.0</Text>
      </View>
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
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  chipInactive: {
    borderColor: Colors.border,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  duration: {
    fontSize: 52,
    fontWeight: '200',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 32,
  },
  readyText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 32,
    letterSpacing: 1,
  },
  buttonContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
  },
  buttonOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  buttonOuterRecording: {
    borderColor: Colors.recording,
  },
  buttonOuterPaused: {
    borderColor: Colors.paused,
  },
  recordButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 16,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  recordButtonActive: {
    backgroundColor: Colors.recording,
    shadowColor: Colors.recording,
  },
  recordButtonPaused: {
    backgroundColor: Colors.paused,
    shadowColor: Colors.paused,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
  },
  stopIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  buttonLabel: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  secondaryBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryBtnResume: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomBar: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: 11,
    opacity: 0.6,
  },
});