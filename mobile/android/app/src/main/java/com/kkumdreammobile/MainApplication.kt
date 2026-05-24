package com.kkumdreammobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Application
import android.content.Context
import android.graphics.Typeface
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

private const val DREAM_IMPORTANT_CHANNEL_ID = "dream_important"
private const val DREAM_ACTIVITY_CHANNEL_ID = "dream_activity"

private val DREAM_FONT_ASSETS =
    mapOf(
        "NanumDaHaengCe" to "fonts/NanumDaHaengCe.ttf",
        "NanumDaeGwangYuRi" to "fonts/NanumDaeGwangYuRi.ttf",
        "NanumMiRaeNaMu" to "fonts/NanumMiRaeNaMu.ttf",
        "NanumAGiSaRangCe" to "fonts/NanumAGiSaRangCe.ttf",
        "NanumYeDangCe" to "fonts/NanumYeDangCe.ttf",
    )

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(DreamImageActionsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    registerCustomFonts()
    createNotificationChannels()
    loadReactNative(this)
  }

  private fun registerCustomFonts() {
    val fontManager = ReactFontManager.getInstance()
    DREAM_FONT_ASSETS.forEach { (fontFamily, assetPath) ->
      fontManager.addCustomFont(fontFamily, Typeface.createFromAsset(assets, assetPath))
    }
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val importantChannel =
        NotificationChannel(
                DREAM_IMPORTANT_CHANNEL_ID,
                "중요한 꿈 알림",
                NotificationManager.IMPORTANCE_HIGH,
            )
            .apply {
              description = "꿈카드 도착과 꿈주인 댓글 알림"
              enableVibration(true)
            }
    val activityChannel =
        NotificationChannel(
                DREAM_ACTIVITY_CHANNEL_ID,
                "꿈 활동 알림",
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            .apply {
              description = "댓글, 공유, 기타 활동 알림"
            }

    val notificationManager =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.createNotificationChannels(listOf(importantChannel, activityChannel))
  }
}
