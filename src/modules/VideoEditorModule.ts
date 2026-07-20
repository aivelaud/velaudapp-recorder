import {NativeModules, Platform} from 'react-native';

const {VideoEditorModule} = NativeModules;

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  rotation: number;
  bitrate: number;
  fps: number;
}

export interface ExportConfig {
  filePath: string;
  startMs: number;
  endMs: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  textOverlay?: string;
}

class VideoEditorModuleClass {
  async getVideoInfo(filePath: string): Promise<VideoInfo> {
    if (!VideoEditorModule) throw new Error('VideoEditorModule not available');
    return VideoEditorModule.getVideoInfo(filePath);
  }

  async exportVideo(config: ExportConfig): Promise<string> {
    if (!VideoEditorModule) throw new Error('VideoEditorModule not available');
    return VideoEditorModule.exportVideo(config);
  }

  async saveToGallery(filePath: string): Promise<string> {
    if (!VideoEditorModule) throw new Error('VideoEditorModule not available');
    return VideoEditorModule.saveToGallery(filePath);
  }
}

export const VideoEditor = new VideoEditorModuleClass();
