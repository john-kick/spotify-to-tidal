import type { SpotifyAPIError, SpotifyAPIGetResponse } from "@/types/spotify";
import Connector from "./baseConnector";
import type Progress from "@/util/progress";

export default class SpotifyConnector extends Connector {
  protected baseUrl: string = "https://api.spotify.com/v1";

  /**
   * T must match the expected data structure contained in the response body
   */
  public async getPaginated<T extends SpotifyAPIGetResponse>(
    path: string,
    token: string,
    progress?: Progress,
    progressText?: string
  ): Promise<T["items"]> {
    if (progress) {
      progress.text = progressText + `(0)`;
    }

    let completeResult: T["items"] = [];
    let next: string | undefined = path;

    while (next) {
      const response = await this.get(next, token);

      if (!response.ok) {
        const errResult: SpotifyAPIError = await response.json();
        throw new Error(
          `(${errResult.error.status}) ${errResult.error.message}`
        );
      }

      const result: T = await response.json();

      completeResult = completeResult.concat(result.items);

      next = result.next;

      if (progress) {
        progress.text = progressText + `(${completeResult.length})`;
      }
    }

    if (progress) {
      progress.text = progressText + `(DONE)`;
    }

    return completeResult;
  }
}
