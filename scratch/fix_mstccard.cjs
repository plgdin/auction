const fs = require('fs');
let text = fs.readFileSync('src/components/auction/MstcCard.tsx', 'utf-8');

// 1. Fix import
text = text.replace(
  "import { Eye, Download, MapPin, Building2, Calendar, Clock, ShieldCheck, Landmark, Copy, Check } from 'lucide-react';",
  "import { Eye, Download, MapPin, Building2, Calendar, Clock, ShieldCheck, Landmark, Copy, Check, Heart } from 'lucide-react';"
);

// 2. Fix List View actions
const listViewOld = `              {item.sanitized_document_path ? (
                <>
                  <button
                    onClick={() => onPreview(item)}
                    className="flex-grow sm:flex-none inline-flex justify-center items-center py-2 px-5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </button>
                  <a
                    href={item.sanitized_document_path}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex justify-center items-center p-2.5 rounded-lg border border-slate-250 text-slate-655 hover:bg-slate-50 hover:border-slate-350 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Download PDF Catalog"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </>
              ) : (
                <button
                  disabled
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
                  PDF Processing...
                </button>
              )}`;

const listViewNew = `              {item.sanitized_document_path ? (
                <button
                  onClick={() => onPreview(item)}
                  className="flex-grow sm:flex-none inline-flex justify-center items-center py-2 px-5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </button>
              ) : (
                <button
                  disabled
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-450 animate-ping mr-2"></span>
                  PDF Processing...
                </button>
              )}

              {onInterestedToggle && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onInterestedToggle();
                  }}
                  className="inline-flex justify-center items-center p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-colors cursor-pointer shrink-0"
                  title={isInterested ? "Remove from interested list" : "Add to interested list"}
                >
                  <Heart className={clsx("w-4 h-4", isInterested ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
                </button>
              )}`;

text = text.replace(listViewOld.replace(/\r\n/g, '\n'), listViewNew.replace(/\r\n/g, '\n'));

fs.writeFileSync('src/components/auction/MstcCard.tsx', text);
console.log("MstcCard.tsx updated successfully.");
