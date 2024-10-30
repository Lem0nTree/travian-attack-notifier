// monitor.js
require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const TimingUtils = require("./utils/timing-utils");
const { BrowserFingerprint } = require("./utils/browser-utils");

// Environment-based configuration
const CONFIG = {
  TRAVIAN: {
    SERVER_URL: process.env.TRAVIAN_SERVER_URL,
    USERNAME: process.env.TRAVIAN_USERNAME,
    PASSWORD: process.env.TRAVIAN_PASSWORD,
  },
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    THREAD_ID: process.env.TELEGRAM_THREAD_ID,
  },
  MONITOR: {
    // Base times that will have random variance added
    CHECK_INTERVAL: parseInt(process.env.CHECK_INTERVAL || "300000"),
    SWITCH_DELAY: parseInt(process.env.SWITCH_DELAY || "5000"),
    // Timing patterns to avoid
    PATTERNS_TO_AVOID: [5000, 10000, 15000, 30000, 60000].map((t) => ({
      time: t,
      variance: 1000, // Avoid being within 1 second of these patterns
    })),
  },
  BROWSER: {
    HEADLESS: process.env.HEADLESS?.toLowerCase() === "true",
  },
  PATHS: {
    DATA_DIR: path.join(__dirname, process.env.DATA_DIR || "data"),
    COOKIES_PATH: path.join(
      __dirname,
      process.env.DATA_DIR || "data",
      process.env.COOKIES_FILE || "cookies.json"
    ),
    LOG_PATH: path.join(
      __dirname,
      process.env.DATA_DIR || "data",
      process.env.LOG_FILE || "monitor.log"
    ),
    TIMING_LOG: path.join(
      __dirname,
      process.env.DATA_DIR || "data",
      "timing.log"
    ),
  },
};

// Initialize TimingUtils with config
const timingUtils = new TimingUtils(CONFIG);

// Validate required environment variables
function validateConfig() {
  const required = [
    { key: "TRAVIAN_SERVER_URL", value: CONFIG.TRAVIAN.SERVER_URL },
    { key: "TRAVIAN_USERNAME", value: CONFIG.TRAVIAN.USERNAME },
    { key: "TRAVIAN_PASSWORD", value: CONFIG.TRAVIAN.PASSWORD },
    { key: "TELEGRAM_BOT_TOKEN", value: CONFIG.TELEGRAM.BOT_TOKEN },
    { key: "TELEGRAM_CHAT_ID", value: CONFIG.TELEGRAM.CHAT_ID },
  ];

  const missing = required.filter((item) => !item.value);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing
        .map((item) => item.key)
        .join(", ")}`
    );
  }
}

// Logger utility
class Logger {
  static async ensureLogDirectory() {
    try {
      await fs.mkdir(CONFIG.PATHS.DATA_DIR, { recursive: true });
    } catch (error) {
      console.error(
        `Failed to create directory ${CONFIG.PATHS.DATA_DIR}:`,
        error
      );
      throw error;
    }
  }

  static async log(message, type = "INFO") {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;

    console.log(logMessage.trim());
    try {
      await fs.appendFile(CONFIG.PATHS.LOG_PATH, logMessage);
    } catch (error) {
      console.error("Failed to write to log file:", error);
      // Don't throw here to prevent recursive error logging
    }
  }

  static async logTiming(action, delay) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${action}: ${TimingUtils.formatTime(
      delay
    )}\n`;
    try {
      await fs.appendFile(CONFIG.PATHS.TIMING_LOG, logMessage);
    } catch (error) {
      console.error("Failed to write to timing log:", error);
      // Continue execution even if timing log fails
    }
  }

  static async error(message, error) {
    const errorMessage = `${message}: ${error.message}\n${error.stack}`;
    await this.log(errorMessage, "ERROR");
  }
}
// Telegram notification handler
class TelegramNotifier {
  static async sendMessage(message) {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM.BOT_TOKEN}/sendMessage`;
    const data = {
      chat_id: CONFIG.TELEGRAM.CHAT_ID,
      text: message,
      parse_mode: "HTML",
    };

    if (CONFIG.TELEGRAM.THREAD_ID) {
      data.message_thread_id = parseInt(CONFIG.TELEGRAM.THREAD_ID);
    }

    try {
      const response = await axios.post(url, data);
      await Logger.log("Telegram notification sent successfully");
      return response.data;
    } catch (error) {
      await Logger.error("Failed to send Telegram notification", error);
      throw error;
    }
  }
}

// Main monitor class
class TravianMonitor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.lastCheckTime = Date.now();
    this.lastSwitchTime = Date.now();
    this.currentFingerprint = null;
  }

  async initialize() {
    try {
      validateConfig();
      await Logger.ensureLogDirectory();

      this.browser = await puppeteer.launch({
        headless: CONFIG.BROWSER.HEADLESS ? "new" : false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
        defaultViewport: null,
      });

      this.page = await this.browser.newPage();

      // Apply fingerprint
      await BrowserFingerprint.applyFingerprint(this.page);

      // Additional anti-detection measures
      await this.page.evaluateOnNewDocument(() => {
        // Overwrite the navigator permissions query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);

        // Overwrite webdriver property
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });

        // Remove automation-related properties
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      });

      // Load cookies if they exist
      try {
        const cookiesString = await fs.readFile(CONFIG.PATHS.COOKIES_PATH);
        const cookies = JSON.parse(cookiesString);
        await this.page.setCookie(...cookies);
        await Logger.log("Loaded saved cookies");
      } catch (error) {
        await Logger.log("No saved cookies found, will perform fresh login");
      }

      await Logger.log(
        `Monitor initialized (Headless: ${CONFIG.BROWSER.HEADLESS})`
      );
    } catch (error) {
      await Logger.error("Failed to initialize monitor", error);
      throw error;
    }
  }

  async login() {
    try {
      // Randomize fingerprint before login
      this.currentFingerprint = await BrowserFingerprint.applyRandomFingerprint(
        this.page
      );
      await Logger.log("Applied new browser fingerprint for login");

      await this.page.goto(`${CONFIG.TRAVIAN.SERVER_URL}/login.php`);

      // Check if we're already logged in
      const loggedIn = (await this.page.$("#heroImageButton")) !== null;
      if (loggedIn) {
        await Logger.log("Already logged in");
        return true;
      }

      await Logger.log("Performing login...");

      // Add random delays between actions
      await this.page.type('input[name="name"]', CONFIG.TRAVIAN.USERNAME, {
        delay: Math.floor(Math.random() * 100) + 50, // Random typing delay
      });

      await new Promise((r) => setTimeout(r, Math.random() * 1000 + 500)); // Random delay between fields

      await this.page.type('input[name="password"]', CONFIG.TRAVIAN.PASSWORD, {
        delay: Math.floor(Math.random() * 100) + 50,
      });

      await new Promise((r) => setTimeout(r, Math.random() * 1000 + 500)); // Random delay before click

      await this.page.click('button[type="submit"]');

      // Wait for login to complete
      await this.page.waitForSelector("#heroImageButton", { timeout: 10000 });

      // Save cookies
      const cookies = await this.page.cookies();
      await fs.writeFile(CONFIG.PATHS.COOKIES_PATH, JSON.stringify(cookies));

      await Logger.log("Login successful");
      return true;
    } catch (error) {
      await Logger.error("Login failed", error);
      return false;
    }
  }

  async checkVillageForAttacks() {
    try {
      // Add random delay before checking
      await new Promise((resolve) =>
        setTimeout(resolve, timingUtils.addRandomVariance(500, 1, 3))
      );

      const villageName = await this.page.$eval("#villageName", (el) =>
        el.textContent.trim()
      );

      // Small random delay between DOM operations
      await new Promise((resolve) =>
        setTimeout(resolve, timingUtils.addRandomVariance(300, 1, 2))
      );

      const coords = await this.page.$eval(
        ".listEntry.active .coordinatesGrid",
        (el) => el.textContent.trim()
      );

      // Another small random delay
      await new Promise((resolve) =>
        setTimeout(resolve, timingUtils.addRandomVariance(400, 1, 2))
      );

      const attacks = await this.page.$$eval("span.a1", (elements) =>
        elements
          .filter((el) => el.textContent.includes("Attack"))
          .map((el) => el.textContent.trim())
      );

      if (attacks.length > 0) {
        const serverTime = await this.page.$eval("#servertime", (el) =>
          el.textContent.trim()
        );
        const message =
          `⚔️ <b>Incoming Attacks Detected!</b>\n\n` +
          `🏰 Village: ${villageName}\n` +
          `📍 Location: ${coords}\n` +
          `🔥 Attacks: ${attacks.join(", ")}\n` +
          `⏰ Server Time: ${serverTime}\n` +
          `🔗 <a href="${this.page.url()}">View Village</a>`;

        await TelegramNotifier.sendMessage(message);
        await Logger.log(
          `Detected ${attacks.length} attacks in ${villageName}`
        );
      }

      return attacks.length > 0;
    } catch (error) {
      await Logger.error("Error checking village for attacks", error);
      return false;
    }
  }

  async switchToNextVillage() {
    try {
      const villages = await this.page.$$eval(
        "#sidebarBoxVillagelist .listEntry:not(.active) a",
        (elements) =>
          elements.map((el) => ({
            href: el.href,
            name: el.querySelector(".name")?.textContent || "Unknown Village",
          }))
      );

      if (villages.length > 0) {
        // Randomly select next village instead of sequential selection
        const randomIndex = Math.floor(Math.random() * villages.length);
        const nextVillage = villages[randomIndex];

        await Logger.log(`Switching to village: ${nextVillage.name}`);
        await this.page.goto(nextVillage.href);
        await this.page.waitForSelector("#heroImageButton");

        // Add small random delay after switch
        const postSwitchDelay = timingUtils.addRandomVariance(1000, 1, 5);
        await new Promise((resolve) => setTimeout(resolve, postSwitchDelay));

        return true;
      }

      return false;
    } catch (error) {
      await Logger.error("Error switching village", error);
      return false;
    }
  }

  async monitorVillages() {
    if (!this.isRunning) return;

    try {
      // Get randomized timings using instance methods
      const nextCheckDelay = timingUtils.getNextCheckInterval();
      const nextSwitchDelay = timingUtils.getNextSwitchDelay();

      // Log timing information
      await Logger.logTiming("Next check", nextCheckDelay);
      await Logger.logTiming("Next switch", nextSwitchDelay);

      // Perform checks
      await this.checkVillageForAttacks();

      // Wait random time before switching
      await Logger.log(
        `Waiting ${TimingUtils.formatTime(
          nextSwitchDelay
        )} before switching villages`
      );
      await new Promise((resolve) => setTimeout(resolve, nextSwitchDelay));

      // Switch village
      await this.switchToNextVillage();

      // Schedule next check with random interval
      if (this.isRunning) {
        await Logger.log(
          `Scheduling next check in ${TimingUtils.formatTime(nextCheckDelay)}`
        );
        setTimeout(() => this.monitorVillages(), nextCheckDelay);
      }
    } catch (error) {
      await Logger.error("Error during village monitoring", error);
      // Add random delay before retry on error
      const retryDelay = timingUtils.addRandomVariance(30000, 1, 30); // 30s base + random
      await Logger.log(
        `Retrying in ${TimingUtils.formatTime(retryDelay)} after error`
      );
      setTimeout(() => this.monitorVillages(), retryDelay);
    }
  }

  async start() {
    try {
      this.isRunning = true;
      await this.initialize();
      const loginSuccess = await this.login();

      if (!loginSuccess) {
        throw new Error("Failed to log in to Travian");
      }

      await Logger.log("Starting village monitoring...");
      await this.monitorVillages();
    } catch (error) {
      await Logger.error("Failed to start monitoring", error);
      await this.stop();
    }
  }

  async stop() {
    this.isRunning = false;
    if (this.browser) {
      await this.browser.close();
    }
    await Logger.log("Monitor stopped");
  }
}

// Display configuration on startup (excluding sensitive data)
async function displayConfig() {
  const sanitizedConfig = {
    SERVER_URL: CONFIG.TRAVIAN.SERVER_URL,
    CHECK_INTERVAL: `${CONFIG.MONITOR.CHECK_INTERVAL}ms`,
    SWITCH_DELAY: `${CONFIG.MONITOR.SWITCH_DELAY}ms`,
    HEADLESS: CONFIG.BROWSER.HEADLESS,
    DATA_DIR: CONFIG.PATHS.DATA_DIR,
    THREAD_ID: CONFIG.TELEGRAM.THREAD_ID ? "Configured" : "Not configured",
  };

  await Logger.log("Starting with configuration:");
  await Logger.log(JSON.stringify(sanitizedConfig, null, 2));
}

// Error handling and cleanup
process.on("SIGINT", async () => {
  await Logger.log("Received SIGINT, shutting down...");
  if (monitor) {
    await monitor.stop();
  }
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  await Logger.error("Uncaught exception", error);
  if (monitor) {
    await monitor.stop();
  }
  process.exit(1);
});

// Start the monitor
(async () => {
  try {
    // Ensure log directory exists before any logging operations
    await Logger.ensureLogDirectory();

    await displayConfig();
    const monitor = new TravianMonitor();
    await monitor.start();
  } catch (error) {
    console.error("Failed to start monitor:", error);
    process.exit(1);
  }
})();
