import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler, ActivityIndicator, Alert, Platform, PermissionsAndroid, Linking, Share, AppState, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SessionService } from '../../services/session';
import { getDashboardUrl } from '../../services/api/config';
import Loader from '../../components/Loader';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';

const SESSION_STORAGE_KEYS = [
  '@auth_token', '@remember_token', '@token_type',
  '@time_format', '@date_format', '@timezone_id',
  '@user_data', '@tenant_data', '@permissions', '@access_info',
];

const buildPreloadScript = (session) => {
  if (!session?.['@auth_token']) {
    return 'true;';
  }
  const safe = (v) => (v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const token        = safe(session['@auth_token']);
  const remToken     = safe(session['@remember_token'] || '');
  const tokenType    = safe(session['@token_type'] || 'Bearer');
  const timeFormat   = safe(session['@time_format'] || '');
  const dateFormat   = safe(session['@date_format'] || '');
  const timezoneId   = safe(session['@timezone_id'] || '');
  const userData     = safe(session['@user_data'] || '');
  const tenantData   = safe(session['@tenant_data'] || '');
  const permissions  = safe(session['@permissions'] || '');
  const accessInfo   = safe(session['@access_info'] || '');

  return `
    (function() {
      try {
        // Write token under common key aliases used by web apps.
        var tokenValue = '${token}';
        var rememberToken = '${remToken}';

        // Plain token aliases
        localStorage.setItem('authToken',     tokenValue);
        localStorage.setItem('accessToken',   tokenValue);
        localStorage.setItem('auth_token',    tokenValue);
        localStorage.setItem('token',         tokenValue);
        localStorage.setItem('access_token',  tokenValue);
        localStorage.setItem('bearer_token',  tokenValue);
        localStorage.setItem('sanctum_token', tokenValue);

        sessionStorage.setItem('authToken',    tokenValue);
        sessionStorage.setItem('accessToken',  tokenValue);
        sessionStorage.setItem('auth_token',   tokenValue);
        sessionStorage.setItem('token',        tokenValue);
        sessionStorage.setItem('access_token', tokenValue);

        // Remember-token aliases
        if (rememberToken) {
          localStorage.setItem('rememberToken',  rememberToken);
          localStorage.setItem('remember_token', rememberToken);
        }

        // User / settings fields
        if ('${timeFormat}')   localStorage.setItem('timeFormat',   '${timeFormat}');
        if ('${timeFormat}')   localStorage.setItem('time_format',  '${timeFormat}');
        if ('${dateFormat}')   localStorage.setItem('dateFormat',   '${dateFormat}');
        if ('${dateFormat}')   localStorage.setItem('date_format',  '${dateFormat}');
        if ('${timezoneId}')   localStorage.setItem('timezoneId',   '${timezoneId}');
        if ('${timezoneId}')   localStorage.setItem('timezone_id',  '${timezoneId}');
        if ('${tokenType}')    localStorage.setItem('tokenType',    '${tokenType}');
        if ('${tokenType}')    localStorage.setItem('token_type',   '${tokenType}');
        if ('${userData}')     localStorage.setItem('user',         '${userData}');
        if ('${tenantData}')   localStorage.setItem('tenant',       '${tenantData}');
        if ('${permissions}')  localStorage.setItem('permissions',  '${permissions}');
        if ('${accessInfo}')   localStorage.setItem('accessInfo',   '${accessInfo}');

        // ── Also write a combined auth object that some SPAs expect
        try {
          var authObj = {
            token: tokenValue,
            access_token: tokenValue,
            token_type: '${tokenType}',
            remember_token: rememberToken
          };
          localStorage.setItem('auth', JSON.stringify(authObj));
        } catch(e2) {}
      } catch(e) {}
    })();
    true;
  `;
};

const DashboardScreen = ({ navigation }) => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const webViewRef = useRef(null);
  const hasLoadedSuccessfully = useRef(false);
  const lastBackgroundAt = useRef(0);
  const suppressNextResumeReload = useRef(false);

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

        const pairs = await AsyncStorage.multiGet(SESSION_STORAGE_KEYS);
        const session = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
        setSessionData(session);

        const url = getDashboardUrl(tenantId);
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
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastBackgroundAt.current = Date.now();
        return;
      }

      if (nextAppState === 'active') {
        const elapsedMs = Date.now() - (lastBackgroundAt.current || Date.now());

        // Returning from file picker/media picker can briefly background the app.
        // Do not reload in that case or the in-progress upload gets reset.
        if (suppressNextResumeReload.current && elapsedMs < 15000) {
          suppressNextResumeReload.current = false;
          return;
        }

        // Only reload after longer inactivity to recover potentially killed WebView.
        if (elapsedMs > 2 * 60 * 1000) {
          webViewRef.current?.reload();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleNavigationChange = async (navState) => {
    setIsLoading(navState.loading);
    
    const url = navState.url;

    if (!navState.loading && !url.includes('/login')) {
      hasLoadedSuccessfully.current = true;
    }
 
    if (url.includes('/login')) {
      // Only treat as real logout if the dashboard was previously loaded ok.
      // On the first load the web app may briefly redirect to /login before our
      // preload script has set the token - ignore that race condition.
      if (hasLoadedSuccessfully.current) {
        await SessionService.clearSession();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }]
        });
      }
    }
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);

    if (nativeEvent.description && nativeEvent.description.includes('client-side exception')) {
      return;
    }

    const isNetworkError = nativeEvent.description && (
      nativeEvent.description.includes('ERR_INTERNET_DISCONNECTED') ||
      nativeEvent.description.includes('ERR_NETWORK_CHANGED') ||
      nativeEvent.description.includes('ERR_CONNECTION_TIMED_OUT') ||
      nativeEvent.description.includes('ERR_CONNECTION_REFUSED') ||
      nativeEvent.description.includes('ERR_NAME_NOT_RESOLVED') ||
      nativeEvent.description.includes('net::ERR_')
    );

    if (isNetworkError) {
      setIsOffline(true);
      setIsLoading(false);
      return;
    }

    setHasError(true);
    setIsLoading(false);
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

    console.log('WebView message received:', message);

    if (message === 'NEED_TOKEN_INJECTION') {
      try {
        const keys = [
          '@auth_token', '@remember_token', '@token_type',
          '@time_format', '@date_format', '@timezone_id',
          '@user_data', '@tenant_data', '@permissions', '@access_info',
        ];
        const pairs = await AsyncStorage.multiGet(keys);
        const session = Object.fromEntries(pairs.map(([k, v]) => [k, v]));

        const token = session['@auth_token'];
        if (!token) return;

        const safe = (v) => (v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const injectionScript = `
          try {
            window.localStorage.setItem('authToken', '${safe(token)}');
            window.sessionStorage.setItem('authToken', '${safe(token)}');

            ${session['@remember_token'] ? `window.localStorage.setItem('rememberToken', '${safe(session['@remember_token'])}');` : ''}
            ${session['@token_type']     ? `window.localStorage.setItem('tokenType', '${safe(session['@token_type'])}');` : ''}
            ${session['@time_format']    ? `window.localStorage.setItem('timeFormat', '${safe(session['@time_format'])}');` : ''}
            ${session['@date_format']    ? `window.localStorage.setItem('dateFormat', '${safe(session['@date_format'])}');` : ''}
            ${session['@timezone_id']    ? `window.localStorage.setItem('timezoneId', '${safe(session['@timezone_id'])}');` : ''}
            ${session['@user_data']      ? `window.localStorage.setItem('user', '${safe(session['@user_data'])}');` : ''}
            ${session['@tenant_data']    ? `window.localStorage.setItem('tenant', '${safe(session['@tenant_data'])}');` : ''}
            ${session['@permissions']    ? `window.localStorage.setItem('permissions', '${safe(session['@permissions'])}');` : ''}
            ${session['@access_info']    ? `window.localStorage.setItem('accessInfo', '${safe(session['@access_info'])}');` : ''}

            window.ReactNativeWebView.postMessage('TOKEN_INJECTED');
          } catch (error) {
            window.ReactNativeWebView.postMessage('INJECTION_ERROR:' + error.message);
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(injectionScript);
      } catch (error) {
        console.error('Token injection failed:', error);
      }
    } else if (message === 'FILE_INPUT_CLICKED') {
      console.log('User clicked file input - requesting permissions now');
      suppressNextResumeReload.current = true;
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

  if (isOffline) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineIcon}>📶</Text>
          <Text style={styles.offlineTitle}>No Internet Connection</Text>
          <Text style={styles.offlineSubtitle}>
            Please check your Wi-Fi or mobile data and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setIsOffline(false);
              setIsLoading(true);
              setTimeout(() => webViewRef.current?.reload(), 300);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => BackHandler.exitApp()}
          >
            <Text style={styles.exitButtonText}>Exit App</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineIcon}>⚠️</Text>
          <Text style={styles.offlineTitle}>Something went wrong</Text>
          <Text style={styles.offlineSubtitle}>
            We couldn't load the dashboard. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              setTimeout(() => webViewRef.current?.reload(), 300);
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => BackHandler.exitApp()}
          >
            <Text style={styles.exitButtonText}>Exit App</Text>
          </TouchableOpacity>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {webViewUrl ? (
          <>
            <WebView
              ref={webViewRef}
              source={{ uri: webViewUrl }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              startInLoadingState={false}
              onNavigationStateChange={handleNavigationChange}
              onError={handleError}
              onHttpError={handleError}
              injectedJavaScriptBeforeContentLoaded={buildPreloadScript(sessionData)}
              injectedJavaScript={injectJavaScript}
              onMessage={handleWebViewMessage}
              onLoadStart={() => {}}
              onLoadEnd={({ nativeEvent }) => {
                if (nativeEvent.description === 'net::ERR_FAILED') {
                  setIsOffline(true);
                  setIsLoading(false);
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
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    backgroundColor: '#fff',
  },
  offlineIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
    textAlign: 'center',
  },
  offlineSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 36,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 13,
    paddingHorizontal: 48,
    borderRadius: 10,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exitButton: {
    paddingVertical: 13,
    paddingHorizontal: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '100%',
    alignItems: 'center',
  },
  exitButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DashboardScreen;