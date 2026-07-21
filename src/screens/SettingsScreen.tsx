import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import {Colors} from '../theme/colors';
import {
  SettingsManager,
  AppSettings,
  ResolutionOption,
  FpsOption,
  AudioSource,
  CountdownOption,
  LanguageOption,
} from '../modules/SettingsManager';
import {Recorder} from '../modules/RecorderModule';

type SectionName = 'main' | 'audio';

// ─── Sub-components ────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
  onPress,
  last,
  iconColor,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  iconColor?: string;
}) {
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.6 : 1}>
        <View style={styles.rowIconWrap}>
          <Icon name={icon} size={19} color={iconColor ?? Colors.textSecondary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? (
            <Icon name="chevron-right" size={18} color={Colors.textMuted} style={{marginLeft: 4}} />
          ) : null}
        </View>
      </TouchableOpacity>
      {!last && <View style={styles.divider} />}
    </>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onValueChange,
  last,
}: {
  icon: string;
  label: string;
  desc?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <>
      <View style={styles.row}>
        <View style={styles.rowIconWrap}>
          <Icon name={icon} size={19} color={Colors.textSecondary} />
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.rowLabel}>{label}</Text>
          {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{false: Colors.surfaceHighlight, true: Colors.primary}}
          thumbColor={Colors.white}
          style={{marginLeft: 8}}
        />
      </View>
      {!last && <View style={styles.divider} />}
    </>
  );
}

function SectionHead({title}: {title: string}) {
  return <Text style={styles.sectionHead}>{title}</Text>;
}

function Section({children}: {children: React.ReactNode}) {
  return <View style={styles.section}>{children}</View>;
}

// ─── Bottom Sheet Modal ────────────────────────────────────────────────────
function PickerModal<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: {label: string; desc?: string; value: T}[];
  selected: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>{title}</Text>
        {options.map((opt, i) => {
          const isSelected = opt.value === selected;
          return (
            <React.Fragment key={String(opt.value)}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                activeOpacity={0.65}>
                <View style={{flex: 1}}>
                  <Text style={[styles.modalOptionLabel, isSelected && {color: Colors.primary}]}>
                    {opt.label}
                  </Text>
                  {opt.desc ? <Text style={styles.modalOptionDesc}>{opt.desc}</Text> : null}
                </View>
                {isSelected && <Icon name="check-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
              {i < options.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
        <TouchableOpacity style={styles.modalCancel} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.modalCancelText}>Vazgeç</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Audio source bubble selector ──────────────────────────────────────────
function AudioSourceBubbles({
  value,
  onSelect,
}: {
  value: AudioSource;
  onSelect: (v: AudioSource) => void;
}) {
  const sources: {key: AudioSource; icon: string; label: string}[] = [
    {key: 'microphone', icon: 'microphone', label: 'Mikrofon'},
    {key: 'internal', icon: 'volume-high', label: 'Dahili Ses'},
    {key: 'both', icon: 'microphone-plus', label: 'Dahili + Mikrofon'},
    {key: 'none', icon: 'volume-off', label: 'Sessiz'},
  ];
  return (
    <View style={styles.bubbleRow}>
      {sources.map((s) => {
        const active = value === s.key;
        return (
          <TouchableOpacity
            key={s.key}
            style={[styles.bubble, active && styles.bubbleActive]}
            onPress={() => onSelect(s.key)}
            activeOpacity={0.7}>
            <Icon
              name={s.icon}
              size={22}
              color={active ? Colors.white : Colors.textSecondary}
            />
            <Text
              style={[styles.bubbleLabel, active && styles.bubbleLabelActive]}
              numberOfLines={1}>
              {s.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
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
  });
  const [section, setSection] = useState<SectionName>('main');
  const [showResModal, setShowResModal] = useState(false);
  const [showFpsModal, setShowFpsModal] = useState(false);
  const [showCountdownModal, setShowCountdownModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [deviceCaps, setDeviceCaps] = useState<{maxResolution: string; maxFps: number}>({
    maxResolution: '1080p',
    maxFps: 120,
  });

  useEffect(() => {
    SettingsManager.load().then(setSettings);
    Recorder.getDeviceCapabilities().then(setDeviceCaps).catch(() => {});
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = {...prev, ...patch};
      SettingsManager.save(patch);
      return next;
    });
  }, []);

  // ── Device-capped resolution options ────────────────────────────────────
  const resOrder: ResolutionOption[] = ['144p','240p','360p','480p','720p','1080p'];
  const maxResIdx = resOrder.indexOf(deviceCaps.maxResolution as ResolutionOption);
  const availableResolutions = useMemo(() => {
    return resOrder
      .slice(0, maxResIdx + 1)
      .map((r) => ({
        label: r === '1080p' ? '1080p — Full HD' : r.toUpperCase(),
        desc: resDesc(r),
        value: r,
      }));
  }, [maxResIdx]);

  function resDesc(r: ResolutionOption): string {
    switch (r) {
      case '144p': return 'Çok düşük kalite, en küçük dosya';
      case '240p': return 'Düşük kalite, küçük dosya';
      case '360p': return 'Standart kalite';
      case '480p': return 'İyi kalite';
      case '720p': return 'HD — önerilen denge';
      case '1080p': return 'Full HD — en yüksek kalite';
    }
  }

  // ── Device-capped FPS options ───────────────────────────────────────────
  const fpsOrder: FpsOption[] = [30, 60, 90, 120];
  const maxFpsIdx = fpsOrder.indexOf(deviceCaps.maxFps as FpsOption);
  const availableFps = useMemo(() => {
    return fpsOrder
      .slice(0, maxFpsIdx + 1)
      .map((f) => ({
        label: `${f} FPS`,
        desc: fpsDesc(f),
        value: f,
      }));
  }, [maxFpsIdx]);

  function fpsDesc(f: FpsOption): string {
    switch (f) {
      case 30: return 'Standart — küçük dosya';
      case 60: return 'Akıcı — büyük dosya';
      case 90: return 'Yüksek akıcılık';
      case 120: return 'Ultra akıcı — en büyük dosya';
    }
  }

  // Clamp current settings to device caps
  useEffect(() => {
    if (resOrder.indexOf(settings.resolution) > maxResIdx && maxResIdx >= 0) {
      update({resolution: resOrder[maxResIdx]});
    }
    if (fpsOrder.indexOf(settings.fps) > maxFpsIdx && maxFpsIdx >= 0) {
      update({fps: fpsOrder[maxFpsIdx]});
    }
  }, [deviceCaps]);

  const countdownOptions: {label: string; desc?: string; value: CountdownOption}[] = [
    {label: 'Kapalı', desc: 'Geri sayım gösterme', value: 'off'},
    {label: '3 saniye', value: '3s'},
    {label: '5 saniye', value: '5s'},
    {label: '10 saniye', value: '10s'},
  ];

  const langOptions: {label: string; desc?: string; value: LanguageOption}[] = [
    {label: 'Sistem Varsayılanı', value: 'system'},
    {label: 'Türkçe', value: 'tr'},
    {label: 'English', value: 'en'},
  ];

  const audioSourceLabel: Record<AudioSource, string> = {
    microphone: 'Mikrofon',
    internal: 'Dahili Ses',
    both: 'Dahili + Mikrofon',
    none: 'Sessiz',
  };

  // ── Audio sub-page ──────────────────────────────────────────────────────
  if (section === 'audio') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.subHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSection('main')}>
            <Icon name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.subTitle}>Ses Ayarları</Text>
          <View style={{width: 40}} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Audio source bubbles */}
          <SectionHead title="SES KAYNAĞI" />
          <Section>
            <View style={styles.bubbleSection}>
              <AudioSourceBubbles
                value={settings.audioSource}
                onSelect={(v) => update({audioSource: v})}
              />
            </View>
          </Section>

          {/* Volume slider */}
          <SectionHead title="HACİM" />
          <Section>
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Icon name="volume-low" size={18} color={Colors.textMuted} />
                <Text style={styles.sliderValue}>{settings.volume}%</Text>
                <Icon name="volume-high" size={18} color={Colors.textMuted} />
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={200}
                step={5}
                value={settings.volume}
                onValueChange={(v) => update({volume: Math.round(v)})}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.surfaceHighlight}
                thumbTintColor={Colors.white}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelText}>%0</Text>
                <Text style={styles.sliderLabelText}>%200</Text>
              </View>
            </View>
          </Section>

          {/* Noise reduction */}
          <SectionHead title="GÜRÜLTÜ AZALTMA" />
          <Section>
            <ToggleRow
              icon="noise-cancellation"
              label="Gürültü Azaltma"
              desc="Gürültüyü azaltın ancak bu durum ses kalitesini etkileyebilir."
              value={settings.noiseReduction}
              onValueChange={(v) => update({noiseReduction: v})}
              last
            />
          </Section>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main settings page ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Ayarlar</Text>

        {/* ── Video ────────────────────────────────────────────────────── */}
        <SectionHead title="VİDEO" />
        <Section>
          <Row
            icon="quality-high"
            label="Çözünürlük"
            value={settings.resolution.toUpperCase()}
            onPress={() => setShowResModal(true)}
          />
          <Row
            icon="filmstrip"
            label="Kare Hızı"
            value={`${settings.fps} FPS`}
            onPress={() => setShowFpsModal(true)}
          />
          <Row
            icon="volume-high"
            label="Ses Ayarları"
            value={audioSourceLabel[settings.audioSource]}
            onPress={() => setSection('audio')}
            last
          />
        </Section>

        {/* ── Kontrol ──────────────────────────────────────────────────── */}
        <SectionHead title="KONTROL" />
        <Section>
          <Row
            icon="timer-outline"
            label="Geri Sayım"
            value={
              settings.countdown === 'off'
                ? 'Kapalı'
                : settings.countdown.replace('s', ' sn')
            }
            onPress={() => setShowCountdownModal(true)}
          />
          <ToggleRow
            icon="eye-off-outline"
            label="Kayıt Sonrası Açılır Penceresini Gizle"
            value={settings.hidePostRecordingPopup}
            onValueChange={(v) => update({hidePostRecordingPopup: v})}
          />
          <ToggleRow
            icon="gesture-tap"
            label="Dokunmayı Göster"
            value={settings.showTouches}
            onValueChange={(v) => update({showTouches: v})}
          />
          {/* Shake to stop */}
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Icon name="vibrate" size={19} color={Colors.textSecondary} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.rowLabel}>Kaydı Durdurmak İçin Salla</Text>
              <Text style={styles.rowDesc}>Varsayılan devre dışı bırakıldı</Text>
            </View>
            <Switch
              value={settings.shakeToStop}
              onValueChange={(v) => update({shakeToStop: v})}
              trackColor={{false: Colors.surfaceHighlight, true: Colors.primary}}
              thumbColor={Colors.white}
              style={{marginLeft: 8}}
            />
          </View>
          {!settings.shakeToStop && <View style={styles.divider} />}
          {settings.shakeToStop && (
            <View style={styles.sliderSection}>
              <View style={styles.sliderHeader}>
                <Text style={styles.rowLabelSmall}>Hassasiyet</Text>
                <Text style={styles.sliderValue}>{settings.shakeSensitivity}%</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={100}
                step={5}
                value={settings.shakeSensitivity}
                onValueChange={(v) => update({shakeSensitivity: Math.round(v)})}
                minimumTrackTintColor={Colors.primary}
                maximumTrackTintColor={Colors.surfaceHighlight}
                thumbTintColor={Colors.white}
              />
              <View style={styles.divider} />
            </View>
          )}
        </Section>

        {/* ── Diğerleri ────────────────────────────────────────────────── */}
        <SectionHead title="DİĞERLERİ" />
        <Section>
          <Row
            icon="folder-outline"
            label="Kaydetme Konumu"
            value={`/storage/${settings.saveFolder}`}
            last={false}
          />
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Icon name="trash-can-outline" size={19} color={Colors.textSecondary} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.rowLabel}>Çöp Kutusu</Text>
              <Text style={styles.rowDesc}>Sildiğiniz dosyalar 24 saate kadar saklanacaktır</Text>
            </View>
            <Switch
              value={settings.trashEnabled}
              onValueChange={(v) => update({trashEnabled: v})}
              trackColor={{false: Colors.surfaceHighlight, true: Colors.primary}}
              thumbColor={Colors.white}
              style={{marginLeft: 8}}
            />
          </View>
          <View style={styles.divider} />
          <Row
            icon="translate"
            label="Dil"
            value={
              settings.language === 'system'
                ? 'Sistem Varsayılanı'
                : settings.language === 'tr'
                ? 'Türkçe'
                : 'English'
            }
            onPress={() => setShowLangModal(true)}
          />
          <View style={styles.divider} />
          <Row
            icon="information-outline"
            label="Versiyon"
            value="v2.5.0"
            last
          />
        </Section>

        {/* App signature */}
        <View style={styles.signature}>
          <Image
            source={require('../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png')}
            style={styles.sigLogo}
          />
          <Text style={styles.sigText}>Velaud Recorder</Text>
          <Text style={styles.sigSub}>Profesyonel ekran kaydedici</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <PickerModal
        visible={showResModal}
        title="Çözünürlük Seç"
        options={availableResolutions}
        selected={settings.resolution}
        onSelect={(v: ResolutionOption) => update({resolution: v})}
        onClose={() => setShowResModal(false)}
      />
      <PickerModal
        visible={showFpsModal}
        title="Kare Hızı Seç"
        options={availableFps}
        selected={settings.fps}
        onSelect={(v: FpsOption) => update({fps: v})}
        onClose={() => setShowFpsModal(false)}
      />
      <PickerModal
        visible={showCountdownModal}
        title="Geri Sayım"
        options={countdownOptions}
        selected={settings.countdown}
        onSelect={(v: CountdownOption) => update({countdown: v})}
        onClose={() => setShowCountdownModal(false)}
      />
      <PickerModal
        visible={showLangModal}
        title="Dil Seç"
        options={langOptions}
        selected={settings.language}
        onSelect={(v: LanguageOption) => update({language: v})}
        onClose={() => setShowLangModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: Colors.background},
  content: {paddingHorizontal: 20, paddingBottom: 40},

  pageTitle: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 24,
  },

  // Sub-page header
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
  },

  sectionHead: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
    paddingLeft: 2,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 54,
  },
  rowIconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    color: Colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  rowLabelSmall: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  rowDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 60,
  },

  // Bubble selector
  bubbleSection: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bubble: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
  },
  bubbleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bubbleLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  bubbleLabelActive: {
    color: Colors.white,
  },

  // Slider
  sliderSection: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderValue: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sliderLabelText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalOptionLabel: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  modalOptionDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  modalCancel: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },

  // Signature
  signature: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  sigLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginBottom: 4,
  },
  sigText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  sigSub: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
