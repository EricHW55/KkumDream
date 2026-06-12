import { NativeModules, Platform, Share } from 'react-native';

type DreamImageActionsModule = {
  saveImage: (imageUrl: string, fileName?: string) => Promise<string>;
  shareImage: (
    imageUrl: string,
    fileName?: string,
    message?: string,
  ) => Promise<boolean>;
};

const nativeModule = NativeModules.DreamImageActions as
  | DreamImageActionsModule
  | undefined;

export async function saveDreamImage(imageUrl: string, fileName?: string) {
  if (Platform.OS === 'android' && nativeModule) {
    return nativeModule.saveImage(imageUrl, fileName);
  }

  await Share.share({ url: imageUrl, message: imageUrl });
  return imageUrl;
}

const DREAM_IMAGE_SHARE_MESSAGE =
  '꿈드림에서 만든 꿈의 장면이에요. 오늘의 꿈을 함께 나눠보세요.';

export async function shareDreamImage(imageUrl: string, fileName?: string) {
  if (Platform.OS === 'android' && nativeModule) {
    await nativeModule.shareImage(imageUrl, fileName, DREAM_IMAGE_SHARE_MESSAGE);
    return;
  }

  await Share.share({
    url: imageUrl,
    message: `${DREAM_IMAGE_SHARE_MESSAGE}\n${imageUrl}`,
  });
}
