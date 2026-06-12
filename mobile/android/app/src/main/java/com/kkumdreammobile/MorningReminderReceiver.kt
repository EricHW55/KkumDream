package com.kkumdreammobile

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Calendar

private const val DREAM_IMPORTANT_CHANNEL_ID = "dream_important"
private const val PREFS_NAME = "morning_dream_reminder"
private const val KEY_ENABLED = "enabled"
private const val KEY_HOUR = "hour"
private const val KEY_MINUTE = "minute"
private const val KEY_TITLE = "title"
private const val KEY_BODY = "body"
private const val ACTION_SHOW_REMINDER = "com.kkumdreammobile.MORNING_DREAM_REMINDER"
private const val REQUEST_CODE = 730
private const val NOTIFICATION_ID = 730

class MorningReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
      if (isEnabled(context)) {
        scheduleNext(context)
      }
      return
    }

    if (intent?.action != ACTION_SHOW_REMINDER || !isEnabled(context)) {
      return
    }

    showNotification(context)
    scheduleNext(context)
  }

  companion object {
    fun saveSchedule(context: Context, hour: Int, minute: Int, title: String, body: String) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
          .edit()
          .putBoolean(KEY_ENABLED, true)
          .putInt(KEY_HOUR, hour)
          .putInt(KEY_MINUTE, minute)
          .putString(KEY_TITLE, title)
          .putString(KEY_BODY, body)
          .apply()
    }

    fun scheduleNext(context: Context) {
      if (!isEnabled(context)) {
        return
      }

      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val hour = prefs.getInt(KEY_HOUR, 7)
      val minute = prefs.getInt(KEY_MINUTE, 30)
      val nextTime =
          Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) {
              add(Calendar.DAY_OF_YEAR, 1)
            }
          }

      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarmManager.cancel(pendingIntent(context))
      alarmManager.setAndAllowWhileIdle(
          AlarmManager.RTC_WAKEUP,
          nextTime.timeInMillis,
          pendingIntent(context),
      )
    }

    fun cancel(context: Context) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
          .edit()
          .putBoolean(KEY_ENABLED, false)
          .apply()
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarmManager.cancel(pendingIntent(context))
    }

    private fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)

    private fun pendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, MorningReminderReceiver::class.java).apply {
        action = ACTION_SHOW_REMINDER
      }
      return PendingIntent.getBroadcast(
          context,
          REQUEST_CODE,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private fun showNotification(context: Context) {
      if (
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
              ContextCompat.checkSelfPermission(
                  context,
                  Manifest.permission.POST_NOTIFICATIONS,
              ) != PackageManager.PERMISSION_GRANTED
      ) {
        return
      }

      ensureChannel(context)

      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val contentIntent =
          PendingIntent.getActivity(
              context,
              REQUEST_CODE,
              Intent(Intent.ACTION_VIEW, Uri.parse("kkumdream://compose")).apply {
                setPackage(context.packageName)
              },
              PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
      val notification =
          NotificationCompat.Builder(context, DREAM_IMPORTANT_CHANNEL_ID)
              .setSmallIcon(R.drawable.ic_notification)
              .setColor(ContextCompat.getColor(context, R.color.notification_icon_color))
              .setContentTitle(prefs.getString(KEY_TITLE, "꿈이 흐릿해지기 전에") ?: "꿈이 흐릿해지기 전에")
              .setContentText(
                  prefs.getString(KEY_BODY, "간밤에 스친 꿈을 꿈드림에 살짝 적어보세요.")
                      ?: "간밤에 스친 꿈을 꿈드림에 살짝 적어보세요.",
              )
              .setContentIntent(contentIntent)
              .setAutoCancel(true)
              .setPriority(NotificationCompat.PRIORITY_HIGH)
              .build()

      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return
      }

      val channel =
          NotificationChannel(
                  DREAM_IMPORTANT_CHANNEL_ID,
                  "중요한 꿈 알림",
                  NotificationManager.IMPORTANCE_HIGH,
              )
              .apply {
                description = "꿈 선물과 아침 기록 알림"
                enableVibration(true)
              }
      val notificationManager =
          context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }
}
