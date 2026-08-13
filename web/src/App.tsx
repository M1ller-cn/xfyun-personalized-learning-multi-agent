import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Header, Footer, Sider, Content } from './components/layout';
import { SiderProvider } from './context/SiderContext';
import { ChatProvider } from './context/ChatContext';
import { BannerCarousel, AnnouncementSection, DailyWordSection, DailyArticleSection, CourseScheduleCard } from './components/home';
import { MembershipCard } from './components/home/MembershipCard';
import { StudyStatsCard } from './components/home/StudyStatsCard';
import { StudyPlanCard } from './components/home/StudyPlanCard';
import { apiClient, DefaultApi, Configuration } from './api';
import type { CourseResponse } from './api/generated/models';
import { getCourseVisual } from './utils/courseVisuals';
import CourseDetailUserPage from './pages/CourseDetailUserPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';
import AnnouncementListPage from './pages/AnnouncementListPage';
import DailyWordDetailPage from './pages/DailyWordDetailPage';
import DailyWordListPage from './pages/DailyWordListPage';
import DailyArticleDetailPage from './pages/DailyArticleDetailPage';
import DailyArticleListPage from './pages/DailyArticleListPage';
import CirclePage from './pages/CirclePage';
import PostDetailPage from './pages/PostDetailPage';
import PostEditPage from './pages/PostEditPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import SchedulePage from './pages/SchedulePage';
import WordBookPage from './pages/WordBookPage';
import AiAssistantChatPage from './pages/AiAssistantChatPage';
import FeedbackPage from './pages/FeedbackPage';
import EbookListPage from './pages/EbookListPage';
import SearchResultsPage from './pages/SearchResultsPage';
import MembershipPage from './pages/MembershipPage';
import CourseListPage from './pages/CourseListPage';
import GradingSubmitPage from './pages/GradingSubmitPage';
import GradingResultPage from './pages/GradingResultPage';
import GradingDashboardPage from './pages/GradingDashboardPage';
import BookshelfPage from './pages/BookshelfPage';
import LearningWorkspacePage from './pages/LearningWorkspacePage';

const homeApi = new DefaultApi(new Configuration(), '', apiClient);

/** 主页内容 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [myCourses, setMyCourses] = useState<CourseResponse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [myCoursesLoading, setMyCoursesLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [heroSearch, setHeroSearch] = useState('');

  const fetchMyCourses = () => {
    setMyCoursesLoading(true);
    apiClient.get('/api/course/my', { params: { page: 1, size: 6 } })
      .then(res => {
        if (res.data.code === 0 && res.data.data) {
          setMyCourses(res.data.data);
        }
      })
      .catch(() => {})
      .finally(() => setMyCoursesLoading(false));
  };

  useEffect(() => {
    homeApi.listCourses({ status: 1, page: 1, size: 6 })
      .then(res => {
        if (res.data.code === 0 && res.data.data) {
          setCourses(res.data.data);
        }
      })
      .catch(() => {})
      .finally(() => setCoursesLoading(false));
    fetchMyCourses();
  }, []);

  const handleJoinCourse = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoining(true);
    try {
      const res = await apiClient.post('/api/course/join-by-code', { code });
      if (res.data?.code === 0) {
        setJoinCode('');
        fetchMyCourses();
        const course = res.data.data as CourseResponse | undefined;
        if (course?.id) navigate(`/course/${course.id}`);
      }
    } finally {
      setJoining(false);
    }
  };

  return (
  <div className="space-y-8">
    {/* 全宽区域：Banner + Hero */}
    <BannerCarousel />

    {/* Hero & Search */}
    <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xl dark:shadow-2xl border border-gray-100 dark:border-gray-800 min-h-[360px] flex items-center group [perspective:1000px] transition-colors duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--color-brand-100),0.5),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(var(--color-brand-900),0.3),rgba(15,23,42,0))]" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-100/50 dark:bg-brand-600/30 rounded-full blur-[80px] dark:blur-[100px] animate-pulse" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent-100/50 dark:bg-accent-500/30 rounded-full blur-[80px] dark:blur-[100px] animate-pulse delay-1000" />
      <div className="absolute top-12 right-24 w-16 h-16 bg-gradient-to-br from-brand-400 to-highlight-500 dark:from-brand-500 dark:to-highlight-600 rounded-2xl rotate-12 shadow-xl shadow-brand-500/30 dark:shadow-brand-500/20 animate-[float_6s_ease-in-out_infinite] opacity-90 dark:opacity-80" />
      <div className="absolute bottom-20 left-20 w-12 h-12 bg-gradient-to-br from-accent-300 to-brand-400 dark:from-accent-400 dark:to-brand-500 rounded-full shadow-lg shadow-accent-400/30 dark:shadow-accent-500/20 animate-[float_8s_ease-in-out_infinite_reverse] opacity-80 dark:opacity-60" />

      <div className="relative z-10 w-full px-8 md:px-16 py-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-gray-800 text-xs font-medium text-brand-600 dark:text-brand-300 mb-6 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-brand-400 animate-pulse"></span>
          星图智课
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-gray-900 dark:text-white">
          开启 <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-500 dark:from-brand-400 dark:to-accent-300">AI 学习新天地</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-2xl leading-relaxed">
          专为中小学生设计的智能学习伙伴。通过趣味 AI 互动、科学学习路径，发现你的无限潜能。
        </p>
        <div className="relative w-full max-w-2xl group/search">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-400 to-accent-400 dark:from-brand-500 dark:to-accent-500 rounded-2xl blur opacity-20 group-hover/search:opacity-30 dark:group-hover/search:opacity-40 transition-opacity duration-500"></div>
          <div className="relative flex items-center bg-white dark:bg-gray-900 dark:backdrop-blur-xl border border-gray-100 dark:border-gray-800 rounded-2xl p-2 shadow-xl dark:shadow-2xl transition-all duration-300 group-focus-within/search:border-brand-200 dark:group-focus-within/search:border-brand-500/30 group-focus-within/search:ring-4 group-focus-within/search:ring-brand-50 dark:group-focus-within/search:ring-brand-500/10">
            <div className="pl-4 pr-3 text-gray-400 group-focus-within/search:text-brand-500 dark:group-focus-within/search:text-brand-400 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <input type="text" value={heroSearch} onChange={e => setHeroSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && heroSearch.trim()) navigate(`/search?q=${encodeURIComponent(heroSearch.trim())}`); }} placeholder="想探索什么新知识？" className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 h-12 text-lg" />
            <button onClick={() => { if (heroSearch.trim()) navigate(`/search?q=${encodeURIComponent(heroSearch.trim())}`); }} className="bg-gray-900 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-500 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-gray-900/10 dark:shadow-brand-600/20 hover:shadow-brand-600/30 active:scale-95 flex items-center gap-2">
              <span>探索</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="text-gray-400 dark:text-gray-500">大家都在找:</span>
          {['少儿编程', '趣味数学', '英语口语', '科学小实验'].map(tag => (
            <a key={tag} onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)} className="cursor-pointer hover:text-brand-600 dark:hover:text-white hover:bg-brand-50 dark:hover:bg-brand-900/20 px-2 py-1 rounded transition-colors">{tag}</a>
          ))}
        </div>
      </div>
    </div>

    {/* Grid 布局：左栏（宽）放课程+美文，右栏（窄）放小组件 */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 左栏 - 课程表 + 热门课程 + 每日美文 */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-8">
        {/* 我的课表 */}
        <CourseScheduleCard />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">我的课程</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">老师发布或你用课程码加入的课程会出现在这里</p>
              </div>
              <button onClick={() => navigate('/courses')} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">课程广场</button>
            </div>
            {myCoursesLoading ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
              </div>
            ) : myCourses.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {myCourses.map((course) => {
                  const visual = getCourseVisual(course);
                  return (
                    <button key={String(course.id)} onClick={() => navigate(`/course/${course.id}`)} className="group text-left rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:border-brand-200 dark:hover:border-brand-700 hover:shadow-lg transition-all">
                      <div className="flex h-28">
                        <div className="relative w-32 flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800">
                          <img src={visual.cover} alt={course.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          <div className={`absolute inset-0 bg-gradient-to-br ${visual.accent} opacity-70 mix-blend-multiply`} />
                        </div>
                        <div className="min-w-0 flex-1 p-3">
                          <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{course.title}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{course.subtitle || course.description || '继续学习课程章节与资源'}</p>
                          <span className="mt-2 inline-flex text-xs text-brand-600 dark:text-brand-400 font-medium">继续学习</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center text-gray-500 dark:text-gray-400">
                还没有加入课程。输入老师给你的课程码，课程会自动进入学习区。
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-brand-100 dark:border-brand-900/60 bg-gradient-to-br from-brand-50 via-white to-cyan-50 dark:from-brand-950/40 dark:via-gray-900 dark:to-cyan-950/30 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">加入老师课程</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">输入课程码，例如 555 或 C00002。</p>
            <div className="mt-4 flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinCourse(); }}
                placeholder="课程码"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-950/70 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <button
                onClick={handleJoinCourse}
                disabled={joining || !joinCode.trim()}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {joining ? '加入中' : '加入'}
              </button>
            </div>
          </section>
        </div>

        {/* 热门课程 */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">热门课程</h2>
            <a onClick={() => navigate('/courses')} className="cursor-pointer text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm font-medium flex items-center gap-1">
              查看全部 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </a>
          </div>
          {coursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {courses.map((course) => {
                const visual = getCourseVisual(course);
                return (
                <div key={String(course.id)} onClick={() => navigate(`/course/${course.id}`)} className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-300 cursor-pointer">
                  <div className="relative aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img src={visual.cover} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className={`absolute inset-0 bg-gradient-to-br ${visual.accent} opacity-85 mix-blend-multiply`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-white/75">{visual.provider}</div>
                        <div className="text-sm font-bold text-white line-clamp-2 drop-shadow">{course.title}</div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/90 text-brand-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                      </div>
                    </div>
                    {course.courseTypeDesc && (
                      <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-900/90 dark:text-white px-2 py-1 rounded text-xs font-semibold backdrop-blur-sm">{course.courseTypeDesc}</div>
                    )}
                    {course.tags && course.tags.length > 0 && (
                      <div className="absolute top-2 left-2 flex gap-1">
                        {course.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="bg-brand-500/80 text-white px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-base mb-1.5 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-gray-900 dark:text-white">{course.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">{course.description || course.subtitle || '暂无简介'}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        {course.studentCount || 0} 位学员
                      </div>
                      <span className="text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-400 px-2 py-1 rounded">开始学习</span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p>暂无已发布的课程</p>
            </div>
          )}
        </div>

        {/* 每日美文 */}
        <DailyArticleSection />
      </div>

      {/* 右栏 - 学习状态 / 公告 / 每日单词 */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-6">
        <MembershipCard />
        <StudyStatsCard />
        <StudyPlanCard />
        <AnnouncementSection />
        <DailyWordSection />
      </div>
    </div>
  </div>
  );
};

function App() {
  return (
    <ChatProvider>
    <SiderProvider>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
        <Header />
        
        <div className="flex flex-1 max-w-[1536px] mx-auto w-full">
          <Sider />
          
          <Content>
            <Routes>
              <Route index element={<HomePage />} />
              <Route path="announcement/:id" element={<AnnouncementDetailPage />} />
              <Route path="announcements" element={<AnnouncementListPage />} />
              <Route path="daily-word/:id" element={<DailyWordDetailPage />} />
              <Route path="daily-words" element={<DailyWordListPage />} />
              <Route path="daily-article/:id" element={<DailyArticleDetailPage />} />
              <Route path="daily-articles" element={<DailyArticleListPage />} />
              <Route path="circle" element={<CirclePage />} />
              <Route path="circle/post/:postId" element={<PostDetailPage />} />
              <Route path="circle/edit" element={<PostEditPage />} />
              <Route path="circle/edit/:postId" element={<PostEditPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="word-book" element={<WordBookPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="ai-chat" element={<AiAssistantChatPage />} />
              <Route path="ai-chat/:assistantId" element={<AiAssistantChatPage />} />
              <Route path="course/:courseId" element={<CourseDetailUserPage />} />
              <Route path="ebooks" element={<EbookListPage />} />
              <Route path="bookshelf" element={<BookshelfPage />} />
              <Route path="courses" element={<CourseListPage />} />
              <Route path="membership" element={<MembershipPage />} />
              <Route path="search" element={<SearchResultsPage />} />
              <Route path="grading" element={<GradingSubmitPage />} />
              <Route path="grading/:submissionId" element={<GradingResultPage />} />
              <Route path="grading-dashboard" element={<GradingDashboardPage />} />
              <Route path="learning-workspace" element={<LearningWorkspacePage />} />
            </Routes>
          </Content>
        </div>
        
        <Footer />
      </div>
    </SiderProvider>
    </ChatProvider>
  );
}

export default App;
