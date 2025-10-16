import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Teacher } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  currentUser: Teacher | null;
  isCreator: boolean;
  isLoading: boolean;
  logout: () => void;
  setCurrentUser: (user: Teacher) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SCHOOL_ID = "3d629223-97f8-4d33-8e7e-974bbbf156b8"; // TODO: Make this dynamic

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });

  // Fetch teacher profile for the authenticated user
  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers", SCHOOL_ID],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${SCHOOL_ID}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
  });

  // Find the teacher profile for the current user
  const currentUser = user && teachers ? teachers.find(t => t.userId === user.id) || null : null;
  
  // Check if user has Creator global role
  const isCreator = user?.global_role === "Creator";

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

  const setCurrentUser = (updatedUser: Teacher) => {
    // Update the teachers cache immediately for instant UI updates
    queryClient.setQueryData<Teacher[]>(["/api/teachers", SCHOOL_ID], (oldTeachers) => {
      if (!oldTeachers) return [updatedUser];
      return oldTeachers.map((teacher) =>
        teacher.id === updatedUser.id ? updatedUser : teacher
      );
    });
  };

  return (
    <AuthContext.Provider value={{ user: user || null, currentUser, isCreator, isLoading, logout, setCurrentUser }}>
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
