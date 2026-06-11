import { useEffect, useState, useMemo } from 'react';
import { Filter, X, ChevronRight, ChevronDown, CalendarDays } from 'lucide-react';
import { auctionService } from '../../services/auctionService';
import type { AuctionCategory } from '../../types/database.types';
import clsx from 'clsx';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { formatDateRange } from 'little-date';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AuctionFiltersProps {
  onFilterChange: (filters: { 
    categoryIds?: string[]; 
    listingType?: string; 
    regionalOffice?: string; 
    location?: string; 
    preBid?: string; 
    startDate?: string; 
    endDate?: string; 
  }) => void;
  isOpen: boolean;
  onClose: () => void;
  initialFilters: { 
    categoryIds?: string[]; 
    listingType?: string; 
    regionalOffice?: string; 
    location?: string; 
    preBid?: string; 
    startDate?: string; 
    endDate?: string; 
  };
}

interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
  children: CategoryNode[];
}

export function AuctionFilters({ onFilterChange, isOpen, onClose, initialFilters }: AuctionFiltersProps) {
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedListingType, setSelectedListingType] = useState<string>(initialFilters.listingType || 'all');
  const [selectedRegionalOffice, setSelectedRegionalOffice] = useState<string>(initialFilters.regionalOffice || '');
  const [selectedLocation, setSelectedLocation] = useState<string>(initialFilters.location || '');
  const [selectedPreBid, setSelectedPreBid] = useState<string>(initialFilters.preBid || 'all');
  const [startDate, setStartDate] = useState<string>(initialFilters.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialFilters.endDate || '');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadCategories() {
      const data = await auctionService.getCategories();
      setCategories(data);
    }
    loadCategories();
  }, []);

  // Sync state with initialFilters when props change
  useEffect(() => {
    setSelectedListingType(initialFilters.listingType || 'all');
    setSelectedRegionalOffice(initialFilters.regionalOffice || '');
    setSelectedLocation(initialFilters.location || '');
    setSelectedPreBid(initialFilters.preBid || 'all');
    setStartDate(initialFilters.startDate || '');
    setEndDate(initialFilters.endDate || '');

    if (initialFilters.categoryIds && initialFilters.categoryIds.length > 0) {
      setSelectedCategories(initialFilters.categoryIds);
    } else {
      setSelectedCategories([]);
    }
  }, [initialFilters, categories]);

  // Auto-expand ancestors of selected categories when they change
  useEffect(() => {
    if (selectedCategories.length === 0 || selectedCategories.length === categories.length || categories.length === 0) return;
    
    const newExpanded = { ...expandedIds };
    let foundAny = false;
    
    selectedCategories.forEach(id => {
      let currentId: string | null = id;
      while (currentId) {
        const cat = categories.find(c => c.id === currentId);
        if (cat && cat.parent_id) {
          if (!newExpanded[cat.parent_id]) {
            newExpanded[cat.parent_id] = true;
            foundAny = true;
          }
          currentId = cat.parent_id;
        } else {
          break;
        }
      }
    });
    
    if (foundAny) {
      setExpandedIds(newExpanded);
    }
  }, [selectedCategories, categories]);

  const mainCategoryNames = [
    'Agricultural Produce',
    'Plant/Machineries',
    'Transport Vehicles',
    'Immovable Property',
    'Electrical Items',
    'Minerals',
    'Metal'
  ];

  const buildCategoryTree = (flatList: AuctionCategory[]): CategoryNode[] => {
    const map = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];

    flatList.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    flatList.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const isDescendantSelected = (node: CategoryNode, selectedIds: string[]): boolean => {
    if (selectedIds.includes(node.id)) return true;
    if (node.children) {
      return node.children.some(child => isDescendantSelected(child, selectedIds));
    }
    return false;
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const rootNodes = buildCategoryTree(categories);

  const sortedRoots = [...rootNodes].sort((a, b) => {
    const aMain = mainCategoryNames.includes(a.name);
    const bMain = mainCategoryNames.includes(b.name);
    if (aMain && !bMain) return -1;
    if (!aMain && bMain) return 1;
    return a.name.localeCompare(b.name);
  });

  const displayedRoots = showAllCategories 
    ? sortedRoots 
    : [
        ...sortedRoots.slice(0, 6),
        ...sortedRoots.filter((c, index) => index >= 6 && isDescendantSelected(c, selectedCategories))
      ];

  const getSelectionState = (node: CategoryNode): 'checked' | 'unchecked' | 'indeterminate' => {
    const getDescendants = (n: CategoryNode): string[] => {
      let ids = [n.id];
      if (n.children) {
        n.children.forEach(child => {
          ids = [...ids, ...getDescendants(child)];
        });
      }
      return ids;
    };

    const descendantIds = getDescendants(node);
    const checkedCount = descendantIds.filter(id => selectedCategories.includes(id)).length;

    if (checkedCount === 0) {
      return 'unchecked';
    } else if (checkedCount === descendantIds.length) {
      return 'checked';
    } else {
      return 'indeterminate';
    }
  };

  const handleToggleCategory = (node: CategoryNode) => {
    const getDescendants = (n: CategoryNode): string[] => {
      let ids = [n.id];
      if (n.children) {
        n.children.forEach(child => {
          ids = [...ids, ...getDescendants(child)];
        });
      }
      return ids;
    };

    const descendantIds = getDescendants(node);

    setSelectedCategories(prev => {
      const selectionState = getSelectionState(node);
      if (selectionState === 'checked') {
        // Deselect node and all descendants
        return prev.filter(id => !descendantIds.includes(id));
      } else {
        // Select node and all descendants
        const toAdd = descendantIds.filter(id => !prev.includes(id));
        return [...prev, ...toAdd];
      }
    });
  };

  const isAllSelected = categories.length > 0 && selectedCategories.length === categories.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categories.map(c => c.id));
    }
  };

  const handleApply = () => {
    onFilterChange({
      categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
      listingType: selectedListingType !== 'all' ? selectedListingType : undefined,
      regionalOffice: selectedRegionalOffice || undefined,
      location: selectedLocation || undefined,
      preBid: selectedPreBid !== 'all' ? selectedPreBid : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    if (window.innerWidth < 1024) onClose();
  };

  const handleReset = () => {
    setSelectedCategories([]);
    setSelectedListingType('all');
    setSelectedRegionalOffice('');
    setSelectedLocation('');
    setSelectedPreBid('all');
    setStartDate('');
    setEndDate('');
    onFilterChange({});
  };

  const renderCategoryNode = (node: CategoryNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedIds[node.id];
    const selectionState = getSelectionState(node);
    const isSelected = selectionState === 'checked' || selectionState === 'indeterminate';

    return (
      <div key={node.id} className="select-none">
        <div 
          className={clsx(
            "group flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150",
            isSelected 
              ? "bg-primary-50/50 font-medium text-slate-900" 
              : "hover:bg-slate-50 text-slate-600 hover:text-slate-955"
          )}
          style={{ paddingLeft: `${Math.max(8, depth * 12)}px` }}
          onClick={() => {
            handleToggleCategory(node);
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id, e);
                }}
                className="p-0.5 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            
            <span className={clsx(
              "flex-shrink-0 flex items-center justify-center rounded transition-colors duration-150",
              hasChildren ? "" : "pl-5"
            )}>
              {selectionState === 'checked' ? (
                <span className="w-4 h-4 rounded border border-primary bg-primary flex-shrink-0 duration-150 transition-colors" />
              ) : selectionState === 'indeterminate' ? (
                <span className="w-4 h-4 rounded border border-primary/70 bg-primary/70 flex items-center justify-center transition-all flex-shrink-0 duration-150">
                  <span className="w-2 h-0.5 bg-white" />
                </span>
              ) : (
                <span className="w-4 h-4 rounded border border-slate-300 group-hover:border-slate-450 bg-white flex-shrink-0 duration-150 transition-colors" />
              )}
            </span>
            
            <span className="text-sm leading-relaxed truncate">{node.name}</span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="relative border-l border-slate-100 ml-4 pl-1 my-0.5 space-y-0.5">
            {node.children.map(child => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const REGIONAL_OFFICES = [
    'North - New Delhi',
    'West - Mumbai',
    'East - Kolkata',
    'South - Chennai',
    'Central - Nagpur'
  ];

  const LOCATIONS = [
    'Delhi',
    'Maharashtra',
    'West Bengal',
    'Tamil Nadu',
    'Karnataka',
    'Gujarat',
    'Uttar Pradesh'
  ];

  const regionalOfficeItems = [
    { key: '', label: 'All Regional Offices' },
    ...REGIONAL_OFFICES.map(office => ({ key: office, label: office }))
  ];

  const regionalOfficeMenu = {
    items: regionalOfficeItems.map(item => ({
      key: item.key,
      label: (
        <span className={clsx("block px-2 py-1 text-sm font-medium text-slate-700 hover:text-primary transition-colors", selectedRegionalOffice === item.key && "font-bold text-primary bg-slate-50 rounded")}>
          {item.label}
        </span>
      ),
      onClick: () => setSelectedRegionalOffice(item.key)
    }))
  };

  const locationItems = [
    { key: '', label: 'All Locations' },
    ...LOCATIONS.map(loc => ({ key: loc, label: loc }))
  ];

  const locationMenu = {
    items: locationItems.map(item => ({
      key: item.key,
      label: (
        <span className={clsx("block px-2 py-1 text-sm font-medium text-slate-700 hover:text-primary transition-colors", selectedLocation === item.key && "font-bold text-primary bg-slate-50 rounded")}>
          {item.label}
        </span>
      ),
      onClick: () => setSelectedLocation(item.key)
    }))
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
          <div className="space-y-1">
            <div 
              className={clsx(
                "group flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150",
                isAllSelected 
                  ? "bg-primary-50/50 font-medium text-slate-900" 
                  : "hover:bg-slate-50 text-slate-600 hover:text-slate-955"
              )}
              onClick={handleSelectAll}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 flex items-center justify-center rounded pl-5">
                  {isAllSelected ? (
                    <span className="w-4 h-4 rounded border border-primary bg-primary flex-shrink-0 duration-150 transition-colors" />
                  ) : (
                    <span className="w-4 h-4 rounded border border-slate-300 group-hover:border-slate-450 bg-white flex-shrink-0 duration-150 transition-colors" />
                  )}
                </span>
                <span className="text-sm leading-relaxed truncate">All Categories</span>
              </div>
            </div>

            {displayedRoots.map(root => renderCategoryNode(root))}

            {rootNodes.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-sm font-semibold text-primary hover:text-primary-700 focus:outline-none mt-3 pl-2 flex items-center gap-1"
              >
                {showAllCategories ? 'Show Less' : `+ Show ${rootNodes.length - 6} More`}
              </button>
            )}

            {selectedCategories.length > 0 && !isAllSelected && (
              <div className="mt-4 p-3 bg-primary-50/40 border border-primary-100 rounded-xl text-xs space-y-1 text-slate-600">
                <div className="font-bold flex items-center gap-1.5 text-primary">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
                  Multi-Category Filter Active
                </div>
                <p className="leading-relaxed">
                  You can select multiple categories and subcategories. Subcategories are automatically included when selecting parent categories.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Filter By */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Filter By</h3>
          <div className="space-y-3">
            {[
              { label: 'All Upcoming Auctions', value: 'all' },
              { label: 'Registration Closes Soon', value: 'closes_soon' },
              { label: 'Recently Added', value: 'recently_added' },
            ].map((option) => (
              <label key={option.value} className="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="listingType" 
                  checked={selectedListingType === option.value}
                  onChange={() => setSelectedListingType(option.value)}
                  className="w-4 h-4 accent-primary border-slate-300 focus:ring-primary"
                />
                <span className="ml-3 text-sm text-slate-700">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Regional Office */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Regional Office</h3>
          <Dropdown menu={regionalOfficeMenu} trigger={['click']}>
            <button 
              type="button"
              className="w-full flex justify-between items-center px-3 py-2 border border-slate-300 rounded-md shadow-sm bg-white text-sm text-slate-700 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-left"
            >
              <span className="truncate">
                {selectedRegionalOffice || 'All Regional Offices'}
              </span>
              <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
            </button>
          </Dropdown>
        </div>

        {/* Location */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Location</h3>
          <Dropdown menu={locationMenu} trigger={['click']}>
            <button 
              type="button"
              className="w-full flex justify-between items-center px-3 py-2 border border-slate-300 rounded-md shadow-sm bg-white text-sm text-slate-700 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-left"
            >
              <span className="truncate">
                {selectedLocation || 'All Locations'}
              </span>
              <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
            </button>
          </Dropdown>
        </div>

        {/* Pre-bid Requirement */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Pre-Bid Requirement</h3>
          <div className="space-y-3">
            {[
              { label: 'All', value: 'all' },
              { label: 'Pre-bid Required', value: 'yes' },
              { label: 'No Pre-bid Required', value: 'no' },
            ].map((option) => (
              <label key={option.value} className="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="preBid" 
                  checked={selectedPreBid === option.value}
                  onChange={() => setSelectedPreBid(option.value)}
                  className="w-4 h-4 accent-primary border-slate-300 focus:ring-primary"
                />
                <span className="ml-3 text-sm text-slate-700">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Auction Date Range</h3>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full flex justify-between items-center px-3 py-2 border border-slate-300 rounded-md shadow-sm bg-white text-sm text-slate-700 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-left"
              >
                <span className="truncate">
                  {startDate && endDate
                    ? formatDateRange(new Date(startDate), new Date(endDate), { includeTime: false })
                    : startDate
                      ? `From ${new Date(startDate).toLocaleDateString()}`
                      : 'Select date range'}
                </span>
                <CalendarDays className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start" sideOffset={4}>
              <Calendar
                mode="range"
                selected={{
                  from: startDate ? new Date(startDate) : undefined,
                  to: endDate ? new Date(endDate) : undefined,
                } as DateRange}
                captionLayout="dropdown"
                onSelect={(range: DateRange | undefined) => {
                  if (range?.from) {
                    const y = range.from.getFullYear();
                    const m = String(range.from.getMonth() + 1).padStart(2, '0');
                    const d = String(range.from.getDate()).padStart(2, '0');
                    setStartDate(`${y}-${m}-${d}`);
                  } else {
                    setStartDate('');
                  }
                  if (range?.to) {
                    const y = range.to.getFullYear();
                    const m = String(range.to.getMonth() + 1).padStart(2, '0');
                    const d = String(range.to.getDate()).padStart(2, '0');
                    setEndDate(`${y}-${m}-${d}`);
                  } else {
                    setEndDate('');
                  }
                }}
              />
            </PopoverContent>
          </Popover>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="mt-2 text-xs text-primary hover:text-primary-700 font-medium"
            >
              Clear dates
            </button>
          )}
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
