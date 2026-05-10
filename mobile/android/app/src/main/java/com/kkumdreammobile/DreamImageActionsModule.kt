package com.kkumdreammobile

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class DreamImageActionsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DreamImageActions"

  @ReactMethod
  fun saveImage(imageUrl: String, fileName: String?, promise: Promise) {
    Thread {
          try {
            val image = downloadImage(imageUrl)
            val displayName = buildFileName(fileName, image.mimeType)
            val resolver = reactContext.contentResolver
            val values =
                ContentValues().apply {
                  put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
                  put(MediaStore.Images.Media.MIME_TYPE, image.mimeType)
                  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(
                        MediaStore.Images.Media.RELATIVE_PATH,
                        "${Environment.DIRECTORY_PICTURES}/KkumDream",
                    )
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                  }
                }
            val uri =
                resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Could not create image file")

            resolver.openOutputStream(uri)?.use { it.write(image.bytes) }
                ?: throw IllegalStateException("Could not open image file")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
              values.clear()
              values.put(MediaStore.Images.Media.IS_PENDING, 0)
              resolver.update(uri, values, null, null)
            }

            promise.resolve(uri.toString())
          } catch (error: Exception) {
            promise.reject("DREAM_IMAGE_SAVE_FAILED", error)
          }
        }
        .start()
  }

  @ReactMethod
  fun shareImage(imageUrl: String, fileName: String?, promise: Promise) {
    Thread {
          try {
            val image = downloadImage(imageUrl)
            val displayName = buildFileName(fileName, image.mimeType)
            val shareDir = File(reactContext.cacheDir, "shared_dream_images")
            if (!shareDir.exists()) {
              shareDir.mkdirs()
            }
            val file = File(shareDir, displayName)
            file.writeBytes(image.bytes)

            val uri =
                FileProvider.getUriForFile(
                    reactContext,
                    "${reactContext.packageName}.fileprovider",
                    file,
                )
            val shareIntent =
                Intent(Intent.ACTION_SEND).apply {
                  type = image.mimeType
                  putExtra(Intent.EXTRA_STREAM, uri)
                  addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            val chooser = Intent.createChooser(shareIntent, "꿈카드 이미지 공유")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(chooser)
            promise.resolve(true)
          } catch (error: Exception) {
            promise.reject("DREAM_IMAGE_SHARE_FAILED", error)
          }
        }
        .start()
  }

  private fun downloadImage(imageUrl: String): DownloadedImage {
    val connection = URL(imageUrl).openConnection() as HttpURLConnection
    connection.connectTimeout = 15000
    connection.readTimeout = 20000
    connection.instanceFollowRedirects = true
    connection.connect()
    try {
      if (connection.responseCode !in 200..299) {
        throw IllegalStateException("Image download failed: ${connection.responseCode}")
      }
      val mimeType =
          connection.contentType?.substringBefore(";")?.lowercase(Locale.US)
              ?: "image/jpeg"
      val bytes = connection.inputStream.use { it.readBytes() }
      return DownloadedImage(bytes, normalizeImageMimeType(mimeType))
    } finally {
      connection.disconnect()
    }
  }

  private fun buildFileName(fileName: String?, mimeType: String): String {
    val baseName =
        fileName
            ?.replace(Regex("[^A-Za-z0-9._-]"), "_")
            ?.trim('_', '.', '-')
            ?.takeIf { it.isNotBlank() }
            ?: "kkumdream_${System.currentTimeMillis()}"
    val extension = when (mimeType) {
      "image/png" -> "png"
      "image/webp" -> "webp"
      else -> "jpg"
    }
    return if (baseName.endsWith(".$extension", ignoreCase = true)) {
      baseName
    } else {
      "$baseName.$extension"
    }
  }

  private fun normalizeImageMimeType(mimeType: String): String {
    return when (mimeType) {
      "image/png", "image/webp", "image/jpeg" -> mimeType
      "image/jpg" -> "image/jpeg"
      else -> "image/jpeg"
    }
  }

  private data class DownloadedImage(val bytes: ByteArray, val mimeType: String)
}
