import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, setAccessToken, setSessionExpiredHandler } from "./api";
import type { LoginInput, RegisterStudentInput, RegisterTeacherInput, SafeUser } from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: SafeUser | null;
  login: (input: LoginInput) => Promise<SafeUser>;
  registerStudent: (input: RegisterStudentInput) => Promise<SafeUser>;
  registerTeacher: (input: RegisterTeacherInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  // Any 401 from a refresh attempt (e.g. token revoked/expired) ends the session.
  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  // Bootstrap: the access token is memory-only, so on a fresh page load the only
  // way back in is the httpOnly refresh cookie. No cookie = anonymous.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await authApi.refresh();
        if (cancelled) return;
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus("authenticated");
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setStatus("anonymous");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await authApi.login(input);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const registerStudent = useCallback(async (input: RegisterStudentInput) => {
    const { user } = await authApi.registerStudent(input);
    return user;
  }, []);

  // Teachers self-register and are auto-approved — they can sign in immediately.
  const registerTeacher = useCallback(async (input: RegisterTeacherInput) => {
    const { user } = await authApi.registerTeacher(input);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, user, login, registerStudent, registerTeacher, logout }),
    [status, user, login, registerStudent, registerTeacher, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
