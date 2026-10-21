package com.alexandrerodenas.pixo;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.MediaStore.Images;
import android.provider.OpenableColumns;
import android.content.Intent;
import com.getcapacitor.PluginListenerHandle;
import android.provider.Settings;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;

/**
 * Gives the web app every photo on the phone through MediaStore: list, delete (to the trash on
 * Android 11+), move and copy into Pictures/<folder>. Photo bytes are served to the WebView by
 * PhotoLibraryWebViewClient. On Android 11+ deleting or moving other apps' photos needs the user's
 * consent, asked once per batch through the system dialog.
 */
@CapacitorPlugin(name = "PhotoLibrary")
public class PhotoLibraryPlugin extends Plugin {

    static final List<String> MIME_TYPES = java.util.Arrays.asList("image/jpeg", "image/png", "image/gif", "image/webp");

    // Photos received through "Share to Pixo", kept until the app restarts. Index = position here.
    private static final List<Uri> sharedUris = new java.util.concurrent.CopyOnWriteArrayList<>();
    private static PhotoLibraryPlugin instance;

    static Uri sharedUri(int index) {
        return index >= 0 && index < sharedUris.size() ? sharedUris.get(index) : null;
    }

    /** Reads the photos of a SEND / SEND_MULTIPLE intent and tells the web app about them. */
    static void receiveShare(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri != null) uris.add(uri);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            List<Uri> many = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (many != null) uris.addAll(many);
        }
        if (uris.isEmpty()) return;
        // The intent is handled once: a rotation or a resume must not add the same photos again
        intent.setAction(null);
        int first = sharedUris.size();
        sharedUris.addAll(uris);
        if (instance != null) instance.notifyShared(first);
    }

    private void notifyShared(int first) {
        JSArray photos = new JSArray();
        for (int i = first; i < sharedUris.size(); i++) photos.put(describeShared(i));
        JSObject data = new JSObject();
        data.put("photos", photos);
        notifyListeners("shared", data);
    }

    private JSObject describeShared(int index) {
        Uri uri = sharedUris.get(index);
        String name = "shared-" + index + ".jpg";
        long size = 0;
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                if (!c.isNull(0)) name = c.getString(0);
                if (!c.isNull(1)) size = c.getLong(1);
            }
        } catch (Exception ignored) {}
        JSObject p = new JSObject();
        p.put("index", index);
        p.put("name", name);
        p.put("size", size);
        p.put("lastModified", System.currentTimeMillis());
        return p;
    }

    private ActivityResultLauncher<String[]> permissionLauncher;
    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pendingPermissionCall;
    private Runnable pendingConsentAction;
    private PluginCall pendingConsentCall;

    @Override
    public void load() {
        instance = this;
        permissionLauncher = getActivity().registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
            PluginCall call = pendingPermissionCall;
            pendingPermissionCall = null;
            if (call != null) resolveAccess(call);
        });
        consentLauncher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result -> {
            PluginCall call = pendingConsentCall;
            Runnable action = pendingConsentAction;
            pendingConsentCall = null;
            pendingConsentAction = null;
            if (call == null) return;
            if (result.getResultCode() != Activity.RESULT_OK) {
                call.reject("Cancelled", "CANCELLED");
            } else if (action != null) {
                getBridge().execute(action);
            }
        });
    }

    /** Photos received through "Share to Pixo" that the app has not shown yet. */
    @PluginMethod
    public void getSharedPhotos(PluginCall call) {
        JSArray photos = new JSArray();
        for (int i = 0; i < sharedUris.size(); i++) photos.put(describeShared(i));
        JSObject ret = new JSObject();
        ret.put("photos", photos);
        call.resolve(ret);
    }

    // --- Access ---

    static boolean hasReadAccess(Context context) {
        if (Build.VERSION.SDK_INT >= 34 && granted(context, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)) return true;
        if (Build.VERSION.SDK_INT >= 33) return granted(context, Manifest.permission.READ_MEDIA_IMAGES);
        return granted(context, Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private static boolean granted(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void resolveAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasReadAccess(getContext()));
        // Android 14+: the user may have shared only some photos
        ret.put("limited", Build.VERSION.SDK_INT >= 34 && !granted(getContext(), Manifest.permission.READ_MEDIA_IMAGES)
            && granted(getContext(), Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED));
        call.resolve(ret);
    }

    @PluginMethod
    public void checkAccess(PluginCall call) {
        resolveAccess(call);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        String[] permissions;
        if (Build.VERSION.SDK_INT >= 34) {
            permissions = new String[] { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED };
        } else if (Build.VERSION.SDK_INT >= 33) {
            permissions = new String[] { Manifest.permission.READ_MEDIA_IMAGES };
        } else if (Build.VERSION.SDK_INT >= 30) {
            permissions = new String[] { Manifest.permission.READ_EXTERNAL_STORAGE };
        } else {
            // Android 10 and older move and delete files directly (legacy storage)
            permissions = new String[] { Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE };
        }
        pendingPermissionCall = call;
        permissionLauncher.launch(permissions);
    }

    // --- Listing ---

    static Uri collection() {
        return Build.VERSION.SDK_INT >= 29 ? Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL) : Images.Media.EXTERNAL_CONTENT_URI;
    }

    static Uri photoUri(long id) {
        return ContentUris.withAppendedId(collection(), id);
    }

    @PluginMethod
    public void listPhotos(PluginCall call) {
        if (!hasReadAccess(getContext())) {
            call.reject("No access to photos", "NO_ACCESS");
            return;
        }
        String pathColumn = Build.VERSION.SDK_INT >= 29 ? Images.Media.RELATIVE_PATH : Images.Media.DATA;
        String[] projection = { Images.Media._ID, Images.Media.DISPLAY_NAME, pathColumn, Images.Media.SIZE, Images.Media.DATE_MODIFIED };
        String selection = Images.Media.MIME_TYPE + " IN (?,?,?,?)";
        String root = Environment.getExternalStorageDirectory().getAbsolutePath() + "/";

        JSArray photos = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(collection(), projection, selection, MIME_TYPES.toArray(new String[0]), Images.Media.DATE_MODIFIED + " DESC")) {
            while (c != null && c.moveToNext()) {
                String name = c.getString(1);
                String folder = c.isNull(2) ? "" : c.getString(2);
                if (Build.VERSION.SDK_INT < 29) {
                    // DATA is an absolute file path: keep the part under the storage root, without the name
                    folder = folder.startsWith(root) ? folder.substring(root.length()) : folder.replaceFirst("^/storage/[^/]+/", "");
                    int slash = folder.lastIndexOf('/');
                    folder = slash >= 0 ? folder.substring(0, slash + 1) : "";
                }
                JSObject p = new JSObject();
                p.put("mediaId", c.getLong(0));
                p.put("name", name);
                p.put("folder", folder);
                p.put("size", c.getLong(3));
                p.put("lastModified", c.getLong(4) * 1000);
                photos.put(p);
            }
        } catch (Exception e) {
            call.reject("Could not list photos: " + e.getMessage(), e);
            return;
        }
        JSObject ret = new JSObject();
        ret.put("photos", photos);
        call.resolve(ret);
    }

    // --- Delete / move / copy ---

    private List<Uri> urisFrom(PluginCall call) {
        List<Uri> uris = new ArrayList<>();
        JSArray ids = call.getArray("mediaIds");
        if (ids == null) return uris;
        for (int i = 0; i < ids.length(); i++) uris.add(photoUri(ids.optLong(i)));
        return uris;
    }

    /** Runs action once the user agreed to change these photos (Android 11+), or right away. */
    private void withConsent(PluginCall call, PendingIntent request, Runnable action) {
        if (request == null) {
            action.run();
            return;
        }
        pendingConsentCall = call;
        pendingConsentAction = action;
        consentLauncher.launch(new IntentSenderRequest.Builder(request.getIntentSender()).build());
    }

    private static JSObject done(List<Long> ids) {
        JSObject ret = new JSObject();
        ret.put("done", new JSONArray(ids));
        return ret;
    }

    @PluginMethod
    public void deletePhotos(PluginCall call) {
        List<Uri> uris = urisFrom(call);
        ContentResolver resolver = getContext().getContentResolver();
        if (Build.VERSION.SDK_INT >= 30) {
            // Recoverable from the gallery's trash for 30 days
            PendingIntent request = MediaStore.createTrashRequest(resolver, uris, true);
            withConsent(call, request, () -> {
                List<Long> ids = new ArrayList<>();
                for (Uri uri : uris) ids.add(ContentUris.parseId(uri));
                call.resolve(done(ids));
            });
            return;
        }
        List<Long> ids = new ArrayList<>();
        for (Uri uri : uris) {
            try {
                if (resolver.delete(uri, null, null) > 0) ids.add(ContentUris.parseId(uri));
            } catch (Exception ignored) {}
        }
        call.resolve(done(ids));
    }

    @PluginMethod
    public void movePhotos(PluginCall call) {
        List<Uri> uris = urisFrom(call);
        String folder = targetFolder(call);
        if (folder == null) return;
        ContentResolver resolver = getContext().getContentResolver();
        PendingIntent request = Build.VERSION.SDK_INT >= 30 ? MediaStore.createWriteRequest(resolver, uris) : null;
        withConsent(call, request, () -> {
            List<Long> ids = new ArrayList<>();
            for (Uri uri : uris) {
                try {
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues values = new ContentValues();
                        values.put(Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + folder + "/");
                        if (resolver.update(uri, values, null, null) > 0) ids.add(ContentUris.parseId(uri));
                    } else if (legacyMove(uri, folder)) {
                        ids.add(ContentUris.parseId(uri));
                    }
                } catch (Exception ignored) {}
            }
            call.resolve(done(ids));
        });
    }

    @PluginMethod
    public void copyPhotos(PluginCall call) {
        List<Uri> uris = urisFrom(call);
        String folder = targetFolder(call);
        if (folder == null) return;
        getBridge().execute(() -> {
            List<Long> ids = new ArrayList<>();
            for (Uri uri : uris) {
                try {
                    if (copy(uri, folder)) ids.add(ContentUris.parseId(uri));
                } catch (Exception ignored) {}
            }
            call.resolve(done(ids));
        });
    }

    private String targetFolder(PluginCall call) {
        String folder = call.getString("folder", "");
        if (folder == null || folder.isEmpty() || folder.contains("/") || folder.startsWith(".")) {
            call.reject("Invalid folder name");
            return null;
        }
        return folder;
    }

    private String[] nameAndType(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { Images.Media.DISPLAY_NAME, Images.Media.MIME_TYPE, Images.Media.DATA }, null, null, null)) {
            if (c != null && c.moveToFirst()) return new String[] { c.getString(0), c.getString(1), c.getString(2) };
        }
        throw new IllegalStateException("photo not found");
    }

    private boolean copy(Uri source, String folder) throws Exception {
        String[] info = nameAndType(source);
        ContentResolver resolver = getContext().getContentResolver();
        if (Build.VERSION.SDK_INT >= 29) {
            // MediaStore picks a free name if one is taken
            ContentValues values = new ContentValues();
            values.put(Images.Media.DISPLAY_NAME, info[0]);
            values.put(Images.Media.MIME_TYPE, info[1]);
            values.put(Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + folder + "/");
            values.put(Images.Media.IS_PENDING, 1);
            Uri target = resolver.insert(Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
            if (target == null) return false;
            try (InputStream in = resolver.openInputStream(source); OutputStream out = resolver.openOutputStream(target)) {
                copyStream(in, out);
            } catch (Exception e) {
                resolver.delete(target, null, null);
                throw e;
            }
            values.clear();
            values.put(Images.Media.IS_PENDING, 0);
            resolver.update(target, values, null, null);
            return true;
        }
        File target = freeFile(folder, info[0]);
        try (InputStream in = new FileInputStream(info[2]); OutputStream out = new FileOutputStream(target)) {
            copyStream(in, out);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { target.getAbsolutePath() }, null, null);
        return true;
    }

    private boolean legacyMove(Uri source, String folder) {
        String[] info = nameAndType(source);
        File from = new File(info[2]);
        File to = freeFile(folder, info[0]);
        if (!from.renameTo(to)) return false;
        ContentValues values = new ContentValues();
        values.put(Images.Media.DATA, to.getAbsolutePath());
        getContext().getContentResolver().update(source, values, null, null);
        return true;
    }

    @SuppressWarnings("deprecation")
    private static File freeFile(String folder, String name) {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), folder);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        File file = new File(dir, name);
        for (int n = 1; file.exists(); n++) file = new File(dir, base + " (" + n + ")" + ext);
        return file;
    }

    private static void copyStream(InputStream in, OutputStream out) throws Exception {
        if (in == null || out == null) throw new IllegalStateException("cannot open stream");
        byte[] buffer = new byte[64 * 1024];
        for (int n; (n = in.read(buffer)) > 0; ) out.write(buffer, 0, n);
    }

    // --- Device ---

    /** The name the user gave the phone ("Alex's Pixel", "Galaxy S24 de Alex"), when Android exposes one. */
    @PluginMethod
    public void getDeviceName(PluginCall call) {
        String name = null;
        ContentResolver resolver = getContext().getContentResolver();
        try {
            if (Build.VERSION.SDK_INT >= 25) name = Settings.Global.getString(resolver, Settings.Global.DEVICE_NAME);
        } catch (Exception ignored) {}
        if (name == null || name.isEmpty()) {
            try {
                name = Settings.Secure.getString(resolver, "bluetooth_name");
            } catch (Exception ignored) {}
        }
        JSObject ret = new JSObject();
        ret.put("name", name == null ? "" : name);
        call.resolve(ret);
    }
}
