package com.kkumdreammobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MorningReminderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MorningReminder"

  @ReactMethod
  fun schedule(hour: Double, minute: Double, title: String, body: String, promise: Promise) {
    try {
      MorningReminderReceiver.saveSchedule(
          reactContext,
          hour.toInt().coerceIn(0, 23),
          minute.toInt().coerceIn(0, 59),
          title,
          body,
      )
      MorningReminderReceiver.scheduleNext(reactContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("MORNING_REMINDER_SCHEDULE_FAILED", error)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    try {
      MorningReminderReceiver.cancel(reactContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("MORNING_REMINDER_CANCEL_FAILED", error)
    }
  }
}
