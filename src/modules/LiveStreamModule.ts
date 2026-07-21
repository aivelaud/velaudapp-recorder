import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {LiveStreamModule} = NativeModules;

export interface LiveStreamConfig {
  rtmpUrl: string;
  streamKey: string;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  includeAudio?: boolean;
}

export interface LiveStreamStatus {
  isStreaming: boolean;
  duration: number;
}

class LiveStreamClass {
  private emitter: NativeEventEmitter;

  constructor() {
    if (LiveStreamModule) {
      this.emitter = new NativeEventEmitter(LiveStreamModule);
    } else {
      this.emitter = {
        addListener: () => ({remove: () => {}}),
      } as unknown as NativeEventEmitter;
    }
  }

  async startStream(config: LiveStreamConfig): Promise<boolean> {
    if (Platform.OS !== 'android' || !LiveStreamModule) return false;
    return LiveStreamModule.startStream(config);
  }

  async stopStream(): Promise<void> {
    if (!LiveStreamModule) return;
    return LiveStreamModule.stopStream();
  }

  async getStatus(): Promise<LiveStreamStatus> {
    if (!LiveStreamModule) return {isStreaming: false, duration: 0};
    return LiveStreamModule.getStatus();
  }

  onStreamStatus(callback: (status: LiveStreamStatus) => void) {
    return this.emitter.addListener('LiveStreamStatus', callback);
  }

  onStreamError(callback: (error: string) => void) {
    return this.emitter.addListener('LiveStreamError', callback);
  }
}

export const LiveStream = new LiveStreamClass();
