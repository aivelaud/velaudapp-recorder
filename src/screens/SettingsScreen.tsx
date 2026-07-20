import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {SettingsManager, AppSettings} from '../modules/SettingsManager';

type ResolutionOption = '720p' | '1080p' | 'device';
type FpsOption = 30 | 60;

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    resolution: '1080p',
    fps: 30,
    includeAudio: true,
    showTouches: false,
    saveFolder: 'Movies/VelaudRecorder',
  });

  useEffect(() => {
    SettingsManager.load().then(setSettings);
  }, []);

  const update = async (patch: Partial<AppSettings>) => {
    const updated = {...settings, ...patch};
    setSettings(updated);
    await SettingsManager.save(patch);
  };

  const resolutions: {label: string; desc: string; value: ResolutionOption}[] = [
    {label: '720p', desc: 'HD • Küçük dosya boyutu', value: '720p'},
    {label: '1080p', desc: 'Full HD • Önerilen', value: '1080p'},
    {label: 'Cihaz', desc: 'Cihaz çözünürlüğü', value: 'device'},
  ];

  const fpsOptions: {label: string; desc: string; value: FpsOption}[] = [
    {label: '30 FPS', desc: 'Standart • Küçük dosya', value: 30},
    {label: '60 FPS', desc: 'Ultra akıcı • Büyük dosya', value: 60},
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resolution */}
        <Text style={styles.sectionHeader}>VIDEO KALİTESİ</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Çözünürlük</Text>
          <View style={styles.optionsGrid}>
            {resolutions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionCard,
                  settings.resolution === opt.value && styles.optionCardSelected,
                ]}
                onPress={() => update({resolution: opt.value})}>
                <Text style={[
                  styles.optionLabel,
                  settings.resolution === opt.value && styles.optionLabelSelected,
                ]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
                {settings.resolution === opt.value && (
                  <View style={styles.checkMark}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kare Hızı</Text>
          <View style={styles.optionsRow}>
            {fpsOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.fpsCard,
                  settings.fps === opt.value && styles.fpsCardSelected,
                ]}
                onPress={() => update({fps: opt.value})}>
                <Text style={[
                  styles.fpsLabel,
                  settings.fps === opt.value && styles.fpsLabelSelected,
                ]}>
                  {opt.label}
                </Text>
                <Text style={styles.fpsDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Audio & Touch */}
        <Text style={styles.sectionHeader}>KAYIT SEÇENEKLERİ</Text>
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleEmoji}>🎙️</Text>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Ses Kaydı</Text>
                <Text style={styles.toggleDesc}>Mikrofon sesini dahil et</Text>
              </View>
            </View>
            <Switch
              value={settings.includeAudio}
              onValueChange={v => update({includeAudio: v})}
              trackColor={{false: Colors.border, true: Colors.primary}}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleEmoji}>👆</Text>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Dokunma Göstergesi</Text>
                <Text style={styles.toggleDesc}>Ekrana dokunulduğunda göster</Text>
              </View>
            </View>
            <Switch
              value={settings.showTouches}
              onValueChange={v => update({showTouches: v})}
              trackColor={{false: Colors.border, true: Colors.primary}}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Storage Info */}
        <Text style={styles.sectionHeader}>DEPOLAMA</Text>
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>📁</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Kayıt Konumu</Text>
              <Text style={styles.infoValue}>/{settings.saveFolder}</Text>
              <Text style={styles.infoDesc}>
                Tüm kayıtlar cihazınızda yerel olarak saklanır
              </Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>Velaud Recorder</Text>
          <Text style={styles.aboutVersion}>v2.0.0 (build 11)</Text>
          <Text style={styles.aboutDesc}>
            Profesyonel ekran kaydedici • Gizlilik odaklı
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: 20, paddingBottom: 40},
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
    paddingLeft: 4,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  optionsGrid: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'column',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  optionLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  checkMark: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fpsCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  fpsCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  fpsLabel: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '800',
  },
  fpsLabelSelected: {
    color: Colors.primary,
  },
  fpsDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleEmoji: {
    fontSize: 24,
  },
  toggleInfo: {flex: 1},
  toggleLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoEmoji: {
    fontSize: 24,
    marginTop: 2,
  },
  infoContent: {flex: 1},
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  infoDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  aboutTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  aboutVersion: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  aboutDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
});