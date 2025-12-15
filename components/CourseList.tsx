import React from 'react';
import { LessonStats } from '../types';
import { TOTAL_LESSONS } from '../data';

interface CourseListProps {
  currentLessonIndex: number;
  lessonStats: Record<number, LessonStats>;
  onSelectLesson: (index: number) => void;
  onBack: () => void;
}

export const CourseList: React.FC<CourseListProps> = ({ currentLessonIndex, lessonStats, onSelectLesson, onBack }) => {
  const lessons = Array.from({ length: TOTAL_LESSONS }, (_, i) => i);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-6">
            <button onClick={onBack} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full mr-4">←</button>
            <h1 className="text-2xl font-bold text-gray-800">課程地圖</h1>
        </div>

        <div className="grid grid-cols-3 gap-4">
            {lessons.map(idx => {
                const stats = lessonStats[idx];
                const isLocked = idx > currentLessonIndex && !stats?.isCompleted && idx !== currentLessonIndex; // Lock future lessons? Let's keep them open as per user request, or maybe just highlight current
                // User said "Can choose courses", so we won't strictly lock, but we can visually distinguish.
                
                const stars = stats?.stars || 0;
                
                return (
                    <button
                        key={idx}
                        onClick={() => onSelectLesson(idx)}
                        className={`aspect-square flex flex-col items-center justify-center rounded-2xl shadow-sm border-b-4 active:border-b-0 active:translate-y-1 transition-all
                            ${idx === currentLessonIndex ? 'bg-blue-500 border-blue-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}
                        `}
                    >
                        <span className="text-lg font-bold mb-1">{idx + 1}</span>
                        <div className="flex text-xs">
                            {[1, 2, 3].map(s => (
                                <span key={s} className={s <= stars ? 'text-yellow-300' : 'text-gray-300'}>★</span>
                            ))}
                        </div>
                    </button>
                )
            })}
        </div>
      </div>
    </div>
  );
};