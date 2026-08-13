import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, BellRing, BrainCircuit,
  CalendarDays, ChevronRight, ClipboardCheck, Clock3,
  FilePlus2, GraduationCap, LineChart, Play, RefreshCw, Send, Target,
  UploadCloud, UsersRound,
} from 'lucide-react';
import { Toast } from '../ui';

type TeacherCommandCenterProps = {
  onRefresh: () => void;
  refreshing?: boolean;
};

const weeklyActivity = [184, 216, 198, 267, 243, 316, 328];
const activityLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '今天'];

const mastery = [
  { name: '递归与高阶函数', score: 82, students: 126, state: 'stable' },
  { name: '链表与树', score: 71, students: 126, state: 'watch' },
  { name: '哈希表与复杂度', score: 58, students: 126, state: 'risk' },
  { name: '图搜索与 BFS', score: 76, students: 126, state: 'stable' },
  { name: '软件系统项目', score: 64, students: 126, state: 'watch' },
];

const students = [
  { name: '林昱辰', className: 'CS61B-01', focus: '哈希表冲突处理', score: 48, signal: '连续 3 次未通过', action: '推送补救包' },
  { name: '周思涵', className: 'CS61B-01', focus: '递归边界条件', score: 56, signal: '代码评测卡住 46 分钟', action: '发起辅导' },
  { name: '陈子墨', className: 'CS61B-02', focus: 'BFS 队列实现', score: 62, signal: '本周学习时长下降', action: '提醒学习' },
  { name: '李若彤', className: 'CS61B-02', focus: '时间复杂度分析', score: 65, signal: '章节测验待重做', action: '查看作答' },
  { name: '王泽宇', className: 'CS61B-03', focus: '树的遍历', score: 68, signal: '掌握度进入观察区', action: '安排练习' },
];

const classes = [
  { code: 'CS61B-01', course: 'Data Structures', students: 126, active: 88, progress: 76, score: 74, trend: '+8.4%' },
  { code: 'CS61B-02', course: 'Data Structures', students: 119, active: 81, progress: 69, score: 71, trend: '+4.1%' },
  { code: 'CS61A-01', course: 'Program Design', students: 96, active: 71, progress: 83, score: 79, trend: '+11.2%' },
  { code: '6.006-01', course: 'Algorithms', students: 74, active: 52, progress: 61, score: 68, trend: '+2.8%' },
  { code: 'CSAPP-01', course: 'Computer Systems', students: 71, active: 46, progress: 57, score: 66, trend: '-1.6%' },
];

function scoreTone(score: number) {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 65) return 'bg-sky-500';
  if (score >= 55) return 'bg-amber-500';
  return 'bg-rose-500';
}

function Metric({ icon: Icon, label, value, detail, tone = 'brand' }: {
  icon: React.ElementType; label: string; value: string; detail: string; tone?: 'brand' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950/35 dark:text-brand-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/35 dark:text-violet-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300',
  };
  return (
    <div className="min-w-0 border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={18} /></div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">较上周 +6.8%</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function ActivityChart() {
  const max = Math.max(...weeklyActivity);
  const points = weeklyActivity.map((value, index) => {
    const x = 10 + index * 53;
    const y = 104 - (value / max) * 76;
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="relative h-52 px-4 pb-7 pt-4">
      <div className="absolute inset-x-4 top-8 h-px bg-slate-100 dark:bg-slate-800" />
      <div className="absolute inset-x-4 top-[45%] h-px bg-slate-100 dark:bg-slate-800" />
      <div className="absolute inset-x-4 bottom-9 h-px bg-slate-100 dark:bg-slate-800" />
      <svg viewBox="0 0 340 124" className="h-full w-full overflow-visible" role="img" aria-label="近七日活跃学习人数趋势">
        <defs>
          <linearGradient id="teacher-activity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`10,112 ${points} 328,112`} fill="url(#teacher-activity-fill)" />
        <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {weeklyActivity.map((value, index) => {
          const x = 10 + index * 53;
          const y = 104 - (value / max) * 76;
          return <circle key={value} cx={x} cy={y} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2.5" />;
        })}
      </svg>
      <div className="absolute inset-x-4 bottom-0 flex justify-between text-xs text-slate-500 dark:text-slate-400">{activityLabels.map(label => <span key={label}>{label}</span>)}</div>
    </div>
  );
}

export function TeacherCommandCenter({ onRefresh, refreshing = false }: TeacherCommandCenterProps) {
  const navigate = useNavigate();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [selectedClass, setSelectedClass] = useState('CS61B-01');

  const notify = (message: string) => Toast.success(message);
  const selected = classes.find(item => item.code === selectedClass) || classes[0];

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-brand-700 dark:text-brand-300"><BrainCircuit size={16} />教学指挥台 <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">演示学情</span></div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">把班级的学习过程，看得清楚一点。</h1>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400">本页展示教学演示数据。真实学习事件接入后，图表与风险提醒会自动更新。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate('/admin/exam-papers')} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"><FilePlus2 size={17} />发布任务</button>
          <button type="button" onClick={() => navigate('/admin/knowledge-bases')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><UploadCloud size={17} />上传资料</button>
          <button type="button" title="刷新教学数据" onClick={onRefresh} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <section className="grid border border-slate-200 bg-slate-950 text-white dark:border-slate-800 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-sky-200">本周教学概览</span><span className="inline-flex items-center gap-1 text-sm text-emerald-300"><Activity size={15} />学习活跃度 65.4%</span></div>
          <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div><p className="text-5xl font-bold tabular-nums">318<span className="ml-2 text-xl font-medium text-slate-300">人</span></p><p className="mt-2 text-base text-slate-300">今天正在发生学习行为的学生</p></div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-l border-slate-700 pl-6 text-sm"><div><p className="text-slate-400">待批改</p><p className="mt-1 text-xl font-bold">14</p></div><div><p className="text-slate-400">需关注</p><p className="mt-1 text-xl font-bold text-amber-300">27</p></div><div><p className="text-slate-400">已完成任务</p><p className="mt-1 text-xl font-bold">1,284</p></div><div><p className="text-slate-400">AI 辅导会话</p><p className="mt-1 text-xl font-bold">462</p></div></div>
          </div>
          <div className="mt-7 flex flex-wrap gap-2"><button type="button" onClick={() => navigate('/admin/learning-analytics')} className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-sky-50">查看学情全貌 <ArrowRight size={16} /></button><button type="button" onClick={() => notify('已向 27 名待关注学生生成学习提醒草稿')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3.5 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"><BellRing size={16} />生成提醒</button></div>
        </div>
        <div className="border-t border-slate-800 bg-slate-900/80 p-6 lg:border-l lg:border-t-0"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"><AlertTriangle size={19} /></div><div><p className="font-semibold">今日最需要处理</p><p className="text-sm text-slate-400">CS61B-01 哈希表任务</p></div></div><p className="mt-6 text-3xl font-bold">28<span className="ml-2 text-base font-medium text-slate-400">人未通过</span></p><p className="mt-2 text-sm leading-6 text-slate-300">错误集中在冲突处理与装载因子。建议先推送 12 分钟中文讲解，再开放二次作答。</p><button type="button" onClick={() => notify('已生成“哈希表冲突处理”补救任务草稿')} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200">生成补救任务 <ChevronRight size={16} /></button></div>
      </section>

      <section className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-3 dark:border-slate-800 dark:bg-slate-800">
        <Metric icon={UsersRound} label="在学学生" value="486" detail="覆盖 5 门课程、7 个教学班" />
        <Metric icon={GraduationCap} label="本周完成率" value="82.6%" detail="高于目标线 7.6 个百分点" tone="emerald" />
        <Metric icon={ClipboardCheck} label="作业平均得分" value="74.2" detail="共 1,526 份已提交作业" tone="violet" />
        <Metric icon={Clock3} label="人均有效学习" value="5h 18m" detail="已过滤离开页面的无效时长" tone="cyan" />
        <Metric icon={BrainCircuit} label="薄弱知识点" value="8" detail="其中 3 个需要课堂复讲" tone="amber" />
        <Metric icon={AlertTriangle} label="风险学生" value="27" detail="有明确证据与可执行建议" tone="rose" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <Panel title="学习活跃趋势" subtitle={range === 'week' ? '近 7 天发生有效学习行为的学生数量' : '近 30 天活跃学生趋势'} action={<div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-slate-800"><button type="button" onClick={() => setRange('week')} className={`rounded-md px-2.5 py-1.5 ${range === 'week' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>近 7 天</button><button type="button" onClick={() => setRange('month')} className={`rounded-md px-2.5 py-1.5 ${range === 'month' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>近 30 天</button></div>}><ActivityChart /><div className="grid grid-cols-3 border-t border-slate-100 dark:border-slate-800"><div className="px-5 py-3"><p className="text-xs text-slate-500">最高活跃</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">328 人</p></div><div className="border-x border-slate-100 px-5 py-3 dark:border-slate-800"><p className="text-xs text-slate-500">环比增长</p><p className="mt-1 text-lg font-bold text-emerald-600">+12.4%</p></div><div className="px-5 py-3"><p className="text-xs text-slate-500">完成行为</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">3,842 次</p></div></div></Panel>
        <Panel title="任务完成漏斗" subtitle="以 CS61B 哈希表任务为例" action={<button type="button" onClick={() => navigate('/admin/exam-papers')} className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">查看任务</button>}><div className="space-y-4 p-5">{[['收到任务', 126, '100%'], ['进入学习资源', 114, '90%'], ['完成章节小测', 92, '73%'], ['提交代码评测', 79, '63%'], ['达到通过标准', 51, '40%']].map(([label, count, percent], index) => <div key={String(label)}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium text-slate-700 dark:text-slate-200">{label}</span><span className="font-semibold text-slate-950 dark:text-white">{count} <span className="font-normal text-slate-400">{percent}</span></span></div><div className="h-2 bg-slate-100 dark:bg-slate-800"><div className={`h-full ${index > 3 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: String(percent) }} /></div></div>)}<div className="mt-5 flex items-start gap-3 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300"><CircleAlertIcon /><span><strong className="text-slate-900 dark:text-white">关键流失发生在“提交代码评测”。</strong>可优先为 35 名学生推送运行环境说明和公开样例。</span></div></div></Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.25fr]">
        <Panel title="知识点掌握热区" subtitle="颜色由测验、代码评测、学习时长和辅导记录综合计算" action={<button type="button" onClick={() => navigate('/admin/learning-analytics')} className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">查看分析</button>}><div className="divide-y divide-slate-100 p-5 dark:divide-slate-800">{mastery.map(item => <button key={item.name} type="button" onClick={() => notify(`已打开“${item.name}”知识点分析`)} className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"><span className={`h-2.5 w-2.5 flex-none rounded-full ${scoreTone(item.score)}`} /><span className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{item.name}</span><div className="hidden w-28 bg-slate-100 sm:block dark:bg-slate-800"><div className={`h-2 ${scoreTone(item.score)}`} style={{ width: `${item.score}%` }} /></div><span className="w-10 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{item.score}</span></button>)}</div><div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">掌握度低于 65 的知识点，会自动进入路径补救候选。</div></Panel>
        <Panel title="需要关注的学生" subtitle="由连续错误、学习中断、低掌握度和截止时间综合判定" action={<button type="button" onClick={() => navigate('/admin/learning-analytics')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">全部学生 <ArrowRight size={15} /></button>}><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-slate-50 text-xs font-semibold text-slate-500 dark:bg-slate-950/40 dark:text-slate-400"><tr><th className="px-5 py-3">学生</th><th className="px-4 py-3">当前薄弱点</th><th className="px-4 py-3">掌握度</th><th className="px-4 py-3">触发信号</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{students.map(student => <tr key={student.name} className="hover:bg-brand-50/40 dark:hover:bg-brand-950/15"><td className="px-5 py-3.5"><p className="font-semibold text-slate-900 dark:text-white">{student.name}</p><p className="mt-0.5 text-xs text-slate-500">{student.className}</p></td><td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300">{student.focus}</td><td className="px-4 py-3.5"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${student.score < 55 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300'}`}>{student.score}</span></td><td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{student.signal}</td><td className="px-4 py-3.5 text-right"><button type="button" onClick={() => notify(`已为 ${student.name} 创建“${student.action}”待办`)} className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">{student.action}</button></td></tr>)}</tbody></table></div></Panel>
      </div>

      <Panel title="班级与课程运行情况" subtitle="选择一个班级，查看它在课程完成、课堂活跃与任务得分上的动态" action={<div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><LineChart size={16} />共 5 门课程 · 7 个班</div>}><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="border-y border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400"><tr><th className="px-5 py-3">班级 / 课程</th><th className="px-4 py-3">学生数</th><th className="px-4 py-3">今日活跃</th><th className="px-4 py-3">课程进度</th><th className="px-4 py-3">作业均分</th><th className="px-4 py-3">趋势</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{classes.map(item => <tr key={item.code} className={selectedClass === item.code ? 'bg-brand-50/50 dark:bg-brand-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}><td className="px-5 py-4"><button type="button" onClick={() => setSelectedClass(item.code)} className="text-left"><p className="font-semibold text-slate-900 dark:text-white">{item.code}</p><p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.course}</p></button></td><td className="px-4 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{item.students}</td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className="text-sm font-semibold text-slate-900 dark:text-white">{item.active}</span><span className="text-xs text-slate-500">{Math.round(item.active / item.students * 100)}%</span></div></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-2 w-24 bg-slate-100 dark:bg-slate-800"><div className="h-full bg-brand-500" style={{ width: `${item.progress}%` }} /></div><span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.progress}%</span></div></td><td className="px-4 py-4"><span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.score}</span></td><td className="px-4 py-4"><span className={item.trend.startsWith('-') ? 'text-sm font-semibold text-rose-600' : 'text-sm font-semibold text-emerald-600'}>{item.trend}</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => navigate('/admin/learning-analytics')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">学情 <ChevronRight size={15} /></button></td></tr>)}</tbody></table></div><div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300"><span>当前选中 <strong className="text-slate-900 dark:text-white">{selected.code}</strong>：本周有 {selected.students - selected.active} 人尚未产生学习行为。</span><button type="button" onClick={() => notify(`已创建 ${selected.code} 未活跃学生提醒草稿`)} className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"><Send size={15} />向未活跃学生发送提醒</button></div></Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="AI 教学建议" subtitle="基于当前班级的学习事件与掌握度证据生成"><div className="divide-y divide-slate-100 dark:divide-slate-800"><Recommendation icon={Target} title="把哈希表任务拆成“概念 + 代码”两次提交" copy="CS61B-01 在“提交代码评测”环节流失 35 人。先用 3 道选择题确认冲突处理概念，再开放代码题，预计可提升 14% 通过率。" action="创建补救任务" onClick={() => notify('已创建哈希表分层补救任务草稿')} /><Recommendation icon={Play} title="为递归边界条件补一段中文导学" copy="21 名学生观看了原视频但仍在递归题错误。系统建议在外文视频前插入 8 分钟中文导学，并关联 3 道基础题。" action="生成导学" onClick={() => notify('已生成递归中文导学脚本')} /><Recommendation icon={CalendarDays} title="把 CSAPP-01 的截止提醒提前 24 小时" copy="该班的学习峰值出现在截止前 2 小时，补交率偏高。将首次提醒提前到截止前一天可降低临期堆积。" action="设置提醒" onClick={() => notify('已打开截止提醒设置')} /></div></Panel>
        <Panel title="今天的教学待办" subtitle="按截止时间与影响范围排序"><div className="divide-y divide-slate-100 dark:divide-slate-800"><Todo time="10:30" title="复核 6 份主观题 AI 评分建议" copy="算法设计 · 期中诊断" action="进入批改" onClick={() => navigate('/admin/exam-papers')} urgent /><Todo time="14:00" title="发布 CS61B 哈希表补救任务" copy="影响 28 名未通过学生" action="去发布" onClick={() => navigate('/admin/exam-papers')} /><Todo time="明天" title="为 CSAPP-01 上传第 3 章讲义" copy="资料入库后可供 RAG 检索与智能辅导引用" action="上传资料" onClick={() => navigate('/admin/knowledge-bases')} /><Todo time="本周" title="查看学习风险学生回访结果" copy="已有 12 人完成系统推荐的补救学习" action="查看学情" onClick={() => navigate('/admin/learning-analytics')} /></div></Panel>
      </div>
    </div>
  );
}

function CircleAlertIcon() {
  return <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><AlertTriangle size={14} /></div>;
}

function Recommendation({ icon: Icon, title, copy, action, onClick }: { icon: React.ElementType; title: string; copy: string; action: string; onClick: () => void }) {
  return <div className="flex gap-3 px-5 py-4"><div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"><Icon size={17} /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{copy}</p><button type="button" onClick={onClick} className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">{action} <ArrowRight className="inline" size={14} /></button></div></div>;
}

function Todo({ time, title, copy, action, onClick, urgent = false }: { time: string; title: string; copy: string; action: string; onClick: () => void; urgent?: boolean }) {
  return <div className="flex items-start gap-4 px-5 py-4"><div className={`min-w-12 pt-0.5 text-sm font-bold ${urgent ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>{time}</div><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy}</p></div><button type="button" onClick={onClick} className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">{action}</button></div>;
}
