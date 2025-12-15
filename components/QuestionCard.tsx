import React, { useState, useEffect, useRef } from 'react';
import { Word, TaskType } from '../types';
import { Button } from './Button';
import { getExampleSentence, getExampleSentenceData } from '../data';

interface QuestionCardProps {
  word: Word;
  type: TaskType;
  options?: string[]; // For choice
  groupWords?: Word[]; // For Match game
  onAnswer: (correct: boolean) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ word, type, options, groupWords, onAnswer }) => {
  // General State
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hint, setHint] = useState(false);
  
  // Input State (Spell)
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Selection State (Choice/Assemble)
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Assemble State
  const [bubbleOptions, setBubbleOptions] = useState<string[]>([]);
  const [targetSentence, setTargetSentence] = useState('');

  // Scramble State
  const [scramblePool, setScramblePool] = useState<{id: string, text: string}[]>([]);
  const [scrambleSelected, setScrambleSelected] = useState<{id: string, text: string}[]>([]);
  const [targetSentenceCh, setTargetSentenceCh] = useState('');

  // Match State
  const [matchCards, setMatchCards] = useState<{id: string, content: string, type: 'en' | 'ch', wordId: number, isMatched: boolean}[]>([]);
  const [matchSelection, setMatchSelection] = useState<string[]>([]); // Array of card IDs
  const [matchesFound, setMatchesFound] = useState(0);

  useEffect(() => {
    resetState();

    // Auto-focus input for spelling
    if (type === TaskType.SPELL && inputRef.current) {
      inputRef.current.focus();
    }

    // Auto-play audio only for Word-focused tasks (Not sentences)
    if (type === TaskType.SPELL || type === TaskType.CHOICE || type === TaskType.LEARN) {
       const timeout = setTimeout(() => {
        playAudio();
      }, 300);
      return () => clearTimeout(timeout);
    }

    // Setup Logic based on Type
    if (type === TaskType.ASSEMBLE) {
      setupAssemble();
    } else if (type === TaskType.SCRAMBLE) {
      setupScramble();
    } else if (type === TaskType.MATCH && groupWords) {
      setupMatch();
    }

  }, [word, type, groupWords]);

  const resetState = () => {
    setInput('');
    setSelectedOption(null);
    setStatus('idle');
    setHint(false);
    setScrambleSelected([]);
    setMatchSelection([]);
    setMatchesFound(0);
  };

  const setupAssemble = () => {
    const sentence = getExampleSentence(word);
    setTargetSentence(sentence);
    const distractors = options || [];
    const bubbles = [word.english, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
    setBubbleOptions(bubbles);
  };

  const setupScramble = () => {
    const { english, chinese } = getExampleSentenceData(word);
    setTargetSentence(english);
    setTargetSentenceCh(chinese);

    // Split sentence into words, simple split, keeping punctuation in valid check but removing for tiles
    // We normalize to allow easier matching
    const rawParts = english.replace(/[.,?]/g, '').split(' ').filter(x => x);
    
    // Distractors
    const commonDistractors = ['is', 'the', 'not', 'very', 'a', 'to', 'for', 'it', 'he', 'she', 'but', 'and', 'my', 'your'];
    const validSet = new Set(rawParts.map(p => p.toLowerCase()));
    
    // Pick 2 distractors that are NOT in the sentence
    const distractors = commonDistractors
        .filter(d => !validSet.has(d.toLowerCase()))
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);

    const poolItems = [...rawParts, ...distractors].map((text, idx) => ({
        id: `tile-${idx}-${Math.random()}`,
        text: text
    }));
    
    setScramblePool(poolItems.sort(() => Math.random() - 0.5));
  };

  const setupMatch = () => {
    if (!groupWords) return;
    const cards: any[] = [];
    groupWords.forEach(w => {
        cards.push({ id: `en-${w.id}`, content: w.english, type: 'en', wordId: w.id, isMatched: false });
        cards.push({ id: `ch-${w.id}`, content: w.chinese, type: 'ch', wordId: w.id, isMatched: false });
    });
    setMatchCards(cards.sort(() => Math.random() - 0.5));
  };

  const playAudio = () => {
    const utterance = new SpeechSynthesisUtterance(word.english);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // --- Handlers ---

  const handleCorrect = () => {
    setStatus('correct');
    const audio = new Audio('https://codesandbox.io/static/sound/correct.mp3'); 
    audio.play().catch(() => {});
    setTimeout(() => onAnswer(true), 1000);
  };

  const handleWrong = (delay = 1500) => {
    setStatus('wrong');
    setTimeout(() => {
      setStatus('idle');
      if (type !== TaskType.MATCH) {
          onAnswer(false);
      } else {
          // For Match game, we don't fail the whole task immediately, just reset selection
          setMatchSelection([]);
      }
    }, delay);
  };

  // 1. Spell Handler
  const handleSubmitSpelling = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (status !== 'idle') return;
    const cleanInput = input.trim().toLowerCase();
    const cleanTarget = word.english.trim().toLowerCase();
    if (cleanInput === cleanTarget) handleCorrect();
    else handleWrong();
  };

  // 2. Choice Handler
  const handleOptionClick = (option: string) => {
    if (status !== 'idle') return;
    setSelectedOption(option);
    if (option === word.chinese) handleCorrect();
    else handleWrong();
  };

  // 3. Assemble Handler
  const handleAssembleClick = (bubbleWord: string) => {
    if (status !== 'idle') return;
    setSelectedOption(bubbleWord);
    if (bubbleWord === word.english) handleCorrect();
    else handleWrong();
  };

  // 4. Scramble Handler
  const handleScramblePoolClick = (item: {id: string, text: string}) => {
     if (status !== 'idle') return;
     setScramblePool(prev => prev.filter(i => i.id !== item.id));
     setScrambleSelected(prev => [...prev, item]);
  };

  const handleScrambleSelectedClick = (item: {id: string, text: string}) => {
     if (status !== 'idle') return;
     setScrambleSelected(prev => prev.filter(i => i.id !== item.id));
     setScramblePool(prev => [...prev, item]);
  };

  const checkScramble = () => {
      // Create strings stripped of punctuation and lowercase
      const normalize = (s: string) => s.replace(/[.,?!]/g, '').toLowerCase().split(' ').join('');
      
      const builtSentence = scrambleSelected.map(i => i.text).join(' ');
      
      if (normalize(builtSentence) === normalize(targetSentence)) handleCorrect();
      else handleWrong();
  };

  // 5. Match Handler
  const handleMatchCardClick = (cardId: string) => {
      if (status === 'wrong' || status === 'correct') return; // Wait
      
      const clickedCard = matchCards.find(c => c.id === cardId);
      if (!clickedCard || clickedCard.isMatched) return;
      if (matchSelection.includes(cardId)) return; // Already selected

      const newSelection = [...matchSelection, cardId];
      setMatchSelection(newSelection);

      if (newSelection.length === 2) {
          const card1 = matchCards.find(c => c.id === newSelection[0]);
          const card2 = matchCards.find(c => c.id === newSelection[1]);
          
          if (card1 && card2 && card1.wordId === card2.wordId) {
              // Match found
              setTimeout(() => {
                  setMatchCards(prev => prev.map(c => 
                      (c.id === card1.id || c.id === card2.id) ? { ...c, isMatched: true } : c
                  ));
                  setMatchSelection([]);
                  setMatchesFound(prev => {
                      const newVal = prev + 1;
                      if (groupWords && newVal >= groupWords.length) {
                          handleCorrect();
                      }
                      return newVal;
                  });
              }, 300);
          } else {
              // Mismatch
              setStatus('wrong');
              setTimeout(() => {
                  setStatus('idle');
                  setMatchSelection([]);
              }, 800);
          }
      }
  };

  // --- Renderers ---

  const renderHeader = () => {
     if (type === TaskType.MATCH) {
         return (
             <div className="bg-blue-600 p-6 text-white text-center">
                 <h2 className="text-xl font-bold">配對連連看</h2>
                 <p className="text-blue-200 text-sm">點擊卡片將英文與中文配對</p>
             </div>
         )
     }

     return (
        <div className="bg-blue-600 p-8 text-white text-center flex flex-col items-center justify-center relative min-h-[160px]">
            {/* Audio Button - Only for non-sentence tasks */}
            {(type === TaskType.SPELL || type === TaskType.CHOICE) && (
                <button 
                onClick={playAudio} 
                className="absolute top-4 right-4 p-2 bg-blue-500 rounded-full hover:bg-blue-400 transition-colors"
                title="Play Audio"
                >
                🔊
                </button>
            )}
            
            {type === TaskType.SPELL && (
            <>
                <span className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-2">拼字測驗</span>
                <h2 className="text-2xl font-bold mb-4">{word.chinese}</h2>
                <div className="text-blue-200 italic">{word.pos}</div>
            </>
            )}
            {type === TaskType.CHOICE && (
            <>
                <span className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-2">選擇正確意思</span>
                <h2 className="text-4xl font-bold mb-2">{word.english}</h2>
                <div className="text-blue-200 italic">{word.pos}</div>
            </>
            )}
            {(type === TaskType.ASSEMBLE || type === TaskType.SCRAMBLE) && (
                <>
                <span className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-2">
                    {type === TaskType.ASSEMBLE ? '填空練習' : '句子重組'}
                </span>
                <div className="w-16 h-16 bg-blue-400 rounded-full mb-2 flex items-center justify-center text-2xl">👩‍🏫</div>
                <div className="bg-white text-blue-900 px-4 py-2 rounded-xl text-lg font-bold shadow-sm relative">
                    {type === TaskType.ASSEMBLE 
                        ? `${word.chinese} (請填入單字)` 
                        : targetSentenceCh || `請重組句子`
                    }
                    <div className="absolute w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white top-[-8px] left-1/2 -translate-x-1/2"></div>
                </div>
                </>
            )}
        </div>
    );
  };

  return (
    <div className={`w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col ${type === TaskType.MATCH ? 'min-h-[500px]' : 'min-h-[450px]'}`}>
      {renderHeader()}

      <div className="p-6 flex-1 flex flex-col justify-center">
        
        {/* --- SPELLING --- */}
        {type === TaskType.SPELL && (
          <form onSubmit={handleSubmitSpelling} className="w-full">
            <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="輸入英文單字..."
                  className={`w-full text-center text-2xl p-4 border-2 rounded-xl outline-none transition-all ${
                    status === 'wrong' ? 'border-red-500 bg-red-50' : 
                    status === 'correct' ? 'border-green-500 bg-green-50' : 
                    'border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                  }`}
                  autoComplete="off"
                  spellCheck="false"
                />
            </div>
            
            <div className="mt-8 flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setHint(true)} className="flex-1 text-sm">
                💡 提示 ({word.english[0]}...)
              </Button>
              <Button type="submit" disabled={!input} className="flex-[2]">送出</Button>
            </div>
            {hint && <p className="text-center text-gray-400 mt-4 tracking-widest">{word.english.split('').map((c, i) => i % 2 === 0 ? c : '_').join(' ')}</p>}
          </form>
        )}

        {/* --- CHOICE --- */}
        {type === TaskType.CHOICE && options && (
          <div className="grid grid-cols-1 gap-3">
            {options.map((opt, idx) => {
              let btnStyle = "bg-gray-50 border-2 border-gray-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
              if (status !== 'idle') {
                if (opt === word.chinese) btnStyle = "bg-green-100 border-green-500 text-green-800 font-bold";
                else if (opt === selectedOption) btnStyle = "bg-red-100 border-red-500 text-red-800";
                else btnStyle = "opacity-40";
              }
              return (
                <button key={idx} onClick={() => handleOptionClick(opt)} disabled={status !== 'idle'} className={`p-4 rounded-xl text-left transition-all duration-200 ${btnStyle}`}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* --- ASSEMBLE (Cloze) --- */}
        {type === TaskType.ASSEMBLE && (
            <div className="flex flex-col h-full justify-between">
                <div className="text-xl text-center text-gray-700 font-medium mb-8 leading-relaxed">
                   {targetSentence.split(word.english).map((part, i, arr) => (
                       <React.Fragment key={i}>
                           {part}
                           {i < arr.length - 1 && (
                               <span className={`inline-block border-b-2 border-gray-400 px-2 min-w-[80px] text-center font-bold transition-all ${status === 'correct' ? 'text-green-600 border-green-500' : 'text-blue-600 border-blue-400'}`}>
                                   {selectedOption || '_______'}
                               </span>
                           )}
                       </React.Fragment>
                   ))}
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                    {bubbleOptions.map((opt, idx) => {
                         let bubbleStyle = "bg-white border-2 border-gray-200 shadow-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:scale-95";
                         if (status !== 'idle') {
                            if (opt === word.english) bubbleStyle = "bg-green-100 border-green-500 text-green-800 shadow-none";
                            else if (opt === selectedOption) bubbleStyle = "bg-red-100 border-red-500 text-red-800 shadow-none";
                            else bubbleStyle = "opacity-20 pointer-events-none";
                         }
                        return (
                            <button key={idx} onClick={() => handleAssembleClick(opt)} disabled={status !== 'idle'} className={`px-4 py-2 rounded-2xl text-lg font-medium transition-all ${bubbleStyle}`}>
                                {opt}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        {/* --- SCRAMBLE (Reorder) --- */}
        {type === TaskType.SCRAMBLE && (
            <div className="flex flex-col h-full justify-between">
                {/* Answer Area */}
                <div className="min-h-[60px] border-b-2 border-gray-200 mb-6 flex flex-wrap gap-2 items-end pb-2 justify-center">
                    {scrambleSelected.length === 0 && <span className="text-gray-300 text-sm mb-2">點擊下方單字組成句子</span>}
                    {scrambleSelected.map((item) => (
                         <button 
                            key={item.id} 
                            onClick={() => handleScrambleSelectedClick(item)}
                            className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-medium shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors"
                         >
                            {item.text}
                         </button>
                    ))}
                </div>

                {/* Pool Area */}
                <div className="flex flex-wrap gap-3 justify-center mb-8">
                    {scramblePool.map((item) => (
                        <button 
                            key={item.id} 
                            onClick={() => handleScramblePoolClick(item)}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            {item.text}
                        </button>
                    ))}
                </div>

                <Button onClick={checkScramble} disabled={status !== 'idle'} className="w-full">
                    檢查
                </Button>
                 {status === 'wrong' && <p className="text-center text-red-500 mt-2 font-bold animate-pulse">再試一次！</p>}
            </div>
        )}

        {/* --- MATCH (Grid) --- */}
        {type === TaskType.MATCH && (
            <div className="h-full">
                 <div className="grid grid-cols-3 gap-3 h-full">
                     {matchCards.map((card) => {
                         const isSelected = matchSelection.includes(card.id);
                         const isError = status === 'wrong' && isSelected;
                         
                         let style = "bg-white border-2 border-gray-200 text-gray-600";
                         if (card.isMatched) style = "opacity-0 pointer-events-none"; // Disappear
                         else if (isError) style = "bg-red-100 border-red-500 text-red-800 animate-pulse";
                         else if (isSelected) style = "bg-blue-100 border-blue-500 text-blue-800 shadow-inner";
                         else style += " hover:bg-gray-50 shadow-sm";

                         return (
                            <button
                                key={card.id}
                                onClick={() => handleMatchCardClick(card.id)}
                                className={`rounded-xl p-2 flex items-center justify-center text-sm font-bold transition-all aspect-[4/3] ${style}`}
                            >
                                {card.content}
                            </button>
                         )
                     })}
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};