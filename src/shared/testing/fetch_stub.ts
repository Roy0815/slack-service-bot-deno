export type FetchCall = {
  url: string;
  method: string;
  body: unknown;
  /** The raw, unparsed body (e.g. a Blob for multipart uploads). */
  rawBody: BodyInit | null | undefined;
};

/** Wrap a canned response in this to simulate a non-200 HTTP status. */
export type StatusResponse = { __status: number; body: unknown };

export type FetchStubOptions = {
  /**
   * Keyed by a URL substring (e.g. "chat.postMessage" or the full Slack
   * method path). The first matching key wins. A value can be a single
   * canned JSON response (200 OK) reused for every matching call, or an
   * array to return responses in sequence (last one repeats once
   * exhausted). Wrap a value in `{__status, body}` to simulate a non-200
   * HTTP response.
   */
  responses: Record<string, unknown | unknown[]>;
};

function isStatusResponse(value: unknown): value is StatusResponse {
  return typeof value === "object" && value !== null && "__status" in value;
}

/**
 * Stubs globalThis.fetch for the duration of a test. Real SlackFunction
 * handlers built via SlackFunctionTester always end up with a real
 * SlackAPIClient (enrichContext ignores any client set on the test
 * context), so intercepting fetch is the only way to unit test them
 * without hitting the network - see deno_slack_api's base-client.ts, which
 * POSTs every client.x.y() call to `{baseURL}/{method}`.
 */
export function stubFetch(options: FetchStubOptions) {
  const calls: FetchCall[] = [];
  const queues = new Map<string, unknown[]>(
    Object.entries(options.responses).map((
      [key, value],
    ) => [key, Array.isArray(value) ? [...value] : [value]]),
  );

  const original = globalThis.fetch;

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    const method = init?.method ?? "GET";

    // deno-slack-api sends URLSearchParams bodies (see base-client-helpers.ts
    // serializeData), with object/array/number/boolean values individually
    // JSON-stringified - decode those back out for readable assertions.
    let body: unknown;
    if (init?.body instanceof URLSearchParams) {
      body = Object.fromEntries(
        [...init.body.entries()].map(([key, value]) => {
          try {
            return [key, JSON.parse(value)];
          } catch {
            return [key, value];
          }
        }),
      );
    } else if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = Object.fromEntries(new URLSearchParams(init.body));
      }
    }

    calls.push({ url, method, body, rawBody: init?.body });

    const matchKey = Object.keys(options.responses).find((key) =>
      url.includes(key)
    );
    if (!matchKey) {
      throw new Error(`stubFetch: no canned response registered for ${url}`);
    }

    const queue = queues.get(matchKey)!;
    const response = queue.length > 1 ? queue.shift() : queue[0];
    const { status, body: responseBody } = isStatusResponse(response)
      ? { status: response.__status, body: response.body }
      : { status: 200, body: response };

    return Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
