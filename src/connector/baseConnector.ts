import { randomUUIDv7, sleep } from "bun";
import SpotifyConnector from "./spotifyConnector";
import TidalConnector from "./tidalConnector";

const REQUEST_WAIT_TIME = 500; // 500 ms

/**
 * Wrapper for the Request object of the Fetch API.
 * Contains a generated uuid next to the actual Request object.
 */
interface ConnectorRequest {
  uuid: string;
  request: Request;
}

/**
 * Wrapper for the Response object of the Fetch API.
 * Contains the uuid of the corresponding ConnectorRequest object next to the actual Response object.
 */
interface ConnectorResponse {
  uuid: string;
  response: Response;
}

export default abstract class Connector {
  private static connectors: Record<string, Connector>;
  protected abstract baseUrl: string;
  private queue: ConnectorRequest[] = [];

  public static getConnector(type: "spotify" | "tidal", token: string) {
    if (!this.connectors[type]) {
      let connector;
      switch (type) {
        case "spotify":
          connector = new SpotifyConnector(token);
          break;
        case "tidal":
          connector = new TidalConnector(token);
          break;
        default:
          throw new Error(`Unknown connector type ${type}`);
      }
      this.connectors[type] = connector;
    }
    return this.connectors[type];
  }

  protected constructor(protected token: string) {}

  /**
   * Creates a request sending a GET request with the provided params
   */
  public abstract get(url: string, params?: Record<string, string>): any;

  /**
   * Adds a request object to the request queue
   * @returns	UUID associated with the request
   */
  protected addToQueue(request: Request): string {
    const uuid = randomUUIDv7();
    this.queue.push({ uuid, request });
    return uuid;
  }

  /**
   * Removes the first request of the queue and processes it.
   * Repeats this until the queue is empty.
   */
  private async processQueue(): Promise<ConnectorResponse[]> {
    const responses: ConnectorResponse[] = [];
    let request = this.queue.shift();
    while (request !== undefined) {
      const response = await fetch(request.request);
      responses.push({ uuid: request.uuid, response });
      request = this.queue.shift();
      await sleep(REQUEST_WAIT_TIME);
    }
    return responses;
  }

  /**
   * Replaces the request queue with an empty array
   */
  public clearQueue(): void {
    this.queue = [];
  }
}
