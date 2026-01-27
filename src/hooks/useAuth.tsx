import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth] State changed:", event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            checkRoles(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setTenantId(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] Initial session:", session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkRoles = async (userId: string) => {
    try {
      // Check admin status
      const { data: adminData } = await supabase.rpc("is_admin");
      setIsAdmin(adminData === true);

      // Check super admin status
      const { data: superAdminData } = await supabase.rpc("is_super_admin");
      setIsSuperAdmin(superAdminData === true);

      // Get tenant_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();
      
      setTenantId(profile?.tenant_id ?? null);
    } catch (error) {
      console.error("[Auth] Error checking roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    console.log("[Auth] Signing out...");
    
    // Clear local state first
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setTenantId(null);
    
    // Sign out from Supabase (local scope to avoid 403 on expired sessions)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error("[Auth] Sign out error:", error);
    }
    
    console.log("[Auth] Sign out complete");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isSuperAdmin, tenantId, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
