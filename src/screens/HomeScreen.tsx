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
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {
  Recorder,
  FloatingPanel,
  RecordingStatus,
  RecordingConfig,
} from '../modules/RecorderModule';
import {SettingsManager, AppSettings} from '../modules/SettingsManager';
import {RootStackParamList} from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const {width: W} = Dimensions.get('window');

// ─── Helpers ───────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
};

// ─── Radar Ring — single animated ring ────────────────────────────────────
function RadarRing({
  delay,
  active,
  color,
}: {
  delay: number;
  active: boolean;
  color: string;
}) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (active) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 1600,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(opacity, {
                toValue: 0.5,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 1400,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      );
      loop.start();
    } else {
      scale.setValue(0.4);
      opacity.setValue(0);
    }
    return () => loop?.stop();
  }, [active, delay, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.radarRing,
        {
          borderColor: color,
          transform: [{scale}],
          opacity,
        },
      ]}
    />
  );
}

// ─── Feature Chip ──────────────────────────────────────────────────────────
function Chip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress}>
      <Icon
        name={icon}
        size={14}
        color={active ? Colors.primary : Colors.textMuted}
      />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────
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

  // Button press scale animation
  const btnScale = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const breatheLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Load settings ──────────────────────────────────────────────────────
  useEffect(() => {
    SettingsManager.load().then(setSettings);
  }, []);

  // ── Event subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const statusSub = Recorder.onRecordingStatus(s => setStatus(s));

    const savedSub = Recorder.onRecordingSaved((filePath: string) => {
      if (filePath) {
        navigation.navigate('RecordingPreview', {filePath});
      } else {
        ToastAndroid.show('Kayıt tamamlandı', ToastAndroid.SHORT);
      }
    });

    const errorSub = Recorder.onRecordingError((err: string) => {
      Alert.alert('Kayıt Hatası', err, [{text: 'Tamam'}]);
    });

    return () => {
      statusSub.remove();
      savedSub.remove();
      errorSub.remove();
    };
  }, [navigation]);

  // ── Breathing animation for idle button ───────────────────────────────
  useEffect(() => {
    if (!status.isRecording) {
      breatheLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1.04,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      breatheLoop.current.start();
    } else {
      breatheLoop.current?.stop();
      breathe.setValue(1);
    }
    return () => breatheLoop.current?.stop();
  }, [status.isRecording, breathe]);

  // ── Press animation ────────────────────────────────────────────────────
  const onPressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

  // ── Recording actions ──────────────────────────────────────────────────
  const handleMain = useCallback(async () => {
    if (status.isRecording) {
      await handleStop();
    } else {
      await handleStart();
    }
  }, [status.isRecording]);

  const handleStart = async () => {
    try {
      const overlayOk = await FloatingPanel.checkOverlayPermission();
      if (!overlayOk) {
        Alert.alert(
          'Ekran Üstü İzni',
          'Kayıt sırasında kayan kontrol paneli için "Diğer uygulamaların üzerinde göster" iznini verin.',
          [
            {
              text: 'Ayarlara Git',
              onPress: () => FloatingPanel.requestOverlayPermission(),
            },
            {text: 'Vazgeç', style: 'cancel'},
          ],
        );
        return;
      }

      if (settings.includeAudio) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Mikrofon İzni',
            message: 'Ses kaydı için mikrofon gerekli.',
            buttonPositive: 'Ver',
            buttonNegative: 'Reddet',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          ToastAndroid.show('Ses devre dışı bırakıldı', ToastAndroid.SHORT);
        }
      }

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
        Alert.alert('Başlatılamadı', 'Ekran kaydı izni reddedildi.');
        return;
      }

      FloatingPanel.showPanel().catch(() => {});
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Bilinmeyen bir hata oluştu.');
    }
  };

  const handleStop = async () => {
    try {
      await Recorder.stopRecording();
      await FloatingPanel.hidePanel();
    } catch {}
  };

  const handlePause = useCallback(async () => {
    try {
      if (status.isPaused) {
        await Recorder.resumeRecording();
      } else {
        await Recorder.pauseRecording();
      }
    } catch {}
  }, [status.isPaused]);

  // ── Quick-toggle chip handlers ──────────────────────────────────────────
  const toggleAudio = useCallback(async () => {
    const updated = {...settings, includeAudio: !settings.includeAudio};
    setSettings(updated);
    await SettingsManager.save({includeAudio: updated.includeAudio});
  }, [settings]);

  const toggleTouches = useCallback(async () => {
    const updated = {...settings, showTouches: !settings.showTouches};
    setSettings(updated);
    await SettingsManager.save({showTouches: updated.showTouches});
  }, [settings]);

  const goToSettings = useCallback(() => {
    navigation.getParent()?.navigate('Ayarlar' as never);
  }, [navigation]);

  // ── Derived values ──────────────────────────────────────────────────────
  const resLabel = settings.resolution === 'device' ? 'Cihaz' : settings.resolution;
  const {isRecording, isPaused} = status;

  const ringColor = isPaused ? Colors.paused : Colors.recording;
  const btnBg = isRecording
    ? isPaused
      ? Colors.paused
      : Colors.recording
    : Colors.primary;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.logoMark}>
            <Icon name="record-circle" size={16} color={Colors.white} />
          </View>
          <Text style={styles.brandName}>Velaud</Text>
        </View>
        <View style={styles.headerActions}>
          {isRecording && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recBadgeText}>CANLI</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Feature chips ───────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.chipsScroll}>
        <Chip icon="quality-high" label={resLabel} onPress={goToSettings} />
        <Chip icon="filmstrip" label={`${settings.fps} FPS`} onPress={goToSettings} />
        <Chip
          icon={settings.includeAudio ? 'microphone' : 'microphone-off'}
          label={settings.includeAudio ? 'Ses Açık' : 'Sessiz'}
          active={settings.includeAudio}
          onPress={toggleAudio}
        />
        <Chip
          icon="gesture-tap"
          label="Dokunma"
          active={settings.showTouches}
          onPress={toggleTouches}
        />
      </ScrollView>

      {/* ── Center area ─────────────────────────────────────────────────── */}
      <View style={styles.center}>
        {/* Radar rings behind the button */}
        <View style={styles.ringsContainer}>
          <RadarRing delay={0}    active={isRecording && !isPaused} color={ringColor} />
          <RadarRing delay={500}  active={isRecording && !isPaused} color={ringColor} />
          <RadarRing delay={1000} active={isRecording && !isPaused} color={ringColor} />
        </View>

        {/* The central button disc */}
        <Animated.View
          style={[
            styles.discOuter,
            !isRecording && {transform: [{scale: breathe}]},
            isRecording && {
              borderColor: ringColor,
              borderWidth: 2.5,
            },
          ]}>
          <View style={[styles.discInner, {backgroundColor: btnBg}]}>
            <Icon
              name={isRecording ? 'stop' : 'record'}
              size={36}
              color={Colors.white}
            />
          </View>
        </Animated.View>

        {/* Status text below disc */}
        {isRecording ? (
          <View style={styles.statusBlock}>
            <Text style={[styles.timerText, {color: isPaused ? Colors.paused : Colors.white}]}>
              {fmtDuration(status.duration)}
            </Text>
            <Text style={styles.statusLabel}>
              {isPaused ? 'DURAKLATILDI' : 'KAYIT YAPILIYOR'}
            </Text>
          </View>
        ) : (
          <View style={styles.idleBlock}>
            <Text style={styles.idleTitle}>Ekranı Kaydet</Text>
            <Text style={styles.idleSub}>{resLabel} · {settings.fps} FPS · {settings.includeAudio ? 'Sesli' : 'Sessiz'}</Text>
          </View>
        )}
      </View>

      {/* ── Bottom action area ───────────────────────────────────────────── */}
      <View style={styles.bottomArea}>
        {/* Pause / Resume row — only during recording */}
        {isRecording && (
          <TouchableOpacity
            style={[styles.pauseRow, isPaused && styles.pauseRowResume]}
            onPress={handlePause}
            activeOpacity={0.75}>
            <Icon
              name={isPaused ? 'play' : 'pause'}
              size={18}
              color={isPaused ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.pauseRowText, isPaused && {color: Colors.success}]}>
              {isPaused ? 'Devam Et' : 'Duraklat'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Main CTA pill (XRecorder-style) */}
        <Animated.View style={{transform: [{scale: btnScale}]}}>
          <TouchableOpacity
            style={[
              styles.ctaButton,
              {backgroundColor: btnBg},
            ]}
            onPress={handleMain}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}>
            <Icon
              name={isRecording ? 'stop-circle-outline' : 'record-circle-outline'}
              size={22}
              color={Colors.white}
              style={styles.ctaIcon}
            />
            <Text style={styles.ctaText}>
              {isRecording ? 'Kaydı Durdur' : 'Kaydı Başlat'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const DISC = 148;
const RING_SIZE = DISC + 80;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.chipActiveBorder,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.recording,
  },
  recBadgeText: {
    color: Colors.recording,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // Feature chips
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.chip,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.chipBorder,
  },
  chipActive: {
    backgroundColor: Colors.chipActive,
    borderColor: Colors.chipActiveBorder,
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.primary,
  },

  // Center
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsContainer: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.recording,
  },
  discOuter: {
    width: DISC + 24,
    height: DISC + 24,
    borderRadius: (DISC + 24) / 2,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  discInner: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Elevation/shadow for premium look
    elevation: 24,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },

  // Status blocks
  statusBlock: {
    marginTop: 32,
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    color: Colors.white,
  },
  statusLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  idleBlock: {
    marginTop: 32,
    alignItems: 'center',
    gap: 6,
  },
  idleTitle: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  idleSub: {
    color: Colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // Bottom area
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pauseRowResume: {
    borderColor: Colors.successMuted,
    backgroundColor: Colors.successMuted,
  },
  pauseRowText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    width: W - 40,
    elevation: 12,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  ctaIcon: {},
  ctaText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
