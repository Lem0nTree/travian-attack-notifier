// utils/browser-utils.js
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

const BROWSER_CONFIG = {
  // Chrome Windows fingerprint
  windowsChrome: {
    userAgent: DEFAULT_USER_AGENT,
    viewport: {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true,
    },
    // Chrome specific features
    vendorSub: "",
    productSub: "20030107",
    vendor: "Google Inc.",
    maxTouchPoints: 0,
    hardwareConcurrency: 12,
    // WebGL parameters
    webglVendor: "Google Inc. (NVIDIA)",
    webglRenderer:
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    // Additional navigator properties
    languages: ["en-US", "en"],
    platform: "Win32",
  },
};

class BrowserFingerprint {
  static async applyFingerprint(page, fingerprintType = "windowsChrome") {
    const config = BROWSER_CONFIG[fingerprintType];
    if (!config) {
      throw new Error(`Unknown fingerprint type: ${fingerprintType}`);
    }

    // Set user agent
    await page.setUserAgent(config.userAgent);

    // Set viewport
    await page.setViewport(config.viewport);

    // Override navigator properties
    await page.evaluateOnNewDocument((config) => {
      Object.defineProperties(navigator, {
        hardwareConcurrency: { value: config.hardwareConcurrency },
        platform: { value: config.platform },
        maxTouchPoints: { value: config.maxTouchPoints },
        vendor: { value: config.vendor },
        vendorSub: { value: config.vendorSub },
        productSub: { value: config.productSub },
        languages: { value: config.languages },
      });

      // Override WebGL parameters
      const getParameterProxyHandler = {
        apply: function (target, thisArg, argumentsList) {
          const param = argumentsList[0];
          const gl = thisArg;

          // WebGL vendor and renderer strings
          if (param === 37445) {
            // UNMASKED_VENDOR_WEBGL
            return config.webglVendor;
          }
          if (param === 37446) {
            // UNMASKED_RENDERER_WEBGL
            return config.webglRenderer;
          }

          return target.apply(thisArg, argumentsList);
        },
      };

      // Override WebGL getParameter function
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = new Proxy(
        getParameter,
        getParameterProxyHandler
      );
    }, config);
  }

  // Method to get random viewport dimensions within a realistic range
  static getRandomViewport() {
    const commonResolutions = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
    ];

    return commonResolutions[
      Math.floor(Math.random() * commonResolutions.length)
    ];
  }

  // Method to generate a random realistic Windows Chrome user agent
  static getRandomUserAgent() {
    const chromeVersions = ["119.0.0.0", "118.0.0.0", "117.0.0.0"];
    const version =
      chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
  }

  // Method to randomize fingerprint while keeping it realistic
  static async applyRandomFingerprint(page) {
    const config = { ...BROWSER_CONFIG.windowsChrome };
    config.userAgent = this.getRandomUserAgent();
    config.viewport = this.getRandomViewport();
    config.hardwareConcurrency = [4, 8, 12, 16][Math.floor(Math.random() * 4)];

    await this.applyFingerprint(page, "windowsChrome");
    return config;
  }
}

module.exports = {
  BrowserFingerprint,
  BROWSER_CONFIG,
};
