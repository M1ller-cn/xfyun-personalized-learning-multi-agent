import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiClient, getToken } from '../../api';

type ClassItem = { id: number; className: string; description?: string };
type Overview = {
  memberCount: number;
  totalDurationSec: number;
  totalDurationText: string;
  avgDurationSecPerMember: number;
  avgDurationText: string;
  totalActivities: number;
  activityTypeCounts: Record<string, number>;
  avgScoreRate: number;
};
type Ranking = {
  rank: number;
  userId: number;
  userName: string;
  totalDurationSec: number;
  durationText: string;
  activityCount: number;
  scoreRate: number;
  compositeScore: number;
};
type Subject = {
  subjectCode: string;
  subjectName: string;
  avgMasteryLevel: number;
  totalKnowledgePoints: number;
  weakPointCount: number;
  strongPointCount: number;
  totalAttempts: number;
  correctRate: number;
};
type TrendItem = { period: string; activityCount: number; totalDurationSec: number; durationText: string };

const DEMO_CLASS: ClassItem = { id: -1, className: 'CS61B-01 数据结构与算法', description: '教学演示班级' };
const DEMO_OVERVIEW: Overview = {
  memberCount: 126,
  totalDurationSec: 3985200,
  totalDurationText: '1,107小时',
  avgDurationSecPerMember: 31628,
  avgDurationText: '4小时27分',
  totalActivities: 3842,
  activityTypeCounts: { COURSE_WATCH: 1526, EXAM_PRACTICE: 1084, HOMEWORK_SUBMIT: 612, ARTICLE_READ: 620 },
  avgScoreRate: 0.742,
};
const DEMO_RANKING: Ranking[] = [
  { rank: 1, userId: 101, userName: '周予安', totalDurationSec: 33240, durationText: '9小时14分', activityCount: 68, scoreRate: 0.94, compositeScore: 96 },
  { rank: 2, userId: 102, userName: '许清越', totalDurationSec: 30180, durationText: '8小时23分', activityCount: 61, scoreRate: 0.91, compositeScore: 92 },
  { rank: 3, userId: 103, userName: '沈亦航', totalDurationSec: 28140, durationText: '7小时49分', activityCount: 55, scoreRate: 0.87, compositeScore: 88 },
  { rank: 4, userId: 104, userName: '苏婉宁', totalDurationSec: 24660, durationText: '6小时51分', activityCount: 49, scoreRate: 0.83, compositeScore: 84 },
  { rank: 5, userId: 105, userName: '李书言', totalDurationSec: 22320, durationText: '6小时12分', activityCount: 43, scoreRate: 0.79, compositeScore: 80 },
  { rank: 23, userId: 106, userName: '王泽宇', totalDurationSec: 14820, durationText: '4小时07分', activityCount: 27, scoreRate: 0.68, compositeScore: 67 },
  { rank: 37, userId: 107, userName: '陈子墨', totalDurationSec: 9720, durationText: '2小时42分', activityCount: 15, scoreRate: 0.62, compositeScore: 60 },
  { rank: 51, userId: 108, userName: '林昱辰', totalDurationSec: 6240, durationText: '1小时44分', activityCount: 9, scoreRate: 0.48, compositeScore: 46 },
];
const DEMO_SUBJECTS: Subject[] = [
  { subjectCode: 'HASH', subjectName: '哈希表与冲突处理', avgMasteryLevel: 0.58, totalKnowledgePoints: 12, weakPointCount: 4, strongPointCount: 3, totalAttempts: 326, correctRate: 0.61 },
  { subjectCode: 'TREE', subjectName: '树与遍历', avgMasteryLevel: 0.72, totalKnowledgePoints: 10, weakPointCount: 2, strongPointCount: 5, totalAttempts: 284, correctRate: 0.75 },
  { subjectCode: 'GRAPH', subjectName: '图搜索与最短路径', avgMasteryLevel: 0.76, totalKnowledgePoints: 9, weakPointCount: 2, strongPointCount: 6, totalAttempts: 252, correctRate: 0.78 },
  { subjectCode: 'RECURSION', subjectName: '递归与复杂度分析', avgMasteryLevel: 0.67, totalKnowledgePoints: 8, weakPointCount: 3, strongPointCount: 4, totalAttempts: 298, correctRate: 0.69 },
];
const DEMO_TREND: TrendItem[] = [38, 45, 52, 48, 66, 74, 59, 82, 91, 88, 102, 116, 109, 128, 142, 136, 157, 166, 148, 172, 188, 174, 201, 216, 208, 231, 248, 226, 264, 281]
  .map((activityCount, index) => ({ period: `06-${String(index + 1).padStart(2, '0')}`, activityCount, totalDurationSec: activityCount * 860, durationText: `${Math.round(activityCount * 860 / 3600)}小时` }));
const DEMO_RISK_NOTES: Record<number, string> = {
  106: '树的遍历掌握度进入观察区',
  107: '本周学习时长较上周下降 41%',
  108: '哈希表冲突处理连续 3 次未通过',
};

export default function LearningAnalyticsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState<number>(DEMO_CLASS.id);
  const [overview, setOverview] = useState<Overview>(DEMO_OVERVIEW);
  const [ranking, setRanking] = useState<Ranking[]>(DEMO_RANKING);
  const [subjects, setSubjects] = useState<Subject[]>(DEMO_SUBJECTS);
  const [trend, setTrend] = useState<TrendItem[]>(DEMO_TREND);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [demoMode, setDemoMode] = useState(true);

  const displayClasses = classes.length ? classes : [DEMO_CLASS];

  useEffect(() => {
    apiClient.get('/api/classes/list', { params: { pageNum: 1, pageSize: 100 } })
      .then((response) => {
        const payload = response.data?.data;
        const items = (payload?.list || payload?.records || []) as ClassItem[];
        if (items.length) {
          setClasses(items);
          setClassId(items[0].id);
          setDemoMode(false);
        } else {
          setDemoMode(true);
        }
      })
      .catch(() => setDemoMode(true))
      .finally(() => setLoading(false));
  }, []);

  const loadAnalytics = async (selectedId: number) => {
    setLoading(true);
    setAiReport('');
    if (selectedId === DEMO_CLASS.id) {
      setOverview(DEMO_OVERVIEW);
      setRanking(DEMO_RANKING);
      setSubjects(DEMO_SUBJECTS);
      setTrend(DEMO_TREND);
      setDemoMode(true);
      setLoading(false);
      return;
    }

    const [overviewRes, rankingRes, subjectsRes, trendRes] = await Promise.allSettled([
      apiClient.get(`/api/analytics/class/${selectedId}/overview`),
      apiClient.get(`/api/analytics/class/${selectedId}/ranking`),
      apiClient.get(`/api/analytics/class/${selectedId}/subjects`),
      apiClient.get(`/api/analytics/class/${selectedId}/trend`, { params: { granularity: 'day' } }),
    ]);
    const nextOverview = overviewRes.status === 'fulfilled' ? overviewRes.value.data?.data : null;
    const nextRanking = rankingRes.status === 'fulfilled' ? rankingRes.value.data?.data : [];
    const nextSubjects = subjectsRes.status === 'fulfilled' ? subjectsRes.value.data?.data : [];
    const nextTrend = trendRes.status === 'fulfilled' ? trendRes.value.data?.data?.items : [];
    const hasActivity = (nextOverview?.totalActivities || 0) > 0 || (nextSubjects?.length || 0) > 0 || (nextTrend?.length || 0) > 0;
    if (!hasActivity) {
      setOverview(DEMO_OVERVIEW);
      setRanking(DEMO_RANKING);
      setSubjects(DEMO_SUBJECTS);
      setTrend(DEMO_TREND);
      setDemoMode(true);
    } else {
      setOverview(nextOverview || DEMO_OVERVIEW);
      setRanking(nextRanking || []);
      setSubjects(nextSubjects || []);
      setTrend(nextTrend || []);
      setDemoMode(false);
    }
    setLoading(false);
  };

  useEffect(() => { loadAnalytics(classId); }, [classId]);

  const atRisk = useMemo(
    () => ranking.filter((item) => item.activityCount === 0 || item.scoreRate < 0.7).slice(-4).reverse(),
    [ranking],
  );
  const maxTrend = Math.max(1, ...trend.map((item) => item.activityCount));

  const generateAiReport = async () => {
    if (reportLoading) return;
    if (demoMode) {
      setAiReport('CS61B-01 的主要瓶颈集中在哈希表冲突处理与递归边界条件。建议先向林昱辰等连续错误学生推送 8 分钟中文导学和 3 道基础题；对陈子墨这类学习时长下降学生发送可点击的补学待办；课堂上用 10 分钟复盘链地址法与开放定址法的取舍。');
      return;
    }
    setReportLoading(true);
    setAiReport('');
    try {
      const response = await fetch(`/api/analytics/class/${classId}/ai-report`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
      if (!response.ok || !response.body) throw new Error('报告生成失败');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data && data !== '[DONE]') setAiReport((current) => current + data);
        }
      }
    } catch {
      setAiReport('暂时无法生成 AI 报告，请先根据薄弱知识点和待关注学生安排教学干预。');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-gray-950 dark:text-white">学情分析</h1>{demoMode && <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">演示学情</span>}</div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">班级进度、薄弱知识点和可执行的教学干预建议</p>
        </div>
        <div className="flex gap-2">
          <select value={classId} onChange={(event) => setClassId(Number(event.target.value))} className="min-w-60 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {displayClasses.map((item) => <option key={item.id} value={item.id}>{item.className}</option>)}
          </select>
          <button onClick={() => loadAnalytics(classId)} disabled={loading} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900" aria-label="刷新学情"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button>
        </div>
      </div>

      {demoMode && <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-800 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-200"><Sparkles className="mt-0.5 shrink-0" size={17} /><span>当前展示教学演示数据，用于完整呈现班级运行状态。班级产生真实学习事件后，趋势、排名和风险提醒会自动切换为真实数据。</span></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="班级学生" value={overview.memberCount} note="已加入班级" color="blue" />
        <Metric icon={Clock3} label="人均学习" value={overview.avgDurationText} note={`总计 ${overview.totalDurationText}`} color="cyan" />
        <Metric icon={Activity} label="学习活动" value={overview.totalActivities.toLocaleString()} note="课程、练习与阅读" color="violet" />
        <Metric icon={Target} label="平均正确率" value={`${Math.round((overview.avgScoreRate || 0) * 100)}%`} note="作业与测评" color="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <PanelHeader icon={TrendingUp} title="近30天学习趋势" note={`${trend.length} 个统计日`} />
          <div className="flex h-64 items-end gap-1.5 p-5">
            {trend.slice(-30).map((item, index) => (
              <div key={`${item.period}-${index}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <div className="relative w-full rounded-t bg-brand-100 transition-colors hover:bg-brand-500 dark:bg-brand-900/50" style={{ height: `${Math.max(8, item.activityCount / maxTrend * 184)}px` }} title={`${item.period} · ${item.activityCount} 次学习活动`} />
                {index % 5 === 0 && <span className="w-full truncate text-center text-[10px] text-gray-400">{item.period.slice(5)}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <PanelHeader icon={AlertTriangle} title="待关注学生" note={`${atRisk.length} 人`} />
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {atRisk.map((item) => (
              <div key={item.userId} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white">{item.userName}</p><p className="mt-1 truncate text-xs text-gray-500">{DEMO_RISK_NOTES[item.userId] || `${item.activityCount} 次活动 · ${item.durationText}`}</p></div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{Math.round(item.scoreRate * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <PanelHeader icon={BookOpen} title="知识掌握度" note="按知识点簇汇总" />
          <div className="space-y-4 p-5">
            {subjects.map((subject) => {
              const mastery = Math.round(subject.avgMasteryLevel * 100);
              return <div key={subject.subjectCode}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-gray-900 dark:text-white">{subject.subjectName}</p><p className="mt-1 text-xs text-gray-400">薄弱 {subject.weakPointCount} · 优势 {subject.strongPointCount} · 作答 {subject.totalAttempts}</p></div><strong className="text-sm text-brand-600">{mastery}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${mastery >= 80 ? 'bg-emerald-500' : mastery >= 60 ? 'bg-brand-500' : 'bg-amber-500'}`} style={{ width: `${mastery}%` }} /></div></div>;
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <PanelHeader icon={BarChart3} title="学生表现" note="综合学习时长、活动和正确率" />
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-950/50 dark:text-gray-400"><tr><th className="px-5 py-3">排名</th><th className="px-4 py-3">学生</th><th className="px-4 py-3">学习时长</th><th className="px-4 py-3">正确率</th><th className="px-5 py-3 text-right">综合分</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{ranking.slice(0, 8).map((item) => <tr key={item.userId} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"><td className="px-5 py-3.5 font-semibold text-brand-600">{item.rank}</td><td className="px-4 py-3.5 font-medium text-gray-900 dark:text-white">{item.userName}</td><td className="px-4 py-3.5 text-gray-500">{item.durationText}</td><td className="px-4 py-3.5 text-gray-500">{Math.round(item.scoreRate * 100)}%</td><td className="px-5 py-3.5 text-right font-semibold text-gray-900 dark:text-white">{Math.round(item.compositeScore)}</td></tr>)}</tbody></table></div>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <PanelHeader icon={Bot} title="AI 教学建议" note={demoMode ? '基于演示学情生成' : '基于当前班级真实学情'} />
        <div className="p-5">{aiReport ? <div className="whitespace-pre-wrap rounded-lg bg-brand-50 p-5 text-sm leading-7 text-gray-700 dark:bg-brand-950/30 dark:text-gray-300">{aiReport}</div> : <p className="text-sm text-gray-500">生成后将给出班级共性薄弱点、分层教学建议和下一步教学安排。</p>}<button onClick={generateAiReport} disabled={reportLoading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50">{reportLoading ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}生成教学建议</button></div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, color }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | number; note: string; color: 'blue' | 'cyan' | 'violet' | 'green' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30', cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30', violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30', green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' };
  return <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-lg ${colors[color]}`}><Icon size={20} /></span><span className="text-xs text-gray-400">近30天</span></div><strong className="mt-4 block text-2xl text-gray-950 dark:text-white">{value}</strong><p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p><p className="mt-1 text-xs text-gray-400">{note}</p></div>;
}

function PanelHeader({ icon: Icon, title, note }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; note: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800"><div className="flex items-center gap-2"><Icon className="text-brand-600" size={19} /><h2 className="font-semibold text-gray-950 dark:text-white">{title}</h2></div><span className="text-xs text-gray-400">{note}</span></div>;
}
