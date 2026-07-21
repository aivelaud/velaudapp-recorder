import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {LiveChatModule} = NativeModules;

export type ChatPlatform = 'twitch' | 'kick' | 'youtube';

export interface ChatConfig {
  platform: ChatPlatform;
  channel: string;
  token?: string | null;
  username?: string;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
}

class LiveChatClass {
  private emitter: NativeEventEmitter;

  constructor() {
    if (LiveChatModule) {
      this.emitter = new NativeEventEmitter(LiveChatModule);
    } else {
      this.emitter = {
        addListener: () => ({remove: () => {}}),
      } as unknown as NativeEventEmitter;
    }
  }

  async startChat(config: ChatConfig): Promise<boolean> {
    if (Platform.OS !== 'android' || !LiveChatModule) return false;
    return LiveChatModule.startChat(config);
  }

  async stopChat(): Promise<void> {
    if (!LiveChatModule) return;
    return LiveChatModule.stopChat();
  }

  async sendMessage(config: ChatConfig, message: string): Promise<boolean> {
    if (!LiveChatModule) return false;
    return LiveChatModule.sendMessage(config, message);
  }

  onChatMessage(callback: (msg: ChatMessage) => void) {
    return this.emitter.addListener('LiveChatMessage', callback);
  }

  onChatStatus(callback: (status: string) => void) {
    return this.emitter.addListener('LiveChatStatus', callback);
  }

  onChatError(callback: (error: string) => void) {
    return this.emitter.addListener('LiveChatError', callback);
  }

  onViewerCount(callback: (count: number) => void) {
    return this.emitter.addListener('LiveChatViewerCount', callback);
  }
}

export const LiveChat = new LiveChatClass();
