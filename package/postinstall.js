#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 MyDeviceSDK: Checking project for required setup...");

// Check if we're in a React Native project
function isReactNativeProject() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return (
        (packageJson.dependencies &&
          packageJson.dependencies["react-native"]) ||
        (packageJson.devDependencies &&
          packageJson.devDependencies["react-native"])
      );
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Check if a package exists in the host app
function hasPackage(pkg) {
  try {
    const pkgPath = path.join(process.cwd(), "node_modules", pkg);
    return fs.existsSync(pkgPath);
  } catch (e) {
    return false;
  }
}

// Run a shell command safely
function runCommand(cmd) {
  try {
    console.log(`🔧 Running: ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error(`❌ Command failed: ${cmd}\n${e.message}`);
  }
}

// Main execution
async function main() {
  if (!isReactNativeProject()) {
    console.log(
      "✅ Not a React Native project, skipping MyDeviceSDK postinstall."
    );
    return;
  }

  console.log("📱 React Native project detected.");

  // Check for required peer dependencies
  const requiredDeps = [
    "@react-native-community/netinfo",
    "react-native-device-info",
    "react-native-permissions",
  ];

  const missingDeps = requiredDeps.filter((pkg) => !hasPackage(pkg));

  if (missingDeps.length > 0) {
    console.log(
      `⚠️ Missing peer dependencies for MyDeviceSDK: ${missingDeps.join(", ")}`
    );

    if (process.env.MY_SDK_AUTO_SETUP === "true") {
      console.log("⚡ Auto-setup enabled, installing missing dependencies...");
      runCommand(`npm install ${missingDeps.join(" ")}`);
    } else {
      console.log(`
⚠️ Please install missing peer dependencies manually:
   npm install ${missingDeps.join(" ")}
`);
    }
  } else {
    console.log("✅ All required peer dependencies are installed.");
  }

  const autoRebuildEnabled = process.env.MY_SDK_AUTO_REBUILD === "true";

  if (autoRebuildEnabled) {
    console.log("🚀 Auto-rebuild enabled, rebuilding your apps...");

    // Clean and rebuild Android
    console.log("🔧 Cleaning Android...");
    runCommand("cd android && ./gradlew clean && cd ..");

    // Clean and rebuild iOS
    console.log("🔧 Cleaning iOS...");
    runCommand("cd ios && rm -rf build && cd ..");
    runCommand("cd ios && pod install && cd ..");

    console.log(
      "✅ Clean completed. Run 'npx react-native run-android' or 'npx react-native run-ios' to rebuild."
    );
  } else {
    console.log(`
✅ MyDeviceSDK postinstall completed.

⚠️ IMPORTANT: You need to manually rebuild your apps for native modules to link:

📱 For iOS:
   cd ios
   pod install
   cd ..
   npx react-native run-ios --reset-cache

🤖 For Android:
   cd android
   ./gradlew clean
   cd ..
   npx react-native run-android

📋 Also make sure to add required permissions:
   - iOS: Add location and tracking permissions to Info.plist
   - Android: Add location permissions to AndroidManifest.xml

💡 To enable automatic cleanup during SDK install next time:
   MY_SDK_AUTO_REBUILD=true npm install my-device-sdk
`);
  }
}

// Execute
main().catch((err) => console.error("❌ Postinstall failed:", err));
