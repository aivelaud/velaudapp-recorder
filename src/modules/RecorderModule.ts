import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {ScreenRecorderModule, FloatingPanelModule} = NativeModules;

export interface RecordingConfig {
  width?: number;
  height?: number;
  fps?: number;
  audioBitRate?: number;
  videoBitRate?: number;
  showTouches?: boolean;
  includeAudio?: boolean;
}

export interface RecordingStatus {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  filePath?: string;
}

class RecorderModuleClass {
  private emitter: NativeEventEmitter;

  constructor() {
    if (ScreenRecorderModule) {
      this.emitter = new NativeEventEmitter(ScreenRecorderModule);
    } else {
      this.emitter = new NativeEventEmitter();
    }
  }

  /**
   * Request MediaProjection permission and start recording.
   * The native side shows the system dialog.
   */
  async startRecording(config: RecordingConfig = {}): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!ScreenRecorderModule) {
      console.warn('ScreenRecorderModule not available');
      return false;
    }
    return ScreenRecorderModule.startRecording(config);
  }

  async stopRecording(): Promise<string | null> {
    if (!ScreenRecorderModule) return null;
    return ScreenRecorderModule.stopRecording();
  }

  async pauseRecording(): Promise<void> {
    if (!ScreenRecorderModule) return;
    return ScreenRecorderModule.pauseRecording();
  }

  async resumeRecording(): Promise<void> {
    if (!ScreenRecorderModule) return;
    return ScreenRecorderModule.resumeRecording();
  }

  async getStatus(): Promise<RecordingStatus> {
    if (!ScreenRecorderModule) {
      return {isRecording: false, isPaused: false, duration: 0};
    }
    return ScreenRecorderModule.getStatus();
  }

  async checkPermissions(): Promise<boolean> {
    if (!ScreenRecorderModule) return false;
    return ScreenRecorderModule.checkPermissions();
  }

  async requestPermissions(): Promise<boolean> {
    if (!ScreenRecorderModule) return false;
    return ScreenRecorderModule.requestPermissions();
  }

  onRecordingStatus(callback: (status: RecordingStatus) => void) {
    return this.emitter.addListener('RecordingStatus', callback);
  }

  onRecordingSaved(callback: (filePath: string) => void) {
    return this.emitter.addListener('RecordingSaved', callback);
  }

  onRecordingError(callback: (error: string) => void) {
    return this.emitter.addListener('RecordingError', callback);
  }
}

class FloatingPanelModuleClass {
  async showPanel(): Promise<void> {
    if (!FloatingPanelModule) return;
    return FloatingPanelModule.showPanel();
  }

  async hidePanel(): Promise<void> {
    if (!FloatingPanelModule) return;
    return FloatingPanelModule.hidePanel();
  }

  async checkOverlayPermission(): Promise<boolean> {
    if (!FloatingPanelModule) return false;
    return FloatingPanelModule.checkOverlayPermission();
  }

  async requestOverlayPermission(): Promise<void> {
    if (!FloatingPanelModule) return;
    return FloatingPanelModule.requestOverlayPermission();
  }
}

export const Recorder = new RecorderModuleClass();
export const FloatingPanel = new FloatingPanelModuleClass();
