import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
    // Update localStorage with the full user object for immediate UI updates
    localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    // This will trigger a re-render with the updated user data
    setCurrentUserId(updatedUser.id);
  };

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem("currentUserId", currentUserId);
    } else {
      localStorage.removeItem("currentUserId");
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }
  }, [currentUser]);

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
