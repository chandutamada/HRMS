package com.hrms.mobile.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "HRMS_BootReceiver"
        private const val PREFS_NAME = "FlutterSharedPreferences"
        private const val KEY_TRACKING_ACTIVE = "flutter.is_shift_tracking_active"
        const val EXTRA_RESTART_TRACKING = "extra_auto_restart_tracking"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.i(TAG, "Received broadcast action: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val wasTrackingActive = prefs.getBoolean(KEY_TRACKING_ACTIVE, false)
            Log.i(TAG, "Shift tracking active before reboot/update: $wasTrackingActive")

            if (wasTrackingActive) {
                // Acquire temporary partial WakeLock to guarantee execution during boot
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "hrms:BootReceiverWakeLock"
                )
                wakeLock?.acquire(30000L) // 30-second safe timeout

                try {
                    val launchIntent = Intent(context, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        putExtra(EXTRA_RESTART_TRACKING, true)
                    }
                    context.startActivity(launchIntent)
                    Log.i(TAG, "Launched MainActivity with auto-restart intent flag")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch MainActivity on boot", e)
                } finally {
                    if (wakeLock != null && wakeLock.isHeld) {
                        try {
                            wakeLock.release()
                        } catch (_: Exception) {}
                    }
                }
            }
        }
    }
}
