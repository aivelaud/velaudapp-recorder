import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

export type Lang = 'tr' | 'en';

type Dict = Record<string, string>;

const tr: Dict = {
  // Home
  'home.brand': 'Velaud Recorder',
  'home.startRecording': 'Ekran Kaydını Başlat',
  'home.startButton': 'Kaydı Başlat',
  'home.stopButton': 'Kaydı Durdur',
  'home.pause': 'Duraklat',
  'home.resume': 'Devam Et',
  'home.recording': 'KAYIT YAPILIYOR',
  'home.paused': 'DURAKLATILDI',
  'home.live': 'CANLI',
  'home.audioOn': 'Ses Açık',
  'home.audioOff': 'Sessiz',
  'home.audioOnShort': 'Sesli',
  'home.audioOffShort': 'Sessiz',
  'home.touches': 'Dokunma',
  'home.saved': 'Kayıt tamamlandı',
  'home.recError': 'Kayıt Hatası',
  'home.startFailed': 'Başlatılamadı',
  'home.startFailedMsg': 'Ekran kaydı izni reddedildi.',
  'home.overlayTitle': 'Ekran Üstü İzni',
  'home.overlayMsg': 'Kayıt sırasında kayan kontrol paneli için "Diğer uygulamaların üzerinde göster" iznini verin.',
  'home.overlayGoSettings': 'Ayarlara Git',
  'home.overlayCancel': 'Vazgeç',
  'home.audioPermissionTitle': 'Mikrofon İzni',
  'home.audioPermissionMsg': 'Ses kaydı için mikrofon gerekli.',
  'home.audioPermissionGrant': 'Ver',
  'home.audioPermissionDeny': 'Reddet',
  'home.audioDisabled': 'Ses devre dışı bırakıldı',
  'home.error': 'Hata',
  'home.unknownError': 'Bilinmeyen bir hata oluştu.',

  // Settings — title
  'settings.title': 'Ayarlar',
  'settings.version': 'Sürüm',

  // Settings — Video
  'settings.video': 'Video',
  'settings.resolution': 'Çözünürlük',
  'settings.fps': 'Kare Hızı (FPS)',

  // Settings — Audio
  'settings.audio': 'Ses',
  'settings.audioSource': 'Ses Kaynağı',
  'settings.mic': 'Mikrofon',
  'settings.internal': 'Dahili Ses',
  'settings.both': 'Dahili + Mikrofon',
  'settings.silent': 'Sessiz',
  'settings.volume': 'Hacim',
  'settings.noiseReduction': 'Gürültü Azaltma',
  'settings.noiseReductionDesc': 'Arka plan gürültüsünü azaltır',

  // Settings — Control
  'settings.control': 'Kontrol',
  'settings.countdown': 'Geri Sayım',
  'settings.countdownOff': 'Kapalı',
  'settings.hidePopup': 'Kayıt Sonrası Pencereyi Gizle',
  'settings.hidePopupDesc': 'Kayıt bittiğinde önizleme penceresi açılmaz',
  'settings.showTouches': 'Dokunmaları Göster',
  'settings.showTouchesDesc': 'Ekrandaki dokunma noktaları kayda eklenir',
  'settings.shakeToStop': 'Kaydı Durdurmak için Salla',
  'settings.shakeToStopDesc': 'Cihazı sallayarak kaydı durdurun',
  'settings.shakeSensitivity': 'Sallama Hassasiyeti',

  // Settings — Others
  'settings.others': 'Diğerleri',
  'settings.saveLocation': 'Kaydetme Konumu',
  'settings.trash': 'Çöp Kutusu (24 Saat)',
  'settings.trashDesc': 'Sildiğiniz dosyalar 24 saate kadar saklanacaktır',
  'settings.language': 'Dil',
  'settings.langSystem': 'Sistem',
  'settings.langTurkish': 'Türkçe',
  'settings.langEnglish': 'English',

  // Settings — misc
  'settings.disabledByDefault': 'Varsayılan devre dışı bırakıldı',
};

const en: Dict = {
  // Home
  'home.brand': 'Velaud Recorder',
  'home.startRecording': 'Start Screen Recording',
  'home.startButton': 'Start Recording',
  'home.stopButton': 'Stop Recording',
  'home.pause': 'Pause',
  'home.resume': 'Resume',
  'home.recording': 'RECORDING',
  'home.paused': 'PAUSED',
  'home.live': 'LIVE',
  'home.audioOn': 'Audio On',
  'home.audioOff': 'Silent',
  'home.audioOnShort': 'With Audio',
  'home.audioOffShort': 'Silent',
  'home.touches': 'Touches',
  'home.saved': 'Recording saved',
  'home.recError': 'Recording Error',
  'home.startFailed': 'Failed to Start',
  'home.startFailedMsg': 'Screen recording permission denied.',
  'home.overlayTitle': 'Overlay Permission',
  'home.overlayMsg': 'Allow "Display over other apps" to show the floating control panel during recording.',
  'home.overlayGoSettings': 'Go to Settings',
  'home.overlayCancel': 'Cancel',
  'home.audioPermissionTitle': 'Microphone Permission',
  'home.audioPermissionMsg': 'Microphone is required for audio recording.',
  'home.audioPermissionGrant': 'Grant',
  'home.audioPermissionDeny': 'Deny',
  'home.audioDisabled': 'Audio disabled',
  'home.error': 'Error',
  'home.unknownError': 'An unknown error occurred.',

  // Settings — title
  'settings.title': 'Settings',
  'settings.version': 'Version',

  // Settings — Video
  'settings.video': 'Video',
  'settings.resolution': 'Resolution',
  'settings.fps': 'Frame Rate (FPS)',

  // Settings — Audio
  'settings.audio': 'Audio',
  'settings.audioSource': 'Audio Source',
  'settings.mic': 'Microphone',
  'settings.internal': 'Internal Audio',
  'settings.both': 'Internal + Microphone',
  'settings.silent': 'Silent',
  'settings.volume': 'Volume',
  'settings.noiseReduction': 'Noise Reduction',
  'settings.noiseReductionDesc': 'Reduces background noise',

  // Settings — Control
  'settings.control': 'Control',
  'settings.countdown': 'Countdown',
  'settings.countdownOff': 'Off',
  'settings.hidePopup': 'Hide Post-Recording Popup',
  'settings.hidePopupDesc': 'Preview popup will not appear after recording',
  'settings.showTouches': 'Show Touches',
  'settings.showTouchesDesc': 'Touch points are included in the recording',
  'settings.shakeToStop': 'Shake to Stop Recording',
  'settings.shakeToStopDesc': 'Shake the device to stop recording',
  'settings.shakeSensitivity': 'Shake Sensitivity',

  // Settings — Others
  'settings.others': 'Others',
  'settings.saveLocation': 'Save Location',
  'settings.trash': 'Trash (24 Hours)',
  'settings.trashDesc': 'Deleted files are kept for up to 24 hours',
  'settings.language': 'Language',
  'settings.langSystem': 'System',
  'settings.langTurkish': 'Türkçe',
  'settings.langEnglish': 'English',

  // Settings — misc
  'settings.disabledByDefault': 'Disabled by default',
};

const dicts: Record<Lang, Dict> = {tr, en};

const LANG_KEY = '@velaud_lang';

let currentLang: Lang = 'tr';
let ready = false;

function detectSystemLang(): Lang {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (locale && locale.toLowerCase().startsWith('tr')) return 'tr';
  } catch {}
  return 'en';
}

export const i18n = {
  async init(pref: string): Promise<Lang> {
    if (pref === 'system' || !pref) {
      currentLang = detectSystemLang();
    } else {
      currentLang = pref as Lang;
    }
    ready = true;
    return currentLang;
  },

  get lang(): Lang {
    return currentLang;
  },

  t(key: string): string {
    return dicts[currentLang]?.[key] ?? dicts.en[key] ?? key;
  },
};

export type TFunc = typeof i18n.t;
export default i18n;
