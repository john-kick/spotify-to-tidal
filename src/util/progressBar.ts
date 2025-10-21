export type ProgressBarState = {
  current: number;
  total: number;
};

export default class ProgressBar {
  private current: number;
  private total: number;

  public constructor(steps: number) {
    this.current = 0;
    this.total = steps;
  }

  public next(steps: number = 1): number | null {
    if (this.current < this.total) {
      this.current = Math.min(this.current + steps, this.total);
      return this.current;
    }
    return null;
  }

  public getCurrent(): ProgressBarState {
    return { current: this.current, total: this.total };
  }

  public isComplete(): boolean {
    return this.current >= this.total;
  }

  public reset(): void {
    this.current = 0;
  }
}
