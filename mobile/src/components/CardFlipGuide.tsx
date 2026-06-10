import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Hand } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { handwritingFont } from '../theme/typography';

const CYCLE_DELAY = 420;

export function CardFlipGuide() {
  const handScale = useSharedValue(1);
  const rippleScale = useSharedValue(0.45);
  const rippleOpacity = useSharedValue(0);

  useEffect(() => {
    handScale.value = withRepeat(
      withSequence(
        withTiming(0.82, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
        withDelay(CYCLE_DELAY, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    rippleScale.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 0 }),
        withTiming(1.55, { duration: 720, easing: Easing.out(Easing.quad) }),
        withDelay(CYCLE_DELAY, withTiming(1.55, { duration: 0 })),
      ),
      -1,
      false,
    );
    rippleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 0 }),
        withTiming(0, { duration: 720, easing: Easing.out(Easing.quad) }),
        withDelay(CYCLE_DELAY, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [handScale, rippleOpacity, rippleScale]);

  const handStyle = useAnimatedStyle(() => ({
    transform: [{ scale: handScale.value }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(220)}
      style={styles.overlay}
    >
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>
          카드를 탭하면 뒷면의 꿈 이야기를 볼 수 있어요
        </Text>
        <View style={styles.bubbleTail} />
      </View>
      <View style={styles.tapZone}>
        <Animated.View style={[styles.ripple, rippleStyle]} />
        <Animated.View style={[styles.handWrap, handStyle]}>
          <Hand color="#FFFFFF" size={26} strokeWidth={2.2} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  bubble: {
    maxWidth: 250,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(31, 30, 27, 0.84)',
    shadowColor: '#1F1E1B',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bubbleText: {
    color: '#FFFFFF',
    ...handwritingFont('700'),
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    alignSelf: 'center',
    width: 14,
    height: 14,
    backgroundColor: 'rgba(31, 30, 27, 0.84)',
    transform: [{ rotate: '45deg' }],
  },
  tapZone: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  handWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31, 30, 27, 0.7)',
  },
});
