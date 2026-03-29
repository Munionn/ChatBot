"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { isGuestUser } from "@/lib/auth/session-context";
import { ANON_SESSION_STORAGE_KEY } from "@/lib/constants/chat";
import { chatKeys, messageKeys } from "@/lib/chat/query-keys";
import { parseGuestRemainingScalar } from "@/lib/guest-quota";
import { deferRouterAction } from "@/lib/next/defer-router-action";
import { authFetch } from "@/lib/supabase/fetch-with-session";
import { supabaseBrowser } from "@/lib/supabase/browser";

type SessionUser = {
  id: string;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type ChatSessionContextValue = {
  sessionUser: SessionUser | null;
  isGuest: boolean;
  isBootstrapping: boolean;
  remaining: number | null;
  refreshRemaining: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within ChatSessionProvider");
  }
  return ctx;
}

const AUTH_CHAIN_DELAY_MS = 75;

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const authChainRef = useRef(Promise.resolve());

  const enqueueAuth = useCallback((task: () => Promise<void>) => {
    const next = authChainRef.current.then(task, task);
    authChainRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }, []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const applyUser = useCallback((user: SessionUser) => {
    setSessionUser(user);
    setIsGuest(isGuestUser(user as User));
  }, []);

  const ensureGuestSession = useCallback(async () => {
    const {
      data: { session: preSession }
    } = await supabaseBrowser.auth.getSession();
    if (preSession?.user && !isGuestUser(preSession.user as User)) {
      applyUser(preSession.user as unknown as SessionUser);
      return;
    }

    const existingAnonId =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(ANON_SESSION_STORAGE_KEY)
        : null) ?? null;
    const anonId = existingAnonId ?? crypto.randomUUID();
    window.localStorage.setItem(ANON_SESSION_STORAGE_KEY, anonId);

    const { error } = await supabaseBrowser.auth.signInAnonymously({
      options: { data: { anon_session_id: anonId } }
    });
    if (error) throw error;

    const {
      data: { session: postSession }
    } = await supabaseBrowser.auth.getSession();
    if (postSession?.user && !isGuestUser(postSession.user as User)) {
      applyUser(postSession.user as unknown as SessionUser);
      return;
    }
    if (!postSession?.user) {
      throw new Error("Guest session did not initialize.");
    }

    applyUser(postSession.user as unknown as SessionUser);
  }, [applyUser]);

  const refreshRemaining = useCallback(async () => {
    if (!sessionUser) return;
    if (!isGuestUser(sessionUser as User)) {
      setRemaining(null);
      return;
    }
    const res = await authFetch("/api/guest/remaining");
    if (!res.ok) {
      setRemaining(null);
      return;
    }
    const body = (await res.json()) as { remaining?: unknown };
    setRemaining(parseGuestRemainingScalar(body.remaining));
  }, [sessionUser]);

  const signOut = useCallback(async () => {
    await enqueueAuth(async () => {
      queryClient.removeQueries({ queryKey: chatKeys.all });
      queryClient.removeQueries({ queryKey: messageKeys.all });

      try {
        const { error } = await supabaseBrowser.auth.signOut({ scope: "local" });
        if (error) {
          await supabaseBrowser.auth.signOut({ scope: "local" });
        }
      } catch {
        try {
          await supabaseBrowser.auth.signOut({ scope: "local" });
        } catch {
          /* lock noise — continue to guest bootstrap */
        }
      }

      try {
        await ensureGuestSession();
      } catch {
        await new Promise((r) => setTimeout(r, 200));
        try {
          await ensureGuestSession();
        } catch {
          setSessionUser(null);
          setIsGuest(false);
        }
      }

      setIsBootstrapping(false);

      deferRouterAction(() => {
        if (pathname?.startsWith("/chat/") && pathname.length > "/chat/".length) {
          router.replace("/chat");
        }
        router.refresh();
      });
    });
  }, [enqueueAuth, ensureGuestSession, pathname, queryClient, router]);

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription }
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (cancelled || event === "INITIAL_SESSION") return;

      if (session?.user) {
        applyUser(session.user as unknown as SessionUser);
        if (!cancelled) {
          setIsBootstrapping(false);
          deferRouterAction(() => router.refresh());
        }
        return;
      }

      void enqueueAuth(async () => {
        if (cancelled) return;
        try {
          await new Promise((r) => setTimeout(r, AUTH_CHAIN_DELAY_MS));
          if (cancelled) return;
          const {
            data: { session: checkSession }
          } = await supabaseBrowser.auth.getSession();
          if (cancelled) return;
          if (checkSession?.user) {
            applyUser(checkSession.user as unknown as SessionUser);
          } else {
            await ensureGuestSession();
          }
        } catch {
          if (!cancelled) {
            setSessionUser(null);
            setIsGuest(false);
          }
        } finally {
          if (!cancelled) {
            setIsBootstrapping(false);
            deferRouterAction(() => router.refresh());
          }
        }
      });
    });

    void (async () => {
      setIsBootstrapping(true);
      try {
        const {
          data: { session: firstSession }
        } = await supabaseBrowser.auth.getSession();
        if (cancelled) return;

        if (!firstSession?.user) {
          await ensureGuestSession();
        } else {
          try {
            await supabaseBrowser.auth.getUser();
          } catch {
            /* offline / transient */
          }
          const {
            data: { session: afterSession }
          } = await supabaseBrowser.auth.getSession();
          if (cancelled) return;
          if (!afterSession?.user) {
            await supabaseBrowser.auth.signOut({ scope: "local" });
            await ensureGuestSession();
          } else {
            applyUser(afterSession.user as unknown as SessionUser);
          }
        }
      } catch {
        if (!cancelled) {
          try {
            await ensureGuestSession();
          } catch {
          }
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
          deferRouterAction(() => router.refresh());
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyUser, enqueueAuth, ensureGuestSession, router]);

  useEffect(() => {
    if (!sessionUser || !isGuest) return;
    let cancelled = false;
    void (async () => {
      const res = await authFetch("/api/guest/remaining");
      if (cancelled) return;
      if (!res.ok) {
        setRemaining(null);
        return;
      }
      const body = (await res.json()) as { remaining?: unknown };
      setRemaining(parseGuestRemainingScalar(body.remaining));
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUser, isGuest]);

  const value = useMemo(
    () => ({
      sessionUser,
      isGuest,
      isBootstrapping,
      remaining: isGuest ? remaining : null,
      refreshRemaining,
      signOut
    }),
    [sessionUser, isGuest, isBootstrapping, remaining, refreshRemaining, signOut]
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}
