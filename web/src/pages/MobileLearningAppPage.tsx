import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Flame,
  Headphones,
  Home,
  Map,
  Mic,
  Play,
  Route,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import './MobileLearningAppPage.css';

type MobileTab = 'home' | 'path' | 'tutor' | 'practice' | 'profile';

type PathNode = {
  id: number;
  title: string;
  subtitle: string;
  duration: string;
  status: 'done' | 'current' | 'locked';
  score?: number;
};

type TutorMessage = {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  source?: string;
};

const tabs: Array<{ id: MobileTab; label: string; icon: typeof Home }> = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'path', label: '路径', icon: Route },
  { id: 'tutor', label: '辅导', icon: Bot },
  { id: 'practice', label: '练习', icon: Code2 },
  { id: 'profile', label: '我的', icon: UserRound },
];

const courses = [
  { id: 'mit', provider: 'MIT OCW', title: '算法设计与分析', progress: 42, tone: 'blue', image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=720&q=85' },
  { id: 'cs61a', provider: 'UC Berkeley', title: '程序设计方法', progress: 68, tone: 'teal', image: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=720&q=85' },
  { id: 'cs61b', provider: 'UC Berkeley', title: '数据结构', progress: 31, tone: 'indigo', image: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=720&q=85' },
  { id: 'nand', provider: 'Nand2Tetris', title: '计算机系统', progress: 18, tone: 'amber', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=720&q=85' },
  { id: 'cs50', provider: 'Harvard', title: 'C 语言基础', progress: 54, tone: 'red', image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=720&q=85' },
];

const initialPath: PathNode[] = [
  { id: 1, title: '复杂度分析', subtitle: '先修诊断已通过', duration: '18 分钟', status: 'done', score: 86 },
  { id: 2, title: '图的表示与遍历', subtitle: '当前优先 · 薄弱点补强', duration: '32 分钟', status: 'current' },
  { id: 3, title: '最短路径', subtitle: '完成当前节点后解锁', duration: '40 分钟', status: 'locked' },
  { id: 4, title: '动态规划', subtitle: '考前冲刺重点', duration: '46 分钟', status: 'locked' },
];

const initialMessages: TutorMessage[] = [
  {
    id: 1,
    role: 'assistant',
    text: '我已经定位到 MIT 6.006 的“图的遍历”节点。你可以直接问概念、例题，也可以让我先用一个生活化例子讲解。',
    source: '已检索课程讲义 · Lecture 9',
  },
];

function StatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <span>09:41</span>
      <div className="mobile-status-icons">
        <span className="mobile-signal">▮▮▮</span>
        <span>5G</span>
        <span className="mobile-battery"><i /></span>
      </div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div className="mobile-progress-ring" style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value}%</strong><span>课程掌握</span></div>
    </div>
  );
}

export default function MobileLearningAppPage() {
  const [tab, setTab] = useState<MobileTab>('home');
  const [selectedNode, setSelectedNode] = useState<PathNode | null>(null);
  const [pathNodes, setPathNodes] = useState(initialPath);
  const [messages, setMessages] = useState<TutorMessage[]>(initialMessages);
  const [question, setQuestion] = useState('');
  const [thinking, setThinking] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'running' | 'passed'>('idle');
  const [toast, setToast] = useState('');
  const recordingScrollRef = useRef<HTMLDivElement>(null);
  const controlScrollRef = useRef<HTMLDivElement>(null);

  const pageTitle = useMemo(() => ({
    home: '今日学习',
    path: '个性化路径',
    tutor: '课程辅导',
    practice: '代码练习',
    profile: '学习画像',
  })[tab], [tab]);

  useEffect(() => {
    recordingScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    controlScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openPathNode = (node: PathNode) => {
    setSelectedNode(node);
  };

  const sendQuestion = () => {
    const text = question.trim();
    if (!text || thinking) return;
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text }]);
    setQuestion('');
    setThinking(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, {
        id: Date.now() + 1,
        role: 'assistant',
        text: '广度优先搜索会按“距离起点的层数”逐层扩展，因此在无权图中第一次到达某个节点时，对应路径一定最短。你可以把队列理解成一条按发现顺序排队的探索队伍。',
        source: 'MIT 6.006 · Lecture 9 · 图搜索',
      }]);
      setThinking(false);
    }, 850);
  };

  const runCode = () => {
    if (runState === 'running') return;
    setRunState('running');
    window.setTimeout(() => {
      setRunState('passed');
      setPathNodes((nodes) => nodes.map((node) => node.id === 2 ? { ...node, score: 92 } : node));
      setToast('3 / 3 测试点通过，掌握度 +8%');
    }, 900);
  };

  const syncRecordingScroll = (event: UIEvent<HTMLDivElement>) => {
    if (recordingScrollRef.current) {
      recordingScrollRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const resetDemo = () => {
    setTab('home');
    setSelectedNode(null);
    setPathNodes(initialPath.map((node) => ({ ...node })));
    setMessages(initialMessages.map((message) => ({ ...message })));
    setQuestion('');
    setThinking(false);
    setRunState('idle');
    setToast('演示已重置，录制屏与操作屏已同步。');
  };

  const renderHome = () => (
    <div className="mobile-page mobile-home-page">
      <section className="mobile-greeting">
        <div>
          <span className="mobile-eyebrow">7月16日 · 连续学习 12 天</span>
          <h1>早上好，测试同学</h1>
          <p>今天先补强图搜索，再完成一道代码题。</p>
        </div>
        <button className="mobile-avatar-button" title="查看学习画像" onClick={() => setTab('profile')}>
          <span>测</span>
          <i />
        </button>
      </section>

      <section className="mobile-next-card">
        <div className="mobile-next-topline">
          <span><Zap size={14} /> AI 推荐下一步</span>
          <span>约 32 分钟</span>
        </div>
        <div className="mobile-next-main">
          <ProgressRing value={42} />
          <div className="mobile-next-copy">
            <small>MIT 6.006 · 第 3 章</small>
            <h2>图的表示与遍历</h2>
            <p>最近两次 BFS 题出错，先看讲解再完成针对练习。</p>
          </div>
        </div>
        <button className="mobile-primary-command" onClick={() => setTab('path')}>
          <Play size={17} fill="currentColor" />继续学习
        </button>
      </section>

      <section className="mobile-section">
        <div className="mobile-section-heading">
          <div><span>今日任务</span><strong>2 / 4</strong></div>
          <button title="查看全部任务" onClick={() => setTab('path')}><ChevronRight size={19} /></button>
        </div>
        <div className="mobile-task-list">
          <button className="mobile-task is-done" onClick={() => setToast('复杂度诊断：86 分，已通过')}>
            <CheckCircle2 size={20} />
            <span><strong>完成复杂度诊断</strong><small>得分 86 · 已计入画像</small></span>
            <Award size={18} />
          </button>
          <button className="mobile-task" onClick={() => setTab('tutor')}>
            <div className="mobile-task-icon is-blue"><Headphones size={18} /></div>
            <span><strong>听懂 BFS 与 DFS</strong><small>课程讲义 + 智能辅导</small></span>
            <ChevronRight size={18} />
          </button>
          <button className="mobile-task" onClick={() => setTab('practice')}>
            <div className="mobile-task-icon is-amber"><Code2 size={18} /></div>
            <span><strong>完成图遍历代码题</strong><small>3 个隐藏测试点</small></span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section className="mobile-section mobile-course-section">
        <div className="mobile-section-heading">
          <div><span>我的课程</span><strong>5 门</strong></div>
          <button title="搜索课程" onClick={() => setToast('课程搜索已打开')}><Search size={18} /></button>
        </div>
        <div className="mobile-course-strip">
          {courses.map((course) => (
            <button key={course.id} className={`mobile-course-card is-${course.tone}`} onClick={() => setToast(`已切换到「${course.title}」`)}>
              <img src={course.image} alt="" />
              <span className="mobile-course-overlay" />
              <span className="mobile-course-info">
                <small>{course.provider}</small>
                <strong>{course.title}</strong>
                <i><b style={{ width: `${course.progress}%` }} /></i>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const renderPath = () => (
    <div className="mobile-page mobile-path-page">
      <section className="mobile-path-summary">
        <div>
          <span className="mobile-eyebrow">考前冲刺模式</span>
          <h1>算法设计与分析</h1>
          <p>依据你的薄弱点和 18 天备考期动态生成</p>
        </div>
        <ProgressRing value={42} />
      </section>
      <div className="mobile-mode-control" role="tablist" aria-label="路径模式">
        <button className="is-active">推荐顺序</button><button>自由探索</button><button>冲刺模式</button>
      </div>
      <section className="mobile-path-chain">
        {pathNodes.map((node, index) => (
          <button key={node.id} className={`mobile-path-node is-${node.status}`} onClick={() => openPathNode(node)}>
            <span className="mobile-path-line" aria-hidden="true" />
            <span className="mobile-path-marker">
              {node.status === 'done' ? <Check size={18} /> : <span>{index + 1}</span>}
            </span>
            <span className="mobile-path-content">
              <span className="mobile-path-kicker">{node.status === 'current' ? '当前学习' : node.status === 'done' ? '已掌握' : '待解锁'}</span>
              <strong>{node.title}</strong>
              <small>{node.subtitle}</small>
              <span className="mobile-path-meta"><Clock3 size={13} />{node.duration}{node.score ? <b>{node.score} 分</b> : null}</span>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </section>
      <section className="mobile-path-reason">
        <BrainCircuit size={20} />
        <div><strong>为什么推荐这个顺序？</strong><p>你的图遍历正确率为 58%，它又是最短路径和动态规划的先修知识。</p></div>
      </section>
    </div>
  );

  const renderTutor = () => (
    <div className="mobile-page mobile-tutor-page">
      <section className="mobile-tutor-context">
        <div className="mobile-tutor-avatar"><Bot size={24} /></div>
        <div><span>星图学习导师</span><strong>正在辅导：图的表示与遍历</strong></div>
        <i><span />在线</i>
      </section>
      <div className="mobile-tutor-tools">
        <button onClick={() => setQuestion('请用生活化例子解释 BFS')}><Sparkles size={15} />通俗解释</button>
        <button onClick={() => setQuestion('给我一道 BFS 小测')}><BookOpen size={15} />生成小测</button>
        <button onClick={() => setQuestion('比较 BFS 和 DFS')}><Map size={15} />对比梳理</button>
      </div>
      <section className="mobile-chat-stream">
        {messages.map((message) => (
          <div key={message.id} className={`mobile-message is-${message.role}`}>
            {message.role === 'assistant' && <span className="mobile-message-avatar"><Bot size={16} /></span>}
            <div>
              <p>{message.text}</p>
              {message.source && <button onClick={() => setToast(message.source ?? '')}><BookOpen size={13} />{message.source}</button>}
            </div>
          </div>
        ))}
        {thinking && <div className="mobile-thinking"><span /><span /><span /> 正在检索课程知识库</div>}
      </section>
      <div className="mobile-chat-composer">
        <button title="语音提问" onClick={() => setToast('语音输入已就绪')}><Mic size={19} /></button>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendQuestion()} placeholder="问一个关于当前知识点的问题" />
        <button className="is-send" title="发送" onClick={sendQuestion}><Send size={18} /></button>
      </div>
    </div>
  );

  const renderPractice = () => (
    <div className="mobile-page mobile-practice-page">
      <section className="mobile-practice-heading">
        <span className="mobile-eyebrow">图遍历 · 代码任务 02</span>
        <h1>统计连通分量</h1>
        <p>给定无向图，输出图中连通分量的数量。</p>
        <div><span><Clock3 size={14} />建议 20 分钟</span><span><Flame size={14} />中等</span></div>
      </section>
      <section className="mobile-code-panel">
        <div className="mobile-code-toolbar"><span>Python 3</span><button onClick={() => setToast('代码已恢复为初始版本')}>重置</button></div>
        <pre><code><span className="code-purple">def</span> <span className="code-blue">count_components</span>(graph):{`\n`}  visited = <span className="code-amber">set</span>(){`\n`}  count = <span className="code-cyan">0</span>{`\n\n`}  <span className="code-purple">for</span> start <span className="code-purple">in</span> graph:{`\n`}    <span className="code-purple">if</span> start <span className="code-purple">in</span> visited:{`\n`}      <span className="code-purple">continue</span>{`\n`}    count += <span className="code-cyan">1</span>{`\n`}    <span className="code-comment"># 在这里完成 BFS</span>{`\n`}{`\n`}  <span className="code-purple">return</span> count</code></pre>
      </section>
      <section className="mobile-test-summary">
        <div><strong>测试结果</strong><span>{runState === 'passed' ? '3 / 3 通过' : '等待运行'}</span></div>
        {[1, 2, 3].map((item) => <span key={item} className={runState === 'passed' ? 'is-passed' : ''}>{runState === 'passed' ? <Check size={13} /> : item}</span>)}
      </section>
      {runState === 'passed' && <section className="mobile-ai-feedback"><Sparkles size={18} /><div><strong>AI 评测建议</strong><p>实现正确，队列中每个节点只进入一次，时间复杂度为 O(V+E)。本次结果已同步到学习画像。</p></div></section>}
      <button className={`mobile-run-button is-${runState}`} onClick={runCode}>
        {runState === 'running' ? <><span className="mobile-spinner" />正在评测</> : runState === 'passed' ? <><CheckCircle2 size={19} />再次运行</> : <><Play size={18} fill="currentColor" />运行全部测试</>}
      </button>
    </div>
  );

  const renderProfile = () => (
    <div className="mobile-page mobile-profile-page">
      <section className="mobile-profile-hero">
        <div className="mobile-profile-avatar">测<i /></div>
        <div><h1>测试同学</h1><p>人工智能方向 · 备考中</p><span><Award size={14} />专业版 · 不限次数</span></div>
        <button title="编辑画像" onClick={() => setToast('画像编辑已打开')}>编辑</button>
      </section>
      <section className="mobile-mastery-band">
        <div><span>综合掌握度</span><strong>64%</strong><small>较上周 +7%</small></div>
        <div className="mobile-mastery-bars"><i style={{ height: '42%' }} /><i style={{ height: '56%' }} /><i style={{ height: '49%' }} /><i style={{ height: '72%' }} /><i style={{ height: '88%' }} /><i style={{ height: '64%' }} /><i style={{ height: '76%' }} /></div>
      </section>
      <section className="mobile-section">
        <div className="mobile-section-heading"><div><span>动态学习画像</span><strong>第 6 版</strong></div><BrainCircuit size={19} /></div>
        <div className="mobile-profile-grid">
          <button onClick={() => setToast('目标：18 天后完成算法课程复习')}><small>当前目标</small><strong>算法期末冲刺</strong><span>18 天</span></button>
          <button onClick={() => setToast('依据最近 6 次练习动态更新')}><small>基础水平</small><strong>中等</strong><span>证据 12 条</span></button>
          <button onClick={() => setToast('每日可投入 60 分钟')}><small>可用时间</small><strong>1 小时 / 天</strong><span>晚间</span></button>
          <button onClick={() => setToast('偏好：先图解再练习')}><small>学习偏好</small><strong>图解 + 实操</strong><span>已确认</span></button>
        </div>
      </section>
      <section className="mobile-section">
        <div className="mobile-section-heading"><div><span>近期变化</span><strong>实时更新</strong></div></div>
        <div className="mobile-evidence-list">
          <div><span className="is-green"><Check size={15} /></span><p><strong>复杂度分析提升至 78%</strong><small>依据诊断测验与 2 次重做</small></p><time>今天</time></div>
          <div><span className="is-amber"><Flame size={15} /></span><p><strong>图遍历设为当前薄弱点</strong><small>连续 2 题在队列更新处出错</small></p><time>昨天</time></div>
          <div><span className="is-blue"><Route size={15} /></span><p><strong>学习路径已重新排序</strong><small>最短路径调整到图遍历之后</small></p><time>昨天</time></div>
        </div>
      </section>
    </div>
  );

  const renderPage = () => ({
    home: renderHome(),
    path: renderPath(),
    tutor: renderTutor(),
    practice: renderPractice(),
    profile: renderProfile(),
  })[tab];

  const renderRecordingScreen = () => (
    <div className="mobile-phone-shell mobile-phone-shell--recording" aria-label="录制用 App 屏幕">
      <StatusBar />
      <header className="mobile-app-header">
        <div>
          <span className="mobile-brand-mark"><Sparkles size={16} /></span>
          <strong>{pageTitle}</strong>
        </div>
        <button title="通知" disabled><Bell size={20} /><i>2</i></button>
      </header>
      <div className="mobile-app-content" ref={recordingScrollRef}>{renderPage()}</div>
      <nav className="mobile-bottom-nav" aria-label="录制屏导航">
        {tabs.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={tab === item.id ? 'is-active' : ''} disabled><Icon size={21} /><span>{item.label}</span>{tab === item.id && <i />}</button>;
        })}
      </nav>
      {selectedNode && (
        <div className="mobile-sheet-backdrop">
          <section className="mobile-node-sheet">
            <button className="mobile-sheet-close" title="关闭" disabled><X size={19} /></button>
            <span className="mobile-eyebrow">学习节点 {selectedNode.id}</span>
            <h2>{selectedNode.title}</h2>
            <p>{selectedNode.status === 'locked' ? '完成前置节点后即可解锁。你仍可先查看知识概览。' : '包含图解讲义、课程视频、智能辅导和一组通过任务。'}</p>
            <div className="mobile-sheet-resources"><span><BookOpen size={16} />图解讲义</span><span><Play size={16} />视频</span><span><Code2 size={16} />练习</span></div>
            <button className="mobile-primary-command" disabled>{selectedNode.status === 'locked' ? '查看知识概览' : selectedNode.status === 'done' ? '查看学习证据' : '开始当前节点'}<ChevronRight size={17} /></button>
          </section>
        </div>
      )}
      {toast && <div className="mobile-toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  );

  return (
    <main className="mobile-demo-stage">
      <header className="mobile-demo-studio-bar">
        <div className="mobile-demo-caption">
          <span>星图智课</span>
          <strong>双屏同步录制工作台</strong>
          <p>只操作右侧屏幕，录制左侧直角矩形画面。</p>
        </div>
        <div className="mobile-demo-studio-status">
          <span><i />镜像同步中</span>
          <button onClick={resetDemo}>重置演示</button>
        </div>
      </header>
      <section className="mobile-demo-screen-row" aria-label="同步 App 演示屏幕">
        <div className="mobile-demo-screen-column">
          <div className="mobile-demo-screen-label"><span>录制画面</span><small>已禁用鼠标操作</small></div>
          {renderRecordingScreen()}
        </div>
        <div className="mobile-demo-screen-column mobile-demo-screen-column--control">
          <div className="mobile-demo-screen-label"><span>操作画面</span><small>请在此处点击与输入</small></div>
      <div className="mobile-demo-caption mobile-demo-caption--legacy">
        <span>星图智课</span>
        <strong>移动学习端 · 竞赛演示</strong>
        <p>在 VS Code 浏览器中启动，截图时仅保留右侧手机画面。</p>
      </div>
      <div className="mobile-phone-shell mobile-phone-shell--control">
        <StatusBar />
        <header className="mobile-app-header">
          <div>
            <span className="mobile-brand-mark"><Sparkles size={16} /></span>
            <strong>{pageTitle}</strong>
          </div>
          <button title="通知" onClick={() => setToast('你有 2 条学习提醒')}><Bell size={20} /><i>2</i></button>
        </header>
        <div className="mobile-app-content" ref={controlScrollRef} onScroll={syncRecordingScroll}>{renderPage()}</div>
        <nav className="mobile-bottom-nav" aria-label="移动端主导航">
          {tabs.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}><Icon size={21} /><span>{item.label}</span>{tab === item.id && <i />}</button>;
          })}
        </nav>
        {selectedNode && (
          <div className="mobile-sheet-backdrop" onClick={() => setSelectedNode(null)}>
            <section className="mobile-node-sheet" onClick={(event) => event.stopPropagation()}>
              <button className="mobile-sheet-close" title="关闭" onClick={() => setSelectedNode(null)}><X size={19} /></button>
              <span className="mobile-eyebrow">学习节点 {selectedNode.id}</span>
              <h2>{selectedNode.title}</h2>
              <p>{selectedNode.status === 'locked' ? '完成前置节点后即可解锁。你仍可先查看知识概览。' : '包含图解讲义、课程视频、智能辅导和一组通过任务。'}</p>
              <div className="mobile-sheet-resources"><span><BookOpen size={16} />图解讲义</span><span><Play size={16} />视频</span><span><Code2 size={16} />练习</span></div>
              <button className="mobile-primary-command" onClick={() => { setSelectedNode(null); setTab(selectedNode.status === 'done' ? 'profile' : 'tutor'); }}>
                {selectedNode.status === 'locked' ? '查看知识概览' : selectedNode.status === 'done' ? '查看学习证据' : '开始当前节点'}<ChevronRight size={17} />
              </button>
            </section>
          </div>
        )}
        {toast && <div className="mobile-toast"><CheckCircle2 size={16} />{toast}</div>}
      </div>
        </div>
      </section>
    </main>
  );
}
