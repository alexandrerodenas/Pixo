package com.alexandrerodenas.pixo;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * Minimal folder access for the Android app, on top of the Storage Access Framework. The web app
 * wraps it in File System Access API handles (services/nativeFileSystem.ts), so the same code
 * scans, deletes and moves photos in the browser and on Android.
 *
 * Every entry is identified by a document URI under the tree the user picked.
 */
@CapacitorPlugin(name = "FolderAccess")
public class FolderAccessPlugin extends Plugin {

    private static final int RW_FLAGS = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(RW_FLAGS | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickDirectoryResult");
    }

    @ActivityCallback
    private void pickDirectoryResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Folder selection cancelled", "CANCELLED");
            return;
        }
        Uri tree = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, RW_FLAGS);
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            JSObject ret = new JSObject();
            ret.put("uri", root.toString());
            ret.put("name", queryName(root));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open folder: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void list(PluginCall call) {
        Uri dir = requireUri(call, "uri");
        if (dir == null) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(dir, DocumentsContract.getDocumentId(dir));
        String[] projection = { Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED };
        JSArray entries = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(children, projection, null, null, null)) {
            while (c != null && c.moveToNext()) {
                JSObject entry = new JSObject();
                entry.put("uri", DocumentsContract.buildDocumentUriUsingTree(dir, c.getString(0)).toString());
                entry.put("name", c.getString(1));
                entry.put("isDirectory", Document.MIME_TYPE_DIR.equals(c.getString(2)));
                entry.put("mimeType", c.getString(2));
                entry.put("size", c.isNull(3) ? 0 : c.getLong(3));
                entry.put("lastModified", c.isNull(4) ? 0 : c.getLong(4));
                entries.put(entry);
            }
        } catch (Exception e) {
            call.reject("Could not list folder: " + e.getMessage(), e);
            return;
        }
        JSObject ret = new JSObject();
        ret.put("entries", entries);
        call.resolve(ret);
    }

    @PluginMethod
    public void createFile(PluginCall call) {
        create(call, call.getString("mimeType", "application/octet-stream"));
    }

    @PluginMethod
    public void createDirectory(PluginCall call) {
        create(call, Document.MIME_TYPE_DIR);
    }

    private void create(PluginCall call, String mimeType) {
        Uri parent = requireUri(call, "parentUri");
        String name = call.getString("name");
        if (parent == null) return;
        if (name == null || name.isEmpty() || name.contains("/")) {
            call.reject("Invalid name");
            return;
        }
        try {
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent, mimeType, name);
            if (created == null) throw new IllegalStateException("provider returned no document");
            JSObject ret = new JSObject();
            ret.put("uri", created.toString());
            // The provider may adjust the name (e.g. to avoid a clash), report the real one.
            ret.put("name", queryName(created));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not create " + name + ": " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void delete(PluginCall call) {
        Uri uri = requireUri(call, "uri");
        if (uri == null) return;
        try {
            if (!DocumentsContract.deleteDocument(getContext().getContentResolver(), uri)) throw new IllegalStateException("provider refused");
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not delete: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        Uri uri = requireUri(call, "uri");
        String data = call.getString("data");
        if (uri == null) return;
        if (data == null) {
            call.reject("Missing data");
            return;
        }
        String mode = call.getBoolean("append", false) ? "wa" : "wt";
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, mode)) {
            if (out == null) throw new IllegalStateException("no output stream");
            out.write(Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not write: " + e.getMessage(), e);
        }
    }

    private Uri requireUri(PluginCall call, String key) {
        String value = call.getString(key);
        Uri uri = value == null ? null : Uri.parse(value);
        if (uri == null || !isUnderPickedFolder(getContext(), uri)) {
            call.reject("Not inside a folder picked by the user");
            return null;
        }
        return uri;
    }

    private String queryName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        return uri.getLastPathSegment();
    }

    /** True when uri is a document of a tree the user granted us read/write access to. */
    static boolean isUnderPickedFolder(Context context, Uri uri) {
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()) || !DocumentsContract.isDocumentUri(context, uri)) return false;
        String treeId;
        try {
            treeId = DocumentsContract.getTreeDocumentId(uri);
        } catch (IllegalArgumentException e) {
            return false;
        }
        Uri tree = DocumentsContract.buildTreeDocumentUri(uri.getAuthority(), treeId);
        for (UriPermission p : context.getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(tree) && p.isReadPermission() && p.isWritePermission()) return true;
        }
        return false;
    }
}
