import { createContext, useContext } from "react";
import type { Role } from "@shared/types";

const RoleCtx = createContext<Role>("admin");

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleCtx.Provider value={role}>{children}</RoleCtx.Provider>;
}

export function useRole(): Role {
  return useContext(RoleCtx);
}

/** True in the client-facing version (spend/metrics hidden). */
export function useIsClient(): boolean {
  return useContext(RoleCtx) === "client";
}
