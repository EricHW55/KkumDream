import { Platform, type TextStyle } from 'react-native';

import type {
  DreamCardColor,
  DreamDesign,
  DreamFontStyle,
} from '../types/dream';

export const DEFAULT_DREAM_DESIGN: DreamDesign = {
  cardColor: 'ivory',
  fontStyle: 'rounded',
};

export const CARD_COLOR_OPTIONS: {
  value: DreamCardColor;
  label: string;
  swatch: string;
}[] = [
  { value: 'ivory', label: '아이보리', swatch: '#FCFAFF' },
  { value: 'lilac', label: '라일락', swatch: '#E4DAF4' },
  { value: 'peach', label: '피치', swatch: '#FFE4DA' },
  { value: 'mint', label: '민트', swatch: '#DFF7F4' },
  { value: 'midnight', label: '미드나잇', swatch: '#292540' },
];

export const FONT_STYLE_OPTIONS: {
  value: DreamFontStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'rounded',
    label: '둥근 글씨',
    description: '부드럽고 선물 같은 느낌',
  },
  {
    value: 'serif',
    label: '책장 글씨',
    description: '차분한 편지와 이야기 느낌',
  },
  {
    value: 'clean',
    label: '단정한 글씨',
    description: '깔끔하고 읽기 쉬운 느낌',
  },
];

export const CARD_COLOR_THEMES: Record<
  DreamCardColor,
  {
    card: string;
    back: string;
    image: string;
    placeholder: string;
    text: string;
    secondaryText: string;
    accent: string;
    tagBackground: string;
    tagText: string;
    shadow: string;
  }
> = {
  ivory: {
    card: '#FCFAFF',
    back: '#F7F4FF',
    image: '#EAF5FF',
    placeholder: '#F0EAF8',
    text: '#292042',
    secondaryText: '#70658D',
    accent: '#6F61AD',
    tagBackground: '#E4DAF4',
    tagText: '#21183F',
    shadow: '#6F61AD',
  },
  lilac: {
    card: '#F7F2FB',
    back: '#FFFCFF',
    image: '#E4DAF4',
    placeholder: '#F0EAF8',
    text: '#292042',
    secondaryText: '#70658D',
    accent: '#6F61AD',
    tagBackground: '#E4DAF4',
    tagText: '#21183F',
    shadow: '#6F61AD',
  },
  peach: {
    card: '#FFF7F5',
    back: '#FFFCFF',
    image: '#FFE4DA',
    placeholder: '#FFEDE7',
    text: '#33233A',
    secondaryText: '#7A607B',
    accent: '#C8759C',
    tagBackground: '#FFE7F0',
    tagText: '#844E72',
    shadow: '#C8759C',
  },
  mint: {
    card: '#F3FBFF',
    back: '#FFFCFF',
    image: '#DFF5FF',
    placeholder: '#EAF8FF',
    text: '#22374F',
    secondaryText: '#5E7892',
    accent: '#2E9EC5',
    tagBackground: '#DFF5FF',
    tagText: '#246D8C',
    shadow: '#2E9EC5',
  },
  midnight: {
    card: '#292540',
    back: '#211D35',
    image: '#373154',
    placeholder: '#302B48',
    text: '#F8F6FF',
    secondaryText: '#D9D2F0',
    accent: '#9DDFF3',
    tagBackground: '#3F3860',
    tagText: '#DFF5FF',
    shadow: '#171421',
  },
};

const CARD_COLOR_VALUES = CARD_COLOR_OPTIONS.map(option => option.value);
const FONT_STYLE_VALUES = FONT_STYLE_OPTIONS.map(option => option.value);

export function normalizeDreamDesign(
  design?: Partial<DreamDesign> | null,
): DreamDesign {
  const cardColor = CARD_COLOR_VALUES.includes(
    design?.cardColor as DreamCardColor,
  )
    ? (design?.cardColor as DreamCardColor)
    : DEFAULT_DREAM_DESIGN.cardColor;
  const fontStyle = FONT_STYLE_VALUES.includes(
    design?.fontStyle as DreamFontStyle,
  )
    ? (design?.fontStyle as DreamFontStyle)
    : DEFAULT_DREAM_DESIGN.fontStyle;

  return { cardColor, fontStyle };
}

export function getDreamFontStyle(fontStyle: DreamFontStyle): TextStyle {
  if (fontStyle === 'serif') {
    return {
      fontFamily: Platform.select({
        ios: 'Georgia',
        android: 'serif',
        default: undefined,
      }),
    };
  }

  if (fontStyle === 'clean') {
    return {
      fontFamily: Platform.select({
        android: 'sans-serif',
        default: undefined,
      }),
    };
  }

  return {
    fontFamily: Platform.select({
      android: 'sans-serif-medium',
      default: undefined,
    }),
  };
}
