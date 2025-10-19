import { sleep } from "bun";
// Concrete connectors are imported lazily inside getConnector to avoid
// circular-import issues (tidal/spotify extend this Connector class).

const REQUEST_WAIT_TIME = 500; // 500 ms
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_RETRIES = 1; // number of retry attempts on network failure
const RETRY_DELAY_MS = 500; // delay between retries

type QueryParams = Record<string, string | string[] | number>;

export default abstract class Connector {
  private static connectors: Record<string, Connector> = {};
  protected abstract baseUrl: string;
  private lastRequestTime: number = 0;

  public static async getConnector(type: "spotify" | "tidal") {
    if (!this.connectors[type]) {
      let connector: Connector;
      switch (type) {
        case "spotify": {
          const mod = await import("./spotifyConnector");
          connector = new mod.default();
          break;
        }
        case "tidal": {
          const mod = await import("./tidalConnector");
          connector = new mod.default();
          break;
        }
        default:
          throw new Error(`Unknown connector type ${type}`);
      }
      this.connectors[type] = connector;
    }
    return this.connectors[type];
  }

  /**
   * Performs the provided request while respecting the wait time between requests.
   */
  protected async sendRequest(request: Request): Promise<Response> {
    // We'll attempt the request and optionally retry once on transient network errors.
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Throttle based on start time of requests so calls are spaced by REQUEST_WAIT_TIME
      const now = Date.now();
      const delta = now - this.lastRequestTime;
      if (delta < REQUEST_WAIT_TIME) {
        await sleep(REQUEST_WAIT_TIME - delta);
      }

      // If the caller didn't provide an AbortSignal, create one with a timeout.
      let controller: AbortController | undefined;
      let timeoutId: any;
      let reqToSend: Request = request;
      if (!(request as any).signal) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller!.abort(), REQUEST_TIMEOUT_MS);
        // clone the request and attach our signal
        reqToSend = new Request(request, { signal: controller.signal });
      }

      // Record the start time so throttling uses request start time.
      this.lastRequestTime = Date.now();

      try {
        const response = await fetch(reqToSend);
        return response;
      } catch (err) {
        // If the request was explicitly aborted, rethrow immediately.
        const name = (err as any)?.name;
        if (name === "AbortError") {
          throw err;
        }

        // For other errors, retry if we still have attempts left.
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          // continue to next attempt
        } else {
          // No attempts left — rethrow the original error for caller handling.
          throw err;
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    // Should be unreachable, but keep the signature satisfied.
    throw new Error("Failed to perform request");
  }

  public async get(
    path: string,
    token: string,
    params?: QueryParams
  ): Promise<Response> {
    // Ensure the path starts with a slash
    if (!path.startsWith("http") && !path.startsWith("/")) {
      path = "/" + path;
    }

    // Construct the query string if parameters are given
    if (params) {
      const queryString = this.buildQuery(params);
      path += `?${queryString}`;
    }

    // Add the authorization header
    const headers = new Headers();
    headers.append("Authorization", `Bearer ${token}`);

    const init: RequestInit = {
      method: "GET",
      headers,
    };

    if (!path.startsWith("http")) {
      path = this.baseUrl + path;
    }

    return await this.sendRequest(new Request(path, init));
  }

  public async post(
    path: string,
    token: string,
    params?: QueryParams,
    body?: any,
    contentType?: string
  ): Promise<Response> {
    // Ensure the path starts with a slash
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    if (params) {
      const queryString = this.buildQuery(params);
      path += `?${queryString}`;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType ?? "application/json",
    };

    const init: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };
    const request = new Request(this.baseUrl + path, init);
    return await this.sendRequest(request);
  }

  public async put(
    path: string,
    token: string,
    params?: QueryParams,
    body?: any,
    contentType?: string
  ): Promise<Response> {
    // Ensure the path starts with a slash
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    if (params) {
      const queryString = this.buildQuery(params);
      path += `?${queryString}`;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType ?? "application/json",
    };

    const init: RequestInit = {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    };
    const request = new Request(this.baseUrl + path, init);
    return await this.sendRequest(request);
  }

  public async delete(
    path: string,
    token: string,
    params?: QueryParams,
    body?: Record<string, any>,
    contentType?: string
  ): Promise<Response> {
    // Ensure the path starts with a slash
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    if (params) {
      const queryString = this.buildQuery(params);
      path += `?${queryString}`;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType ?? "application/json",
    };

    const init: RequestInit = {
      method: "DELETE",
      headers,
      body: JSON.stringify(body),
    };
    const request = new Request(this.baseUrl + path, init);
    return await this.sendRequest(request);
  }

  public abstract getPaginated<T>(path: string, token: string): any;

  private buildQuery(params: QueryParams): string {
    let queryString;

    queryString = Object.entries(params)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((subval) => `${key}=${subval}`).join("&");
        }
        return `${key}=${value}`;
      })
      .join("&");
    return queryString;
  }
}
