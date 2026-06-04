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
        ? `shrink space-y-3 text-right column-transition ${isPlaying ? 'enemy-off-screen' : (isCompact ? 'w-16' : 'w-64 xl:w-72')}`
        : `shrink space-y-3 column-transition ${isPlaying ? 'ally-off-screen' : (isCompact ? 'w-16' : 'w-64 xl:w-72')}`;

    return (
        <div className={sidebarClass}>
            {!isPlaying && (
                isEnemy ? (
                    <h3 className="text-red-400 font-black text-xs uppercase tracking-widest border-b border-border-warm pb-3 flex items-center justify-end gap-2">
                        {!isCompact && "Enemigos"}
                        <span className="w-2.5 h-px bg-red-400"></span>
                    </h3>
                ) : (
                    <h3 className="text-cyan-400 font-black text-xs uppercase tracking-widest border-b border-border-warm pb-3 flex items-center gap-2">
                        <span className="w-2.5 h-px bg-cyan-400"></span>
                        {!isCompact && "Tu Equipo"}
                    </h3>
                )
            )}
            {team.map((player, i) => (
                <PlayerSlot
                    key={`${isEnemy ? 'enemy' : 'ally'}-${i}`}
                    player={player}
                    isEnemy={isEnemy}
                    compact={isCompact && !isPlaying}
                />
            ))}
        </div>
    );
});

export default TeamSidebar;
