import React, { useState } from 'react';
import { Word } from '../types';
import { Button } from './Button';

interface WordCardProps {
  word: Word;
  isFlipped: boolean;
  onFlip: () => void;
}

export const WordCard: React.FC<WordCardProps> = ({ word, isFlipped, onFlip }) => {
  
  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const utterance = new SpeechSynthesisUtterance(word.english);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="w-full max-w-md h-80 cursor-pointer mb-6" onClick={onFlip}>
      <div className={`card-flip w-full h-full ${isFlipped ? 'flipped' : ''}`}>
        <div className="card-inner w-full h-full shadow-xl rounded-2xl bg-white border border-gray-100">
          
          {/* Front */}
          <div className="card-front">
            <h2 className="text-4xl font-bold text-gray-800 mb-2">{word.english}</h2>
            <span className="text-gray-500 italic mb-6">{word.pos}</span>
            <Button variant="secondary" onClick={playAudio} className="rounded-full w-12 h-12 flex items-center justify-center p-0">
               🔊
            </Button>
            <p className="absolute bottom-4 text-gray-400 text-sm animate-pulse">點擊翻牌</p>
          </div>

          {/* Back */}
          <div className="card-back bg-blue-50 border-2 border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 mb-2">{word.english}</h2>
             <span className="text-blue-600 italic mb-4">{word.pos}</span>
            <div className="w-16 h-1 bg-blue-200 rounded mb-4"></div>
            <p className="text-3xl text-gray-800 font-medium px-4">{word.chinese}</p>
          </div>

        </div>
      </div>
    </div>
  );
};