"""B.Y.D Cinema subtitle factory.

Runs on GitHub Actions. For every request in subs/requests/<slug>.json that has
no subs/<slug>.ru.vtt yet, it downloads the film's smallest video copy,
recognizes the Russian speech (faster-whisper) and writes:
  subs/<slug>.ru.vtt      Russian subtitles with timings
  subs/catalog.json       entry so cinema.html serves the film as "prepared"
  subs/status/<slug>.json progress / error for the site and for debugging

Request file example:
  {"link": "https://commons.wikimedia.org/wiki/File:...webm", "title": "Кто крайний?"}
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SUBS = ROOT / 'subs'
UA = 'BYD-Cinema-Subtitles/1.0 (https://gleb1979-ops.github.io/watch/cinema.html; GitHub: gleb1979-ops/watch)'
MODEL = os.environ.get('WHISPER_MODEL', 'large-v3-turbo')
LICENSE_INFO = {}

JUNK = [re.compile(p, re.I) for p in [
    r'субтитр\S*\s+(сделал|делал|создал|создавал|подготовил|редактировал)', r'dimatorzok',
    r'редактор субтитров', r'корректор\s+[а-яё]', r'^продолжение следует', r'^спасибо за просмотр',
    r'подписывайтесь на', r'amara\.org', r'^конец\.?$', r'^девушки отдыхают', r'^[\s.…,!?\-–—♪*]*$']]


def get(url, timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout)


def film_key_and_source(link):
    """Return (key, download_url, title_guess). key must match filmKey() in cinema.html."""
    u = urllib.parse.urlparse(link.strip())
    host = re.sub(r'^(www|m)\.', '', u.netloc.lower())
    path = urllib.parse.unquote(u.path)
    if host == 'commons.wikimedia.org':
        title = urllib.parse.parse_qs(u.query).get('title', [None])[0] or path.split('/wiki/', 1)[-1]
        name = re.sub(r'^(File|Файл):', '', title, flags=re.I).replace('_', ' ').strip()
        api = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'query', 'prop': 'videoinfo', 'viprop': 'url|derivatives|size|extmetadata', 'titles': 'File:' + name, 'format': 'json'})
        data = json.load(get(api))
        page = next(iter(data['query']['pages'].values()))
        info = page['videoinfo'][0]
        ders = sorted([d for d in info.get('derivatives', []) if d.get('src')], key=lambda d: d.get('width') or 0)
        meta = info.get('extmetadata') or {}
        clean = lambda k: re.sub(r'<[^>]+>', '', (meta.get(k) or {}).get('value', '')).strip()
        LICENSE_INFO.update({'license': clean('LicenseShortName'), 'terms': clean('UsageTerms'),
                             'author': clean('Artist')[:200], 'minutes': round((info.get('duration') or 0) / 60)})
        # mid-size copy: the smallest transcodes compress the soundtrack too hard for old films
        mid = min(ders, key=lambda d: abs((d.get('width') or 0) - 640)) if ders else None
        return 'commons:' + name, (mid['src'] if mid else info['url']), re.sub(r'\.[^.]+$', '', name)
    if host == 'archive.org':
        m = re.match(r'^/(details|download|embed)/([^/?#]+)', u.path)
        ident = urllib.parse.unquote(m.group(2))
        meta = json.load(get('https://archive.org/metadata/' + urllib.parse.quote(ident)))
        files = [f for f in meta.get('files', []) if re.search(r'\.(mp4|m4v|webm|ogv)$', f.get('name', ''), re.I)]
        files.sort(key=lambda f: int(f.get('size') or 0))
        f = files[0]
        url = 'https://archive.org/download/' + urllib.parse.quote(ident) + '/' + '/'.join(urllib.parse.quote(p) for p in f['name'].split('/'))
        title = meta.get('metadata', {}).get('title') or ident
        return 'archive:' + ident, url, title if isinstance(title, str) else title[0]
    return 'url:' + link.strip(), link.strip(), os.path.splitext(os.path.basename(path))[0]


def fmt(t):
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d}.{ms:03d}'


def words_to_cues(words, max_chars=80, max_dur=6.5, gap=0.8):
    """Group recognized words into readable subtitle cues."""
    cues, cur = [], []

    def flush():
        if not cur:
            return
        text = re.sub(r'\s+', ' ', ''.join(w['word'] for w in cur)).strip()
        if text and not any(r.search(text) for r in JUNK):
            cues.append({'start': cur[0]['start'], 'end': cur[-1]['end'], 'text': text})
        cur.clear()

    for w in words:
        if cur:
            text_len = len(''.join(x['word'] for x in cur).strip())
            ends_sentence = re.search(r'[.!?…]["»”]?$', cur[-1]['word'].strip() or '')
            if (w['start'] - cur[-1]['end'] > gap
                    or text_len + len(w['word']) > max_chars
                    or w['end'] - cur[0]['start'] > max_dur
                    or (ends_sentence and text_len >= 18)):
                flush()
        cur.append(w)
    flush()
    # timing polish: readable minimum, no overlaps
    for i, c in enumerate(cues):
        nxt = cues[i + 1]['start'] if i + 1 < len(cues) else None
        c['end'] = max(c['end'] + 0.25, c['start'] + min(1.5, max(0.8, len(c['text']) / 17)))
        if nxt is not None and c['end'] > nxt - 0.04:
            c['end'] = max(c['start'] + 0.3, nxt - 0.04)
    # drop whisper loops (same line repeated back to back)
    out = []
    for c in cues:
        if out and out[-1]['text'].lower() == c['text'].lower() and c['start'] - out[-1]['end'] < 3:
            out[-1]['end'] = c['end']
            continue
        out.append(c)
    return out


def to_vtt(cues):
    lines = ['WEBVTT', '']
    for i, c in enumerate(cues, 1):
        lines += [str(i), f"{fmt(c['start'])} --> {fmt(c['end'])}", c['text'].replace('-->', '→'), '']
    return '\n'.join(lines)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def process(slug, req):
    status = SUBS / 'status' / f'{slug}.json'
    LICENSE_INFO.clear()
    write_json(status, {'state': 'working', 'started': int(time.time())})
    key, src, title_guess = film_key_and_source(req['link'])
    print(f'[{slug}] key={key}\n[{slug}] downloading {src}', flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        film = pathlib.Path(tmp) / 'film'
        with get(src, timeout=600) as r, open(film, 'wb') as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        print(f'[{slug}] downloaded {film.stat().st_size // 1048576} MB', flush=True)
        wav = pathlib.Path(tmp) / 'audio.wav'
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', str(film), '-vn', '-af', 'highpass=f=80,loudnorm', '-ac', '1', '-ar', '16000', str(wav)], check=True)
        from faster_whisper import WhisperModel
        model = WhisperModel(MODEL, device='cpu', compute_type='int8')
        # gentle voice detection: old films mix speech with music and noise
        use_vad = req.get('vad', False)  # voice detection drops speech under music; off unless a film asks for it
        segments, info = model.transcribe(str(wav), language='ru', beam_size=5, vad_filter=use_vad,
                                          vad_parameters={'threshold': 0.2, 'min_speech_duration_ms': 120,
                                                          'min_silence_duration_ms': 600, 'speech_pad_ms': 500},
                                          word_timestamps=True, condition_on_previous_text=False,
                                          no_speech_threshold=0.7, log_prob_threshold=-1.2)
        words = []
        for seg in segments:
            for w in seg.words or []:
                words.append({'word': w.word, 'start': w.start, 'end': w.end})
            print(f'[{slug}] {fmt(seg.end)} / {fmt(info.duration)}  {seg.text.strip()[:70]}', flush=True)
    cues = words_to_cues(words)
    if not cues:
        raise RuntimeError('no speech recognized')
    (SUBS / f'{slug}.ru.vtt').write_text(to_vtt(cues), encoding='utf-8')
    cat_path = SUBS / 'catalog.json'
    catalog = json.loads(cat_path.read_text(encoding='utf-8')) if cat_path.exists() else []
    old = next((e for e in catalog if e['key'] == key), None)
    entry = {'key': key, 'title': req.get('title') or title_guess, 'link': req['link'],
             'ru': f'subs/{slug}.ru.vtt', 'version': (old or {}).get('version', 0) + 1}
    for extra in ('year', 'minutes', 'license'):
        if req.get(extra) or LICENSE_INFO.get(extra):
            entry[extra] = req.get(extra) or LICENSE_INFO.get(extra)
    catalog = [e for e in catalog if e['key'] != key] + [entry]
    write_json(cat_path, catalog)
    write_json(status, {'state': 'done', 'cues': len(cues), 'model': MODEL, 'source_license': LICENSE_INFO, 'finished': int(time.time())})
    print(f'[{slug}] done: {len(cues)} cues', flush=True)


def main():
    reqs = sorted((SUBS / 'requests').glob('*.json'))
    failed = 0
    for p in reqs:
        slug = p.stem
        if (SUBS / f'{slug}.ru.vtt').exists():
            continue
        try:
            process(slug, json.loads(p.read_text(encoding='utf-8')))
        except Exception as e:  # keep going with other films, record the error
            failed += 1
            print(f'[{slug}] FAILED: {e}', file=sys.stderr, flush=True)
            write_json(SUBS / 'status' / f'{slug}.json', {'state': 'error', 'error': str(e)[:500], 'finished': int(time.time())})
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
