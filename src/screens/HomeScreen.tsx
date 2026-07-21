import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  PermissionsAndroid,
  ToastAndroid,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {
  Recorder,
  FloatingPanel,
  PreviewOverlay,
  RecordingStatus,
  RecordingConfig,
} from '../modules/RecorderModule';
import {SettingsManager, AppSettings} from '../modules/SettingsManager';
import i18n from '../modules/i18n';
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

// ─── Single Pulse Ring — minimal, smooth ───────────────────────────────────
function PulseRing({active, color}: {active: boolean; color: string}) {
  const scale = useRef(new Animated.Value(0.55)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (active) {
      loop = Animated.loop(
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.45,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      loop.start();
    } else {
      scale.setValue(0.55);
      opacity.setValue(0);
    }
    return () => loop?.stop();
  }, [active, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
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
        size={13}
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
    audioSource: 'microphone',
    volume: 100,
    noiseReduction: false,
    countdown: '3s',
    hidePostRecordingPopup: false,
    showTouches: false,
    shakeToStop: false,
    shakeSensitivity: 50,
    saveFolder: 'Movies/VelaudRecorder',
    trashEnabled: true,
    language: 'system',
  });

  const btnScale = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const breatheLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    SettingsManager.load().then(s => {
      setSettings(s);
      i18n.init(s.language);
    });
  }, []);

  // Reload settings when returning from Settings screen (fixes FPS/resolution sync)
  useFocusEffect(
    useCallback(() => {
      SettingsManager.load().then(setSettings);
    }, []),
  );

  useEffect(() => {
    const statusSub = Recorder.onRecordingStatus(s => setStatus(s));

    const savedSub = Recorder.onRecordingSaved((filePath: string) => {
      if (filePath) {
        PreviewOverlay.showPreview(filePath).catch(() => {
          navigation.navigate('RecordingPreview', {filePath});
        });
      } else {
        ToastAndroid.show(i18n.t('home.saved'), ToastAndroid.SHORT);
      }
    });

    const errorSub = Recorder.onRecordingError((err: string) => {
      Alert.alert(i18n.t('home.recError'), err, [{text: 'OK'}]);
    });

    return () => {
      statusSub.remove();
      savedSub.remove();
      errorSub.remove();
    };
  }, [navigation]);

  useEffect(() => {
    if (!status.isRecording) {
      breatheLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1.035,
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 1,
            duration: 2400,
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

  const onPressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

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
          i18n.t('home.overlayTitle'),
          i18n.t('home.overlayMsg'),
          [
            {
              text: i18n.t('home.overlayGoSettings'),
              onPress: () => FloatingPanel.requestOverlayPermission(),
            },
            {text: i18n.t('home.overlayCancel'), style: 'cancel'},
          ],
        );
        return;
      }

      const hasAudio = settings.audioSource !== 'none';
      if (hasAudio) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: i18n.t('home.audioPermissionTitle'),
            message: i18n.t('home.audioPermissionMsg'),
            buttonPositive: i18n.t('home.audioPermissionGrant'),
            buttonNegative: i18n.t('home.audioPermissionDeny'),
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          ToastAndroid.show(i18n.t('home.audioDisabled'), ToastAndroid.SHORT);
        }
      }

      const dims = SettingsManager.getResolutionDimensions(settings.resolution);
      const config: RecordingConfig = {
        width: dims.width || undefined,
        height: dims.height || undefined,
        fps: settings.fps,
        includeAudio: hasAudio,
        audioSource: settings.audioSource,
        showTouches: settings.showTouches,
      };

      const started = await Recorder.startRecording(config);
      if (!started) {
        Alert.alert(i18n.t('home.startFailed'), i18n.t('home.startFailedMsg'));
        return;
      }

      FloatingPanel.showPanel().catch(() => {});
    } catch (e: any) {
      Alert.alert(i18n.t('home.error'), e?.message ?? i18n.t('home.unknownError'));
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

  const toggleAudio = useCallback(async () => {
    const next = settings.audioSource === 'none' ? 'microphone' : 'none';
    setSettings({...settings, audioSource: next});
    await SettingsManager.save({audioSource: next});
  }, [settings]);

  const toggleTouches = useCallback(async () => {
    const updated = {...settings, showTouches: !settings.showTouches};
    setSettings(updated);
    await SettingsManager.save({showTouches: updated.showTouches});
  }, [settings]);

  const goToSettings = useCallback(() => {
    navigation.getParent()?.navigate('Ayarlar' as never);
  }, [navigation]);

  const resLabel = settings.resolution.toUpperCase();
  const hasAudio = settings.audioSource !== 'none';
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
          <Image
            source={require('../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png')}
            style={styles.logoMark}
          />
          <Text style={styles.brandName}>{i18n.t('home.brand')}</Text>
        </View>
        <View style={styles.headerActions}>
          {isRecording && (
            <View style={styles.recBadge}>
              <View style={[styles.recDot, isPaused && {backgroundColor: Colors.paused}]} />
              <Text style={[styles.recBadgeText, isPaused && {color: Colors.paused}]}>
                {isPaused ? i18n.t('home.paused') : i18n.t('home.live')}
              </Text>
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
          icon={hasAudio ? 'microphone' : 'microphone-off'}
          label={hasAudio ? i18n.t('home.audioOn') : i18n.t('home.audioOff')}
          active={hasAudio}
          onPress={toggleAudio}
        />
        <Chip
          icon="gesture-tap"
          label={i18n.t('home.touches')}
          active={settings.showTouches}
          onPress={toggleTouches}
        />
      </ScrollView>

      {/* ── Center area ─────────────────────────────────────────────────── */}
      <View style={styles.center}>
        <View style={styles.ringsContainer}>
          <PulseRing active={isRecording && !isPaused} color={ringColor} />
        </View>

        <Animated.View
          style={[
            styles.discOuter,
            !isRecording && {transform: [{scale: breathe}]},
            isRecording && {
              borderColor: ringColor,
              borderWidth: 2,
            },
          ]}>
          <View style={[styles.discInner, {backgroundColor: btnBg}]}>
            <Icon
              name={isRecording ? 'stop' : 'video'}
              size={42}
              color={Colors.white}
            />
          </View>
        </Animated.View>

        {isRecording ? (
          <View style={styles.statusBlock}>
            <Text style={[styles.timerText, {color: isPaused ? Colors.paused : Colors.white}]}>
              {fmtDuration(status.duration)}
            </Text>
            <Text style={styles.statusLabel}>
              {isPaused ? i18n.t('home.paused') : i18n.t('home.recording')}
            </Text>
          </View>
        ) : (
          <View style={styles.idleBlock}>
            <Text style={styles.idleTitle}>{i18n.t('home.startRecording')}</Text>
            <Text style={styles.idleSub}>{resLabel} · {settings.fps} FPS · {hasAudio ? i18n.t('home.audioOnShort') : i18n.t('home.audioOffShort')}</Text>
          </View>
        )}
      </View>

      {/* ── Bottom action area ───────────────────────────────────────────── */}
      <View style={styles.bottomArea}>
        {isRecording && (
          <TouchableOpacity
            style={[styles.pauseRow, isPaused && styles.pauseRowResume]}
            onPress={handlePause}
            activeOpacity={0.75}>
            <Icon
              name={isPaused ? 'play' : 'pause'}
              size={17}
              color={isPaused ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.pauseRowText, isPaused && {color: Colors.success}]}>
              {isPaused ? i18n.t('home.resume') : i18n.t('home.pause')}
            </Text>
          </TouchableOpacity>
        )}

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
              name={isRecording ? 'stop' : 'video'}
              size={22}
              color={Colors.white}
              style={styles.ctaIcon}
            />
            <Text style={styles.ctaText}>
              {isRecording ? i18n.t('home.stopButton') : i18n.t('home.startButton')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const DISC = 148;
const RING_SIZE = DISC + 64;

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
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandName: {
    color: Colors.white,
    fontSize: 21,
    fontWeight: '700',
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
    backgroundColor: Colors.errorMuted,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.30)',
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.recording,
  },
  recBadgeText: {
    color: Colors.recording,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Feature chips
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
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
    fontSize: 11,
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
  pulseRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.recording,
  },
  discOuter: {
    width: DISC + 20,
    height: DISC + 20,
    borderRadius: (DISC + 20) / 2,
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
    elevation: 10,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },

  // Status blocks
  statusBlock: {
    marginTop: 30,
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 44,
    fontWeight: '300',
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
    color: Colors.white,
  },
  statusLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  idleBlock: {
    marginTop: 30,
    alignItems: 'center',
    gap: 6,
  },
  idleTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  idleSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Bottom area
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
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
    paddingVertical: 17,
    borderRadius: 16,
    width: W - 40,
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  ctaIcon: {},
  ctaText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
