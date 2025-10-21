import ProgressBar from "./progressBar";

export default class ProgressHandler {
  /**
   * Map of progress bars identified by a UUID string.
   */
  private progressBars: Map<string, ProgressBar> = new Map();

  public addProgressBar(steps: string[]): string {
    const uuid = crypto.randomUUID();

    this.progressBars.set(uuid, new ProgressBar(steps));

    return uuid;
  }

  public getProgressBar(uuid: string): ProgressBar | undefined {
    return this.progressBars.get(uuid);
  }

  public removeProgressBar(uuid: string): void {
    this.progressBars.delete(uuid);
  }

  public hasProgressBar(uuid: string): boolean {
    return this.progressBars.has(uuid);
  }
}
