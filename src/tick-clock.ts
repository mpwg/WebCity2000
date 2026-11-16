/** Wall-clock debt is bounded to one second; each task runs at most one pulse. */
export class TickClock {
  private last = 0;
  private debt = 0;
  reset(now: number) {
    this.last = now;
    this.debt = 0;
  }
  due(now: number) {
    this.debt = Math.min(1000, this.debt + Math.max(0, now - this.last));
    this.last = now;
    if (this.debt < 100) return false;
    this.debt -= 100;
    return true;
  }
}
