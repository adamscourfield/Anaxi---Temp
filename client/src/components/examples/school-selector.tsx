import { SchoolSelector } from '../school-selector'
import { useState } from 'react'

export default function SchoolSelectorExample() {
  const [selected, setSelected] = useState('1');

  const schools = [
    { id: '1', name: 'Springdale Academy' },
    { id: '2', name: 'Riverside High School' },
    { id: '3', name: 'Oakmont College' },
  ];

  return (
    <div className="p-6">
      <SchoolSelector
        schools={schools}
        selectedSchool={selected}
        onSelectSchool={setSelected}
      />
    </div>
  )
}
