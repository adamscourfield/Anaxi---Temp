import { useQuery } from "@tanstack/react-query";
import { useSchool } from "./use-school";
import { useAuth } from "./use-auth";
import type { Teacher } from "@shared/schema";

/**
 * Hook to fetch teachers for the current school
 */
export function useSchoolTeachers() {
  const { currentSchoolId } = useSchool();
  const { user } = useAuth();

  return useQuery<Teacher[]>({
    queryKey: ["/api/teachers", currentSchoolId],
    enabled: !!user && !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
  });
}

/**
 * Hook to get the current user's teacher profile in the current school
 */
export function useCurrentTeacher() {
  const { user } = useAuth();
  const { data: teachers = [], isLoading } = useSchoolTeachers();

  const currentTeacher = teachers.find(t => t.userId === user?.id) || null;

  return { currentTeacher, isLoading };
}
