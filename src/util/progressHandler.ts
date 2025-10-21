import Progress from "./progress";

export default class ProgressHandler {
  /**
   * Map of progress bars identified by a UUID string.
   */
  private progressMap: Map<string, Progress> = new Map();

  public addProgress(): string {
    const uuid = crypto.randomUUID();

    this.progressMap.set(uuid, new Progress());

    return uuid;
  }

  public getProgress(uuid: string): Progress | undefined {
    return this.progressMap.get(uuid);
  }

  public removeProgress(uuid: string): void {
    this.progressMap.delete(uuid);
  }

  public hasProgress(uuid: string): boolean {
    return this.progressMap.has(uuid);
  }
}
