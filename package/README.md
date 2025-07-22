# react-native-profiler

A professional React Native SDK for profiling device, network, and location data. Easy to integrate, extensible, and production-ready.

---

## ✨ Features

- Collects device info, network info, location, and advertising ID
- Handles permissions and user prompts natively
- Customizable user info (email, phone, etc.)
- Automatic or manual data sending
- Designed for extensibility and reliability

---

## 🚀 Installation

```sh
npm install react-native-profiler
# or
yarn add react-native-profiler
```

> **Note:** For React Native < 0.60, you may need to link native modules manually.

---

## 📋 Requirements & Permissions

### React Native Requirements
- **React Native**: `>=0.60.0` (autolinking supported)
- **Android**: API Level 21+
- **iOS**: iOS 10.0+

### Peer Dependencies
- `react-native-device-info`
- `@react-native-community/netinfo`

(Install these if not already present in your project.)

```sh
npm install react-native-device-info @react-native-community/netinfo
```

### Android Permissions
Add the following to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="com.google.android.gms.permission.AD_ID" />
```

#### ⚠️ Note for React Native 0.75+
If you are using React Native 0.75 and above with the new architecture, you may need to disable it for compatibility:

- In `android/gradle.properties` set:
  ```
  newArchEnabled=false
  ```

### iOS Permissions
Add the following keys to your `ios/YourApp/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app uses your location to provide analytics and profiling features.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app uses your location to provide analytics and profiling features.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>This app uses your location to provide analytics and profiling features.</string>
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

---

## 🛠️ Quick Start

### 1. Import the SDK

```js
import Profiler from 'react-native-profiler';
```

### 2. Initialize the SDK

Call `init` once (e.g., in your `App.js` or app entry point):

```js
Profiler.init('YOUR_APP_ID', {
  email: 'user@email.com',      // (optional) User email
  phone: '+1234567890',         // (optional) User phone
  name: 'John Doe',             // (optional) User name
  userId: 'abc123',             // (optional) Any custom user ID
  // ...add any other user info fields you want!
});
```
- **`YOUR_APP_ID`**: (string, required) — Your application or API key.
- **Second argument**: (object, optional) — Any user info you want to associate with the device/session.

### 3. That’s it!
The SDK will automatically start collecting and sending device, network, and location data in the background.

### 4. (Optional) Send Data Manually

```js
Profiler.sendData({ customField: 'customValue' });
```

### 5. (Optional) Stop Auto-Sending

```js
Profiler.stopSendingData();
```

---

## 📦 API

### `init(appId, contactObject, intervalMs?)`
- `appId` (string): Your application ID (required)
- `contactObject` (object): Any user info (email, phone, name, etc.) (optional)
- `intervalMs` (number): How often to send data in ms (default: 60000)

### `sendData(extraPayload?)`
- Sends device/network/location data to backend, with any extra fields.

### `stopSendingData()`
- Stops the automatic data sending interval.

### `healthCheck()`
- Returns SDK status and cache info.

### `testNativeModule()`
- Tests native module integration (for debugging).

---

## 🔒 Permissions

- **Android:** Location, network, and device info permissions are handled natively. The SDK will prompt the user as needed.
- **iOS:** Location and device info permissions are handled natively.

> **Note:**  
> You must add the appropriate permissions to your `AndroidManifest.xml` and `Info.plist` for location and network access.

---

## 📝 Example

```js
import Profiler from 'react-native-profiler';

Profiler.init('MY_APP_ID', {
  email: 'me@domain.com',
  phone: '+1234567890',
  name: 'Alice Example',
  userId: 'user-42'
});

Profiler.sendData({ session: 'abc123' });

Profiler.healthCheck().then(status => {
  console.log('Profiler status:', status);
});
```

---

## 🧩 Customization

- Pass any user info in the `contactObject` to include it in every payload.
- Add extra fields to each send with `sendData({ ... })`.

---

## 🧪 Testing

- See `test-sdk.js` for a full integration example.

---

## 🐞 Troubleshooting

- Make sure you have linked native modules if using React Native < 0.60.
- Ensure all required permissions are set in your native project files.
- Use `Profiler.testNativeModule()` to verify native integration.

---

## 📄 License

MIT

---

## 🤝 Support

For issues, questions, or feature requests, please [open an issue](https://github.com/auvgffle/react-native-profiler/issues) or contact the maintainer.

---

**Happy profiling! 🚀** 