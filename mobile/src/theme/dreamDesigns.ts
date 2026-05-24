import type { TextStyle } from 'react-native';

import type {
  DreamCardColor,
  DreamCardFrame,
  DreamDesign,
  DreamFontStyle,
} from '../types/dream';
import { nanumHandwritingFonts } from './fonts';

export const DEFAULT_DREAM_DESIGN: DreamDesign = {
  cardColor: 'beige',
  cardFrame: 'classic',
  fontStyle: 'dahaeng',
};

export const CARD_COLOR_OPTIONS: {
  value: DreamCardColor;
  label: string;
  swatch: string;
}[] = [
  { value: 'beige', label: '베이지', swatch: '#EFE1C7' },
  { value: 'ivory', label: '아이보리', swatch: '#FFFDF7' },
  { value: 'lilac', label: '라일락', swatch: '#F4F0FF' },
  { value: 'peach', label: '피치', swatch: '#FFF2E7' },
  { value: 'mint', label: '민트', swatch: '#F1FAF5' },
  { value: 'midnight', label: '미드나잇', swatch: '#282438' },
];

export const FONT_STYLE_OPTIONS: {
  value: DreamFontStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'dahaeng',
    label: '다행체',
    description: '앱 기본 글씨체로 부드럽고 또렷해요.',
  },
  {
    value: 'daegwangyuri',
    label: '대광유리체',
    description: '반듯하고 밝은 손글씨 느낌이에요.',
  },
  {
    value: 'miraenamu',
    label: '미래나무체',
    description: '동글고 편안한 편지 느낌이에요.',
  },
  {
    value: 'agisarang',
    label: '아기사랑체',
    description: '작고 귀여운 손글씨 느낌이에요.',
  },
  {
    value: 'yedang',
    label: '예당체',
    description: '차분하고 고전적인 손글씨 느낌이에요.',
  },
];

export const CARD_FRAME_OPTIONS: {
  value: DreamCardFrame;
  label: string;
  description: string;
}[] = [
  {
    value: 'classic',
    label: '기본 엽서',
    description: '둥근 사각형의 기본 카드틀',
  },
  {
    value: 'ticket',
    label: '낡은 편지',
    description: '오래 간직한 듯 닳은 종이 가장자리',
  },
  {
    value: 'beveled',
    label: '영화 티켓',
    description: '위아래가 둥글게 파인 티켓형 카드틀',
  },
  {
    value: 'tag',
    label: '선물 태그',
    description: '작은 선물에 묶인 종이 태그',
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
  beige: {
    card: '#EFE1C7',
    back: '#E8D8BA',
    image: '#F4E9D8',
    placeholder: '#F4E9D8',
    text: '#2D2923',
    secondaryText: '#6E604F',
    accent: '#8D775B',
    tagBackground: '#DEC9A6',
    tagText: '#3A342C',
    line: '#B69F7E',
    texture: '#8F7A5E',
    shadow: '#3E2F1E',
  },
  ivory: {
    card: '#FFFDF7',
    back: '#FBF6EA',
    image: '#F3EAD8',
    placeholder: '#F8EFE0',
    text: '#2D2923',
    secondaryText: '#6F675D',
    accent: '#6F675D',
    tagBackground: '#F4E7D2',
    tagText: '#3A342C',
    line: '#CBBFAE',
    texture: '#AFA390',
    shadow: '#42321E',
  },
  lilac: {
    card: '#F4F0FF',
    back: '#F6F0FA',
    image: '#F4E9D8',
    placeholder: '#F4E9D8',
    text: '#2D2923',
    secondaryText: '#6F675D',
    accent: '#7468B8',
    tagBackground: '#E9E4FB',
    tagText: '#3A342C',
    line: '#CBBFAE',
    texture: '#AFA390',
    shadow: '#42321E',
  },
  peach: {
    card: '#FFF2E7',
    back: '#FFF5EC',
    image: '#F4E9D8',
    placeholder: '#F4E9D8',
    text: '#2D2923',
    secondaryText: '#6F675D',
    accent: '#9A6E52',
    tagBackground: '#F3DFC2',
    tagText: '#3A342C',
    line: '#CBBFAE',
    texture: '#AFA390',
    shadow: '#42321E',
  },
  mint: {
    card: '#F1FAF5',
    back: '#F1FAF5',
    image: '#F4E9D8',
    placeholder: '#F4E9D8',
    text: '#2D2923',
    secondaryText: '#6F675D',
    accent: '#5E7D6E',
    tagBackground: '#DDEFE8',
    tagText: '#3A342C',
    line: '#CBBFAE',
    texture: '#AFA390',
    shadow: '#42321E',
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
const FONT_STYLE_FAMILIES: Record<DreamFontStyle, string> = {
  dahaeng: nanumHandwritingFonts.dahaeng,
  daegwangyuri: nanumHandwritingFonts.daegwangyuri,
  miraenamu: nanumHandwritingFonts.miraenamu,
  agisarang: nanumHandwritingFonts.agisarang,
  yedang: nanumHandwritingFonts.yedang,
  rounded: nanumHandwritingFonts.dahaeng,
  serif: nanumHandwritingFonts.yedang,
  clean: nanumHandwritingFonts.miraenamu,
};
const FONT_STYLE_BACK_TEXT: Record<DreamFontStyle, TextStyle> = {
  dahaeng: {
    fontSize: 14.8,
    fontWeight: '700',
    lineHeight: 27,
  },
  daegwangyuri: {
    fontSize: 15.2,
    fontWeight: '700',
    lineHeight: 28,
  },
  miraenamu: {
    fontSize: 14.8,
    fontWeight: '700',
    lineHeight: 27,
  },
  agisarang: {
    fontSize: 15.2,
    fontWeight: '700',
    lineHeight: 28,
  },
  yedang: {
    fontSize: 14.9,
    fontWeight: '700',
    lineHeight: 27,
  },
  rounded: {
    fontSize: 14.8,
    fontWeight: '700',
    lineHeight: 27,
  },
  serif: {
    fontSize: 14.9,
    fontWeight: '700',
    lineHeight: 27,
  },
  clean: {
    fontSize: 14.8,
    fontWeight: '700',
    lineHeight: 27,
  },
};

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
  return {
    fontFamily:
      FONT_STYLE_FAMILIES[fontStyle] ?? nanumHandwritingFonts.dahaeng,
    ...(FONT_STYLE_BACK_TEXT[fontStyle] ?? FONT_STYLE_BACK_TEXT.dahaeng),
  };
}
