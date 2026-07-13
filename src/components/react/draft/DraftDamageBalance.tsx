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
    <div className="p-4 border-b border-border-warm/20 mb-4 bg-slate-950/20 rounded-sm">
      {/* Fila de balance de Daño */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Daño Físico (AD): {physicalPct}%</span>
          <span>Daño Mágico (AP): {magicPct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-950 rounded-sm overflow-hidden flex border border-border-warm/40">
          <div
            style={{ width: `${physicalPct}%` }}
            className={`bg-gradient-to-r from-red-600 to-orange-500 h-full transition-all duration-500 ${allyNames.length === 0 ? 'opacity-30' : ''}`}
          />
          <div
            style={{ width: `${magicPct}%` }}
            className={`bg-gradient-to-r from-cyan-600 to-blue-500 h-full transition-all duration-500 ${allyNames.length === 0 ? 'opacity-30' : ''}`}
          />
        </div>
        {allyNames.length > 0 && !isBalanced && (
          <span className="text-[9px] text-amber-500 font-semibold block animate-pulse">
            Advertencia: Composición con daño desbalanceado. Se recomienda elegir un campeón de tipo {physicalPct > 65 ? 'AP' : 'AD'}.
          </span>
        )}
        {allyNames.length === 0 && (
          <span className="text-[9px] text-slate-550 font-medium block italic">
            Esperando selecciones de campeones...
          </span>
        )}
      </div>
    </div>
  );
};

export default DraftDamageBalance;
