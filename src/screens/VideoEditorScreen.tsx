import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ToastAndroid,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TextInput,
  Modal,
  PanResponder,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
import {Colors} from '../theme/colors';
import {VideoEditor, VideoInfo} from '../modules/VideoEditorModule';
import {RootStackParamList} from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'VideoEditor'>;

const {width: W} = Dimensions.get('window');
const TIMELINE_W = W - 32;
const MIN_TRIM_MS = 500;

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${pad2(m)}:${pad2(s % 60)}`;
};

type AspectRatio = '9:16' | '1:1' | '16:9' | 'original';
type Quality = 'original' | '720p' | '1080p';
type FpsOption = 30 | 60;

const ASPECT_DIMS: Record<Exclude<AspectRatio, 'original'>, {w: number; h: number}> = {
  '9:16': {w: 9, h: 16},
  '1:1': {w: 1, h: 1},
  '16:9': {w: 16, h: 9},
};

export default function VideoEditorScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {filePath} = route.params;

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Trim
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);

  // Settings
  const [aspect, setAspect] = useState<AspectRatio>('original');
  const [quality, setQuality] = useState<Quality>('original');
  const [fps, setFps] = useState<FpsOption>(30);

  // Text overlay
  const [textOverlay, setTextOverlay] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [textDraft, setTextDraft] = useState('');

  // Scrubbing
  const [scrubbing, setScrubbing] = useState(false);
  const playerRef = useRef<any>(null);
  const playScale = useRef(new Animated.Value(1)).current;

  const uri = filePath.startsWith('content://') ? filePath : `file://${filePath}`;

  useEffect(() => {
    VideoEditor.getVideoInfo(filePath)
      .then((info) => {
        setVideoInfo(info);
        setEndMs(info.duration);
        setFps(info.fps >= 60 ? 60 : 30);
        setLoading(false);
      })
      .catch((e) => {
        Alert.alert('Hata', 'Video bilgileri yüklenemedi: ' + e?.message);
        setLoading(false);
      });
  }, [filePath]);

  // Seek when scrubbing
  useEffect(() => {
    if (!scrubbing && playerRef.current && currentTime >= 0) {
      try { playerRef.current.seek(currentTime / 1000); } catch {}
    }
  }, [scrubbing]);

  const handleExport = useCallback(async () => {
    if (!videoInfo) return;
    setExporting(true);
    setPaused(true);
    try {
      let outW = 0;
      let outH = 0;
      if (quality === '720p') {
        outW = 720; outH = 1280;
      } else if (quality === '1080p') {
        outW = 1080; outH = 1920;
      }
      if (aspect !== 'original' && aspect !== '16:9') {
        const d = ASPECT_DIMS[aspect];
        if (outW === 0) { outW = videoInfo.width; outH = videoInfo.height; }
        const ratio = d.w / d.h;
        if (outW / outH > ratio) { outW = Math.round(outH * ratio); }
        else { outH = Math.round(outW / ratio); }
      }

      const outputPath = await VideoEditor.exportVideo({
        filePath,
        startMs,
        endMs,
        width: outW,
        height: outH,
        fps,
        bitrate: 0,
        textOverlay: textOverlay,
      });

      await VideoEditor.saveToGallery(outputPath);
      ToastAndroid.show('Video galeriye kaydedildi!', ToastAndroid.LONG);
      navigation.navigate('Main');
    } catch (e: any) {
      Alert.alert('Dışa Aktarma Hatası', e?.message ?? 'Bilinmeyen hata');
    } finally {
      setExporting(false);
    }
  }, [videoInfo, filePath, startMs, endMs, quality, fps, textOverlay, aspect, navigation]);

  // ── Timeline scrub PanResponder ──────────────────────────────────────────
  const scrubPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        setScrubbing(true);
        setPaused(true);
        if (videoInfo) {
          const pos = Math.max(0, Math.min(gestureState.x0, TIMELINE_W));
          setCurrentTime((pos / TIMELINE_W) * videoInfo.duration);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (!videoInfo) return;
        const pos = Math.max(0, Math.min(gestureState.x0 + gestureState.dx, TIMELINE_W));
        setCurrentTime((pos / TIMELINE_W) * videoInfo.duration);
      },
      onPanResponderRelease: () => {
        setScrubbing(false);
        setPaused(false);
      },
    }),
  ).current;

  // ── Trim handle PanResponders ─────────────────────────────────────────────
  const startPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (!videoInfo) return;
        const pxToMs = videoInfo.duration / TIMELINE_W;
        const newStart = Math.max(0, Math.min(startMs + gs.dx * pxToMs, endMs - MIN_TRIM_MS));
        setStartMs(Math.round(newStart));
      },
    }),
  ).current;

  const endPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (!videoInfo) return;
        const pxToMs = videoInfo.duration / TIMELINE_W;
        const newEnd = Math.max(startMs + MIN_TRIM_MS, Math.min(endMs + gs.dx * pxToMs, videoInfo.duration));
        setEndMs(Math.round(newEnd));
      },
    }),
  ).current;

  const togglePlay = () => {
    Animated.sequence([
      Animated.timing(playScale, {toValue: 0.85, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.ease)}),
      Animated.spring(playScale, {toValue: 1, friction: 4, useNativeDriver: true}),
    ]).start();
    setPaused((p) => !p);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Video yükleniyor…</Text>
      </View>
    );
  }

  const duration = videoInfo?.duration || 0;
  const videoAspect = videoInfo ? videoInfo.width / videoInfo.height : 16 / 9;
  const previewAspect = aspect === 'original'
    ? videoAspect
    : ASPECT_DIMS[aspect as Exclude<AspectRatio, 'original'>].w / ASPECT_DIMS[aspect as Exclude<AspectRatio, 'original'>].h;
  const previewH = Math.min(W * 0.55, W / previewAspect);
  const trimPctStart = duration ? (startMs / duration) * 100 : 0;
  const trimPctEnd = duration ? (endMs / duration) * 100 : 100;
  const playPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Düzenle</Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.settingsPill} onPress={() => {}}>
            <Text style={styles.settingsPillText}>{fps}fps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsPill} onPress={() => {}}>
            <Text style={styles.settingsPillText}>{quality === 'original' ? 'Orijinal' : quality}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} bounces={false}>
        {/* ── Video Preview ───────────────────────────────────────────────────── */}
        <View style={[styles.previewContainer, {height: previewH + 16}]}>
          <View style={[styles.previewFrame, {width: W - 32, height: previewH}]}>
            <Video
              ref={playerRef}
              source={{uri}}
              style={styles.video}
              paused={paused}
              resizeMode="contain"
              controls={false}
              repeat={false}
              progress={{currentTime: currentTime / 1000}}
              onProgress={(e) => { if (!scrubbing) setCurrentTime(e.currentTime * 1000); }}
              onLoad={(e) => {
                if (videoInfo && videoInfo.duration === 0) {
                  setVideoInfo({...videoInfo, duration: e.duration * 1000});
                  setEndMs(e.duration * 1000);
                }
              }}
            />
            {/* Play/pause overlay */}
            <TouchableOpacity style={styles.playOverlay} onPress={togglePlay} activeOpacity={0.8}>
              <Animated.View style={[styles.playBtn, {transform: [{scale: playScale}]}]}>
                <Icon name={paused ? 'play' : 'pause'} size={28} color={Colors.white} />
              </Animated.View>
            </TouchableOpacity>
            {/* Aspect ratio badge */}
            <View style={styles.aspectBadge}>
              <Text style={styles.aspectBadgeText}>{aspect === 'original' ? `${videoInfo?.width}×${videoInfo?.height}` : aspect}</Text>
            </View>
          </View>
        </View>

        {/* ── Timeline / Trim ────────────────────────────────────────────────── */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeader}>
            <Text style={styles.sectionLabel}>KIRPMA</Text>
            <Text style={styles.trimDuration}>{fmtTime(endMs - startMs)}</Text>
          </View>

          {/* Scrubbable timeline */}
          <View style={styles.timelineContainer} {...scrubPan.panHandlers}>
            <View style={styles.timelineTrack}>
              {/* Selected trim region */}
              <View
                style={[
                  styles.trimRegion,
                  {left: `${trimPctStart}%`, width: `${Math.max(0, trimPctEnd - trimPctStart)}%`},
                ]}
              />
              {/* Playhead */}
              <View style={[styles.playhead, {left: `${playPct}%`}]} />
            </View>

            {/* Start handle */}
            <View
              style={[styles.trimHandle, {left: `${trimPctStart}%`, marginLeft: -14}]}
              {...startPan.panHandlers}>
              <View style={styles.handleGrip} />
              <View style={styles.handleBar} />
              <View style={styles.handleGrip} />
            </View>

            {/* End handle */}
            <View
              style={[styles.trimHandle, {left: `${trimPctEnd}%`, marginLeft: -14}]}
              {...endPan.panHandlers}>
              <View style={styles.handleGrip} />
              <View style={styles.handleBar} />
              <View style={styles.handleGrip} />
            </View>
          </View>

          {/* Time labels */}
          <View style={styles.timeLabels}>
            <Text style={styles.timeText}>{fmtTime(startMs)}</Text>
            <Text style={styles.timeText}>{fmtTime(currentTime)}</Text>
            <Text style={styles.timeText}>{fmtTime(endMs)}</Text>
          </View>
        </View>

        {/* ── Tool Row: Aspect + Text ──────────────────────────────────────── */}
        <View style={styles.toolRow}>
          {/* Aspect ratio */}
          <View style={styles.toolGroup}>
            <Text style={styles.toolLabel}>EN BOY</Text>
            <View style={styles.chipRow}>
              {(['9:16', '1:1', '16:9', 'original'] as AspectRatio[]).map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.toolChip, aspect === a && styles.toolChipActive]}
                  onPress={() => setAspect(a)}>
                  <Text style={[styles.toolChipText, aspect === a && styles.toolChipTextActive]}>
                    {a === 'original' ? 'Orijinal' : a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Quality ──────────────────────────────────────────────────────── */}
        <View style={styles.toolRow}>
          <View style={styles.toolGroup}>
            <Text style={styles.toolLabel}>KALİTE</Text>
            <View style={styles.chipRow}>
              {(['original', '720p', '1080p'] as Quality[]).map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.toolChip, quality === q && styles.toolChipActive]}
                  onPress={() => setQuality(q)}>
                  <Text style={[styles.toolChipText, quality === q && styles.toolChipTextActive]}>
                    {q === 'original' ? 'Orijinal' : q.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* FPS */}
          <View style={styles.toolGroup}>
            <Text style={styles.toolLabel}>FPS</Text>
            <View style={styles.chipRow}>
              {([30, 60] as FpsOption[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.toolChip, fps === f && styles.toolChipActive]}
                  onPress={() => setFps(f)}>
                  <Text style={[styles.toolChipText, fps === f && styles.toolChipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Text overlay ─────────────────────────────────────────────────── */}
        <View style={styles.toolRow}>
          <View style={styles.toolGroupFull}>
            <Text style={styles.toolLabel}>METİN</Text>
            <TouchableOpacity
              style={styles.textAddBtn}
              onPress={() => { setTextDraft(textOverlay); setShowTextModal(true); }}>
              <Icon name="format-text" size={18} color={Colors.primary} />
              <Text style={styles.textAddLabel} numberOfLines={1}>
                {textOverlay || 'Metin ekle…'}
              </Text>
              {textOverlay ? (
                <TouchableOpacity
                  onPress={() => setTextOverlay('')}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="close-circle" size={18} color={Colors.error} />
                </TouchableOpacity>
              ) : (
                <Icon name="plus-circle" size={18} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Export bar ────────────────────────────────────────────────────── */}
        <View style={styles.exportBar}>
          <View style={styles.exportInfo}>
            <Icon name="movie-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.exportInfoText}>
              {fmtTime(endMs - startMs)} • {aspect === 'original' ? 'Orijinal' : aspect} • {fps}fps
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.85}>
            {exporting ? (
              <>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.exportBtnText}>Aktarılıyor…</Text>
              </>
            ) : (
              <>
                <Icon name="download" size={18} color={Colors.white} />
                <Text style={styles.exportBtnText}>Dışa Aktar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Text input modal ────────────────────────────────────────────────── */}
      <Modal visible={showTextModal} transparent animationType="slide" onRequestClose={() => setShowTextModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Metin Ekle</Text>
            <TextInput
              style={styles.textInput}
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Video üzerine eklenecek metin…"
              placeholderTextColor={Colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTextModal(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => { setTextOverlay(textDraft); setShowTextModal(false); }}>
                <Text style={styles.modalConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},

  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingText: {color: Colors.textMuted, fontSize: 14},

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  topTitle: {color: Colors.white, fontSize: 16, fontWeight: '800'},
  topRight: {flexDirection: 'row', gap: 6},
  settingsPill: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  settingsPillText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '700'},

  scroll: {flex: 1},

  // Preview
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#000',
  },
  previewFrame: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  video: {width: '100%', height: '100%'},
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  aspectBadge: {
    position: 'absolute',
    bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aspectBadgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},

  // Timeline
  timelineSection: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8},
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
  },
  trimDuration: {
    color: Colors.primary, fontSize: 13, fontWeight: '700',
  },
  timelineContainer: {
    position: 'relative', height: 50, justifyContent: 'center',
  },
  timelineTrack: {
    position: 'absolute',
    top: 13, left: 0, right: 0, height: 24,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 6, overflow: 'hidden',
  },
  trimRegion: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderLeftWidth: 2, borderRightWidth: 2,
    borderColor: Colors.primary,
  },
  playhead: {
    position: 'absolute',
    top: -2, bottom: -2,
    width: 2,
    backgroundColor: '#fff',
    zIndex: 5,
  },
  trimHandle: {
    position: 'absolute',
    top: 3,
    width: 28, height: 44,
    alignItems: 'center', justifyContent: 'space-between',
    zIndex: 10,
  },
  handleGrip: {
    width: 20, height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  handleBar: {
    width: 3, flex: 1,
    backgroundColor: Colors.primary,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {color: Colors.textMuted, fontSize: 10, fontWeight: '600'},

  // Tools
  toolRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  toolGroup: {flex: 1},
  toolGroupFull: {flex: 1},
  toolLabel: {
    color: Colors.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8,
  },
  chipRow: {flexDirection: 'row', gap: 6, flexWrap: 'wrap'},
  toolChip: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  toolChipActive: {
    backgroundColor: Colors.primaryMuted || 'rgba(59,130,246,0.15)',
    borderColor: Colors.primary,
  },
  toolChipText: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '700',
  },
  toolChipTextActive: {color: Colors.primary},

  // Text add
  textAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  textAddLabel: {
    flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '500',
  },

  // Export bar
  exportBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  exportInfo: {flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1},
  exportInfoText: {color: Colors.textMuted, fontSize: 12, fontWeight: '600'},
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  exportBtnDisabled: {opacity: 0.6},
  exportBtnText: {color: Colors.white, fontSize: 14, fontWeight: '800'},

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: {color: Colors.white, fontSize: 18, fontWeight: '800', marginBottom: 16},
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    color: Colors.white,
    fontSize: 15,
    minHeight: 80,
    borderWidth: 1, borderColor: Colors.border,
    textAlignVertical: 'top',
  },
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 16},
  modalCancel: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: {color: Colors.textSecondary, fontSize: 15, fontWeight: '700'},
  modalConfirm: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmText: {color: Colors.white, fontSize: 15, fontWeight: '800'},
});
