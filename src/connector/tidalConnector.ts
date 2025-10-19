import type { TidalAPIError, TidalAPIGetResponse } from "@/types/tidal";
import Connector from "./baseConnector";

export default class TidalConnector extends Connector {
  protected baseUrl: string = "https://openapi.tidal.com/v2";

  /**
   * T has to match the data structure of the expected response body
   */
  public async getPaginated<T extends TidalAPIGetResponse>(
    path: string,
    token: string
  ): Promise<T["data"]> {
    let completeResult: T["data"] = [];
    let next: string | undefined = path;
    while (next) {
      const response = await this.get(next, token);

      if (!response.ok) {
        const errResult: TidalAPIError = await response.json();
        errResult.errors.forEach((error) =>
          console.error(`(${error.code}) ${error.detail}`)
        );
        throw new Error(
          "Errors while getting data. Please check the console for errors"
        );
      }

      const result: T = await response.json();
      // concatenate arrays; cast to any to avoid narrow typing issues
      completeResult = (completeResult as any).concat(result.data);
      next = result.links.next ? result.links.next : undefined;
    }
    return completeResult;
  }
}
