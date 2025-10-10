import { HabitChecklist } from '../habit-checklist'
import { useState } from 'react'

export default function HabitChecklistExample() {
  const [checkedHabits, setCheckedHabits] = useState<string[]>([]);

  const category = {
    id: '1',
    name: 'Entrance and Do Now',
    habits: [
      {
        id: 'h1',
        text: 'Do Now on board or distributed.',
        description: 'Ensure your "Do Now" task is already displayed or handed out before students arrive.'
      },
      {
        id: 'h2',
        text: 'Uniforms checked and corrected silently.',
        description: 'Quietly scan each pupil\'s uniform as they enter and use discreet gestures or a brief prompt.'
      },
      {
        id: 'h3',
        text: 'Teacher positioned at threshold, greeting each pupil.',
        description: 'Make sure you stand at the classroom door and personally welcome every student.'
      },
      {
        id: 'h4',
        text: 'Countdown used.',
        description: 'Start a clear countdown (e.g., "20…19…18…") as soon as everyone is in.'
      },
    ]
  };

  const toggleHabit = (id: string) => {
    setCheckedHabits(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 max-w-2xl">
      <HabitChecklist
        category={category}
        checkedHabits={checkedHabits}
        onToggleHabit={toggleHabit}
      />
    </div>
  )
}
