# MyDeviceSDK Integration Guide

## Step-by-Step Setup for Host Project

### 1. Install the SDK

```bash
# Install the SDK from the .tgz file
npm install ./my-device-sdk-1.0.0.tgz

# Or if you have it in a registry
npm install my-device-sdk
```

### 2. Install Required Peer Dependencies

```bash
npm install @react-native-community/netinfo react-native-device-info react-native-permissions
```

### 3. iOS Setup

#### 3.1 Add Permissions to Info.plist

Add these keys to your `ios/YourApp/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to provide location-based services and analytics.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to provide location-based services and analytics.</string>

<key>NSUserTrackingUsageDescription</key>
<string>This app would like to access your device's advertising identifier to provide personalized content and analytics.</string>
```

#### 3.2 Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

#### 3.3 Clean and Rebuild iOS

```bash
# Clean the build
cd ios
xcodebuild clean -workspace YourApp.xcworkspace -scheme YourApp
cd ..

# Or use React Native CLI
npx react-native run-ios --reset-cache
```

### 4. Android Setup

#### 4.1 Add Permissions to AndroidManifest.xml

Add these permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
  <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.READ_PHONE_STATE" />

```


#### 4.2 Clean and Rebuild Android

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```


### Note: If you are using 0.75 and above new Architecture 
### In bui       set => newArchEnabled=false

### 5. Usage in Your App

#### 5.1 Import and Initialize

```javascript
import MyDeviceSdk from "my-device-sdk";

// Initialize the SDK
MyDeviceSdk.init("YOUR_APP_ID", "YOUR_SERVER_URL");

// Test the native module
MyDeviceSdk.testNativeModule()
  .then((result) => console.log("Native module test:", result))
  .catch((error) => console.error("Native module test failed:", error));
```

#### 5.2 Send Data

```javascript
// Send data manually
MyDeviceSdk.sendData({ eventName: "user_action" })
  .then((result) => console.log("Data sent:", result))
  .catch((error) => console.error("Send failed:", error));
```

### 6. Troubleshooting

#### 6.1 iOS Issues

- **Module not found**: Make sure `pod install` was run
- **Permission denied**: Check Info.plist permissions
- **Bridging header issues**: Verify the podspec configuration

#### 6.2 Android Issues

- **Module not found**: Clean and rebuild the project
- **Permission denied**: Check AndroidManifest.xml permissions

#### 6.3 General Issues

- **Native module returns null**: Check if the module is properly linked
- **Build errors**: Clean and rebuild the entire project

### 7. Verification Steps

1. **Check Native Module**: Use `MyDeviceSdk.testNativeModule()` to verify the module is working
2. **Check Permissions**: Verify location and tracking permissions are granted
3. **Check Network**: Ensure the app has internet access
4. **Check Logs**: Look for SDK logs in the console

### 8. Auto-Setup (Optional)

To enable automatic setup during installation:

```bash
# Install with auto-setup
MY_SDK_AUTO_SETUP=true npm install ./my-device-sdk-1.0.0.tgz

# Install with auto-rebuild
MY_SDK_AUTO_REBUILD=true npm install ./my-device-sdk-1.0.0.tgz
```

### 9. TypeScript Support

If using TypeScript, create a declaration file `src/types/my-device-sdk.d.ts`:

```typescript
declare module "my-device-sdk" {
  export interface DeviceData {
    eventName?: string;
    [key: string]: any;
  }

  export interface MyDeviceSdk {
    init(appId: string, baseUrl: string): void;
    sendData(extraPayload?: DeviceData): Promise<void>;
    stopSendingData(): void;
    testNativeModule(): Promise<any>;
  }

  const MyDeviceSdk: MyDeviceSdk;
  export default MyDeviceSdk;
}
```

### 10. Complete Example

```javascript
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import MyDeviceSdk from "my-device-sdk";

export default function App() {
  useEffect(() => {
    // Initialize SDK
    MyDeviceSdk.init("YOUR_APP_ID", "https://your-server.com");

    // Test native module
    MyDeviceSdk.testNativeModule()
      .then((result) => console.log("✅ Native module working:", result))
      .catch((error) => console.error("❌ Native module failed:", error));

    // Send initial data
    MyDeviceSdk.sendData({ eventName: "app_launch" })
      .then((result) => console.log("✅ Data sent:", result))
      .catch((error) => console.error("❌ Send failed:", error));
  }, []);

  return (
    <View>
      <Text>MyDeviceSDK Test App</Text>
    </View>
  );
}
```
