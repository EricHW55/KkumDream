import Foundation
import React
import UserNotifications

@objc(MorningReminder)
class MorningReminder: NSObject {
  private let identifier = "morning_dream_card"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(schedule:minute:title:body:resolver:rejecter:)
  func schedule(
    hour: NSNumber,
    minute: NSNumber,
    title: String,
    body: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
      if let error = error {
        reject("MORNING_REMINDER_PERMISSION_FAILED", error.localizedDescription, error)
        return
      }

      guard granted else {
        resolve(false)
        return
      }

      center.removePendingNotificationRequests(withIdentifiers: [self.identifier])

      let content = UNMutableNotificationContent()
      content.title = title
      content.body = body
      content.sound = .default
      content.userInfo = ["url": "kkumdream://compose"]

      var dateComponents = DateComponents()
      dateComponents.hour = hour.intValue
      dateComponents.minute = minute.intValue

      let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
      let request = UNNotificationRequest(
        identifier: self.identifier,
        content: content,
        trigger: trigger
      )

      center.add(request) { addError in
        if let addError = addError {
          reject("MORNING_REMINDER_SCHEDULE_FAILED", addError.localizedDescription, addError)
          return
        }
        resolve(true)
      }
    }
  }

  @objc(cancel:rejecter:)
  func cancel(
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current()
      .removePendingNotificationRequests(withIdentifiers: [identifier])
    resolve(true)
  }
}
