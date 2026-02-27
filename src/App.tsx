import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Camera, 
  Upload, 
  Download, 
  History, 
  User, 
  Building2, 
  MapPin, 
  Image as ImageIcon, 
  Loader2,
  CheckCircle2,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DEALERS, BACKGROUNDS, type HistoryItem } from './types';

const VW_BLUE = "#001E50";

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'history'>('studio');
  const [name, setName] = useState('');
  const [dealer, setDealer] = useState('');
  const [showroom, setShowroom] = useState('');
  const [background, setBackground] = useState('solid');
  const [images, setImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<{ front: string; side: string; full: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
      // Fallback to localStorage if server fails
      const localHistory = localStorage.getItem('vw_photo_history');
      if (localHistory) setHistory(JSON.parse(localHistory));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: FileList | null = null;
    if ('files' in e.target && e.target.files) {
      files = e.target.files;
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      files = e.dataTransfer.files;
    }

    if (files) {
      Array.from(files).slice(0, 3 - images.length).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string].slice(0, 3));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const generateProfile = async () => {
    if (!name || !dealer || !showroom || images.length === 0) {
      alert("모든 정보를 입력하고 사진을 업로드해주세요.");
      return;
    }

    setIsGenerating(true);
    setResults(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const getPrompt = (type: 'front' | 'side' | 'full') => {
        let bgDesc = "";
        if (background === 'solid') bgDesc = "a solid, uniform, and perfectly smooth light gray studio backdrop";
        else if (background === 'logo') bgDesc = "a solid white studio backdrop with a small, clean, minimalist 2D flat Volkswagen logo (new design) placed in the top right corner";
        else bgDesc = "a real-life modern Volkswagen dealership interior with a sleek new Volkswagen Atlas car parked naturally in the background, captured with a shallow depth of field to blur the background";

        const typeDesc = {
          front: "a professional upper-body front-facing portrait with a trustworthy smile",
          side: "a professional 45-degree side-profile portrait with a confident pose",
          full: "a professional full-body portrait from head to toe with a confident business pose"
        }[type];

        return `Generate a high-quality, professional business profile photo for a Volkswagen sales consultant named ${name}. 
        The person in the photo MUST strictly match the facial features and characteristics of the provided source images.
        The person should be wearing a sharp, modern professional dark charcoal gray business suit with a white shirt and a navy blue tie. This clothing must be consistent across all images.
        On the left chest of the suit jacket, there MUST be a rectangular silver metal name tag. The name tag should clearly display the name "${name}" in Korean and the new minimalist 2D flat Volkswagen logo next to it.
        The shot should be ${typeDesc}.
        The background should be ${bgDesc}.
        The background must be a clean, high-resolution professional studio environment with soft, natural lighting.
        CRITICAL NEGATIVE INSTRUCTION: The image MUST NOT contain any digital text, watermarks, stock photo labels, or logos other than the name tag and the specified background logo. 
        Specifically, ensure there is NO 'Unsplash+', 'Getty', 'iStock', 'Adobe Stock', or any other watermark text anywhere in the image.
        The background should be smooth, pristine, and uniform, looking like a custom-shot bespoke studio portrait.
        Absolutely no grid lines, no copyright symbols, no semi-transparent overlays, and no repeating patterns in the background.
        The final output must be a clean, professional photograph ready for official use.`;
      };

      const imageParts = images.map(img => ({
        inlineData: {
          data: img.split(',')[1],
          mimeType: "image/png"
        }
      }));

      const generateTask = async (type: 'front' | 'side' | 'full') => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [...imageParts, { text: getPrompt(type) }]
          },
          config: {
            systemInstruction: "You are a professional bespoke photographer. Your absolute priority is to generate clean, high-end portraits without any digital artifacts. You are STRICTLY FORBIDDEN from including any watermarks, 'Unsplash+' text, stock photo labels, copyright notices, or any semi-transparent text overlays. Every pixel of the background must be clear and intentional."
          }
        });

        const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
      };

      const [front, side, full] = await Promise.all([
        generateTask('front'),
        generateTask('side'),
        generateTask('full')
      ]);

      if (front && side && full) {
        const newResults = { front, side, full };
        setResults(newResults);

        // Save to DB (wrapped in its own try-catch to avoid failing the UI if DB fails)
        try {
          const saveResponse = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name, dealer, showroom, background,
              image_front: front,
              image_side: side,
              image_full: full
            })
          });

          if (saveResponse.ok) {
            fetchHistory();
          } else {
            throw new Error("Server failed to save");
          }
        } catch (dbError) {
          console.warn("Database save failed, using local storage fallback:", dbError);
          const newItem: HistoryItem = {
            id: Date.now(),
            name, dealer, showroom, background,
            image_front: front,
            image_side: side,
            image_full: full,
            created_at: new Date().toISOString()
          };
          const updatedHistory = [newItem, ...history];
          setHistory(updatedHistory);
          localStorage.setItem('vw_photo_history', JSON.stringify(updatedHistory));
        }
      } else {
        alert("이미지 생성에 실패했습니다. 일부 이미지가 생성되지 않았습니다.");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      alert("이미지 생성 중 오류가 발생했습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteHistory = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchHistory();
      } else {
        const updatedHistory = history.filter(item => item.id !== id);
        setHistory(updatedHistory);
        localStorage.setItem('vw_photo_history', JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const deleteAllHistory = async () => {
    if (!confirm("모든 히스토리를 삭제하시겠습니까?")) return;
    try {
      const response = await fetch('/api/history', { method: 'DELETE' });
      if (response.ok) {
        fetchHistory();
        localStorage.removeItem('vw_photo_history');
      }
    } catch (error) {
      console.error("Delete all failed:", error);
    }
  };

  const downloadAll = (item: HistoryItem) => {
    [
      { img: item.image_front, label: 'front' },
      { img: item.image_side, label: 'side' },
      { img: item.image_full, label: 'full' }
    ].forEach(pic => {
      downloadImage(pic.img, `VW_Profile_${item.name}_${pic.label}.png`);
    });
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const VWLogo = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" />
      <path d="M25 35 L44 75 L50 62 L56 75 L75 35" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M35 35 L50 68 L65 35" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: VW_BLUE }}>VW Photo Studio</h1>
          </div>
          
          <nav className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('studio')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'studio' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              스튜디오
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              히스토리
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'studio' ? (
            <motion.div 
              key="studio"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Input Section */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <User className="w-5 h-5" style={{ color: VW_BLUE }} />
                    컨설턴트 정보 입력
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">이름</label>
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="성함을 입력하세요"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">딜러사</label>
                        <select 
                          value={dealer}
                          onChange={(e) => {
                            setDealer(e.target.value);
                            setShowroom('');
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                        >
                          <option value="">선택하세요</option>
                          {Object.keys(DEALERS).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">전시장</label>
                        <select 
                          value={showroom}
                          onChange={(e) => setShowroom(e.target.value)}
                          disabled={!dealer}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">선택하세요</option>
                          {dealer && DEALERS[dealer as keyof typeof DEALERS].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">배경 선택</label>
                      <div className="grid grid-cols-1 gap-3">
                        {BACKGROUNDS.map((bg) => (
                          <button
                            key={bg.id}
                            onClick={() => setBackground(bg.id)}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${background === bg.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-300'}`}
                          >
                            <div>
                              <p className="font-medium text-sm">{bg.name}</p>
                              <p className="text-xs text-slate-500">{bg.description}</p>
                            </div>
                            {background === bg.id && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">사진 업로드 (최대 3장)</label>
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleImageUpload(e); }}
                        className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <Upload className="w-10 h-10 text-slate-400 mb-3" />
                        <p className="text-sm text-slate-600 mb-1">사진을 드래그하거나 클릭하여 업로드</p>
                        <p className="text-xs text-slate-400">정면 얼굴이 잘 나온 일상 사진을 권장합니다</p>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      
                      {images.length > 0 && (
                        <div className="flex gap-2 mt-4">
                          {images.map((img, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                              <img src={img} alt="upload" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-0 right-0 bg-black/50 text-white p-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={generateProfile}
                      disabled={isGenerating || images.length === 0}
                      className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ backgroundColor: VW_BLUE }}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          생성 중입니다...
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          프로필 사진 생성하기
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Result Section */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" style={{ color: VW_BLUE }} />
                    생성 결과
                  </h2>

                  {!results && !isGenerating && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                        <Camera className="w-10 h-10" />
                      </div>
                      <p>정보를 입력하고 사진을 생성해보세요.</p>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-blue-600" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">생성 중입니다...</p>
                        <p className="text-sm text-slate-500 mt-1">잠시만 기다려주세요 (약 10~20초 소요)</p>
                      </div>
                    </div>
                  )}

                  {results && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { id: 'front', label: 'FRONT', img: results.front },
                        { id: 'side', label: 'SIDE', img: results.side },
                        { id: 'full', label: 'FULL', img: results.full }
                      ].map((res) => (
                        <motion.div 
                          key={res.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="group relative bg-gray-50 rounded-xl overflow-hidden border border-gray-200"
                        >
                          <div className="aspect-[3/4] overflow-hidden relative">
                            <img src={res.img} alt={res.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            <div className="absolute top-2 left-2 bg-white/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-900">
                              {res.label}
                            </div>
                          </div>
                          <div className="p-4 bg-white border-t border-gray-100">
                            <button 
                              onClick={() => downloadImage(res.img, `VW_Profile_${res.id}_${name}.png`)}
                              className="w-full py-2 rounded-lg border border-gray-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              다운로드
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: VW_BLUE }}>
                  <History className="w-6 h-6" />
                  생성 히스토리
                </h2>
                <p className="text-sm text-slate-500">총 {history.length}개의 기록이 있습니다.</p>
              </div>

              {history.length === 0 ? (
                <div className="bg-white rounded-2xl p-20 text-center border border-gray-100 shadow-sm">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-500">아직 생성된 프로필 사진이 없습니다.</p>
                  <button 
                    onClick={() => setActiveTab('studio')}
                    className="mt-6 text-blue-600 font-semibold flex items-center gap-1 mx-auto hover:underline"
                  >
                    첫 프로필 생성하기 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {history.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-8">
                      {/* Left Info */}
                      <div className="lg:w-1/4 flex flex-col justify-between">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.name}</h3>
                          <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              {item.dealer}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              {item.showroom}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mb-8">
                            <span className="px-3 py-1 bg-gray-100 text-slate-600 text-xs rounded-md font-medium">
                              {BACKGROUNDS.find(b => b.id === item.background)?.name} 배경
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-slate-600 text-xs rounded-md font-medium">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => deleteHistory(item.id)}
                              className="p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors border-2 border-blue-600"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                            <button 
                              onClick={() => downloadAll(item)}
                              className="flex-1 py-4 px-6 bg-[#F0F7FF] text-[#0066B3] rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                            >
                              <Download className="w-5 h-5" />
                              전체 다운로드
                            </button>
                          </div>
                      </div>

                      {/* Right Images */}
                      <div className="lg:w-3/4 grid grid-cols-3 gap-4">
                        {[
                          { label: 'FRONT', img: item.image_front },
                          { label: 'SIDE', img: item.image_side },
                          { label: 'FULL', img: item.image_full }
                        ].map((pic, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-100 aspect-[3/4]">
                            <img src={pic.img} alt={pic.label} className="w-full h-full object-cover" />
                            <div className="absolute top-3 left-3 bg-white/90 px-2 py-1 rounded text-[10px] font-extrabold text-slate-900 tracking-wider">
                              {pic.label}
                            </div>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => downloadImage(pic.img, `VW_History_${item.name}_${pic.label}.png`)}
                                className="bg-white text-slate-900 p-2 rounded-full shadow-lg"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t border-gray-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">© 2026 Volkswagen Korea AI Photo Studio. All rights reserved.</p>
          <p className="text-slate-300 text-[10px] mt-2">본 서비스는 폭스바겐 코리아 세일즈 컨설턴트 전용 도구입니다.</p>
        </div>
      </footer>
    </div>
  );
}
