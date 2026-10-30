"""Gera os arquivos finais do protótipo em dist/ (só usa a biblioteca padrão do Python).

    python3 build.py

Saídas:
  dist/Cidade-Nobre-Prototipo-SMG.html  HTML completo e autônomo (fontes, imagens e código embutidos).
                                        É o arquivo para enviar ao cliente ou hospedar.
  dist/cidade-nobre-artifact.html       Mesmo conteúdo sem <html>/<head>/<body>, no formato de Artifact do Claude.
"""
import base64, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC, ASSETS, DIST = ROOT / 'src', ROOT / 'assets', ROOT / 'dist'
DIST.mkdir(exist_ok=True)

# ordem importa: core (dados/regras) -> icons -> client -> admin -> main (render + eventos)
JS_FILES = ['core.js', 'icons.js', 'client.js', 'admin.js', 'main.js']
# chave = nome usado no código (window.ASSETS.<chave>)
IMAGES = ['crest.webp', 'lockup.webp', 'crown_wm.webp', 'hero_home.jpg', 'hero_servicos.jpg', 'hero_agendar.jpg',
          'cat_cabelo.jpg', 'cat_barba.jpg', 'cat_cuidados.jpg', 'svc_corte.jpg', 'svc_barba.jpg', 'svc_penteado.jpg',
          'svc_manicure.jpg', 'svc_nasal.jpg', 'svc_sobrancelha.jpg']
MIME = {'.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png'}

b64 = lambda p: base64.b64encode(p.read_bytes()).decode()
uri = lambda p: f'data:{MIME[p.suffix]};base64,{b64(p)}'

assets = {pathlib.Path(n).stem: uri(ASSETS / n) for n in IMAGES}
js = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in JS_FILES)
frag = (SRC / 'index.tpl.html').read_text(encoding='utf-8')
frag = frag.replace('__NEWSREADER__', b64(ASSETS / 'fonts/newsreader.woff2'))
frag = frag.replace('__FIGTREE__', b64(ASSETS / 'fonts/figtree.woff2'))
frag = frag.replace('__CSS__', (SRC / 'styles.css').read_text(encoding='utf-8'))
frag = frag.replace('__ASSETS__', json.dumps(assets))
frag = frag.replace('__JS__', js)

# 1) formato Artifact do Claude (o Claude envolve com <head>/<body> ao publicar)
(DIST / 'cidade-nobre-artifact.html').write_text(frag, encoding='utf-8')

# 2) HTML autônomo
title_tag = frag[frag.index('<title>'):frag.index('</title>') + len('</title>')]
body = frag.replace(title_tag, '', 1)
page = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Cidade Nobre — Protótipo SMG</title>
<meta name="description" content="Protótipo demonstrativo do ecossistema digital da Cidade Nobre — Barbearia Premium, desenvolvido pela SMG. Dados fictícios.">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/png" href="{uri(ASSETS / 'fav.png')}">
<link rel="apple-touch-icon" href="{uri(ASSETS / 'touch.png')}">
<style>:root{{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
<noscript><div style="padding:24px;font-family:system-ui,sans-serif;color:#f2e9db;background:#0b0b0c;min-height:100vh">Este protótipo precisa de JavaScript. Abra o arquivo no Chrome, Safari, Edge ou Firefox.</div></noscript>
{body}
</body>
</html>
'''
out = DIST / 'Cidade-Nobre-Prototipo-SMG.html'
out.write_text(page, encoding='utf-8')
print(f'{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB')
print(f'dist/cidade-nobre-artifact.html  {(DIST / "cidade-nobre-artifact.html").stat().st_size // 1024} KB')
