export const nanumHandwritingFonts = {
  dahaeng: 'NanumDaHaengCe',
  daegwangyuri: 'NanumDaeGwangYuRi',
  miraenamu: 'NanumMiRaeNaMu',
  agisarang: 'NanumAGiSaRangCe',
  yedang: 'NanumYeDangCe',
} as const;

export const nanumDahaengWeightFonts = {
  regular: nanumHandwritingFonts.dahaeng,
  medium: 'NanumDaHaengCeMedium',
  semibold: 'NanumDaHaengCeSemiBold',
  bold: 'NanumDaHaengCeBold',
  extrabold: 'NanumDaHaengCeExtraBold',
  heavy: 'NanumDaHaengCeHeavy',
} as const;

export type NanumHandwritingFont =
  (typeof nanumHandwritingFonts)[keyof typeof nanumHandwritingFonts];
