import React, { useMemo, useState } from 'react';
import { HistoryItem, MoleProfile } from '../types';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';

interface TrendAnalysisProps {
  mole: MoleProfile;
  history: HistoryItem[];
  onClose: () => void;
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({ mole, history, onClose }) => {
  const [selectedMetric, setSelectedMetric] = useState<'isicScore' | 'glasgowScore'>('isicScore');

  // Prepare data for the graph
  const dataPoints = useMemo(() => {
    return history.map(item => ({
      date: new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      fullDate: new Date(item.timestamp).toLocaleString(),
      value: item.metrics ? item.metrics[selectedMetric] : 0,
      risk: item.metrics?.riskLevel || 'Unknown',
      img: item.imageData.base64
    }));
  }, [history, selectedMetric]);

  // Determine graph bounds
  const maxValue = selectedMetric === 'isicScore' ? 10 : 10; // Both are roughly 10 point scales
  const chartHeight = 150;
  const chartWidth = 100; // Percentage

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#DC143C] flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#DC143C]" />
              Trend Analysis: <span className="text-[#DC143C]">{mole.name}</span>
            </h2>
            <p className="text-xs text-slate-500">{history.length} assessment{history.length !== 1 ? 's' : ''} recorded</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 font-bold">✕</button>
        </div>

        <div className="p-6 overflow-y-auto">
          {history.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-slate-100 p-4 rounded-full mb-3">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Not enough data yet.</p>
              <p className="text-sm text-slate-400 mt-1">Submit at least two analyses for this mole to generate a trend graph.</p>
            </div>
          ) : (
            <>
              {/* Metric Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSelectedMetric('isicScore')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${selectedMetric === 'isicScore' ? 'bg-[#DC143C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  ISIC Risk Score
                </button>
                <button
                  onClick={() => setSelectedMetric('glasgowScore')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${selectedMetric === 'glasgowScore' ? 'bg-[#DC143C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Glasgow Score
                </button>
              </div>

              {/* Custom SVG Line Chart */}
              <div className="relative h-[200px] w-full bg-slate-50 rounded-xl border border-slate-100 p-4 mb-6">
                {/* Y-Axis Guidelines */}
                <div className="absolute inset-0 p-4 pointer-events-none flex flex-col justify-between text-[10px] text-slate-400">
                  <div className="border-b border-slate-200 border-dashed w-full h-0"></div>
                  <div className="border-b border-slate-200 border-dashed w-full h-0"></div>
                  <div className="border-b border-slate-200 border-dashed w-full h-0"></div>
                  <div className="border-b border-slate-200 border-dashed w-full h-0"></div>
                  <div className="border-b border-slate-200 border-dashed w-full h-0"></div>
                </div>

                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                   <defs>
                     <linearGradient id="gradientLine" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#DC143C" stopOpacity="0.5" />
                       <stop offset="100%" stopColor="#DC143C" stopOpacity="0" />
                     </linearGradient>
                   </defs>
                   
                   {/* Generate Path */}
                   {(() => {
                     if (dataPoints.length === 0) return null;
                     const points = dataPoints.map((pt, i) => {
                       const x = (i / (dataPoints.length - 1)) * 100;
                       const y = 100 - ((pt.value / maxValue) * 100);
                       return `${x},${y}`;
                     }).join(' ');

                     // Scale x coordinates to percentages
                     const polylinePoints = dataPoints.map((pt, i) => {
                       // Get actual width of container roughly for calculation or just use percentage-based layout logic visually
                       // For simple SVG in fluid container, using viewbox 0 0 100 100 is easier
                       return `${(i / (dataPoints.length - 1)) * 100},${100 - (pt.value / maxValue) * 100}`;
                     }).join(' ');
                     
                     return (
                        <polyline
                           points={polylinePoints}
                           fill="none"
                           stroke="#DC143C"
                           strokeWidth="3"
                           vectorEffect="non-scaling-stroke"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                        />
                     );
                   })()}

                   {/* Data Points */}
                   {dataPoints.map((pt, i) => (
                      <circle
                        key={i}
                        cx={`${(i / (dataPoints.length - 1)) * 100}%`}
                        cy={`${100 - (pt.value / maxValue) * 100}%`}
                        r="4"
                        fill="white"
                        stroke="#DC143C"
                        strokeWidth="2"
                        className="cursor-pointer hover:scale-150 transition-transform"
                      >
                        <title>{`${pt.date}: Score ${pt.value}`}</title>
                      </circle>
                   ))}
                </svg>
                
                {/* X-Axis Labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 transform translate-y-6">
                   {dataPoints.map((pt, i) => (
                     <span key={i} className="text-[10px] text-slate-500 font-medium">{pt.date}</span>
                   ))}
                </div>
              </div>

              {/* History List */}
              <h3 className="font-bold text-slate-700 mb-3">Recent Assessments for {mole.name}</h3>
              <div className="space-y-3">
                {dataPoints.slice().reverse().map((pt, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                     <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-300">
                        <img src={pt.img} alt="Thumb" className="w-full h-full object-cover" />
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between">
                            <span className="text-sm font-bold text-slate-800">{pt.fullDate}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${pt.risk === 'High' ? 'bg-red-100 text-red-700 border-red-200' : pt.risk === 'Medium' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'}`}>{pt.risk}</span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500">
                           <span>ISIC: <strong>{history[history.length - 1 - i]?.metrics?.isicScore ?? 'N/A'}</strong></span>
                           <span>Glasgow: <strong>{history[history.length - 1 - i]?.metrics?.glasgowScore ?? 'N/A'}</strong></span>
                        </div>
                     </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};