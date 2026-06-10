import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { auctionService } from '../../services/auctionService';
import type { AuctionCategory } from '../../types/database.types';
import clsx from 'clsx';

interface AuctionFiltersProps {
  onFilterChange: (filters: { categoryId?: string; status?: string; minPrice?: number; maxPrice?: number }) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function AuctionFilters({ onFilterChange, isOpen, onClose }: AuctionFiltersProps) {
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  useEffect(() => {
    async function loadCategories() {
      const data = await auctionService.getCategories();
      setCategories(data);
    }
    loadCategories();
  }, []);

  const handleApply = () => {
    onFilterChange({
      categoryId: selectedCategory || undefined,
      status: selectedStatus || undefined,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    });
    // On mobile, close after applying
    if (window.innerWidth < 1024) onClose();
  };

  const handleReset = () => {
    setSelectedCategory('');
    setSelectedStatus('');
    setMinPrice('');
    setMaxPrice('');
    onFilterChange({});
  };

  return (
    <div className={clsx(
      "fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 overflow-y-auto",
      isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:shadow-none"
    )}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-primary" />
            Filters
          </h2>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Categories</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input 
                type="radio" 
                name="category" 
                checked={selectedCategory === ''}
                onChange={() => setSelectedCategory('')}
                className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
              />
              <span className="ml-3 text-sm text-slate-700">All Categories</span>
            </label>
            {categories.map(category => (
              <label key={category.id} className="flex items-center">
                <input 
                  type="radio" 
                  name="category" 
                  checked={selectedCategory === category.id}
                  onChange={() => setSelectedCategory(category.id)}
                  className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
                />
                <span className="ml-3 text-sm text-slate-700">{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Status</h3>
          <div className="space-y-3">
            {['', 'active', 'upcoming', 'ended'].map((status) => (
              <label key={status} className="flex items-center">
                <input 
                  type="radio" 
                  name="status" 
                  checked={selectedStatus === status}
                  onChange={() => setSelectedStatus(status)}
                  className="w-4 h-4 text-primary border-slate-300 focus:ring-primary"
                />
                <span className="ml-3 text-sm text-slate-700 capitalize">
                  {status === '' ? 'All Statuses' : status}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Starting Price (₹)</h3>
          <div className="flex items-center space-x-4">
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
            <span className="text-slate-400">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
