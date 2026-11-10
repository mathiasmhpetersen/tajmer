import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Route, Switch } from "wouter";
import { fetchSession, UnauthorizedError } from "@/lib/api";
import { RoleProvider } from "@/lib/session";
import { Layout } from "@/components/Layout";
import { Overview } from "@/pages/Overview";
import { ArtistPage } from "@/pages/ArtistPage";
import { Preview } from "@/pages/Preview";
import { ClientPreview } from "@/pages/ClientPreview";
import { Login } from "@/pages/Login";

const FIVE_MIN = 5 * 60 * 1000;

export function App() {
  const [needLogin, setNeedLogin] = useState(false);

  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err) => {
            if (err instanceof UnauthorizedError) setNeedLogin(true);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            refetchInterval: FIVE_MIN,
            retry: (count, err) => !(err instanceof UnauthorizedError) && count < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <Gate needLogin={needLogin} setNeedLogin={setNeedLogin} />
    </QueryClientProvider>
  );
}

function Gate({
  needLogin,
  setNeedLogin,
}: {
  needLogin: boolean;
  setNeedLogin: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: Infinity,
    refetchInterval: false,
  });

  if (needLogin || session.isError || (session.isFetched && !session.data)) {
    return (
      <Login
        onSuccess={() => {
          setNeedLogin(false);
          qc.resetQueries();
        }}
      />
    );
  }

  if (!session.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-faint">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const isClient = session.data.role === "client";

  return (
    <RoleProvider role={session.data.role}>
      <Switch>
        {/* The client review experience is its own light, sidebar-less layout. */}
        <Route path="/preview">
          {() => (isClient ? <ClientPreview /> : <Layout><Preview /></Layout>)}
        </Route>
        <Route path="/">{() => <Layout><Overview /></Layout>}</Route>
        <Route path="/:slug">
          {(params) => (
            <Layout>
              <ArtistPage slug={params.slug} />
            </Layout>
          )}
        </Route>
      </Switch>
    </RoleProvider>
  );
}
