import { describe, expect, it } from 'vitest';
import { embedUrl, exKey } from './exVideos';

describe('vídeos de demonstração', () => {
  it('links → leitor dentro da app', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=rT7DgCr-3pg')).toBe('https://www.youtube-nocookie.com/embed/rT7DgCr-3pg?rel=0&playsinline=1&modestbranding=1');
    expect(embedUrl('https://youtu.be/rT7DgCr-3pg?t=3')).toContain('/embed/rT7DgCr-3pg');
    expect(embedUrl('https://youtube.com/shorts/abcdefghijk')).toContain('/embed/abcdefghijk');
    expect(embedUrl('https://www.instagram.com/reel/DdYy4DwxYOd/?igsh=x')).toBe('https://www.instagram.com/reel/DdYy4DwxYOd/embed');
    expect(embedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
    expect(embedUrl('https://drive.google.com/file/x')).toBeNull();
    expect(exKey('  Agachamento Búlgaro ')).toBe('agachamento bulgaro');
  });
});
