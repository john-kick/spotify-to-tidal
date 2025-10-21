import Progress from "./progress";

export default class ProgressHandler {
  private static instance?: ProgressHandler;
  /**
   * Map of progress bars identified by a UUID string.
   */
  private progressMap: Map<string, Progress> = new Map();

  public static getInstance(): ProgressHandler {
    if (!ProgressHandler.instance) {
      ProgressHandler.instance = new ProgressHandler();
    }
    return ProgressHandler.instance;
  }

  private constructor() {}

  public createProgress(): { progress: Progress; uuid: string } {
    const uuid = crypto.randomUUID();

    const progress = new Progress();
    this.progressMap.set(uuid, progress);

    return { progress, uuid };
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
