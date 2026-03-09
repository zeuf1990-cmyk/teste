import { GoogleGenAI, Type } from "@google/genai";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Flame, Beef, Wheat, Droplet, Plus, Trash2, Loader2, 
  Activity, ChevronLeft, ChevronRight, Calendar, Pencil, 
  Check, X, Search, MoreVertical, History, Target,
  Sparkles, Filter, ArrowRight
} from "lucide-react";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini lazily
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("Gemini API key is missing. Please add GEMINI_API_KEY to your secrets.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

interface Meal {
  id: string;
  food_name: string;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  timestamp: number;
}

interface Goals {
  protein: number;
  carbs: number;
  fats: number;
}

const defaultGoals: Goals = {
  protein: 150,
  carbs: 200,
  fats: 65,
};

const calculateCalories = (p: number = 0, c: number = 0, f: number = 0) => Math.round((p * 4) + (c * 4) + (f * 9));

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Meal>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editGoalsForm, setEditGoalsForm] = useState<Goals>(defaultGoals);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Persistence
  useEffect(() => {
    const savedMeals = localStorage.getItem("macrogpt_meals");
    if (savedMeals) try { setMeals(JSON.parse(savedMeals)); } catch (e) { console.error(e); }
    const savedGoals = localStorage.getItem("macrogpt_goals");
    if (savedGoals) try { setGoals(JSON.parse(savedGoals)); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem("macrogpt_meals", JSON.stringify(meals));
    localStorage.setItem("macrogpt_goals", JSON.stringify(goals));
  }, [meals, goals]);

  const handleLogMeal = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: inputText,
        config: {
          systemInstruction: `Extract nutritional data from meal descriptions. Return JSON with success:boolean, error_message:string, and items:Array<{food_name, protein_g, carbs_g, fats_g}>. Be accurate with portions.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              error_message: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    food_name: { type: Type.STRING },
                    protein_g: { type: Type.INTEGER },
                    carbs_g: { type: Type.INTEGER },
                    fats_g: { type: Type.INTEGER },
                  },
                  required: ["food_name", "protein_g", "carbs_g", "fats_g"],
                },
              },
            },
            required: ["success"],
          },
        },
      });

      if (!response.text) {
        throw new Error("AI returned an empty response. This might be due to safety filters or a temporary service issue.");
      }

      const data = JSON.parse(response.text);
      if (!data.success) {
        setError(data.error_message || "Could not recognize food.");
        return;
      }

      const isToday = selectedDate === getLocalDateString(new Date());
      const timestamp = isToday ? Date.now() : new Date(`${selectedDate}T12:00:00`).getTime();
      
      const newMeals: Meal[] = data.items.map((item: any) => ({
        id: crypto.randomUUID(),
        ...item,
        timestamp,
      }));

      setMeals(prev => [...newMeals, ...prev]);
      setInputText("");
    } catch (err: any) {
      console.error("AI Error:", err);
      setError(err.message || "AI service unavailable. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMeals = useMemo(() => 
    meals.filter(m => getLocalDateString(new Date(m.timestamp)) === selectedDate),
  [meals, selectedDate]);
  
  const filteredMeals = useMemo(() => 
    selectedMeals.filter(m => m.food_name.toLowerCase().includes(searchQuery.toLowerCase())),
  [selectedMeals, searchQuery]);

  const totals = useMemo(() => selectedMeals.reduce(
    (acc, m) => ({ p: acc.p + m.protein_g, c: acc.c + m.carbs_g, f: acc.f + m.fats_g }),
    { p: 0, c: 0, f: 0 }
  ), [selectedMeals]);

  const totalCals = calculateCalories(totals.p, totals.c, totals.f);
  const goalCals = calculateCalories(goals.protein, goals.carbs, goals.fats);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Padding for start of month
    const startPadding = firstDay.getDay();
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = getLocalDateString(date);
      const dayMeals = meals.filter(m => getLocalDateString(new Date(m.timestamp)) === dateStr);
      const dayTotals = dayMeals.reduce(
        (acc, m) => ({ p: acc.p + m.protein_g, c: acc.c + m.carbs_g, f: acc.f + m.fats_g }),
        { p: 0, c: 0, f: 0 }
      );
      const dayCals = calculateCalories(dayTotals.p, dayTotals.c, dayTotals.f);
      
      days.push({
        date,
        dateStr,
        calories: dayCals,
        hasMeals: dayMeals.length > 0
      });
    }
    
    return days;
  }, [calendarMonth, meals]);

  const isToday = selectedDate === getLocalDateString(new Date());
  const displayDate = isToday ? "Today" : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 pb-24">
      {/* App Bar */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-surface-variant">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20"
            >
              <Activity size={22} />
            </motion.div>
            <h1 className="text-xl font-bold tracking-tight text-on-surface">MacroGPT</h1>
          </div>

          <div className="flex items-center gap-1 bg-surface-variant/50 p-1 rounded-2xl">
            <button onClick={() => {
              const d = new Date(`${selectedDate}T12:00:00`);
              d.setDate(d.getDate() - 1);
              setSelectedDate(getLocalDateString(d));
            }} className="p-2 hover:bg-white rounded-xl transition-colors text-on-surface-variant">
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-3 py-1.5 flex items-center gap-2 text-sm font-semibold text-on-surface hover:bg-white rounded-xl transition-all"
            >
              <Calendar size={16} className="text-primary" />
              {displayDate}
            </button>
            <button 
              disabled={isToday}
              onClick={() => {
                const d = new Date(`${selectedDate}T12:00:00`);
                d.setDate(d.getDate() + 1);
                setSelectedDate(getLocalDateString(d));
              }} 
              className="p-2 hover:bg-white rounded-xl transition-colors text-on-surface-variant disabled:opacity-20"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        <AnimatePresence>
          {showCalendar && (
            <motion.section
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="m3-card p-6 bg-white shadow-lg border-surface-variant">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-on-surface">
                    {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-3 py-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors uppercase tracking-widest"
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="p-2 hover:bg-surface-variant rounded-xl transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="p-2 hover:bg-surface-variant rounded-xl transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                    <div key={d} className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
                    
                    const isSelected = day.dateStr === selectedDate;
                    const isOverGoal = day.calories > goalCals;
                    const isWithinGoal = day.hasMeals && day.calories <= goalCals;
                    
                    return (
                      <button
                        key={day.dateStr}
                        onClick={() => {
                          setSelectedDate(day.dateStr);
                          setShowCalendar(false);
                        }}
                        className={cn(
                          "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all hover:scale-105 active:scale-95",
                          isSelected ? "bg-primary text-on-primary shadow-md" : "bg-surface-variant/20 text-on-surface"
                        )}
                      >
                        <span className="text-sm font-bold">{day.date.getDate()}</span>
                        {day.hasMeals && (
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full absolute bottom-2",
                            isOverGoal ? "bg-rose-500" : "bg-emerald-500"
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Within Goal
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    Over Goal
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Progress Card */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="m3-card p-6 bg-primary-container/30 border-primary/10"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-xs">
              <Target size={14} />
              Daily Progress
            </div>
            <button 
              onClick={() => { setEditGoalsForm(goals); setIsEditingGoals(true); }}
              className="text-xs font-bold text-primary hover:underline"
            >
              Adjust Goals
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="relative flex items-center justify-center">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="70" className="stroke-surface-variant fill-none" strokeWidth="12" />
                <motion.circle 
                  cx="80" cy="80" r="70" 
                  className={cn(
                    "fill-none transition-colors duration-500",
                    totalCals > goalCals ? "stroke-rose-500" : "stroke-primary"
                  )}
                  strokeWidth="12" 
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 440" }}
                  animate={{ strokeDasharray: `${Math.min(440, (totalCals / goalCals) * 440)} 440` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  "text-3xl font-black transition-colors",
                  totalCals > goalCals ? "text-rose-500" : "text-on-surface"
                )}>{totalCals}</span>
                <span className="text-xs font-medium text-on-surface-variant">of {goalCals} kcal</span>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { label: "Protein", val: totals.p, goal: goals.protein, color: "bg-rose-500", icon: Beef },
                { label: "Carbs", val: totals.c, goal: goals.carbs, color: "bg-amber-500", icon: Wheat },
                { label: "Fats", val: totals.f, goal: goals.fats, color: "bg-sky-500", icon: Droplet },
              ].map((macro) => (
                <div key={macro.label} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <div className={cn(
                      "flex items-center gap-2 text-sm font-bold transition-colors",
                      macro.val > macro.goal ? "text-rose-500" : "text-on-surface"
                    )}>
                      <macro.icon size={14} className={macro.val > macro.goal ? "text-rose-500" : "text-on-surface-variant"} />
                      {macro.label}
                    </div>
                    <span className={cn(
                      "text-xs font-medium transition-colors",
                      macro.val > macro.goal ? "text-rose-500" : "text-on-surface-variant"
                    )}>{macro.val} / {macro.goal}g</span>
                  </div>
                  <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (macro.val / macro.goal) * 100)}%` }}
                      className={cn(
                        "h-full rounded-full transition-colors duration-500",
                        macro.val > macro.goal ? "bg-rose-500" : macro.color
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Input Area */}
        <section className="relative">
          <div className="m3-card p-2 bg-white shadow-xl shadow-primary/5 focus-within:ring-2 ring-primary/20 transition-all">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Describe your meal... (e.g. '3 eggs and a bowl of oats')"
              className="w-full min-h-[100px] p-4 bg-transparent resize-none outline-none text-on-surface placeholder:text-on-surface-variant/50 font-medium"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between p-2 border-t border-surface-variant/50">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant px-2 italic">
                <Sparkles size={12} className="text-primary" />
                AI-powered tracking
              </div>
              <button
                onClick={handleLogMeal}
                disabled={isLoading || !inputText.trim()}
                className="m3-button-filled py-2 px-5 flex items-center gap-2 text-sm"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Log Meal
              </button>
            </div>
          </div>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-10 left-0 right-0 text-center text-xs font-bold text-rose-500"
            >
              {error}
            </motion.div>
          )}
        </section>

        {/* Meal List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <History size={14} />
              Logged Meals
            </h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-surface-variant/30 rounded-full text-xs outline-none focus:bg-surface-variant/50 transition-all w-32 focus:w-48"
              />
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {filteredMeals.length > 0 ? (
              filteredMeals.map((meal) => (
                <motion.div
                  key={meal.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="m3-card p-4 group"
                >
                  {editingMealId === meal.id ? (
                    <div className="space-y-4">
                      <input 
                        type="text"
                        value={editForm.food_name || ""}
                        onChange={(e) => setEditForm({ ...editForm, food_name: e.target.value })}
                        className="w-full bg-surface-variant/30 rounded-xl px-3 py-2 outline-none focus:ring-2 ring-primary/20 font-bold"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "P", key: "protein_g" as const },
                          { label: "C", key: "carbs_g" as const },
                          { label: "F", key: "fats_g" as const },
                        ].map((f) => (
                          <div key={f.key} className="space-y-1">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">{f.label}</label>
                            <input 
                              type="number" 
                              value={editForm[f.key] || 0}
                              onChange={(e) => setEditForm({ ...editForm, [f.key]: Number(e.target.value) })}
                              className="w-full bg-surface-variant/30 rounded-xl px-2 py-1.5 outline-none focus:ring-2 ring-primary/20 text-sm font-bold"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingMealId(null)}
                          className="flex-1 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-variant/30 rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, ...editForm } as Meal : m));
                            setEditingMealId(null);
                          }}
                          className="flex-1 bg-primary text-on-primary py-2 text-sm font-bold rounded-xl shadow-lg shadow-primary/20"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-bold text-on-surface">{meal.food_name}</h3>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                          <span className="flex items-center gap-1"><Beef size={10} /> {meal.protein_g}g</span>
                          <span className="flex items-center gap-1"><Wheat size={10} /> {meal.carbs_g}g</span>
                          <span className="flex items-center gap-1"><Droplet size={10} /> {meal.fats_g}g</span>
                          <span className="text-primary ml-2">{calculateCalories(meal.protein_g, meal.carbs_g, meal.fats_g)} kcal</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingMealId(meal.id);
                            setEditForm(meal);
                          }}
                          className="p-2 hover:bg-surface-variant/50 text-on-surface-variant hover:text-primary rounded-xl transition-all"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => setMeals(prev => prev.filter(m => m.id !== meal.id))}
                          className="p-2 hover:bg-rose-50 text-on-surface-variant hover:text-rose-500 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-on-surface-variant italic text-sm"
              >
                No meals logged for this day.
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Goal Edit Modal */}
      <AnimatePresence>
        {isEditingGoals && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingGoals(false)}
              className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl space-y-6"
            >
              <h2 className="text-xl font-bold text-on-surface">Daily Targets</h2>
              <div className="space-y-4">
                {[
                  { label: "Protein (g)", key: "protein" as const },
                  { label: "Carbs (g)", key: "carbs" as const },
                  { label: "Fats (g)", key: "fats" as const },
                ].map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">{f.label}</label>
                    <input 
                      type="number" 
                      value={editGoalsForm[f.key]}
                      onChange={(e) => setEditGoalsForm({ ...editGoalsForm, [f.key]: Number(e.target.value) })}
                      className="w-full bg-surface-variant/30 rounded-2xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 font-bold"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsEditingGoals(false)} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-variant/30 rounded-2xl transition-all">Cancel</button>
                <button onClick={() => { setGoals(editGoalsForm); setIsEditingGoals(false); }} className="flex-1 m3-button-filled">Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
