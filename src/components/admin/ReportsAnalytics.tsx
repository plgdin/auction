// @ts-nocheck
import { useState } from 'react';
import { Download, FileText, BarChart3, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

// --- MOCK DATA ---
const revenueData = [
  { date: '1', realized: 4000, expected: 6400 },
  { date: '5', realized: 3000, expected: 5398 },
  { date: '10', realized: 5000, expected: 7800 },
  { date: '15', realized: 8780, expected: 9908 },
  { date: '20', realized: 6890, expected: 8800 },
  { date: '25', realized: 9390, expected: 11800 },
  { date: '30', realized: 11490, expected: 13300 },
];

const bidVolumeData = [
  { day: 'Mon', bids: 120 },
  { day: 'Tue', bids: 230 },
  { day: 'Wed', bids: 340 },
  { day: 'Thu', bids: 280 },
  { day: 'Fri', bids: 410 },
  { day: 'Sat', bids: 150 },
  { day: 'Sun', bids: 190 },
];

const auctionCompletionData = [
  { name: 'Successful', value: 65 },
  { name: 'Failed (No Bids)', value: 20 },
  { name: 'Cancelled', value: 15 },
];
const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const userGrowthData = [
  { month: 'Jan', buyers: 400, sellers: 40 },
  { month: 'Feb', buyers: 600, sellers: 55 },
  { month: 'Mar', buyers: 900, sellers: 80 },
  { month: 'Apr', buyers: 1200, sellers: 110 },
  { month: 'May', buyers: 1600, sellers: 140 },
  { month: 'Jun', buyers: 2100, sellers: 180 },
];

const categoryPerformance = [
  { name: 'Heavy Machinery', volume: 85 },
  { name: 'Scrap Metal', volume: 65 },
  { name: 'Vehicles', volume: 55 },
  { name: 'Real Estate', volume: 40 },
  { name: 'IT Assets', volume: 30 },
];

export function ReportsAnalytics() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const handleCsvExport = () => {
    // Generate simple mock CSV for Revenue Data
    const csvContent = "data:text/csv;charset=utf-8,Date,Realized Revenue,Expected Revenue\n" 
      + revenueData.map(row => `${row.date},${row.realized},${row.expected}`).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "platform_revenue_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePdfExport = () => {
    setIsExporting(true);
    // Simulate PDF generation delay
    setTimeout(() => {
      setIsExporting(false);
      setExportMessage('PDF Report generated and emailed successfully!');
      setTimeout(() => setExportMessage(null), 3000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-primary" /> Reports & Analytics
          </h2>
          <p className="text-slate-500 text-sm mt-1">Platform performance metrics and data exports.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleCsvExport}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg flex items-center transition-colors"
          >
            <Download className="w-4 h-4 mr-2" /> CSV Export
          </button>
          <button 
            onClick={handlePdfExport}
            disabled={isExporting}
            className="px-4 py-2 bg-primary hover:bg-primary-700 text-white font-bold text-sm rounded-lg flex items-center transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Generating...' : <><FileText className="w-4 h-4 mr-2" /> PDF Report</>}
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold border border-green-200 flex items-center">
          <CheckCircle2 className="w-5 h-5 mr-2" /> {exportMessage}
        </div>
      )}

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" /> Revenue Trends (30 Days)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="expected" stroke="#94a3b8" fillOpacity={1} fill="url(#colorExpected)" name="Expected Revenue" />
                <Area type="monotone" dataKey="realized" stroke="#2563eb" fillOpacity={1} fill="url(#colorRealized)" name="Realized Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Growth */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-500" /> Platform Registration Growth
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Legend />
                <Bar dataKey="buyers" fill="#3b82f6" name="New Buyers" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sellers" fill="#8b5cf6" name="New Sellers" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bidding Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Weekly Bid Volume</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bidVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="bids" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} name="Total Bids" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Performance & Completion Rate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-md font-bold text-slate-900 mb-4 text-center">Auction Completion Rate</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={auctionCompletionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {auctionCompletionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 mt-4 flex-wrap">
              {auctionCompletionData.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-slate-600">
                  <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  {entry.name}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <h3 className="text-md font-bold text-slate-900 mb-4">Top Categories (Volume)</h3>
            <div className="space-y-4">
              {categoryPerformance.map((category, index) => (
                <div key={category.name}>
                  <div className="flex justify-between text-xs font-bold mb-1 text-slate-700">
                    <span>{category.name}</span>
                    <span>{category.volume}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${category.volume}%`, opacity: 1 - (index * 0.15) }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
