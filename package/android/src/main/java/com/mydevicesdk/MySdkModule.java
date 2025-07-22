package com.mydevicesdk;

import android.util.Log;
import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoWcdma;
import android.telephony.SubscriptionManager;
import android.telephony.SubscriptionInfo;

import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Arguments;

import com.google.android.gms.ads.identifier.AdvertisingIdClient;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

import android.app.Activity;
import android.content.Intent;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.ActivityEventListener;

public class MySdkModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private final ReactApplicationContext reactContext;
    private Promise permissionPromise;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 12345;

    public MySdkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        reactContext.addActivityEventListener(this);
    }

    @Override
    public String getName() {
        return "MySdk";
    }

    @ReactMethod
    public void getAdId(Promise promise) {
        new Thread(() -> {
            try {
                AdvertisingIdClient.Info adInfo = AdvertisingIdClient.getAdvertisingIdInfo(reactContext);
                if (adInfo != null) {
                    promise.resolve(adInfo.getId());
                } else {
                    promise.reject("NO_ADID", "Ad ID is null");
                }
            } catch (Exception e) {
                promise.reject("AD_ID_ERROR", "Failed to get Ad ID", e);
            }
        }).start();
    }

    @ReactMethod
    public void getLocation(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("NO_ACTIVITY", "No activity");
            return;
        }
        if (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionPromise = promise;
            ActivityCompat.requestPermissions(currentActivity, new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_PERMISSION_REQUEST_CODE);
            return;
        }
        try {
            FusedLocationProviderClient fusedLocationClient = LocationServices
                    .getFusedLocationProviderClient(reactContext);

            fusedLocationClient.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    null).addOnSuccessListener(location -> {
                        if (location != null && promise != null) {
                            try {
                                WritableMap map = Arguments.createMap();
                                map.putDouble("lat", location.getLatitude());
                                map.putDouble("lng", location.getLongitude());
                                map.putDouble("accuracy", location.getAccuracy());
                                map.putDouble("altitude", location.getAltitude());
                                map.putDouble("speed", location.getSpeed());
                                map.putDouble("bearing", location.getBearing());
                                map.putString("provider", location.getProvider());
                                map.putDouble("timestamp", location.getTime());
                                promise.resolve(map);
                            } catch (Exception e) {
                                promise.reject("LOCATION_ERROR", "Error building location map", e);
                            }
                        } else {
                            if (promise != null) {
                                promise.reject("LOCATION_ERROR", "Unable to retrieve location");
                            }
                        }
                    }).addOnFailureListener(e -> {
                        if (promise != null) {
                            promise.reject("LOCATION_ERROR", e.getMessage(), e);
                        }
                    });

        } catch (Exception e) {
            if (promise != null) {
                promise.reject("LOCATION_ERROR", e.getMessage(), e);
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {}

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        // No-op
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    public void getNetworkInfo(Promise promise) {
        try {
            WritableMap map = Arguments.createMap();

            // Get all network managers
            TelephonyManager telephonyManager = (TelephonyManager) reactContext
                    .getSystemService(Context.TELEPHONY_SERVICE);
            ConnectivityManager connectivityManager = (ConnectivityManager) reactContext
                    .getSystemService(Context.CONNECTIVITY_SERVICE);
            WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);

            // SIM & Telephony Info
            if (telephonyManager != null) {
                try {
                    map.putString("simOperatorName", telephonyManager.getSimOperatorName());
                    map.putString("simCountryIso", telephonyManager.getSimCountryIso());
                    map.putString("networkOperator", telephonyManager.getNetworkOperator());
                    map.putString("networkOperatorName", telephonyManager.getNetworkOperatorName());
                    map.putBoolean("isNetworkRoaming", telephonyManager.isNetworkRoaming());
                    map.putInt("networkType", telephonyManager.getNetworkType());
                    map.putInt("phoneType", telephonyManager.getPhoneType());
                    map.putInt("dataActivity", telephonyManager.getDataActivity());
                    map.putInt("dataState", telephonyManager.getDataState());

                    // Additional SIM info (requires READ_PHONE_STATE permission)
                    if (ActivityCompat.checkSelfPermission(reactContext,
                            Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            map.putString("simSerialNumber", telephonyManager.getSimSerialNumber());
                        }
                        map.putInt("simState", telephonyManager.getSimState());

                        // Network class calculation
                        int networkType = telephonyManager.getNetworkType();
                        map.putString("networkClass", getNetworkClass(networkType));
                        map.putString("androidNetworkType", getNetworkTypeName(networkType));
                    }

                    // Multiple SIM support
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                        SubscriptionManager subscriptionManager = SubscriptionManager.from(reactContext);
                        if (ActivityCompat.checkSelfPermission(reactContext,
                                Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                            List<SubscriptionInfo> subscriptionInfos = subscriptionManager
                                    .getActiveSubscriptionInfoList();
                            if (subscriptionInfos != null && !subscriptionInfos.isEmpty()) {
                                WritableArray simCards = Arguments.createArray();
                                for (SubscriptionInfo info : subscriptionInfos) {
                                    WritableMap simCard = Arguments.createMap();
                                    simCard.putString("carrierName", info.getCarrierName().toString());
                                    simCard.putString("displayName", info.getDisplayName().toString());
                                    simCard.putInt("simSlotIndex", info.getSimSlotIndex());
                                    simCard.putString("countryIso", info.getCountryIso());
                                    simCards.pushMap(simCard);
                                }
                                map.putArray("simCards", simCards);
                            }
                        }
                    }

                } catch (Exception e) {
                    map.putString("telephonyError", e.getMessage());
                }
            }

            // WiFi Information
            if (wifiManager != null) {
                try {
                    WifiInfo wifiInfo = wifiManager.getConnectionInfo();
                    if (wifiInfo != null) {
                        map.putString("ssid", wifiInfo.getSSID());
                        map.putString("bssid", wifiInfo.getBSSID());
                        map.putInt("linkSpeed", wifiInfo.getLinkSpeed());
                        map.putInt("frequency", wifiInfo.getFrequency());
                        map.putInt("rssi", wifiInfo.getRssi());
                        map.putInt("networkId", wifiInfo.getNetworkId());

                        // Calculate signal strength percentage
                        int signalLevel = WifiManager.calculateSignalLevel(wifiInfo.getRssi(), 5);
                        map.putInt("signalLevel", signalLevel);
                        map.putInt("strength", (signalLevel * 100) / 4); // Convert to percentage

                        // Additional WiFi info for newer Android versions
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            map.putInt("rxLinkSpeed", wifiInfo.getRxLinkSpeedMbps());
                            map.putInt("txLinkSpeed", wifiInfo.getTxLinkSpeedMbps());
                        }
                    }

                    map.putBoolean("isWifiEnabled", wifiManager.isWifiEnabled());
                } catch (Exception e) {
                    map.putString("wifiError", e.getMessage());
                }
            }

            // Network Connectivity Information
            if (connectivityManager != null) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        Network activeNetwork = connectivityManager.getActiveNetwork();
                        if (activeNetwork != null) {
                            NetworkCapabilities capabilities = connectivityManager
                                    .getNetworkCapabilities(activeNetwork);
                            if (capabilities != null) {
                                map.putBoolean("hasWifi",
                                        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
                                map.putBoolean("hasCellular",
                                        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
                                map.putBoolean("hasEthernet",
                                        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
                                map.putBoolean("hasVpn", capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN));

                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    map.putBoolean("hasLowPan",
                                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_LOWPAN));
                                }

                                map.putBoolean("isMetered",
                                        !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED));
                                map.putBoolean("isValidated",
                                        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));

                                // Bandwidth info
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                    map.putInt("downstreamBandwidth", capabilities.getLinkDownstreamBandwidthKbps());
                                    map.putInt("upstreamBandwidth", capabilities.getLinkUpstreamBandwidthKbps());
                                }
                            }
                        }
                    } else {
                        // Fallback for older Android versions
                        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
                        if (activeNetworkInfo != null) {
                            map.putString("networkTypeName", activeNetworkInfo.getTypeName());
                            map.putString("networkSubtypeName", activeNetworkInfo.getSubtypeName());
                            map.putBoolean("isConnected", activeNetworkInfo.isConnected());
                            map.putBoolean("isAvailable", activeNetworkInfo.isAvailable());
                            map.putBoolean("isRoaming", activeNetworkInfo.isRoaming());
                        }
                    }
                } catch (Exception e) {
                    map.putString("connectivityError", e.getMessage());
                }
            }

            // MAC Address (various methods for different Android versions)
            String macAddress = getMacAddress();
            map.putString("macAddress", macAddress);

            // Additional device identifiers
            try {
                String androidId = Settings.Secure.getString(reactContext.getContentResolver(),
                        Settings.Secure.ANDROID_ID);
                map.putString("androidId", androidId);
            } catch (Exception e) {
                map.putString("androidIdError", e.getMessage());
            }

            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("NETWORK_ERROR", "Failed to get network info", e);
        }
    }

    private String getMacAddress() {
        try {
            // Method 1: Try WiFi Manager (works on older Android versions)
            WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                WifiInfo wifiInfo = wifiManager.getConnectionInfo();
                if (wifiInfo != null && wifiInfo.getMacAddress() != null
                        && !wifiInfo.getMacAddress().equals("02:00:00:00:00:00")) {
                    return wifiInfo.getMacAddress();
                }
            }
        } catch (Exception e) {
            // Continue to next method
        }

        try {
            // Method 2: Try NetworkInterface (works on some devices)
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface networkInterface : interfaces) {
                if (!networkInterface.getName().equalsIgnoreCase("wlan0"))
                    continue;

                byte[] mac = networkInterface.getHardwareAddress();
                if (mac == null)
                    continue;

                StringBuilder buf = new StringBuilder();
                for (byte aMac : mac) {
                    buf.append(String.format("%02X:", aMac));
                }
                if (buf.length() > 0) {
                    buf.deleteCharAt(buf.length() - 1);
                }
                return buf.toString();
            }
        } catch (Exception e) {
            // Continue to fallback
        }

        // Fallback for Android 10+
        return "unavailable_android_10+";
    }

    private String getNetworkClass(int networkType) {
        switch (networkType) {
            case TelephonyManager.NETWORK_TYPE_GPRS:
            case TelephonyManager.NETWORK_TYPE_EDGE:
            case TelephonyManager.NETWORK_TYPE_CDMA:
            case TelephonyManager.NETWORK_TYPE_1xRTT:
            case TelephonyManager.NETWORK_TYPE_IDEN:
                return "2G";
            case TelephonyManager.NETWORK_TYPE_UMTS:
            case TelephonyManager.NETWORK_TYPE_EVDO_0:
            case TelephonyManager.NETWORK_TYPE_EVDO_A:
            case TelephonyManager.NETWORK_TYPE_HSDPA:
            case TelephonyManager.NETWORK_TYPE_HSUPA:
            case TelephonyManager.NETWORK_TYPE_HSPA:
            case TelephonyManager.NETWORK_TYPE_EVDO_B:
            case TelephonyManager.NETWORK_TYPE_EHRPD:
            case TelephonyManager.NETWORK_TYPE_HSPAP:
                return "3G";
            case TelephonyManager.NETWORK_TYPE_LTE:
                return "4G";
            case TelephonyManager.NETWORK_TYPE_NR:
                return "5G";
            default:
                return "Unknown";
        }
    }

    private String getNetworkTypeName(int networkType) {
        switch (networkType) {
            case TelephonyManager.NETWORK_TYPE_GPRS:
                return "GPRS";
            case TelephonyManager.NETWORK_TYPE_EDGE:
                return "EDGE";
            case TelephonyManager.NETWORK_TYPE_UMTS:
                return "UMTS";
            case TelephonyManager.NETWORK_TYPE_CDMA:
                return "CDMA";
            case TelephonyManager.NETWORK_TYPE_EVDO_0:
                return "EVDO_0";
            case TelephonyManager.NETWORK_TYPE_EVDO_A:
                return "EVDO_A";
            case TelephonyManager.NETWORK_TYPE_1xRTT:
                return "1xRTT";
            case TelephonyManager.NETWORK_TYPE_HSDPA:
                return "HSDPA";
            case TelephonyManager.NETWORK_TYPE_HSUPA:
                return "HSUPA";
            case TelephonyManager.NETWORK_TYPE_HSPA:
                return "HSPA";
            case TelephonyManager.NETWORK_TYPE_IDEN:
                return "IDEN";
            case TelephonyManager.NETWORK_TYPE_EVDO_B:
                return "EVDO_B";
            case TelephonyManager.NETWORK_TYPE_LTE:
                return "LTE";
            case TelephonyManager.NETWORK_TYPE_EHRPD:
                return "EHRPD";
            case TelephonyManager.NETWORK_TYPE_HSPAP:
                return "HSPAP";
            case TelephonyManager.NETWORK_TYPE_GSM:
                return "GSM";
            case TelephonyManager.NETWORK_TYPE_TD_SCDMA:
                return "TD_SCDMA";
            case TelephonyManager.NETWORK_TYPE_IWLAN:
                return "IWLAN";
            case TelephonyManager.NETWORK_TYPE_NR:
                return "NR";
            default:
                return "UNKNOWN";
        }
    }
}