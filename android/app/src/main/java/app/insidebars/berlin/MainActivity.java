package app.insidebars.berlin;

import android.graphics.Color;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Android 15+ (targetSdk 35+) forces edge-to-edge: android:statusBarColor
        // and android:navigationBarColor in styles.xml are ignored. Use the
        // androidx EdgeToEdge API with a cream scrim and dark icons so the
        // system bars blend into the app background.
        int cream = Color.parseColor("#f8f5ef");
        EdgeToEdge.enable(
            this,
            SystemBarStyle.light(cream, cream),
            SystemBarStyle.light(cream, cream)
        );
        super.onCreate(savedInstanceState);
    }
}
