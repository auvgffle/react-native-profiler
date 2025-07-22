# MyDeviceSDK

A lightweight React Native SDK to collect device information, advertising ID, location, and send it securely to your backend.

---

## 🚀 Installation

1️⃣ Add the SDK to your React Native app:
```bash
npm install ../my-device-sdk
npx react-native config    // manual linking
permission 
    Android
        Add to AndroidManifest.xml:
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
        <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
        <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
        <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
        <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
        <uses-permission android:name="android.permission.READ_PHONE_STATE" />
        

    iOS
        Add to Info.plist:
            <key>NSLocationWhenInUseUsageDescription</key>
            <string>We need location to provide better service</string>

            <key>NSUserTrackingUsageDescription</key>
            <string>We need IDFA for analytics</string>




import MyDeviceSdk from 'my-device-sdk';
const CLIENT_APP_ID = "MFC_TEST_123456"
MyDeviceSdk.init(CLIENT_APP_ID, 'http://192.168.10.174:5000');

MyDeviceSdk.sendData({eventName: 'SendData'}).then(() => console.log('✅ Event ssuccesssfully sent')).catch(err => console.error('❌ Event failed', err));