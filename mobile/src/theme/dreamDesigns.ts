import { Platform, type TextStyle } from 'react-native';

import type {
  DreamCardColor,
  DreamCardFrame,
  DreamDesign,
  DreamFontStyle,
} from '../types/dream';

export const DEFAULT_DREAM_DESIGN: DreamDesign = {
  cardColor: 'ivory',
  cardFrame: 'classic',
  fontStyle: 'rounded',
};

export const CARD_COLOR_OPTIONS: {
  value: DreamCardColor;
  label: string;
  swatch: string;
}[] = [
  { value: 'ivory', label: '아이보리', swatch: '#FFFDF6' },
  { value: 'lilac', label: '라일락', swatch: '#ECE3F5' },
  { value: 'peach', label: '피치', swatch: '#F8D8CB' },
  { value: 'mint', label: '민트', swatch: '#DDEFE8' },
  { value: 'midnight', label: '미드나잇', swatch: '#282438' },
];

export const FONT_STYLE_OPTIONS: {
  value: DreamFontStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'rounded',
    label: '손편지체',
    description: '조금 느슨하고 직접 쓴 듯한 느낌',
  },
  {
    value: 'serif',
    label: '엽서 명조',
    description: '오래된 카드처럼 차분한 느낌',
  },
  {
    value: 'clean',
    label: '정리된 펜글씨',
    description: '읽기 쉬운 얇은 펜 느낌',
  },
];

export const CARD_FRAME_OPTIONS: {
  value: DreamCardFrame;
  label: string;
  description: string;
}[] = [
  {
    value: 'ticket',
    label: '영화 티켓',
    description: '위아래 절취선이 있는 티켓형',
  },
  {
    value: 'beveled',
    label: '컷 코너',
    description: '모서리를 작게 잘라낸 엽서형',
  },
  {
    value: 'tag',
    label: '택',
    description: '윗면이 깎이고 구멍이 있는 택형',
  },
  {
    value: 'classic',
    label: '기본 엽서',
    description: '둥근 사각형의 기본 카드틀',
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
    line: string;
    texture: string;
    shadow: string;
  }
> = {
  ivory: {
    card: '#FFFDF6',
    back: '#FAF4E8',
    image: '#EAF3F1',
    placeholder: '#F3EBDC',
    text: '#2F2832',
    secondaryText: '#726453',
    accent: '#806A48',
    tagBackground: '#EFE4CF',
    tagText: '#3F3429',
    line: '#A89473',
    texture: '#8A7A61',
    shadow: '#806A48',
  },
  lilac: {
    card: '#FBF7FF',
    back: '#F5F0FA',
    image: '#ECE3F5',
    placeholder: '#F4EDF7',
    text: '#292042',
    secondaryText: '#70658D',
    accent: '#6F61AD',
    tagBackground: '#E4DAF4',
    tagText: '#21183F',
    line: '#9584BF',
    texture: '#7B6D96',
    shadow: '#6F61AD',
  },
  peach: {
    card: '#FFF8F2',
    back: '#FFF3EB',
    image: '#F8D8CB',
    placeholder: '#FFE7DC',
    text: '#33233A',
    secondaryText: '#7A607B',
    accent: '#B56B78',
    tagBackground: '#F9E0E5',
    tagText: '#844E72',
    line: '#C69291',
    texture: '#9A7070',
    shadow: '#B56B78',
  },
  mint: {
    card: '#F8FFFC',
    back: '#F1FAF4',
    image: '#DDEFE8',
    placeholder: '#EAF5EF',
    text: '#22374F',
    secondaryText: '#5B7469',
    accent: '#3A8B78',
    tagBackground: '#DDEFE8',
    tagText: '#266555',
    line: '#7BB29F',
    texture: '#5F8D80',
    shadow: '#3A8B78',
  },
  midnight: {
    card: '#282438',
    back: '#211D30',
    image: '#38334A',
    placeholder: '#302B42',
    text: '#FFFDF6',
    secondaryText: '#D8D0C2',
    accent: '#D9C793',
    tagBackground: '#3F394F',
    tagText: '#FFF3C4',
    line: '#C8B98F',
    texture: '#E9DFC2',
    shadow: '#171421',
  },
};

const CARD_COLOR_VALUES = CARD_COLOR_OPTIONS.map(option => option.value);
const CARD_FRAME_VALUES = CARD_FRAME_OPTIONS.map(option => option.value);
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
  const cardFrame = CARD_FRAME_VALUES.includes(
    design?.cardFrame as DreamCardFrame,
  )
    ? (design?.cardFrame as DreamCardFrame)
    : DEFAULT_DREAM_DESIGN.cardFrame;

  return { cardColor, cardFrame, fontStyle };
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
      ios: 'Marker Felt',
      android: 'casual',
      default: undefined,
    }),
    fontWeight: Platform.select({
      android: '400',
      default: '600',
    }),
  };
}
