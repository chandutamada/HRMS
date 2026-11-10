package com.hrms.mobile.mobile

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {

    companion object {
        private const val TAG = "HRMS_MainActivity"
        private const val CHANNEL_NAME = "com.hrms.mobile/native_tracking"
        private const val ACTIVITY_RECOGNITION_REQUEST_CODE = 4401
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var isAutoRestartedFromBoot: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.getBooleanExtra(BootReceiver.EXTRA_RESTART_TRACKING, false) == true) {
            isAutoRestartedFromBoot = true
            Log.i(TAG, "Application started with EXTRA_RESTART_TRACKING flag from BootReceiver.")
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL_NAME).setMethodCallHandler { call, result ->
            when (call.method) {
                "acquireWakeLock" -> {
                    acquirePartialWakeLock()
                    result.success(true)
                }
                "releaseWakeLock" -> {
                    releasePartialWakeLock()
                    result.success(true)
                }
                "isRebootRestart" -> {
                    val wasReboot = isAutoRestartedFromBoot
                    isAutoRestartedFromBoot = false // Reset after query
                    result.success(wasReboot)
                }
                "requestActivityRecognition" -> {
                    requestActivityRecognitionPermission()
                    result.success(hasActivityRecognitionPermission())
                }
                "hasActivityRecognitionPermission" -> {
                    result.success(hasActivityRecognitionPermission())
                }
                else -> result.notImplemented()
            }
        }
    }

    @Synchronized
    private fun acquirePartialWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "hrms:ActiveShiftWakeLock"
            )?.apply {
                setReferenceCounted(false)
            }
        }

        if (wakeLock?.isHeld == false) {
            wakeLock?.acquire()
            Log.i(TAG, "Acquired PARTIAL_WAKE_LOCK for active shift tracking.")
        }
    }

    @Synchronized
    private fun releasePartialWakeLock() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
            Log.i(TAG, "Released PARTIAL_WAKE_LOCK.")
        }
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACTIVITY_RECOGNITION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun requestActivityRecognitionPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasActivityRecognitionPermission()) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACTIVITY_RECOGNITION),
                ACTIVITY_RECOGNITION_REQUEST_CODE
            )
        }
    }

    override fun onDestroy() {
        releasePartialWakeLock()
        super.onDestroy()
    }
}
