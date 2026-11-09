import { useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { UnauthorizedError } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Overview } from "@/pages/Overview";
import { ArtistPage } from "@/pages/ArtistPage";
import { Login } from "@/pages/Login";

const FIVE_MIN = 5 * 60 * 1000;

export function App() {
  const [authed, setAuthed] = useState(true);

  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err) => {
            if (err instanceof UnauthorizedError) setAuthed(false);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            refetchInterval: FIVE_MIN,
            retry: (count, err) =>
              !(err instanceof UnauthorizedError) && count < 1,
          },
        },
      }),
  );

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          setAuthed(true);
          client.clear();
        }}
      />
    );
  }

  return (
    <QueryClientProvider client={client}>
      <Layout>
        <Switch>
          <Route path="/" component={Overview} />
          <Route path="/:slug">{(params) => <ArtistPage slug={params.slug} />}</Route>
        </Switch>
      </Layout>
    </QueryClientProvider>
  );
}
