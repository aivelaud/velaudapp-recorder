import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {LiveStream, LiveStreamConfig} from '../modules/LiveStreamModule';
import {LiveChat, ChatPlatform, ChatConfig} from '../modules/LiveChatModule';
import {RootStackParamList} from '../navigation/AppNavigator';
import FloatingChatPanel from '../components/FloatingChatPanel';

type LiveStreamRouteProp = RouteProp<RootStackParamList, 'LiveStream'>;

const PLATFORMS: {
  key: ChatPlatform;
  label: string;
  rtmpBase: string;
  icon: string;
  color: string;
}[] = [
  {
    key: 'youtube',
    label: 'YouTube Live',
    rtmpBase: 'rtmp://a.rtmp.youtube.com/live2',
    icon: 'youtube',
    color: '#FF0000',
  },
  {
    key: 'twitch',
    label: 'Twitch',
    rtmpBase: 'rtmp://live.twitch.tv/app',
    icon: 'twitch',
    color: '#9146FF',
  },
  {
    key: 'kick',
    label: 'Kick',
    rtmpBase: 'rtmp://ingest.kick.com/live',
    icon: 'kick',
    color: '#53FC18',
  },
];

type Visibility = 'public' | 'unlisted' | 'private';

export default function LiveStreamScreen() {
  const navigation = useNavigation();
  const route = useRoute<LiveStreamRouteProp>();
  const initialPlatform = (route.params?.platform as ChatPlatform) || 'youtube';

  const [selectedPlatform, setSelectedPlatform] = useState<ChatPlatform>(initialPlatform);
  const [streamKey, setStreamKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [streamDuration, setStreamDuration] = useState(0);

  const platform = PLATFORMS.find(p => p.key === selectedPlatform)!;

  useEffect(() => {
    const statusSub = LiveStream.onStreamStatus(s => {
      setIsLive(s.isStreaming);
      setStreamDuration(s.duration);
    });
    const errorSub = LiveStream.onStreamError(err => {
      setIsStarting(false);
      Alert.alert('Stream Error', err);
    });
    return () => {
      statusSub.remove();
      errorSub.remove();
    };
  }, []);

  const handleStart = useCallback(async () => {
    if (!streamKey.trim()) {
      Alert.alert('Missing Stream Key', 'Please enter your stream key.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a stream title.');
      return;
    }

    setIsStarting(true);
    try {
      const config: LiveStreamConfig = {
        rtmpUrl: platform.rtmpBase,
        streamKey: streamKey.trim(),
        width: 1280,
        height: 720,
        fps: 30,
        videoBitrate: 2_500_000,
        audioBitrate: 128_000,
        includeAudio,
      };

      const ok = await LiveStream.startStream(config);
      setIsStarting(false);

      if (ok) {
        setIsLive(true);
        // Start chat — channel is stream key for Twitch/Kick, video ID for YouTube
        const chatCfg: ChatConfig = {
          platform: selectedPlatform,
          channel: streamKey.trim().split('-')[0],
          token: null,
          username: title.trim(),
        };
        setChatConfig(chatCfg);
        await LiveChat.startChat(chatCfg);
      } else {
        Alert.alert(
          'Connection Failed',
          'Could not connect to the streaming server. Check your stream key and internet connection.',
        );
      }
    } catch (e: any) {
      setIsStarting(false);
      Alert.alert('Error', e?.message ?? 'Failed to start stream');
    }
  }, [streamKey, title, platform, includeAudio, selectedPlatform]);

  const handleStop = useCallback(async () => {
    Alert.alert(
      'Stop Stream',
      'Are you sure you want to end the live stream?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            await LiveStream.stopStream();
            await LiveChat.stopChat();
            setIsLive(false);
            setChatConfig(null);
          },
        },
      ],
    );
  }, []);

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (isLive) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.liveHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={26} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
            <Text style={styles.liveDuration}>{fmtTime(streamDuration)}</Text>
          </View>
          <TouchableOpacity style={styles.stopBtnSmall} onPress={handleStop}>
            <Icon name="stop" size={18} color={Colors.white} />
            <Text style={styles.stopBtnText}>End</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.liveInfoCard}>
          <Icon name={platform.icon} size={28} color={platform.color} />
          <View style={styles.liveInfoText}>
            <Text style={styles.liveInfoTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.liveInfoPlatform}>{platform.label}</Text>
          </View>
        </View>

        {chatConfig && <FloatingChatPanel config={chatConfig} />}

        <View style={styles.liveBottomArea}>
          <TouchableOpacity style={styles.endStreamBtn} onPress={handleStop} activeOpacity={0.8}>
            <Icon name="stop-circle" size={22} color={Colors.white} />
            <Text style={styles.endStreamText}>End Stream</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Stream</Text>
          <View style={{width: 36}} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Platform selection */}
          <Text style={styles.sectionLabel}>PLATFORM</Text>
          <View style={styles.platformRow}>
            {PLATFORMS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.platformCard,
                  selectedPlatform === p.key && styles.platformCardActive,
                ]}
                onPress={() => setSelectedPlatform(p.key)}>
                <Icon
                  name={p.icon}
                  size={26}
                  color={selectedPlatform === p.key ? p.color : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.platformLabel,
                    selectedPlatform === p.key && {color: Colors.white},
                  ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stream key */}
          <Text style={styles.sectionLabel}>STREAM KEY</Text>
          <View style={styles.inputWrap}>
            <Icon name="key" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Enter your stream key"
              placeholderTextColor={Colors.textMuted}
              value={streamKey}
              onChangeText={setStreamKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>
          <Text style={styles.hintText}>
            Get your stream key from {platform.label} dashboard
          </Text>

          {/* Title */}
          <Text style={styles.sectionLabel}>TITLE</Text>
          <View style={styles.inputWrap}>
            <Icon name="text" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Stream title"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <View style={styles.inputWrapMulti}>
            <TextInput
              style={styles.textInputMulti}
              placeholder="Add a description..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={5000}
              textAlignVertical="top"
            />
          </View>

          {/* Visibility */}
          <Text style={styles.sectionLabel}>VISIBILITY</Text>
          <View style={styles.visibilityRow}>
            {(['public', 'unlisted', 'private'] as Visibility[]).map(v => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.visibilityChip,
                  visibility === v && styles.visibilityChipActive,
                ]}
                onPress={() => setVisibility(v)}>
                <Icon
                  name={v === 'public' ? 'earth' : v === 'unlisted' ? 'link-variant' : 'lock'}
                  size={15}
                  color={visibility === v ? Colors.primary : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.visibilityText,
                    visibility === v && styles.visibilityTextActive,
                  ]}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Audio toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Icon name="microphone" size={20} color={Colors.textSecondary} />
              <Text style={styles.toggleLabel}>Include Audio</Text>
            </View>
            <Switch
              value={includeAudio}
              onValueChange={setIncludeAudio}
              trackColor={{false: Colors.border, true: Colors.primary}}
              thumbColor={includeAudio ? Colors.white : Colors.textMuted}
            />
          </View>

          <View style={{height: 20}} />
        </ScrollView>

        {/* Start button */}
        <View style={styles.bottomBar}>
          {isStarting ? (
            <View style={styles.startingBtn}>
              <ActivityIndicator color={Colors.white} size="small" />
              <Text style={styles.startingText}>Connecting...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStart}
              activeOpacity={0.85}>
              <Icon name="broadcast" size={22} color={Colors.white} />
              <Text style={styles.startBtnText}>Go Live</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 17,
    fontFamily: Fonts.displayBold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Fonts.monoRegular,
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 8,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 10,
  },
  platformCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  platformCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  platformLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 15,
    padding: 0,
  },
  inputWrapMulti: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
  },
  textInputMulti: {
    color: Colors.white,
    fontSize: 15,
    minHeight: 56,
    padding: 0,
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  visibilityChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  visibilityText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  visibilityTextActive: {
    color: Colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.error,
  },
  startBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.displayBold,
  },
  startingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  startingText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Live view
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorMuted,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.recording,
  },
  liveBadgeText: {
    color: Colors.recording,
    fontSize: 11,
    fontFamily: Fonts.mono,
    letterSpacing: 1,
  },
  liveDuration: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: Fonts.monoRegular,
    marginLeft: 4,
  },
  stopBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.error,
  },
  stopBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  liveInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  liveInfoText: {
    flex: 1,
  },
  liveInfoTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  liveInfoPlatform: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  liveBottomArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  endStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.error,
  },
  endStreamText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
