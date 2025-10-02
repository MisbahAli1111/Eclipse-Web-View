# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep WebView related classes to prevent crashes
-keep class android.webkit.** { *; }
-keep class com.facebook.react.modules.webview.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }

# Keep React Native WebView
-keep class org.reactnative.** { *; }
-keep class com.swmansion.reanimated.** { *; }

# Keep biometrics related classes
-keep class com.rnbiometrics.** { *; }
-keep class androidx.biometric.** { *; }

# Keep keychain related classes  
-keep class com.oblador.keychain.** { *; }

# Keep file system related classes
-keep class com.rnfs.** { *; }

# Keep async storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Prevent obfuscation of JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }