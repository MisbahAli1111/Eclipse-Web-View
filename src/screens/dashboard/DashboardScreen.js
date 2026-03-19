import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler, ActivityIndicator, Alert, Platform, PermissionsAndroid, Linking, Share, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SessionService } from '../../services/session';
import { getDashboardUrl } from '../../services/api/config';
import Loader from '../../components/Loader';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';

const escapeForJs = (s) => (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');

const buildLocalStorageInjectScript = (token, loginResponseRaw) => {
  let script = '';
  if (token) {
    const t = escapeForJs(token);
    script += `localStorage.setItem('authToken','${t}');sessionStorage.setItem('authToken','${t}');`;
    script += `localStorage.setItem('accessToken','${t}');sessionStorage.setItem('accessToken','${t}');`;
  }
  if (loginResponseRaw) {
    try {
      const data = JSON.parse(loginResponseRaw);
      const d = data?.data || data;
      if (d) {
        if (d.access_info != null) script += `localStorage.setItem('accessInfo','${escapeForJs(JSON.stringify(d.access_info))}');`;
        if (d.token != null) script += `localStorage.setItem('accessToken','${escapeForJs(d.token)}');`;
        if (d.remember_token != null) script += `localStorage.setItem('refreshToken','${escapeForJs(d.remember_token)}');`;
        if (d.token_type != null) script += `localStorage.setItem('tokenType','${escapeForJs(d.token_type)}');`;
        if (d.user != null) script += `localStorage.setItem('user','${escapeForJs(JSON.stringify(d.user))}');`;
        if (d.permissions != null) script += `localStorage.setItem('permissions','${escapeForJs(JSON.stringify(d.permissions))}');`;
        if (d.date_format != null) script += `localStorage.setItem('date_format','${escapeForJs(d.date_format)}');`;
        if (d.time_format != null) script += `localStorage.setItem('time_format','${escapeForJs(d.time_format)}');`;
        if (d.timezone_id != null) script += `localStorage.setItem('selected_timezone','${escapeForJs(d.timezone_id)}');`;
        script += `localStorage.setItem('dashboard_filter_presets','[]');`;
        script += `window.__LOGIN_RESPONSE__=JSON.parse('${escapeForJs(loginResponseRaw)}');`;
      }
    } catch (e) {}
  }
  return script;
};

const DashboardScreen = ({ navigation }) => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [loginResponseRaw, setLoginResponseRaw] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef(null);

  const requestPermissions = async (includeDownload = false) => {
    try {
      let permissions = [];
      
      if (Platform.OS === 'android') {
        if (includeDownload) {
          // For downloads, we only need storage permissions
          permissions = [
            PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
          ];
          
          // For Android 13+ (API 33+), we might not need any permissions for downloads to Downloads folder
          if (Platform.Version >= 33) {
            permissions = []; // Downloads folder is accessible without permissions on Android 13+
          }
        } else {
          // For uploads, we need camera and storage permissions
          permissions = [
            PERMISSIONS.ANDROID.CAMERA,
            PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
            PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
          ];

          // For Android 13+ (API 33+), use new media permissions for uploads
          if (Platform.Version >= 33) {
            permissions.push(
              PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
              PERMISSIONS.ANDROID.READ_MEDIA_VIDEO
            );
          }
        }
      } else if (Platform.OS === 'ios') {
        if (includeDownload) {
          // For iOS downloads, we don't need any permissions (files go to app Documents folder)
          permissions = [];
        } else {
          // For uploads, we need camera and photo library permissions
          permissions = [
            PERMISSIONS.IOS.CAMERA,
            PERMISSIONS.IOS.PHOTO_LIBRARY,
          ];
        }
      }

      const operationType = includeDownload ? 'download' : 'upload';
      console.log(`Requesting permissions for ${operationType}...`, permissions);
      
      // If no permissions needed, return success immediately
      if (permissions.length === 0) {
        console.log(`No permissions needed for ${operationType} on this platform`);
        return true;
      }
      
      const results = await Promise.all(
        permissions.map(async (permission) => {
          const status = await check(permission);
          if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
            console.log(`Requesting permission: ${permission}`);
            return await request(permission);
          }
          return status;
        })
      );

      console.log('Permission results:', results);
      
      // Check if we got the essential permissions
      const hasPermissions = permissions.length === 0 || results.some(result => result === RESULTS.GRANTED || result === RESULTS.LIMITED);
      
      if (!hasPermissions) {
        console.log('Permissions denied - preventing file picker');
        
        // Inject JavaScript to handle denied permissions gracefully
        const handleDeniedPermissionsScript = `
          (function() {
            try {
              // Find the active file input and prevent it from opening
              const activeElement = document.activeElement;
              if (activeElement && activeElement.type === 'file') {
                activeElement.blur();
                
                // Create a user-friendly message
                const message = document.createElement('div');
                message.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000; max-width: 300px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
                message.innerHTML = '<h3 style="margin: 0 0 10px 0; color: #495057;">Permissions Required</h3><p style="margin: 0; color: #6c757d;">Camera and photo access are needed to upload images. Please enable them in Settings and try again.</p><button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>';
                
                document.body.appendChild(message);
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                  if (message.parentElement) {
                    message.remove();
                  }
                }, 5000);
              }
              
              window.ReactNativeWebView.postMessage('PERMISSIONS_HANDLED');
            } catch (error) {
              console.error('Error handling denied permissions:', error);
              window.ReactNativeWebView.postMessage('PERMISSION_HANDLER_ERROR:' + error.message);
            }
          })();
        `;
        
        webViewRef.current?.injectJavaScript(handleDeniedPermissionsScript);
        
        return false; // Indicate permissions were denied
      }
      
      return true; // Indicate permissions were granted
      
    } catch (error) {
      console.warn('Permission request failed:', error);
      
      // Inject error handling script
      const errorHandlingScript = `
        (function() {
          try {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.type === 'file') {
              activeElement.blur();
            }
            window.ReactNativeWebView.postMessage('PERMISSION_REQUEST_FAILED');
          } catch (e) {
            console.error('Error in permission error handler:', e);
          }
        })();
      `;
      
      webViewRef.current?.injectJavaScript(errorHandlingScript);
      
      Alert.alert('Error', 'Failed to request permissions for file upload.');
      return false;
    }
  };

  // Download handler function
  const handleFileDownload = async (downloadUrl, fileName = null) => {
    try {
      console.log('🚀 Fast download requested for:', downloadUrl);
      
      // Show immediate feedback - non-blocking
      const startTime = Date.now();
      console.log('⏱️ Download started at:', new Date(startTime).toLocaleTimeString());

      // Request download permissions first
      const hasPermissions = await requestPermissions(true);
      if (!hasPermissions) {
        Alert.alert('Permission Required', 'Storage permission is needed to download files. Please enable it in Settings.');
        return;
      }

      // Extract filename from URL if not provided
      if (!fileName) {
        const urlParts = downloadUrl.split('/');
        fileName = urlParts[urlParts.length - 1] || 'download';
        
        // Remove query parameters from filename
        fileName = fileName.split('?')[0];
        
        // If no extension, add a default one
        if (!fileName.includes('.')) {
          fileName += '.pdf'; // Default to PDF for most document downloads
        }
      }

      // Ensure unique filename
      const timestamp = Date.now();
      const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
      const baseFileName = fileName.includes('.') ? fileName.replace(/\.[^/.]+$/, "") : fileName;
      const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

      // Download path - save to accessible location
      let downloadDest;
      if (Platform.OS === 'android') {
        downloadDest = `${RNFS.DownloadDirectoryPath}/${uniqueFileName}`;
      } else {
        // On iOS, save to temp location for sharing
        downloadDest = `${RNFS.CachesDirectoryPath}/${uniqueFileName}`;
      }

      console.log('📂 Downloading to:', downloadDest);

      // Use faster download with better settings
      const downloadResult = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: downloadDest,
        background: false,        // Foreground for faster processing
        discretionary: false,     // Don't defer download
        cacheable: false,         // Skip cache to avoid delays
        connectionTimeout: 15000, // 15 second connection timeout
        readTimeout: 30000,       // 30 second read timeout
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        progress: (res) => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          if (progress % 25 === 0) { // Log every 25%
            console.log(`📊 Download progress: ${progress.toFixed(0)}%`);
          }
        }
      }).promise;

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      console.log(`⚡ Download completed in ${duration} seconds`);

      if (downloadResult.statusCode === 200) {
        console.log('✅ Download successful:', downloadDest);
        
        // Show success message immediately
          shareFile(downloadDest, uniqueFileName)
   
      } else {
        throw new Error(`Download failed with status code: ${downloadResult.statusCode}`);
      }

    } catch (error) {
      console.error('❌ Download error:', error);
      
      Alert.alert('Download Failed', `Failed to download file: ${error.message}`);
    }
  };

  // Handle blob downloads (base64 data)
  // const handleBlobDownload = async (fileName, base64Data, mimeType) => {
  //   try {
  //     console.log('Blob download requested:', fileName);
  //     console.log('RNFS paths:', {
  //       DocumentDirectoryPath: RNFS.DocumentDirectoryPath,
  //       DownloadDirectoryPath: RNFS.DownloadDirectoryPath,
  //       CachesDirectoryPath: RNFS.CachesDirectoryPath
  //     });
      
  //     // Request download permissions first
  //     const hasPermissions = await requestPermissions(true);
  //     if (!hasPermissions) {
  //       Alert.alert('Permission Required', 'Storage permission is needed to download files. Please enable it in Settings.');
  //       return;
  //     }

  //     // Ensure unique filename
  //     const timestamp = Date.now();
  //     const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
  //     const baseFileName = fileName.includes('.') ? fileName.replace(/\.[^/.]+$/, "") : fileName.replace(/\.[^/.]+$/, "");
  //     const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

  //     // Download path - save to accessible location
  //     let downloadDest;
  //     if (Platform.OS === 'android') {
  //       downloadDest = `${RNFS.DownloadDirectoryPath}/${uniqueFileName}`;
  //     } else {
  //       // On iOS, save to temp location for sharing
  //       downloadDest = `${RNFS.CachesDirectoryPath}/${uniqueFileName}`;
  //     }

  //     console.log('Saving blob to:', downloadDest);
  //     console.log('Base64 data length:', base64Data.length);
  //     console.log('MIME type:', mimeType);

  //     // Check if directory exists and create if needed
  //     const dirPath = Platform.OS === 'android' 
  //       ? RNFS.DownloadDirectoryPath 
  //       : RNFS.CachesDirectoryPath;
      
  //     const dirExists = await RNFS.exists(dirPath);
  //     console.log('Directory exists:', dirExists, dirPath);
      
  //     if (!dirExists) {
  //       await RNFS.mkdir(dirPath);
  //       console.log('Created directory:', dirPath);
  //     }

  //     // Test write a simple text file first
  //     const testPath = `${dirPath}/test.txt`;
  //     try {
  //       await RNFS.writeFile(testPath, 'Hello World', 'utf8');
  //       const testExists = await RNFS.exists(testPath);
  //       console.log('Test file write successful:', testExists);
  //       if (testExists) {
  //         await RNFS.unlink(testPath); // Clean up test file
  //       }
  //     } catch (testError) {
  //       console.error('Test file write failed:', testError);
  //     }

  //     // Write base64 data to file
  //     console.log('Writing base64 data...');
  //     await RNFS.writeFile(downloadDest, base64Data, 'base64');
  //     console.log('Base64 write completed');
      
  //     // Verify file was written
  //     const fileExists = await RNFS.exists(downloadDest);
  //     const fileStats = fileExists ? await RNFS.stat(downloadDest) : null;
      
  //    shareFile(downloadDest, uniqueFileName)
   

  //   } catch (error) {
  //     console.error('Blob download error:', error);
  //     Alert.alert('Download Failed', `Failed to download file: ${error.message}`);
  //   }
  // };

  // Save file to user accessible location
  const shareFile = async (filePath, fileName) => {
    try {
      if (Platform.OS === 'ios') {
        // On iOS, use share to save to Files app
        await Share.share({
          url: `file://${filePath}`,
          title: fileName,
        });
      } else {
        // On Android, move file to Downloads folder
        const publicDownloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        await RNFS.copyFile(filePath, publicDownloadPath);
        Alert.alert('File Saved', `File saved to Downloads folder as ${fileName}`);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      Alert.alert('Save Error', 'Could not save the file to accessible location.');
    }
  };


  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const isValid = await SessionService.isSessionValid();

        if (!isValid) {
          await SessionService.clearSession();
          navigation.replace('Login');
          return;
        }

        const tenantId = await SessionService.getTenantId();

        if (!tenantId) {
          throw new Error('No tenant information found');
        }

        const url = getDashboardUrl(tenantId);
        const token = await AsyncStorage.getItem('@auth_token');
        const loginData = await AsyncStorage.getItem('@login_response');
        setAuthToken(token || '');
        setLoginResponseRaw(loginData || '');
        setWebViewUrl(url);
        setIsLoading(false);
        
        await SessionService.updateLastActive();
      } catch (error) {
        setHasError(true);
        Alert.alert('Error', 'Failed to load dashboard. Please login again.');
        await SessionService.clearSession();
        navigation.replace('Login');
      }
    };

    loadDashboard();

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        return true;
      }
    );

    return () => {
      backHandler.remove();
    };
  }, [navigation]);

  // 🔄 AppState listener to detect when app comes back from background
  // This prevents blank WebView after long inactivity (2+ hours)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        // Reload WebView to recover from:
        // 1. Killed WebView process (iOS WKWebView suspension)
        // 2. Destroyed WebView under memory pressure (Android)
        // 3. Expired session cookies (Laravel session timeout)
        webViewRef.current?.reload();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleNavigationChange = async (navState) => {
    setIsLoading(navState.loading);
    
    const url = navState.url || '';
    if (url.includes('/login')) {
      await SessionService.clearSession();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }]
      });
    }
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    
    // Don't show error for minor issues like permission-related JavaScript errors
    if (nativeEvent.description && nativeEvent.description.includes('client-side exception')) {
      console.log('Handling client-side exception gracefully');
      return;
    }
    
    // Check if this is a network error that can be recovered by reloading
    const isNetworkError = nativeEvent.description && (
      nativeEvent.description.includes('ERR_INTERNET_DISCONNECTED') ||
      nativeEvent.description.includes('ERR_NETWORK_CHANGED') ||
      nativeEvent.description.includes('ERR_CONNECTION_TIMED_OUT') ||
      nativeEvent.description.includes('ERR_CONNECTION_REFUSED') ||
      nativeEvent.description.includes('net::ERR_')
    );
    
    if (isNetworkError) {
      console.log('Network error detected - attempting reload:', nativeEvent.description);
      // Attempt to reload after a short delay
      setTimeout(() => {
        webViewRef.current?.reload();
      }, 1000);
      return;
    }
    
    setHasError(true);
    setIsLoading(false);
    Alert.alert('Error', 'Failed to load dashboard content');
  };

  const injectJavaScript = `
  (function() {
    try {
      // 0. Set up global error handlers to prevent crashes
      window.addEventListener('error', function(event) {
        console.warn('Global error caught:', event.error);
        window.ReactNativeWebView.postMessage('GLOBAL_ERROR:' + (event.error ? event.error.message : 'Unknown error'));
        event.preventDefault(); // Prevent the error from bubbling up
        return true;
      });

      window.addEventListener('unhandledrejection', function(event) {
        console.warn('Unhandled promise rejection caught:', event.reason);
        window.ReactNativeWebView.postMessage('UNHANDLED_REJECTION:' + (event.reason ? event.reason.toString() : 'Unknown rejection'));
        event.preventDefault(); // Prevent the error from bubbling up
        return true;
      });

      // 0. Intercept WebView API calls (fetch + XHR) and post to React Native for console logging
      (function() {
        var report = function(obj) {
          try {
            window.ReactNativeWebView.postMessage('WEBVIEW_API:' + JSON.stringify(obj));
          } catch (e) {}
        };
        var origFetch = window.fetch;
        if (origFetch) {
          window.fetch = function(url, opts) {
            var method = (opts && opts.method) || 'GET';
            var urlStr = typeof url === 'string' ? url : (url && url.url) || '';
            return origFetch.apply(this, arguments).then(function(res) {
              report({ type: 'fetch', method: method, url: urlStr, status: res.status });
              return res;
            }, function(err) {
              report({ type: 'fetch', method: method, url: urlStr, error: String(err && err.message) });
              throw err;
            });
          };
        }
        var XHR = window.XMLHttpRequest;
        if (XHR) {
          var origOpen = XHR.prototype.open;
          var origSend = XHR.prototype.send;
          XHR.prototype.open = function(method, url) {
            this._apiMethod = method;
            this._apiUrl = url;
            return origOpen.apply(this, arguments);
          };
          XHR.prototype.send = function() {
            var self = this;
            var method = self._apiMethod || 'GET';
            var url = self._apiUrl || '';
            self.addEventListener('load', function() {
              report({ type: 'xhr', method: method, url: url, status: self.status });
            });
            self.addEventListener('error', function() {
              report({ type: 'xhr', method: method, url: url, error: 'Network error' });
            });
            return origSend.apply(this, arguments);
          };
        }
      })();

      // 1. First check if token exists in localStorage
      const existingToken = window.localStorage.getItem('authToken');
      if (existingToken) {
        window.ReactNativeWebView.postMessage('TOKEN_FOUND_IN_LOCALSTORAGE');
      } else {
        // 2. If no token, signal React Native to inject it
        window.ReactNativeWebView.postMessage('NEED_TOKEN_INJECTION');
      }

      // 3. Set up retry mechanism for token
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = 1000;

      const checkForToken = () => {
        retryCount++;
        const token = window.localStorage.getItem('authToken');
        
        if (token) {
          window.ReactNativeWebView.postMessage('TOKEN_INJECTION_SUCCESS');
          return;
        }

        if (retryCount >= maxRetries) {
          window.ReactNativeWebView.postMessage('TOKEN_INJECTION_FAILED');
          return;
        }

        setTimeout(checkForToken, retryInterval);
      };

      // Initial check with slight delay
      if (!existingToken) {
        setTimeout(checkForToken, 500);
      }

      // 4. File upload handling - request permissions when file input is clicked
      document.addEventListener('click', function(event) {
        try {
          if (event.target.type === 'file' || (event.target.tagName === 'INPUT' && event.target.type === 'file')) {
            console.log('File input clicked - requesting permissions');
            window.ReactNativeWebView.postMessage('FILE_INPUT_CLICKED');
          }
        } catch (error) {
          console.warn('Error in click handler:', error);
          window.ReactNativeWebView.postMessage('CLICK_HANDLER_ERROR:' + error.message);
        }
      }, true);

      // 5. Monitor file input changes
      document.addEventListener('change', function(event) {
        try {
          if (event.target.type === 'file') {
            console.log('File input changed:', event.target.files);
            window.ReactNativeWebView.postMessage('FILE_INPUT_CHANGED:' + event.target.files.length);
          }
        } catch (error) {
          console.warn('Error in change handler:', error);
          window.ReactNativeWebView.postMessage('CHANGE_HANDLER_ERROR:' + error.message);
        }
      }, true);

      // 6. Monitor form submissions
      document.addEventListener('submit', function(event) {
        try {
          console.log('Form submitted:', event.target);
          window.ReactNativeWebView.postMessage('FORM_SUBMITTED');
        } catch (error) {
          console.warn('Error in submit handler:', error);
          window.ReactNativeWebView.postMessage('SUBMIT_HANDLER_ERROR:' + error.message);
        }
      }, true);

      // 7. Enhanced download link detection with immediate logging
      console.log('Setting up download click handler...');
      
      // Add multiple event listeners to catch everything
      document.addEventListener('click', function(event) {
        console.log('CLICK EVENT FIRED!', event.target);
        try {
          const target = event.target;
          const link = target.closest('a');
          const button = target.closest('button');
          const clickedElement = link || button || target;
          
          console.log('Click detected on:', clickedElement.tagName, clickedElement.className, clickedElement.textContent?.trim());
          
          // Check for download buttons (not just links)
          if (clickedElement) {
            const elementText = clickedElement.textContent?.toLowerCase() || '';
            const elementClass = clickedElement.className?.toLowerCase() || '';
            const elementId = clickedElement.id?.toLowerCase() || '';
            
            // Enhanced download detection
            const isDownloadButton = 
              elementText.includes('download') ||
              elementText.includes('export') ||
              elementClass.includes('download') ||
              elementClass.includes('export') ||
              elementId.includes('download') ||
              elementId.includes('export') ||
              clickedElement.hasAttribute('download');
            
            console.log('Download detection:', {
              text: elementText,
              class: elementClass,
              id: elementId,
              isDownloadButton: isDownloadButton
            });
            
            if (isDownloadButton) {
              console.log('Download button detected, preventing default navigation');
              event.preventDefault();
              event.stopPropagation();
              
              // Try to find the actual download URL
              let downloadUrl = null;
              
              if (link && link.href) {
                downloadUrl = link.href;
              } else if (clickedElement.dataset && clickedElement.dataset.url) {
                downloadUrl = clickedElement.dataset.url;
              } else if (clickedElement.getAttribute('data-download-url')) {
                downloadUrl = clickedElement.getAttribute('data-download-url');
              }
              
              console.log('Download URL found:', downloadUrl);
              
              if (downloadUrl && !downloadUrl.startsWith('blob:') && !downloadUrl.startsWith('data:')) {
                window.ReactNativeWebView.postMessage('DOWNLOAD_LINK_CLICKED:' + downloadUrl);
              } else {
                // If no URL found, let the WebView handle it but log the attempt
                window.ReactNativeWebView.postMessage('DOWNLOAD_BUTTON_CLICKED:' + JSON.stringify({
                  text: elementText,
                  class: elementClass,
                  id: elementId,
                  tagName: clickedElement.tagName
                }));
              }
              
              return false;
            }
          }
          
          // Original link-based detection for regular download links
          if (link && link.href) {
            const isDownload = link.hasAttribute('download') || 
                             link.href.includes('download') ||
                             /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|csv)(\?|$)/i.test(link.href);
            
            if (isDownload && !link.href.startsWith('blob:') && !link.href.startsWith('data:')) {
              event.preventDefault();
              console.log('Download link clicked:', link.href);
              window.ReactNativeWebView.postMessage('DOWNLOAD_LINK_CLICKED:' + link.href);
              return false;
            }
          }
        } catch (error) {
          console.warn('Error in download handler:', error);
          window.ReactNativeWebView.postMessage('DOWNLOAD_HANDLER_ERROR:' + error.message);
        }
      }, true);
      
      // Also add a capture phase listener that runs even earlier
      document.addEventListener('click', function(event) {
        console.log('CAPTURE PHASE CLICK:', event.target.tagName, event.target.textContent?.trim());
        window.ReactNativeWebView.postMessage('CAPTURE_CLICK:' + event.target.tagName + ':' + (event.target.textContent?.trim() || 'no-text'));
        
        // If this looks like a download, prevent it immediately
        const text = event.target.textContent?.toLowerCase() || '';
        const className = event.target.className?.toLowerCase() || '';
        
        if (text.includes('download') || text.includes('export') || className.includes('download') || className.includes('export')) {
          console.log('PREVENTING DOWNLOAD CLICK IN CAPTURE PHASE');
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          window.ReactNativeWebView.postMessage('DOWNLOAD_PREVENTED_IN_CAPTURE');
          return false;
        }
      }, true); // Capture phase

    } catch (error) {
      window.ReactNativeWebView.postMessage('SCRIPT_ERROR:' + error.message);
    }
    
    // Send confirmation that script loaded
    window.ReactNativeWebView.postMessage('DOWNLOAD_SCRIPT_LOADED');
    
    true;
  })();
  `;

  const handleWebViewMessage = async (event) => {
    const message = event.nativeEvent.data;

    if (message === 'NEED_TOKEN_INJECTION') {
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        const raw = await AsyncStorage.getItem('@login_response');
        const script = buildLocalStorageInjectScript(token, raw);
        const injectionScript = `try{${script}window.ReactNativeWebView.postMessage('TOKEN_INJECTED');}catch(e){window.ReactNativeWebView.postMessage('INJECTION_ERROR:'+e.message);}true;`;
        webViewRef.current?.injectJavaScript(injectionScript);
      } catch (error) {
      }
    } else if (message.startsWith('WEBVIEW_API:')) {
      try {
        const payload = JSON.parse(message.replace('WEBVIEW_API:', ''));
        const { type, method, url, status, error } = payload;
        if (status != null) {
          console.log(`[WebView API] ${type.toUpperCase()} ${method} ${url} -> ${status}`);
        } else if (error) {
          console.log(`[WebView API] ${type.toUpperCase()} ${method} ${url} -> ERROR: ${error}`);
        } else {
          console.log(`[WebView API] ${type.toUpperCase()} ${method} ${url}`);
        }
      } catch (e) {}
    } else if (message === 'FILE_INPUT_CLICKED') {
      console.log('User clicked file input - requesting permissions now');
      const hasPermissions = await requestPermissions();
      console.log('Permission request result:', hasPermissions);
    } else if (message.startsWith('FILE_INPUT_CHANGED:')) {
      const fileCount = message.split(':')[1];
      console.log(`File input changed - ${fileCount} files selected`);
    } else if (message === 'FORM_SUBMITTED') {
      console.log('Form was submitted in WebView');
    } else if (message === 'PERMISSIONS_HANDLED') {
      console.log('Permission denial handled gracefully in WebView');
    } else if (message === 'PERMISSION_REQUEST_FAILED') {
      console.log('Permission request failed - handled in WebView');
    } else if (message.startsWith('PERMISSION_HANDLER_ERROR:')) {
      console.error('Permission handler error:', message.split(':')[1]);
    } else if (message.startsWith('GLOBAL_ERROR:')) {
      console.warn('WebView global error (handled):', message.split(':')[1]);
    } else if (message.startsWith('UNHANDLED_REJECTION:')) {
      console.warn('WebView unhandled rejection (handled):', message.split(':')[1]);
    } else if (message.startsWith('CLICK_HANDLER_ERROR:')) {
      console.warn('Click handler error:', message.split(':')[1]);
    } else if (message.startsWith('CHANGE_HANDLER_ERROR:')) {
      console.warn('Change handler error:', message.split(':')[1]);
    } else if (message.startsWith('SUBMIT_HANDLER_ERROR:')) {
      console.warn('Submit handler error:', message.split(':')[1]);
    } else if (message.startsWith('SCRIPT_ERROR:')) {
      console.error('WebView script error:', message.split(':')[1]);
    } else if (message.startsWith('DOWNLOAD_LINK_CLICKED:')) {
      const downloadUrl = message.replace('DOWNLOAD_LINK_CLICKED:', '');
      console.log('Handling download link click:', downloadUrl);
      handleFileDownload(downloadUrl);
    } else if (message.startsWith('DOWNLOAD_BUTTON_CLICKED:')) {
      try {
        const buttonInfo = JSON.parse(message.replace('DOWNLOAD_BUTTON_CLICKED:', ''));
        console.log('Download button clicked but no URL found:', buttonInfo);
        
        // Show alert to user that download was attempted
        Alert.alert(
          'Download Attempted', 
          `Detected download button: "${buttonInfo.text}" but could not find download URL. The download may be processed by the website.`
        );
      } catch (error) {
        console.error('Error parsing download button info:', error);
      }
    } else if (message.startsWith('DOWNLOAD_HANDLER_ERROR:')) {
      console.warn('Download handler error:', message.split(':')[1]);
    } else if (message === 'DOWNLOAD_SCRIPT_LOADED') {
      console.log('✅ Download detection script loaded successfully');
    } else if (message.startsWith('CAPTURE_CLICK:')) {
      const clickInfo = message.replace('CAPTURE_CLICK:', '');
      console.log('🖱️ Capture click detected:', clickInfo);
    } else if (message === 'DOWNLOAD_PREVENTED_IN_CAPTURE') {
      console.log('🚫 Download click prevented in capture phase');
      Alert.alert('Download Detected', 'Download button click was intercepted. Attempting to process download...');
    } 
    else if (message.startsWith('BLOB_DOWNLOAD_ERROR:')) {
      console.error('Blob download error:', message.split(':')[1]);
      Alert.alert('Download Error', 'Failed to process blob download');
    } else if (message.startsWith('BLOB_PROCESSING_ERROR:')) {
      console.error('Blob processing error:', message.split(':')[1]);
      Alert.alert('Download Error', 'Failed to process blob URL');
    }
  };

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load dashboard</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !webViewUrl) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Loader />
      </SafeAreaView>
    );
  }

  const storageInjectBeforeLoad = buildLocalStorageInjectScript(authToken, loginResponseRaw);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {webViewUrl ? (
          <>
            <WebView
              ref={webViewRef}
              source={{
                uri: webViewUrl,
                ...(authToken ? { headers: { Authorization: 'Bearer ' + authToken } } : {}),
              }}
              injectedJavaScriptBeforeContentLoaded={storageInjectBeforeLoad ? `(function(){${storageInjectBeforeLoad}})();` : undefined}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              startInLoadingState={false}
              onNavigationStateChange={handleNavigationChange}
              onError={handleError}
              onHttpError={handleError}
              injectedJavaScript={injectJavaScript}
              onMessage={handleWebViewMessage}
              onLoadStart={() => {}}
              onLoadEnd={({ nativeEvent }) => {
                // Detect silent WebView failures (common after long inactivity)
                if (nativeEvent.description === 'net::ERR_FAILED' || 
                    nativeEvent.description?.includes('ERR_') ||
                    nativeEvent.title === '') {
                  console.log('WebView load failed silently - reloading:', nativeEvent.description);
                  webViewRef.current?.reload();
                }
              }}
              // File upload support
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo={true}
              allowsBackForwardNavigationGestures={false}
              // Critical for file downloads - this handles the download requests
              onFileDownload={({ nativeEvent }) => {
                console.log('File download requested:', nativeEvent.downloadUrl);
                if (nativeEvent.downloadUrl) {
                  handleFileDownload(nativeEvent.downloadUrl);
                }
              }}
              // Enable file upload permissions
              mixedContentMode="compatibility"
              // For Android file upload
              onPermissionRequest={(request) => {
                console.log('Permission requested:', request.nativeEvent);
                request.grant();
              }}
              // Handle file uploads properly
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowFileAccessFromFileURLs={true}
              // Allow blob and data URLs
              originWhitelist={['*']}
              // iOS specific file upload handling
              onShouldStartLoadWithRequest={(request) => {
                console.log('Should start load with request:', request.url);
                
                // Handle blob URLs - MUST prevent navigation and process blob
                if (request.url.startsWith('blob:') || request.url.startsWith('data:')) {
                  console.log('🚫 Preventing blob URL navigation:', request.url);
                  
                  // Inject JavaScript to process the blob immediately
                  const processBlobScript = `
                    (function() {
                      try {
                        const blobUrl = '${request.url}';
                        console.log('Processing blob URL:', blobUrl);
                        
                        fetch(blobUrl)
                          .then(response => response.blob())
                          .then(blob => {
                            const reader = new FileReader();
                            reader.onload = function() {
                              const base64Data = reader.result.split(',')[1];
                              window.ReactNativeWebView.postMessage('BLOB_DOWNLOAD_READY:' + JSON.stringify({
                                fileName: 'document.pdf',
                                base64Data: base64Data,
                                mimeType: blob.type || 'application/octet-stream'
                              }));
                            };
                            reader.readAsDataURL(blob);
                          })
                          .catch(error => {
                            console.error('Error processing blob:', error);
                            window.ReactNativeWebView.postMessage('BLOB_DOWNLOAD_ERROR:' + error.message);
                          });
                      } catch (error) {
                        console.error('Error in blob processing script:', error);
                        window.ReactNativeWebView.postMessage('BLOB_PROCESSING_ERROR:' + error.message);
                      }
                    })();
                    true;
                  `;
                  
                  webViewRef.current?.injectJavaScript(processBlobScript);
                  return false; // PREVENT navigation to blob URL
                }
                
                // Check if this is a file download URL (including images)
                if (request.url.includes('download') || 
                    request.url.includes('export') ||
                    request.url.includes('/app/public/') ||
                    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|csv|png|jpg|jpeg|gif|bmp|webp)(\?|$)/i.test(request.url)) {
                  console.log('📥 File download URL detected in navigation:', request.url);
                  
                  // Show immediate loading feedback
                  setIsLoading(true);
                  
                  // Try to download the file instead of navigating
                  handleFileDownload(request.url).finally(() => {
                    setIsLoading(false);
                  });
                  return false; // Prevent navigation
                }
                
                return true;
              }}
            />
            {isLoading && <Loader />}
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No dashboard URL available</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default DashboardScreen;