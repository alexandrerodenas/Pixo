package com.alexandrerodenas.pixo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Foreground service that shows the analysis progress in a notification. It also keeps the process
 * (and so the web app's analysis) alive and the CPU awake while the app is in the background.
 */
public class AnalysisService extends Service {

    static final String EXTRA_DONE = "done";
    static final String EXTRA_TOTAL = "total";
    static final String EXTRA_TEXT = "text";

    private static final String CHANNEL_ID = "pixo_analysis";
    private static final String DONE_CHANNEL_ID = "pixo_analysis_done";
    private static final int NOTIFICATION_ID = 1;
    private static final int DONE_NOTIFICATION_ID = 2;
    private static final long MAX_WAKE_MS = 6L * 60 * 60 * 1000;

    private PowerManager.WakeLock wakeLock;
    private boolean inForeground = false;

    static void update(Context context, int done, int total, String text) {
        Intent intent = new Intent(context, AnalysisService.class)
            .putExtra(EXTRA_DONE, done).putExtra(EXTRA_TOTAL, total).putExtra(EXTRA_TEXT, text);
        context.startForegroundService(intent);
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, AnalysisService.class));
    }

    /** A plain, dismissible notification shown when a run finishes while the app is in the background. */
    static void notifyDone(Context context, String text) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(DONE_CHANNEL_ID, "Analyse terminée", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, DONE_CHANNEL_ID) : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("Pixo")
            .setContentText(text)
            .setContentIntent(openAppIntent(context))
            .setAutoCancel(true);
        manager.notify(DONE_NOTIFICATION_ID, builder.build());
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        int done = intent == null ? 0 : intent.getIntExtra(EXTRA_DONE, 0);
        int total = intent == null ? 0 : intent.getIntExtra(EXTRA_TOTAL, 0);
        String text = intent == null ? null : intent.getStringExtra(EXTRA_TEXT);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && manager != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Analyse des photos", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("Pixo analyse tes photos")
            .setContentText(text != null ? text : done + " / " + total)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppIntent(this))
            .setProgress(Math.max(total, 1), Math.min(done, Math.max(total, 1)), total <= 0);
        Notification notification = builder.build();

        if (!inForeground) {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            inForeground = true;
            PowerManager power = getSystemService(PowerManager.class);
            if (power != null) {
                wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pixo:analysis");
                wakeLock.acquire(MAX_WAKE_MS);
            }
        } else if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
