import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';

export type ResolutionOption = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p';
export type FpsOption = 30 | 60 | 90 | 120;
export type AudioSource = 'microphone' | 'internal' | 'both' | 'none';
export type CountdownOption = 'off' | '3s' | '5s' | '10s';
export type LanguageOption = 'system' | 'tr' | 'en';

export interface AppSettings {
  // Video
  resolution: ResolutionOption;
  fps: FpsOption;
  // Audio
  audioSource: AudioSource;
  volume: number; // 0–200
  noiseReduction: boolean;
  // Control
  countdown: CountdownOption;
  hidePostRecordingPopup: boolean;
  showTouches: boolean;
  shakeToStop: boolean;
  shakeSensitivity: number; // 10–100
  // Others
  saveFolder: string;
  trashEnabled: boolean; // keep deleted files 24h
  language: LanguageOption;
}

const DEFAULT_SETTINGS: AppSettings = {
  resolution: '1080p',
  fps: 30,
  audioSource: 'microphone',
  volume: 100,
  noiseReduction: false,
  countdown: '3s',
  hidePostRecordingPopup: false,
  showTouches: false,
  shakeToStop: false,
  shakeSensitivity: 50,
  saveFolder: 'Movies/VelaudRecorder',
  trashEnabled: true,
  language: 'system',
};

const SETTINGS_KEY = '@velaud_settings';

export const SettingsManager = {
  async load(): Promise<AppSettings> {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!json) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(json);
      // Validate resolution against supported list
      const validRes = ['144p','240p','360p','480p','720p','1080p'];
      if (!validRes.includes(parsed.resolution)) parsed.resolution = DEFAULT_SETTINGS.resolution;
      return {...DEFAULT_SETTINGS, ...parsed};
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async save(settings: Partial<AppSettings>): Promise<void> {
    try {
      const current = await SettingsManager.load();
      const updated = {...current, ...settings};
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('SettingsManager.save error:', e);
    }
  },

  getResolutionDimensions(resolution: ResolutionOption): {width: number; height: number} {
    switch (resolution) {
      case '144p': return {width: 256, height: 144};
      case '240p': return {width: 426, height: 240};
      case '360p': return {width: 640, height: 360};
      case '480p': return {width: 854, height: 480};
      case '720p': return {width: 1280, height: 720};
      case '1080p': return {width: 1920, height: 1080};
      default: return {width: 0, height: 0};
    }
  },

  // Device-capability caps — set at runtime from native
  deviceMaxResolution: '1080p' as ResolutionOption,
  deviceMaxFps: 120 as FpsOption,
};
