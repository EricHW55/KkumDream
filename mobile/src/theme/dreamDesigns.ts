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
  { value: 'ivory', label: '아이보리', swatch: '#FDFBF6' },
  { value: 'lilac', label: '라일락', swatch: '#E9E4FB' },
  { value: 'peach', label: '피치', swatch: '#FFE2D1' },
  { value: 'mint', label: '민트', swatch: '#DFF5ED' },
  { value: 'midnight', label: '미드나잇', swatch: '#28263F' },
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
    card: '#FDFBF6',
    back: '#FFFFFF',
    image: '#F2EAD8',
    placeholder: '#F7F0DF',
    text: '#2F2922',
    secondaryText: '#6F665C',
    accent: '#9A6B2F',
    tagBackground: '#FFF4D5',
    tagText: '#7A5B18',
    shadow: '#7A5B18',
  },
  lilac: {
    card: '#F8F5FF',
    back: '#FFFFFF',
    image: '#E9E4FB',
    placeholder: '#F1ECFF',
    text: '#2B2744',
    secondaryText: '#645E82',
    accent: '#5C4FB1',
    tagBackground: '#E9E4FB',
    tagText: '#4C3A8A',
    shadow: '#5C4FB1',
  },
  peach: {
    card: '#FFF7F1',
    back: '#FFFFFF',
    image: '#FFE2D1',
    placeholder: '#FFEADD',
    text: '#3A241B',
    secondaryText: '#795A4B',
    accent: '#C55F42',
    tagBackground: '#FFE5C8',
    tagText: '#91472E',
    shadow: '#C55F42',
  },
  mint: {
    card: '#F2FFF9',
    back: '#FFFFFF',
    image: '#DFF5ED',
    placeholder: '#E9FAF2',
    text: '#17342C',
    secondaryText: '#4D7467',
    accent: '#2F8C77',
    tagBackground: '#D9F2E8',
    tagText: '#216F5D',
    shadow: '#2F8C77',
  },
  midnight: {
    card: '#28263F',
    back: '#211F35',
    image: '#35314F',
    placeholder: '#312E49',
    text: '#F7F3FF',
    secondaryText: '#D7CFE8',
    accent: '#FFD66B',
    tagBackground: '#3B3659',
    tagText: '#F7E7A4',
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
