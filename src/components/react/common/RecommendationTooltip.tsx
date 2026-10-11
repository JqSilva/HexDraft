import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface RecommendationTooltipProps {
  name: string;
  score: number;
  reasons?: string[];
  isBan?: boolean;
  children: React.ReactNode;
  className?: string;
  placement?: 'top' | 'bottom';
  delayMs?: number;
}

export const RecommendationTooltip: React.FC<RecommendationTooltipProps> = ({
  name,
  score,
  reasons = [],
  isBan = false,
  children,
  className = '',
  placement = 'top',
  delayMs = 60,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; actualPlacement: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    actualPlacement: placement,
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    
    // Ancho y alto estimados si aún no está montado/medido
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 270;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 120;
    const padding = 12;

    // Calcular posición horizontal centrada con respecto al trigger
    let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    // Clamping horizontal dentro de los límites del viewport
    const maxLeft = window.innerWidth - tooltipWidth - padding;
    left = Math.max(padding, Math.min(left, maxLeft));

    // Decidir placement vertical según el espacio disponible en pantalla
    let actualPlacement: 'top' | 'bottom' = placement;
    if (placement === 'top') {
      if (triggerRect.top - tooltipHeight - 8 < padding) {
        actualPlacement = 'bottom';
      }
    } else {
      if (triggerRect.bottom + tooltipHeight + 8 > window.innerHeight - padding) {
        actualPlacement = 'top';
      }
    }

    let top = 0;
    if (actualPlacement === 'top') {
      top = triggerRect.top - tooltipHeight - 8;
    } else {
      top = triggerRect.bottom + 8;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      actualPlacement,
    });
  }, [placement]);

  const handleOpen = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delayMs);
  }, [delayMs]);

  const handleClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(false);
  }, []);

  // Recalcular posición cuando se abre o tras montar el nodo del tooltip
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Un segundo pase con requestAnimationFrame para medir dimensiones reales del DOM
      const raf = requestAnimationFrame(() => {
        updatePosition();
      });

      const handleScrollOrResize = () => {
        updatePosition();
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Determinar color semántico del score según diseño Quiet Arcana
  const getScoreStyle = (val: number) => {
    if (val >= 8) {
      return {
        text: 'text-status-success',
        badge: 'bg-status-success/15 border border-status-success/35 text-status-success',
      };
    }
    if (val >= 6) {
      return {
        text: 'text-status-warning',
        badge: 'bg-status-warning/15 border border-status-warning/35 text-status-warning',
      };
    }
    return {
      text: 'text-status-danger',
      badge: 'bg-status-danger/15 border border-status-danger/35 text-status-danger',
    };
  };

  const scoreStyle = getScoreStyle(score);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
        aria-describedby={isOpen ? tooltipId : undefined}
        className={`inline-flex ${className}`}
      >
        {children}
      </div>

      {isOpen && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="fixed z-[9999] pointer-events-none w-64 sm:w-72 max-w-[calc(100vw-24px)] rounded-lg bg-ink-900 border border-ink-700 p-3 shadow-2xl shadow-black/90 transition-opacity duration-150 ease-out select-none animate-in fade-in zoom-in-95"
          >
            {/* Header: Campeón y Score */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-sans font-semibold text-sm text-text-strong tracking-tight truncate">
                  {name}
                </span>
                {isBan && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-status-danger bg-status-danger/15 border border-status-danger/30 px-1.5 py-0.2 rounded shrink-0">
                    Baneo
                  </span>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-1">
                <span className="text-[10px] font-mono text-text-muted">score</span>
                <span
                  className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${scoreStyle.badge}`}
                >
                  {score.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Separador de whitespace Quiet Arcana */}
            <div className="mt-2.5 pt-2 border-t border-ink-700/60">
              {reasons && reasons.length > 0 ? (
                <ul className="space-y-1.5">
                  {reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-left">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-muted mt-1.5 shrink-0" />
                      <span className="font-sans text-xs text-text-secondary leading-snug">
                        {reason}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-sans text-xs text-text-muted italic leading-snug">
                  {isBan
                    ? 'Prioridad de bloqueo estratégico según composición y emparejamientos.'
                    : 'Recomendación calculada por sinergias y ventaja posicional.'}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default RecommendationTooltip;
