# 🚀 MyDeviceSDK Quick Start Guide

## For Host Projects (Step by Step)

### 1. Install SDK

```bash
npm install ./my-device-sdk-1.0.0.tgz
```

### 2. Install Dependencies

```bash
npm install @react-native-community/netinfo react-native-device-info react-native-permissions
```

### 3. Auto-Setup (Recommended)

```bash
# Run the setup script to configure everything automatically
npx my-device-sdk setup
```

### 4. Manual Setup (If auto-setup doesn't work)

#### iOS Setup:

```bash
# Add permissions to ios/YourApp/Info.plist
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to provide location-based services and analytics.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to provide location-based services and analytics.</string>
<key>NSUserTrackingUsageDescription</key>
<string>This app would like to access your device's advertising identifier to provide personalized content and analytics.</string>

# Install pods
cd ios && pod install && cd ..
```

#### Android Setup:

```bash
# Add permissions to android/app/src/main/AndroidManifest.xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
```

### 5. Rebuild Projects

```bash
# iOS
npx react-native run-ios --reset-cache

# Android
npx react-native run-android
```

### 6. Test in Your App

```javascript
import MyDeviceSdk from "my-device-sdk";

// Initialize
MyDeviceSdk.init("YOUR_APP_ID", "YOUR_SERVER_URL");

// Test native module
MyDeviceSdk.testNativeModule()
  .then((result) => console.log("✅ Native module working:", result))
  .catch((error) => console.error("❌ Native module failed:", error));

// Send data
MyDeviceSdk.sendData({ eventName: "app_launch" })
  .then((result) => console.log("✅ Data sent:", result))
  .catch((error) => console.error("❌ Send failed:", error));
```

## Troubleshooting

### iOS Issues:

- **Module not found**: Run `cd ios && pod install && cd ..`
- **Permission denied**: Check Info.plist permissions
- **Build errors**: Clean build with `npx react-native run-ios --reset-cache`

### Android Issues:

- **Module not found**: Clean and rebuild with `cd android && ./gradlew clean && cd .. && npx react-native run-android`
- **Permission denied**: Check AndroidManifest.xml permissions

### General Issues:

- **Native module returns null**: The module isn't properly linked - rebuild the project
- **SDK not working**: Check console logs for detailed error messages

## Quick Test

```bash
# Test the SDK directly
npx my-device-sdk test
```

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify all permissions are added correctly
3. Make sure you've rebuilt the project after installation
4. Test with `MyDeviceSdk.testNativeModule()` to verify native module is working
