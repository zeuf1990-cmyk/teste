import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Upload, 
  Sparkles, 
  MessageCircle, 
  X, 
  Send, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  Image as ImageIcon,
  Settings2,
  AlertCircle
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  generateStoryStructure, 
  generateIllustration, 
  chatWithGemini, 
  Story 
} from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global window extension for AI Studio API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const checkApiKey = async () => {
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    } catch (err) {
      console.error('Error checking API key:', err);
    }
  };

  const handleOpenKeySelector = async () => {
    try {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    } catch (err) {
      console.error('Error opening key selector:', err);
    }
  };

  const handleGenerate = async () => {
    if (!script.trim()) return;
    if (!hasApiKey) {
      setError("Please select an API key first to generate high-quality illustrations.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStory(null);
    setCurrentSegmentIndex(0);

    try {
      // Step 1: Generate story structure
      const storyData = await generateStoryStructure(script);
      setStory(storyData);

      // Step 2: Generate illustrations for each segment sequentially
      const updatedSegments = [...storyData.segments];
      for (let i = 0; i < updatedSegments.length; i++) {
        try {
          const imageUrl = await generateIllustration(updatedSegments[i].imagePrompt, imageSize);
          updatedSegments[i] = { ...updatedSegments[i], imageUrl };
          setStory(prev => prev ? { ...prev, segments: [...updatedSegments] } : null);
        } catch (err) {
          console.error(`Failed to generate image for segment ${i}:`, err);
        }
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || "An unexpected error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await chatWithGemini(userMsg, []);
      setChatMessages(prev => [...prev, { role: 'ai', text: response || "I'm sorry, I couldn't process that." }]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Oops! Something went wrong with the chat." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-[#f5f2ed] flex items-center justify-center p-6 font-serif">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-xl text-center border border-[#5A5A40]/10"
        >
          <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings2 className="w-10 h-10 text-[#5A5A40]" />
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-4">Welcome to Magical Storybook</h1>
          <p className="text-[#5A5A40] mb-8 leading-relaxed">
            To create beautiful high-resolution illustrations for your stories, you'll need to select your Gemini API key.
          </p>
          <button
            onClick={handleOpenKeySelector}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#4a4a35] transition-colors shadow-lg shadow-[#5A5A40]/20 flex items-center justify-center gap-2"
          >
            Select API Key
          </button>
          <p className="mt-4 text-xs text-[#5A5A40]/60">
            A paid Google Cloud project is required for high-quality image generation.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-serif selection:bg-[#5A5A40]/20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#f5f2ed]/80 backdrop-blur-md border-b border-[#5A5A40]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Magical Storybook</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsChatOpen(true)}
              className="p-2 hover:bg-[#5A5A40]/10 rounded-full transition-colors relative"
            >
              <MessageCircle className="w-6 h-6 text-[#5A5A40]" />
              {chatMessages.length > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-[#f5f2ed] rounded-full" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        {!story && !isGenerating ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold text-[#1a1a1a]">Turn your script into a masterpiece</h2>
              <p className="text-lg text-[#5A5A40] italic">Upload your script and watch as we weave it into 10 illustrated chapters.</p>
            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#5A5A40]/10 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#5A5A40] uppercase tracking-widest">Your Script</label>
                <textarea 
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Once upon a time, in a forest filled with glowing mushrooms..."
                  className="w-full h-48 p-6 bg-[#f5f2ed]/50 rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40] resize-none text-lg leading-relaxed placeholder:italic"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-[#5A5A40] uppercase tracking-widest">Image Quality</span>
                  <div className="flex bg-[#f5f2ed] p-1 rounded-full">
                    {(['1K', '2K', '4K'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                          imageSize === size ? "bg-[#5A5A40] text-white shadow-md" : "text-[#5A5A40] hover:bg-[#5A5A40]/10"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={!script.trim()}
                  className="bg-[#5A5A40] text-white px-8 py-3 rounded-full font-medium hover:bg-[#4a4a35] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-[#5A5A40]/20"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Story
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </motion.div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="relative">
              <Loader2 className="w-24 h-24 text-[#5A5A40] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#5A5A40]" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">Weaving your story...</h3>
              <p className="text-[#5A5A40] italic">
                {story ? `Illustrating chapter ${story.segments.filter(s => s.imageUrl).length + 1} of 10` : "Structuring your narrative"}
              </p>
            </div>
            
            {story && (
              <div className="w-full max-w-md bg-[#5A5A40]/10 h-2 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-[#5A5A40] h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(story.segments.filter(s => s.imageUrl).length / 10) * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : story && (
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-bold">{story.title}</h2>
              <button 
                onClick={() => { setStory(null); setScript(''); }}
                className="text-[#5A5A40] hover:underline flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                New Story
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Illustration Side */}
              <div className="relative aspect-square bg-white rounded-[32px] overflow-hidden shadow-2xl border border-[#5A5A40]/10 group">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSegmentIndex}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full h-full"
                  >
                    {story.segments[currentSegmentIndex].imageUrl ? (
                      <img 
                        src={story.segments[currentSegmentIndex].imageUrl} 
                        alt={`Illustration for chapter ${currentSegmentIndex + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#f5f2ed] text-[#5A5A40]/40 space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin" />
                        <p className="italic">Painting this scene...</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
                  <button 
                    onClick={() => setCurrentSegmentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentSegmentIndex === 0}
                    className="text-white disabled:opacity-30 hover:scale-110 transition-transform"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <span className="text-white font-bold text-sm tracking-widest">
                    {currentSegmentIndex + 1} / 10
                  </span>
                  <button 
                    onClick={() => setCurrentSegmentIndex(prev => Math.min(9, prev + 1))}
                    disabled={currentSegmentIndex === 9}
                    className="text-white disabled:opacity-30 hover:scale-110 transition-transform"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Text Side */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <span className="text-sm font-bold text-[#5A5A40] uppercase tracking-[0.3em]">Chapter {currentSegmentIndex + 1}</span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSegmentIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="text-3xl leading-relaxed text-[#1a1a1a]"
                    >
                      {story.segments[currentSegmentIndex].text}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex gap-4">
                  {story.segments.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSegmentIndex(idx)}
                      className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        currentSegmentIndex === idx ? "bg-[#5A5A40] w-8" : "bg-[#5A5A40]/20 hover:bg-[#5A5A40]/40"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Chat Sidebar */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-[#5A5A40]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#5A5A40]/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#5A5A40]" />
                  </div>
                  <h3 className="font-bold">Story Assistant</h3>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 hover:bg-[#5A5A40]/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#5A5A40]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-[#f5f2ed] rounded-full flex items-center justify-center mx-auto">
                      <ImageIcon className="w-8 h-8 text-[#5A5A40]/40" />
                    </div>
                    <p className="text-[#5A5A40] italic">Ask me anything about your story or for ideas to improve your script!</p>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      msg.role === 'user' ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "p-4 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-[#5A5A40] text-white rounded-tr-none" 
                        : "bg-[#f5f2ed] text-[#1a1a1a] rounded-tl-none"
                    )}>
                      <Markdown>{msg.text}</Markdown>
                    </div>
                    <span className="text-[10px] text-[#5A5A40]/40 mt-1 uppercase tracking-widest font-bold">
                      {msg.role === 'user' ? 'You' : 'Gemini'}
                    </span>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-[#f5f2ed] p-4 rounded-2xl rounded-tl-none">
                      <Loader2 className="w-4 h-4 text-[#5A5A40] animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleChatSubmit} className="p-6 border-top border-[#5A5A40]/10">
                <div className="relative">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full pl-6 pr-12 py-4 bg-[#f5f2ed] rounded-full border-none focus:ring-2 focus:ring-[#5A5A40] text-sm"
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#5A5A40] text-white rounded-full hover:bg-[#4a4a35] transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
