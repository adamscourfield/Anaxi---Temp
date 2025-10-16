import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface School {
  id: string;
  name: string;
}

interface SchoolMembership {
  id: string;
  userId: string;
  schoolId: string;
  role: string;
  school: School;
}

interface SchoolContextType {
  currentSchoolId: string | null;
  schools: School[];
  isLoading: boolean;
  hasNoSchools: boolean;
  setCurrentSchoolId: (schoolId: string) => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user, isCreator, isLoading: authLoading } = useAuth();
  const [currentSchoolId, setCurrentSchoolIdState] = useState<string | null>(null);

  // Fetch user's school memberships
  const { data: memberships = [], isLoading: membershipsLoading } = useQuery<SchoolMembership[]>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user && !isCreator && !authLoading,
    queryFn: async () => {
      const response = await fetch("/api/my-memberships");
      if (!response.ok) throw new Error("Failed to fetch memberships");
      return response.json();
    },
  });

  // Fetch all schools for Creators
  const { data: allSchools = [], isLoading: schoolsLoading } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !!user && isCreator && !authLoading,
    queryFn: async () => {
      const response = await fetch("/api/schools");
      if (!response.ok) throw new Error("Failed to fetch schools");
      return response.json();
    },
  });

  // Extract schools from memberships or use all schools for Creators
  const schools = isCreator ? allSchools : memberships.map(m => m.school);
  const isLoading = authLoading || (isCreator ? schoolsLoading : membershipsLoading);

  // Check if user has no schools after loading completes
  const hasNoSchools = !authLoading && !isLoading && !!user && schools.length === 0;

  // Initialize school from localStorage or first available school
  useEffect(() => {
    // Wait for auth and schools to load
    if (authLoading || isLoading || !user) return;

    // If no schools, clear any saved school ID
    if (schools.length === 0) {
      setCurrentSchoolIdState(null);
      localStorage.removeItem("currentSchoolId");
      return;
    }

    const savedSchoolId = localStorage.getItem("currentSchoolId");
    
    // Check if saved school is in user's schools
    const savedSchoolExists = schools.find(s => s.id === savedSchoolId);
    
    if (savedSchoolExists) {
      setCurrentSchoolIdState(savedSchoolId);
    } else {
      // Default to first school
      setCurrentSchoolIdState(schools[0].id);
      localStorage.setItem("currentSchoolId", schools[0].id);
    }
  }, [authLoading, user, schools, isLoading]);

  const setCurrentSchoolId = (schoolId: string) => {
    setCurrentSchoolIdState(schoolId);
    localStorage.setItem("currentSchoolId", schoolId);
  };

  return (
    <SchoolContext.Provider
      value={{
        currentSchoolId,
        schools,
        isLoading,
        hasNoSchools,
        setCurrentSchoolId,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error("useSchool must be used within a SchoolProvider");
  }
  return context;
}
