import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  PanResponder,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {LiveChat, ChatConfig, ChatMessage} from '../modules/LiveChatModule';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

const PANEL_W = SCREEN_W - 32;
const PANEL_H = 280;
const DEFAULT_X = 16;
const DEFAULT_Y = SCREEN_H - PANEL_H - 120;

export default function FloatingChatPanel({config}: {config: ChatConfig}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [chatConnected, setChatConnected] = useState(false);
  const pan = useRef(new Animated.ValueXY({x: DEFAULT_X, y: DEFAULT_Y})).current;
  const positionRef = useRef({x: DEFAULT_X, y: DEFAULT_Y});
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const msgSub = LiveChat.onChatMessage((msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-4), msg]);
    });
    const statusSub = LiveChat.onChatStatus((status: string) => {
      setChatConnected(status === 'connected');
    });
    const viewerSub = LiveChat.onViewerCount((count: number) => {
      setViewerCount(count);
    });
    const errorSub = LiveChat.onChatError(() => {
      setChatConnected(false);
    });

    return () => {
      msgSub.remove();
      statusSub.remove();
      viewerSub.remove();
      errorSub.remove();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isExpanded && scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({animated: true}), 50);
    }
  }, [messages, isExpanded]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset(positionRef.current);
        pan.setValue({x: 0, y: 0});
      },
      onPanResponderMove: Animated.event([null, {dx: pan.x, dy: pan.y}], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const newX = positionRef.current.x + gestureState.dx;
        const newY = positionRef.current.y + gestureState.dy;
        const clampedX = Math.max(0, Math.min(newX, SCREEN_W - PANEL_W));
        const clampedY = Math.max(40, Math.min(newY, SCREEN_H - 60));
        positionRef.current = {x: clampedX, y: clampedY};
        Animated.spring(pan, {
          toValue: {x: clampedX, y: clampedY},
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText('');
    try {
      await LiveChat.sendMessage(config, msg);
      // Add local message
      setMessages(prev => [
        ...prev.slice(-4),
        {username: 'You', message: msg, timestamp: Date.now()},
      ]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev.slice(-4),
        {username: 'System', message: `Failed to send: ${e?.message ?? 'error'}`, timestamp: Date.now()},
      ]);
    }
  }, [inputText, config]);

  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (!isExpanded) {
    return (
      <Animated.View
        style={[styles.collapsedContainer, pan.getLayout()]}
        {...panResponder.panHandlers}>
        <TouchableOpacity
          style={styles.collapsedBubble}
          onPress={() => setIsExpanded(true)}>
          <Icon name="chat" size={22} color={Colors.secondary} />
          {messages.length > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{messages.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.container, pan.getLayout()]}
      {...panResponder.panHandlers}>
      {/* Drag handle bar */}
      <View style={styles.dragHandle}>
        <View style={styles.dragHandleBar} />
        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={() => setIsExpanded(false)}>
          <Icon name="chevron-down" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Header: viewer count + status */}
      <View style={styles.panelHeader}>
        <View style={styles.viewerCount}>
          <Icon name="account-group" size={14} color={Colors.primary} />
          <Text style={styles.viewerCountText}>{viewerCount.toLocaleString()}</Text>
        </View>
        <View style={styles.chatStatus}>
          <View
            style={[
              styles.statusDot,
              {backgroundColor: chatConnected ? Colors.success : Colors.textMuted},
            ]}
          />
          <Text style={styles.statusText}>
            {chatConnected ? 'Chat Connected' : 'Connecting...'}
          </Text>
        </View>
      </View>

      {/* Messages — last 5 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesArea}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>Waiting for chat messages...</Text>
        ) : (
          messages.map((msg, i) => (
            <View key={i} style={styles.messageRow}>
              <Text style={styles.messageTime}>{fmtTime(msg.timestamp)}</Text>
              <Text
                style={[
                  styles.messageUser,
                  msg.username === 'You' && styles.messageUserSelf,
                  msg.username === 'System' && styles.messageUserSystem,
                ]}>
                {msg.username}:
              </Text>
              <Text style={styles.messageText} numberOfLines={3}>
                {msg.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="Send a message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={!inputText.trim()}>
            <Icon
              name="send"
              size={18}
              color={inputText.trim() ? Colors.white : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: PANEL_W,
    height: PANEL_H,
    backgroundColor: 'rgba(17,17,17,0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  collapsedContainer: {
    position: 'absolute',
  },
  collapsedBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: Colors.secondary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  unreadText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  dragHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
  },
  collapseBtn: {
    position: 'absolute',
    right: 8,
    top: 2,
    padding: 4,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.secondaryMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewerCountText: {
    color: Colors.secondary,
    fontSize: 13,
    fontFamily: Fonts.mono,
  },
  chatStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  messagesArea: {
    flex: 1,
    paddingHorizontal: 10,
  },
  messagesContent: {
    gap: 6,
    paddingVertical: 4,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 20,
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
  },
  messageTime: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  messageUser: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  messageUserSelf: {
    color: Colors.success,
  },
  messageUserSystem: {
    color: Colors.warning,
  },
  messageText: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chatInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
