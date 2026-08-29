import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, RefreshCw, Volume2 } from 'lucide-react';

type AvatarInstance = {
  init: (options: Record<string, unknown>) => Promise<void>;
  speak: (text: string, isStart?: boolean, isEnd?: boolean) => Promise<void> | void;
  destroy?: () => void;
};

declare global {
  interface Window {
    XmovAvatar?: new (options: Record<string, unknown>) => AvatarInstance;
  }
}

const sdkUrl = 'https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar@latest.js';

type Props = {
  replyText?: string;
};

function loadSdk() {
  if (window.XmovAvatar) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-xingyun-avatar]');
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('数字人 SDK 加载失败')), { once: true });
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sdkUrl;
    script.async = true;
    script.dataset.xingyunAvatar = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('数字人 SDK 加载失败'));
    document.head.appendChild(script);
  });
}

export default function DigitalHumanPanel({ replyText }: Props) {
  const avatarRef = useRef<AvatarInstance | null>(null);
  const lastSpokenRef = useRef('');
  const [appId] = useState(() => String(import.meta.env.VITE_XINGYUN_APP_ID || ''));
  const [appSecret, setAppSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('填写凭证后连接真人讲师');

  const connect = async () => {
    if (!appId.trim() || !appSecret.trim()) {
      setStatus('error');
      setMessage('请填写 App ID 与 App Secret');
      return;
    }

    setStatus('loading');
    setMessage('正在连接真人讲师...');
    try {
      await loadSdk();
      if (!window.XmovAvatar) throw new Error('数字人 SDK 未就绪');
      avatarRef.current?.destroy?.();
      const avatar = new window.XmovAvatar({
        containerId: '#xingyun-digital-human-stage',
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        gatewayServer: 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session',
        hardwareAcceleration: 'prefer-hardware',
        onMessage: (event: unknown) => console.debug('数字人 SDK', event),
      });
      avatarRef.current = avatar;
      await avatar.init({
        initModel: 'normal',
        onDownloadProgress: () => undefined,
      });
      setStatus('ready');
      setMessage('真人助教在线');
    } catch (error) {
      console.error('数字人初始化失败', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '数字人初始化失败');
    }
  };

  useEffect(() => () => avatarRef.current?.destroy?.(), []);

  useEffect(() => {
    const text = replyText?.trim();
    if (!text || status !== 'ready' || text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;
    avatarRef.current?.speak(text, true, true);
  }, [replyText, status]);

  const isConnected = status === 'ready';

  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-blue-100 bg-white p-4 xl:block dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-blue-500">真人数字人助教</p>
          <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">星图讲师</h3>
        </div>
        <button type="button" onClick={connect} disabled={!appId || !appSecret || status === 'loading'} className="rounded-lg border border-blue-200 p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40" title="重新连接">
          {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      <div id="xingyun-digital-human-stage" className="relative h-[510px] overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,#dbeafe,#eff6ff_46%,#0f172a)] p-5">
            <div className="w-full rounded-xl bg-white/95 p-4 shadow-lg">
              <p className="mb-3 text-sm font-bold text-slate-800">连接真人讲师</p>
              <div className="relative">
                <input value={appSecret} onChange={(event) => setAppSecret(event.target.value)} type={showSecret ? 'text' : 'password'} placeholder="请输入数字人 App Secret" className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-9 text-xs outline-none focus:border-blue-400" />
                <button type="button" onClick={() => setShowSecret((value) => !value)} className="absolute right-2 top-2 text-slate-400" title="显示或隐藏密钥">
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button type="button" onClick={connect} disabled={status === 'loading'} className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {status === 'loading' ? '正在连接...' : '连接真人讲师'}
              </button>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">凭证只保留在当前浏览器内存，刷新页面后自动清除。</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm font-medium">
        {status === 'loading' ? <Loader2 size={15} className="animate-spin text-blue-500" /> : <span className={`h-2.5 w-2.5 rounded-full ${status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-amber-500' : 'bg-slate-300'}`} />}
        <span className="text-slate-600 dark:text-slate-300">{message}</span>
      </div>
      <div className="mt-3 flex gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <Volume2 size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <span>AI 回复完成后，讲师会同步进行语音讲解与口型驱动。</span>
      </div>
    </aside>
  );
}
