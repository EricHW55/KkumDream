import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

type Props = {
  subtle?: boolean;
};

const fiberPaths = [
  'M -20 70 C 60 54 130 82 218 66 S 322 58 388 76',
  'M -12 190 C 72 172 148 205 232 188 S 318 174 380 196',
  'M 18 318 C 94 304 150 333 232 316 S 324 302 376 324',
  'M -8 472 C 78 456 154 488 236 470 S 322 456 384 476',
  'M 20 640 C 86 624 166 654 248 636 S 322 626 380 644',
  'M 42 -24 C 35 96 48 188 40 320 S 34 586 46 826',
  'M 184 -20 C 176 112 190 238 182 368 S 178 596 188 824',
  'M 322 -16 C 314 106 330 234 320 358 S 316 594 326 828',
] as const;

const specks = [
  [36, 42, 0.7],
  [124, 88, 0.5],
  [288, 70, 0.6],
  [340, 168, 0.5],
  [74, 224, 0.6],
  [214, 282, 0.5],
  [312, 338, 0.7],
  [40, 424, 0.5],
  [148, 500, 0.6],
  [282, 552, 0.5],
  [84, 668, 0.5],
  [236, 724, 0.6],
] as const;

export function PaperTextureOverlay({ subtle = false }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        height="100%"
        pointerEvents="none"
        preserveAspectRatio="none"
        style={styles.texture}
        viewBox="0 0 360 800"
        width="100%"
      >
        <G opacity={subtle ? 0.08 : 0.13}>
          {fiberPaths.map(path => (
            <Path
              key={path}
              d={path}
              fill="none"
              stroke="#B7AA97"
              strokeLinecap="round"
              strokeWidth={0.7}
            />
          ))}
        </G>
        <G opacity={subtle ? 0.09 : 0.15}>
          {specks.map(([cx, cy, r]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} fill="#AFA390" r={r} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  texture: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
