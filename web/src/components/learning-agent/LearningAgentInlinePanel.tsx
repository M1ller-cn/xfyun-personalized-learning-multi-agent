import React, { useEffect, useMemo, useState } from 'react';
import { Bot, BrainCircuit, CheckCircle2, Code2, Loader2, Route, Send, Sparkles, Video } from 'lucide-react';
import { apiClient } from '../../api';

type LearnerProfile = {
  goal?: string;
  weakPoints?: string;
  preference?: string;
  pace?: string;
};

type PathNode = {
  id: string;
  title: string;
  description?: string;
  progress?: number;
  tasks?: string[];
  videoUrl?: string;
  slidesUrl?: string;
  codeUrl?: string | null;
};

type Workspace = {
  profile?: LearnerProfile;
  path?: PathNode[];
  agents?: string[];
};

type Props = {
  context: 'course' | 'grading';
  courseTitle?: string;
  onOpenCodePractice?: () => void;
};

const fallbackWorkspace: Workspace = {
  profile: {
    goal: '围绕当前课程建立可执行的学习闭环',
    weakPoints: '树结构、哈希、堆、排序与复杂度分析',
    preference: '视频讲解、图解文档、任务清单、代码实操和即时反馈',
    pace: '建议每天 60-90 分钟，先学资源，再做练习，最后用评测查漏补缺',
  },
  path: [
    { id: 'bst', title: '二叉搜索树', progress: 0, videoUrl: 'https://youtu.be/0woI8l0ZWmA', tasks: ['看完视频并写出中序遍历结论', '完成 search/insert 小练习'] },
    { id: 'hash', title: '哈希表', progress: 0, videoUrl: 'https://www.youtube.com/watch?v=r1XZGP5ppqQ', tasks: ['比较链地址法和开放寻址', '完成频次统计代码题'] },
    { id: 'quick', title: '快速排序', progress: 0, videoUrl: 'https://youtu.be/kbiKn1K08RM', tasks: ['手写 partition', '分析 pivot 退化场景'] },
  ],
  agents: ['Profile Agent', 'Planner Agent', 'Tutor Agent', 'Coding Agent', 'Evaluator Agent'],
};

export default function LearningAgentInlinePanel({ context, courseTitle, onOpenCodePractice }: Props) {
  const [workspace, setWorkspace] = useState<Workspace>(fallbackWorkspace);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('我会根据你的目标，把课程资源、学习路径、代码练习和智能批改串起来，而不是单独开一个孤立模块。');

  useEffect(() => {
    apiClient.get('/api/learning-workspace/workspace')
      .then((res) => setWorkspace(res.data?.data || fallbackWorkspace))
      .catch(() => setWorkspace(fallbackWorkspace));
  }, []);

  const nextNode = useMemo(() => {
    const path = workspace.path || [];
    return path.find((item) => (item.progress || 0) < 100) || path[0] || fallbackWorkspace.path![0];
  }, [workspace.path]);

  const submitProfileSignal = async () => {
    const text = message.trim();
    if (!text) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/api/learning-workspace/profile/analyze', {
        message: `${courseTitle ? `课程：${courseTitle}。` : ''}${text}`,
      });
      const next = res.data?.data || fallbackWorkspace;
      setWorkspace(next);
      setReply(`收到，我会保留当前课程上下文，并把优先级调到：${next.profile?.weakPoints || '当前薄弱知识点'}。下面的路径、任务和代码练习会按这个方向推荐。`);
      setMessage('');
    } catch {
      setReply('后端学习画像接口暂时没有响应，我先按本地课程知识库给你推荐下一步。你可以继续使用代码评测和课程资源。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-200/70 dark:border-cyan-900/60 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 dark:from-cyan-950/40 dark:via-gray-900 dark:to-indigo-950/30 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20">
          <Bot size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-gray-900 dark:text-white">学习助理已融入当前场景</h3>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-200">
              {context === 'course' ? '课程内推荐' : '批改内诊断'}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{reply}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoTile icon={<BrainCircuit size={16} />} label="当前画像" value={workspace.profile?.weakPoints || '待补充'} />
        <InfoTile icon={<Route size={16} />} label="下一步路径" value={nextNode.title} />
        <InfoTile icon={<Sparkles size={16} />} label="协作智能体" value={`${workspace.agents?.length || 5} 个 Agent`} />
      </div>

      <div className="mt-4 rounded-xl border border-white/70 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{nextNode.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {(nextNode.tasks || []).slice(0, 2).join(' / ') || nextNode.description || '完成资源学习后进入练习和评测。'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {nextNode.videoUrl && (
              <a href={nextNode.videoUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg bg-gray-100 text-gray-700 hover:bg-cyan-100 hover:text-cyan-700 dark:bg-gray-800 dark:text-gray-200" title="打开学习视频">
                <Video size={16} />
              </a>
            )}
            <button type="button" onClick={onOpenCodePractice} className="grid h-9 w-9 place-items-center rounded-lg bg-gray-100 text-gray-700 hover:bg-cyan-100 hover:text-cyan-700 dark:bg-gray-800 dark:text-gray-200" title="进入代码评测">
              <Code2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitProfileSignal();
          }}
          placeholder="告诉我你现在卡在哪里，助理会同步更新路径和练习重点"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-cyan-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
        <button
          type="button"
          onClick={submitProfileSignal}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-600 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          更新
        </button>
      </div>
    </section>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
        {icon}
        {label}
      </div>
      <div className="line-clamp-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
        <CheckCircle2 size={14} className="mr-1 inline text-emerald-500" />
        {value}
      </div>
    </div>
  );
}
