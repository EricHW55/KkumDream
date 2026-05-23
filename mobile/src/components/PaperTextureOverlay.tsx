import { Image, StyleSheet, View } from 'react-native';

import paperTexture from '../assets/textures/paper_texture.webp';

type Props = {
  subtle?: boolean;
  opacity?: number;
};

export function PaperTextureOverlay({ opacity, subtle = false }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        resizeMode="cover"
        source={paperTexture}
        style={[styles.texture, { opacity: opacity ?? (subtle ? 0.16 : 0.28) }]}
      />
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
