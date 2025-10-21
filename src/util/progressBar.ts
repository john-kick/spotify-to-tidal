type Step = {
  index: number;
  description: string;
};

export default class ProgressBar {
  private current: number;
  private steps: string[];

  public constructor(steps: string[]) {
    this.current = 0;
    this.steps = steps;
  }

  public next(): string | null {
    if (this.current < this.steps.length) {
      const step = this.steps[this.current];
      this.current += 1;
      return step;
    }
    return null;
  }

  public getCurrent(): Step {
    return {
      index: this.current,
      description: this.steps[this.current] || "Completed"
    };
  }

  public isComplete(): boolean {
    return this.current >= this.steps.length;
  }

  public reset(): void {
    this.current = 0;
  }
}
