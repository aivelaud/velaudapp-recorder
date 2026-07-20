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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {VideoLibrary, VideoItem} from '../modules/VideoLibraryModule';

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 'Az önce';
  if (diffHours < 24) return `${Math.floor(diffHours)} saat önce`;
  if (diffHours < 48) return 'Dün';

  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}.${d.getFullYear()}`;
};

function VideoCard({item, onDelete}: {item: VideoItem; onDelete: (item: VideoItem) => void}) {
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
      `"${item.displayName}" kalıcı olarak silinecek.`,
      [
        {text: 'İptal', style: 'cancel'},
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => onDelete(item),
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnailPath ? (
          <Image
            source={{uri: `file://${item.thumbnailPath}`}}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardContent}>
        <Text style={styles.videoName} numberOfLines={1}>
          {item.displayName}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatDate(item.dateAdded)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{formatSize(item.size)}</Text>
          {item.width > 0 && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{item.width}×{item.height}</Text>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>📤 Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
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
    try {
      const items = await VideoLibrary.getRecordedVideos();
      items.sort((a, b) => b.dateAdded - a.dateAdded);
      setVideos(items);
    } catch (e) {
      console.error('Load videos error:', e);
    }
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
      ToastAndroid.show('Video silindi', ToastAndroid.SHORT);
    } else {
      Alert.alert('Hata', 'Video silinemedi.');
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Videolar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Videolarım</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{videos.length}</Text>
        </View>
      </View>

      <FlatList
        data={videos}
        keyExtractor={item => item.id}
        renderItem={({item}) => <VideoCard item={item} onDelete={handleDelete} />}
        contentContainerStyle={videos.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyEmoji}>🎬</Text>
            </View>
            <Text style={styles.emptyTitle}>Henüz video yok</Text>
            <Text style={styles.emptySubtitle}>
              Kayıt sekmesinden ekran kaydını başlatın.{'\n'}
              Kayıtlarınız burada görünecek.
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  list: {padding: 16, paddingTop: 4},
  emptyContainer: {flex: 1},
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  thumbnailContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 32,
    color: Colors.textMuted,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cardContent: {
    padding: 14,
  },
  videoName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  metaText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  metaDot: {
    color: Colors.textMuted,
    fontSize: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});