import { StatCard } from '../stat-card'
import { Eye, Users, ClipboardCheck } from "lucide-react"

export default function StatCardExample() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        title="Total Observations" 
        value="24" 
        icon={Eye}
        description="This month"
      />
      <StatCard 
        title="Active Teachers" 
        value="18" 
        icon={Users}
        description="In your school"
      />
      <StatCard 
        title="Avg. Score" 
        value="4.2" 
        icon={ClipboardCheck}
        description="Out of 5"
      />
    </div>
  )
}
