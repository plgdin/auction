import { Gavel, ShoppingCart, Landmark, Plane, Monitor, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

const categories = [
  { name: 'Scrap & Scrap Material', icon: Truck, count: '150+' },
  { name: 'Plant & Machinery', icon: Monitor, count: '85+' },
  { name: 'Vehicles', icon: Plane, count: '320+' },
  { name: 'Real Estate', icon: Landmark, count: '45+' },
  { name: 'E-Waste', icon: ShoppingCart, count: '12+' },
  { name: 'Minerals & Ores', icon: Gavel, count: '28+' },
];

export function ServiceCategoriesSection() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Explore by Category</h2>
          <p className="mt-4 text-lg text-slate-600">
            Browse our extensive catalog of live auctions and tenders organized by industry sector.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.name}
                to={`/auctions?category=${category.name}`}
                className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-primary/50 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary transition-all duration-300">
                  <Icon className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                <p className="text-slate-500 font-medium">
                  {category.count} Active listings
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
