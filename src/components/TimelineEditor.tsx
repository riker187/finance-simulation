import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../store';
import type { FinancialEffect } from '../types';
import { DEFAULT_SITUATION_CATEGORY } from '../types';
import { addMonths, monthsBetween, formatMonthShort, sortMonths } from '../utils/months';

const CELL_W = 56;
const CELL_H = 36;
const EFFECT_CELL_H = 30;
const LABEL_W = 210;

function formatCellAmt(n: number): string {
  const a = Math.abs(n);
  if (a === 0) return '';
  const sign = n < 0 ? '−' : '';
  if (a >= 10_000) return `${sign}${Math.round(a / 1_000)}k`;
  if (a >= 1_000) {
    const k = a / 1_000;
    return `${sign}${k % 1 === 0 ? k : k.toFixed(1).replace('.', ',')}k`;
  }
  return `${sign}${Math.round(a)}`;
}

type PaintTarget =
  | { kind: 'situation'; situationId: string }
  | { kind: 'effect'; situationId: string; effectId: string };

function targetKey(target: PaintTarget): string {
  return target.kind === 'situation'
    ? `s:${target.situationId}`
    : `e:${target.situationId}:${target.effectId}`;
}

export function TimelineEditor() {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const paintEntries = useStore((s) => s.paintEntries);
  const paintEffectEntries = useStore((s) => s.paintEffectEntries);
  const reorderSituations = useStore((s) => s.reorderSituations);

  const scenario = scenarios.find((s) => s.id === activeScenarioId);

  const [isPainting, setIsPainting] = useState(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add');
  const [paintTarget, setPaintTarget] = useState<PaintTarget | null>(null);
  const [paintAnchor, setPaintAnchor] = useState<string | null>(null);
  const [paintCurrent, setPaintCurrent] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ target: string; month: string } | null>(null);
  const [expandedSituations, setExpandedSituations] = useState<Set<string>>(() => new Set());

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
  const paintTargetRef = useRef<PaintTarget | null>(null);
  const paintAnchorRef = useRef<string | null>(null);
  const paintCurrentRef = useRef<string | null>(null);

  useEffect(() => {
    isPaintingRef.current = isPainting;
  }, [isPainting]);
  useEffect(() => {
    paintModeRef.current = paintMode;
  }, [paintMode]);
  useEffect(() => {
    paintTargetRef.current = paintTarget;
  }, [paintTarget]);
  useEffect(() => {
    paintAnchorRef.current = paintAnchor;
  }, [paintAnchor]);
  useEffect(() => {
    paintCurrentRef.current = paintCurrent;
  }, [paintCurrent]);

  const commitPaint = useCallback(() => {
    const target = paintTargetRef.current;
    const anchor = paintAnchorRef.current;
    const current = paintCurrentRef.current ?? anchor;
    if (!target || !anchor || !current) return;

    const [start, end] = sortMonths(anchor, current);
    const months = monthsBetween(start, end);

    if (target.kind === 'situation') {
      paintEntries(target.situationId, months, paintModeRef.current);
    } else {
      paintEffectEntries(target.situationId, target.effectId, months, paintModeRef.current);
    }
  }, [paintEntries, paintEffectEntries]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isPaintingRef.current) {
        commitPaint();
        setIsPainting(false);
        setPaintTarget(null);
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

  const annotationsByMonth = new Map<string, string>(
    (scenario.annotations ?? []).map((a) => [a.month, a.text]),
  );

  const groupedSituations = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; color: string; effects: FinancialEffect[]; index: number }[]
    >();

    situations.forEach((sit, index) => {
      const category = sit.category?.trim() || DEFAULT_SITUATION_CATEGORY;
      const group = map.get(category);
      const item = { id: sit.id, name: sit.name, color: sit.color, effects: sit.effects, index };
      if (group) {
        group.push(item);
      } else {
        map.set(category, [item]);
      }
    });

    return [...map.entries()];
  }, [situations]);

  const getSituationActiveMonths = (situationId: string): Set<string> => {
    const set = new Set<string>();
    for (const entry of scenario.entries) {
      if (entry.situationId !== situationId) continue;
      for (const month of monthsBetween(entry.startMonth, entry.endMonth)) {
        if (month >= scenario.startMonth && month <= endMonth) set.add(month);
      }
    }
    return set;
  };

  const getEffectDisabledMonths = (situationId: string, effectId: string): Set<string> => {
    const set = new Set<string>();
    for (const entry of scenario.effectEntries) {
      if (entry.situationId !== situationId || entry.effectId !== effectId) continue;
      for (const month of monthsBetween(entry.startMonth, entry.endMonth)) {
        if (month >= scenario.startMonth && month <= endMonth) set.add(month);
      }
    }
    return set;
  };

  const isCellActive = (target: PaintTarget, month: string, committed: Set<string>): boolean => {
    if (!isPainting || !paintTarget || !paintAnchor || !paintCurrent || targetKey(paintTarget) !== targetKey(target)) {
      return committed.has(month);
    }

    const [start, end] = sortMonths(paintAnchor, paintCurrent);
    const inRange = month >= start && month <= end;
    if (paintMode === 'add') return committed.has(month) || inRange;
    return committed.has(month) && !inRange;
  };

  const startPaint = (target: PaintTarget, month: string, committed: Set<string>) => {
    const active = committed.has(month);
    setIsPainting(true);
    setPaintMode(active ? 'remove' : 'add');
    setPaintTarget(target);
    setPaintAnchor(month);
    setPaintCurrent(month);
  };

  const handleCellMouseEnter = (target: PaintTarget, month: string) => {
    setHoverCell({ target: targetKey(target), month });
    if (isPainting && paintTarget && targetKey(paintTarget) === targetKey(target)) {
      setPaintCurrent(month);
    }
  };

  const toggleExpanded = (situationId: string) => {
    setExpandedSituations((prev) => {
      const next = new Set(prev);
      if (next.has(situationId)) {
        next.delete(situationId);
      } else {
        next.add(situationId);
      }
      return next;
    });
  };

  const yearLabels: { index: number; year: number }[] = [];
  months.forEach((month, index) => {
    const year = parseInt(month.split('-')[0], 10);
    if (index === 0 || parseInt(months[index - 1].split('-')[0], 10) !== year) {
      yearLabels.push({ index, year });
    }
  });

  return (
    <div className="select-none" onMouseLeave={() => setHoverCell(null)}>
      <div style={{ minWidth: LABEL_W + months.length * CELL_W }}>
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
            {months.map((month) => {
              const annText = annotationsByMonth.get(month);
              return (
                <div
                  key={month}
                  className="shrink-0 relative flex items-center justify-center text-xs text-slate-500 border-l border-slate-800"
                  style={{ width: CELL_W }}
                >
                  {formatMonthShort(month)}
                  {annText && (
                    <span
                      className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-slate-400"
                      title={annText}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
              const committed = getSituationActiveMonths(sit.id);
              const rowTarget: PaintTarget = { kind: 'situation', situationId: sit.id };
              const rowTargetKey = targetKey(rowTarget);
              const isDragging = dragIndex === sit.index;
              const isDropTarget = dropIndex === sit.index && dragIndex !== null && dragIndex !== sit.index;
              const isExpanded = expandedSituations.has(sit.id);

              const effectOverrides = sit.effects
                .map((effect) => ({ effectId: effect.id, months: getEffectDisabledMonths(sit.id, effect.id) }))
                .filter((item) => item.months.size > 0);

              const hasAnyEffectOverrides = effectOverrides.length > 0;
              const customizedMonths = new Set<string>();

              for (const item of effectOverrides) {
                for (const month of item.months) {
                  if (committed.has(month)) customizedMonths.add(month);
                }
              }

              return (
                <div key={sit.id}>
                  <div
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
                    <div
                      className="shrink-0 flex items-center gap-2 px-2 cursor-grab active:cursor-grabbing"
                      style={{ width: LABEL_W }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, sit.index)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="text-slate-600 hover:text-slate-400 text-xs shrink-0 leading-none" title="Verschieben">
                        ⠿
                      </span>
                      {sit.effects.length > 0 ? (
                        <button
                          className="text-slate-500 hover:text-slate-200 text-[11px] leading-none w-4"
                          onClick={() => toggleExpanded(sit.id)}
                          title={isExpanded ? 'Auswirkungen einklappen' : 'Auswirkungen aufklappen'}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sit.color }} />
                      <span className="text-xs text-slate-300 truncate">{sit.name}</span>
                      {hasAnyEffectOverrides && (
                        <span className="text-[10px] text-blue-300 border border-blue-400/40 rounded px-1 py-0.5">
                          individuell
                        </span>
                      )}
                    </div>

                    {months.map((month) => {
                      const active = isCellActive(rowTarget, month, committed);
                      const isHovered = hoverCell?.target === rowTargetKey && hoverCell?.month === month;
                      const isPaintingThisCell =
                        isPainting &&
                        paintTarget &&
                        targetKey(paintTarget) === rowTargetKey &&
                        paintAnchor &&
                        paintCurrent &&
                        month >= sortMonths(paintAnchor, paintCurrent)[0] &&
                        month <= sortMonths(paintAnchor, paintCurrent)[1];

                      // Net amount for this cell (respects one-time vs recurring and effect overrides)
                      let cellNet = 0;
                      if (active) {
                        const hasEntryStart = scenario.entries.some(
                          (e) => e.situationId === sit.id && e.startMonth === month,
                        );
                        for (const effect of sit.effects) {
                          if (getEffectDisabledMonths(sit.id, effect.id).has(month)) continue;
                          if (effect.type === 'one-time' && !hasEntryStart) continue;
                          cellNet += effect.category === 'income' ? effect.amount : -effect.amount;
                        }
                      }
                      const cellLabel = formatCellAmt(cellNet);

                      return (
                        <div
                          key={month}
                          className="shrink-0 relative border-l border-slate-800/50 cursor-crosshair"
                          style={{ width: CELL_W, height: CELL_H }}
                          onMouseDown={() => startPaint(rowTarget, month, committed)}
                          onMouseEnter={() => handleCellMouseEnter(rowTarget, month)}
                        >
                          {active && (
                            <div
                              className="absolute inset-y-1 inset-x-0.5 rounded transition-opacity"
                              style={{
                                backgroundColor: sit.color,
                                opacity: isPaintingThisCell && paintMode === 'remove' ? 0.25 : 0.75,
                              }}
                            />
                          )}
                          {active && cellLabel && !(isPaintingThisCell && paintMode === 'remove') && (
                            <div className="absolute inset-y-1 inset-x-0.5 flex items-center justify-center pointer-events-none select-none">
                              <span
                                className="text-[9px] font-bold text-white leading-none"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
                              >
                                {cellLabel}
                              </span>
                            </div>
                          )}
                          {!active && isPaintingThisCell && paintMode === 'add' && (
                            <div
                              className="absolute inset-y-1 inset-x-0.5 rounded"
                              style={{ backgroundColor: sit.color, opacity: 0.5 }}
                            />
                          )}
                          {!active && !isPainting && isHovered && (
                            <div
                              className="absolute inset-y-1 inset-x-0.5 rounded border border-dashed"
                              style={{ borderColor: sit.color, opacity: 0.4 }}
                            />
                          )}
                          {customizedMonths.has(month) && (
                            <div
                              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-300 border border-slate-900"
                              title="In diesem Monat gibt es individuelle Effekt-Anpassungen"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isExpanded &&
                    sit.effects.map((effect) => {
                      const disabledMonths = getEffectDisabledMonths(sit.id, effect.id);
                      const committedEffect = new Set([...committed].filter((month) => !disabledMonths.has(month)));
                      const effectTarget: PaintTarget = {
                        kind: 'effect',
                        situationId: sit.id,
                        effectId: effect.id,
                      };
                      const effectTargetKey = targetKey(effectTarget);

                      return (
                        <div
                          key={effect.id}
                          className="flex border-b border-slate-800/40 bg-slate-900/40 hover:bg-slate-800/20"
                          style={{ height: EFFECT_CELL_H }}
                        >
                          <div
                            className="shrink-0 flex items-center gap-2 pl-8 pr-2"
                            style={{ width: LABEL_W }}
                            title={
                              disabledMonths.size > 0
                                ? 'In einzelnen Monaten deaktiviert'
                                : 'Folgt aktuell der Situation'
                            }
                          >
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: effect.category === 'income' ? '#22c55e' : '#fb7185' }}
                            >
                              {effect.category === 'income' ? '+' : '-'}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">{effect.label || 'Auswirkung'}</span>
                            {disabledMonths.size > 0 && (
                              <span className="text-[10px] text-blue-300 border border-blue-400/40 rounded px-1 py-0.5">
                                individuell
                              </span>
                            )}
                          </div>

                          {months.map((month) => {
                            const situationIsActive = committed.has(month);
                            const active = isCellActive(effectTarget, month, committedEffect);
                            const isHovered = hoverCell?.target === effectTargetKey && hoverCell?.month === month;
                            const isPaintingThisCell =
                              isPainting &&
                              paintTarget &&
                              targetKey(paintTarget) === effectTargetKey &&
                              paintAnchor &&
                              paintCurrent &&
                              month >= sortMonths(paintAnchor, paintCurrent)[0] &&
                              month <= sortMonths(paintAnchor, paintCurrent)[1];

                            return (
                              <div
                                key={month}
                                className={`shrink-0 relative border-l border-slate-800/40 ${
                                  situationIsActive ? 'cursor-crosshair' : 'cursor-not-allowed'
                                }`}
                                style={{ width: CELL_W, height: EFFECT_CELL_H }}
                                onMouseDown={() => {
                                  if (!situationIsActive) return;
                                  startPaint(effectTarget, month, committedEffect);
                                }}
                                onMouseEnter={() => handleCellMouseEnter(effectTarget, month)}
                              >
                                {!situationIsActive && <div className="absolute inset-0 bg-slate-900/60" />}
                                {situationIsActive && active && (
                                  <div
                                    className="absolute inset-y-1 inset-x-1 rounded transition-opacity"
                                    style={{
                                      backgroundColor: sit.color,
                                      opacity: isPaintingThisCell && paintMode === 'remove' ? 0.2 : 0.55,
                                    }}
                                  />
                                )}
                                {situationIsActive && active && !(isPaintingThisCell && paintMode === 'remove') && (
                                  <div className="absolute inset-y-1 inset-x-1 flex items-center justify-center pointer-events-none select-none">
                                    <span
                                      className="text-[9px] font-medium text-white leading-none"
                                      style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }}
                                    >
                                      {formatCellAmt(effect.amount)}
                                    </span>
                                  </div>
                                )}
                                {situationIsActive && !active && isPaintingThisCell && paintMode === 'add' && (
                                  <div
                                    className="absolute inset-y-1 inset-x-1 rounded"
                                    style={{ backgroundColor: sit.color, opacity: 0.4 }}
                                  />
                                )}
                                {situationIsActive && !active && !isPainting && isHovered && (
                                  <div
                                    className="absolute inset-y-1 inset-x-1 rounded border border-dashed"
                                    style={{ borderColor: sit.color, opacity: 0.35 }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ))}

        {situations.length > 0 && (
          <div className="px-4 py-2 text-xs text-slate-600 italic">
            Situationen: klicken & ziehen zum Aktivieren/Deaktivieren · ▸ Auswirkungen aufklappen und bei Bedarf einzeln steuern.
          </div>
        )}
      </div>
    </div>
  );
}
