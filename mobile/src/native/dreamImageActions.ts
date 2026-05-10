import { NativeModules, Platform, Share } from 'react-native';

type DreamImageActionsModule = {
  saveImage: (imageUrl: string, fileName?: string) => Promise<string>;
  shareImage: (imageUrl: string, fileName?: string) => Promise<boolean>;
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

export async function shareDreamImage(imageUrl: string, fileName?: string) {
  if (Platform.OS === 'android' && nativeModule) {
    await nativeModule.shareImage(imageUrl, fileName);
    return;
  }

  await Share.share({ url: imageUrl, message: imageUrl });
}
