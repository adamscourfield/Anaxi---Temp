import { TeacherTable } from '../teacher-table'

export default function TeacherTableExample() {
  const teachers = [
    { id: '1', name: 'Sarah Mitchell', initials: 'SM', email: 's.mitchell@school.edu', department: 'Mathematics', observationCount: 12 },
    { id: '2', name: 'James Chen', initials: 'JC', email: 'j.chen@school.edu', department: 'Science', observationCount: 8 },
    { id: '3', name: 'Emily Rodriguez', initials: 'ER', email: 'e.rodriguez@school.edu', department: 'English', observationCount: 15 },
    { id: '4', name: 'Michael Thompson', initials: 'MT', email: 'm.thompson@school.edu', department: 'History', observationCount: 6 },
  ];

  return (
    <div className="p-6">
      <TeacherTable
        teachers={teachers}
        onEdit={(teacher) => console.log('Edit teacher:', teacher)}
        onDelete={(teacher) => console.log('Delete teacher:', teacher)}
      />
    </div>
  )
}
