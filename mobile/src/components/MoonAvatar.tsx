import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { colors } from '../theme/colors';

type Props = {
  size?: number;
  color?: string;
};

export function MoonAvatar({ size = 42, color = colors.primary }: Props) {
  const cloudColor = colors.skyMist;
  const cloudShade = colors.lavenderTint;
  const moonColor = colors.moonAccent;
  const starColor = '#FFE891';

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="30" fill={color} />
      <Circle cx="25" cy="26" r="21" fill={colors.cardBase} opacity={0.14} />
      <Path
        d="M41 12c-7.7 3.1-12.5 10-12.5 18.1 0 9.7 7.3 17.7 16.7 19-3.5 2.7-7.9 4.2-12.6 4.2-11.6 0-21-9.4-21-21 0-10.8 8.2-19.8 18.7-20.9 3.7-.4 7.4.2 10.7 1.6z"
        fill={moonColor}
      />
      <Path
        d="M15.5 45.5c0-4.6 3.7-8.3 8.3-8.3.8-5.8 5.8-10.3 11.8-10.3 5.7 0 10.5 4 11.7 9.4h.7c4.6 0 8.3 3.7 8.3 8.3 0 4.5-3.7 8.2-8.3 8.2H23.8c-4.6 0-8.3-3.3-8.3-7.3z"
        fill={cloudColor}
      />
      <Path
        d="M23.8 37.2c.8-5.8 5.8-10.3 11.8-10.3 2.6 0 5 .8 7 2.2-4.9.8-8.8 4.5-9.8 9.3-4.2.4-7.4 3.9-7.4 8.2 0 2.6 1.2 4.9 3 6.4h-4.6c-4.6 0-8.3-3.3-8.3-7.3 0-4.7 3.7-8.5 8.3-8.5z"
        fill={cloudShade}
      />
      <Polygon
        points="47,13 50,19 56,20 51.6,24.4 52.7,30.5 47,27.6 41.3,30.5 42.4,24.4 38,20 44,19"
        fill={starColor}
      />
      <Polygon
        points="52,33 54,36.8 58.2,37.4 55.1,40.4 55.8,44.6 52,42.6 48.2,44.6 48.9,40.4 45.8,37.4 50,36.8"
        fill={starColor}
      />
    </Svg>
  );
}
