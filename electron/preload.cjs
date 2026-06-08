const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("focusflowNotion", {
  decrypt: (payload) => ipcRenderer.invoke("notion:decrypt", payload),
  encrypt: (payload) => ipcRenderer.invoke("notion:encrypt", payload),
  exchangeCode: (payload) => ipcRenderer.invoke("notion:exchange-code", payload),
  getConfig: () => ipcRenderer.invoke("notion:get-config"),
  onOAuthCallback: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("notion:oauth-callback", listener);
    return () => ipcRenderer.removeListener("notion:oauth-callback", listener);
  },
  openExternal: (url) => ipcRenderer.invoke("notion:open-external", url),
  refreshToken: (payload) => ipcRenderer.invoke("notion:refresh-token", payload),
  request: (payload) => ipcRenderer.invoke("notion:request", payload),
});

contextBridge.exposeInMainWorld("focusflowLinkParser", {
  parse: (url) => ipcRenderer.invoke("link-parser:parse", url),
});

contextBridge.exposeInMainWorld("focusflowCalendarOCR", {
  recognizeImage: (payload) => ipcRenderer.invoke("calendar:recognize-image", payload),
});
