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
  LayoutAnimation,
  Platform,
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
const MIN_TRIM_MS = 1000;

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${pad2(m)}:${pad2(s % 60)}.${String(Math.floor(ms % 1000)).padStart(3, '0').slice(0, 1)}`;
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

  // Trim state
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);

  // Quality state
  const [resolution, setResolution] = useState<'original' | '720p' | '1080p'>('original');
  const [fps, setFps] = useState<30 | 60>(30);

  // Text overlay
  const [textOverlay, setTextOverlay] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [textDraft, setTextDraft] = useState('');

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

  const handleExport = useCallback(async () => {
    if (!videoInfo) return;
    setExporting(true);
    setPaused(true);
    try {
      let outW = 0;
      let outH = 0;
      if (resolution === '720p') {
        outW = 1280;
        outH = 720;
      } else if (resolution === '1080p') {
        outW = 1920;
        outH = 1080;
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
  }, [videoInfo, filePath, startMs, endMs, resolution, fps, textOverlay, navigation]);

  // ── Trim handles ────────────────────────────────────────────────────────
  const startPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (!videoInfo) return;
        const pxToMs = videoInfo.duration / TIMELINE_W;
        const newStart = Math.max(
          0,
          Math.min(startMs + gestureState.dx * pxToMs, endMs - MIN_TRIM_MS)
        );
        setStartMs(Math.round(newStart));
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  const endPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (!videoInfo) return;
        const pxToMs = videoInfo.duration / TIMELINE_W;
        const newEnd = Math.max(
          startMs + MIN_TRIM_MS,
          Math.min(endMs + gestureState.dx * pxToMs, videoInfo.duration)
        );
        setEndMs(Math.round(newEnd));
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Video yükleniyor…</Text>
      </View>
    );
  }

  const videoH = videoInfo ? W * (videoInfo.height / videoInfo.width) : W * 0.56;
  const trimPctStart = videoInfo ? (startMs / videoInfo.duration) * 100 : 0;
  const trimPctEnd = videoInfo ? (endMs / videoInfo.duration) * 100 : 100;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video Düzenle</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Icon name="check" size={20} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Video Preview */}
        <View style={[styles.playerWrap, {height: videoH}]}>
          <Video
            source={{uri}}
            style={styles.video}
            paused={paused}
            resizeMode="contain"
            controls={false}
            repeat={false}
            progress={{currentTime: currentTime / 1000}}
            onProgress={(e) => setCurrentTime(e.currentTime * 1000)}
            onLoad={(e) => {
              if (videoInfo && videoInfo.duration === 0) {
                setVideoInfo({...videoInfo, duration: e.duration * 1000});
                setEndMs(e.duration * 1000);
              }
            }}
          />
          <TouchableOpacity
            style={styles.playOverlay}
            onPress={() => setPaused((p) => !p)}
            activeOpacity={0.8}>
            <View style={styles.playBtn}>
              <Icon name={paused ? 'play' : 'pause'} size={30} color={Colors.white} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Timeline / Trim */}
        {videoInfo && (
          <View style={styles.trimSection}>
            <Text style={styles.sectionLabel}>KIRPMA</Text>
            <View style={styles.timelineContainer}>
              {/* Timeline bar */}
              <View style={styles.timelineBar}>
                {/* Selected region */}
                <View
                  style={[
                    styles.trimRegion,
                    {
                      left: `${trimPctStart}%`,
                      width: `${trimPctEnd - trimPctStart}%`,
                    },
                  ]}
                />
              </View>

              {/* Start handle */}
              <View
                style={[styles.trimHandle, {left: `${trimPctStart}%` - 12}]}
                {...startPan.panHandlers}>
                <View style={styles.handleBar} />
                <Text style={styles.handleTime}>{fmtTime(startMs)}</Text>
              </View>

              {/* End handle */}
              <View
                style={[styles.trimHandle, {left: `${trimPctEnd}%` - 12}]}
                {...endPan.panHandlers}>
                <View style={styles.handleBar} />
                <Text style={styles.handleTime}>{fmtTime(endMs)}</Text>
              </View>
            </View>
            <Text style={styles.trimDuration}>
              Süre: {fmtTime(endMs - startMs)}
            </Text>
          </View>
        )}

        {/* Quality Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>KALİTE</Text>
          <View style={styles.chipRow}>
            {(['original', '720p', '1080p'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, resolution === r && styles.chipActive]}
                onPress={() => setResolution(r)}>
                <Text
                  style={[
                    styles.chipText,
                    resolution === r && styles.chipTextActive,
                  ]}>
                  {r === 'original' ? 'Orijinal' : r.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FPS */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>KARE HIZI (FPS)</Text>
          <View style={styles.chipRow}>
            {[30, 60].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, fps === f && styles.chipActive]}
                onPress={() => setFps(f as 30 | 60)}>
                <Text
                  style={[
                    styles.chipText,
                    fps === f && styles.chipTextActive,
                  ]}>
                  {f} FPS
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Text Overlay */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>METİN EKLE</Text>
          <TouchableOpacity
            style={styles.textAddBtn}
            onPress={() => {
              setTextDraft(textOverlay);
              setShowTextModal(true);
            }}>
            <Icon name="format-text" size={20} color={Colors.primary} />
            <Text style={styles.textAddLabel} numberOfLines={1}>
              {textOverlay || 'Metin ekle…'}
            </Text>
            {textOverlay ? (
              <TouchableOpacity
                onPress={() => setTextOverlay('')}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={styles.exportFullBtn}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.8}>
          {exporting ? (
            <>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.exportFullText}>Dışa aktarılıyor…</Text>
            </>
          ) : (
            <>
              <Icon name="download" size={20} color={Colors.white} />
              <Text style={styles.exportFullText}>Galeriye Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Text input modal */}
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
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowTextModal(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  setTextOverlay(textDraft);
                  setShowTextModal(false);
                }}>
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

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {color: Colors.textMuted, fontSize: 14},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {flex: 1},

  playerWrap: {
    width: W,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {width: '100%', height: '100%'},
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  trimSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  timelineContainer: {
    position: 'relative',
    height: 60,
    marginBottom: 8,
  },
  timelineBar: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 6,
    overflow: 'hidden',
  },
  trimRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(59,130,246,0.30)',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
  },
  trimHandle: {
    position: 'absolute',
    top: 10,
    width: 24,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    width: 4,
    height: 24,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  handleTime: {
    position: 'absolute',
    top: -16,
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },
  trimDuration: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: Colors.primary,
  },

  textAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textAddLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },

  exportFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 24,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  exportFullText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },

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
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    color: Colors.white,
    fontSize: 15,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
