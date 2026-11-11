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
import { ClientPreview } from "@/pages/ClientPreview";
import { BudgetOverview } from "@/pages/BudgetOverview";
import { BudgetArtist } from "@/pages/BudgetArtist";
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

  return (
    <RoleProvider role={session.data.role}>
      <Switch>
        {/* Preview is the same light, sidebar-less review experience for both
            roles (admin additionally gets resolve + Ads Manager). */}
        <Route path="/preview" component={ClientPreview} />
        <Route path="/">{() => <Layout><Overview /></Layout>}</Route>
        <Route path="/okonomi">{() => <Layout><BudgetOverview /></Layout>}</Route>
        <Route path="/okonomi/:slug">
          {(params) => (
            <Layout>
              <BudgetArtist slug={params.slug} />
            </Layout>
          )}
        </Route>
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
