const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
const { execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const NOTION_VERSION = "2022-06-28";
const NOTION_CALLBACK_PORT = Number(process.env.NOTION_OAUTH_CALLBACK_PORT || 39391);
let mainWindow = null;
let notionCallbackServer = null;
let pendingNotionCallback = null;

function resolvePage(pageName) {
  const distPath = path.join(__dirname, "..", "dist", pageName);
  if (!fs.existsSync(distPath)) {
    return path.join(__dirname, "..", "dist", "index.html");
  }
  return distPath;
}

function loadApp(mainWindow) {
  mainWindow.loadFile(resolvePage("index.html"), { hash: "tasks" });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1080,
    minHeight: 760,
    title: "yaoyaoflow",
    backgroundColor: "#edf2ff",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[renderer] did-fail-load", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer] render-process-gone", details);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("[renderer:console]", { level, message, line, sourceId });
  });

  mainWindow.webContents.on("did-finish-load", async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const snapshot = await mainWindow.webContents.executeJavaScript(`
        (() => ({
          location: window.location.href,
          title: document.title,
          bodyClass: document.body.className,
          rootExists: Boolean(document.getElementById("root")),
          rootChildren: document.getElementById("root")?.children.length ?? -1,
          rootTextLength: document.getElementById("root")?.innerText.length ?? -1,
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
        }))()
      `);
      console.log("[renderer] did-finish-load", snapshot);

      const image = await mainWindow.webContents.capturePage();
      const capturePath = path.join(app.getPath("temp"), "yaoyaoflow-electron-capture.png");
      fs.writeFileSync(capturePath, image.toPNG());
      console.log("[renderer] capturePage", capturePath);
    } catch (error) {
      console.error("[renderer] did-finish-load diagnostic error", error);
    }
  });

  loadApp(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function getNotionConfig() {
  return {
    authUrl: process.env.NOTION_AUTH_URL || "https://api.notion.com/v1/oauth/authorize",
    clientId: process.env.NOTION_OAUTH_CLIENT_ID || process.env.OAUTH_CLIENT_ID || "",
    configured: Boolean((process.env.NOTION_OAUTH_CLIENT_ID || process.env.OAUTH_CLIENT_ID) && (process.env.NOTION_OAUTH_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET)),
    redirectUri: process.env.NOTION_OAUTH_REDIRECT_URI || process.env.OAUTH_REDIRECT_URI || `http://127.0.0.1:${NOTION_CALLBACK_PORT}/notion/callback`
  };
}

function getOAuthSecret() {
  return process.env.NOTION_OAUTH_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || "";
}

function encodeOAuthCredentials(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number.parseInt(number, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function getMetaContent(html, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapedKey}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escapedKey}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escapedKey}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapedKey}["'][^>]*>`, "i"),
  ];
  return decodeHtmlEntities(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) || "");
}

function resolveMaybeRelativeUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function stripHtmlToText(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/blockquote|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n"));
}

function pickLongText(...values) {
  return values
    .map((value) => stripHtmlToText(value))
    .filter((value) => value.length >= 24)
    .sort((left, right) => right.length - left.length)[0] || "";
}

function parseJsonString(value) {
  if (!value) return "";
  try {
    return JSON.parse(`"${value.replace(/"/g, "\\\"")}"`);
  } catch {
    return value.replace(/\\n/g, "\n").replace(/\\"/g, "\"").replace(/\\u([0-9a-f]{4})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  }
}

function extractScriptField(html, fieldNames) {
  const values = [];
  fieldNames.forEach((fieldName) => {
    const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`["']${escapedName}["']\\s*:\\s*["']([\\s\\S]{12,2000}?)["']`, "gi");
    let match = pattern.exec(html);
    while (match) {
      values.push(parseJsonString(match[1]));
      match = pattern.exec(html);
    }
  });
  return pickLongText(...values);
}

function extractJsonLdArticle(html) {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).map((match) => match[1]);
  const candidates = [];

  scripts.forEach((script) => {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(script));
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [])];
      nodes.forEach((node) => {
        if (!node || typeof node !== "object") return;
        candidates.push(node.articleBody, node.description, node.text);
      });
    } catch {
      // Ignore malformed structured data.
    }
  });

  return pickLongText(...candidates);
}

function extractArticleContent(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const jsonLd = extractJsonLdArticle(html);
  const scriptText = extractScriptField(html, ["articleBody", "content", "desc", "description", "note_desc", "noteDesc"]);

  return pickLongText(jsonLd, article, main, scriptText);
}

function parseHtmlMetadata(html, finalUrl) {
  const title = getMetaContent(html, "og:title") || decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = getMetaContent(html, "og:description") || getMetaContent(html, "description");
  const image = getMetaContent(html, "og:image") || getMetaContent(html, "twitter:image");
  const siteName = getMetaContent(html, "og:site_name");
  const content = extractArticleContent(html);

  return {
    content,
    description,
    image: resolveMaybeRelativeUrl(image, finalUrl),
    siteName,
    title,
    url: finalUrl,
  };
}

async function parseExternalLink(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsupported URL protocol");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 yaoyaoflow/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const html = (await response.text()).slice(0, 600_000);
    return parseHtmlMetadata(html, response.url || parsed.toString());
  } finally {
    clearTimeout(timer);
  }
}

function recognizeImageText(imagePath) {
  const helperPath = path.join(__dirname, "ocr-image.swift");

  return new Promise((resolve, reject) => {
    execFile("/usr/bin/swift", [helperPath, imagePath], { maxBuffer: 4 * 1024 * 1024, timeout: 45_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message || "Image OCR failed"));
        return;
      }
      resolve(stdout.toString().trim());
    });
  });
}

function imageExtensionFromMime(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  if (mimeType === "image/tiff") return "tiff";
  return "png";
}

async function writeDataUrlImageToTemp(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error("请先在弹窗中粘贴一张图片");
  }

  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) {
    throw new Error("图片格式暂不支持");
  }

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw new Error("图片为空");
  }

  const filePath = path.join(app.getPath("temp"), `yaoyaoflow-calendar-ocr-${Date.now()}.${imageExtensionFromMime(mimeType)}`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

async function exchangeNotionToken(payload) {
  const config = getNotionConfig();
  const clientSecret = getOAuthSecret();

  if (!config.clientId || !clientSecret) {
    throw new Error("Notion OAuth is not configured");
  }

  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${encodeOAuthCredentials(config.clientId, clientSecret)}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Notion OAuth failed: ${response.status}`);
  }
  return body;
}

function sendPendingNotionCallback() {
  if (!pendingNotionCallback || !mainWindow) return;
  mainWindow.webContents.send("notion:oauth-callback", pendingNotionCallback);
  pendingNotionCallback = null;
}

function maybeHandleProtocolUrl(value) {
  if (typeof value !== "string") return false;
  if (!value.startsWith("yaoyaoflow://notion/callback") && !value.startsWith("focusflow://notion/callback")) return false;
  handleNotionCallback(value);
  return true;
}

function handleNotionCallback(url) {
  const parsed = new URL(url);
  pendingNotionCallback = {
    code: parsed.searchParams.get("code") || "",
    error: parsed.searchParams.get("error") || "",
    state: parsed.searchParams.get("state") || ""
  };

  if (mainWindow) {
    mainWindow.show();
    sendPendingNotionCallback();
  }
}

function startNotionCallbackServer() {
  if (notionCallbackServer) return;

  notionCallbackServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${NOTION_CALLBACK_PORT}`);
    if (requestUrl.pathname !== "/notion/callback") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    handleNotionCallback(requestUrl.toString());
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`
      <!doctype html>
      <html lang="zh-CN">
        <head><meta charset="utf-8"><title>yaoyaoflow Notion OAuth</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: grid; min-height: 100vh; place-items: center; margin: 0;">
          <main style="text-align: center;">
            <h1>Notion 授权已返回 yaoyaoflow</h1>
            <p>可以关闭这个浏览器窗口，回到应用继续。</p>
            <script>setTimeout(() => window.close(), 800)</script>
          </main>
        </body>
      </html>
    `);
  });

  notionCallbackServer.on("error", (error) => {
    console.error("[notion] callback server error", error);
  });

  notionCallbackServer.listen(NOTION_CALLBACK_PORT, "127.0.0.1", () => {
    console.log("[notion] callback server listening", `http://127.0.0.1:${NOTION_CALLBACK_PORT}/notion/callback`);
  });
}

ipcMain.handle("notion:get-config", () => getNotionConfig());

ipcMain.handle("notion:open-external", async (_event, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("notion:encrypt", (_event, value) => {
  if (!value) return "";
  return safeStorage.encryptString(value).toString("base64");
});

ipcMain.handle("notion:decrypt", (_event, value) => {
  if (!value) return "";
  return safeStorage.decryptString(Buffer.from(value, "base64"));
});

ipcMain.handle("notion:exchange-code", async (_event, { code, redirectUri }) => {
  return exchangeNotionToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri || getNotionConfig().redirectUri
  });
});

ipcMain.handle("notion:refresh-token", async (_event, { refreshToken }) => {
  return exchangeNotionToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
});

ipcMain.handle("notion:request", async (_event, { accessToken, body, method = "GET", path: apiPath }) => {
  if (!accessToken) throw new Error("Missing Notion access token");
  if (!apiPath || !apiPath.startsWith("/v1/")) throw new Error("Invalid Notion API path");

  const response = await fetch(`https://api.notion.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseBody.message || responseBody.code || `Notion API failed: ${response.status}`);
    error.status = response.status;
    error.body = responseBody;
    throw error;
  }
  return responseBody;
});

ipcMain.handle("link-parser:parse", async (_event, url) => {
  if (typeof url !== "string" || !url.trim()) throw new Error("Missing URL");
  return parseExternalLink(url.trim());
});

ipcMain.handle("calendar:recognize-image", async (_event, payload) => {
  const filePath = await writeDataUrlImageToTemp(payload?.dataUrl);
  try {
    const text = await recognizeImageText(filePath);
    return { canceled: false, text };
  } finally {
    fs.promises.rm(filePath, { force: true }).catch(() => {});
  }
});

app.whenReady().then(() => {
  startNotionCallbackServer();
  app.setAsDefaultProtocolClient("yaoyaoflow");
  app.setAsDefaultProtocolClient("focusflow");
  createWindow();
  sendPendingNotionCallback();
  process.argv.forEach(maybeHandleProtocolUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  maybeHandleProtocolUrl(url);
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    argv.forEach(maybeHandleProtocolUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on("web-contents-created", (_event, contents) => {
  contents.on("unresponsive", () => {
    console.error("[renderer] unresponsive");
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    notionCallbackServer?.close();
    app.quit();
  }
});
