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

const {width: W} = Dimensions.get('window');
const VIDEO_H = W * (9 / 16);

// ─── Action pill ──────────────────────────────────────────────────────────
function ActionPill({
  icon,
  label,
  onPress,
  danger,
  primary,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        danger && styles.pillDanger,
        primary && styles.pillPrimary,
      ]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Icon
        name={icon}
        size={19}
        color={
          primary ? Colors.white : danger ? Colors.primary : Colors.textSecondary
        }
      />
      <Text
        style={[
          styles.pillLabel,
          danger && styles.pillLabelDanger,
          primary && styles.pillLabelPrimary,
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────
export default function RecordingPreviewScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {filePath} = route.params;

  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const uri = filePath.startsWith('content://') ? filePath : `file://${filePath}`;

  const goBack = useCallback(() => navigation.navigate('Main'), [navigation]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({url: uri, title: 'Ekran kaydım'});
    } catch (e: any) {
      Alert.alert('Paylaşım Hatası', e?.message ?? '');
    }
  }, [uri]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Videoyu Sil',
      'Bu kayıt kalıcı olarak silinecek. Emin misiniz?',
      [
        {text: 'Vazgeç', style: 'cancel'},
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const ok = await VideoLibrary.deleteVideo(filePath);
            if (ok) {
              ToastAndroid.show('Video silindi', ToastAndroid.SHORT);
              goBack();
            } else {
              Alert.alert('Hata', 'Video silinemedi.');
            }
          },
        },
      ],
    );
  }, [filePath, goBack]);

  const handleTrim = useCallback(() => {
    ToastAndroid.show('Video galeri uygulamasında düzenleyin', ToastAndroid.LONG);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Icon name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kayıt Önizleme</Text>
        <View style={{width: 40}} />
      </View>

      {/* Success strip */}
      <View style={styles.successStrip}>
        <Icon name="check-circle-outline" size={16} color={Colors.success} />
        <Text style={styles.successText}>Kayıt başarıyla tamamlandı</Text>
      </View>

      {/* ── Video player ─────────────────────────────────────────────────── */}
      <View style={styles.playerWrap}>
        {hasError ? (
          <View style={styles.playerError}>
            <Icon name="video-off-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.playerErrorText}>Önizleme yüklenemedi</Text>
            <Text style={styles.playerErrorSub}>
              Videoyu galeri uygulamasından izleyebilirsiniz
            </Text>
          </View>
        ) : (
          <>
            <Video
              source={{uri}}
              style={styles.video}
              paused={paused}
              resizeMode="contain"
              controls={false}
              repeat={false}
              onLoadStart={() => setLoading(true)}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
              onEnd={() => setPaused(true)}
            />
            {loading && (
              <View style={styles.playerLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            <TouchableOpacity
              style={styles.playOverlay}
              onPress={() => setPaused(p => !p)}
              activeOpacity={0.8}>
              {!loading && (
                <View style={styles.playBtn}>
                  <Icon name={paused ? 'play' : 'pause'} size={30} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <View style={styles.actionsWrap}>
        <Text style={styles.actionsLabel}>İşlemler</Text>

        {/* Primary action: Share */}
        <ActionPill
          icon="share-variant"
          label="Paylaş"
          onPress={handleShare}
          primary
        />

        {/* Secondary row */}
        <View style={styles.actionsRow}>
          <ActionPill icon="content-cut" label="Kırp" onPress={handleTrim} />
          <ActionPill
            icon="delete-outline"
            label="Sil"
            onPress={handleDelete}
            danger
          />
          <ActionPill icon="check" label="Tamam" onPress={goBack} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  successStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.successMuted,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.25)',
    marginBottom: 10,
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '700',
  },

  // Player
  playerWrap: {
    width: W,
    height: VIDEO_H,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {width: '100%', height: '100%'},
  playerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
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
  playerError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    gap: 10,
  },
  playerErrorText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  playerErrorSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Actions
  actionsWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 10,
  },
  actionsLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // Pills (Midas-style)
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillDanger: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.chipActiveBorder,
  },
  pillPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.transparent,
  },
  pillLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  pillLabelDanger: {
    color: Colors.primary,
  },
  pillLabelPrimary: {
    color: Colors.white,
  },
});
