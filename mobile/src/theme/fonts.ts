export const nanumHandwritingFonts = {
  dahaeng: 'NanumDaHaengCe',
  daegwangyuri: 'NanumDaeGwangYuRi',
  miraenamu: 'NanumMiRaeNaMu',
  agisarang: 'NanumAGiSaRangCe',
  yedang: 'NanumYeDangCe',
} as const;

export type NanumHandwritingFont =
  (typeof nanumHandwritingFonts)[keyof typeof nanumHandwritingFonts];
