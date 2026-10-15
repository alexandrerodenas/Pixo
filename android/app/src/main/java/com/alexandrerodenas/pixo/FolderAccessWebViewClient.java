package com.alexandrerodenas.pixo;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Answers GET /_pixo_folder/file?uri=<document uri> with the document's bytes, so the web app can
 * read photos from a Storage Access Framework folder with a plain fetch().
 */
public class FolderAccessWebViewClient extends BridgeWebViewClient {

    static final String FILE_PATH = "/_pixo_folder/file";

    private final Bridge bridge;

    public FolderAccessWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (!FILE_PATH.equals(url.getPath()) || !isAppOrigin(url)) {
            return super.shouldInterceptRequest(view, request);
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        String documentUri = url.getQueryParameter("uri");
        // Only documents under a folder the user picked (content:// with a granted permission) are served.
        if (documentUri == null || !documentUri.startsWith("content://") || !FolderAccessPlugin.isUnderPickedFolder(bridge.getContext(), Uri.parse(documentUri))) {
            return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", headers, null);
        }
        try {
            Uri uri = Uri.parse(documentUri);
            String mimeType = bridge.getContext().getContentResolver().getType(uri);
            InputStream stream = bridge.getContext().getContentResolver().openInputStream(uri);
            return new WebResourceResponse(mimeType != null ? mimeType : "application/octet-stream", null, 200, "OK", headers, stream);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, null);
        }
    }

    private boolean isAppOrigin(Uri url) {
        Uri app = Uri.parse(bridge.getLocalUrl());
        return app.getScheme() != null && app.getScheme().equals(url.getScheme()) && app.getHost() != null && app.getHost().equals(url.getHost());
    }
}
