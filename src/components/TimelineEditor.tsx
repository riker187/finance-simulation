import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { DEFAULT_SITUATION_CATEGORY } from '../types';
import { addMonths, monthsBetween, formatMonthShort, sortMonths } from '../utils/months';

const CELL_W = 56; // px per month cell
const CELL_H = 36; // px per row
const LABEL_W = 210; // px for situation name column

export function TimelineEditor() {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const paintEntries = useStore((s) => s.paintEntries);
  const reorderSituations = useStore((s) => s.reorderSituations);

  const scenario = scenarios.find((s) => s.id === activeScenarioId);

  // Paint state
  const [isPainting, setIsPainting] = useState(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add');
  const [paintSitId, setPaintSitId] = useState<string | null>(null);
  const [paintAnchor, setPaintAnchor] = useState<string | null>(null);
  const [paintCurrent, setPaintCurrent] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ sitId: string; month: string } | null>(null);

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropIndex !== index) setDropIndex(index);
  };
  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) reorderSituations(dragIndex, index);
    setDragIndex(null);
    setDropIndex(null);
  };

  const isPaintingRef = useRef(false);
  const paintModeRef = useRef<'add' | 'remove'>('add');
  const paintSitIdRef = useRef<string | null>(null);
  const paintAnchorRef = useRef<string | null>(null);
  const paintCurrentRef = useRef<string | null>(null);

  // Keep refs in sync with state (needed for document mouseup handler)
  useEffect(() => {
    isPaintingRef.current = isPainting;
  }, [isPainting]);
  useEffect(() => {
    paintModeRef.current = paintMode;
  }, [paintMode]);
  useEffect(() => {
    paintSitIdRef.current = paintSitId;
  }, [paintSitId]);
  useEffect(() => {
    paintAnchorRef.current = paintAnchor;
  }, [paintAnchor]);
  useEffect(() => {
    paintCurrentRef.current = paintCurrent;
  }, [paintCurrent]);

  const commitPaint = useCallback(() => {
    const sitId = paintSitIdRef.current;
    const anchor = paintAnchorRef.current;
    const current = paintCurrentRef.current ?? anchor;
    if (!sitId || !anchor || !current) return;

    const [start, end] = sortMonths(anchor, current);
    const months = monthsBetween(start, end);
    paintEntries(sitId, months, paintModeRef.current);
  }, [paintEntries]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isPaintingRef.current) {
        commitPaint();
        setIsPainting(false);
        setPaintSitId(null);
        setPaintAnchor(null);
        setPaintCurrent(null);
      }
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [commitPaint]);

  if (!scenario) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        Kein Szenario ausgewählt.
      </div>
    );
  }

  const endMonth = addMonths(scenario.startMonth, scenario.durationMonths - 1);
  const months = monthsBetween(scenario.startMonth, endMonth);

  const groupedSituations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; index: number }[]>();
    situations.forEach((sit, index) => {
      const category = sit.category?.trim() || DEFAULT_SITUATION_CATEGORY;
      const group = map.get(category);
      const item = { id: sit.id, name: sit.name, color: sit.color, index };
      if (group) {
        group.push(item);
      } else {
        map.set(category, [item]);
      }
    });
    return [...map.entries()];
  }, [situations]);

  // For each situation, compute committed active months
  const getActiveMonths = (sitId: string): Set<string> => {
    const set = new Set<string>();
    for (const entry of scenario.entries) {
      if (entry.situationId !== sitId) continue;
      for (const m of monthsBetween(entry.startMonth, entry.endMonth)) {
        if (m >= scenario.startMonth && m <= endMonth) set.add(m);
      }
    }
    return set;
  };

  // Compute preview active state (including in-progress paint)
  const isCellActive = (sitId: string, month: string, committed: Set<string>): boolean => {
    if (!isPainting || paintSitId !== sitId || !paintAnchor || !paintCurrent) {
      return committed.has(month);
    }
    const [start, end] = sortMonths(paintAnchor, paintCurrent);
    const inRange = month >= start && month <= end;
    if (paintMode === 'add') return committed.has(month) || inRange;
    return committed.has(month) && !inRange;
  };

  const handleCellMouseDown = (sitId: string, month: string, committed: Set<string>) => {
    const active = committed.has(month);
    setIsPainting(true);
    setPaintMode(active ? 'remove' : 'add');
    setPaintSitId(sitId);
    setPaintAnchor(month);
    setPaintCurrent(month);
  };

  const handleCellMouseEnter = (sitId: string, month: string) => {
    setHoverCell({ sitId, month });
    if (isPainting && paintSitId === sitId) {
      setPaintCurrent(month);
    }
  };

  // Month header grouping: show year label when month is January
  const yearLabels: { index: number; year: number }[] = [];
  months.forEach((m, i) => {
    const year = parseInt(m.split('-')[0]);
    if (i === 0 || parseInt(months[i - 1].split('-')[0]) !== year) {
      yearLabels.push({ index: i, year });
    }
  });

  return (
    <div className="select-none" onMouseLeave={() => setHoverCell(null)}>
      <div style={{ minWidth: LABEL_W + months.length * CELL_W }}>
        {/* Sticky header (year + month row remain visible while scrolling) */}
        <div className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800">
          <div className="flex" style={{ height: 20 }}>
            <div style={{ width: LABEL_W }} />
            <div className="relative flex-1">
              {yearLabels.map(({ index, year }) => (
                <span
                  key={year}
                  className="absolute text-xs text-slate-500 font-medium"
                  style={{ left: index * CELL_W + 2, top: 2 }}
                >
                  {year}
                </span>
              ))}
            </div>
          </div>

          <div className="flex border-t border-slate-800" style={{ height: CELL_H }}>
            <div
              className="shrink-0 flex items-center px-3 text-xs font-medium text-slate-500 uppercase tracking-wide"
              style={{ width: LABEL_W }}
            >
              Situation
            </div>
            {months.map((m) => (
              <div
                key={m}
                className="shrink-0 flex items-center justify-center text-xs text-slate-500 border-l border-slate-800"
                style={{ width: CELL_W }}
              >
                {formatMonthShort(m)}
              </div>
            ))}
          </div>
        </div>

        {/* Situation rows */}
        {situations.length === 0 && (
          <div className="py-8 text-center text-slate-600 text-sm">
            Erstelle zuerst Situationen in der linken Seitenleiste.
          </div>
        )}

        {groupedSituations.map(([category, rows]) => (
          <div key={category}>
            <div className="flex border-b border-slate-800/60 bg-slate-900/70" style={{ height: 24 }}>
              <div
                className="shrink-0 flex items-center px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                style={{ width: LABEL_W }}
              >
                {category}
              </div>
              <div className="flex-1" />
            </div>

            {rows.map((sit) => {
              const committed = getActiveMonths(sit.id);
              const isDragging = dragIndex === sit.index;
              const isDropTarget = dropIndex === sit.index && dragIndex !== null && dragIndex !== sit.index;

              return (
                <div
                  key={sit.id}
                  className={`flex border-b transition-colors ${
                    isDragging
                      ? 'opacity-30 border-slate-800/50'
                      : isDropTarget
                      ? 'border-t-2 border-blue-500 bg-blue-500/5'
                      : 'border-slate-800/50 hover:bg-slate-800/20'
                  }`}
                  style={{ height: CELL_H }}
                  onDragOver={(e) => handleDragOver(e, sit.index)}
                  onDrop={(e) => handleDrop(e, sit.index)}
                >
                  {/* Situation label - draggable */}
                  <div
                    className="shrink-0 flex items-center gap-2 px-2 cursor-grab active:cursor-grabbing"
                    style={{ width: LABEL_W }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, sit.index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span
                      className="text-slate-600 hover:text-slate-400 text-xs shrink-0 leading-none"
                      title="Verschieben"
                    >
                      ⠿
                    </span>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sit.color }} />
                    <span className="text-xs text-slate-300 truncate">{sit.name}</span>
                  </div>

                  {/* Month cells */}
                  {months.map((month) => {
                    const active = isCellActive(sit.id, month, committed);
                    const isHovered = hoverCell?.sitId === sit.id && hoverCell?.month === month;
                    const isPaintingThisCell =
                      isPainting &&
                      paintSitId === sit.id &&
                      paintAnchor &&
                      paintCurrent &&
                      month >= sortMonths(paintAnchor, paintCurrent)[0] &&
                      month <= sortMonths(paintAnchor, paintCurrent)[1];

                    return (
                      <div
                        key={month}
                        className="shrink-0 relative border-l border-slate-800/50 cursor-crosshair"
                        style={{ width: CELL_W, height: CELL_H }}
                        onMouseDown={() => handleCellMouseDown(sit.id, month, committed)}
                        onMouseEnter={() => handleCellMouseEnter(sit.id, month)}
                      >
                        {/* Active fill */}
                        {active && (
                          <div
                            className="absolute inset-y-1 inset-x-0.5 rounded transition-opacity"
                            style={{
                              backgroundColor: sit.color,
                              opacity: isPaintingThisCell && paintMode === 'remove' ? 0.25 : 0.75,
                            }}
                          />
                        )}
                        {/* Paint preview for add mode */}
                        {!active && isPaintingThisCell && paintMode === 'add' && (
                          <div
                            className="absolute inset-y-1 inset-x-0.5 rounded"
                            style={{ backgroundColor: sit.color, opacity: 0.5 }}
                          />
                        )}
                        {/* Hover highlight for empty cells */}
                        {!active && !isPainting && isHovered && (
                          <div
                            className="absolute inset-y-1 inset-x-0.5 rounded border border-dashed"
                            style={{ borderColor: sit.color, opacity: 0.4 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}

        {/* Hint */}
        {situations.length > 0 && (
          <div className="px-4 py-2 text-xs text-slate-600 italic">
            Klicken & Ziehen auf Monate zum Aktivieren/Deaktivieren · ⠿ Zeilen verschieben zum Umsortieren.
          </div>
        )}
      </div>
    </div>
  );
}
