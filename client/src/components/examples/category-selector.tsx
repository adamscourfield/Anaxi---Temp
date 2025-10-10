import { CategorySelector } from '../category-selector'
import { useState } from 'react'

export default function CategorySelectorExample() {
  const [selected, setSelected] = useState<string[]>([]);

  const categories = [
    { id: '1', name: 'Entrance and Do Now', habitCount: 7 },
    { id: '2', name: 'Direct Instruction', habitCount: 4 },
    { id: '3', name: 'Checking for Understanding', habitCount: 4 },
    { id: '4', name: 'Application', habitCount: 4 },
    { id: '5', name: 'Exit Routine', habitCount: 5 },
    { id: '6', name: 'Behaviour Routines', habitCount: 5 },
  ];

  const toggleCategory = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6">
      <CategorySelector
        categories={categories}
        selectedCategories={selected}
        onToggleCategory={toggleCategory}
      />
    </div>
  )
}
