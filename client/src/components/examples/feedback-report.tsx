import { FeedbackReport } from '../feedback-report'

export default function FeedbackReportExample() {
  const categories = [
    {
      name: 'Entrance and Do Now',
      score: 5,
      maxScore: 7,
      habits: [
        { text: 'Do Now on board or distributed.', description: '', observed: true },
        { text: 'Uniforms checked and corrected silently.', description: 'Quietly scan each pupil\'s uniform as they enter.', observed: false },
        { text: 'Teacher positioned at threshold.', description: '', observed: true },
        { text: 'Countdown used.', description: '', observed: true },
        { text: 'Students working within 20 seconds.', description: '', observed: true },
        { text: 'Exercise books handed out.', description: 'Confirm that your two pre-assigned book-handlers distribute books.', observed: false },
        { text: 'All students seated silently within 5 seconds.', description: '', observed: true },
      ]
    },
    {
      name: 'Direct Instruction',
      score: 3,
      maxScore: 4,
      habits: [
        { text: 'One clear strategy of instruction is being used.', description: '', observed: true },
        { text: 'Pupils are actively participating.', description: '', observed: true },
        { text: 'Modelling is visible and structured.', description: '', observed: true },
        { text: 'Teacher checks for understanding.', description: 'Cold-call different students regularly.', observed: false },
      ]
    }
  ];

  return (
    <div className="p-6 max-w-4xl">
      <FeedbackReport
        teacherName="Sarah Mitchell"
        teacherInitials="SM"
        observerName="Rachel Johnson"
        date={new Date(2025, 9, 8)}
        categories={categories}
        totalScore={8}
        totalMaxScore={11}
      />
    </div>
  )
}
