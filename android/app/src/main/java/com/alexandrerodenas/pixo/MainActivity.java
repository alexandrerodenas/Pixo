package com.alexandrerodenas.pixo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhotoLibraryPlugin.class);
        super.onCreate(savedInstanceState);
        // Serves photos to the WebView by URL, without a base64 round trip over the bridge.
        bridge.setWebViewClient(new PhotoLibraryWebViewClient(bridge));
    }
}
