package com.alexandrerodenas.pixo;

import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Size;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Answers GET /_pixo_media?id=<MediaStore id>[&thumb=1] with the photo (or a small system
 * thumbnail), so the web app loads photos with plain URLs instead of holding every file in memory.
 */
public class PhotoLibraryWebViewClient extends BridgeWebViewClient {

    static final String PATH = "/_pixo_media";
    private static final int THUMB_SIZE = 384;

    private final Bridge bridge;

    public PhotoLibraryWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (!PATH.equals(url.getPath()) || !isAppOrigin(url)) {
            return super.shouldInterceptRequest(view, request);
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        if (!PhotoLibraryPlugin.hasReadAccess(bridge.getContext())) {
            return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", headers, null);
        }
        try {
            Uri uri = PhotoLibraryPlugin.photoUri(Long.parseLong(url.getQueryParameter("id")));
            if ("1".equals(url.getQueryParameter("thumb"))) {
                return new WebResourceResponse("image/jpeg", null, 200, "OK", headers, thumbnail(uri));
            }
            String mimeType = bridge.getContext().getContentResolver().getType(uri);
            InputStream stream = bridge.getContext().getContentResolver().openInputStream(uri);
            return new WebResourceResponse(mimeType != null ? mimeType : "application/octet-stream", null, 200, "OK", headers, stream);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, null);
        }
    }

    @SuppressWarnings("deprecation")
    private InputStream thumbnail(Uri uri) throws Exception {
        Bitmap bitmap = Build.VERSION.SDK_INT >= 29
            ? bridge.getContext().getContentResolver().loadThumbnail(uri, new Size(THUMB_SIZE, THUMB_SIZE), null)
            : MediaStore.Images.Thumbnails.getThumbnail(bridge.getContext().getContentResolver(), Long.parseLong(uri.getLastPathSegment()), MediaStore.Images.Thumbnails.MINI_KIND, null);
        if (bitmap == null) throw new IllegalStateException("no thumbnail");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out);
        bitmap.recycle();
        return new ByteArrayInputStream(out.toByteArray());
    }

    private boolean isAppOrigin(Uri url) {
        Uri app = Uri.parse(bridge.getLocalUrl());
        return app.getScheme() != null && app.getScheme().equals(url.getScheme()) && app.getHost() != null && app.getHost().equals(url.getHost());
    }
}
