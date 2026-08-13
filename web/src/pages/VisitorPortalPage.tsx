import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Code2,
  GraduationCap,
  Library,
  LineChart,
  Network,
  Play,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import logo from '../assets/logo.svg';
import heroImage from '../assets/visitor-hero-v2.png';
import './VisitorPortalPage.css';

const learningSteps = [
  { icon: BrainCircuit, label: '画像构建', detail: '理解目标与薄弱点', color: '#2563eb' },
  { icon: Route, label: '路径规划', detail: '生成专属学习顺序', color: '#0ea5e9' },
  { icon: Library, label: '资源匹配', detail: '组合六类课程资源', color: '#06b6d4' },
  { icon: Code2, label: '练习实操', detail: '测验与代码评测', color: '#6366f1' },
  { icon: ClipboardCheck, label: '智能评测', detail: '反馈驱动路径更新', color: '#10b981' },
];

const courses = [
  { name: 'MIT 6.006', focus: '算法设计与复杂度分析', meta: '算法基础 · 24 个学习节点' },
  { name: 'UC Berkeley CS61A', focus: '程序抽象、递归与解释器', meta: 'Python · 28 个学习节点' },
  { name: 'UC Berkeley CS61B', focus: '数据结构与工程化编程', meta: 'Java · 30 个学习节点' },
  { name: 'Nand2Tetris', focus: '从逻辑门到现代计算机', meta: '计算机系统 · 24 个学习节点' },
  { name: 'Harvard CS50x', focus: '计算机科学与 C 语言基础', meta: 'C 语言 · 26 个学习节点' },
];

const topicInsights: Record<string, string> = {
  '数组与链表': '这个节点已经完成。可以通过一道链表反转题巩固指针变化。',
  '树与搜索': '根据最近两次评测，建议先完成“二叉搜索树遍历”代码练习。',
  '哈希表': '建议比较链地址法与开放寻址法，再完成一次冲突模拟。',
  '图算法': '建议从 BFS 与 DFS 的访问顺序开始，再进入最短路径。',
};

const agents = [
  ['画像智能体', '识别学习目标、基础与偏好'],
  ['课程 RAG', '从课程知识库检索可靠内容'],
  ['规划智能体', '拆解阶段目标与学习顺序'],
  ['资源智能体', '匹配文档、视频和练习'],
  ['评测智能体', '分析答案并更新掌握度'],
  ['安全智能体', '校验内容边界与可信度'],
];

function DataFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let width = 0;
    let height = 0;
    let points: Array<{ x: number; y: number; vx: number; vy: number; radius: number; phase: number }> = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(18, Math.min(42, Math.floor(width / 42)));
      points = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.08 + Math.random() * 0.18,
        vy: (Math.random() - 0.5) * 0.08,
        radius: index % 7 === 0 ? 2.4 : 1.2,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      points.forEach((point, index) => {
        if (!reducedMotion) {
          point.x += point.vx;
          point.y += point.vy + Math.sin(time * 0.00045 + point.phase) * 0.025;
          if (point.x > width + 20) point.x = -20;
          if (point.y > height + 10) point.y = -10;
          if (point.y < -10) point.y = height + 10;
        }

        for (let next = index + 1; next < points.length; next += 1) {
          const other = points[next];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 145) {
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = `rgba(37, 99, 235, ${0.16 * (1 - distance / 145)})`;
            context.lineWidth = 0.8;
            context.stroke();
          }
        }

        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fillStyle = point.radius > 2 ? 'rgba(14, 165, 233, .55)' : 'rgba(37, 99, 235, .3)';
        context.fill();
      });
      if (!reducedMotion) animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="visitor-data-canvas" aria-hidden="true" />;
}

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && node.classList.add('is-visible'),
      { threshold: 0.14 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`visitor-reveal ${className}`}>{children}</div>;
}

export default function VisitorPortalPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState('树与搜索');
  const [activeAgent, setActiveAgent] = useState(0);
  const [activeCourse, setActiveCourse] = useState(0);
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveStep((step) => (step + 1) % learningSteps.length), 2600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let nextId = 0;
    const move = (event: PointerEvent) => {
      setTrail((items) => [...items.slice(-8), { x: event.clientX, y: event.clientY, id: nextId++ }]);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 12;
      const y = (event.clientY / window.innerHeight - 0.5) * 8;
      hero.style.setProperty('--hero-x', `${x}px`);
      hero.style.setProperty('--hero-y', `${y}px`);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  return (
    <div className="visitor-page">
      <div className="visitor-pointer-trail" aria-hidden="true">{trail.map((item, index) => <i key={item.id} style={{ left: item.x, top: item.y, opacity: (index + 1) / 12 }} />)}</div>
      <header className="visitor-header">
        <div className="visitor-header-inner">
          <Link to="/visitor" className="visitor-brand" aria-label="星图智课首页">
            <span className="visitor-logo"><img src={logo} alt="" /></span>
            <span>星图智课</span>
          </Link>
          <nav className={menuOpen ? 'visitor-nav is-open' : 'visitor-nav'} aria-label="首页导航">
            <a href="#journey" onClick={() => setMenuOpen(false)}>学习闭环</a>
            <a href="#intelligence" onClick={() => setMenuOpen(false)}>智能协同</a>
            <a href="#courses" onClick={() => setMenuOpen(false)}>精品课程</a>
            <a href="#roles" onClick={() => setMenuOpen(false)}>双端服务</a>
          </nav>
          <div className="visitor-actions">
            <button className="visitor-text-button" onClick={() => navigate('/login')}>登录</button>
            <button className="visitor-primary-small" onClick={() => navigate('/login?entry=teacher')}>管理端</button>
            <button className="visitor-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="切换导航">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section ref={heroRef} className="visitor-hero">
          <div className="visitor-hero-image" style={{ backgroundImage: `url(${heroImage})` }} />
          <div className="visitor-hero-shade" />
          <DataFlowCanvas />
          <div className="visitor-hero-content">
            <div className="visitor-kicker"><Sparkles size={15} /> 面向每位学生的 AI 学习伙伴</div>
            <h1><span>星图智课</span>让每一次学习<br />都有清晰的下一步</h1>
            <p>从对话画像到专属路径，从课程知识库到即时评测，六个智能体持续理解、规划并陪伴你的学习过程。</p>
            <div className="visitor-hero-actions">
              <button className="visitor-primary-button" onClick={() => navigate('/login')}>
                开始我的学习 <ArrowRight size={18} />
              </button>
              <a href="#journey" className="visitor-secondary-button"><Play size={16} fill="currentColor" /> 了解学习闭环</a>
            </div>
            <div className="visitor-hero-proof" aria-label="平台能力概览">
              <div><strong>5</strong><span>门完整课程</span></div>
              <div><strong>6</strong><span>个协同智能体</span></div>
              <div><strong>6</strong><span>类学习资源</span></div>
            </div>
          </div>
          <div className="visitor-live-status">
            <span className="visitor-live-dot" />
            <div><small>学习路径实时更新</small><strong>正在匹配下一知识点</strong></div>
            <div className="visitor-mini-bars"><i /><i /><i /><i /></div>
          </div>
          <a className="visitor-scroll-cue" href="#journey" aria-label="继续浏览"><span>探索学习旅程</span><ChevronDown size={18} /></a>
        </section>

        <section id="journey" className="visitor-section visitor-journey">
          <Reveal className="visitor-section-heading">
            <div className="visitor-eyebrow">Adaptive Learning Journey</div>
            <h2>不是给所有人同一张课表<br />而是让路径随学习不断生长</h2>
            <p>你的每一次对话、练习和评测，都会成为下一步推荐的依据。</p>
          </Reveal>

          <Reveal className="visitor-flow-shell">
            <div className="visitor-flow-track" aria-hidden="true"><span style={{ width: `${(activeStep / (learningSteps.length - 1)) * 100}%` }} /></div>
            <div className="visitor-flow-grid">
              {learningSteps.map((step, index) => {
                const Icon = step.icon;
                const reached = index <= activeStep;
                return (
                  <button key={step.label} className={reached ? 'visitor-flow-step is-active' : 'visitor-flow-step'} onClick={() => setActiveStep(index)}>
                    <span className="visitor-flow-icon" style={{ '--step-color': step.color } as React.CSSProperties}><Icon size={21} /></span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal className="visitor-product-demo">
            <div className="visitor-demo-sidebar">
              <span className="visitor-demo-label">今日路径</span>
              {['二叉搜索树', '哈希冲突处理', '代码实操'].map((item, index) => (
                <div className={index === 1 ? 'visitor-demo-task current' : 'visitor-demo-task'} key={item}>
                  <span>{index === 0 ? <Check size={13} /> : index + 1}</span>{item}
                </div>
              ))}
            </div>
            <div className="visitor-demo-map">
              <div className="visitor-map-title"><span>CS61B · 数据结构</span><small>学习路径已根据画像更新</small></div>
              <div className="visitor-map-nodes">
                {Object.keys(topicInsights).map((topic, index) => <Fragment key={topic}>
                  {index > 0 && <span className="visitor-map-line" />}
                  <button type="button" className={`visitor-map-node ${topic === '数组与链表' ? 'done' : ''} ${topic === activeTopic ? 'active' : ''}`} onClick={() => setActiveTopic(topic)}>{topic === '数组与链表' && <CheckCircle2 size={17} />}{topic === activeTopic && topic !== '数组与链表' && <span className="visitor-pulse" />}{topic}</button>
                </Fragment>)}
              </div>
              <div className="visitor-demo-insight"><Sparkles size={16} /><span>{topicInsights[activeTopic]}</span><button onClick={() => navigate('/login')}>进入练习</button></div>
            </div>
            <div className="visitor-demo-score">
              <div className="visitor-score-ring"><strong>68%</strong><span>课程进度</span></div>
              <div className="visitor-score-list"><span><i className="blue" />知识掌握 74</span><span><i className="green" />任务完成 8/12</span><span><i className="orange" />连续学习 6天</span></div>
            </div>
          </Reveal>
        </section>

        <section id="intelligence" className="visitor-section visitor-intelligence">
          <Reveal className="visitor-section-heading light">
            <div className="visitor-eyebrow">Multi-agent Collaboration</div>
            <h2>六个智能体协同<br />把复杂留给系统，把清晰交给学生</h2>
            <p>每一个回答都有课程知识支撑，每一次推荐都有学习行为依据。</p>
          </Reveal>
          <Reveal className="visitor-agent-stage">
            <div className="visitor-agent-orbit" aria-hidden="true"><span /><span /><span /></div>
            <div className="visitor-agent-core"><Bot size={28} /><strong>{agents[activeAgent][0]}</strong><small>正在协同</small></div>
            <div className="visitor-agent-grid">
              {agents.map(([title, detail], index) => (
                <button type="button" className={activeAgent === index ? 'visitor-agent-item is-active' : 'visitor-agent-item'} key={title} onClick={() => setActiveAgent(index)} style={{ '--agent-delay': `${index * 0.5}s` } as React.CSSProperties}>
                  <span>{index + 1}</span><div><strong>{title}</strong><small>{detail}</small></div>
                </button>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="courses" className="visitor-section visitor-courses">
          <Reveal className="visitor-course-heading">
            <div><div className="visitor-eyebrow">Open Course Collection</div><h2>五门课程构成完整的<br />计算机基础能力</h2></div>
            <p>课程不是简单链接集合。视频、文档、题目、代码练习和知识库围绕同一学习目标组织。</p>
          </Reveal>
          <Reveal className="visitor-course-marquee">
            <div className="visitor-course-track">
              {courses.map((course, index) => (
                <button type="button" className={activeCourse === index ? 'visitor-course-chip is-active' : 'visitor-course-chip'} key={course.name} onClick={() => setActiveCourse(index)}><BookOpen size={18} /><span>{course.name}</span><small>{course.meta}</small></button>
              ))}
            </div>
          </Reveal>
          <Reveal className="visitor-course-focus">
            <span>当前课程</span><strong>{courses[activeCourse].focus}</strong><small>{courses[activeCourse].meta}</small><button type="button" onClick={() => navigate('/login')}>进入课程 <ArrowRight size={15} /></button>
          </Reveal>
          <Reveal className="visitor-resource-row">
            {[
              [BookOpen, '图解文档'], [Network, '知识图谱'], [Play, '课程视频'],
              [Code2, '代码实操'], [ClipboardCheck, '智能测验'], [Bot, 'RAG 辅导'],
            ].map(([Icon, label]) => {
              const ResourceIcon = Icon as typeof BookOpen;
              return <button type="button" key={label as string} onClick={() => navigate('/login')}><ResourceIcon size={21} /><span>{label as string}</span><CheckCircle2 size={15} /></button>;
            })}
          </Reveal>
        </section>

        <section id="roles" className="visitor-section visitor-roles">
          <Reveal className="visitor-section-heading">
            <div className="visitor-eyebrow">One Platform, Two Perspectives</div>
            <h2>学生学得更明白<br />老师管得更从容</h2>
          </Reveal>
          <div className="visitor-role-bands">
            <Reveal className="visitor-role-band student">
              <div className="visitor-role-copy"><span><GraduationCap size={18} /> 学生端</span><h3>知道现在学什么<br />也知道为什么学</h3><p>画像、路径、课程、练习、评测和智能辅导集中在同一个学习现场。</p><button onClick={() => navigate('/login')}>进入学生端 <ArrowRight size={17} /></button></div>
              <div className="visitor-role-visual"><div className="visitor-chat-bubble ai"><Bot size={16} />你在递归边界上容易遗漏，我为你安排了两道针对性练习。</div><div className="visitor-chat-bubble user">先帮我讲清楚第一题的思路。</div><div className="visitor-learning-stat"><LineChart size={20} /><span>薄弱点掌握度</span><strong>42% → 76%</strong></div></div>
            </Reveal>
            <Reveal className="visitor-role-band teacher">
              <div className="visitor-role-copy"><span><Users size={18} /> 教师与管理员端</span><h3>看见班级趋势<br />及时发现每个学生</h3><p>建设课程、发布试卷、管理知识库，并通过真实数据获得教学建议。</p><button onClick={() => navigate('/login?entry=teacher')}>进入管理端 <ArrowRight size={17} /></button></div>
              <div className="visitor-role-visual"><div className="visitor-chart-bars"><i style={{ height: '48%' }} /><i style={{ height: '68%' }} /><i style={{ height: '58%' }} /><i style={{ height: '82%' }} /><i style={{ height: '74%' }} /><i style={{ height: '92%' }} /></div><div className="visitor-chart-axis"><span>学习活跃度</span><strong><BarChart3 size={18} />近30天 +24%</strong></div><div className="visitor-risk-note"><ShieldCheck size={18} /><span>已识别 3 名需要重点关注的学生</span></div></div>
            </Reveal>
          </div>
        </section>

        <section className="visitor-final-cta">
          <DataFlowCanvas />
          <Reveal>
            <span className="visitor-final-mark"><img src={logo} alt="" /></span>
            <h2>从今天的一个问题<br />走向属于你的知识地图</h2>
            <p>登录星图智课，让学习路径从第一次对话开始生长。</p>
            <button className="visitor-primary-button" onClick={() => navigate('/login')}>开始学习 <ArrowRight size={18} /></button>
          </Reveal>
        </section>
      </main>

      <footer className="visitor-footer">
        <div><span className="visitor-footer-brand"><img src={logo} alt="" />星图智课</span><p>AI 驱动的个性化课程学习平台</p></div>
        <div><a href="#journey">学习闭环</a><a href="#courses">精品课程</a><button onClick={() => navigate('/login')}>登录</button></div>
        <small>© 2026 星图智课</small>
      </footer>
    </div>
  );
}
