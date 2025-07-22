import { Platform, NativeModules } from "react-native";
import DeviceInfo from "react-native-device-info";
import NetInfo from "@react-native-community/netinfo";

const { MySdk } = NativeModules;

const INTERNAL_BASE_URL = "https://sdk.intelvis.org";
let appId = null;
let contact = null;
let token = null;
let tokenExpiry = 0;
let deviceInfoCache = null;
let networkInfoCache = null;
let cacheExpiry = 0;
let sendDataInterval = null;
const sendDataIntervalMs = 60000 * 3; // 1 minute

// Logging utilities
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const Icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  rocket: '🚀',
  location: '📍',
  network: '🌐',
  shield: '🛡️',
  zap: '⚡',
  database: '💾',
  clock: '⏰',
  send: '📤',
  retry: '🔄',
};

function safeLog(level, context, icon, message, ...args) {
  try {
    const timestamp = new Date().toISOString();
    const color = level === 'error' ? Colors.red :
      level === 'warn' ? Colors.yellow :
        level === 'success' ? Colors.green : Colors.blue;
    const formattedMessage = `${color}${Colors.bright}${icon} [SDK][${context}] ${message}${Colors.reset}`;

    if (level === 'error') console.error(formattedMessage, ...args);
    else if (level === 'warn') console.warn(formattedMessage, ...args);
    else console.log(formattedMessage, ...args);
  } catch {
    console.log(`[SDK][${context}] ${message}`, ...args);
  }
}

const logSuccess = (context, message, ...args) => safeLog('success', context, Icons.success, message, ...args);
const logError = (context, message, ...args) => safeLog('error', context, Icons.error, message, ...args);
const logWarning = (context, message, ...args) => safeLog('warn', context, Icons.warning, message, ...args);
const logInfo = (context, message, ...args) => safeLog('info', context, Icons.info, message, ...args);
const logApiCall = (context, method, url, ...args) => safeLog('info', context, Icons.send, `${method} ${url}`, ...args);
const logApiResponse = (context, status, duration, ...args) => {
  const icon = status >= 200 && status < 300 ? Icons.success : Icons.error;
  const level = status >= 200 && status < 300 ? 'success' : 'error';
  safeLog(level, context, icon, `Response ${status} in ${duration}ms`, ...args);
};
const logNetwork = (context, message, ...args) => safeLog('info', context, Icons.network, message, ...args);
const logLocation = (context, message, ...args) => safeLog('info', context, Icons.location, message, ...args);
const logPerformance = (context, message, ...args) => safeLog('info', context, Icons.zap, message, ...args);
const logCaching = (context, message, ...args) => safeLog('info', context, Icons.database, message, ...args);
const logScheduler = (context, message, ...args) => safeLog('info', context, Icons.clock, message, ...args);

// Utility functions
function safeExecute(operation, fallback = null, context = 'SafeExecute') {
  try {
    return operation();
  } catch (error) {
    logError(context, `Operation failed: ${error.message}`, error);
    return fallback;
  }
}

async function safeExecuteAsync(operation, fallback = null, context = 'SafeExecuteAsync') {
  try {
    return await operation();
  } catch (error) {
    logError(context, `Async operation failed: ${error.message}`, error);
    return fallback;
  }
}

function safeStringifyJSON(obj, fallback = '{}', context = 'JSON') {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    logError(context, `JSON stringifying failed: ${error.message}`);
    return fallback;
  }
}

function safeGetProperty(obj, property, fallback = null, context = 'Property') {
  try {
    return obj && obj[property] !== undefined ? obj[property] : fallback;
  } catch (error) {
    logError(context, `Property access failed for ${property}: ${error.message}`);
    return fallback;
  }
}

async function safeCallMethodAsync(obj, method, args = [], fallback = null, context = 'AsyncMethod') {
  try {
    if (obj && typeof obj[method] === 'function') {
      return await obj[method](...args);
    }
    return fallback;
  } catch (error) {
    logError(context, `Async method call failed for ${method}: ${error.message}`);
    return fallback;
  }
}

// Enhanced fetch with proper timeout handling
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// Remove validateContact and all its usages


function normalizeLocation(raw) {
  return safeExecute(() => {
    if (!raw) return null;
    return {
      latitude: safeGetProperty(raw, 'latitude') ?? safeGetProperty(raw, 'lat'),
      longitude: safeGetProperty(raw, 'longitude') ?? safeGetProperty(raw, 'lng'),
      accuracy: safeGetProperty(raw, 'accuracy'),
      altitude: safeGetProperty(raw, 'altitude'),
      speed: safeGetProperty(raw, 'speed'),
      bearing: safeGetProperty(raw, 'bearing') ?? safeGetProperty(raw, 'heading'),
      provider: safeGetProperty(raw, 'provider'),
    };
  }, null, 'LocationNormalization');
}

function normalizeNetworkInfo(raw) {
  return safeExecute(() => {
    if (!raw) return null;
    const pickFirst = (obj, keys) => {
      for (const k of keys) {
        const value = safeGetProperty(obj, k);
        if (value !== undefined && value !== "--" && value !== "65535") return value;
      }
      return null;
    };
    return {
      allowsVOIP: pickFirst(raw, ["allowsVOIP", "allowsVOIP_0000000100000001", "allowsVOIP_0000000100000002"]),
      carrierName: pickFirst(raw, ["carrierName", "carrierName_0000000100000001", "carrierName_0000000100000002"]),
      isConnected: safeGetProperty(raw, 'isConnected'),
      isoCountryCode: pickFirst(raw, ["isoCountryCode", "isoCountryCode_0000000100000001", "isoCountryCode_0000000100000002"]),
      mobileCountryCode: pickFirst(raw, ["mobileCountryCode", "mobileCountryCode_0000000100000001", "mobileCountryCode_0000000100000002"]),
      mobileNetworkCode: pickFirst(raw, ["mobileNetworkCode", "mobileNetworkCode_0000000100000001", "mobileNetworkCode_0000000100000002"]),
      networkType: safeGetProperty(raw, 'networkType'),
    };
  }, null, 'NetworkNormalization');
}

async function getLocationFast() {
  return safeExecuteAsync(async () => {
    logLocation('GetLocation', 'Starting location retrieval...');
    if (MySdk?.getLocation) {
      const raw = await safeCallMethodAsync(MySdk, 'getLocation', [], null, Platform.OS === "ios" ? 'iOSLocation' : 'AndroidLocation');
      const normalized = normalizeLocation(raw);
      if (normalized) {
        logSuccess('GetLocation', 'Location retrieved successfully');
      } else {
        logWarning('GetLocation', 'Location data normalization failed');
      }
      return normalized;
    }
    logWarning('GetLocation', 'Location service not available');
    return null;
  }, null, 'LocationRetrieval');
}

async function getAdIdFast() {
  return safeExecuteAsync(async () => {
    logInfo('AdId', 'Starting AdId retrieval...');
    if (MySdk?.getAdId) {
      const adId = await safeCallMethodAsync(MySdk, 'getAdId', [], null, Platform.OS === "ios" ? 'iOSAdId' : 'AndroidAdId');
      if (adId) {
        logSuccess('AdId', 'AdId retrieved successfully');
      } else {
        logWarning('AdId', 'AdId retrieval returned null');
      }
      return adId;
    }
    logWarning('AdId', 'AdId service not available');
    return null;
  }, null, 'AdIdRetrieval');
}

async function getFastPublicIp(maxRetries = 3, retryDelay = 1000) {
  return safeExecuteAsync(async () => {
    logNetwork('PublicIP', 'Starting public IP retrieval...');
    const services = ["https://api.ipify.org?format=json", "https://httpbin.org/ip"];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const promises = services.map(async (service) => {
        const startTime = Date.now();
        logApiCall('PublicIP', 'GET', service, `Attempt ${attempt}`);

        try {
          const res = await fetchWithTimeout(service, {
            headers: { "Cache-Control": "no-cache" },
            method: 'GET'
          }, 10000); // 10 second timeout for public APIs

          const duration = Date.now() - startTime;
          logApiResponse('PublicIP', res.status, duration);

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const data = await res.json();
          return { publicIp: service.includes("ipify") ? data.ip : data.origin };
        } catch (error) {
          const duration = Date.now() - startTime;
          logApiResponse('PublicIP', 0, duration, error.message);
          throw error;
        }
      });

      try {
        const result = await Promise.any(promises);
        logSuccess('PublicIP', 'Public IP retrieved successfully:', result.publicIp);
        return result;
      } catch (error) {
        if (attempt < maxRetries) {
          logWarning('PublicIP', `Retrying public IP retrieval (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          logError('PublicIP', 'All public IP services failed:', error.message);
          return { publicIp: null };
        }
      }
    }
  }, { publicIp: null }, 'PublicIPRetrieval');
}

async function getOptimizedNetworkInfo() {
  return safeExecuteAsync(async () => {
    const now = Date.now();
    if (networkInfoCache && now < cacheExpiry) {
      logCaching('Network', 'Using cached network info');
      return networkInfoCache;
    }

    logNetwork('Network', 'Fetching fresh network info...');
    const [netInfo, nativeNetwork, publicIpInfo] = await Promise.allSettled([
      safeExecuteAsync(() => NetInfo.fetch(), null, 'NetInfoFetch'),
      safeExecuteAsync(() => MySdk?.getNetworkInfo?.(), null, 'NativeNetworkInfo'),
      getFastPublicIp(),
    ]);

    const publicIp = publicIpInfo.status === "fulfilled" && publicIpInfo.value ? publicIpInfo.value.publicIp : null;
    let result;

    if (Platform.OS === "android") {
      result = {
        android_network_info: {
          ...(nativeNetwork.status === "fulfilled" && nativeNetwork.value ? nativeNetwork.value : netInfo.value),
          publicIp,
        }
      };
    } else if (Platform.OS === "ios") {
      result = {
        ios_network_info: {
          ...(nativeNetwork.status === "fulfilled" && nativeNetwork.value ? nativeNetwork.value : netInfo.value),
          publicIp,
        }
      };
    } else {
      result = {
        network_info: {
          ...(nativeNetwork.status === "fulfilled" && nativeNetwork.value ? nativeNetwork.value : netInfo.value),
          publicIp,
        }
      };
    }

    networkInfoCache = result;
    cacheExpiry = now + 30000;
    logCaching('Network', 'Network info cached for 30 seconds');
    return result;
  }, {}, 'NetworkInfo');
}

async function collectDeviceDataFast() {
  return safeExecuteAsync(async () => {
    logInfo('Device', 'Starting device data collection...');
    const startTime = Date.now();
    const now = Date.now();

    if (deviceInfoCache && now < deviceInfoCache.expiry) {
      logCaching('Device', 'Using cached device info...');
      const [network, location] = await Promise.allSettled([getOptimizedNetworkInfo(), getLocationFast()]);
      const result = {
        ...deviceInfoCache.data,
        network: network.status === "fulfilled" ? network.value : null,
        location: location.status === "fulfilled" ? location.value : null,
        timestamp: new Date().toISOString(),
      };
      logPerformance('Device', `Device data collected from cache in ${Date.now() - startTime}ms`);
      return result;
    }

    logInfo('Device', 'Collecting fresh device data...');

    // Generate fallback device ID first
    let deviceId = `fallback_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const uniqueId = await DeviceInfo.getUniqueId();
      if (uniqueId) {
        deviceId = uniqueId;
        logSuccess('Device', 'Device ID obtained:', deviceId);
      } else {
        logWarning('Device', 'DeviceInfo.getUniqueId() returned null, using fallback:', deviceId);
      }
    } catch (error) {
      logWarning('Device', 'DeviceInfo.getUniqueId() failed, using fallback:', deviceId, error.message);
    }

    // Collect all device info independently - don't let failures cascade
    const [essentialInfo, hardwareInfo, network, location, adId] = await Promise.allSettled([
      Promise.allSettled([
        safeExecuteAsync(() => DeviceInfo.getBrand(), "Unknown", 'Brand'),
        safeExecuteAsync(() => DeviceInfo.getModel(), "Unknown", 'Model'),
        safeExecuteAsync(() => DeviceInfo.getSystemName(), Platform.OS, 'SystemName'),
        safeExecuteAsync(() => DeviceInfo.getSystemVersion(), "Unknown", 'SystemVersion'),
        safeExecuteAsync(() => DeviceInfo.getVersion(), "1.0.0", 'AppVersion'),
        safeExecuteAsync(() => DeviceInfo.getBuildNumber(), "1", 'BuildNumber'),
        safeExecuteAsync(() => DeviceInfo.getBundleId(), "unknown.package", 'BundleId'),
        safeExecuteAsync(() => DeviceInfo.getManufacturer(), "Unknown", 'Manufacturer'),
        safeExecuteAsync(() => DeviceInfo.getDeviceName(), "Unknown", 'DeviceName'),
      ]),
      Promise.allSettled([
        safeExecuteAsync(() => DeviceInfo.getTotalMemory(), null, 'TotalMemory'),
        safeExecuteAsync(() => DeviceInfo.getUsedMemory(), null, 'UsedMemory'),
        safeExecuteAsync(() => DeviceInfo.isTablet(), false, 'IsTablet'),
      ]),
      getOptimizedNetworkInfo(),
      getLocationFast(),
      getAdIdFast(),
    ]);

    // Process results with fallbacks
    const essentialResults = essentialInfo.status === "fulfilled" ? essentialInfo.value : [];
    const hardwareResults = hardwareInfo.status === "fulfilled" ? hardwareInfo.value : [];

    const deviceData = {
      deviceId,
      brand: essentialResults[0]?.status === "fulfilled" ? essentialResults[0].value : "Unknown",
      model: essentialResults[1]?.status === "fulfilled" ? essentialResults[1].value : "Unknown",
      systemName: essentialResults[2]?.status === "fulfilled" ? essentialResults[2].value : Platform.OS,
      systemVersion: essentialResults[3]?.status === "fulfilled" ? essentialResults[3].value : "Unknown",
      appVersion: essentialResults[4]?.status === "fulfilled" ? essentialResults[4].value : "1.0.0",
      buildNumber: essentialResults[5]?.status === "fulfilled" ? essentialResults[5].value : "1",
      packageName: essentialResults[6]?.status === "fulfilled" ? essentialResults[6].value : "unknown.package",
      manufacturer: essentialResults[7]?.status === "fulfilled" ? essentialResults[7].value : "Unknown",
      deviceName: essentialResults[8]?.status === "fulfilled" ? essentialResults[8].value : "Unknown",
      deviceType: "Handset",
      totalMemory: hardwareResults[0]?.status === "fulfilled" ? hardwareResults[0].value : null,
      usedMemory: hardwareResults[1]?.status === "fulfilled" ? hardwareResults[1].value : null,
      isTablet: hardwareResults[2]?.status === "fulfilled" ? hardwareResults[2].value : false,
      adId: adId.status === "fulfilled" ? adId.value : null,
      androidId: Platform.OS === "android" ? deviceId : null,
      network: network.status === "fulfilled" ? network.value : null,
      location: location.status === "fulfilled" ? location.value : null,
      timestamp: new Date().toISOString(),
      timezone: safeExecute(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC", 'Timezone'),
      platform: Platform.OS,
    };

    // Cache static data only (exclude dynamic data)
    deviceInfoCache = {
      data: {
        ...deviceData,
        network: null,
        location: null,
        timestamp: null
      },
      expiry: now + 300000, // 5 minutes
    };

    logPerformance('Device', `Device data collected in ${Date.now() - startTime}ms`);
    logCaching('Device', 'Device info cached for 5 minutes');
    return deviceData;
  }, {
    deviceId: `error_${Platform.OS}_${Date.now()}`,
    error: "Failed to collect device data",
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
  }, 'DeviceDataCollection');
}

async function getToken(deviceId, maxRetries = 3, retryDelay = 3000) {
  return safeExecuteAsync(async () => {
    logInfo('Token', 'Starting token retrieval...');
    const now = Date.now() / 1000;
    if (token && now < tokenExpiry - 30) {
      logInfo('Token', 'Using cached token');
      return token;
    }

    logInfo('Token', 'Fetching fresh token...');
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        const url = `${INTERNAL_BASE_URL}/get-token`;
        const payload = { appId, deviceId };
        logApiCall('Token', 'POST', url, payload);

        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: safeStringifyJSON(payload),
        }); // No timeout for internal API calls

        const duration = Date.now() - startTime;
        logApiResponse('Token', res.status, duration);

        if (!res.ok) {
          if (res.status === 500 && attempt < maxRetries) {
            logWarning('Token', `Server error (500) on attempt ${attempt}/${maxRetries}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error(`Failed to get token: ${res.status}`);
        }

        const data = await res.json();
        token = data.token;
        tokenExpiry = data.expiry || (now + 3600);
        logSuccess('Token', 'Token retrieved successfully, expires at:', new Date(tokenExpiry * 1000).toISOString());
        return token;
      } catch (e) {
        const duration = Date.now() - startTime;
        logError('Token', `Token retrieval failed on attempt ${attempt}: ${e.message} (${duration}ms)`);
        if (attempt === maxRetries) {
          logError('Token', 'All token retrieval attempts failed');
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }, null, 'TokenRetrieval');
}

function init(id, contactValue = null) {
  return safeExecute(() => {
    logInfo('Init', 'Starting SDK initialization...');
    if (!id) {
      logError('Init', 'App ID is required for initialization');
      return false;
    }

    appId = id;
    // Accept any object for contact, no validation
    contact = (contactValue && typeof contactValue === 'object') ? contactValue : null;
    logInfo('Init', `Initialized with App ID: ${appId}, Contact:`, contact);

    if (sendDataInterval) {
      clearInterval(sendDataInterval);
      sendDataInterval = null;
      logInfo('Init', 'Cleared previous sendData interval');
    }

    // Initial data send - don't let failure prevent initialization
    safeExecuteAsync(async () => {
      const result = await sendData();
      if (result.success) {
        logSuccess('Init', 'Initial data send completed successfully');
      } else {
        logWarning('Init', 'Initial data send failed but continuing initialization');
      }
    }, null, 'InitialDataSend');

    sendDataInterval = setInterval(async () => {
      const result = await safeExecuteAsync(async () => {
        return await sendData();
      }, { success: false, error: 'Scheduled send failed' }, 'ScheduledDataSend');

      if (result.success) {
        logScheduler('Schedule', 'Scheduled sendData executed successfully');
      } else {
        logError('Schedule', 'Scheduled sendData failed:', result.error?.message || 'Unknown error');
      }
    }, sendDataIntervalMs);

    logScheduler('Init', `Scheduled sendData to run every ${sendDataIntervalMs}ms`);
    logSuccess('Init', 'SDK initialization completed successfully');
    return true;
  }, false, 'SDKInitialization');
}

async function sendData(extraPayload = {}, maxRetries = 3, retryDelay = 1000) {
  return safeExecuteAsync(async () => {
    logInfo('SendData', 'Starting data transmission...');
    const startTime = Date.now();

    if (!appId) {
      throw new Error("SDK not initialized. Call init(appId) first");
    }

    // Collect device data - this should never fail completely
    logInfo('SendData', 'Collecting device data...');
    const data = await collectDeviceDataFast();
    logPerformance('SendData', `Device data collected in ${Date.now() - startTime}ms`);

    // Try to get token - if this fails, we can't send data
    const authToken = await getToken(data.deviceId);
    if (!authToken) {
      logWarning('SendData', 'Failed to get authentication token, data will not be sent');
      return {
        success: false,
        error: { message: "Failed to get authentication token", timestamp: new Date().toISOString() },
        data,
        retryable: true,
        attempts: 0,
      };
    }

    // Send data with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${INTERNAL_BASE_URL}/events`;
        const payload = {
          apiKey: authToken,
          deviceId: data.deviceId,
          platform: Platform.OS,
          timestamp: data.timestamp,
          data: {
            brand: data.brand,
            model: data.model,
            systemName: data.systemName,
            systemVersion: data.systemVersion,
            appVersion: data.appVersion,
            buildNumber: data.buildNumber,
            packageName: data.packageName,
            manufacturer: data.manufacturer,
            deviceName: data.deviceName,
            deviceType: data.deviceType,
            totalMemory: data.totalMemory,
            usedMemory: data.usedMemory,
            isTablet: data.isTablet,
            adId: data.adId,
            androidId: data.androidId,
            network: data.network,
            location: data.location,
            timezone: data.timezone,
            hasNotch: data.hasNotch,
            hasDynamicIsland: data.hasDynamicIsland,
            collectionErrors: data.collectionErrors || [],
            ...(contact ? { ...contact } : {}), // Spread contact object if present
            ...extraPayload,
          },
        };

        logInfo('SendData', 'Payload to be sent:', payload);

        logApiCall('SendData', 'POST', url, `Device: ${data.deviceId}, Platform: ${Platform.OS}, Attempt: ${attempt}`);

        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Connection: "keep-alive",
          },
          body: safeStringifyJSON(payload),
        }); // No timeout for internal API calls

        const totalTime = Date.now() - startTime;
        logApiResponse('SendData', res.status, totalTime);

        if (!res.ok) {
          if (res.status === 500 && attempt < maxRetries) {
            logWarning('SendData', `Server error (500) on attempt ${attempt}/${maxRetries}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw new Error(`Failed to send data: ${res.status}`);
        }

        const responseData = await safeExecuteAsync(() => res.json(), {}, 'ResponseParsing');
        logSuccess('SendData', `Data sent successfully in ${totalTime}ms`);
        logInfo('SendData', 'Response received:', responseData);

        return {
          success: true,
          data,
          response: responseData,
          duration: totalTime,
          attempts: attempt,
        };
      } catch (error) {
        const totalTime = Date.now() - startTime;
        logError('SendData', `Data transmission failed on attempt ${attempt}: ${error.message} (${totalTime}ms)`);

        if (attempt === maxRetries) {
          return {
            success: false,
            error: {
              message: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            },
            data,
            retryable: !error.message.includes("not initialized"),
            attempts: attempt,
          };
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }, error => ({
    success: false,
    error: {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      timestamp: new Date().toISOString()
    },
    data: {
      deviceId: "unknown",
      error: "Failed to collect data",
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    },
    retryable: !error?.message?.includes("not initialized"),
    attempts: 1,
  }), 'DataTransmission');
}

function stopSendingData() {
  return safeExecute(() => {
    logInfo('Stop', 'Stopping data transmission...');
    if (sendDataInterval) {
      clearInterval(sendDataInterval);
      sendDataInterval = null;
      logSuccess('Stop', 'Scheduled data sending stopped successfully');
    } else {
      logInfo('Stop', 'No active data sending to stop');
    }
    return true;
  }, false, 'StopDataSending');
}

async function testNativeModule() {
  return safeExecuteAsync(async () => {
    logInfo('Test', '=== Starting Native Module Test ===');
    const tests = [
      { name: 'AdId', icon: Icons.shield, test: () => MySdk?.getAdId?.() ?? Promise.reject(new Error('getAdId not available')) },
      { name: 'Location', icon: Icons.location, test: () => MySdk?.getLocation?.() ?? Promise.reject(new Error('getLocation not available')) },
      { name: 'NetworkInfo', icon: Icons.network, test: () => MySdk?.getNetworkInfo?.() ?? Promise.reject(new Error('getNetworkInfo not available')) },
    ];

    const results = {};
    for (const test of tests) {
      logInfo('Test', `${test.icon} Testing ${test.name}...`);
      try {
        const result = await test.test();
        results[test.name] = { success: true, result };
        logSuccess('Test', `${test.icon} ${test.name} test passed:`, result);
      } catch (error) {
        results[test.name] = { success: false, error: error.message };
        logError('Test', `${test.icon} ${test.name} test failed:`, error.message);
      }
    }
    logInfo('Test', '=== Native Module Test Complete ===');
    return results;
  }, {}, 'NativeModuleTest');
}

async function healthCheck() {
  return safeExecuteAsync(async () => {
    logInfo('Health', 'Starting SDK health check...');
    const health = {
      timestamp: new Date().toISOString(),
      sdk: {
        initialized: !!appId,
        appId,
        contact: contact || null,
        intervalMs: sendDataIntervalMs,
        hasActiveInterval: !!sendDataInterval,
      },
      cache: {
        deviceInfoCached: !!deviceInfoCache,
        networkInfoCached: !!networkInfoCache,
        tokenCached: !!token,
        tokenExpiry: tokenExpiry ? new Date(tokenExpiry * 1000).toISOString() : null,
      },
      modules: { MySdk: !!MySdk, DeviceInfo: !!DeviceInfo, NetInfo: !!NetInfo },
      platform: Platform.OS,
    };
    logInfo('Health', 'Health check completed:', health);
    return health;
  }, { error: "Health check failed", timestamp: new Date().toISOString() }, 'HealthCheck');
}

export default {
  init,
  sendData,
  stopSendingData,
  testNativeModule,
  healthCheck,
  safeExecute,
  safeExecuteAsync,
  logSuccess,
  logError,
  logWarning,
  logInfo,
};