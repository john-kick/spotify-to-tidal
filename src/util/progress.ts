import type { ProgressBarState } from "./progressBar";
import type ProgressBar from "./progressBar";

type ProgressState = {
  text: string;
  progressBar?: ProgressBarState;
};

export default class Progress {
  private _text?: string = undefined;
  private _pg?: ProgressBar = undefined;
  private _finished: boolean = false;

  public get progressBar(): ProgressBar | undefined {
    return this._pg;
  }

  public set progressBar(pg: ProgressBar | undefined) {
    this._pg = pg;
  }

  public get text(): string | undefined {
    return this._text;
  }

  public set text(t: string) {
    this._text = t;
  }

  public get finished(): boolean {
    return this._finished;
  }

  public getCurrent(): ProgressState {
    return {
      text: this._text ?? "",
      progressBar: this._pg ? this._pg.getCurrent() : undefined
    };
  }

  public finish(): void {
    this._finished = true;
  }
}
