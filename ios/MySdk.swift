import Foundation
import AdSupport
import AppTrackingTransparency
import CoreLocation
import Network
import SystemConfiguration
import SystemConfiguration.CaptiveNetwork
import CoreTelephony
import UIKit

// ✅ Import React Native modules directly in Swift
import React

@objc(MySdk)
class MySdk: NSObject, CLLocationManagerDelegate {
    
    private var locationManager: CLLocationManager?
    private var locationResolve: RCTPromiseResolveBlock?
    private var locationReject: RCTPromiseRejectBlock?
    
    override init() {
        super.init()
        print("[MySdk] MySdk initialized")
    }
    
    // MARK: - Get Advertising ID
    @objc
    func getAdId(_ resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
        print("[MySdk] getAdId called")
        DispatchQueue.main.async {
            if #available(iOS 14, *) {
                print("[MySdk] iOS 14+ - Requesting tracking authorization")
                ATTrackingManager.requestTrackingAuthorization { status in
                    print("[MySdk] Tracking status: \(status.rawValue)")
                    switch status {
                    case .authorized:
                        let idfa = ASIdentifierManager.shared().advertisingIdentifier.uuidString
                        print("[MySdk] IDFA: \(idfa)")
                        if idfa != "00000000-0000-0000-0000-000000000000" {
                            resolve(idfa)
                        } else {
                            print("[MySdk] IDFA is zeros")
                            reject("NO_ADID", "Ad ID is unavailable", nil)
                        }
                    case .denied, .restricted, .notDetermined:
                        print("[MySdk] Tracking permission denied/restricted/notDetermined")
                        reject("NO_PERMISSION", "Tracking permission denied", nil)
                    @unknown default:
                        print("[MySdk] Unknown tracking status")
                        reject("NO_PERMISSION", "Unknown tracking status", nil)
                    }
                }
            } else {
                print("[MySdk] iOS < 14 - Checking advertising tracking")
                let idfa = ASIdentifierManager.shared().advertisingIdentifier.uuidString
                print("[MySdk] IDFA: \(idfa), isEnabled: \(ASIdentifierManager.shared().isAdvertisingTrackingEnabled)")
                if ASIdentifierManager.shared().isAdvertisingTrackingEnabled {
                    resolve(idfa)
                } else {
                    reject("NO_PERMISSION", "Tracking permission denied", nil)
                }
            }
        }
    }
    
    // MARK: - Get Location
    @objc
    func getLocation(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        print("[MySdk] getLocation called")
        DispatchQueue.main.async {
            guard CLLocationManager.locationServicesEnabled() else {
                print("[MySdk] Location services disabled system-wide")
                reject("LOCATION_DISABLED", "Location services disabled", nil)
                return
            }
            
            print("[MySdk] Location services enabled")
            self.locationManager = CLLocationManager()
            self.locationManager?.delegate = self
            self.locationManager?.desiredAccuracy = kCLLocationAccuracyBest
            self.locationResolve = resolve
            self.locationReject = reject
            
            let status = CLLocationManager.authorizationStatus()
            print("[MySdk] Current location authorization status: \(status.rawValue)")
            
            switch status {
            case .notDetermined:
                print("[MySdk] Requesting location permission")
                self.locationManager?.requestWhenInUseAuthorization()
            case .authorizedWhenInUse, .authorizedAlways:
                print("[MySdk] Location already authorized, requesting location")
                self.locationManager?.requestLocation()
            case .denied, .restricted:
                print("[MySdk] Location permission denied/restricted")
                reject("PERMISSION_DENIED", "Location permission denied", nil)
                self.cleanupLocation()
                return
            @unknown default:
                print("[MySdk] Unknown location permission status")
                reject("PERMISSION_DENIED", "Unknown location permission status", nil)
                self.cleanupLocation()
                return
            }
            
            // Timeout after 10 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                if self.locationResolve != nil {
                    print("[MySdk] Location request timed out")
                    self.locationReject?("LOCATION_TIMEOUT", "Location request timed out", nil)
                    self.cleanupLocation()
                }
            }
        }
    }
    
    // MARK: CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        print("[MySdk] Location updated: \(locations.count) locations")
        guard let loc = locations.last else {
            print("[MySdk] No location in update")
            self.locationReject?("LOCATION_ERROR", "Location unavailable", nil)
            self.cleanupLocation()
            return
        }
        
        print("[MySdk] Location: \(loc.coordinate.latitude), \(loc.coordinate.longitude)")
        let locationData: [String: Any] = [
            "lat": loc.coordinate.latitude,
            "lng": loc.coordinate.longitude,
            "accuracy": loc.horizontalAccuracy,
            "altitude": loc.altitude,
            "speed": loc.speed >= 0 ? loc.speed : 0,
            "bearing": loc.course >= 0 ? loc.course : 0,
            "provider": "iOS Core Location",
            "timestamp": loc.timestamp.timeIntervalSince1970 * 1000
        ]
        
        self.locationResolve?(locationData)
        self.cleanupLocation()
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[MySdk] Location error: \(error.localizedDescription)")
        self.locationReject?("LOCATION_ERROR", error.localizedDescription, error)
        self.cleanupLocation()
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        print("[MySdk] Location authorization changed to: \(status.rawValue)")
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            print("[MySdk] Location authorized, requesting location")
            self.locationManager?.requestLocation()
        case .denied, .restricted:
            print("[MySdk] Location permission denied in delegate")
            self.locationReject?("PERMISSION_DENIED", "Location permission denied", nil)
            self.cleanupLocation()
        case .notDetermined:
            print("[MySdk] Location permission still not determined")
            // Still waiting for user decision
            break
        @unknown default:
            print("[MySdk] Unknown location permission status in delegate")
            self.locationReject?("PERMISSION_DENIED", "Unknown location permission status", nil)
            self.cleanupLocation()
        }
    }
    
    private func cleanupLocation() {
        print("[MySdk] Cleaning up location manager")
        self.locationManager?.stopUpdatingLocation()
        self.locationManager = nil
        self.locationResolve = nil
        self.locationReject = nil
    }
    
    // MARK: - Get Network Info
    @objc
    func getNetworkInfo(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        print("[MySdk] getNetworkInfo called")
        DispatchQueue.global(qos: .userInitiated).async {
            var networkInfo: [String: Any] = [:]
            
            // Connectivity
            let isConnected = self.isConnectedToNetwork()
            networkInfo["isConnected"] = isConnected
            print("[MySdk] Network connected: \(isConnected)")
            
            // Device ID
            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
            networkInfo["deviceId"] = deviceId
            print("[MySdk] Device ID: \(deviceId)")
            
            // IP Address
            if let ip = self.getIPAddress() {
                networkInfo["ipAddress"] = ip
                print("[MySdk] IP Address: \(ip)")
            } else {
                print("[MySdk] No IP Address found")
            }
            
            // WiFi Info
            if let ssid = self.getWiFiSSID() {
                networkInfo["ssid"] = ssid
                print("[MySdk] WiFi SSID: \(ssid)")
            } else {
                print("[MySdk] No WiFi SSID found")
            }
            
            if let bssid = self.getWiFiBSSID() {
                networkInfo["bssid"] = bssid
                print("[MySdk] WiFi BSSID: \(bssid)")
            }
            
            // Cellular Info
            let telephony = CTTelephonyNetworkInfo()
            
            // Handle both iOS 12+ and older versions
            if #available(iOS 12.0, *) {
                if let carriers = telephony.serviceSubscriberCellularProviders {
                    print("[MySdk] Found \(carriers.count) cellular providers")
                    for (key, carrier) in carriers {
                        print("[MySdk] Carrier \(key): \(carrier.carrierName ?? "unknown")")
                        networkInfo["carrierName_\(key)"] = carrier.carrierName ?? "unknown"
                        networkInfo["mobileCountryCode_\(key)"] = carrier.mobileCountryCode ?? "unknown"
                        networkInfo["mobileNetworkCode_\(key)"] = carrier.mobileNetworkCode ?? "unknown"
                        networkInfo["isoCountryCode_\(key)"] = carrier.isoCountryCode ?? "unknown"
                        networkInfo["allowsVOIP_\(key)"] = carrier.allowsVOIP
                    }
                } else {
                    print("[MySdk] No cellular providers found (iOS 12+)")
                }
            } else {
                if let carrier = telephony.subscriberCellularProvider {
                    print("[MySdk] Carrier: \(carrier.carrierName ?? "unknown")")
                    networkInfo["carrierName"] = carrier.carrierName ?? "unknown"
                    networkInfo["mobileCountryCode"] = carrier.mobileCountryCode ?? "unknown"
                    networkInfo["mobileNetworkCode"] = carrier.mobileNetworkCode ?? "unknown"
                    networkInfo["isoCountryCode"] = carrier.isoCountryCode ?? "unknown"
                    networkInfo["allowsVOIP"] = carrier.allowsVOIP
                } else {
                    print("[MySdk] No cellular provider found (iOS < 12)")
                }
            }
            
            // Network Type
            let networkType = self.getNetworkType()
            networkInfo["networkType"] = networkType
            print("[MySdk] Network type: \(networkType)")
            
            // Timestamp
            networkInfo["timestamp"] = Date().timeIntervalSince1970 * 1000
            
            print("[MySdk] Network info collected: \(networkInfo)")
            
            DispatchQueue.main.async {
                resolve(networkInfo)
            }
        }
    }
    
    // MARK: - Helpers
    private func isConnectedToNetwork() -> Bool {
        var zero = sockaddr_in()
        zero.sin_len = UInt8(MemoryLayout.size(ofValue: zero))
        zero.sin_family = sa_family_t(AF_INET)
        
        let reachability = withUnsafePointer(to: &zero) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                SCNetworkReachabilityCreateWithAddress(nil, $0)
            }
        }
        
        guard let reachabilityRef = reachability else {
            print("[MySdk] Failed to create reachability reference")
            return false
        }
        
        var flags = SCNetworkReachabilityFlags()
        if !SCNetworkReachabilityGetFlags(reachabilityRef, &flags) {
            print("[MySdk] Failed to get reachability flags")
            return false
        }
        
        let isReachable = flags.contains(.reachable)
        let needsConnection = flags.contains(.connectionRequired)
        print("[MySdk] Reachability - isReachable: \(isReachable), needsConnection: \(needsConnection)")
        
        return isReachable && !needsConnection
    }
    
    private func getIPAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        
        guard getifaddrs(&ifaddr) == 0 else {
            print("[MySdk] Failed to get network interfaces")
            return nil
        }
        
        var ptr = ifaddr
        while ptr != nil {
            let interface = ptr!.pointee
            let addrFamily = interface.ifa_addr.pointee.sa_family
            
            if addrFamily == UInt8(AF_INET) || addrFamily == UInt8(AF_INET6) {
                if let name = String(validatingUTF8: interface.ifa_name) {
                    print("[MySdk] Checking interface: \(name)")
                    if name == "en0" { // WiFi interface
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                                    &hostname, socklen_t(hostname.count),
                                    nil, socklen_t(0), NI_NUMERICHOST)
                        address = String(cString: hostname)
                        print("[MySdk] Found IP address: \(address ?? "nil")")
                        break
                    }
                }
            }
            ptr = interface.ifa_next
        }
        freeifaddrs(ifaddr)
        
        return address
    }
    
    private func getWiFiSSID() -> String? {
        print("[MySdk] Attempting to get WiFi SSID")
        guard let interfaces = CNCopySupportedInterfaces() as NSArray? else {
            print("[MySdk] No supported interfaces found")
            return nil
        }
        
        print("[MySdk] Found \(interfaces.count) supported interfaces")
        for interface in interfaces {
            print("[MySdk] Checking interface: \(interface)")
            if let dict = CNCopyCurrentNetworkInfo(interface as! CFString) as NSDictionary? {
                print("[MySdk] Network info dict: \(dict)")
                if let ssid = dict[kCNNetworkInfoKeySSID as String] as? String {
                    print("[MySdk] Found SSID: \(ssid)")
                    return ssid
                }
            }
        }
        print("[MySdk] No SSID found")
        return nil
    }
    
    private func getWiFiBSSID() -> String? {
        guard let interfaces = CNCopySupportedInterfaces() as NSArray? else {
            return nil
        }
        
        for interface in interfaces {
            if let dict = CNCopyCurrentNetworkInfo(interface as! CFString) as NSDictionary? {
                return dict[kCNNetworkInfoKeyBSSID as String] as? String
            }
        }
        return nil
    }
    
    private func getNetworkType() -> String {
        if #available(iOS 12.0, *) {
            let monitor = NWPathMonitor()
            let semaphore = DispatchSemaphore(value: 0)
            var type = "unknown"
            
            monitor.pathUpdateHandler = { path in
                if path.usesInterfaceType(.wifi) {
                    type = "wifi"
                } else if path.usesInterfaceType(.cellular) {
                    type = "cellular"
                } else if path.usesInterfaceType(.wiredEthernet) {
                    type = "ethernet"
                } else if path.usesInterfaceType(.loopback) {
                    type = "loopback"
                } else {
                    type = "other"
                }
                print("[MySdk] Network path type: \(type)")
                semaphore.signal()
            }
            
            let queue = DispatchQueue(label: "NetworkMonitor")
            monitor.start(queue: queue)
            
            let result = semaphore.wait(timeout: .now() + 2) // Increased timeout
            monitor.cancel()
            
            if result == .timedOut {
                print("[MySdk] Network type detection timed out")
                return "unknown"
            }
            
            return type
        } else {
            // Fallback for iOS < 12
            return "unknown"
        }
    }
    
    // MARK: - Test Native Module
    @objc
    func testNativeModule(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        print("[MySdk] testNativeModule called")
        DispatchQueue.main.async {
            let testResult: [String: Any] = [
                "platform": "iOS",
                "moduleName": "MySdk",
                "timestamp": Date().timeIntervalSince1970 * 1000,
                "status": "working",
                "version": "1.0.0"
            ]
            print("[MySdk] Test result: \(testResult)")
            resolve(testResult)
        }
    }
}

// MARK: - RCTBridgeModule
extension MySdk: RCTBridgeModule {
    @objc
    static func moduleName() -> String! {
        return "MySdk"
    }
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
}