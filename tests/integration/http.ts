import { BASE_URL } from "./config";

export interface ApiClient {
  login(username: string, password: string): Promise<Response>;
  req(
    path: string,
    opts?: { method?: string; body?: unknown; formData?: FormData },
  ): Promise<Response>;
  cookie: string | null;
}

export function createApiClient(): ApiClient {
  let cookie: string | null = null;

  function adoptSetCookie(res: Response) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const name = setCookie.split(";")[0].split("=")[0].trim();
      const value = setCookie.split(";")[0];
      if (value.startsWith(`${name}=`)) cookie = value;
    }
  }

  return {
    async login(username: string, password: string) {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      adoptSetCookie(res);
      return res;
    },
    async req(path, opts = {}) {
      const headers: Record<string, string> = {};
      if (cookie) headers.Cookie = cookie;
      let body: BodyInit | undefined;
      if (opts.formData) {
        body = opts.formData;
      } else if (opts.body !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(opts.body);
      }
      const res = await fetch(`${BASE_URL}${path}`, {
        method: opts.method ?? "GET",
        headers,
        body,
        redirect: "manual",
      });
      adoptSetCookie(res);
      return res;
    },
    get cookie() {
      return cookie;
    },
  };
}
