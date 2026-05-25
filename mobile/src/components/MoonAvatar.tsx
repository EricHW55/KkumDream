import { useEffect, useState } from 'react';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';

import { colors } from '../theme/colors';

type Props = {
  size?: number;
  color?: string;
};

const SLEEP_CYCLE_MS = 2080;
const SLEEP_STEP_MS = 300;
const SLEEP_HOLD_MS = 980;
const sleepPhaseListeners = new Set<(visibleCount: number) => void>();
let sleepPhaseTimer: ReturnType<typeof setInterval> | null = null;

function getSyncedSleepVisibleCount() {
  const elapsed = Date.now() % SLEEP_CYCLE_MS;
  if (elapsed < SLEEP_STEP_MS) {
    return 1;
  }
  if (elapsed < SLEEP_STEP_MS * 2) {
    return 2;
  }
  if (elapsed < SLEEP_STEP_MS * 3 + SLEEP_HOLD_MS) {
    return 3;
  }
  return 0;
}

function notifySleepPhaseListeners() {
  const visibleCount = getSyncedSleepVisibleCount();
  sleepPhaseListeners.forEach(listener => listener(visibleCount));
}

function useSyncedSleepVisibleCount() {
  const [visibleCount, setVisibleCount] = useState(getSyncedSleepVisibleCount);

  useEffect(() => {
    sleepPhaseListeners.add(setVisibleCount);
    setVisibleCount(getSyncedSleepVisibleCount());

    if (!sleepPhaseTimer) {
      sleepPhaseTimer = setInterval(notifySleepPhaseListeners, 120);
    }

    return () => {
      sleepPhaseListeners.delete(setVisibleCount);
      if (sleepPhaseListeners.size === 0 && sleepPhaseTimer) {
        clearInterval(sleepPhaseTimer);
        sleepPhaseTimer = null;
      }
    };
  }, []);

  return visibleCount;
}

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

export function SleepingMoonAvatar({
  size = 36,
  color = colors.primaryDark,
}: Props) {
  const fillColor = colors.cardBase;
  const visibleCount = useSyncedSleepVisibleCount();

  return (
    <Svg width={size} height={size} viewBox="0 -6 64 70">
      <G opacity={visibleCount >= 1 ? 1 : 0} transform="rotate(-24 45 48)">
        <Path
          d="M36.4 40.1c.1-1 .9-1.6 1.9-1.5l13.5 1.7c1.1.1 1.7.9 1.5 2l-.6 3.1c-.1.7-.5 1.2-1.1 1.6l-8.2 5.5 10.1 1.4c1 .1 1.5.9 1.3 1.9l-.8 3.4c-.2.9-.9 1.4-1.9 1.2l-14.4-2.5c-1.1-.2-1.6-1-1.4-2.1l.8-3.5c.1-.6.5-1.2 1.1-1.6l8.6-5.5-9.3-1.2c-1.1-.1-1.6-.9-1.4-2z"
          fill={fillColor}
          stroke={color}
          strokeWidth={2.1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </G>
      <G opacity={visibleCount >= 2 ? 1 : 0} transform="rotate(15 34 34)">
        <Path
          d="M24.2 24.7c.2-1.1 1-1.7 2.1-1.5l16.2 2.7c1.3.2 1.9 1.2 1.5 2.5l-1.2 4.1c-.2.8-.8 1.4-1.5 1.8l-10.1 6.4 13.1 2.3c1.1.2 1.7 1 1.5 2.1l-.8 4.1c-.2 1.2-1.1 1.8-2.3 1.5l-18.3-3.6c-1.2-.2-1.8-1.1-1.5-2.3l.9-4.6c.2-.8.7-1.5 1.4-2l10.7-6.6-10.5-1.8c-1.2-.2-1.8-1.1-1.5-2.3z"
          fill={fillColor}
          stroke={color}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </G>
      <G opacity={visibleCount >= 3 ? 1 : 0} transform="translate(0 -2) rotate(2 20 18)">
        <Path
          d="M7.8 4.6c-.1-1.4.9-2.3 2.3-2.2l21.1 1c1.5.1 2.5 1 2.5 2.5l-.1 4.6c0 1-.4 1.9-1.2 2.7L17.9 26l14-.6c1.7-.1 2.7.9 2.7 2.5l.1 4.8c.1 1.5-.9 2.4-2.4 2.5l-22.6.8C8 36.1 7 35.1 6.9 33.5l-.3-6.3c-.1-1 .2-1.9 1-2.7l14.3-12.6-11.4.1c-1.5 0-2.4-.9-2.5-2.3z"
          fill={fillColor}
          stroke={color}
          strokeWidth={2.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
