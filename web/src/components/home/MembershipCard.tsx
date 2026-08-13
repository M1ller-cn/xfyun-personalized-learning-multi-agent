import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Crown, FileCheck, FileText, Infinity, Sparkles, Wand2 } from 'lucide-react';

const quotaItems = [
  { label: 'AI 对话', icon: Brain },
  { label: 'PPT 生成', icon: FileText },
  { label: 'AI 出题', icon: Sparkles },
  { label: '电子书 AI', icon: Wand2 },
  { label: '智能批改', icon: FileCheck },
];

export const MembershipCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/60 dark:bg-gray-900">
      <div className="bg-gradient-to-br from-amber-50 via-white to-sky-50 px-5 py-4 dark:from-amber-950/30 dark:via-gray-900 dark:to-sky-950/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-800 dark:bg-gray-900">
              <Crown size={21} className="text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-700 dark:text-amber-300">专业版</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">当前演示环境已开通，不限制使用次数</div>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            已生效
          </span>
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI 额度</div>
        <div className="space-y-1">
          {quotaItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <Icon size={16} className="shrink-0 text-gray-400" />
                <span className="flex-1 text-xs font-medium text-gray-600 dark:text-gray-300">{item.label}</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-300">
                  <Infinity size={14} />
                  无限
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
        <button
          onClick={() => navigate('/membership')}
          className="flex w-full items-center justify-center gap-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-300"
        >
          查看专业版能力
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default MembershipCard;
