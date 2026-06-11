export const nanumHandwritingFonts = {
  dahaeng: 'NanumDaHaengCe',
  daegwangyuri: 'NanumDaeGwangYuRi',
  miraenamu: 'NanumMiRaeNaMu',
  agisarang: 'NanumAGiSaRangCe',
  yedang: 'NanumYeDangCe',
} as const;

export const nanumDahaengWeightFonts = {
  regular: nanumHandwritingFonts.dahaeng,
  semibold: 'NanumDaHaengCeSemiBold',
  bold: 'NanumDaHaengCeBold',
  extrabold: 'NanumDaHaengCeExtraBold',
} as const;

export type NanumHandwritingFont =
  (typeof nanumHandwritingFonts)[keyof typeof nanumHandwritingFonts];
