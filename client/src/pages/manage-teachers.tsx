import { TeacherTable } from "@/components/teacher-table";
import { AddTeacherDialog } from "@/components/add-teacher-dialog";
import { ImportTeachersDialog } from "@/components/import-teachers-dialog";

const teachers = [
  {
    id: "1",
    name: "Sarah Mitchell",
    initials: "SM",
    email: "s.mitchell@school.edu",
    department: "Mathematics",
    observationCount: 12,
  },
  {
    id: "2",
    name: "James Chen",
    initials: "JC",
    email: "j.chen@school.edu",
    department: "Science",
    observationCount: 8,
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    initials: "ER",
    email: "e.rodriguez@school.edu",
    department: "English",
    observationCount: 15,
  },
  {
    id: "4",
    name: "Michael Thompson",
    initials: "MT",
    email: "m.thompson@school.edu",
    department: "History",
    observationCount: 6,
  },
  {
    id: "5",
    name: "Lisa Anderson",
    initials: "LA",
    email: "l.anderson@school.edu",
    department: "Arts",
    observationCount: 10,
  },
];

export default function ManageTeachers() {
  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Teachers</h1>
          <p className="text-muted-foreground mt-1">
            Add and manage teachers in your school
          </p>
        </div>
        <div className="flex gap-2">
          <ImportTeachersDialog />
          <AddTeacherDialog />
        </div>
      </div>

      <TeacherTable
        teachers={teachers}
        onEdit={(teacher) => console.log("Edit teacher:", teacher)}
        onDelete={(teacher) => console.log("Delete teacher:", teacher)}
      />
    </div>
  );
}
