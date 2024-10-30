class TimingUtils {
  constructor(config) {
    this.config = config;
  }

  // Add random variance between min and max seconds
  addRandomVariance(baseTime, minVariance, maxVariance) {
    const variance =
      Math.floor(
        Math.random() * (maxVariance - minVariance + 1) + minVariance
      ) * 1000; // Convert to milliseconds
    return baseTime + variance;
  }

  // Get next check interval with randomization
  getNextCheckInterval() {
    const baseInterval = this.config.MONITOR.CHECK_INTERVAL;
    return this.addRandomVariance(baseInterval, 1, 30);
  }

  // Get next switch delay with randomization
  getNextSwitchDelay() {
    const baseDelay = this.config.MONITOR.SWITCH_DELAY;
    return this.addRandomVariance(baseDelay, 1, 30);
  }

  // Format milliseconds to human readable time
  static formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}

module.exports = TimingUtils;
