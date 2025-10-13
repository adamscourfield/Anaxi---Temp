import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Teacher } from "@shared/schema";

interface AuthContextType {
  currentUser: Teacher | null;
  isLoading: boolean;
  setCurrentUserId: (userId: string | null) => void;
  setCurrentUser: (user: Teacher) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SCHOOL_ID = "3d629223-97f8-4d33-8e7e-974bbbf156b8";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem("currentUserId");
  });

  const { data: teachers = [], isLoading: teachersLoading } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers", SCHOOL_ID],
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${SCHOOL_ID}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
  });

  const currentUser = currentUserId ? teachers.find(t => t.id === currentUserId) || null : null;

  const setCurrentUser = (updatedUser: Teacher) => {
    // Update the teachers cache immediately for instant UI updates
    queryClient.setQueryData<Teacher[]>(["/api/teachers", SCHOOL_ID], (oldTeachers) => {
      if (!oldTeachers) return [updatedUser];
      return oldTeachers.map((teacher) =>
        teacher.id === updatedUser.id ? updatedUser : teacher
      );
    });
  };

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem("currentUserId", currentUserId);
    } else {
      localStorage.removeItem("currentUserId");
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId && teachers.length > 0) {
      const adminUser = teachers.find(t => t.role === "Admin");
      if (adminUser) {
        setCurrentUserId(adminUser.id);
      }
    }
  }, [teachers, currentUserId]);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading: teachersLoading, setCurrentUserId, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
