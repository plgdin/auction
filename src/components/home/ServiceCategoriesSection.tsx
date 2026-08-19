import { useEffect, useState } from 'react';
import { Recycle, Factory, Truck, Building2, Cpu, Gem, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const initialCategories = [
  { name: 'Scrap & Material', icon: Recycle, defaultCount: 450, mstcCategory: 'Metal', desc: 'Ferrous, non-ferrous metals and industrial scrap lots.', desktopDesc: 'Browse verified ferrous and non-ferrous metal lots, production scrap, and industrial material clearances from government and institutional sellers.' },
  { name: 'Plant & Machinery', icon: Factory, defaultCount: 380, mstcCategory: 'Plant/Machineries', desc: 'Heavy manufacturing gear, CNC machines, and factory plants.', desktopDesc: 'Find heavy manufacturing equipment, CNC machines, processing lines, and complete factory plants offered through verified liquidation auctions.' },
  { name: 'Vehicles & Fleet', icon: Truck, defaultCount: 520, mstcCategory: 'Transport Vehicles', desc: 'Commercial trucks, fleet logistics, and utility vehicles.', desktopDesc: 'Explore commercial trucks, transport fleets, utility vehicles, and other movable assets released by public agencies and major institutions.' },
  { name: 'Commercial Real Estate', icon: Building2, defaultCount: 240, mstcCategory: 'Immovable Property', desc: 'Warehouses, industrial land, and office buildings.', desktopDesc: 'Review warehouses, industrial plots, office buildings, and other commercial properties with auction details, locations, and seller information.' },
  { name: 'E-Waste & Electronics', icon: Cpu, defaultCount: 190, mstcCategory: 'Electronics Items', desc: 'IT equipment, servers, telecom hardware, and devices.', desktopDesc: 'Source servers, IT equipment, telecom hardware, and electronic devices from organized e-waste and surplus asset auctions.' },
  { name: 'Minerals & Ores', icon: Gem, defaultCount: 130, mstcCategory: 'Minerals', desc: 'Mining rights, raw ores, bauxite, and coal reserves.', desktopDesc: 'Explore mineral rights, raw ores, bauxite, coal reserves, and other resource lots with clear auction timelines and listing information.' },
];

function formatCount(rawCount: number): string {
  if (rawCount <= 0) return '0';
  if (rawCount < 100) {
    const tens = Math.floor(rawCount / 10) * 10;
    return tens > 0 ? `${tens}+` : `${rawCount}`;
  }
  // Round to nearest 100 (e.g. 403 -> 400+, 520 -> 500+)
  const hundreds = Math.floor(rawCount / 100) * 100;
  return `${hundreds}+`;
}

export function ServiceCategoriesSection() {
  const [countsMap, setCountsMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchCounts() {
      try {
        // Query live mstc_auctions table for exact category counts
        const { data: mstcRows } = await supabase
          .from('mstc_auctions')
          .select('category');

        if (mstcRows && mstcRows.length > 0) {
          const map: Record<string, number> = {};
          mstcRows.forEach((row: any) => {
            const cat = row.category || 'Other';
            map[cat] = (map[cat] || 0) + 1;
          });
          setCountsMap(map);
          return;
        }

        // Try RPC fallback for current category counts
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_current_category_totals');
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          const map: Record<string, number> = {};
          rpcData.forEach((item: any) => {
            if (item.category_name) {
              map[item.category_name] = Number(item.count) || 0;
            }
          });
          setCountsMap(map);
          return;
        }

        // Fallback to category_daily_stats
        const { data: statsData } = await supabase
          .from('category_daily_stats')
          .select('category_name, items_added');
          
        if (statsData && statsData.length > 0) {
          const map: Record<string, number> = {};
          statsData.forEach((item: any) => {
            const cat = item.category_name || '';
            map[cat] = (map[cat] || 0) + (item.items_added || 0);
          });
          setCountsMap(map);
        }
      } catch (e) {
        console.error('Error loading dynamic category counts:', e);
      }
    }
    fetchCounts();
  }, []);

  const getCategoryCount = (mstcCategory: string, defaultCount: number): string => {
    let total = 0;
    let found = false;
    const searchKey = mstcCategory.toLowerCase();

    Object.entries(countsMap).forEach(([catName, count]) => {
      const lower = catName.toLowerCase();
      if (lower.includes(searchKey) || searchKey.includes(lower)) {
        total += count;
        found = true;
      }
    });

    const countToFormat = found && total > 0 ? total : defaultCount;
    return formatCount(countToFormat);
  };

  return (
    <section className="py-16 sm:py-24 bg-slate-50/70 border-y border-slate-200/60 relative overflow-hidden">
      <div className="max-w-[1440px] lg:max-w-none mx-auto px-6 sm:px-8 lg:px-16 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Explore by Category
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Discover verified government catalogs, bank properties, and commercial liquidation lots.
          </p>
        </div>

        {/* Mobile Left-Right Horizontal Slider */}
        <div className="flex sm:hidden overflow-x-auto snap-x snap-mandatory gap-4 -my-4 py-4 pb-6 -mx-6 px-6 hide-scrollbar">
          {initialCategories.map((category) => {
            const Icon = category.icon;
            const formattedCount = getCategoryCount(category.mstcCategory, category.defaultCount);

            return (
              <Link
                key={category.name}
                to={`/auctions?tab=mstc&mstc_category=${encodeURIComponent(category.mstcCategory)}`}
                className="group bg-white p-7 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between relative overflow-hidden w-[88vw] max-w-[400px] min-h-[290px] shrink-0 snap-center"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-2xs">
                      <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors">
                      {formattedCount} Listings
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>{category.name}</span>
                    <ArrowUpRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary shrink-0 ml-2" />
                  </h3>
                  
                  <p className="text-sm text-slate-500 leading-relaxed font-normal mb-4">
                    {category.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                  <span>Browse Category</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Tablet & Desktop Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8">
          {initialCategories.map((category) => {
            const Icon = category.icon;
            const formattedCount = getCategoryCount(category.mstcCategory, category.defaultCount);

            return (
              <Link
                key={category.name}
                to={`/auctions?tab=mstc&mstc_category=${encodeURIComponent(category.mstcCategory)}`}
                className="group bg-white p-8 min-h-[300px] rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-2xs">
                      <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors">
                      {formattedCount} Listings
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>{category.name}</span>
                    <ArrowUpRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary shrink-0 ml-2" />
                  </h3>
                  
                  <p className="text-sm text-slate-500 leading-relaxed font-normal mb-4">
                    {category.desktopDesc}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                  <span>Browse Category</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            to="/auctions"
            className="group inline-flex items-center justify-center px-8 py-4 border border-transparent text-sm sm:text-base font-bold rounded-2xl text-white bg-primary hover:bg-primary/95 transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/45 hover:-translate-y-0.5 cursor-pointer"
          >
            View All Marketplace Categories
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </div>
      </div>
    </section>
  );
}
