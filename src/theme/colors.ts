/**
 * Velaud Recorder — "Cine Noir" Design System
 * Graphite-plum base, cinematic gold brand color, electric teal for live/social.
 * GOLD = brand / interactive; RED = recording only; TEAL = live / social accents.
 */
export const Colors = {
  // Base surfaces — graphite with a warm plum undertone (not pure neutral black)
  background:        '#0C0A10',
  surface:            '#171320',
  surfaceElevated:    '#211B29',
  surfaceHighlight:   '#2C2436',
  overlay:            'rgba(8,6,12,0.78)',

  // Brand — cinematic gold (aperture / film-reel accent)
  primary:            '#F5A623',
  primaryDark:        '#D6890F',
  primaryLight:       '#FFC65C',
  primaryMuted:       'rgba(245,166,35,0.14)',
  primaryGlow:        'rgba(245,166,35,0.30)',

  // Secondary — electric teal (live / streaming / social)
  secondary:          '#2FE6C9',
  secondaryDark:      '#17BFA6',
  secondaryLight:     '#7BF3E0',
  secondaryMuted:     'rgba(47,230,201,0.14)',
  secondaryGlow:      'rgba(47,230,201,0.30)',

  // Text hierarchy — warm-tinted grays to match the plum base
  text:               '#FDFBFF',
  textSecondary:      '#C0B6CC',
  textMuted:          '#736A82',
  textDisabled:       '#3F3850',

  // Borders (subtle, warm-tinted on dark)
  border:             '#2A2434',
  borderLight:        '#392F47',
  borderFocus:        '#4A3D5C',

  // Status
  success:            '#33D6A0',
  successMuted:       'rgba(51,214,160,0.14)',
  warning:            '#FFB020',
  warningMuted:       'rgba(255,176,32,0.14)',
  error:              '#FF4361',
  errorMuted:         'rgba(255,67,97,0.14)',

  // Recording states — red is the universal convention for record
  recording:          '#FF3B4E',
  recordingGlow:      'rgba(255,59,78,0.34)',
  paused:             '#F5A623',
  pausedGlow:         'rgba(245,166,35,0.28)',

  // Utility
  white:              '#FFFFFF',
  black:              '#000000',
  transparent:        'transparent',

  // Chip/badge accent
  chip:               '#221C2C',
  chipBorder:         '#362D44',
  chipActive:         'rgba(245,166,35,0.12)',
  chipActiveBorder:   'rgba(245,166,35,0.45)',
};
