import {NativeModules} from 'react-native';

const {VideoLibraryModule} = NativeModules;

export interface VideoItem {
  id: string;
  title: string;
  displayName: string;
  filePath: string;
  duration: number; // ms
  size: number; // bytes
  dateAdded: number; // unix timestamp ms
  width: number;
  height: number;
  thumbnailPath?: string;
}

class VideoLibraryModuleClass {
  async getRecordedVideos(): Promise<VideoItem[]> {
    if (!VideoLibraryModule) return [];
    return VideoLibraryModule.getRecordedVideos();
  }

  async deleteVideo(filePath: string): Promise<boolean> {
    if (!VideoLibraryModule) return false;
    return VideoLibraryModule.deleteVideo(filePath);
  }

  async getVideoThumbnail(filePath: string, timeMs?: number): Promise<string | null> {
    if (!VideoLibraryModule) return null;
    return VideoLibraryModule.getVideoThumbnail(filePath, timeMs ?? 1000);
  }
}

export const VideoLibrary = new VideoLibraryModuleClass();
