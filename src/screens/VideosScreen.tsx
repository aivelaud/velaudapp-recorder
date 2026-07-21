import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Image,
  ActivityIndicator,
  RefreshControl,
  ToastAndroid,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {VideoLibrary, VideoItem} from '../modules/VideoLibraryModule';
import {Recorder} from '../modules/RecorderModule';
import {RootStackParamList} from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const {width: W} = Dimensions.get('window');
const THUMB_W = (W - 20 * 2 - 10) / 2; // 2-column grid, 20px side padding, 10px gap

// ─── Helpers ───────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s % 60)}`;
  return `${m}:${pad2(s % 60)}`;
};

const fmtSize = (bytes: number) => {
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
};

const fmtDate = (ts: number) => {
  const d = new Date(ts);
  const diff = (Date.now() - ts) / 3_600_000;
  if (diff < 1) return 'Az önce';
  if (diff < 24) return `${Math.floor(diff)} saat önce`;
  if (diff < 48) return 'Dün';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// ─── Video Card (2-column grid) ───────────────────────────────────────────
function VideoCard({
  item,
  onDelete,
  onShare,
  onPress,
}: {
  item: VideoItem;
  onDelete: (item: VideoItem) => void;
  onShare: (item: VideoItem) => void;
  onPress: (item: VideoItem) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.85}>
      {/* Thumbnail */}
      <View style={styles.thumb}>
        {item.thumbnailPath ? (
          <Image
            source={{uri: `file://${item.thumbnailPath}`}}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Icon name="play-box-outline" size={32} color={Colors.textMuted} />
          </View>
        )}

        {/* Duration badge */}
        <View style={styles.durBadge}>
          <Text style={styles.durText}>{fmtDur(item.duration)}</Text>
        </View>

        {/* Action buttons overlay (top-right) */}
        <View style={styles.thumbActions}>
          <TouchableOpacity
            style={styles.thumbBtn}
            onPress={() => onShare(item)}
            hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
            <Icon name="share-variant" size={14} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.thumbBtn, styles.thumbBtnDelete]}
            onPress={() => onDelete(item)}
            hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
            <Icon name="delete-outline" size={14} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        <Text style={styles.metaName} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.metaDate}>{fmtDate(item.dateAdded)}</Text>
        <Text style={styles.metaSize}>{fmtSize(item.size)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────
export default function VideosScreen() {
  const navigation = useNavigation<NavProp>();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await VideoLibrary.getRecordedVideos();
      items.sort((a, b) => b.dateAdded - a.dateAdded);
      setVideos(items);
    } catch (e) {
      console.error('VideosScreen load error:', e);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Auto-refresh when a new recording is saved
  useEffect(() => {
    const sub = Recorder.onRecordingSaved(() => {
      setTimeout(load, 800);
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback((item: VideoItem) => {
    Alert.alert(
      'Videoyu Sil',
      `"${item.displayName}" kalıcı olarak silinecek.`,
      [
        {text: 'Vazgeç', style: 'cancel'},
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const ok = await VideoLibrary.deleteVideo(item.filePath);
            if (ok) {
              setVideos(prev => prev.filter(v => v.id !== item.id));
              ToastAndroid.show('Video silindi', ToastAndroid.SHORT);
            } else {
              Alert.alert('Hata', 'Video silinemedi.');
            }
          },
        },
      ],
    );
  }, []);

  const handleEdit = useCallback((item: VideoItem) => {
    navigation.navigate('VideoEditor', {filePath: item.filePath});
  }, [navigation]);

  const handleShare = useCallback(async (item: VideoItem) => {
    try {
      await Share.share({
        url: `file://${item.filePath}`,
        title: item.displayName,
      });
    } catch {}
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Page header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Videolar</Text>
        {videos.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{videos.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={videos}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={
          videos.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({item}) => (
          <VideoCard
            item={item}
            onDelete={handleDelete}
            onShare={handleShare}
            onPress={handleEdit}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surface}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="video-off-outline" size={36} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Henüz video yok</Text>
            <Text style={styles.emptySub}>
              Kayıt sekmesine geç ve ilk ekran kaydını yap.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {color: Colors.textMuted, fontSize: 14},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  pageTitle: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  countText: {color: Colors.white, fontSize: 12, fontWeight: '800'},

  row: {gap: 10, paddingHorizontal: 20},
  listContent: {paddingBottom: 24, gap: 10},
  emptyContent: {flex: 1},

  // Card
  card: {
    width: THUMB_W,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumb: {
    width: '100%',
    height: THUMB_W * 0.65,
    backgroundColor: Colors.surfaceElevated,
    position: 'relative',
  },
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  durText: {color: Colors.white, fontSize: 11, fontWeight: '700'},

  thumbActions: {
    position: 'absolute',
    top: 7,
    right: 7,
    gap: 5,
  },
  thumbBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBtnDelete: {
    backgroundColor: 'rgba(255,69,58,0.75)',
  },

  meta: {padding: 10, gap: 2},
  metaName: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  metaDate: {color: Colors.textMuted, fontSize: 11},
  metaSize: {color: Colors.textMuted, fontSize: 11},

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.white,
    fontSize: 19,
    fontWeight: '800',
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
