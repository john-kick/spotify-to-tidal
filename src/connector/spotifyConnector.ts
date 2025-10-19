import Connector from "./baseConnector";

export default class SpotifyConnector extends Connector {
  protected baseUrl: string = "https://api.spotify.com/v1";

  public async get(url: string, params?: Record<string, string>) {
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${this.token}`);

    if (params) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
      url += "?" + queryString;
    }

    const init = {
      method: "GET",
      headers
    };

    this.addToQueue(new Request(this.baseUrl + url, init));
  }

  public constructor(token: string) {
    super(token);
  }
}
