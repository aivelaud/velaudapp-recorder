import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {ScreenRecorderModule, FloatingPanelModule, PreviewOverlayModule} = NativeModules;

export interface RecordingConfig {
  width?: number;
  height?: number;
  fps?: number;
  audioBitRate?: number;
  videoBitRate?: number;
  showTouches?: boolean;
  includeAudio?: boolean;
  audioSource?: string;
  volume?: number;
  noiseReduction?: boolean;
  countdown?: string;
  hidePostRecordingPopup?: boolean;
  shakeToStop?: boolean;
  shakeSensitivity?: number;
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
    // NativeEventEmitter() without a module arg throws in RN 0.73+.
    // Always pass the module if available; fall back to a bare emitter only
    // when definitely unavailable (non-Android or module missing).
    if (ScreenRecorderModule) {
      this.emitter = new NativeEventEmitter(ScreenRecorderModule);
    } else {
      // Safe no-op emitter — subscription methods still work, they just
      // never fire. This prevents a hard crash in non-Android environments.
      this.emitter = {
        addListener: (_event: string, _handler: (...args: any[]) => any) => ({
          remove: () => {},
        }),
      } as unknown as NativeEventEmitter;
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

  async getDeviceCapabilities(): Promise<{maxResolution: string; maxFps: number; refreshRate: number}> {
    if (!ScreenRecorderModule) return {maxResolution: '1080p', maxFps: 60, refreshRate: 60};
    return ScreenRecorderModule.getDeviceCapabilities();
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

class PreviewOverlayModuleClass {
  async showPreview(filePath: string): Promise<void> {
    if (!PreviewOverlayModule) return;
    return PreviewOverlayModule.showPreview(filePath);
  }

  async hidePreview(): Promise<void> {
    if (!PreviewOverlayModule) return;
    return PreviewOverlayModule.hidePreview();
  }
}

export const PreviewOverlay = new PreviewOverlayModuleClass();
