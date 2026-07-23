/* 
 * Private Offer Share - Configuration
 * Unauthorized access prohibited
 */
(function() {
  "use strict";
  
  // Encoded configuration
  var _0x = function() {
    var _a = {};
    _a['app'] = {
      key: atob("QUl6YVN5RG5NNW0xcXRCZW5ZbDBlNm9aRG5DSTdaTHFCbUk5V3dN"),
      domain: atob("ZGFyYXotYWZmaWxpYXRlLTM2YjVmLmZpcmViYXNlYXBwLmNvbQ=="),
      pid: atob("ZGFyYXotYWZmaWxpYXRlLTM2YjVm"),
      bucket: atob("ZGFyYXotYWZmaWxpYXRlLTM2YjVmLmZpcmViYXNlc3RvcmFnZS5hcHA="),
      sender: "226784335507",
      appId: atob("MToyMjY3ODQzMzU1MDc6d2ViOjk1YTJjOGFmMjQ4Yzk0YjdiYzVmNjY="),
      measure: atob("Ry1CTkw5M0xCUkgy")
    };
    _a['cdn'] = {
      name: atob("ZEJycnhyYmI5"),
      preset: atob("ZGFyYXpfcHJvZHVjdHM=")
    };
    _a['telegram'] = atob("aHR0cHM6Ly90Lm1lL1lPVVJfQ0hBTk5FTA==");
    return _a;
  }();
  
  const firebaseConfig = {
    apiKey: _0x.app.key,
    authDomain: _0x.app.domain,
    projectId: _0x.app.pid,
    storageBucket: _0x.app.bucket,
    messagingSenderId: _0x.app.sender,
    appId: _0x.app.appId,
    measurementId: _0x.app.measure
  };
  
  firebase.initializeApp(firebaseConfig);
  
  window._auth = firebase.auth();
  window._db = firebase.firestore();
  
  try {
    window._db.enablePersistence({ synchronizeTabs: true }).catch(function() {});
  } catch(e) {}
  
  window._cdnConfig = {
    cloudName: _0x.cdn.name,
    uploadPreset: _0x.cdn.preset
  };
  
  window._telegramLink = _0x.telegram;
  
  // Global variable mapping (backward compatibility)
  window.auth = window._auth;
  window.db = window._db;
  window.cloudinaryConfig = window._cdnConfig;
  window.TELEGRAM_LINK = window._telegramLink;
  
  // Clean up traces
  _0x = null;
})();