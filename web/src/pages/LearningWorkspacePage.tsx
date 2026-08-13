import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Database,
  FileText,
  GitBranch,
  GraduationCap,
  Layers3,
  Loader2,
  Map,
  MessageCircleMore,
  PlayCircle,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  X,
} from 'lucide-react';
import { apiClient } from '../api';
import { getCourseVisual } from '../utils/courseVisuals';

type CourseTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  question: string;
  tasks: string[];
};

type CourseInfo = {
  key: string;
  platformCourseId: number;
  title: string;
  sourceName: string;
  courseUrl: string;
  description: string;
  topics: CourseTopic[];
};

type CourseOption = {
  key: string;
  platformCourseId: number;
  shortName: string;
  title: string;
  description: string;
};

type LearnerProfile = {
  stage: string;
  goal: string;
  foundation: string;
  weakPoints: string;
  preference: string;
  pace: string;
  activeCourseKey: string;
  revision: number;
};

type PathNode = {
  id: string;
  title: string;
  description: string;
  sequence: number;
  progress: number;
  tasks: string[];
  completedTasks: number[];
  bestScore: number;
  attempts: number;
  passed: boolean;
  priority: boolean;
  available: boolean;
  reviewRecommended: boolean;
  estimatedMinutes: number;
  recommendationReason: string;
  videoUrl: string;
  slidesUrl: string;
  codeUrl: string;
  question: string;
};

type ResourceCard = {
  type: string;
  title: string;
  description: string;
  agent: string;
  url: string;
  status: string;
};

type MindMapNode = {
  id: string;
  label: string;
  parentId: string | null;
  passed: boolean;
  nodeType: 'course' | 'module' | 'knowledge';
};

type AgentRun = {
  name: string;
  responsibility: string;
  status: string;
  role: string;
};

type Workspace = {
  course: CourseInfo;
  courses: CourseOption[];
  profile: LearnerProfile;
  profileInitialized: boolean;
  pathMode: 'RECOMMENDED' | 'FREE_EXPLORATION' | 'EXAM_SPRINT';
  assistantReply: string | null;
  path: PathNode[];
  resources: ResourceCard[];
  mindMap: MindMapNode[];
  agents: AgentRun[];
  overallProgress: number;
  updatedAt: string;
};

type Evaluation = {
  score: number;
  level: string;
  feedback: string;
  nextStep: string;
  passed: boolean;
  assessmentType?: AssessmentType;
  countsAsMasteryEvidence?: boolean;
  effectMessage?: string;
};

type AssessmentType = 'DIAGNOSTIC' | 'CONCEPT' | 'TRANSFER' | 'RETENTION';
type TopicEffectiveness = {
  topicId: string;
  title: string;
  diagnosticScore: number;
  conceptScore: number;
  transferScore: number;
  retentionScore: number;
  evidenceCount: number;
  learningGain: number | null;
  retentionDueAt: string | null;
  verified: boolean;
  status: string;
  nextAction: string;
};
type LearningEffectivenessOverview = { courseKey: string; topics: TopicEffectiveness[]; verifiedTopicCount: number; evidenceCount: number; standard: string };

type ProfileGoal = {
  id: number;
  courseKey: string;
  title: string;
  priority: 'CURRENT' | 'LONG_TERM';
  status: 'ACTIVE' | 'ARCHIVED';
  confirmed: boolean;
  sourceEvidence: string;
  updatedAt: string;
};

type ProfileFact = {
  key: string;
  value: string;
  sourceEvidence: string;
  confirmed: boolean;
  updatedAt: string;
};

type ProfileAdjustment = { id: number; type: string; message: string; createdAt: string };
type ProfileOverview = { goals: ProfileGoal[]; facts: ProfileFact[]; adjustments: ProfileAdjustment[] };
type PathRevision = { id: number; mode: string; reason: string; createdAt: string };

type TabKey = 'profile' | 'path' | 'map' | 'resources' | 'tutor' | 'code' | 'eval';

const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'profile', label: '学习画像', icon: BrainCircuit },
  { key: 'path', label: '学习路径', icon: Route },
  { key: 'map', label: '图解文档', icon: Map },
  { key: 'resources', label: '学习资源', icon: Sparkles },
  { key: 'tutor', label: '智能辅导', icon: Bot },
  { key: 'code', label: '代码实操', icon: Code2 },
  { key: 'eval', label: '学习评估', icon: Activity },
];

const resourceIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  讲解文档: FileText,
  图解文档: GitBranch,
  个性化练习: Target,
  视频学习: Video,
  代码实操: Code2,
  拓展阅读: BookOpen,
};

export default function LearningWorkspacePage() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('DIAGNOSTIC');
  const [effectiveness, setEffectiveness] = useState<LearningEffectivenessOverview | null>(null);
  const [profileOverview, setProfileOverview] = useState<ProfileOverview | null>(null);
  const [pathHistory, setPathHistory] = useState<PathRevision[]>([]);
  const [goalDraft, setGoalDraft] = useState('');
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [chat, setChat] = useState<Array<{ role: 'assistant' | 'user'; text: string }>>([
    {
      role: 'assistant',
      text: '你好。先告诉我你要学哪门课、当前基础、薄弱点、目标和每天可用时间，我会据此安排学习。',
    },
  ]);

  const fetchWorkspace = async (courseKey?: string) => {
    const response = await apiClient.get('/api/learning-workspace/workspace', {
      params: courseKey ? { courseKey } : undefined,
    });
    const next = response.data?.data as Workspace;
    setWorkspace(next);
    setSelectedNodeId((current) => current || next.path[0]?.id || '');
    if (next.profileInitialized) setActiveTab((current) => (current === 'profile' ? 'path' : current));
    if (next.profileInitialized) {
      try {
        const overview = await apiClient.get('/api/learning-workspace/profile/overview');
        setProfileOverview(overview.data?.data as ProfileOverview);
      } catch {
        setProfileOverview(null);
      }
      try {
        const history = await apiClient.get('/api/learning-workspace/path/history', { params: { courseKey: next.course.key } });
        setPathHistory(history.data?.data as PathRevision[]);
      } catch {
        setPathHistory([]);
      }
      try {
        const effect = await apiClient.get('/api/learning-workspace/effectiveness/overview', { params: { courseKey: next.course.key } });
        setEffectiveness(effect.data?.data as LearningEffectivenessOverview);
      } catch {
        setEffectiveness(null);
      }
    }
  };

  const refreshProfileOverview = async () => {
    const response = await apiClient.get('/api/learning-workspace/profile/overview');
    setProfileOverview(response.data?.data as ProfileOverview);
  };

  useEffect(() => {
    fetchWorkspace()
      .catch(() => setWorkspace(null))
      .finally(() => setLoading(false));
  }, []);

  const selectedPath = useMemo(
    () => workspace?.path.find((node) => node.id === selectedNodeId) ?? workspace?.path[0],
    [selectedNodeId, workspace?.path],
  );

  const selectedTopic = useMemo(
    () => workspace?.course.topics.find((topic) => topic.id === selectedPath?.id) ?? workspace?.course.topics[0],
    [selectedPath?.id, workspace?.course.topics],
  );

  const selectedEffect = useMemo(
    () => effectiveness?.topics.find((item) => item.topicId === selectedPath?.id),
    [effectiveness?.topics, selectedPath?.id],
  );

  const selectTab = (key: TabKey) => {
    if (!workspace?.profileInitialized && key !== 'profile') return;
    setActiveTab(key);
  };

  const initializeProfile = async () => {
    if (!prompt.trim() || actionLoading) return;
    const message = prompt.trim();
    setChat((items) => [...items, { role: 'user', text: message }]);
    setPrompt('');
    setActionLoading(true);
    try {
      const response = await apiClient.post('/api/learning-workspace/profile/analyze', { message });
      const next = response.data?.data as Workspace;
      setWorkspace(next);
      setSelectedNodeId(next.path[0]?.id || '');
      await refreshProfileOverview();
      setChat((items) => [
        ...items,
        { role: 'assistant', text: next.assistantReply || '画像与学习路径已经更新。' },
      ]);
      if (next.profileInitialized && !next.assistantReply?.includes('需要我保留')) setActiveTab('path');
    } catch {
      setChat((items) => [...items, { role: 'assistant', text: '这次画像更新没有成功，请稍后再试。已有学习进度不会丢失。' }]);
    } finally {
      setActionLoading(false);
    }
  };

  const switchCourse = async (courseKey: string) => {
    if (!workspace?.profileInitialized || actionLoading || courseKey === workspace.course.key) return;
    setActionLoading(true);
    try {
      const response = await apiClient.post('/api/learning-workspace/course/select', { courseKey });
      const next = response.data?.data as Workspace;
      setWorkspace(next);
      setSelectedNodeId(next.path[0]?.id || '');
      await refreshProfileOverview();
      setEvaluation(null);
      setActiveTab('path');
    } finally {
      setActionLoading(false);
    }
  };

  const switchPathMode = async (mode: Workspace['pathMode']) => {
    if (!workspace || actionLoading || mode === workspace.pathMode) return;
    setActionLoading(true);
    try {
      const response = await apiClient.post('/api/learning-workspace/path/mode', { courseKey: workspace.course.key, mode });
      const next = response.data?.data as Workspace;
      setWorkspace(next);
      setSelectedNodeId(next.path.find((node) => node.available)?.id || next.path[0]?.id || '');
      const history = await apiClient.get('/api/learning-workspace/path/history', { params: { courseKey: next.course.key } });
      setPathHistory(history.data?.data as PathRevision[]);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleTask = async (node: PathNode, taskIndex: number) => {
    if (!workspace || actionLoading) return;
    const completed = !node.completedTasks.includes(taskIndex);
    setActionLoading(true);
    try {
      const response = await apiClient.post('/api/learning-workspace/task/complete', {
        courseKey: workspace.course.key,
        topicId: node.id,
        taskIndex,
        completed,
      });
      setWorkspace(response.data?.data as Workspace);
    } finally {
      setActionLoading(false);
    }
  };

  const evaluateAnswer = async () => {
    if (!workspace || !selectedPath || !answer.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await apiClient.post('/api/learning-workspace/quiz/evaluate', {
        courseKey: workspace.course.key,
        nodeId: selectedPath.id,
        question: selectedPath.question,
        answer,
        assessmentType,
      });
      setEvaluation(response.data?.data as Evaluation);
      await fetchWorkspace(workspace.course.key);
    } finally {
      setActionLoading(false);
    }
  };

  const selectAssessmentType = (type: AssessmentType) => {
    setAssessmentType(type);
    setAnswer('');
    setEvaluation(null);
  };

  const assessmentQuestion = (node: PathNode, type: AssessmentType) => {
    if (type === 'DIAGNOSTIC') return `开始学习前，请用自己的话回答：${node.question}；同时说明你最没有把握的部分。`;
    if (type === 'TRANSFER') return `迁移挑战：面对一个没有见过的新场景，你会怎样运用「${node.title}」解决问题？请说明判断依据、步骤和一个边界情况。`;
    if (type === 'RETENTION') return `巩固复测：不查资料，重新解释「${node.title}」的核心思路，并给出一个易错点或反例。`;
    return node.question;
  };

  const openResource = (resource: ResourceCard) => {
    if (resource.url === '#mind-map') return setActiveTab('map');
    if (resource.url === '#assessment') return setActiveTab('eval');
    navigate(resource.url);
  };

  const openNode = (nodeId: string) => {
    const moduleId = workspace?.path.some((item) => item.id === nodeId)
      ? nodeId
      : workspace?.mindMap.find((item) => item.id === nodeId)?.parentId;
    if (moduleId) setSelectedNodeId(moduleId);
    setNodeDialogOpen(true);
  };

  const addGoal = async () => {
    if (!workspace || !goalDraft.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.post('/api/learning-workspace/profile/goals', {
        courseKey: workspace.course.key,
        title: goalDraft.trim(),
        priority: 'LONG_TERM',
      });
      setGoalDraft('');
      await refreshProfileOverview();
    } finally {
      setActionLoading(false);
    }
  };

  const confirmFact = async (fact: ProfileFact) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.put(`/api/learning-workspace/profile/facts/${fact.key}`, { value: fact.value, confirmed: true });
      await refreshProfileOverview();
    } finally {
      setActionLoading(false);
    }
  };

  const archiveGoal = async (goalId: number) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/api/learning-workspace/profile/goals/${goalId}`);
      await refreshProfileOverview();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[65vh] place-items-center text-brand-600">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={34} />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">正在同步学习状态</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="font-semibold text-gray-900 dark:text-white">学习工作台暂时无法加载</p>
        <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          <RefreshCw size={16} /> 重新加载
        </button>
      </div>
    );
  }

  const visual = getCourseVisual({ title: workspace.course.title, description: workspace.course.description } as never);

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden pb-8">
      <section className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid min-h-[230px] lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative z-10 flex flex-col justify-center p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                <Sparkles size={14} /> 个性化学习工作台
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <Database size={14} /> 5 门课程知识库已连接
              </span>
            </div>
            <h1 className="max-w-3xl text-2xl font-bold text-gray-950 dark:text-white md:text-3xl">{workspace.course.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">{workspace.course.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => navigate(workspace.course.courseUrl)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                <PlayCircle size={17} /> 进入课程
              </button>
              <button onClick={() => setActiveTab('tutor')} disabled={!workspace.profileInitialized} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <Bot size={17} /> 问学习导师
              </button>
            </div>
          </div>
          <div className="relative min-h-[190px] overflow-hidden bg-gray-950">
            <img src={visual.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className={`absolute inset-0 bg-gradient-to-br ${visual.accent}`} />
            <div className="absolute inset-x-5 bottom-5 rounded-lg border border-white/20 bg-gray-950/65 p-4 text-white backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/75">整体进度</span>
                <strong className="text-2xl">{workspace.overallProgress}%</strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${workspace.overallProgress}%` }} />
              </div>
              <p className="mt-3 text-xs text-white/70">画像版本 {workspace.profile.revision} · {workspace.course.sourceName}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-max gap-1">
          {tabs.map(({ key, label, icon: Icon }) => {
            const locked = !workspace.profileInitialized && key !== 'profile';
            return (
              <button key={key} onClick={() => selectTab(key)} disabled={locked} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${activeTab === key ? 'bg-brand-600 text-white shadow-sm' : locked ? 'cursor-not-allowed text-gray-300 dark:text-gray-700' : 'text-gray-600 hover:bg-brand-50 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-brand-900/30'}`}>
                <Icon size={17} /> {label}
              </button>
            );
          })}
        </div>
      </section>

      {!workspace.profileInitialized && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldCheck size={19} /> 请先通过对话完成画像初始化，其他学习模块会根据画像自动解锁。
        </div>
      )}

      {activeTab === 'profile' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={MessageCircleMore} title="对话式画像" note="历史目标会保留，切换课程前会先确认" />
            <div className="p-5">
              <div className="h-[330px] space-y-3 overflow-y-auto rounded-lg bg-gray-50 p-4 dark:bg-gray-950/60">
                {chat.map((item, index) => (
                  <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[84%] rounded-xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'bg-brand-600 text-white' : 'border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
                      {item.text}
                    </div>
                  </div>
                ))}
                {actionLoading && (
                  <div className="flex items-center gap-2 text-sm text-brand-600"><Loader2 className="animate-spin" size={16} /> 正在分析目标、基础、薄弱点和学习偏好</div>
                )}
              </div>
              <div className="mt-4 flex gap-3">
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); initializeProfile(); } }} placeholder="例如：我要准备 CS61B 期末，树和哈希表总出错，每天可以学习 1 小时，希望多做代码题。" className="min-h-24 flex-1 resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                <button onClick={initializeProfile} disabled={!prompt.trim() || actionLoading} className="self-end rounded-lg bg-brand-600 p-3 text-white hover:bg-brand-700 disabled:opacity-50" aria-label="发送画像信息">
                  {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={BrainCircuit} title="动态学习画像" note={workspace.profileInitialized ? `第 ${workspace.profile.revision} 版` : '等待初始化'} />
            <div className="grid gap-px bg-gray-100 dark:bg-gray-800 sm:grid-cols-2">
              <ProfileItem icon={GraduationCap} label="学习阶段" value={workspace.profile.stage} />
              <ProfileItem icon={Target} label="学习目标" value={workspace.profile.goal} />
              <ProfileItem icon={Layers3} label="知识基础" value={workspace.profile.foundation} />
              <ProfileItem icon={GitBranch} label="当前薄弱点" value={workspace.profile.weakPoints} accent />
              <ProfileItem icon={PlayCircle} label="学习偏好" value={workspace.profile.preference} />
              <ProfileItem icon={Activity} label="学习节奏" value={workspace.profile.pace} />
            </div>
            {workspace.profileInitialized && profileOverview && (
              <div className="space-y-4 border-t border-gray-100 p-5 dark:border-gray-800">
                <div>
                  <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">目标管理</h3><span className="text-xs text-gray-500">当前目标与长期目标会同时保留</span></div>
                  <div className="mt-3 space-y-2">
                    {profileOverview.goals.filter((goal) => goal.status === 'ACTIVE').map((goal) => (
                      <div key={goal.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                        <div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${goal.priority === 'CURRENT' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{goal.priority === 'CURRENT' ? '当前优先' : '长期目标'}</span><p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{goal.title}</p></div><button onClick={() => archiveGoal(goal.id)} className="rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30">停止</button></div>
                        <p className="mt-2 text-xs leading-5 text-gray-400">来源：{goal.sourceEvidence}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2"><input value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addGoal(); }} placeholder="添加一个长期学习目标" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950" /><button onClick={addGoal} disabled={!goalDraft.trim() || actionLoading} className="rounded-lg bg-brand-600 px-3 text-sm font-medium text-white disabled:opacity-50">添加</button></div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">画像依据</h3>
                  <div className="mt-3 space-y-2">
                    {profileOverview.facts.map((fact) => (
                      <div key={fact.key} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-950/60"><div className="flex items-center justify-between gap-3"><span className="text-sm text-gray-700 dark:text-gray-300">{fact.value}</span>{fact.confirmed ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> 已确认</span> : <button onClick={() => confirmFact(fact)} className="text-xs font-medium text-brand-600 hover:text-brand-700">确认</button>}</div><p className="mt-1 text-xs text-gray-400">依据：{fact.sourceEvidence}</p></div>
                    ))}
                  </div>
                </div>
                {profileOverview.adjustments[0] && <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-xs leading-5 text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200"><span className="font-semibold">本次调整：</span>{profileOverview.adjustments[0].message}</div>}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'path' && selectedPath && (
        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={Route} title="个性化学习链路" note="任务 60% + 节点测评 40%" />
            <div className="p-5">
              <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {workspace.courses.map((course) => (
                  <button key={course.key} onClick={() => switchCourse(course.key)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium ${course.key === workspace.course.key ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-400'}`}>
                    {course.shortName}
                  </button>
                ))}
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {([
                  ['RECOMMENDED', '推荐顺序'],
                  ['FREE_EXPLORATION', '自由探索'],
                  ['EXAM_SPRINT', '考前冲刺'],
                ] as Array<[Workspace['pathMode'], string]>).map(([mode, label]) => (
                  <button key={mode} onClick={() => switchPathMode(mode)} disabled={actionLoading} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${workspace.pathMode === mode ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-brand-900/30'}`}>{label}</button>
                ))}
              </div>
              <div className="space-y-0">
                {workspace.path.map((node, index) => (
                  <div key={node.id} className="relative grid grid-cols-[42px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                    {index < workspace.path.length - 1 && <div className={`absolute left-5 top-10 h-[calc(100%-24px)] w-0.5 ${node.passed ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                    <button onClick={() => node.available && setSelectedNodeId(node.id)} disabled={!node.available} className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-bold ${node.passed ? 'border-emerald-500 bg-emerald-500 text-white' : !node.available ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800' : selectedPath.id === node.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900'}`}>
                      {node.passed ? <Check size={18} /> : node.sequence}
                    </button>
                    <button onClick={() => node.available && setSelectedNodeId(node.id)} disabled={!node.available} className={`rounded-lg border p-4 text-left transition ${!node.available ? 'cursor-not-allowed border-dashed border-gray-200 bg-gray-50 opacity-70 dark:border-gray-700 dark:bg-gray-950/40' : selectedPath.id === node.id ? 'border-brand-300 bg-brand-50/70 dark:border-brand-700 dark:bg-brand-950/30' : 'border-gray-200 hover:border-brand-200 dark:border-gray-700 dark:hover:border-brand-800'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-gray-950 dark:text-white">{node.title}</h3>
                            {node.priority && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">优先学习</span>}
                            {node.reviewRecommended && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">待复习</span>}
                          </div>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{node.recommendationReason}</p>
                        </div>
                        <strong className="text-sm text-brand-600 dark:text-brand-400">{node.progress}%</strong>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${node.passed ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${node.progress}%` }} /></div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4"><PathDetail node={selectedPath} busy={actionLoading} onToggleTask={toggleTask} onNavigate={(tab) => setActiveTab(tab)} />
            {pathHistory.length > 0 && <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">路径调整记录</h3><div className="mt-3 space-y-3">{pathHistory.slice(0, 4).map((item) => <div key={item.id} className="border-l-2 border-brand-300 pl-3"><p className="text-sm leading-5 text-gray-700 dark:text-gray-300">{item.reason}</p><p className="mt-1 text-xs text-gray-400">{item.mode === 'EXAM_SPRINT' ? '考前冲刺' : item.mode === 'FREE_EXPLORATION' ? '自由探索' : '推荐顺序'}</p></div>)}</div></div>}
          </div>
        </section>
      )}

      {activeTab === 'map' && selectedPath && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <SectionHeader icon={Map} title="课程知识树" note="绿色节点表示已通过" />
          <div className="min-h-[620px] overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.16)_1px,transparent_0)] bg-[size:24px_24px] p-8">
            <div className="flex min-w-[1180px] items-center gap-10">
              <div className="w-52 rounded-lg border-2 border-brand-500 bg-brand-600 p-5 text-white shadow-lg shadow-brand-500/20">
                <BrainCircuit size={24} />
                <h3 className="mt-3 text-lg font-bold">{workspace.courses.find((item) => item.key === workspace.course.key)?.shortName}</h3>
                <p className="mt-1 text-xs text-white/70">{workspace.course.topics.length} 个核心模块</p>
              </div>
              <div className="h-0.5 w-10 bg-brand-300" />
              <div className="grid w-[360px] gap-4">
                {workspace.mindMap.filter((node) => node.nodeType === 'module').map((node) => (
                  <button key={node.id} onClick={() => openNode(node.id)} className={`flex items-center justify-between rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${node.passed ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : node.id === selectedPath.id ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300' : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
                    <span className="font-semibold">{node.label}</span>{node.passed ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}
                  </button>
                ))}
              </div>
              <div className="h-0.5 w-10 bg-brand-200" />
              <div className="grid w-[460px] grid-cols-2 gap-3">
                {workspace.mindMap.filter((node) => node.nodeType === 'knowledge' && node.parentId === selectedPath.id).map((node) => (
                  <button key={node.id} onClick={() => openNode(node.id)} className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition hover:border-brand-400 ${node.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}>
                    {node.passed && <Check size={14} className="mr-2 inline" />}{node.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'resources' && (
        <section className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={Sparkles} title="个性化资源包" note={`当前聚焦：${workspace.profile.weakPoints}`} />
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {workspace.resources.map((resource) => {
                const Icon = resourceIcons[resource.type] || FileText;
                return (
                  <button key={resource.type} onClick={() => openResource(resource)} className="group rounded-lg border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-950/40">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Icon size={20} /></span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{resource.status}</span>
                    </div>
                    <h3 className="mt-4 font-semibold text-gray-950 dark:text-white">{resource.title}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-gray-500 dark:text-gray-400">{resource.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400"><span>{resource.agent}</span><ArrowRight className="text-brand-500 transition group-hover:translate-x-1" size={17} /></div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={BrainCircuit} title="多智能体协作" note="同一份画像驱动各角色协同" />
            <div className="grid gap-px bg-gray-100 dark:bg-gray-800 md:grid-cols-2 xl:grid-cols-3">
              {workspace.agents.map((agent) => (
                <div key={agent.role} className="bg-white p-5 dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{agent.role}</span><span className="text-xs text-emerald-600 dark:text-emerald-400">{agent.status}</span></div>
                  <h3 className="mt-2 font-semibold text-gray-950 dark:text-white">{agent.name}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{agent.responsibility}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'tutor' && selectedPath && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={Bot} title="课程智能辅导" note="DeepSeek + 5 门课程本地 RAG" />
            <div className="p-6">
              <div className="flex items-start gap-4 rounded-lg bg-brand-50 p-5 dark:bg-brand-950/30">
                <div className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-brand-600 text-white"><Bot size={24} /></div>
                <div>
                  <h3 className="font-semibold text-gray-950 dark:text-white">正在辅导：{selectedPath.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">我会优先依据当前课程知识库回答，并结合你的薄弱点“{workspace.profile.weakPoints}”调整解释深度。</p>
                  <button onClick={() => navigate(`/ai-chat/1?topic=${encodeURIComponent(selectedPath.title)}&course=${encodeURIComponent(workspace.course.title)}`)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                    <MessageCircleMore size={17} /> 开始对话
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {['先讲直觉与定义', '再看最小例子', '最后定位易错点'].map((item, index) => (
                  <div key={item} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"><span className="text-xs font-semibold text-brand-600">0{index + 1}</span><p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">{item}</p></div>
                ))}
              </div>
            </div>
          </div>
          <SourcePanel course={workspace.course} node={selectedPath} />
        </section>
      )}

      {activeTab === 'code' && selectedPath && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-sm dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3"><span className="text-sm font-medium text-gray-300">{selectedPath.id}.practice</span><span className="text-xs text-gray-500">输入 / 预期输出 / 实际输出</span></div>
            <pre className="min-h-[360px] overflow-auto p-5 text-sm leading-7 text-emerald-300">{`# ${selectedPath.title} 实操入口\n# 目标：完成核心实现，并用测试用例验证边界情况\n\ndef solve(data):\n    # 在代码评测工作台中完成实现\n    return data\n\nprint(solve(input()))`}</pre>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Code2 size={20} /></span>
            <h3 className="mt-4 font-semibold text-gray-950 dark:text-white">代码评测工作台</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">编写代码后配置多组输入和预期输出，运行结果逐项比对；错误时可继续请求 AI 分析。</p>
            <button onClick={() => navigate(`/grading?mode=code&topic=${encodeURIComponent(selectedPath.title)}`)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"><Code2 size={17} /> 打开代码评测</button>
            <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500">本节点检查项</p>
              {['正确性', '边界用例', '时间复杂度', '代码可读性'].map((item) => <div key={item} className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><Circle size={12} /> {item}</div>)}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'eval' && selectedPath && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <SectionHeader icon={Target} title={`${selectedPath.title} 学习成效检测`} note="诊断 → 理解 → 迁移 → 延迟复测" />
            <div className="p-5">
              <div className="grid gap-2 sm:grid-cols-4">
                {([
                  ['DIAGNOSTIC', '诊断基线'],
                  ['CONCEPT', '概念理解'],
                  ['TRANSFER', '迁移挑战'],
                  ['RETENTION', '巩固复测'],
                ] as Array<[AssessmentType, string]>).map(([type, label]) => (
                  <button key={type} onClick={() => selectAssessmentType(type)} className={`rounded-lg px-3 py-2 text-sm font-medium ${assessmentType === type ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-300'}`}>{label}</button>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm font-medium leading-6 text-brand-900 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200">{assessmentQuestion(selectedPath, assessmentType)}</div>
              {assessmentType === 'RETENTION' && selectedEffect?.retentionDueAt && <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">巩固复测建议在 {new Date(selectedEffect.retentionDueAt).toLocaleDateString()} 后完成；提前提交会记录结果，但不会作为长期记忆证据。</p>}
              <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="写出核心概念、判断依据、操作步骤，以及一个易错点或边界情况。" className="mt-4 h-48 w-full resize-none rounded-lg border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              <button onClick={evaluateAnswer} disabled={!answer.trim() || actionLoading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{actionLoading ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />} 提交评估</button>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-950 dark:text-white">掌握证据</h3>{selectedEffect?.verified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={14} /> 已验证掌握</span>}</div>
            {selectedEffect ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-950/60"><div className="flex justify-between text-sm"><span className="text-gray-500">当前状态</span><strong className="text-gray-900 dark:text-white">{selectedEffect.status}</strong></div><p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{selectedEffect.nextAction}</p></div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">{[['诊断', selectedEffect.diagnosticScore], ['理解', selectedEffect.conceptScore], ['迁移', selectedEffect.transferScore], ['巩固', selectedEffect.retentionScore]].map(([label, score]) => <div key={String(label)} className="rounded-lg border border-gray-100 p-2 dark:border-gray-800"><p className="text-gray-400">{label}</p><strong className="mt-1 block text-base text-gray-800 dark:text-gray-200">{Number(score) < 0 ? '—' : `${score}`}</strong></div>)}</div>
                <p className="text-xs text-gray-400">有效证据 {selectedEffect.evidenceCount} 条{selectedEffect.learningGain !== null ? ` · 相比诊断 ${selectedEffect.learningGain >= 0 ? '+' : ''}${selectedEffect.learningGain} 分` : ''}</p>
              </div>
            ) : <p className="mt-4 text-sm text-gray-500">完成诊断后生成学习成效证据。</p>}
            <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-800"><h3 className="font-semibold text-gray-950 dark:text-white">本次评估</h3>
            {evaluation ? (
              <div className="mt-5">
                <div className="flex items-end gap-3"><strong className={`text-5xl ${evaluation.passed ? 'text-emerald-500' : 'text-amber-500'}`}>{evaluation.score}</strong><span className="mb-1 font-semibold text-gray-600 dark:text-gray-300">{evaluation.level}</span></div>
                <p className="mt-5 text-sm leading-7 text-gray-600 dark:text-gray-400">{evaluation.feedback}</p>
                <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-950/60 dark:text-gray-400"><span className="font-semibold text-gray-900 dark:text-white">下一步：</span>{evaluation.nextStep}</div>
                {evaluation.effectMessage && <p className="mt-3 text-xs leading-5 text-brand-700 dark:text-brand-300">{evaluation.effectMessage}</p>}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-gray-200 p-6 text-center dark:border-gray-700"><Target className="mx-auto text-gray-300" size={30} /><p className="mt-3 text-sm text-gray-500">提交答案后显示评分和改进建议</p></div>
            )}</div>
          </div>
        </section>
      )}

      {nodeDialogOpen && selectedPath && selectedTopic && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-gray-950/45 p-4 backdrop-blur-sm" onMouseDown={() => setNodeDialogOpen(false)}>
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
              <div><span className="text-xs font-semibold text-brand-600">课程节点</span><h3 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">{selectedPath.title}</h3></div>
              <button onClick={() => setNodeDialogOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="关闭"><X size={20} /></button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-7 text-gray-600 dark:text-gray-400">{selectedPath.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">{selectedTopic.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{keyword}</span>)}</div>
              <div className="mt-5 flex gap-3">
                <button onClick={() => { setNodeDialogOpen(false); setActiveTab('tutor'); }} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"><Bot size={17} /> 围绕节点提问</button>
                <button onClick={() => { setNodeDialogOpen(false); setActiveTab('eval'); }} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"><Target size={17} /> 做理解检测</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, note }: { icon: React.ComponentType<{ size?: number }>; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Icon size={19} /></span><h2 className="font-semibold text-gray-950 dark:text-white">{title}</h2></div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{note}</span>
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value, accent = false }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`min-h-32 bg-white p-5 dark:bg-gray-900 ${accent ? 'ring-1 ring-inset ring-amber-200 dark:ring-amber-900' : ''}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${accent ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400'}`}><Icon size={16} /> {label}</div>
      <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">{value}</p>
    </div>
  );
}

function PathDetail({ node, busy, onToggleTask, onNavigate }: { node: PathNode; busy: boolean; onToggleTask: (node: PathNode, index: number) => void; onNavigate: (tab: TabKey) => void }) {
  return (
    <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:sticky xl:top-20">
      <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-semibold text-brand-600">第 {node.sequence} 步</span><h3 className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">{node.title}</h3></div>{node.passed && <CheckCircle2 className="text-emerald-500" size={23} />}</div>
      <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">{node.description}</p>
      <div className="mt-5 space-y-2">
        {node.tasks.map((task, index) => {
          const checked = node.completedTasks.includes(index);
          return (
            <button key={task} onClick={() => onToggleTask(node, index)} disabled={busy} className="flex w-full items-start gap-3 rounded-lg border border-gray-200 p-3 text-left text-sm text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300">
              <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>{checked && <Check size={14} />}</span><span>{task}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={() => onNavigate('tutor')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300">问导师</button>
        <button onClick={() => onNavigate('eval')} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">节点测评</button>
      </div>
      <p className="mt-4 text-xs text-gray-400">预计 {node.estimatedMinutes} 分钟 · 最高分 {node.bestScore} · 已作答 {node.attempts} 次</p>
    </aside>
  );
}

function SourcePanel({ course, node }: { course: CourseInfo; node: PathNode }) {
  return (
    <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-950 dark:text-white"><ShieldCheck className="text-emerald-500" size={19} /> 回答依据</div>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"><p className="text-xs text-gray-400">课程知识库</p><p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{course.title}</p></div>
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"><p className="text-xs text-gray-400">当前知识点</p><p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">{node.title}</p></div>
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"><p className="text-xs text-gray-400">检索策略</p><p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">向量 + 全文 + 中文词面兜底</p></div>
      </div>
    </aside>
  );
}
