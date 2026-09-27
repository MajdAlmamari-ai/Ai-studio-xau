import React from 'react';
import { Target, Layers, GitCompare, BarChart2 } from 'lucide-react';

export type MainTabType = 'spot' | 'futures' | 'fusion' | 'charts';

interface TabNavigationProps {
  activeTab: MainTabType;
  onChangeTab: (tab: MainTabType) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    {
      id: 'spot' as const,
      labelAr: 'تحليل السعر الفوري',
      sublabel: 'OANDA:XAUUSD',
      icon: Target,
      color: 'emerald',
    },
    {
      id: 'futures' as const,
      labelAr: 'تحليل العقود الآجلة',
      sublabel: 'COMEX:GC1!',
      icon: Layers,
      color: 'amber',
    },
    {
      id: 'fusion' as const,
      labelAr: 'الدمج والمقارنة',
      sublabel: 'Fusion Layer',
      icon: GitCompare,
      color: 'indigo',
    },
    {
      id: 'charts' as const,
      labelAr: 'الرسوم البيانية',
      sublabel: 'Side-by-Side',
      icon: BarChart2,
      color: 'blue',
    },
  ];

  return (
    <div className="w-full bg-[#0D1017] border-b border-[#1A1F2E] px-4 py-2" dir="rtl">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#161B26] text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#121622] border border-transparent'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-zinc-800/50 text-zinc-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-right">
                <span className="font-bold">{tab.labelAr}</span>
                <span className="text-[10px] text-zinc-400 font-mono">{tab.sublabel}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
