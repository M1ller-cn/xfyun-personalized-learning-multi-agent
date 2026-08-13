import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, RefreshCw, ServerCrash, ShieldCheck } from 'lucide-react';
import { getToken } from '../../api';

type ServiceCheck = {
  key: string;
  name: string;
  status: 'READY' | 'DEGRADED' | 'NOT_READY';
  detail: string;
  required: boolean;
};

type Readiness = {
  status: string;
  ready: boolean;
  checks: ServiceCheck[];
  checkedAt: string;
};

const statusStyle = {
  READY: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300',
  DEGRADED: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300',
  NOT_READY: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300',
};

const statusLabel = { READY: '就绪', DEGRADED: '降级可用', NOT_READY: '未就绪' };

export const PlatformReadinessPage = () => {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/platform/readiness`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.code !== 0) throw new Error(payload.message || `HTTP ${response.status}`);
      setData(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法获取平台健康状态');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const overallReady = data?.ready;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-4">
          <span className={`grid h-12 w-12 place-items-center rounded-xl ${overallReady ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            {overallReady ? <ShieldCheck size={24} /> : <CircleAlert size={24} />}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-950 dark:text-white">平台就绪检查</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">用于赛前验收。不会调用 DeepSeek，也不会消耗模型额度。</p>
          </div>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />重新检查
        </button>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
          <ServerCrash size={22} /><p className="mt-3 font-semibold">检查失败</p><p className="mt-1 text-sm">{error}</p>
        </section>
      ) : loading && !data ? (
        <section className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">正在检查平台依赖…</section>
      ) : data && (
        <>
          <section className={`rounded-xl border p-5 ${overallReady ? statusStyle.READY : statusStyle.NOT_READY}`}>
            <div className="flex items-center gap-3"><Activity size={20} /><strong>{overallReady ? '核心演示链路已就绪' : '核心依赖未全部就绪'}</strong></div>
            <p className="mt-2 text-sm">检查时间：{new Date(data.checkedAt).toLocaleString('zh-CN')}。标记为“降级可用”的服务不会阻断课程学习主流程。</p>
          </section>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.checks.map((check) => {
              const Icon = check.status === 'READY' ? CheckCircle2 : CircleAlert;
              return <article key={check.key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-950 dark:text-white">{check.name}</h2><p className="mt-1 text-xs text-gray-400">{check.required ? '核心依赖' : '可降级能力'}</p></div><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[check.status]}`}><Icon size={13} />{statusLabel[check.status]}</span></div>
                <p className="mt-5 min-h-10 text-sm leading-6 text-gray-600 dark:text-gray-400">{check.detail}</p>
              </article>;
            })}
          </section>
        </>
      )}
    </div>
  );
};
