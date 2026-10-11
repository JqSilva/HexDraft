import React, { memo } from 'react';
import { PlayerSlot } from './PlayerSlot';
import type { LcuPlayer } from './PlayerSlot';

interface TeamSidebarProps {
  team: LcuPlayer[];
  isEnemy?: boolean;
  isPlaying: boolean;
  isCompact: boolean;
}

export const TeamSidebar = memo(({ team, isEnemy = false, isPlaying, isCompact }: TeamSidebarProps) => {
  const sidebarClass = isEnemy
    ? `shrink space-y-2.5 text-right column-transition ${isPlaying ? 'enemy-off-screen' : (isCompact ? 'w-16' : 'w-64 xl:w-72')}`
    : `shrink space-y-2.5 column-transition ${isPlaying ? 'ally-off-screen' : (isCompact ? 'w-16' : 'w-64 xl:w-72')}`;

  return (
    <div className={sidebarClass}>
      {!isPlaying && (
        isEnemy ? (
          <div className="flex items-center justify-end gap-2 px-1 pb-1">
            {!isCompact && (
              <span className="text-text-primary text-xs font-semibold uppercase tracking-wider font-sans">
                Enemigos
              </span>
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-status-danger shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
            {!isCompact && (
              <span className="text-text-primary text-xs font-semibold uppercase tracking-wider font-sans">
                Tu Equipo
              </span>
            )}
          </div>
        )
      )}
      <div className="space-y-2.5">
        {team.map((player, i) => (
          <PlayerSlot
            key={`${isEnemy ? 'enemy' : 'ally'}-${i}`}
            player={player}
            isEnemy={isEnemy}
            compact={isCompact && !isPlaying}
          />
        ))}
      </div>
    </div>
  );
});

TeamSidebar.displayName = 'TeamSidebar';

export default TeamSidebar;
