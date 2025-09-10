import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";
import { initDatabase } from "@repo/data-ops/database";

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);

    // you are at 15:30 https://learn.backpine.com/full-stack-on-cloudflare/6d00fb92-fa90-4fae-8bd0-a3535ae27ab1
    initDatabase();

    if (url.pathname.startsWith("/trpc")) {
      return fetchRequestHandler({
        endpoint: "/trpc",
        req: request,
        router: appRouter,
        createContext: () =>
          createContext({ req: request, env: env, workerCtx: ctx }),
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<ServiceBindings>;
