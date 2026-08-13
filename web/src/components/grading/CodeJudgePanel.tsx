import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  AlertCircle,
  Bot,
  CheckCircle,
  ChevronDown,
  Code2,
  Copy,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../api';
import toast from '../ui/Toast';

type Language = 'cpp' | 'python' | 'java';

interface LocalTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  collapsed: boolean;
}

interface CustomTestResult {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
  exitCode: number;
}

interface CustomJudgeResult {
  passed: number;
  total: number;
  verdict: string;
  cases: CustomTestResult[];
}

interface JudgeDraft {
  language: Language;
  code: string;
  tests: LocalTestCase[];
  completedRuns: number;
  lastPassedAt?: string;
}

const STORAGE_KEY = 'nova:cph-code-judge:v2';

const emptyCode: Record<Language, string> = {
  cpp: '',
  python: '',
  java: '',
};

const monacoLanguage: Record<Language, string> = {
  cpp: 'cpp',
  python: 'python',
  java: 'java',
};

const fileName: Record<Language, string> = {
  cpp: 'main.cpp',
  python: 'main.py',
  java: 'Main.java',
};

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createCase = (): LocalTestCase => ({
  id: newId(),
  input: '',
  expectedOutput: '',
  collapsed: false,
});

const normalize = (value: string) =>
  value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

const loadDraft = (): JudgeDraft => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { language: 'cpp', code: '', tests: [createCase()], completedRuns: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<JudgeDraft>;
    return {
      language: parsed.language === 'python' || parsed.language === 'java' ? parsed.language : 'cpp',
      code: parsed.code ?? '',
      tests: Array.isArray(parsed.tests) && parsed.tests.length ? parsed.tests : [createCase()],
      completedRuns: Number(parsed.completedRuns || 0),
      lastPassedAt: parsed.lastPassedAt,
    };
  } catch {
    return { language: 'cpp', code: '', tests: [createCase()], completedRuns: 0 };
  }
};

const CodeJudgePanel: React.FC = () => {
  const [draft, setDraft] = useState<JudgeDraft>(() => loadDraft());
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [result, setResult] = useState<CustomJudgeResult | null>(null);
  const [analysis, setAnalysis] = useState('');

  const { language, code, tests, completedRuns, lastPassedAt } = draft;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setSaved(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const passedMap = useMemo(() => {
    const map = new Map<string, CustomTestResult>();
    result?.cases.forEach(test => map.set(test.id, test));
    return map;
  }, [result]);

  const completionRate = Math.min(100, Math.round((completedRuns / 5) * 100));
  const visibleTotal = result?.total ?? tests.length;
  const visiblePassed = result?.passed ?? 0;

  const patchDraft = (patch: Partial<JudgeDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const updateTest = (id: string, patch: Partial<LocalTestCase>) => {
    patchDraft({ tests: tests.map(test => (test.id === id ? { ...test, ...patch } : test)) });
  };

  const addTest = () => {
    patchDraft({ tests: [...tests, createCase()] });
  };

  const removeTest = (id: string) => {
    if (tests.length <= 1) {
      toast.warning('至少保留一个测试用例');
      return;
    }
    patchDraft({ tests: tests.filter(test => test.id !== id) });
  };

  const switchLanguage = (next: Language) => {
    patchDraft({ language: next, code: emptyCode[next] });
    setResult(null);
    setAnalysis('');
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('已复制');
  };

  const markCourseProgressIfPossible = async () => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId');
    const sectionId = params.get('sectionId');
    if (!courseId || !sectionId) {
      return;
    }
    try {
      await apiClient.post(`/api/progress/section/${sectionId}/complete`, null, {
        params: { courseId },
      });
    } catch {
      toast.warning('代码已通过，但课程进度同步失败');
    }
  };

  const runAll = async () => {
    if (!code.trim()) {
      toast.warning('请先输入代码');
      return;
    }
    const validTests = tests.filter(test => test.input.trim() || test.expectedOutput.trim());
    if (!validTests.length) {
      toast.warning('请至少填写一个输入/预期输出');
      return;
    }

    setRunning(true);
    setAnalysis('');
    try {
      const response = await apiClient.post('/api/grading/code-judge/run-custom', {
        language,
        code,
        tests: validTests.map(test => ({
          id: test.id,
          input: test.input,
          expectedOutput: test.expectedOutput,
        })),
      });
      if (response.data?.code !== 0) {
        throw new Error(response.data?.message || '运行失败');
      }
      const nextResult = response.data.data as CustomJudgeResult;
      setResult(nextResult);
      if (nextResult.verdict === 'ACCEPTED') {
        const nextRuns = completedRuns + 1;
        patchDraft({
          completedRuns: nextRuns,
          lastPassedAt: new Date().toISOString(),
        });
        await markCourseProgressIfPossible();
      }
    } catch (error: any) {
      toast.error(error?.message || '运行失败');
    } finally {
      setRunning(false);
    }
  };

  const analyzeFailure = async () => {
    if (!result) {
      toast.warning('请先运行评测');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await apiClient.post('/api/grading/code-judge/analyze', {
        language,
        code,
        resultJson: JSON.stringify(result, null, 2),
      });
      if (response.data?.code !== 0) {
        throw new Error(response.data?.message || 'AI 分析失败');
      }
      setAnalysis(response.data.data?.analysis || 'AI 暂时没有返回分析。');
    } catch (error: any) {
      toast.error(error?.message || 'AI 分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[370px_minmax(0,1fr)] gap-5">
      <aside className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Local: custom</p>
              <h2 className="text-base font-black mt-1">CPH 评测器</h2>
            </div>
            <div className={`px-3 py-1 rounded-lg text-sm font-black ${
              result?.verdict === 'ACCEPTED' ? 'bg-emerald-600' : 'bg-slate-800'
            }`}>
              {visiblePassed}/{visibleTotal} 通过
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {(['cpp', 'python', 'java'] as Language[]).map(item => (
              <button
                key={item}
                onClick={() => switchLanguage(item)}
                className={`h-9 rounded-lg text-sm font-bold transition-colors ${
                  language === item ? 'bg-sky-500 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item === 'cpp' ? 'C++17' : item === 'python' ? 'Python' : 'Java 21'}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-slate-900 border border-slate-800 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">代码实操完成度</span>
              <span className="font-black text-sky-300">{completionRate}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-sky-500" style={{ width: `${completionRate}%` }} />
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              本地记录：累计 {completedRuns} 次全部通过{lastPassedAt ? `，最近 ${new Date(lastPassedAt).toLocaleString()}` : ''}
            </p>
          </div>
        </div>

        <div className="max-h-[620px] overflow-y-auto px-3 py-3 space-y-3">
          {tests.map((test, index) => {
            const testResult = passedMap.get(test.id);
            return (
              <section key={test.id} className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    onClick={() => updateTest(test.id, { collapsed: !test.collapsed })}
                    className="flex items-center gap-2 min-w-0 text-left"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-sky-300 transition-transform ${test.collapsed ? '-rotate-90' : ''}`}
                    />
                    <span className="font-black text-sky-300">{`TC ${index + 1}`}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {testResult && (
                      <span className={`text-xs font-black ${testResult.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {testResult.passed ? 'AC' : testResult.error ? 'RE' : 'WA'}
                      </span>
                    )}
                    <button
                      onClick={() => removeTest(test.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 flex items-center justify-center"
                      title="删除测试用例"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {!test.collapsed && (
                  <div className="px-3 pb-3 space-y-3">
                    <label className="block">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-300">输入</span>
                        <button onClick={() => copyText(test.input)} className="text-[11px] text-slate-500 hover:text-slate-200">
                          复制
                        </button>
                      </div>
                      <textarea
                        value={test.input}
                        onChange={event => updateTest(test.id, { input: event.target.value })}
                        spellCheck={false}
                        className="w-full min-h-20 resize-y rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono text-slate-100 outline-none focus:border-sky-500"
                      />
                    </label>

                    <label className="block">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-300">预期输出</span>
                        <button onClick={() => copyText(test.expectedOutput)} className="text-[11px] text-slate-500 hover:text-slate-200">
                          复制
                        </button>
                      </div>
                      <textarea
                        value={test.expectedOutput}
                        onChange={event => updateTest(test.id, { expectedOutput: event.target.value })}
                        spellCheck={false}
                        className="w-full min-h-16 resize-y rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono text-slate-100 outline-none focus:border-sky-500"
                      />
                    </label>

                    {testResult && (
                      <div className={`rounded-lg border px-3 py-2 ${
                        testResult.passed
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-red-500/30 bg-red-500/10'
                      }`}>
                        <div className="flex items-center gap-2 text-sm font-black">
                          {testResult.passed ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                          {testResult.passed ? '输出正确' : testResult.error ? '运行异常' : '输出不一致'}
                        </div>
                        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-black/25 p-2 text-xs text-slate-100">
                          {testResult.error ? testResult.error : `实际输出:\n${testResult.actualOutput || '(空输出)'}`}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={addTest}
            className="w-full h-10 rounded-lg bg-lime-600 hover:bg-lime-500 text-white text-sm font-black flex items-center justify-center gap-2"
          >
            <Plus size={17} />
            新建测试用例
          </button>
          <button
            onClick={runAll}
            disabled={running}
            className="w-full h-11 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-black flex items-center justify-center gap-2"
          >
            {running ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
            运行全部
          </button>
        </div>
      </aside>

      <main className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
          <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <Code2 size={17} className="text-sky-500" />
              {fileName[language]}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Save size={12} />
                {saved ? '已自动保存' : '保存中'}
              </span>
            </div>
            <button
              onClick={() => copyText(code)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Copy size={14} />
              复制代码
            </button>
          </div>
          <div className="bg-slate-950">
            <Editor
              height="620px"
              language={monacoLanguage[language]}
              value={code}
              theme="vs-dark"
              onChange={value => {
                patchDraft({ code: value || '' });
                setResult(null);
                setAnalysis('');
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 22,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
              }}
            />
          </div>
        </section>

        {result && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  result.verdict === 'ACCEPTED'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                    : 'bg-red-50 text-red-600 dark:bg-red-500/10'
                }`}>
                  {result.verdict === 'ACCEPTED' ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-slate-100">
                    {result.verdict === 'ACCEPTED' ? 'Accepted' : result.verdict === 'RUNTIME_ERROR' ? 'Runtime Error' : 'Wrong Answer'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {result.passed}/{result.total} 个测试用例通过
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={analyzeFailure}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-sm font-black"
                >
                  {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                  AI 分析
                </button>
                <div className="h-2 w-40 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${result.verdict === 'ACCEPTED' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                    style={{ width: `${result.total ? Math.round((result.passed / result.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              判定时会忽略首尾空白和每行末尾空格，保留中间换行差异。
            </p>
            {result.cases.some(test => !test.passed) && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {result.cases.filter(test => !test.passed).map(test => (
                  <div key={test.id} className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-3">
                    <p className="text-sm font-black text-red-700 dark:text-red-300">
                      TC {tests.findIndex(item => item.id === test.id) + 1 || ''} 未通过
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white dark:bg-slate-900 p-3 text-xs text-slate-700 dark:text-slate-200">
                      {test.error || `预期输出:\n${normalize(test.expectedOutput) || '(空输出)'}\n\n实际输出:\n${normalize(test.actualOutput) || '(空输出)'}`}
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {analysis && (
              <div className="mt-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/20 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-indigo-700 dark:text-indigo-300">
                  <Bot size={16} />
                  AI 调试建议
                </div>
                <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {analysis}
                </pre>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default CodeJudgePanel;
