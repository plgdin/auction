import { Recycle, Factory, Truck, Building2, Cpu, Gem, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const categories = [
  { name: 'Scrap & Scrap Material', icon: Recycle, count: '150+', mstcCategory: 'Metal' },
  { name: 'Plant & Machinery', icon: Factory, count: '85+', mstcCategory: 'Plant/Machineries' },
  { name: 'Vehicles', icon: Truck, count: '320+', mstcCategory: 'Transport Vehicles' },
  { name: 'Real Estate', icon: Building2, count: '45+', mstcCategory: 'Immovable Property' },
  { name: 'E-Waste', icon: Cpu, count: '12+', mstcCategory: 'Electronics Items' },
  { name: 'Minerals & Ores', icon: Gem, count: '28+', mstcCategory: 'Minerals' },
];

export function ServiceCategoriesSection() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Explore by Category</h2>
          <p className="mt-4 text-lg text-slate-600">
            Browse our extensive catalog of auctions and tenders organized by industry sector.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.name}
                to={`/auctions?tab=mstc&mstc_category=${encodeURIComponent(category.mstcCategory)}`}
                className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-primary-600/50 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary-600 transition-all duration-300">
                  <Icon className="w-7 h-7 text-primary-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors flex items-center gap-2">
                  {category.name}
                </h3>
                <p className="text-slate-500 font-medium">
                  {category.count} Active listings
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            to="/auctions"
            className="group inline-flex items-center justify-center px-8 py-3.5 border-2 border-primary-600 text-base font-bold rounded-xl text-primary-600 hover:bg-primary-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary-600/20"
          >
            Explore More Categories
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
          </Link>
        </div>
      </div>
    </section>
  );
}
