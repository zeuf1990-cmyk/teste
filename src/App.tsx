import { GoogleGenAI, Type } from "@google/genai";
import { useState, useEffect } from "react";
import { Flame, Beef, Wheat, Droplet, Plus, Trash2, Loader2, Activity, ChevronLeft, ChevronRight, Calendar, Pencil, Check, X, Search } from "lucide-react";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

const calculateCalories = (protein: number = 0, carbs: number = 0, fats: number = 0) => {
  return Math.round((protein * 4) + (carbs * 4) + (fats * 9));
};

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

  // Load from local storage on mount
  useEffect(() => {
    const savedMeals = localStorage.getItem("macrogpt_meals");
    if (savedMeals) {
      try {
        setMeals(JSON.parse(savedMeals));
      } catch (e) {
        console.error("Failed to parse saved meals", e);
      }
    }
    
    const savedGoals = localStorage.getItem("macrogpt_goals");
    if (savedGoals) {
      try {
        setGoals(JSON.parse(savedGoals));
      } catch (e) {
        console.error("Failed to parse saved goals", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem("macrogpt_meals", JSON.stringify(meals));
      localStorage.setItem("macrogpt_goals", JSON.stringify(goals));
    } catch (e) {
      console.error("Failed to save data", e);
      setError("Failed to save your data. Your browser storage might be full.");
    }
  }, [meals, goals]);

  const handleLogMeal = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: inputText,
        config: {
          systemInstruction: `You are the backend data-extraction engine for "MacroGPT", a web-based nutrition and fitness tracking application. 

Your sole purpose is to analyze natural language descriptions of meals provided by the user and accurately estimate their nutritional content.

INSTRUCTIONS:
1. Analyze the user's input. If the input does not describe food or a meal (e.g., a greeting, a random question, gibberish), set "success" to false and provide a helpful "error_message".
2. If the input describes a meal, set "success" to true and split it into distinct food items (e.g., "scrambled eggs and a granola bowl" becomes two separate items).
3. If portion sizes are not explicitly stated, assume standard serving sizes based on the context.
4. Calculate or estimate the macronutrients for each distinct food item.
5. You must output the result STRICTLY as a valid JSON object matching the schema.
6. DO NOT include any conversational text, introductions, explanations, or Markdown formatting (like \`\`\`json or backticks). Output ONLY the raw JSON object.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: {
                type: Type.BOOLEAN,
                description: "True if the input describes food, false otherwise",
              },
              error_message: {
                type: Type.STRING,
                description: "If success is false, provide a helpful error message explaining why the input couldn't be parsed as a meal.",
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    food_name: {
                      type: Type.STRING,
                      description: "A concise, 1-to-5 word summary of the individual food item",
                    },
                    protein_g: {
                      type: Type.INTEGER,
                      description: "Total estimated protein in grams for this item",
                    },
                    carbs_g: {
                      type: Type.INTEGER,
                      description: "Total estimated carbohydrates in grams for this item",
                    },
                    fats_g: {
                      type: Type.INTEGER,
                      description: "Total estimated fats in grams for this item",
                    },
                  },
                  required: ["food_name", "protein_g", "carbs_g", "fats_g"],
                },
              },
            },
            required: ["success"],
          },
        },
      });

      const jsonStr = response.text?.trim();
      if (!jsonStr) throw new Error("No response from AI");

      const data = JSON.parse(jsonStr);
      
      if (!data.success) {
        setError(data.error_message || "Could not recognize any food in your description. Please try again.");
        return;
      }

      if (!data.items || data.items.length === 0) {
        setError("Could not extract any food items from your description. Please be more specific.");
        return;
      }
      
      const isToday = selectedDate === getLocalDateString(new Date());
      const timestamp = isToday ? Date.now() : new Date(`${selectedDate}T12:00:00`).getTime();
      
      const newMeals: Meal[] = data.items.map((item: any) => ({
        id: crypto.randomUUID(),
        food_name: item.food_name,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fats_g: item.fats_g,
        timestamp,
      }));

      setMeals((prev) => [...newMeals, ...prev]);
      setInputText("");
    } catch (err) {
      console.error(err);
      setError("Network error or AI service unavailable. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMeal = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const startEditing = (meal: Meal) => {
    setEditingMealId(meal.id);
    setEditForm(meal);
  };

  const cancelEditing = () => {
    setEditingMealId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingMealId) return;
    setMeals((prev) =>
      prev.map((m) => (m.id === editingMealId ? ({ ...m, ...editForm } as Meal) : m))
    );
    setEditingMealId(null);
    setEditForm({});
  };

  const selectedMeals = meals.filter(m => getLocalDateString(new Date(m.timestamp)) === selectedDate);
  
  const filteredMeals = selectedMeals.filter(m => 
    m.food_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTotals = selectedMeals.reduce(
    (acc, meal) => ({
      protein: acc.protein + meal.protein_g,
      carbs: acc.carbs + meal.carbs_g,
      fats: acc.fats + meal.fats_g,
    }),
    { protein: 0, carbs: 0, fats: 0 }
  );

  const totalCalories = calculateCalories(selectedTotals.protein, selectedTotals.carbs, selectedTotals.fats);
  const goalCalories = calculateCalories(goals.protein, goals.carbs, goals.fats);

  const clearSelectedDate = () => {
    setMeals((prev) => prev.filter((m) => getLocalDateString(new Date(m.timestamp)) !== selectedDate));
  };

  const changeDate = (days: number) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(getLocalDateString(date));
  };

  const isToday = selectedDate === getLocalDateString(new Date());
  
  const displayDate = isToday 
    ? "Today" 
    : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  // Generate calendar data for the last 14 days
  const calendarDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = getLocalDateString(d);
    
    // Calculate totals for this specific day
    const dayMeals = meals.filter(m => getLocalDateString(new Date(m.timestamp)) === dateStr);
    const dayTotals = dayMeals.reduce(
      (acc, meal) => ({
        protein: acc.protein + meal.protein_g,
        carbs: acc.carbs + meal.carbs_g,
        fats: acc.fats + meal.fats_g,
      }),
      { protein: 0, carbs: 0, fats: 0 }
    );
    const dayCalories = calculateCalories(dayTotals.protein, dayTotals.carbs, dayTotals.fats);
    
    return {
      date: d,
      dateStr,
      hasMeals: dayMeals.length > 0,
      isOverGoal: dayCalories > goalCalories,
      calories: dayCalories
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Activity size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">MacroGPT</h1>
          </div>
          
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-neutral-50 p-1 rounded-lg border border-neutral-200">
            <button 
              onClick={() => setShowCalendar(!showCalendar)}
              className={`p-1.5 rounded-md transition-colors ${showCalendar ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-white text-neutral-500 hover:text-neutral-900'}`}
              aria-label="Toggle calendar view"
            >
              <Calendar size={18} />
            </button>
            <div className="w-px h-4 bg-neutral-300 mx-1"></div>
            <button 
              onClick={() => changeDate(-1)}
              className="p-1.5 hover:bg-white rounded-md text-neutral-500 hover:text-neutral-900 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 px-2 min-w-[120px] justify-center">
              <Calendar size={14} className="text-neutral-400" />
              <span className="text-sm font-medium">{displayDate}</span>
            </div>
            <button 
              onClick={() => changeDate(1)}
              disabled={isToday}
              className={`p-1.5 rounded-md transition-colors ${isToday ? 'text-neutral-300 cursor-not-allowed' : 'hover:bg-white text-neutral-500 hover:text-neutral-900'}`}
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Calendar View */}
        {showCalendar && (
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100">
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
              Last 14 Days
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-neutral-400 mb-2">
                  {day}
                </div>
              ))}
              
              {/* Add empty cells for padding if needed to align the first day correctly */}
              {Array.from({ length: calendarDays[0].date.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2"></div>
              ))}
              
              {calendarDays.map((day) => (
                <button
                  key={day.dateStr}
                  onClick={() => {
                    setSelectedDate(day.dateStr);
                    setShowCalendar(false);
                  }}
                  className={`
                    relative p-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all
                    ${selectedDate === day.dateStr ? 'ring-2 ring-emerald-500 ring-offset-2 bg-neutral-50' : 'hover:bg-neutral-50'}
                    ${day.dateStr === getLocalDateString(new Date()) ? 'font-bold' : ''}
                  `}
                >
                  <span className="text-sm">{day.date.getDate()}</span>
                  
                  {/* Status Indicator */}
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0">
                    {day.hasMeals ? (
                      <div className={`h-full w-full rounded-full ${day.isOverGoal ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    ) : (
                      <div className="h-full w-full rounded-full bg-neutral-200" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-neutral-500">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                <span>Goal Met</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span>Over Goal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-neutral-200"></div>
                <span>No Data</span>
              </div>
            </div>
          </section>
        )}

        {/* Daily Summary */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
              {isToday ? "Daily Summary" : `${displayDate} Summary`}
            </h2>
            <button
              onClick={() => {
                setEditGoalsForm(goals);
                setIsEditingGoals(true);
              }}
              className="text-xs font-medium text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
            >
              <Pencil size={12} /> Edit Goals
            </button>
          </div>

          {isEditingGoals && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-500 mb-4">
              <h3 className="text-sm font-medium mb-4">Edit Daily Goals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="text-xs text-neutral-500 mb-1">Calories</label>
                  <div className="px-3 py-2 text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg h-[38px] flex items-center">
                    {calculateCalories(editGoalsForm.protein, editGoalsForm.carbs, editGoalsForm.fats)}
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-neutral-500 mb-1">Protein (g)</label>
                  <input type="number" value={editGoalsForm.protein} onChange={e => setEditGoalsForm({...editGoalsForm, protein: Number(e.target.value)})} className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-neutral-500 mb-1">Carbs (g)</label>
                  <input type="number" value={editGoalsForm.carbs} onChange={e => setEditGoalsForm({...editGoalsForm, carbs: Number(e.target.value)})} className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-neutral-500 mb-1">Fats (g)</label>
                  <input type="number" value={editGoalsForm.fats} onChange={e => setEditGoalsForm({...editGoalsForm, fats: Number(e.target.value)})} className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingGoals(false)} className="px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={() => { setGoals(editGoalsForm); setIsEditingGoals(false); }} className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">Save Goals</button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-orange-500 mb-2">
                  <Flame size={20} />
                  <span className="text-base font-medium">Calories</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-light tracking-tight">{totalCalories}</span>
                  <span className="text-lg text-neutral-400">/ {goalCalories} kcal</span>
                </div>
              </div>
              
              <div className="flex-1 w-full">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className={`font-medium ${totalCalories > goalCalories ? 'text-red-500' : 'text-neutral-500'}`}>{Math.round(goalCalories > 0 ? (totalCalories / goalCalories) * 100 : 0)}%</span>
                  <span className={totalCalories > goalCalories ? 'text-red-500 font-medium' : 'text-neutral-500'}>
                    {totalCalories > goalCalories ? `${totalCalories - goalCalories} kcal over` : `${Math.max(0, goalCalories - totalCalories)} kcal left`}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all ${totalCalories > goalCalories ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, goalCalories > 0 ? (totalCalories / goalCalories) * 100 : 0)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
              <div className="flex items-center gap-2 text-rose-500 mb-3">
                <Beef size={18} />
                <span className="text-sm font-medium">Protein</span>
              </div>
              
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-light tracking-tight">{selectedTotals.protein}</span>
                <span className="text-sm text-neutral-400">/ {goals.protein} g</span>
              </div>
              
              <div className="w-full bg-neutral-100 rounded-full h-2 mb-2">
                <div className={`h-2 rounded-full transition-all ${selectedTotals.protein > goals.protein ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, goals.protein > 0 ? (selectedTotals.protein / goals.protein) * 100 : 0)}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className={`font-medium ${selectedTotals.protein > goals.protein ? 'text-red-500' : 'text-neutral-500'}`}>{Math.round(goals.protein > 0 ? (selectedTotals.protein / goals.protein) * 100 : 0)}%</span>
                <span className={selectedTotals.protein > goals.protein ? 'text-red-500 font-medium' : 'text-neutral-500'}>
                  {selectedTotals.protein > goals.protein ? `${selectedTotals.protein - goals.protein}g over` : `${Math.max(0, goals.protein - selectedTotals.protein)}g left`}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
              <div className="flex items-center gap-2 text-amber-500 mb-3">
                <Wheat size={18} />
                <span className="text-sm font-medium">Carbs</span>
              </div>
              
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-light tracking-tight">{selectedTotals.carbs}</span>
                <span className="text-sm text-neutral-400">/ {goals.carbs} g</span>
              </div>
              
              <div className="w-full bg-neutral-100 rounded-full h-2 mb-2">
                <div className={`h-2 rounded-full transition-all ${selectedTotals.carbs > goals.carbs ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, goals.carbs > 0 ? (selectedTotals.carbs / goals.carbs) * 100 : 0)}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className={`font-medium ${selectedTotals.carbs > goals.carbs ? 'text-red-500' : 'text-neutral-500'}`}>{Math.round(goals.carbs > 0 ? (selectedTotals.carbs / goals.carbs) * 100 : 0)}%</span>
                <span className={selectedTotals.carbs > goals.carbs ? 'text-red-500 font-medium' : 'text-neutral-500'}>
                  {selectedTotals.carbs > goals.carbs ? `${selectedTotals.carbs - goals.carbs}g over` : `${Math.max(0, goals.carbs - selectedTotals.carbs)}g left`}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col">
              <div className="flex items-center gap-2 text-sky-500 mb-3">
                <Droplet size={18} />
                <span className="text-sm font-medium">Fats</span>
              </div>
              
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-light tracking-tight">{selectedTotals.fats}</span>
                <span className="text-sm text-neutral-400">/ {goals.fats} g</span>
              </div>
              
              <div className="w-full bg-neutral-100 rounded-full h-2 mb-2">
                <div className={`h-2 rounded-full transition-all ${selectedTotals.fats > goals.fats ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, goals.fats > 0 ? (selectedTotals.fats / goals.fats) * 100 : 0)}%` }}></div>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className={`font-medium ${selectedTotals.fats > goals.fats ? 'text-red-500' : 'text-neutral-500'}`}>{Math.round(goals.fats > 0 ? (selectedTotals.fats / goals.fats) * 100 : 0)}%</span>
                <span className={selectedTotals.fats > goals.fats ? 'text-red-500 font-medium' : 'text-neutral-500'}>
                  {selectedTotals.fats > goals.fats ? `${selectedTotals.fats - goals.fats}g over` : `${Math.max(0, goals.fats - selectedTotals.fats)}g left`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Input Section */}
        <section className="bg-white p-1 rounded-3xl shadow-sm border border-neutral-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleLogMeal();
                }
              }}
              placeholder={isToday ? "What did you eat? (e.g., 'Two scrambled eggs and a piece of sourdough toast with butter')" : `Log a meal for ${displayDate}...`}
              className="w-full min-h-[120px] p-5 bg-transparent resize-none outline-none text-neutral-800 placeholder:text-neutral-400"
              disabled={isLoading}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3">
              {error && <span className="text-sm text-red-500 mr-2">{error}</span>}
              <button
                onClick={handleLogMeal}
                disabled={isLoading || !inputText.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-200 disabled:text-neutral-400 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Log Meal
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Logged Meals */}
        {selectedMeals.length > 0 ? (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
                {isToday ? "Today's Log" : `${displayDate} Log`}
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search meals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white w-full sm:w-48"
                  />
                </div>
                <button 
                  onClick={clearSelectedDate}
                  className="text-xs font-medium text-neutral-400 hover:text-red-500 transition-colors whitespace-nowrap"
                >
                  Clear Day
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {filteredMeals.length > 0 ? (
                filteredMeals.map((meal) => (
                  <div key={meal.id}>
                    {editingMealId === meal.id ? (
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-500 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <input
                            type="text"
                            value={editForm.food_name || ""}
                            onChange={(e) => setEditForm({ ...editForm, food_name: e.target.value })}
                            className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="Food name"
                          />
                          <div className="flex gap-2">
                            <div className="flex flex-col w-16">
                              <span className="text-[10px] text-neutral-400 uppercase">Cals</span>
                              <div className="px-2 py-1 text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg h-[30px] flex items-center">
                                {calculateCalories(editForm.protein_g, editForm.carbs_g, editForm.fats_g)}
                              </div>
                            </div>
                            <div className="flex flex-col w-16">
                              <span className="text-[10px] text-neutral-400 uppercase">Pro (g)</span>
                              <input
                                type="number"
                                value={editForm.protein_g === undefined ? "" : editForm.protein_g}
                                onChange={(e) => setEditForm({ ...editForm, protein_g: Number(e.target.value) })}
                                className="border border-neutral-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex flex-col w-16">
                              <span className="text-[10px] text-neutral-400 uppercase">Carb (g)</span>
                              <input
                                type="number"
                                value={editForm.carbs_g === undefined ? "" : editForm.carbs_g}
                                onChange={(e) => setEditForm({ ...editForm, carbs_g: Number(e.target.value) })}
                                className="border border-neutral-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex flex-col w-16">
                              <span className="text-[10px] text-neutral-400 uppercase">Fat (g)</span>
                              <input
                                type="number"
                                value={editForm.fats_g === undefined ? "" : editForm.fats_g}
                                onChange={(e) => setEditForm({ ...editForm, fats_g: Number(e.target.value) })}
                                className="border border-neutral-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <X size={14} /> Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Check size={14} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                        <div>
                          <h3 className="font-medium text-neutral-900">{meal.food_name}</h3>
                          <p className="text-xs text-neutral-400 mt-1">
                            {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="flex gap-4 text-sm">
                            <div className="flex flex-col items-center">
                              <span className="text-neutral-400 text-xs">Cals</span>
                              <span className="font-medium">{calculateCalories(meal.protein_g, meal.carbs_g, meal.fats_g)}</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-neutral-400 text-xs">Pro</span>
                              <span className="font-medium">{meal.protein_g}g</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-neutral-400 text-xs">Carb</span>
                              <span className="font-medium">{meal.carbs_g}g</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-neutral-400 text-xs">Fat</span>
                              <span className="font-medium">{meal.fats_g}g</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditing(meal)}
                              className="text-neutral-300 hover:text-emerald-500 transition-colors p-2 rounded-lg hover:bg-emerald-50"
                              aria-label="Edit meal"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => deleteMeal(meal.id)}
                              className="text-neutral-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                              aria-label="Delete meal"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-white rounded-2xl border border-neutral-100">
                  <p className="text-neutral-400 text-sm">No meals match your search.</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="text-center py-12">
            <p className="text-neutral-400">No meals logged for {isToday ? "today" : "this date"}.</p>
          </div>
        )}
      </main>
    </div>
  );
}