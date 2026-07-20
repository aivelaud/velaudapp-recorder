import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  resolution: '720p' | '1080p' | 'device';
  fps: 30 | 60;
  includeAudio: boolean;
  showTouches: boolean;
  saveFolder: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  resolution: 'device',
  fps: 30,
  includeAudio: true,
  showTouches: false,
  saveFolder: 'Movies/VelaudRecorder',
};

const SETTINGS_KEY = '@velaud_settings';

export const SettingsManager = {
  async load(): Promise<AppSettings> {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!json) return DEFAULT_SETTINGS;
      return {...DEFAULT_SETTINGS, ...JSON.parse(json)};
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

  getResolutionDimensions(resolution: AppSettings['resolution']): {width: number; height: number} {
    switch (resolution) {
      case '720p':
        return {width: 1280, height: 720};
      case '1080p':
        return {width: 1920, height: 1080};
      default:
        return {width: 0, height: 0}; // 0 = device resolution
    }
  },
};
