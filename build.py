#!/usr/bin/env python3
"""Baut Bebenbau als eine einzige index.html (plus Manifest, Service Worker, Icons).

  python3 build.py                 # Lastfälle aus /workspace/spiel/lastfaelle.json einbetten
  python3 build.py pfad/zu.json    # andere Lastfall-Datei
  python3 build.py --push          # zusätzlich committen und auf GitHub (Pages) veröffentlichen
"""
import hashlib, json, os, shutil, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
MODULES = ['core.js', 'levels.js', 'sim.js', 'statics.js', 'explain.js', 'render.js', 'audio.js', 'game.js']
args = [a for a in sys.argv[1:] if not a.startswith('--')]
push = '--push' in sys.argv
src_json = args[0] if args else '/workspace/spiel/lastfaelle.json'
local_json = os.path.join(ROOT, 'data', 'lastfaelle.json')
if not os.path.exists(src_json): src_json = local_json
with open(src_json, encoding='utf-8') as f: data = json.load(f)
os.makedirs(os.path.dirname(local_json), exist_ok=True)
if os.path.abspath(src_json) != os.path.abspath(local_json): shutil.copyfile(src_json, local_json)
# robust gegen fehlende Felder: nur Listen sicherstellen, Rest erledigt levels.js
data.setdefault('materialien', []); data.setdefault('levels', [])
js = '\n'.join(open(os.path.join(SRC, m), encoding='utf-8').read() for m in MODULES)
css = open(os.path.join(SRC, 'style.css'), encoding='utf-8').read()
html = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
data_js = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
html = html.replace('/*CSS*/', css).replace('/*DATA*/', data_js).replace('/*JS*/', js.replace('</script', '<\\/script'))
ver = hashlib.sha1(html.encode()).hexdigest()[:10]
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(html)
icons = os.path.join(ROOT, 'icons')
if not os.path.exists(os.path.join(icons, 'icon-512.png')):
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'icons.py'), icons], check=True)
manifest = {
    'name': 'Bebenbau', 'short_name': 'Bebenbau', 'description': 'Brücken und Türme bauen, die Lkw, Sturm und Erdbeben aushalten.',
    'lang': 'de', 'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#ffb703', 'theme_color': '#ffb703',
    'icons': [{'src': f'icons/icon-{s}.png', 'sizes': f'{s}x{s}', 'type': 'image/png', 'purpose': 'any maskable' if s == 512 else 'any'} for s in (192, 512)],
}
json.dump(manifest, open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sw = f"""// Bebenbau Service Worker – Version {ver}
const CACHE = 'bebenbau-{ver}';
const FILES = ['./', './index.html', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Seite: erst Netz (damit Updates sofort ankommen), sonst Cache. Rest: erst Cache.
  if (e.request.mode === 'navigate') {{
    e.respondWith(fetch(e.request).then(r => {{ const c = r.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return r; }}).catch(() => caches.match('./index.html')));
    return;
  }}
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
}});
"""
open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(sw)
print(f'index.html gebaut ({len(html)//1024} KB, Version {ver}, {len(data["levels"])} Level aus {src_json})')
if push:
    subprocess.run(['git', '-C', ROOT, 'add', '-A'], check=True)
    r = subprocess.run(['git', '-C', ROOT, 'commit', '-m', f'Build {ver}'])
    subprocess.run(['git', '-C', ROOT, 'push'], check=True)
