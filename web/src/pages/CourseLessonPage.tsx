import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronRight, Play, CheckCircle2,
  Download, SkipBack, SkipForward, BookOpen, Menu, X, ExternalLink, Globe2,
} from 'lucide-react';
import { apiClient, DefaultApi, Configuration } from '../api';
import type {
  CourseStructureResponse,
  ChapterResponse,
  SectionResponse,
} from '../api/generated/models';
import { toast, ArtPlayerWrapper, FocusMonitor } from '../components/ui';
import { getPlayableEmbedUrl, isDirectMediaUrl } from '../utils/courseVisuals';

const api = new DefaultApi(new Configuration(), '', apiClient);

type SectionExt = SectionResponse;

const formatDuration = (seconds?: number) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
};

const getResourceProvider = (url?: string | null) => {
  if (!url) return '课程资源';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('ocw.mit.edu')) return 'MIT OpenCourseWare';
    if (host.includes('coursera.org')) return 'Coursera';
    if (host.includes('nand2tetris.org')) return 'Nand2Tetris';
    if (host.includes('cs61a.org') || host.includes('datastructur.es')) return 'Berkeley Course Site';
    if (host.includes('cs50.harvard.edu')) return 'Harvard CS50';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('bilibili.com')) return 'Bilibili';
    return host;
  } catch {
    return '课程资源';
  }
};

// 浠庣粨鏋勪腑鎻愬彇鎵佸钩鍖栫殑灏忚妭鍒楄〃
const flattenSections = (chapters: ChapterResponse[]): { section: SectionExt; chapter: ChapterResponse }[] => {
  const result: { section: SectionExt; chapter: ChapterResponse }[] = [];
  const sorted = [...chapters].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  for (const ch of sorted) {
    const sections = ((ch.sections || []) as SectionExt[]).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    for (const sec of sections) {
      result.push({ section: sec, chapter: ch });
    }
  }
  return result;
};

const CourseLessonPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [structure, setStructure] = useState<CourseStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [initialSeek, setInitialSeek] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackUrlLoading, setPlaybackUrlLoading] = useState(false);
  const lastSaveRef = useRef<number>(0);

  const currentSectionId = searchParams.get('section') || '';

  // 鍔犺浇璇剧▼缁撴瀯
  const fetchStructure = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await api.getCourseStructure({ courseId: courseId as unknown as number });
      if (res.data.code === 0 && res.data.data) {
        setStructure(res.data.data);
        const ids = new Set((res.data.data.chapters || []).map(ch => String(ch.id)));
        setExpandedChapters(ids);
      } else {
        toast.error('鍔犺浇璇剧▼澶辫触');
      }
    } catch {
      toast.error('缃戠粶閿欒');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchStructure(); }, [fetchStructure]);

  // 鍔犺浇瀛︿範杩涘害
  useEffect(() => {
    if (!courseId) return;
    api.getCourseProgress({ courseId: courseId as unknown as number })
      .then(res => {
        if (res.data.code === 0 && res.data.data) {
          const progList = Array.isArray(res.data.data) ? res.data.data : [];
          const completed = new Set<string>();
          let seekPos = 0;
          for (const p of progList) {
            if (p.isCompleted) completed.add(String(p.sectionId));
            if (String(p.sectionId) === currentSectionId && p.lastPosition) {
              seekPos = p.lastPosition;
            }
          }
          setCompletedSections(completed);
          setInitialSeek(seekPos);
        }
      })
      .catch(() => {});
  }, [courseId, currentSectionId]);

  // 鎵佸钩鍖栧皬鑺?
  const chapters = (structure?.chapters || []).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const flatList = flattenSections(chapters);
  const currentIndex = flatList.findIndex(item => String(item.section.id) === currentSectionId);
  const currentItem = currentIndex >= 0 ? flatList[currentIndex] : null;
  const currentSection = currentItem?.section;
  const currentChapter = currentItem?.chapter;

  useEffect(() => {
    let cancelled = false;

    const resolvePlaybackUrl = async () => {
      if (!currentSection?.id) {
        setPlaybackUrl('');
        setPlaybackUrlLoading(false);
        return;
      }

      if (currentSection.hlsUrl) {
        setPlaybackUrlLoading(true);
        try {
          const res = await api.getStreamToken({ sectionId: currentSection.id });
          const token = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;

          if (!cancelled && token) {
            const proxiedUrl = new URL(`/api/video/hls/${currentSection.id}?token=${encodeURIComponent(String(token))}`, window.location.origin);
            setPlaybackUrl(proxiedUrl.toString());
          } else if (!cancelled) {
            setPlaybackUrl('');
          }
        } catch {
          if (!cancelled) {
            setPlaybackUrl('');
            toast.error('瑙嗛鎾斁鍦板潃鑾峰彇澶辫触');
          }
        } finally {
          if (!cancelled) {
            setPlaybackUrlLoading(false);
          }
        }
        return;
      }

      setPlaybackUrl(currentSection.videoUrl || '');
      setPlaybackUrlLoading(false);
    };

    resolvePlaybackUrl();

    return () => {
      cancelled = true;
    };
  }, [currentSection?.hlsUrl, currentSection?.id, currentSection?.videoUrl]);

  // 濡傛灉娌℃湁鎸囧畾 section 涓斿凡鍔犺浇缁撴瀯锛岃嚜鍔ㄩ€夋嫨绗竴涓?
  useEffect(() => {
    if ((!currentSectionId || currentIndex < 0) && flatList.length > 0 && !loading) {
      setSearchParams({ section: String(flatList[0].section.id) }, { replace: true });
    }
  }, [currentIndex, currentSectionId, flatList, loading, setSearchParams]);

  // 鍒囨崲灏忚妭
  const goToSection = (sectionId: string) => {
    setInitialSeek(0);
    setSearchParams({ section: sectionId });
  };

  const goPrev = () => {
    if (currentIndex > 0) goToSection(String(flatList[currentIndex - 1].section.id));
  };

  const goNext = () => {
    if (currentIndex < flatList.length - 1) goToSection(String(flatList[currentIndex + 1].section.id));
  };

  // 淇濆瓨杩涘害
  const saveProgress = useCallback((currentTime: number, duration: number) => {
    if (!courseId || !currentSectionId || duration <= 0) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 10000) return; // 鑷冲皯闂撮殧10绉?
    lastSaveRef.current = now;

    const progress = Math.round((currentTime / duration) * 100);
    api.updateProgress1({
      updateProgressRequest: {
        courseId: courseId as unknown as number,
        sectionId: currentSectionId as unknown as number,
        lastPosition: Math.round(currentTime),
        watchDuration: Math.round(currentTime),
        progress: Math.min(progress, 100),
      },
    }).catch(() => {});

    // 鑷姩鏍囪瀹屾垚锛堚墺90%锛?
    if (progress >= 90 && !completedSections.has(currentSectionId)) {
      api.completeSection({
        sectionId: currentSectionId as unknown as number,
        courseId: courseId as unknown as number,
      }).then(() => {
        setCompletedSections(prev => new Set([...prev, currentSectionId]));
      }).catch(() => {});
    }
  }, [courseId, currentSectionId, completedSections]);

  // 鎵嬪姩鏍囪瀹屾垚
  const handleMarkComplete = async () => {
    if (!courseId || !currentSectionId) return;
    try {
      const res = await api.completeSection({
        sectionId: currentSectionId as unknown as number,
        courseId: courseId as unknown as number,
      });
      if (res.data.code === 0) {
        setCompletedSections(prev => new Set([...prev, currentSectionId]));
        toast.success('已标记完成');
      }
    } catch {
      toast.error('鎿嶄綔澶辫触');
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  // 鑾峰彇瑙嗛 URL
  const videoUrl = playbackUrl;
  const embedUrl = getPlayableEmbedUrl(videoUrl);
  const directMediaUrl = isDirectMediaUrl(videoUrl);
  const externalResourceUrl = !embedUrl && !directMediaUrl ? (videoUrl || currentSection?.resourceUrl || '') : (currentSection?.resourceUrl || '');
  const resourceProvider = getResourceProvider(externalResourceUrl);

  // 瀹屾垚杩涘害鐧惧垎姣?
  const completionPercent = flatList.length > 0 ? Math.round((completedSections.size / flatList.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">鍔犺浇璇剧▼涓?..</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      {/* 椤舵爮 */}
      <header className="h-13 bg-white dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 flex-shrink-0 z-20">
        <button onClick={() => navigate(`/course/${courseId}`)}
          className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors text-sm group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">返回课程</span>
        </button>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 truncate">
          <span className="truncate max-w-[140px]">{structure?.course?.title}</span>
          {currentChapter && (
            <>
              <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{currentChapter.title}</span>
            </>
          )}
          {currentSection && (
            <>
              <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              <span className="truncate font-semibold text-gray-900 dark:text-white">{currentSection.title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 杩涘害鎸囩ず鍣?*/}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }} />
            </div>
            <span className="text-xs text-gray-400 font-medium tabular-nums">{completionPercent}%</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={sidebarOpen ? '收起目录' : '展开目录'}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* 涓讳綋 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 瑙嗛 + 淇℃伅鍖哄煙 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 鎾斁鍣?*/}
          <div className="flex-1 bg-black flex items-center justify-center min-h-0">
            {playbackUrlLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
                <div className="text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">姝ｅ湪鍑嗗瑙嗛...</p>
                </div>
              </div>
            ) : embedUrl ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={currentSection?.title || '璇剧▼瑙嗛'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : videoUrl && directMediaUrl ? (
              <ArtPlayerWrapper
                key={videoUrl}
                url={videoUrl}
                poster={structure?.course?.coverImage}
                initialSeek={initialSeek}
                thumbnails={currentSection?.thumbnailUrl && currentSection?.thumbnailCount
                  ? { url: currentSection.thumbnailUrl, number: currentSection.thumbnailCount, column: 10 }
                  : undefined}
                onProgress={saveProgress}
                onEnded={() => {
                  if (!completedSections.has(currentSectionId)) {
                    handleMarkComplete();
                  }
                  // 鑷姩璺充笅涓€鑺?
                  if (currentIndex < flatList.length - 1) {
                    setTimeout(() => goNext(), 1500);
                  }
                }}
                className="!rounded-none w-full h-full"
                style={{ aspectRatio: undefined }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(37,99,235,0.26),transparent_38%),linear-gradient(180deg,#0f172a,#020617)]">
                <div className="w-full max-w-xl px-6">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl backdrop-blur">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-cyan-200 ring-1 ring-white/10">
                      {externalResourceUrl ? <Globe2 size={31} /> : <BookOpen size={31} />}
                    </div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100">
                      {externalResourceUrl ? resourceProvider : '等待配置'}
                    </div>
                    <h2 className="text-xl font-black text-white">
                      {externalResourceUrl ? '打开本节官方学习资源' : '本节暂未配置视频'}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
                      {externalResourceUrl
                        ? '这类开放课程通常把视频、讲义、作业放在官方课程站点。平台保留学习进度与章节导航，资源会在原站点打开。'
                        : '请选择右侧其他小节，或在教师端为当前小节补充视频链接。'}
                    </p>
                    {externalResourceUrl && (
                      <a
                        href={externalResourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-950/30 transition-colors hover:bg-brand-500">
                        打开资源
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 搴曢儴淇℃伅鏍?*/}
          <div className="flex-shrink-0 px-5 py-3 bg-white dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between gap-4">
              {/* 宸︿晶锛氭爣棰?鎻忚堪 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {currentSection?.title || '璇烽€夋嫨灏忚妭'}
                  </h2>
                  {currentSection?.duration && currentSection.duration > 0 && (
                    <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
                      {formatDuration(currentSection.duration)}
                    </span>
                  )}
                </div>
                {currentSection?.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{currentSection.description}</p>
                )}
              </div>

              {/* 鍙充晶锛氭搷浣滄寜閽?*/}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={goPrev} disabled={currentIndex <= 0}
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="上一节">
                  <SkipBack size={16} />
                </button>
                <button onClick={goNext} disabled={currentIndex >= flatList.length - 1}
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="下一节">
                  <SkipForward size={16} />
                </button>
                <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
                <FocusMonitor enabled={!!videoUrl && (directMediaUrl || !!embedUrl)} />
                <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
                {currentSection?.resourceUrl && (
                  <a href={currentSection.resourceUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
                    title="下载课件">
                    <Download size={14} />
                    <span className="hidden sm:inline">课件</span>
                  </a>
                )}
                {currentSection && (
                  <button onClick={handleMarkComplete}
                    disabled={completedSections.has(currentSectionId)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      completedSections.has(currentSectionId)
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400'
                    }`}>
                    <CheckCircle2 size={13} />
                    {completedSections.has(currentSectionId) ? '已完成' : '完成'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 渚ц竟鐩綍 */}
        <aside className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-l border-gray-200 dark:border-gray-800 shadow-[0_10px_30px_rgba(0,0,0,0.05)] flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-72 xl:w-80' : 'w-0 border-l-0'
        } fixed lg:relative right-0 top-13 bottom-0 lg:top-auto lg:bottom-auto lg:right-auto z-10 ${sidebarOpen ? '' : 'lg:w-0'}`}>
          {/* 鐩綍澶?*/}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-gray-400 dark:text-gray-500">课程目录</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-6">进度与章节</h3>
              </div>
              <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-md leading-none">
                {completedSections.size}/{flatList.length}
              </span>
            </div>
            {/* 杩涘害鏉?*/}
            <div className="mt-3 w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${completionPercent}%` }} />
            </div>
          </div>

          {/* 鐩綍鍒楄〃 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {chapters.map((chapter, ci) => {
              const chId = String(chapter.id);
              const isExpanded = expandedChapters.has(chId);
              const sections = ((chapter.sections || []) as SectionExt[]).sort((a, b) => (a.sort || 0) - (b.sort || 0));
              const chapterCompleted = sections.filter(s => completedSections.has(String(s.id))).length;

              return (
                <div key={chId} className="border-b border-gray-50 dark:border-gray-800/40">
                  <button onClick={() => toggleChapter(chId)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left group">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      isExpanded ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {isExpanded
                        ? <ChevronDown size={12} />
                        : <ChevronRight size={12} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                        <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-semibold">第{ci + 1}章</span>
                        <span className="tabular-nums">{chapterCompleted}/{sections.length}</span>
                      </div>
                      <p className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate mt-1 leading-5">{chapter.title}</p>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="pb-1">
                      {sections.map((section, si) => {
                        const secId = String(section.id);
                        const isCurrent = secId === currentSectionId;
                        const isCompleted = completedSections.has(secId);

                        return (
                          <button key={secId} onClick={() => goToSection(secId)}
                            className={`w-full flex items-center gap-3 pl-12 pr-4 py-2.5 text-left transition-all group/item ${
                              isCurrent
                                ? 'bg-brand-50/80 dark:bg-brand-900/20 border-l-2 border-brand-500'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                            }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              isCompleted
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : isCurrent
                                  ? 'bg-brand-100 dark:bg-brand-900/30'
                                  : 'bg-gray-100 dark:bg-gray-800 group-hover/item:bg-gray-200 dark:group-hover/item:bg-gray-700'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle2 size={12} className="text-green-500" />
                              ) : isCurrent ? (
                                <Play size={10} className="text-brand-500" fill="currentColor" />
                              ) : (
                                <span className="text-[11px] font-semibold text-gray-400">{si + 1}</span>
                              )}
                            </div>
                            <span className={`text-sm truncate flex-1 transition-colors leading-5 ${
                              isCurrent
                                ? 'font-semibold text-brand-600 dark:text-brand-400'
                                : isCompleted
                                  ? 'text-gray-500 dark:text-gray-500'
                                  : 'text-gray-600 dark:text-gray-400 group-hover/item:text-gray-900 dark:group-hover/item:text-gray-200'
                            }`}>
                              {section.title}
                            </span>
                            {section.duration && section.duration > 0 && (
                              <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{formatDuration(section.duration)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* 绉诲姩绔晶杈规爮閬僵 */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-[9] lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default CourseLessonPage;
