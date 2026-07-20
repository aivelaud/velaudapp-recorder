import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {SettingsManager, AppSettings} from '../modules/SettingsManager';

type ResolutionOption = '720p' | '1080p' | 'device';
type FpsOption = 30 | 60;

// ─── Sub-components ────────────────────────────────────────────────────────

/** Midas-style flat row with divider */
function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.6 : 1}>
        <View style={styles.rowIconWrap}>
          <Icon name={icon} size={19} color={Colors.textSecondary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowRight}>
          {value ? (
            <Text style={styles.rowValue}>{value}</Text>
          ) : null}
          {onPress ? (
            <Icon name="chevron-right" size={18} color={Colors.textMuted} style={{marginLeft: 4}} />
          ) : null}
        </View>
      </TouchableOpacity>
      {!last && <View style={styles.divider} />}
    </>
  );
}

/** Toggle row */
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

/** Section header label */
function SectionHead({title}: {title: string}) {
  return <Text style={styles.sectionHead}>{title}</Text>;
}

/** Section card wrapper */
function Section({children}: {children: React.ReactNode}) {
  return <View style={styles.section}>{children}</View>;
}

// ─── Bottom Sheet Modal (Midas-style) ─────────────────────────────────────
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
  options: {label: string; desc: string; value: T}[];
  selected: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        {/* Handle */}
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
                  <Text
                    style={[
                      styles.modalOptionLabel,
                      isSelected && {color: Colors.primary},
                    ]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.modalOptionDesc}>{opt.desc}</Text>
                </View>
                {isSelected && (
                  <Icon name="check-circle" size={20} color={Colors.primary} />
                )}
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

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    resolution: 'device',
    fps: 30,
    includeAudio: true,
    showTouches: false,
    saveFolder: 'Movies/VelaudRecorder',
  });
  const [showResModal, setShowResModal] = useState(false);
  const [showFpsModal, setShowFpsModal] = useState(false);

  useEffect(() => {
    SettingsManager.load().then(setSettings);
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = {...settings, ...patch};
    setSettings(updated);
    await SettingsManager.save(patch);
  }, [settings]);

  const resolutions: {label: string; desc: string; value: ResolutionOption}[] = [
    {label: '720p — HD', desc: 'Küçük dosya boyutu, standart kalite', value: '720p'},
    {label: '1080p — Full HD', desc: 'Önerilen. Netlik ve boyut dengesi', value: '1080p'},
    {label: 'Cihaz çözünürlüğü', desc: 'Ekranın tam çözünürlüğünde kaydet', value: 'device'},
  ];

  const fpsOptions: {label: string; desc: string; value: FpsOption}[] = [
    {label: '30 FPS', desc: 'Standart — küçük dosya boyutu', value: 30},
    {label: '60 FPS', desc: 'Ultra akıcı — büyük dosya boyutu', value: 60},
  ];

  const resLabel = settings.resolution === 'device' ? 'Cihaz' : settings.resolution;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>

        {/* Page title (Midas-style inline header) */}
        <Text style={styles.pageTitle}>Ayarlar</Text>

        {/* ── Video kalitesi ─────────────────────────────────────────── */}
        <SectionHead title="VİDEO KALİTESİ" />
        <Section>
          <Row
            icon="quality-high"
            label="Çözünürlük"
            value={resLabel}
            onPress={() => setShowResModal(true)}
          />
          <Row
            icon="filmstrip"
            label="Kare Hızı"
            value={`${settings.fps} FPS`}
            onPress={() => setShowFpsModal(true)}
            last
          />
        </Section>

        {/* ── Ses ve kontrol ────────────────────────────────────────── */}
        <SectionHead title="SES VE KONTROL" />
        <Section>
          <ToggleRow
            icon="microphone"
            label="Ses Kaydı"
            desc="Mikrofon sesini kayda dahil et"
            value={settings.includeAudio}
            onValueChange={v => update({includeAudio: v})}
          />
          <ToggleRow
            icon="gesture-tap"
            label="Dokunma Göstergesi"
            desc="Ekrana dokunulan noktaları göster"
            value={settings.showTouches}
            onValueChange={v => update({showTouches: v})}
            last
          />
        </Section>

        {/* ── Depolama ──────────────────────────────────────────────── */}
        <SectionHead title="DEPOLAMA" />
        <Section>
          <Row
            icon="folder-outline"
            label="Kayıt Konumu"
            value={`/${settings.saveFolder}`}
            last
          />
        </Section>

        {/* ── Hakkında ──────────────────────────────────────────────── */}
        <SectionHead title="HAKKINDA" />
        <Section>
          <Row
            icon="information-outline"
            label="Velaud Recorder"
            value="v2.2.1"
            last
          />
        </Section>

        {/* App signature */}
        <View style={styles.signature}>
          <View style={styles.sigLogo}>
            <Icon name="record-circle" size={16} color={Colors.white} />
          </View>
          <Text style={styles.sigText}>Velaud Recorder</Text>
          <Text style={styles.sigSub}>Profesyonel ekran kaydedici</Text>
        </View>
      </ScrollView>

      {/* Çözünürlük seçici */}
      <PickerModal
        visible={showResModal}
        title="Çözünürlük Seç"
        options={resolutions}
        selected={settings.resolution}
        onSelect={v => update({resolution: v})}
        onClose={() => setShowResModal(false)}
      />

      {/* FPS seçici */}
      <PickerModal
        visible={showFpsModal}
        title="Kare Hızı Seç"
        options={fpsOptions}
        selected={settings.fps}
        onSelect={v => update({fps: v})}
        onClose={() => setShowFpsModal(false)}
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

  // Midas-style flat rows
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
    marginLeft: 16 + 32 + 12, // align with text, skip icon
  },

  // Bottom sheet modal
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
