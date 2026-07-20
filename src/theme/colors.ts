/**
 * Velaud Recorder — Design System
 * Midas-inspired true-black base, single red brand color.
 * One accent = one meaning: RED = kayıt / brand identity.
 */
export const Colors = {
  // Base surfaces — true dark (Midas-style)
  background:        '#080808',
  surface:           '#111111',
  surfaceElevated:   '#1A1A1A',
  surfaceHighlight:  '#222222',
  overlay:           'rgba(0,0,0,0.72)',

  // Brand — single red, doubles as record color (XRecorder principle)
  primary:           '#FF3B30',
  primaryDark:       '#CC2E25',
  primaryLight:      '#FF6B63',
  primaryMuted:      'rgba(255,59,48,0.12)',
  primaryGlow:       'rgba(255,59,48,0.25)',

  // Text hierarchy
  text:              '#FFFFFF',
  textSecondary:     '#ADADAD',
  textMuted:         '#5A5A5A',
  textDisabled:      '#333333',

  // Borders (very subtle on dark)
  border:            '#242424',
  borderLight:       '#303030',
  borderFocus:       '#444444',

  // Status
  success:           '#30D158',  // iOS green
  successMuted:      'rgba(48,209,88,0.12)',
  warning:           '#FF9F0A',  // iOS amber
  warningMuted:      'rgba(255,159,10,0.12)',
  error:             '#FF3B30',

  // Recording states
  recording:         '#FF3B30',
  recordingGlow:     'rgba(255,59,48,0.30)',
  paused:            '#FF9F0A',
  pausedGlow:        'rgba(255,159,10,0.25)',

  // Utility
  white:             '#FFFFFF',
  black:             '#000000',
  transparent:       'transparent',

  // Chip/badge accent (non-red interactive)
  chip:              '#1E1E1E',
  chipBorder:        '#2E2E2E',
  chipActive:        'rgba(255,59,48,0.10)',
  chipActiveBorder:  'rgba(255,59,48,0.40)',
};
