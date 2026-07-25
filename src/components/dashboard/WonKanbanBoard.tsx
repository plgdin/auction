// @ts-nocheck
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GripVertical, FileText, Edit3, Trash2, Plus,
  Download, ClipboardCheck, ChevronDown, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { storageService } from '../../services/storageService';

// ─── Stage Configuration ───────────────────────────────────────────────

export type KanbanStage = 'won' | 'documents' | 'inventory' | 'completed';

interface StageConfig {
  id: KanbanStage;
  label: string;
  color: string;       // Tailwind color prefix (e.g. "blue")
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  headerTextClass: string;
  dotClass: string;
}

const STAGES: StageConfig[] = [
  {
    id: 'won',
    label: 'Won',
    color: 'blue',
    bgClass: 'bg-blue-50/40',
    borderClass: 'border-blue-200/60',
    badgeClass: 'bg-blue-100 text-blue-700',
    headerTextClass: 'text-blue-900',
    dotClass: 'bg-blue-500',
  },
  {
    id: 'documents',
    label: 'Documents Pending',
    color: 'amber',
    bgClass: 'bg-amber-50/40',
    borderClass: 'border-amber-200/60',
    badgeClass: 'bg-amber-100 text-amber-700',
    headerTextClass: 'text-amber-900',
    dotClass: 'bg-amber-500',
  },
  {
    id: 'inventory',
    label: 'Inventory Check',
    color: 'purple',
    bgClass: 'bg-purple-50/40',
    borderClass: 'border-purple-200/60',
    badgeClass: 'bg-purple-100 text-purple-700',
    headerTextClass: 'text-purple-900',
    dotClass: 'bg-purple-500',
  },
  {
    id: 'completed',
    label: 'Completed',
    color: 'emerald',
    bgClass: 'bg-emerald-50/40',
    borderClass: 'border-emerald-200/60',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    headerTextClass: 'text-emerald-900',
    dotClass: 'bg-emerald-500',
  },
];

// ─── Persistence Helpers ───────────────────────────────────────────────

function getStageMap(userId: string): Record<string, KanbanStage> {
  try {
    const raw = localStorage.getItem(`usr_kanban_stages_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStageMap(userId: string, map: Record<string, KanbanStage>): void {
  localStorage.setItem(`usr_kanban_stages_${userId}`, JSON.stringify(map));
}

// ─── Props ─────────────────────────────────────────────────────────────

export interface WonKanbanBoardProps {
  userId: string;
  wonList: any[];
  onEdit: (item: any) => void;
  onDelete: (itemId: string) => void;
  onAddNew: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────

export function WonKanbanBoard({
  userId,
  wonList,
  onEdit,
  onDelete,
  onAddNew,
}: WonKanbanBoardProps) {
  const [stageMap, setStageMap] = useState<Record<string, KanbanStage>>(() =>
    getStageMap(userId)
  );
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanStage | null>(null);

  // Mobile accordion: which columns are expanded
  const [expandedColumns, setExpandedColumns] = useState<Set<KanbanStage>>(
    () => new Set(['won', 'documents', 'inventory', 'completed'])
  );

  // Persist stage map whenever it changes
  useEffect(() => {
    saveStageMap(userId, stageMap);
  }, [userId, stageMap]);

  // Bucket items into stages
  const buckets = STAGES.map((stage) => ({
    ...stage,
    items: wonList.filter((item) => (stageMap[item.id] || 'won') === stage.id),
  }));

  // ─── Drag Handlers ────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string) => {
      setDraggedItemId(itemId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);
      // Add a slight delay to show the drag ghost properly
      requestAnimationFrame(() => {
        const el = document.getElementById(`kanban-card-${itemId}`);
        if (el) el.style.opacity = '0.4';
      });
    },
    []
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      setDraggedItemId(null);
      setDropTarget(null);
      const el = document.getElementById(`kanban-card-${e.dataTransfer.getData('text/plain')}`);
      if (el) el.style.opacity = '1';
      // Restore all card opacities
      document.querySelectorAll('[data-kanban-card]').forEach((card) => {
        (card as HTMLElement).style.opacity = '1';
      });
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, stageId: KanbanStage) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(stageId);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStage: KanbanStage) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('text/plain');
      if (itemId) {
        setStageMap((prev) => ({ ...prev, [itemId]: targetStage }));
      }
      setDraggedItemId(null);
      setDropTarget(null);
    },
    []
  );

  // Mobile accordion toggle
  const toggleColumn = useCallback((stageId: KanbanStage) => {
    setExpandedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div>
      {/* Desktop: horizontal columns */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        {buckets.map((col) => (
          <KanbanColumn
            key={col.id}
            stage={col}
            items={col.items}
            isDropTarget={dropTarget === col.id}
            draggedItemId={draggedItemId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddNew={col.id === 'won' ? onAddNew : undefined}
          />
        ))}
      </div>

      {/* Mobile: stacked accordion sections */}
      <div className="md:hidden space-y-3">
        {buckets.map((col) => (
          <div key={col.id} className={`rounded-xl border ${col.borderClass} overflow-hidden`}>
            <button
              onClick={() => toggleColumn(col.id)}
              className={`w-full flex items-center justify-between px-4 py-3 ${col.bgClass} cursor-pointer`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${col.dotClass}`} />
                <span className={`text-sm font-bold ${col.headerTextClass}`}>
                  {col.label}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${col.badgeClass}`}>
                  {col.items.length}
                </span>
              </div>
              {expandedColumns.has(col.id) ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedColumns.has(col.id) && (
              <div className="p-3 space-y-2 bg-white">
                {col.items.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-medium">
                    No auctions in this stage
                  </div>
                ) : (
                  col.items.map((item) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      isDragging={false}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))
                )}
                {col.id === 'won' && col.items.length === 0 && (
                  <button
                    onClick={onAddNew}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Register First Auction
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Column Component ──────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: StageConfig & { items: any[] };
  items: any[];
  isDropTarget: boolean;
  draggedItemId: string | null;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, stageId: KanbanStage) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stageId: KanbanStage) => void;
  onEdit: (item: any) => void;
  onDelete: (itemId: string) => void;
  onAddNew?: () => void;
}

function KanbanColumn({
  stage,
  items,
  isDropTarget,
  draggedItemId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onEdit,
  onDelete,
  onAddNew,
}: KanbanColumnProps) {
  return (
    <div
      className={`rounded-xl border transition-all duration-200 flex flex-col min-h-[320px] ${
        isDropTarget
          ? `${stage.borderClass} ring-2 ring-offset-1 ring-${stage.color}-300/50 ${stage.bgClass}`
          : `border-slate-200 bg-slate-50/30`
      }`}
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column Header */}
      <div className={`px-3.5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${stage.dotClass}`} />
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
            {stage.label}
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${stage.badgeClass}`}>
          {items.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className="p-2.5 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {items.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed transition-colors ${
              isDropTarget
                ? `${stage.borderClass} ${stage.bgClass}`
                : 'border-slate-200/80 bg-slate-50/50'
            }`}
          >
            <p className="text-[11px] text-slate-400 font-semibold text-center px-4">
              {isDropTarget ? 'Drop here' : 'Drag auctions here'}
            </p>
            {onAddNew && !isDropTarget && (
              <button
                onClick={onAddNew}
                className="mt-3 flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Auction
              </button>
            )}
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              isDragging={draggedItemId === item.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Card Component ────────────────────────────────────────────────────

interface KanbanCardProps {
  item: any;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onEdit: (item: any) => void;
  onDelete: (itemId: string) => void;
}

function KanbanCard({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: KanbanCardProps) {
  return (
    <div
      id={`kanban-card-${item.id}`}
      data-kanban-card
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
      className={`group bg-white rounded-xl border border-slate-150 p-3 cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:border-slate-250 ${
        isDragging ? 'opacity-40 shadow-lg scale-[1.02] rotate-1' : ''
      }`}
    >
      {/* Drag Handle + Title Row */}
      <div className="flex items-start gap-2">
        <div className="pt-0.5 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
            {item.title}
          </h4>
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
        <span className="text-[10px] font-bold font-mono text-slate-400 truncate max-w-[50%]">
          {item.reference_number || 'N/A'}
        </span>
        <span className="text-[10px] font-extrabold text-slate-700">
          {item.closing_bid
            ? `₹${item.closing_bid.toLocaleString('en-IN')}`
            : '—'}
        </span>
      </div>

      {/* Document Status */}
      <div className="flex items-center gap-1.5 mt-2 text-[10px]">
        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
        <span className={`truncate font-medium ${item.document_name ? 'text-slate-600' : 'text-slate-400 italic'}`}>
          {item.document_name || 'No document'}
        </span>
      </div>

      {/* Action Row (visible on hover) */}
      <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          to={`/dashboard/inventory?auctionId=${item.id}`}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ClipboardCheck className="w-3 h-3" /> Checklist
        </Link>

        {item.document_url && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const storagePath = storageService.extractStoragePath(item.document_url);
              storageService.downloadPrivateFile(
                'auction_documents',
                storagePath,
                item.document_name || 'document.pdf'
              );
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Download Document"
          >
            <Download className="w-3 h-3" />
          </button>
        )}

        {item.isManual && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default WonKanbanBoard;
