package com.alexandrerodenas.pixo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderAccessPlugin.class);
        super.onCreate(savedInstanceState);
        // Serves photo bytes from the picked folder to the WebView without a base64 round trip.
        bridge.setWebViewClient(new FolderAccessWebViewClient(bridge));
    }
}
