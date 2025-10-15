import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!userLoading) {
      setIsLoading(false);
    }
  }, [userLoading]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/user'], null);
      window.location.href = '/';
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
