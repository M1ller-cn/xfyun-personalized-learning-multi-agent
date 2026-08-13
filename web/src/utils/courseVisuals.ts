import type { CourseResponse } from '../api/generated/models';

type CourseVisual = {
  cover: string;
  accent: string;
  provider: string;
};

const VISUALS: Array<{ match: RegExp; visual: CourseVisual }> = [
  {
    match: /cs50|harvard|c language/i,
    visual: {
      cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
      accent: 'from-red-600/80 via-slate-950/25 to-violet-500/70',
      provider: 'Harvard',
    },
  },
  {
    match: /mit|6\.006|introduction to algorithms/i,
    visual: {
      cover: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
      accent: 'from-rose-500/80 via-slate-950/30 to-sky-500/70',
      provider: 'MIT OCW',
    },
  },
  {
    match: /61a|interpretation|python/i,
    visual: {
      cover: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1200&q=80',
      accent: 'from-blue-500/80 via-slate-950/25 to-emerald-400/70',
      provider: 'Berkeley',
    },
  },
  {
    match: /61b|data structure/i,
    visual: {
      cover: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1200&q=80',
      accent: 'from-indigo-500/80 via-slate-950/20 to-cyan-400/70',
      provider: 'Berkeley',
    },
  },
  {
    match: /nand2tetris|hardware|computer system/i,
    visual: {
      cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      accent: 'from-cyan-500/80 via-slate-950/30 to-amber-400/70',
      provider: 'Nand2Tetris',
    },
  },
];

const FALLBACK: CourseVisual = {
  cover: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
  accent: 'from-sky-500/80 via-slate-950/25 to-violet-500/70',
  provider: 'Open Course',
};

export function getCourseVisual(course?: Pick<CourseResponse, 'title' | 'subtitle' | 'description' | 'tags' | 'coverImage'> | null): CourseVisual {
  const haystack = [
    course?.title,
    course?.subtitle,
    course?.description,
    ...(course?.tags || []),
  ].filter(Boolean).join(' ');

  return VISUALS.find((item) => item.match.test(haystack))?.visual || {
    ...FALLBACK,
    cover: course?.coverImage || FALLBACK.cover,
  };
}

export function getPlayableEmbedUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : '';
    }

    if (host.endsWith('youtube.com')) {
      const playlist = parsed.searchParams.get('list');
      if (parsed.pathname === '/playlist' && playlist) {
        return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlist)}`;
      }
      const id = parsed.searchParams.get('v') || parsed.pathname.match(/\/shorts\/([^/]+)/)?.[1] || parsed.pathname.match(/\/embed\/([^/]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : '';
    }

    if (host.endsWith('bilibili.com')) {
      const bvid = parsed.pathname.match(/\/video\/([^/?]+)/)?.[1];
      return bvid ? `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&high_quality=1` : '';
    }
  } catch {
    return '';
  }
  return '';
}

export function isDirectMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /\.(mp4|webm|ogg|m3u8)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}
