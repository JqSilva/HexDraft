import React from 'react';

interface DraftDamageBalanceProps {
  allyNames: string[];
  myTeamAnalysis: any;
}

export const DraftDamageBalance = ({ allyNames, myTeamAnalysis }: DraftDamageBalanceProps) => {
  if (!myTeamAnalysis) return null;

  const physicalPct = allyNames.length > 0 ? myTeamAnalysis.damageProfile.physicalPct : 50;
  const magicPct = allyNames.length > 0 ? myTeamAnalysis.damageProfile.magicPct : 50;
  const isBalanced = myTeamAnalysis.damageProfile.isBalanced;

  return (
    <div className="p-4 border border-border-warm/30 mb-4 bg-input-warm/20 rounded-lg">
      {/* Fila de balance de Daño */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-slate-400">
          <span>Daño Físico (AD): {physicalPct}%</span>
          <span>Daño Mágico (AP): {magicPct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-950 rounded-sm overflow-hidden flex border border-border-warm/40">
          <div
            style={{ width: `${physicalPct}%` }}
            className={`bg-amber-500/80 h-full transition-all duration-300 ${allyNames.length === 0 ? 'opacity-30' : ''}`}
          />
          <div
            style={{ width: `${magicPct}%` }}
            className={`bg-purple-accent/80 h-full transition-all duration-300 ${allyNames.length === 0 ? 'opacity-30' : ''}`}
          />
        </div>
        {allyNames.length > 0 && !isBalanced && (
          <span className="text-xs text-amber-500 font-medium block">
            Advertencia: Composición con daño desbalanceado. Se recomienda elegir un campeón de tipo {physicalPct > 65 ? 'AP' : 'AD'}.
          </span>
        )}
        {allyNames.length === 0 && (
          <span className="text-xs text-slate-500 font-medium block">
            Esperando selecciones de campeones...
          </span>
        )}
      </div>
    </div>
  );
};

export default DraftDamageBalance;
