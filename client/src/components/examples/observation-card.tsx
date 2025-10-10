import { ObservationCard } from '../observation-card'

export default function ObservationCardExample() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <ObservationCard
        teacherName="Sarah Mitchell"
        teacherInitials="SM"
        date={new Date(2025, 9, 8)}
        categories={["Entrance and Do Now", "Direct Instruction", "Pace and Presence"]}
        score={18}
        maxScore={20}
        onView={() => console.log('View observation clicked')}
      />
      <ObservationCard
        teacherName="James Chen"
        teacherInitials="JC"
        date={new Date(2025, 9, 5)}
        categories={["Behaviour Routines", "Academic Talk"]}
        score={12}
        maxScore={15}
        onView={() => console.log('View observation clicked')}
      />
      <ObservationCard
        teacherName="Emily Rodriguez"
        teacherInitials="ER"
        date={new Date(2025, 9, 3)}
        categories={["Application", "Exit Routine"]}
        score={9}
        maxScore={10}
        onView={() => console.log('View observation clicked')}
      />
    </div>
  )
}
