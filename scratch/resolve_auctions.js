import * as fs from 'fs';

let content = fs.readFileSync('src/pages/Auctions.tsx', 'utf8');

// Define the conflict blocks and their resolutions.
// We search for conflict blocks using regex and replace them.

// Conflict 1: State declarations (around line 144)
const conflict1Pattern = /<<<<<<< HEAD\r?\n=======\r?\n\s+const \[mstcAuctions, setMstcAuctions\] = useState<MstcSanitizedAuction\[]>\(\[]\);\r?\n\s+const \[isMstcLoading, setIsMstcLoading] = useState\(false\);\r?\n\s+const \[mstcOptions, setMstcOptions] = useState<[\s\S]*?>\([\s\S]*?\);\r?\n\s+const \[selectedPreviewItem, setSelectedPreviewItem] = useState<[\s\S]*?>\(null\);\r?\n\s+const \[copied, setCopied] = useState\(false\);\r?\n\s+const \[previewTab, setPreviewTab] = useState<[\s\S]*?>\('summary'\);\r?\n\s+const selectedMstcCategory = searchParams\.get\('mstc_category'\) \|\| '';\r?\n\s+const selectedMstcLocation = searchParams\.get\('mstc_location'\) \|\| '';\r?\n>>>>>>> [a-f0-9]+/;

const conflict1Replacement = `  const [mstcAuctions, setMstcAuctions] = useState<MstcSanitizedAuction[]>([]);
  const [isMstcLoading, setIsMstcLoading] = useState(false);
  const [mstcOptions, setMstcOptions] = useState<{ categories: string[]; sellers: string[]; locations: string[] }>({
    categories: [],
    sellers: [],
    locations: []
  });

  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewTab, setPreviewTab] = useState<'summary' | 'pdf'>('summary');

  const selectedMstcCategory = searchParams.get('mstc_category') || '';
  const selectedMstcLocation = searchParams.get('mstc_location') || '';`;

// Since regex on large blocks can be tricky, let's use exact substring search for each conflict block to be extremely safe!
// We will split the file by conflict markers and rebuild it.

const parts = content.split(/<<<<<<< HEAD\r?\n/);
console.log(`Split file into ${parts.length} parts based on HEAD conflict marker.`);

if (parts.length !== 11) {
  console.error('Expected exactly 10 conflict blocks, found:', parts.length - 1);
  process.exit(1);
}

let resolved = parts[0];

// Block 1 (around line 144)
// HEAD is empty, THEIRS has the states.
let block1 = parts[1].split(/=======\r?\n/);
let block1Theirs = block1[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
resolved += block1Theirs[0] + block1Theirs[1];

// Block 2 (around line 184)
// HEAD has filters and isAnyFilterActive, THEIRS has sync useEffects.
// We keep HEAD.
let block2 = parts[2].split(/=======\r?\n/);
let block2Head = block2[0];
let block2Theirs = block2[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
resolved += block2Head + block2Theirs[1];

// Block 3 (around line 304)
// HEAD has URL-based setSearchParams, THEIRS has setPage and local state.
// We keep HEAD.
let block3 = parts[3].split(/=======\r?\n/);
let block3Head = block3[0];
let block3Theirs = block3[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
resolved += block3Head + block3Theirs[1];

// Block 4 (around line 421)
// HEAD has relative gradient header, THEIRS has description text.
// We merge them (keep HEAD's gradient layout and add THEIRS's description p-tag).
let block4 = parts[4].split(/=======\r?\n/);
let block4Theirs = block4[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
const mergedHeader = `      <div className="relative bg-slate-900 overflow-hidden py-12">
        {/* Background decoration */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-white mb-2">Auctions Marketplace</h1>
          <p className="text-slate-400 mb-6">Browse live commercial auctions and official government catalogs.</p>
`;
resolved += mergedHeader + block4Theirs[1];

// Block 5 (around line 475)
// HEAD has plain search placeholder, THEIRS has tab-aware placeholder.
// We keep THEIRS.
let block5 = parts[5].split(/=======\r?\n/);
let block5Theirs = block5[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
resolved += block5Theirs[0] + block5Theirs[1];

// Block 6 (around line 498)
// HEAD has sidebar filters and mobile toggle. THEIRS wraps them in activeTab === 'commercial' check.
// We merge them by wrapping HEAD's sidebar and toggle in activeTab === 'commercial' check.
let block6 = parts[6].split(/=======\r?\n/);
let block6Theirs = block6[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
const mergedFilters = `          {/* Sidebar Filters (only for commercial auctions tab) */}
          {activeTab === 'commercial' && (
            <>
              {/* Mobile Filter Toggle */}
              <div className="lg:hidden flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <button 
                  onClick={() => setIsFiltersOpen(true)}
                  className="flex items-center text-slate-700 font-medium"
                >
                  <SlidersHorizontal className="w-5 h-5 mr-2" />
                  Filters
                </button>
                <div className="text-sm text-slate-500">
                  {!isAnyFilterActive ? '0 results' : \`\${totalCount} results\`}
                </div>
              </div>

              {/* Sidebar Filters */}
              <div className="lg:w-1/4 shrink-0">
                <AuctionFilters 
                  isOpen={isFiltersOpen} 
                  onClose={() => setIsFiltersOpen(false)} 
                  onFilterChange={handleFilterChange}
                  initialFilters={filters}
                />
                {/* Overlay for mobile filters */}
                {isFiltersOpen && (
                  <div 
                    className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
                    onClick={() => setIsFiltersOpen(false)}
                  />
                )}
              </div>
            </>
          )}
`;
resolved += mergedFilters + block6Theirs[1];

// Block 7 & 8 (around lines 553 and 604)
// Block 7 starts toolbar (HEAD has sorting select/grid layout, THEIRS wraps it in activeTab === 'commercial').
// Block 8 is the split continuation of this toolbar.
// Let's resolve Block 7 & Block 8 together by cleanly injecting the complete commercial toolbar and tab filters.
let block7 = parts[7].split(/=======\r?\n/);
let block7Theirs = block7[1].split(/>>>>>>> [a-f0-9]+\r?\n/);

let block8 = parts[8].split(/=======\r?\n/);
let block8Theirs = block8[1].split(/>>>>>>> [a-f0-9]+\r?\n/);

// We replace the whole toolbar code up to the grid.
// In block7, resolved was building up to Block 7's conflict marker.
// Let's see what is between Block 7's conflict end and Block 8's conflict start.
// Looking at the view_file, between the end of block 7 and start of block 8, we have:
// "            </div>\n\n            {/* Auction Grid/List */}"
// Let's look at what block7Theirs[1] is. It is the text after the end of conflict 7 and before the start of conflict 8.
// Since block 7 and 8 are split parts of the commercial toolbar, let's check what is in block7Theirs[1].
// Let's replace the whole region from Block 7 start to Block 8 end with a clean merged toolbar.
// What was in HEAD for Conflict 7:
// sorting controls, view switcher buttons.
// What was in THEIRS for Conflict 7 & 8:
// wrappers and dropdowns.
// Let's print out what we resolve for Block 7 and Block 8.
const resolvedToolbar = `            {/* Toolbar */}
            {activeTab === 'commercial' ? (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="hidden lg:block text-sm text-slate-600 font-medium">
                  {!isAnyFilterActive ? (
                    <span>Please select a filter to view auctions</span>
                  ) : (
                    <span>Showing {auctions.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, totalCount)} of {totalCount} auctions</span>
                  )}
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      handleSortChange(e.target.value as any);
                    }}
                    className="w-full sm:w-auto pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    <option value="newest">Recently Added</option>
                    <option value="ending_soon">Ending Soon</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>

                  <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
                    <button
                      onClick={() => setIsGridView(true)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors",
                        isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors",
                        !isGridView ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Filter Government Catalogs</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600 font-medium bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                      Total Matching: <strong className="text-slate-900 font-bold">{mstcAuctions.length}</strong>
                    </span>
                    <span className="text-sm text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-xs animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      PDF Previews Available: <strong className="text-emerald-900 font-bold">{mstcAuctions.filter(item => item.sanitized_document_path).length}</strong>
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                    <select
                      value={selectedMstcCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newParams = new URLSearchParams(searchParams);
                        if (val) {
                          newParams.set('mstc_category', val);
                        } else {
                          newParams.delete('mstc_category');
                        }
                        setSearchParams(newParams);
                      }}
                      className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-primary focus:border-primary text-slate-750 bg-white"
                    >
                      <option value="">All Categories</option>
                      {mstcOptions.categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location / State</label>
                    <select
                      value={selectedMstcLocation}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newParams = new URLSearchParams(searchParams);
                        if (val) {
                          newParams.set('mstc_location', val);
                        } else {
                          newParams.delete('mstc_location');
                        }
                        setSearchParams(newParams);
                      }}
                      className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-primary focus:border-primary text-slate-750 bg-white"
                    >
                      <option value="">All Locations</option>
                      {mstcOptions.locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>
`;

// block8Theirs[1] starts after Conflict 8 end marker.
resolved += resolvedToolbar + block8Theirs[1];

// Block 9 (around line 748)
// HEAD has pagination, THEIRS has MSTC catalog filter card closing tags and commercial search results start.
// We keep THEIRS because it closes the card correctly. The pagination is rendered later in the commercial tab grid anyway.
let block9 = parts[9].split(/=======\r?\n/);
let block9Theirs = block9[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
resolved += block9Theirs[0] + block9Theirs[1];

// Block 10 (around line 831)
// HEAD has page number map buttons for mobile view. THEIRS has empty because mobile view doesn't render page numbers (only Prev/Next).
// We keep THEIRS (empty) to keep mobile pagination clean and uncluttered.
let block10 = parts[10].split(/=======\r?\n/);
let block10Theirs = block10[1].split(/>>>>>>> [a-f0-9]+\r?\n/);
resolved += block10Theirs[0] + block10Theirs[1];

// Write out the resolved file
fs.writeFileSync('src/pages/Auctions.tsx', resolved, 'utf8');
console.log('Successfully resolved all conflicts in src/pages/Auctions.tsx');
