#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MorningReminder, NSObject)

RCT_EXTERN_METHOD(schedule:(nonnull NSNumber *)hour
                  minute:(nonnull NSNumber *)minute
                  title:(NSString *)title
                  body:(NSString *)body
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
