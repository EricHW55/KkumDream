import { useId, useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  Path,
} from 'react-native-svg';

const DEFAULT_INSET = 28;

type HaloShadowProps = {
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;
  color: string;
  inset?: number;
  ambientOpacity?: number;
  contactOpacity?: number;
  ambientBlur?: number;
  contactBlur?: number;
};

export function HaloShadow({
  borderRadius,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomRightRadius,
  borderBottomLeftRadius,
  color,
  inset = DEFAULT_INSET,
  ambientOpacity = 0.32,
  contactOpacity = 0.22,
  ambientBlur = 10,
  contactBlur = 3,
}: HaloShadowProps) {
  const reactId = useId();
  const filterId = `halo-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const tl = borderTopLeftRadius ?? borderRadius ?? 0;
  const tr = borderTopRightRadius ?? borderRadius ?? 0;
  const br = borderBottomRightRadius ?? borderRadius ?? 0;
  const bl = borderBottomLeftRadius ?? borderRadius ?? 0;

  return (
    <View
      pointerEvents="none"
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSize(prev => {
          if (
            prev &&
            Math.abs(prev.width - width) < 0.5 &&
            Math.abs(prev.height - height) < 0.5
          ) {
            return prev;
          }
          return { width, height };
        });
      }}
      style={{
        position: 'absolute',
        top: -inset,
        right: -inset,
        bottom: -inset,
        left: -inset,
      }}
    >
      {size ? (
        <Svg
          height="100%"
          preserveAspectRatio="none"
          viewBox={`0 0 ${size.width} ${size.height}`}
          width="100%"
        >
          <Defs>
            <Filter
              id={filterId}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <FeGaussianBlur
                in="SourceAlpha"
                stdDeviation={ambientBlur}
                result="ambBlur"
              />
              <FeFlood
                floodColor={color}
                floodOpacity={ambientOpacity}
                result="ambColor"
              />
              <FeComposite
                in="ambColor"
                in2="ambBlur"
                operator="in"
                result="ambShadow"
              />

              <FeGaussianBlur
                in="SourceAlpha"
                stdDeviation={contactBlur}
                result="contBlur"
              />
              <FeFlood
                floodColor={color}
                floodOpacity={contactOpacity}
                result="contColor"
              />
              <FeComposite
                in="contColor"
                in2="contBlur"
                operator="in"
                result="contShadow"
              />

              <FeMerge>
                <FeMergeNode in="ambShadow" />
                <FeMergeNode in="contShadow" />
              </FeMerge>
            </Filter>
          </Defs>
          <Path
            d={roundedRectPath(
              inset,
              inset,
              size.width - inset * 2,
              size.height - inset * 2,
              { tl, tr, br, bl },
            )}
            fill={color}
            filter={`url(#${filterId})`}
          />
        </Svg>
      ) : null}
    </View>
  );
}

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: { tl: number; tr: number; br: number; bl: number },
) {
  const right = x + width;
  const bottom = y + height;
  const maxR = Math.min(width / 2, height / 2);
  const tl = Math.max(0, Math.min(radii.tl, maxR));
  const tr = Math.max(0, Math.min(radii.tr, maxR));
  const br = Math.max(0, Math.min(radii.br, maxR));
  const bl = Math.max(0, Math.min(radii.bl, maxR));
  return [
    `M ${x + tl} ${y}`,
    `H ${right - tr}`,
    `Q ${right} ${y} ${right} ${y + tr}`,
    `V ${bottom - br}`,
    `Q ${right} ${bottom} ${right - br} ${bottom}`,
    `H ${x + bl}`,
    `Q ${x} ${bottom} ${x} ${bottom - bl}`,
    `V ${y + tl}`,
    `Q ${x} ${y} ${x + tl} ${y}`,
    'Z',
  ].join(' ');
}
