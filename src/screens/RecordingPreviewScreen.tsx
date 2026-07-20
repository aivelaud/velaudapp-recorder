import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  ToastAndroid,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
import {Colors} from '../theme/colors';
import {VideoLibrary} from '../modules/VideoLibraryModule';
import {RootStackParamList} from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'RecordingPreview'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_WIDTH * (9 / 16);

export default function RecordingPreviewScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {filePath} = route.params;

  const [paused, setPaused] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [deleted, setDeleted] = useState(false);

  // Derive a playable URI from the filePath (content:// or file://)
  const videoUri = filePath.startsWith('content://')
    ? filePath
    : `file://${filePath}`;

  const handlePlay = () => setPaused(p => !p);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        url: videoUri,
        title: 'Velaud Recorder — Ekran Kaydı',
        message: 'Ekran kaydım',
      });
    } catch (e: any) {
      Alert.alert('Paylaşım Hatası', e?.message ?? 'Paylaşım başarısız.');
    }
  }, [videoUri]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Videoyu Sil',
      'Bu kayıt kalıcı olarak silinecek. Emin misiniz?',
      [
        {text: 'İptal', style: 'cancel'},
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const ok = await VideoLibrary.deleteVideo(filePath);
            if (ok) {
              setDeleted(true);
              ToastAndroid.show('Kayıt silindi', ToastAndroid.SHORT);
              navigation.navigate('Main');
            } else {
              Alert.alert('Hata', 'Video silinemedi.');
            }
          },
        },
      ],
    );
  }, [filePath, navigation]);

  const handleTrim = useCallback(() => {
    // Open the video in Android's built-in trim/edit activity
    try {
      const {Linking} = require('react-native');
      const intent = `android.intent.action.EDIT`;
      Linking.openURL(videoUri).catch(() => {
        ToastAndroid.show('Video düzenleyici bulunamadı', ToastAndroid.SHORT);
      });
    } catch {
      ToastAndroid.show('Bu cihazda kırpma desteklenmiyor', ToastAndroid.SHORT);
    }
  }, [videoUri]);

  const handleEdit = useCallback(() => {
    // Navigate to videos list for editing options
    navigation.navigate('Main');
    ToastAndroid.show('Video galeriye kaydedildi', ToastAndroid.SHORT);
  }, [navigation]);

  if (deleted) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Main')}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kayıt Tamamlandı</Text>
        <View style={{width: 40}} />
      </View>

      {/* Success banner */}
      <View style={styles.successBanner}>
        <Icon name="check-circle" size={20} color="#4ade80" />
        <Text style={styles.successText}>Video galeriye kaydedildi!</Text>
      </View>

      {/* Video Player */}
      <View style={styles.playerContainer}>
        {videoError ? (
          <View style={styles.videoError}>
            <Icon name="video-off-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.videoErrorText}>Önizleme yüklenemedi</Text>
            <Text style={styles.videoErrorSubtext}>
              Video galeri uygulamasından izleyebilirsiniz
            </Text>
          </View>
        ) : (
          <>
            <Video
              source={{uri: videoUri}}
              style={styles.video}
              paused={paused}
              resizeMode="contain"
              controls={false}
              repeat={false}
              onLoadStart={() => setVideoLoading(true)}
              onLoad={() => setVideoLoading(false)}
              onError={() => {
                setVideoLoading(false);
                setVideoError(true);
              }}
              onEnd={() => setPaused(true)}
            />
            {videoLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            {/* Play/pause overlay button */}
            <TouchableOpacity
              style={styles.playOverlay}
              onPress={handlePlay}
              activeOpacity={0.7}>
              {!videoLoading && (
                <View style={styles.playBtn}>
                  <Icon
                    name={paused ? 'play' : 'pause'}
                    size={32}
                    color={Colors.white}
                  />
                </View>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Ne yapmak istersiniz?</Text>

        <View style={styles.actionsGrid}>
          {/* Delete */}
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardDanger]}
            onPress={handleDelete}
            activeOpacity={0.8}>
            <View style={[styles.actionIcon, styles.actionIconDanger]}>
              <Icon name="delete-outline" size={24} color="#f87171" />
            </View>
            <Text style={[styles.actionLabel, styles.actionLabelDanger]}>
              Sil
            </Text>
          </TouchableOpacity>

          {/* Trim */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleTrim}
            activeOpacity={0.8}>
            <View style={styles.actionIcon}>
              <Icon name="content-cut" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Kırp</Text>
          </TouchableOpacity>

          {/* Edit/Done */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleEdit}
            activeOpacity={0.8}>
            <View style={styles.actionIcon}>
              <Icon name="check-all" size={24} color="#4ade80" />
            </View>
            <Text style={styles.actionLabel}>Tamam</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleShare}
            activeOpacity={0.8}>
            <View style={styles.actionIcon}>
              <Icon name="share-variant" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Paylaş</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    marginBottom: 12,
  },
  successText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  playerContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceElevated,
  },
  videoErrorText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  videoErrorSubtext: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  actionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  actionsTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 32 - 36) / 4,
    aspectRatio: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionCardDanger: {
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDanger: {
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  actionLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionLabelDanger: {
    color: '#f87171',
  },
});
