import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic2, RefreshCw, Volume2 } from 'lucide-react';
import './DigitalHumanCoach.css';

declare global {
  interface Window {
    XmovAvatar?: any;
    xmovAvatar?: any;
  }
}

type HumanStatus = 'idle' | 'loading' | 'ready' | 'speaking' | 'fallback' | 'error';

interface DigitalHumanCoachProps {
  lastReply?: string;
  isThinking?: boolean;
}

const XINGYUN_SDK_URL = 'https://media.xingyun3d.com/xingyun3d/general/litesdk/xmovAvatar@latest.js';

const stripMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, '这是一段代码示例。')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getConfig = () => ({
  appId: import.meta.env.VITE_XINGYUN_APP_ID as string | undefined,
  appSecret: import.meta.env.VITE_XINGYUN_APP_SECRET as string | undefined,
  driverId: import.meta.env.VITE_XINGYUN_DRIVER_ID as string | undefined,
  voiceId: import.meta.env.VITE_XINGYUN_VOICE_ID as string | undefined,
  embedUrl: import.meta.env.VITE_XINGYUN_EMBED_URL as string | undefined,
});

const getGatewayServer = () => {
  const gateway = new URL('https://nebula-agent.xingyun3d.com/user/v1/ttsa/session');
  gateway.searchParams.set('data_source', '2');
  gateway.searchParams.set('custom_id', 'xingtu-classroom');
  return gateway.toString();
};

const loadScriptOnce = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existed = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existed) {
      if (existed.dataset.loaded === 'true') resolve();
      else existed.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.loaded = 'false';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('数字人 SDK 加载失败'));
    document.head.appendChild(script);
  });

interface AvatarLifecycleHandlers {
  onReady: () => void;
  onProgress: (progress: number) => void;
  onFailure: (message: string) => void;
  onVoiceStateChange: (isSpeaking: boolean) => void;
}

const createAvatarInstance = async (
  container: HTMLDivElement,
  containerId: string,
  config: ReturnType<typeof getConfig>,
  handlers: AvatarLifecycleHandlers,
) => {
  const initOptions = {
    onDownloadProgress: (progress: number) => {
      handlers.onProgress(progress);
      if (progress >= 100) handlers.onReady();
    },
    onError: (error: unknown) => {
      console.warn('[Xingyun avatar] init error', error);
      handlers.onFailure('真人数字人资源加载失败');
    },
  };
  const options = {
    containerId: `#${containerId}`,
    container,
    appId: config.appId,
    appSecret: config.appSecret,
    gatewayServer: getGatewayServer(),
    headers: { Authorization: '888jn' },
    renderMode: 'cloud',
    config: config.voiceId
      ? { tts_vcn_id: config.voiceId, language: 'zh_cn', volume: 100, tts_speed: 1 }
      : undefined,
    hardwareAcceleration: 'prefer-hardware',
    enableLogger: true,
    onMessage: (message: any) => {
      console.log('[Xingyun avatar] message', message);
      if (message?.message) handlers.onFailure(String(message.message));
    },
    onStateChange: (state: unknown) => console.log('[Xingyun avatar] state', state),
    onRenderChange: (state: unknown) => {
      console.log('[Xingyun avatar] render', state);
      if (state === 'rendering') handlers.onReady();
    },
    onVoiceStateChange: (state: unknown) => {
      console.log('[Xingyun avatar] voice', state);
      handlers.onVoiceStateChange(state === 'start');
    },
  };

  if (window.XmovAvatar) {
    const AvatarCtor = window.XmovAvatar.default || window.XmovAvatar;
    if (typeof AvatarCtor === 'function') {
      const instance = new AvatarCtor(options);
      if (typeof instance.init === 'function') await instance.init(initOptions);
      if (typeof instance.start === 'function') await instance.start();
      return instance;
    }
    if (typeof window.XmovAvatar.create === 'function') {
      const instance = await window.XmovAvatar.create(options);
      if (typeof instance?.init === 'function') await instance.init(initOptions);
      if (typeof instance?.start === 'function') await instance.start();
      return instance;
    }
  }

  if (window.xmovAvatar?.create) {
    const instance = await window.xmovAvatar.create(options);
    if (typeof instance?.init === 'function') await instance.init(initOptions);
    if (typeof instance?.start === 'function') await instance.start();
    return instance;
  }

  if (window.xmovAvatar) {
    const AvatarCtor = window.xmovAvatar.default || window.xmovAvatar;
    if (typeof AvatarCtor === 'function') {
      const instance = new AvatarCtor(options);
      if (typeof instance.init === 'function') await instance.init(initOptions);
      if (typeof instance.start === 'function') await instance.start();
      return instance;
    }
  }

  throw new Error('未识别到魔珐星云数字人 SDK 实例入口');
};

const callSpeak = async (avatar: any, text: string) => {
  const plainText = stripMarkdown(text);
  if (typeof avatar?.speak === 'function') {
    await avatar.speak(plainText, true, true);
    return;
  }
  if (typeof avatar?.playText === 'function') {
    await avatar.playText(plainText);
    return;
  }
  if (typeof avatar?.sendText === 'function') {
    await avatar.sendText(plainText);
    return;
  }
  throw new Error('当前数字人实例没有可用的播报方法');
};

const DigitalHumanCoach: React.FC<DigitalHumanCoachProps> = ({ lastReply, isThinking }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<any>(null);
  const spokenRef = useRef('');
  const initVersionRef = useRef(0);
  const containerIdRef = useRef(`xingyun-avatar-${Math.random().toString(36).slice(2)}`);
  const [status, setStatus] = useState<HumanStatus>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const config = useMemo(getConfig, []);
  const hasCloudConfig = Boolean(config.embedUrl || (config.appId && config.appSecret));

  const disposeAvatar = () => {
    try {
      avatarRef.current?.destroy?.();
      avatarRef.current?.stop?.();
    } catch {
      // External SDK cleanup can reject while it is connecting.
    }
    avatarRef.current = null;
    if (containerRef.current) containerRef.current.replaceChildren();
  };

  const initAvatar = async () => {
    if (!containerRef.current) return;
    const initVersion = ++initVersionRef.current;
    disposeAvatar();
    if (config.embedUrl) {
      setStatus('ready');
      setError('');
      return;
    }
    if (!hasCloudConfig) {
      setStatus('fallback');
      setError('未配置魔珐星云 App ID / Secret，当前显示真人助教演示位');
      return;
    }

    setStatus('loading');
    setError('');
    setProgress(0);
    try {
      await loadScriptOnce(XINGYUN_SDK_URL);
      const instance = await createAvatarInstance(containerRef.current, containerIdRef.current, config, {
        onProgress: setProgress,
        onReady: () => {
          setError('');
          setStatus('ready');
        },
        onFailure: (message) => {
          setError(message);
          setStatus('fallback');
        },
        onVoiceStateChange: (isSpeaking) => setStatus(isSpeaking ? 'speaking' : 'ready'),
      });
      if (initVersion !== initVersionRef.current) {
        instance?.destroy?.();
        instance?.stop?.();
        return;
      }
      avatarRef.current = instance;
    } catch (err) {
      if (initVersion !== initVersionRef.current) return;
      setStatus('fallback');
      setError(err instanceof Error ? err.message : '数字人初始化失败，已切换演示位');
    }
  };

  useEffect(() => {
    initAvatar();
    return () => {
      initVersionRef.current += 1;
      disposeAvatar();
    };
  }, []);

  useEffect(() => {
    const reply = lastReply?.trim();
    if (!reply || reply === spokenRef.current || status !== 'ready') return;
    spokenRef.current = reply;
    setStatus('speaking');
    callSpeak(avatarRef.current, reply)
      .catch((err) => {
        setStatus('fallback');
        setError(err instanceof Error ? err.message : '数字人播报失败');
      });
  }, [lastReply, status, config.voiceId]);

  const statusText = {
    idle: '待命中',
    loading: '正在连接真人数字人',
    ready: isThinking ? '等待 AI 回复' : '真人助教在线',
    speaking: '正在同步讲解',
    fallback: '真人演示位',
    error: '连接异常',
  }[status];

  return (
    <aside className="digital-human-coach" aria-label="真人数字人助教">
      <div className="digital-human-card">
        <div className="digital-human-topbar">
          <div>
            <p className="digital-human-eyebrow">真人数字人助教</p>
            <h2>星图讲师</h2>
          </div>
          <button className="digital-human-icon-button" onClick={initAvatar} title="重新连接数字人">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="digital-human-stage">
          <div className="digital-human-sdk-stage">
            <div id={containerIdRef.current} ref={containerRef} className="digital-human-sdk-mount" />
          </div>
          {config.embedUrl && (
            <iframe
              className="digital-human-embed"
              src={config.embedUrl}
              title="魔珐星云真人数字人"
              allow="microphone; camera; autoplay; fullscreen"
            />
          )}
          {status !== 'ready' && status !== 'speaking' && (
            <div className="digital-human-fallback">
              <video
                className="digital-human-video"
                src="https://assets.mixkit.co/videos/preview/mixkit-young-woman-explaining-something-in-a-video-call-47851-large.mp4"
                autoPlay
                muted
                loop
                playsInline
              />
              <div className="digital-human-vignette" />
              {status === 'loading' && (
                <div className="digital-human-loading">
                  <span>正在加载星云真人数字人</span>
                  <strong>{progress}%</strong>
                </div>
              )}
            </div>
          )}
          <div className={`digital-human-pulse ${status === 'speaking' ? 'is-speaking' : ''}`}>
            <Mic2 size={16} />
          </div>
        </div>

        <div className="digital-human-meta">
          <span className={`digital-human-dot status-${status}`} />
          <span>{statusText}</span>
          {isThinking && <span className="digital-human-thinking">AI 正在组织回答</span>}
        </div>

        <div className="digital-human-script">
          <Volume2 size={15} />
          <p>{lastReply ? stripMarkdown(lastReply).slice(0, 92) : '我会在 AI 回复后同步讲解课程重点、解题思路和下一步学习建议。'}</p>
        </div>

        {error && <p className="digital-human-error">{error}</p>}
      </div>
    </aside>
  );
};

export default DigitalHumanCoach;
