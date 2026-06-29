import { useEffect, useState, useRef } from 'react';
import { Filter, X, ChevronRight, ChevronDown, CalendarDays } from 'lucide-react';
import { auctionService } from '../../services/auctionService';
import { expandMstcOffice } from '../../services/publicService';
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
    subcategory?: string;
    subcategories?: string[];
    listingType?: string; 
    regionalOffice?: string; 
    regionalOffices?: string[];
    location?: string; 
    locations?: string[];
    preBid?: string; 
    startDate?: string; 
    endDate?: string;
    hasAssetDocuments?: boolean;
    hasImages?: boolean;
    isReauction?: boolean;
  }) => void;
  isOpen: boolean;
  onClose: () => void;
  initialFilters: { 
    categoryIds?: string[]; 
    subcategory?: string;
    subcategories?: string[];
    listingType?: string; 
    regionalOffice?: string; 
    regionalOffices?: string[];
    location?: string; 
    locations?: string[];
    preBid?: string; 
    startDate?: string; 
    endDate?: string;
    hasAssetDocuments?: boolean;
    hasImages?: boolean;
    isReauction?: boolean;
  };
  activeTab?: 'commercial' | 'mstc';
  customCategories?: string[];
  customSubcategories?: Record<string, string[]>;
  customLocations?: string[];
  customRegionalOffices?: string[];
}

interface CategoryNode {
  id: string;
  name: string;
  parent_id?: string;
  children: CategoryNode[];
}

export function AuctionFilters({ 
  onFilterChange, 
  isOpen, 
  onClose, 
  initialFilters,
  activeTab = 'commercial',
  customCategories = [],
  customSubcategories = {},
  customLocations = [],
  customRegionalOffices = []
}: AuctionFiltersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    initialFilters.subcategories || (initialFilters.subcategory ? [initialFilters.subcategory] : [])
  );
  const [selectedListingType, setSelectedListingType] = useState<string>(initialFilters.listingType || 'all');
  const [selectedRegionalOffices, setSelectedRegionalOffices] = useState<string[]>(
    initialFilters.regionalOffices || (initialFilters.regionalOffice ? [initialFilters.regionalOffice] : [])
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    initialFilters.locations || (initialFilters.location ? [initialFilters.location] : [])
  );
  const [selectedPreBid, setSelectedPreBid] = useState<string>(initialFilters.preBid || 'all');
  const [startDate, setStartDate] = useState<string>(initialFilters.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialFilters.endDate || '');
  const [hasAssetDocuments, setHasAssetDocuments] = useState<boolean>(initialFilters.hasAssetDocuments || false);
  const [hasImages, setHasImages] = useState<boolean>(initialFilters.hasImages || false);
  const [isReauction, setIsReauction] = useState<boolean>(initialFilters.isReauction || false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (initialFilters.startDate) return new Date(initialFilters.startDate);
    return new Date();
  });

  useEffect(() => {
    async function loadCategories() {
      const data = await auctionService.getCategories();
      setCategories(data);
    }
    loadCategories();
  }, []);

  // Sync state with initialFilters when props change
  useEffect(() => {
    setSelectedSubcategories(
      initialFilters.subcategories || (initialFilters.subcategory ? [initialFilters.subcategory] : [])
    );
    setSelectedListingType(initialFilters.listingType || 'all');
    setSelectedRegionalOffices(
      initialFilters.regionalOffices || (initialFilters.regionalOffice ? [initialFilters.regionalOffice] : [])
    );
    setSelectedLocations(
      initialFilters.locations || (initialFilters.location ? [initialFilters.location] : [])
    );
    setSelectedPreBid(initialFilters.preBid || 'all');
    setStartDate(initialFilters.startDate || '');
    setEndDate(initialFilters.endDate || '');
    setHasAssetDocuments(initialFilters.hasAssetDocuments || false);
    setHasImages(initialFilters.hasImages || false);
    setIsReauction(initialFilters.isReauction || false);

    if (initialFilters.startDate) {
      setCalendarMonth(new Date(initialFilters.startDate));
    } else {
      setCalendarMonth(new Date());
    }

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
    setExpandedIds((prev: Record<string, boolean>) => ({ ...prev, [id]: !prev[id] }));
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

  const handleMstcCategoryChange = (newCats: string[]) => {
    setSelectedCategories(newCats);
    const stillAvailable = newCats.flatMap(cat => customSubcategories[cat] || []);
    setSelectedSubcategories(prev => prev.filter(sub => stillAvailable.includes(sub)));
  };

  const handleApply = () => {
    onFilterChange({
      categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
      subcategory: selectedSubcategories[0] || undefined,
      subcategories: selectedSubcategories.length > 0 ? selectedSubcategories : undefined,
      listingType: selectedListingType !== 'all' ? selectedListingType : undefined,
      regionalOffice: selectedRegionalOffices[0] || undefined,
      regionalOffices: selectedRegionalOffices.length > 0 ? selectedRegionalOffices : undefined,
      location: selectedLocations[0] || undefined,
      locations: selectedLocations.length > 0 ? selectedLocations : undefined,
      preBid: selectedPreBid !== 'all' ? selectedPreBid : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      hasAssetDocuments: hasAssetDocuments || undefined,
      hasImages: hasImages || undefined,
      isReauction: isReauction || undefined,
    });
    if (window.innerWidth < 1024) onClose();
  };

  const handleReset = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedListingType('all');
    setSelectedRegionalOffices([]);
    setSelectedLocations([]);
    setSelectedPreBid('all');
    setStartDate('');
    setEndDate('');
    setHasAssetDocuments(false);
    setHasImages(false);
    setIsReauction(false);
    onFilterChange({
      categoryIds: [],
      subcategory: undefined,
      subcategories: [],
      listingType: 'all',
      regionalOffice: undefined,
      regionalOffices: [],
      location: undefined,
      locations: [],
      preBid: 'all',
      startDate: undefined,
      endDate: undefined,
      hasAssetDocuments: undefined,
      hasImages: undefined,
      isReauction: undefined,
    });
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

  const renderMultiSelectMenu = (
    options: { key: string; label: string }[],
    selectedValues: string[],
    onChange: (values: string[]) => void,
    placeholder: string
  ) => {
    return (
      <div 
        className="bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[200px] max-h-[240px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* "Select All / Reset" item */}
        <div 
          onClick={() => onChange([])}
          className={clsx(
            "flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors select-none",
            selectedValues.length === 0 
              ? "bg-primary-50/70 text-primary" 
              : "hover:bg-slate-50 text-slate-700 hover:text-slate-900"
          )}
        >
          <span className={clsx(
            "w-4 h-4 rounded border transition-colors flex items-center justify-center flex-shrink-0",
            selectedValues.length === 0 
              ? "border-primary bg-primary" 
              : "border-slate-300 bg-white"
          )}>
            {selectedValues.length === 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </span>
          <span>{placeholder}</span>
        </div>

        {/* Separator line */}
        <div className="h-px bg-slate-100 my-1" />

        {/* Option items */}
        {options.map(opt => {
          const isChecked = selectedValues.includes(opt.key);
          return (
            <div 
              key={opt.key}
              onClick={() => {
                if (isChecked) {
                  onChange(selectedValues.filter(val => val !== opt.key));
                } else {
                  onChange([...selectedValues, opt.key]);
                }
              }}
              className={clsx(
                "flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors select-none",
                isChecked 
                  ? "bg-primary-50/40 text-primary font-semibold" 
                  : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
              )}
            >
              <span className={clsx(
                "w-4 h-4 rounded border transition-colors flex items-center justify-center flex-shrink-0",
                isChecked 
                  ? "border-primary bg-primary" 
                  : "border-slate-300 bg-white"
              )}>
                {isChecked && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5 text-white">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="truncate">{opt.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getTriggerLabel = (
    selectedValues: string[], 
    allLabel: string, 
    labelsMap?: Record<string, string>
  ) => {
    if (selectedValues.length === 0) return allLabel;
    const firstVal = selectedValues[0];
    const firstLabel = labelsMap ? (labelsMap[firstVal] || firstVal) : firstVal;
    if (selectedValues.length === 1) return firstLabel;
    return `${firstLabel} (+${selectedValues.length - 1})`;
  };

  // Mapped options for MSTC & Commercial
  const customCategoryOptions = customCategories.map(cat => ({ key: cat, label: cat }));
  
  const availableSubcategories = selectedCategories.length > 0
    ? selectedCategories.flatMap(cat => customSubcategories[cat] || [])
    : [];

  const customSubcategoryOptions = availableSubcategories.map(sub => ({ key: sub, label: sub }));
  
  const currentRegionalOffices = activeTab === 'mstc' ? customRegionalOffices : REGIONAL_OFFICES;
  const regionalOfficeOptions = currentRegionalOffices.map(office => ({
    key: office,
    label: activeTab === 'mstc' ? expandMstcOffice(office) : office
  }));

  const currentLocations = activeTab === 'mstc' ? customLocations : LOCATIONS;
  const locationOptions = currentLocations.map(loc => ({ key: loc, label: loc }));

  const expandMstcOfficeMap = customRegionalOffices.reduce((acc, office) => {
    acc[office] = expandMstcOffice(office);
    return acc;
  }, {} as Record<string, string>);



  return (
    <div 
      ref={containerRef}
      className={clsx(
        "fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col",
        "lg:relative lg:translate-x-0 lg:w-full lg:bg-white lg:border lg:border-slate-200 lg:rounded-2xl lg:shadow-xs lg:overflow-hidden lg:h-[calc(100vh-140px)]",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:shadow-none"
      )}
    >
      {/* Scrollable Content wrapper */}
      <div className="flex-1 overflow-y-auto p-6 pb-28 scroll-smooth custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-primary" />
            Filters
          </h2>
          <button onClick={onClose} className="lg:hidden text-slate-450 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Categories */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Categories</h3>
          {activeTab === 'mstc' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                <Dropdown 
                  popupRender={() => renderMultiSelectMenu(
                    customCategoryOptions,
                    selectedCategories,
                    (cats) => handleMstcCategoryChange(cats),
                    'All Categories'
                  )}
                  trigger={['click']} 
                  placement="bottomLeft"
                  align={{ overflow: { adjustX: false, adjustY: false } }}
                  getPopupContainer={() => containerRef.current || document.body}
                >
                  <button 
                    type="button"
                    className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
                  >
                    <span className="truncate">
                      {getTriggerLabel(selectedCategories, 'All Categories')}
                    </span>
                    <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
                  </button>
                </Dropdown>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sub-Category</label>
                <Dropdown 
                  popupRender={() => renderMultiSelectMenu(
                    customSubcategoryOptions,
                    selectedSubcategories,
                    setSelectedSubcategories,
                    'All Sub-Categories'
                  )}
                  trigger={['click']} 
                  disabled={selectedCategories.length === 0}
                  placement="bottomLeft"
                  align={{ overflow: { adjustX: false, adjustY: false } }}
                  getPopupContainer={() => containerRef.current || document.body}
                >
                  <button 
                    type="button"
                    disabled={selectedCategories.length === 0}
                    className={clsx(
                      "w-full flex justify-between items-center px-3.5 py-2.5 border rounded-xl shadow-2xs text-sm transition-all text-left",
                      selectedCategories.length === 0 
                        ? "border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50" 
                        : "border-slate-250 bg-white text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    )}
                  >
                    <span className="truncate">
                      {selectedCategories.length === 0 
                        ? 'Select a category first' 
                        : getTriggerLabel(selectedSubcategories, 'All Sub-Categories')}
                    </span>
                    <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
                  </button>
                </Dropdown>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {/* Filter By - Commercial Only */}
        {activeTab === 'commercial' && (
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
        )}

        {/* Has Assets Filter - MSTC only */}
        {activeTab === 'mstc' && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Asset Attachments</h3>
            <div className="space-y-3">
              <label 
                onClick={() => setHasAssetDocuments(!hasAssetDocuments)}
                className="flex items-center cursor-pointer group"
              >
                <div
                  className={clsx(
                    "w-5 h-5 rounded border-2 transition-all duration-150 flex items-center justify-center flex-shrink-0 cursor-pointer",
                    hasAssetDocuments
                      ? "border-primary bg-primary"
                      : "border-slate-300 bg-white group-hover:border-slate-400"
                  )}
                >
                  {hasAssetDocuments && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="ml-3 text-sm text-slate-700 select-none">Has Asset Documents</span>
              </label>
              <label 
                onClick={() => setHasImages(!hasImages)}
                className="flex items-center cursor-pointer group"
              >
                <div
                  className={clsx(
                    "w-5 h-5 rounded border-2 transition-all duration-150 flex items-center justify-center flex-shrink-0 cursor-pointer",
                    hasImages
                      ? "border-primary bg-primary"
                      : "border-slate-300 bg-white group-hover:border-slate-400"
                  )}
                >
                  {hasImages && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="ml-3 text-sm text-slate-700 select-none">Has Photos / Images</span>
              </label>
            </div>
          </div>
        )}

        {/* Auction Type - MSTC only */}
        {activeTab === 'mstc' && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Auction Type</h3>
            <div className="space-y-3">
              <label 
                onClick={() => setIsReauction(!isReauction)}
                className="flex items-center cursor-pointer group"
              >
                <div
                  className={clsx(
                    "w-5 h-5 rounded border-2 transition-all duration-150 flex items-center justify-center flex-shrink-0 cursor-pointer",
                    isReauction
                      ? "border-primary bg-primary"
                      : "border-slate-300 bg-white group-hover:border-slate-400"
                  )}
                >
                  {isReauction && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="ml-3 text-sm text-slate-700 select-none">Re-auction Only</span>
              </label>
            </div>
          </div>
        )}

        {/* Regional Office */}
        {activeTab === 'mstc' ? (
          <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
                Regional Office
              </h3>
              <Dropdown 
                popupRender={() => renderMultiSelectMenu(
                  regionalOfficeOptions,
                  selectedRegionalOffices,
                  setSelectedRegionalOffices,
                  'All Regional Offices'
                )}
                trigger={['click']} 
                placement="bottomLeft"
                align={{ overflow: { adjustX: false, adjustY: false } }}
                getPopupContainer={() => containerRef.current || document.body}
              >
                <button 
                  type="button"
                  className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
                >
                  <span className="truncate">
                    {getTriggerLabel(selectedRegionalOffices, 'All Regional Offices', expandMstcOfficeMap)}
                  </span>
                  <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
                </button>
              </Dropdown>
          </div>
        ) : (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Regional Office
            </h3>
            <Dropdown 
              popupRender={() => renderMultiSelectMenu(
                regionalOfficeOptions,
                selectedRegionalOffices,
                setSelectedRegionalOffices,
                'All Regional Offices'
              )}
              trigger={['click']} 
              placement="bottomLeft"
              align={{ overflow: { adjustX: false, adjustY: false } }}
              getPopupContainer={() => containerRef.current || document.body}
            >
              <button 
                type="button"
                className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
              >
                <span className="truncate">
                  {getTriggerLabel(selectedRegionalOffices, 'All Regional Offices')}
                </span>
                <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
              </button>
            </Dropdown>
          </div>
        )}

        {/* Location */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Location</h3>
          <Dropdown 
            popupRender={() => renderMultiSelectMenu(
              locationOptions,
              selectedLocations,
              setSelectedLocations,
              'All Locations'
            )}
            trigger={['click']} 
            placement="bottomLeft"
            align={{ overflow: { adjustX: false, adjustY: false } }}
            getPopupContainer={() => containerRef.current || document.body}
          >
            <button 
              type="button"
              className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
            >
              <span className="truncate">
                {getTriggerLabel(selectedLocations, 'All Locations')}
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
                className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
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
            <PopoverContent 
              className="w-fit overflow-hidden p-0 rounded-2xl border border-slate-200 shadow-lg" 
              align="start" 
              sideOffset={4}
              side="bottom"
              avoidCollisions={true}
              container={containerRef.current}
            >
              <Calendar
                mode="range"
                selected={{
                  from: startDate ? new Date(startDate) : undefined,
                  to: endDate ? new Date(endDate) : undefined,
                } as DateRange}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
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
              className="mt-2 text-xs text-primary hover:text-primary-700 font-medium cursor-pointer"
            >
              Clear dates
            </button>
          )}
        </div>

      </div>

      {/* Floating Apply Changes Action Bar */}
      <div 
        className="absolute bottom-4 left-4 right-4 z-30 p-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg flex items-center justify-between gap-3"
      >
        <button
          onClick={handleReset}
          className="px-4 py-2 border border-slate-250 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200 cursor-pointer"
        >
          Reset
        </button>
        <button
          onClick={handleApply}
          className="px-5 py-2 text-xs font-bold rounded-lg text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
