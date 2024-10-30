# Travian Attack Notifier 🛡️

Automated monitoring system for Travian game attacks with Telegram notifications 🎮

## Features ✨

- 🔄 Automatic village monitoring
- ⚔️ Attack detection and alerts
- 📱 Telegram notifications
- 🕒 Random timing patterns
- 🎭 Browser fingerprinting
- 🔐 Session management
- 🤖 Anti-bot detection measures

## Prerequisites 📋

- Node.js >= 16
- Telegram Bot Token
- Travian Account
- Chrome/Chromium browser

## Installation 🚀

```bash
# Clone repository
git clone https://github.com/yourusername/travian-attack-notifier.git

# Install dependencies
npm install
```

## Configuration ⚙️

Create `.env` file:

```env
# Travian Settings
TRAVIAN_SERVER_URL=https://your-travian-server.com
TRAVIAN_USERNAME=your_username
TRAVIAN_PASSWORD=your_password

# Telegram Settings
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_THREAD_ID=optional_thread_id

# Monitor Settings
CHECK_INTERVAL=300000
SWITCH_DELAY=5000
HEADLESS=true

# Data Settings
DATA_DIR=data
COOKIES_FILE=cookies.json
LOG_FILE=monitor.log
```

## Usage 💻

```bash
# Start monitor
npm run start

```

## Project Structure 📁

```
├── monitor.js        # Main application
├── utils/
│   ├── timing-utils.js    # Timing functions
│   └── browser-utils.js   # Browser fingerprinting
├── data/             # Generated data directory
│   ├── cookies.json
│   ├── monitor.log
│   └── timing.log
└── .env
```

## Notifications 📢

Sample Telegram notification:

```
⚔️ Incoming Attacks Detected!

🏰 Village: Village Name
📍 Location: (-123|456)
🔥 Attacks: 2 incoming attacks
⏰ Server Time: 12:34:56
🔗 View Village
```

## Security 🔒

- Secure credential storage
- Random timing patterns
- Browser fingerprint rotation
- Anti-detection measures

## Contributing 🤝

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## Disclaimer ⚠️

This tool is for educational purposes. Use responsibly and comply with Travian's terms of service.

## License 📄

MIT License - see LICENSE file

## Support 💬

- Open issue for bugs
- Pull requests welcome
- Star repository if helpful

## Acknowledgments 🙏

- Puppeteer team
- Telegram Bot API
- Node.js community

Made with ❤️ by [Your Name]
