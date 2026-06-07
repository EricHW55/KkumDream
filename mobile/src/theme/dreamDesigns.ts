import type { TextStyle } from 'react-native';

import type {
  DreamCardColor,
  DreamCardFrame,
  DreamDesign,
  DreamFontStyle,
  DreamImageTexture,
  DreamLetterPaper,
} from '../types/dream';
import { nanumHandwritingFonts } from './fonts';

export const DEFAULT_DREAM_DESIGN: DreamDesign = {
  cardColor: 'beige',
  cardFrame: 'classic',
  fontStyle: 'dahaeng',
  imageTexture: 'oil_pastel',
  letterPaper: 'plain',
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

export const IMAGE_TEXTURE_OPTIONS: {
  value: DreamImageTexture;
  label: string;
  description: string;
}[] = [
  {
    value: 'oil_pastel',
    label: '오일 파스텔',
    description: '부드러운 파스텔 결을 살려요.',
  },
  {
    value: 'watercolor',
    label: '수채화',
    description: '번지는 물감과 종이 질감이 보여요.',
  },
  {
    value: 'acrylic',
    label: '아크릴',
    description: '선명한 색과 두꺼운 붓자국을 더해요.',
  },
  {
    value: 'crayon',
    label: '크레파스',
    description: '거친 손그림 결이 또렷해져요.',
  },
  {
    value: 'colored_pencil',
    label: '색연필',
    description: '섬세한 선과 종이결을 남겨요.',
  },
];

export const LETTER_PAPER_OPTIONS: {
  value: DreamLetterPaper;
  label: string;
  description: string;
}[] = [
  {
    value: 'plain',
    label: '빈 편지지',
    description: '밑줄 없이 여백과 글씨만 담는 기본 편지지예요.',
  },
  {
    value: 'lined',
    label: '클래식 밑줄',
    description: '글줄이 또렷하게 맞는 담백한 편지지예요.',
  },
  {
    value: 'postcard',
    label: '우편 엽서',
    description: '소인과 우표 칸을 더한 엽서식 편지지예요.',
  },
  {
    value: 'moonlit',
    label: '달구름 잠결',
    description: '수채 구름과 초승달, 작은 별이 조용히 떠 있는 편지지예요.',
  },
  {
    value: 'butterfly',
    label: '꽃비 정류장',
    description: '분홍 꽃송이와 흩날리는 꽃잎을 카드 가장자리에 올려요.',
  },
  {
    value: 'rose',
    label: '나비 숨결',
    description: '분홍, 보라, 노란 나비가 여백을 따라 가볍게 날아요.',
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
const IMAGE_TEXTURE_VALUES = IMAGE_TEXTURE_OPTIONS.map(option => option.value);
const LETTER_PAPER_VALUES = LETTER_PAPER_OPTIONS.map(option => option.value);
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
  const imageTexture = IMAGE_TEXTURE_VALUES.includes(
    design?.imageTexture as DreamImageTexture,
  )
    ? (design?.imageTexture as DreamImageTexture)
    : DEFAULT_DREAM_DESIGN.imageTexture;
  const letterPaper = LETTER_PAPER_VALUES.includes(
    design?.letterPaper as DreamLetterPaper,
  )
    ? (design?.letterPaper as DreamLetterPaper)
    : DEFAULT_DREAM_DESIGN.letterPaper;

  return { cardColor, cardFrame, fontStyle, imageTexture, letterPaper };
}

export function getImageTextureLabel(texture: DreamImageTexture): string {
  return (
    IMAGE_TEXTURE_OPTIONS.find(option => option.value === texture)?.label ??
    IMAGE_TEXTURE_OPTIONS[0].label
  );
}

export function getLetterPaperLabel(letterPaper: DreamLetterPaper): string {
  return (
    LETTER_PAPER_OPTIONS.find(option => option.value === letterPaper)?.label ??
    LETTER_PAPER_OPTIONS[0].label
  );
}

export function getDreamFontStyle(fontStyle: DreamFontStyle): TextStyle {
  return {
    fontFamily:
      FONT_STYLE_FAMILIES[fontStyle] ?? nanumHandwritingFonts.dahaeng,
    ...(FONT_STYLE_BACK_TEXT[fontStyle] ?? FONT_STYLE_BACK_TEXT.dahaeng),
  };
}
