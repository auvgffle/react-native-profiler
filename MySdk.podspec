require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "MySdk"
  s.version      = package["version"]
  s.summary      = package["description"] || "A lightweight RN SDK to collect device, location, and network data."
  s.homepage     = package["homepage"] || "https://your-homepage.com"
  s.license      = package["license"] || { :type => "MIT", :file => "LICENSE" }
  s.author       = package["author"] || { "Your Name" => "your@email.com" }

  s.platform     = :ios, "12.0"
  s.source       = { :path => "." }

  # ✅ Include Swift and Objective-C files from ios folder
  s.source_files = "ios/**/*.{swift,m,h}"

  # ✅ Enables ARC and Swift support
  s.requires_arc = true
  s.swift_version = '5.0'

  # ✅ Required for React Native integration
  s.dependency "React-Core"

  # ✅ iOS frameworks
  s.frameworks = [
    "AdSupport",
    "AppTrackingTransparency",
    "CoreLocation",
    "Network",
    "SystemConfiguration",
    "CoreTelephony",
    "NetworkExtension",
    "UIKit"
  ]

  # ✅ FIXED: Remove bridging header, use module definition only
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_VERSION' => '5.0'
  }
end