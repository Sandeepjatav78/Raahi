const MAX_ENTRIES = 100;

class OfflineBuffer {
  constructor(limit = MAX_ENTRIES) {
    this.queue = [];
    this.limit = limit;
  }

  push(item) {
    if (!item) return;
    if (this.queue.length >= this.limit) {
      this.queue.shift();
    }
    this.queue.push(item);
  }

  drain() {
    const payload = [...this.queue];
    this.queue.length = 0;
    return payload;
  }

  size() {
    return this.queue.length;
  }
}

export const offlineBuffer = new OfflineBuffer();
export default offlineBuffer;
