import Connector from "./baseConnector";

export default class TidalConnector extends Connector {
  protected baseUrl: string = "https://openapi.tidal.com/v2";

  public get(url: string, params: Record<string, string>) {
    throw new Error("Method not implemented.");
  }
  public constructor(token: string) {
    super(token);
  }
}
