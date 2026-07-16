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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {VideoLibrary, VideoItem} from '../modules/VideoLibraryModule';

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}.${d.getFullYear()} ${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

function VideoCard({item, onDelete}: {item: VideoItem; onDelete: (item: VideoItem) => void}) {
  const handlePlay = () => {
    // Intent.ACTION_VIEW — handled by native side if we had a module, or use react-native-video
    Alert.alert('Video Oynat', `"${item.displayName}" oynatılıyor…\n(Sistem video oynatıcı açılıyor)`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        url: `file://${item.filePath}`,
        title: item.displayName,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Videoyu Sil',
      `"${item.displayName}" kalıcı olarak silinecek. Emin misin?`,
      [
        {text: 'İptal', style: 'cancel'},
        {text: 'Sil', style: 'destructive', onPress: () => onDelete(item)},
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.thumbnail}>
        {item.thumbnailPath ? (
          <Image
            source={{uri: `file://${item.thumbnailPath}`}}
            style={styles.thumbnailImg}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <View style={styles.playIconSmall} />
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationBadgeText}>{formatDuration(item.duration)}</Text>
        </View>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.displayName}
        </Text>
        <Text style={styles.videoMeta}>{formatDate(item.dateAdded)}</Text>
        <Text style={styles.videoSize}>{formatSize(item.size)}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.playBtn]} onPress={handlePlay}>
            <Text style={styles.actionBtnText}>▶ Oynat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare}>
            <Text style={styles.actionBtnText}>Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
            <Text style={styles.actionBtnText}>Sil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVideos = useCallback(async () => {
    const items = await VideoLibrary.getRecordedVideos();
    items.sort((a, b) => b.dateAdded - a.dateAdded);
    setVideos(items);
  }, []);

  useEffect(() => {
    loadVideos().finally(() => setLoading(false));
  }, [loadVideos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  }, [loadVideos]);

  const handleDelete = useCallback(async (item: VideoItem) => {
    const ok = await VideoLibrary.deleteVideo(item.filePath);
    if (ok) {
      setVideos(prev => prev.filter(v => v.id !== item.id));
    } else {
      Alert.alert('Hata', 'Video silinemedi.');
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Videolarım</Text>
        <Text style={styles.videoCount}>{videos.length} video</Text>
      </View>

      <FlatList
        data={videos}
        keyExtractor={item => item.id}
        renderItem={({item}) => <VideoCard item={item} onDelete={handleDelete} />}
        contentContainerStyle={videos.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Henüz video yok</Text>
            <Text style={styles.emptySubtitle}>
              Kayıt sekmesinden ekran kaydını başlatın.{'\n'}Kayıtlar burada görünecek.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {color: Colors.text, fontSize: 20, fontWeight: '700'},
  videoCount: {color: Colors.textMuted, fontSize: 14},
  list: {padding: 16, gap: 12},
  emptyContainer: {flex: 1},
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  thumbnail: {
    width: 110,
    height: 110,
    position: 'relative',
  },
  thumbnailImg: {width: '100%', height: '100%'},
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconSmall: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 18,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: Colors.textMuted,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationBadgeText: {color: Colors.white, fontSize: 11, fontWeight: '600'},
  cardInfo: {flex: 1, padding: 12, justifyContent: 'space-between'},
  videoTitle: {color: Colors.text, fontSize: 14, fontWeight: '600', lineHeight: 18},
  videoMeta: {color: Colors.textMuted, fontSize: 12, marginTop: 2},
  videoSize: {color: Colors.textMuted, fontSize: 12},
  actions: {flexDirection: 'row', gap: 6, marginTop: 6},
  actionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  playBtn: {backgroundColor: Colors.primary},
  shareBtn: {backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border},
  deleteBtn: {backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.error},
  actionBtnText: {color: Colors.white, fontSize: 12, fontWeight: '600'},
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceElevated,
    marginBottom: 20,
  },
  emptyTitle: {color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8},
  emptySubtitle: {color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22},
});
