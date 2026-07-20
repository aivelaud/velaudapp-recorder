/**
 * Velaud Recorder — Design System
 * True-black base, electric blue brand color.
 * BLUE = brand / interactive; RED = recording / destructive only.
 */
export const Colors = {
  // Base surfaces — true dark
  background:        '#080808',
  surface:          '#111111',
  surfaceElevated:  '#1A1A1A',
  surfaceHighlight: '#222222',
  overlay:          'rgba(0,0,0,0.72)',

  // Brand — electric blue
  primary:           '#3B82F6',
  primaryDark:       '#2563EB',
  primaryLight:      '#60A5FA',
  primaryMuted:      'rgba(59,130,246,0.12)',
  primaryGlow:       'rgba(59,130,246,0.25)',

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
  success:           '#30D158',
  successMuted:      'rgba(48,209,88,0.12)',
  warning:           '#FF9F0A',
  warningMuted:      'rgba(255,159,10,0.12)',
  error:             '#FF453A',
  errorMuted:        'rgba(255,69,58,0.12)',

  // Recording states — red is universal convention for record
  recording:         '#FF453A',
  recordingGlow:     'rgba(255,69,58,0.30)',
  paused:            '#FF9F0A',
  pausedGlow:        'rgba(255,159,10,0.25)',

  // Utility
  white:             '#FFFFFF',
  black:             '#000000',
  transparent:       'transparent',

  // Chip/badge accent
  chip:              '#1E1E1E',
  chipBorder:        '#2E2E2E',
  chipActive:        'rgba(59,130,246,0.10)',
  chipActiveBorder:  'rgba(59,130,246,0.40)',
};
