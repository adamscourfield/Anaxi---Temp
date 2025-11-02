import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  isCreator: boolean;
  isAdminOrCreator: boolean;
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

  // Fetch user's memberships to check for Admin role
  const { data: memberships = [], isLoading: membershipsLoading } = useQuery<any[]>({
    queryKey: ['/api/all-memberships'],
    enabled: !!user,
    retry: false,
  });

  // Check if user has Creator global role
  const isCreator = user?.global_role === "Creator";

  // Check if user has Admin role in any school OR is Creator
  const isAdminOrCreator = isCreator || memberships.some((m: any) => m.role === "Admin");

  useEffect(() => {
    if (!userLoading && !membershipsLoading) {
      setIsLoading(false);
    }
  }, [userLoading, membershipsLoading]);

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
    <AuthContext.Provider value={{ user: user || null, isCreator, isAdminOrCreator, isLoading, logout }}>
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
