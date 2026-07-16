import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
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

  const resolutions: {label: string; value: ResolutionOption}[] = [
    {label: '720p (HD)', value: '720p'},
    {label: '1080p (Full HD)', value: '1080p'},
    {label: 'Cihaz Çözünürlüğü', value: 'device'},
  ];

  const fpsOptions: {label: string; value: FpsOption}[] = [
    {label: '30 FPS (Akıcı, Küçük Dosya)', value: 30},
    {label: '60 FPS (Çok Akıcı)', value: 60},
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Resolution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Çözünürlük</Text>
          {resolutions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionRow, settings.resolution === opt.value && styles.optionRowSelected]}
              onPress={() => update({resolution: opt.value})}>
              <Text style={[styles.optionText, settings.resolution === opt.value && styles.optionTextSelected]}>
                {opt.label}
              </Text>
              <View style={[styles.radio, settings.resolution === opt.value && styles.radioSelected]}>
                {settings.resolution === opt.value && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* FPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FPS (Kare Hızı)</Text>
          {fpsOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionRow, settings.fps === opt.value && styles.optionRowSelected]}
              onPress={() => update({fps: opt.value})}>
              <Text style={[styles.optionText, settings.fps === opt.value && styles.optionTextSelected]}>
                {opt.label}
              </Text>
              <View style={[styles.radio, settings.fps === opt.value && styles.radioSelected]}>
                {settings.fps === opt.value && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kayıt Seçenekleri</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Ses Kayıt (Mikrofon)</Text>
              <Text style={styles.toggleDesc}>Kayıt sırasında mikrofon sesini dahil et</Text>
            </View>
            <Switch
              value={settings.includeAudio}
              onValueChange={v => update({includeAudio: v})}
              trackColor={{false: Colors.border, true: Colors.primary}}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Dokunma Göstergesi</Text>
              <Text style={styles.toggleDesc}>
                Ekrana dokunulduğunda küçük bir daire göster (tutorial kayıtları için)
              </Text>
            </View>
            <Switch
              value={settings.showTouches}
              onValueChange={v => update({showTouches: v})}
              trackColor={{false: Colors.border, true: Colors.primary}}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Save Folder Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kayıt Klasörü</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Kayıtlar nereye kaydedilir?</Text>
            <Text style={styles.infoValue}>/{settings.saveFolder}</Text>
            <Text style={styles.infoDesc}>
              Tüm kayıtlar cihazınızda yerel olarak saklanır. Hiçbir sunucuya yüklenmez.
            </Text>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama Hakkında</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Velaud Recorder</Text>
            <Text style={styles.infoValue}>v1.0.0</Text>
            <Text style={styles.infoDesc}>
              Reklamsız, gizlilik odaklı Android ekran kaydedici.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  content: {padding: 16, paddingBottom: 40},
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionRowSelected: {backgroundColor: 'rgba(229,57,53,0.06)'},
  optionText: {color: Colors.textSecondary, fontSize: 15},
  optionTextSelected: {color: Colors.text, fontWeight: '600'},
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {borderColor: Colors.primary},
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  toggleInfo: {flex: 1},
  toggleLabel: {color: Colors.text, fontSize: 15, fontWeight: '500', marginBottom: 2},
  toggleDesc: {color: Colors.textMuted, fontSize: 12, lineHeight: 16},
  infoBox: {padding: 16},
  infoLabel: {color: Colors.textSecondary, fontSize: 13, marginBottom: 4},
  infoValue: {color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6},
  infoDesc: {color: Colors.textMuted, fontSize: 13, lineHeight: 18},
});
