import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Word, UserProgress, WordStats, AppState, Task, TaskType, WORDS_PER_LESSON, LessonStats } from './types';
import { WORD_LIST, TOTAL_LESSONS } from './data';
import { Button } from './components/Button';
import { WordCard } from './components/WordCard';
import { QuestionCard } from './components/QuestionCard';
import { CourseList } from './components/CourseList';

// --- Local Storage Helpers ---
const STORAGE_KEY = 'voc_master_pro_v3'; 

const getInitialProgress = (): UserProgress => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        currentLessonIndex: 0,
        completedWordIds: [],
        wordStats: {},
        lessonStats: {},
        lastStudyDate: Date.now(),
        totalXp: 0,
        dayStreak: 0,
        reminderEnabled: false,
        reminderTime: "20:00",
        ...parsed
      };
    } catch (e) {
      console.error("Failed to parse progress", e);
    }
  }
  return {
    currentLessonIndex: 0,
    completedWordIds: [],
    wordStats: {},
    lessonStats: {},
    lastStudyDate: Date.now(),
    totalXp: 0,
    dayStreak: 0,
    reminderEnabled: false,
    reminderTime: "20:00",
  };
};

type SessionMode = 'LESSON' | 'REVIEW';

const App: React.FC = () => {
  const [progress, setProgress] = useState<UserProgress>(getInitialProgress());
  const [appState, setAppState] = useState<AppState>(AppState.DASHBOARD);
  
  // --- Session State ---
  const [sessionMode, setSessionMode] = useState<SessionMode>('LESSON');
  const [taskQueue, setTaskQueue] = useState<Task[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [sessionXpGained, setSessionXpGained] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false); // For LEARN cards
  const [sessionErrors, setSessionErrors] = useState(0);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  // --- Reminder Logic ---
  useEffect(() => {
    // Request permission on load if enabled but not granted
    if (progress.reminderEnabled && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    const checkReminder = () => {
        if (!progress.reminderEnabled) return;
        
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // Simple check: matches time and seconds is roughly 0 (to avoid multiple triggers)
        // Since setInterval is 10s, we check if it matches the minute and we haven't triggered yet today (optimization omitted for simplicity, relying on browser throttling)
        // Better: Check if we haven't notified yet today.
        
        const lastNotified = localStorage.getItem('last_reminder_date');
        const todayStr = now.toDateString();

        if (currentTime === progress.reminderTime && lastNotified !== todayStr) {
            if (Notification.permission === 'granted') {
                new Notification("背單字時間到囉！🎓", {
                    body: "每天半小時，積少成多！快回來 VocabMaster 練習今天的單字吧。",
                    icon: "https://cdn-icons-png.flaticon.com/512/3429/3429149.png"
                });
                localStorage.setItem('last_reminder_date', todayStr);
            }
        }
    };

    const interval = setInterval(checkReminder, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [progress.reminderEnabled, progress.reminderTime]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        alert("您的瀏覽器不支援通知功能");
        return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
        // Test notification
        new Notification("通知設定成功！", { body: "我們將會在指定時間提醒您背單字。" });
    }
  };


  // --- Helpers ---
  const getWordStats = (id: number): WordStats => {
    return progress.wordStats[id] || { wordId: id, box: 0, nextReviewDate: 0, consecutiveCorrect: 0 };
  };

  const getNextReviewTime = (box: number): number => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const intervals = [1, 2, 4, 7, 14, 30];
    const daysToAdd = intervals[Math.min(box, intervals.length - 1)];
    return now + (daysToAdd * oneDay);
  };

  const generateOptions = (correctWord: Word, count: number = 3): string[] => {
    const detractors = WORD_LIST
      .filter(w => w.id !== correctWord.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
    return [correctWord, ...detractors].sort(() => Math.random() - 0.5).map(w => w.chinese);
  };
  
  const generateDistractorWords = (correctWord: Word): string[] => {
     const detractors = WORD_LIST
      .filter(w => w.id !== correctWord.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return detractors.map(w => w.english);
  };

  // --- Session Logic: Normal Lesson ---
  const startSession = (specificLessonIndex?: number) => {
    const tasks: Task[] = [];
    let uniqueWordIdCounter = 0;
    const generateId = () => `task-${Date.now()}-${uniqueWordIdCounter++}`;

    const lessonIdx = specificLessonIndex !== undefined ? specificLessonIndex : progress.currentLessonIndex;
    
    // 1. New Words from Target Lesson
    const startIdx = lessonIdx * WORDS_PER_LESSON;
    const newWords = WORD_LIST.slice(startIdx, startIdx + WORDS_PER_LESSON);
    
    // Phase 1: Passive Learn
    newWords.forEach(word => tasks.push({ id: generateId(), word, type: TaskType.LEARN }));
    
    // Phase 2: Recognition
    newWords.forEach(word => tasks.push({ id: generateId(), word, type: TaskType.CHOICE }));
    
    // Phase 3: Fill in Blank (Assemble)
    newWords.forEach(word => tasks.push({ id: generateId(), word, type: TaskType.ASSEMBLE }));
    
    // Phase 4: Production (Spell)
    newWords.forEach(word => tasks.push({ id: generateId(), word, type: TaskType.SPELL }));

    // Phase 5: Sentence Scramble (Harder than Assemble)
    const scrambleWords = [...newWords].sort(() => Math.random() - 0.5).slice(0, 3);
    scrambleWords.forEach(word => tasks.push({ id: generateId(), word, type: TaskType.SCRAMBLE }));

    const p2 = tasks.filter(t => t.type === TaskType.CHOICE).sort(() => Math.random() - 0.5);
    const p3 = tasks.filter(t => t.type === TaskType.ASSEMBLE).sort(() => Math.random() - 0.5);
    const p4 = tasks.filter(t => t.type === TaskType.SPELL).sort(() => Math.random() - 0.5);
    const p5 = tasks.filter(t => t.type === TaskType.SCRAMBLE).sort(() => Math.random() - 0.5);
    
    const finalQueue = [
        ...tasks.filter(t => t.type === TaskType.LEARN),
        ...p2,
        ...p3,
        ...p4,
        ...p5
    ];

    // Phase 6: Final Match Review (All 6 words)
    finalQueue.push({
        id: generateId(),
        word: newWords[0], // Placeholder
        type: TaskType.MATCH,
        groupWords: newWords
    });

    setTaskQueue(finalQueue);
    setCurrentTaskIndex(0);
    setCombo(0);
    setSessionXpGained(0);
    setSessionErrors(0);
    setIsFlipped(false);
    setSessionMode('LESSON');
    
    if (specificLessonIndex !== undefined) {
        setProgress(p => ({...p, currentLessonIndex: specificLessonIndex}));
    }
    
    setAppState(AppState.SESSION);
  };

  // --- Session Logic: Smart Review ---
  const startReviewSession = () => {
    const now = Date.now();
    let uniqueWordIdCounter = 0;
    const generateId = () => `task-review-${Date.now()}-${uniqueWordIdCounter++}`;

    const candidateIds = new Set([...progress.completedWordIds, ...Object.keys(progress.wordStats).map(Number)]);
    
    if (candidateIds.size === 0) {
        alert("目前還沒有學過的單字可以複習喔！請先開始課程。");
        return;
    }

    const candidates = WORD_LIST.filter(w => candidateIds.has(w.id));

    const sortedCandidates = candidates.sort((a, b) => {
        const statsA = getWordStats(a.id);
        const statsB = getWordStats(b.id);
        const isDueA = statsA.nextReviewDate <= now;
        const isDueB = statsB.nextReviewDate <= now;
        if (isDueA && !isDueB) return -1;
        if (!isDueA && isDueB) return 1;
        if (statsA.box !== statsB.box) return statsA.box - statsB.box;
        return 0.5 - Math.random();
    });

    const sessionWords = sortedCandidates.slice(0, 12); 
    const tasks: Task[] = [];

    sessionWords.forEach(word => {
        const stats = getWordStats(word.id);
        
        if (stats.box <= 1) {
             tasks.push({ id: generateId(), word, type: TaskType.LEARN }); 
             tasks.push({ id: generateId(), word, type: TaskType.ASSEMBLE });
        } else if (stats.box <= 3) {
             tasks.push({ id: generateId(), word, type: TaskType.SCRAMBLE });
             tasks.push({ id: generateId(), word, type: TaskType.SPELL });
        } else {
             tasks.push({ id: generateId(), word, type: TaskType.SPELL });
        }
    });
    
    if (sessionWords.length >= 6) {
        tasks.push({
            id: generateId(),
            word: sessionWords[0],
            type: TaskType.MATCH,
            groupWords: sessionWords.slice(0, 6)
        });
    }

    setTaskQueue(tasks);
    setCurrentTaskIndex(0);
    setCombo(0);
    setSessionXpGained(0);
    setSessionErrors(0);
    setIsFlipped(false);
    setSessionMode('REVIEW');
    
    setAppState(AppState.SESSION);
  };

  // --- Interaction Logic ---
  const handleTaskComplete = (success: boolean) => {
    const currentTask = taskQueue[currentTaskIndex];
    const wordId = currentTask.word.id;
    
    let xpGain = 0;

    if (success) {
      setCombo(c => c + 1);
      xpGain = 10 + (combo * 2);
      
      if (!currentTask.isRetry && currentTask.type !== TaskType.MATCH) {
        setProgress(prev => {
          const oldStat = getWordStats(wordId);
          let newBox = oldStat.box;
          if (currentTask.type !== TaskType.LEARN) {
             newBox = Math.min(newBox + 1, 5);
          }
          return {
            ...prev,
            wordStats: {
              ...prev.wordStats,
              [wordId]: {
                ...oldStat,
                box: newBox,
                consecutiveCorrect: oldStat.consecutiveCorrect + 1,
                nextReviewDate: getNextReviewTime(newBox)
              }
            }
          };
        });
      }

    } else {
      setCombo(0);
      xpGain = 0;
      setSessionErrors(e => e + 1);

      if (currentTask.type !== TaskType.MATCH) {
        setProgress(prev => {
            const oldStat = getWordStats(wordId);
            return {
            ...prev,
            wordStats: {
                ...prev.wordStats,
                [wordId]: { ...oldStat, box: 0, consecutiveCorrect: 0, nextReviewDate: Date.now() }
            }
            };
        });
      
        // Insert Retry
        setTaskQueue(prev => {
            const remaining = prev.slice(currentTaskIndex + 1);
            const penaltyLearn: Task = { 
                id: `retry-learn-${Date.now()}`, 
                word: currentTask.word, 
                type: TaskType.LEARN, 
                isRetry: true 
            };
            const retryType = currentTask.type === TaskType.SCRAMBLE ? TaskType.ASSEMBLE : currentTask.type;
            const penaltyRetry: Task = { 
                id: `retry-action-${Date.now()}`, 
                word: currentTask.word, 
                type: retryType,
                isRetry: true 
            };

            const newQueue = [...remaining];
            newQueue.splice(0, 0, penaltyLearn);
            newQueue.splice(2, 0, penaltyRetry); 
            return [...prev.slice(0, currentTaskIndex + 1), ...newQueue];
        });
      }
    }

    setSessionXpGained(prev => prev + xpGain);

    if (currentTaskIndex < taskQueue.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      finishSession();
    }
  };

  const finishSession = () => {
    const tasksCount = taskQueue.filter(t => !t.isRetry && t.type !== TaskType.LEARN).length;
    let stars = 1;
    if (sessionErrors === 0) stars = 3;
    else if (sessionErrors <= tasksCount * 0.1) stars = 2;

    setProgress(prev => {
      // Update Streak
      const lastDate = new Date(prev.lastStudyDate);
      const today = new Date();
      const isSameDay = lastDate.getDate() === today.getDate() && lastDate.getMonth() === today.getMonth();
      const isYesterday = (today.getTime() - lastDate.getTime()) < (48 * 60 * 60 * 1000) && !isSameDay;

      let newStreak = prev.dayStreak;
      if (isYesterday) newStreak += 1;
      else if (!isSameDay) newStreak = 1;

      // Update Lesson Stats
      let newLessonStats = { ...prev.lessonStats };
      let newCompletedIds = [...prev.completedWordIds];

      if (sessionMode === 'LESSON') {
         const currentLessonStats = prev.lessonStats[prev.currentLessonIndex] || { lessonIndex: prev.currentLessonIndex, stars: 0, isCompleted: false };
         newLessonStats[prev.currentLessonIndex] = {
             ...currentLessonStats,
             stars: Math.max(currentLessonStats.stars, stars),
             isCompleted: true
         };
         
         const newWordIds = taskQueue
            .filter(t => t.type === TaskType.LEARN && !t.isRetry)
            .map(t => t.word.id);
         newCompletedIds = [...new Set([...newCompletedIds, ...newWordIds])];
      }

      return {
        ...prev,
        completedWordIds: newCompletedIds,
        lastStudyDate: Date.now(),
        totalXp: prev.totalXp + sessionXpGained,
        dayStreak: newStreak,
        lessonStats: newLessonStats
      };
    });

    setAppState(AppState.SUMMARY);
  };

  // --- RENDERERS ---

  const renderDashboard = () => (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-6 pb-20">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div>
             <h1 className="text-3xl font-bold text-gray-800">Hi, 學習者</h1>
             <p className="text-gray-500">準備好今天的挑戰了嗎？</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setAppState(AppState.SETTINGS)} className="p-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-blue-500 transition-colors">
                ⚙️
             </button>
             <div className="text-right">
                <div className="text-2xl font-bold text-orange-500">🔥 {progress.dayStreak}</div>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-md grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-2xl">
                <div className="text-3xl font-bold text-blue-600">{progress.totalXp}</div>
                <div className="text-xs text-blue-400 font-bold uppercase tracking-wide">總經驗值 (XP)</div>
            </div>
             <div className="text-center p-4 bg-purple-50 rounded-2xl">
                <div className="text-3xl font-bold text-purple-600">{progress.completedWordIds.length}</div>
                <div className="text-xs text-purple-400 font-bold uppercase tracking-wide">已精通單字</div>
            </div>
        </div>

        {/* Action Area */}
        <div className="grid grid-cols-1 gap-4">
            
            {/* Main Lesson Card */}
            <div className="bg-white rounded-3xl p-6 shadow-md relative overflow-hidden border-l-8 border-blue-500">
                 <div className="relative z-10">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-xl text-gray-800">主課程進度</h3>
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">Lesson {progress.currentLessonIndex + 1}</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-6">包含 {WORDS_PER_LESSON} 個新單字。新增配對與組句挑戰。</p>
                    <div className="flex gap-3">
                        <Button onClick={() => startSession()} className="flex-1 shadow-blue-300 shadow-lg py-3">
                            開始學習
                        </Button>
                        <Button variant="secondary" onClick={() => setAppState(AppState.COURSES)} className="px-4">
                            切換
                        </Button>
                    </div>
                 </div>
            </div>

            {/* Smart Review Card */}
            <div className="bg-gradient-to-r from-orange-100 to-amber-50 rounded-3xl p-6 shadow-md relative overflow-hidden border border-orange-200">
                 <div className="relative z-10">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-xl text-orange-900">智能複習</h3>
                        <span className="bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">強化記憶</span>
                    </div>
                    <p className="text-orange-800/70 text-sm mb-6">針對弱點單字進行拼字與重組測驗。</p>
                    <Button 
                        onClick={startReviewSession} 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200 shadow-lg py-3"
                    >
                        開始複習舊單字
                    </Button>
                 </div>
            </div>

        </div>

      </div>
    </div>
  );

  const renderSettings = () => (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-md">
            <div className="flex items-center mb-8">
                <button onClick={() => setAppState(AppState.DASHBOARD)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full mr-4">←</button>
                <h1 className="text-2xl font-bold text-gray-800">設定</h1>
            </div>

            <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                        <h3 className="font-bold text-gray-800">每日提醒</h3>
                        <p className="text-sm text-gray-500">固定時間提醒您背單字</p>
                    </div>
                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            name="toggle" 
                            id="toggle" 
                            checked={progress.reminderEnabled}
                            onChange={(e) => {
                                const enabled = e.target.checked;
                                setProgress(p => ({...p, reminderEnabled: enabled}));
                                if(enabled) requestNotificationPermission();
                            }}
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-6"
                            style={{right: progress.reminderEnabled ? '0' : 'auto', left: progress.reminderEnabled ? 'auto' : '0', border: '1px solid #e5e7eb'}}
                        />
                        <label 
                            htmlFor="toggle" 
                            className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${progress.reminderEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                        ></label>
                    </div>
                </div>

                {progress.reminderEnabled && (
                    <div className="flex justify-between items-center animate-fade-in-down">
                         <h3 className="font-bold text-gray-800">提醒時間</h3>
                         <input 
                            type="time" 
                            value={progress.reminderTime}
                            onChange={(e) => setProgress(p => ({...p, reminderTime: e.target.value}))}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                         />
                    </div>
                )}
                
                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800">
                    💡 <span className="font-bold">小撇步：</span> 將此網頁加入主畫面 (Add to Home Screen) 並保持手機通知開啟，提醒功能效果最好喔！
                </div>
            </div>
            
            <div className="mt-12 text-center text-xs text-gray-400">
                VocabMaster v2.0
            </div>
          </div>
      </div>
  );

  const renderSession = () => {
    const currentTask = taskQueue[currentTaskIndex];
    if (!currentTask) return null;
    const progressPercent = ((currentTaskIndex) / taskQueue.length) * 100;

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-md flex justify-between items-center mb-6 pt-4">
                <button onClick={() => setAppState(AppState.DASHBOARD)} className="text-gray-400 font-bold text-sm">✕ 退出</button>
                <div className="flex-1 mx-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${progressPercent}%`}}></div>
                </div>
                <div className="text-orange-500 font-bold text-sm">🔥 {combo}</div>
            </div>

            <div className="w-full max-w-md flex-1 flex flex-col justify-center pb-20">
                {currentTask.type === TaskType.LEARN ? (
                    <div className="flex flex-col items-center">
                        <div className="mb-4 text-gray-500 font-medium tracking-wide text-sm uppercase">新單字學習</div>
                        <WordCard word={currentTask.word} isFlipped={isFlipped} onFlip={() => setIsFlipped(true)} />
                         <div className="mt-8 w-full">
                            <Button onClick={() => handleTaskComplete(true)} className="w-full py-4 text-lg" disabled={!isFlipped}>
                                我記住了，下一步
                            </Button>
                             {!isFlipped && <p className="text-center text-gray-400 text-xs mt-3">請點擊卡片查看解釋與發音</p>}
                        </div>
                    </div>
                ) : (
                    <QuestionCard 
                        key={currentTask.id}
                        word={currentTask.word}
                        type={currentTask.type}
                        options={currentTask.type === TaskType.CHOICE ? generateOptions(currentTask.word) : generateDistractorWords(currentTask.word)}
                        groupWords={currentTask.groupWords}
                        onAnswer={handleTaskComplete}
                    />
                )}
            </div>
        </div>
    );
  };

  const renderSummary = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold mb-2">
                {sessionMode === 'REVIEW' ? '複習完成！' : '課程完成！'}
            </h2>
            <div className="flex justify-center gap-1 mb-6 text-2xl text-yellow-300">
                {sessionErrors === 0 ? '★★★' : sessionErrors < 3 ? '★★☆' : '★☆☆'}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/20 rounded-2xl p-4">
                    <div className="text-sm text-blue-200 mb-1">獲得 XP</div>
                    <div className="text-3xl font-bold">+{sessionXpGained}</div>
                </div>
                 <div className="bg-white/20 rounded-2xl p-4">
                    <div className="text-sm text-blue-200 mb-1">錯誤次數</div>
                    <div className="text-3xl font-bold">{sessionErrors}</div>
                </div>
            </div>

            <Button onClick={() => setAppState(AppState.DASHBOARD)} variant="secondary" className="w-full py-4 text-blue-900 font-bold">
                返回首頁
            </Button>
        </div>
    </div>
  );

  switch (appState) {
    case AppState.SESSION: return renderSession();
    case AppState.SUMMARY: return renderSummary();
    case AppState.COURSES: return (
        <CourseList 
            currentLessonIndex={progress.currentLessonIndex}
            lessonStats={progress.lessonStats}
            onSelectLesson={(idx) => startSession(idx)}
            onBack={() => setAppState(AppState.DASHBOARD)}
        />
    );
    case AppState.SETTINGS: return renderSettings();
    case AppState.DASHBOARD:
    default: return renderDashboard();
  }
};

export default App;