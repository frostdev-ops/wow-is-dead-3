class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if request already in flight
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // Create and track promise
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  clear() {
    this.pending.clear();
  }
}

export const deduplicator = new RequestDeduplicator();

