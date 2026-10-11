"""Headless-Chrome-Test Lernen (390x844 @2x): alle 10 Lektionen durchspielen, Prüffälle in der Oberfläche, Screenshots."""
import sys
from playwright.sync_api import sync_playwright
OUT = '/workspace/spiel/test'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/index.html'
errors = []; rep = []
def shot(pg, n): pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/lernen_{n}.png', full_page=False)
def setv(pg, id, v): pg.evaluate("([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'))}", [id, v])
def dragto(pg, fx, fz, O, K):
    box = pg.eval_on_selector('#tsvg', 'e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width]}')
    s = box[2] / 340
    x, y = box[0] + (O[0] + fx * K) * s, box[1] + (O[1] - fz * K) * s
    pg.mouse.move(box[0] + O[0] * s, box[1] + O[1] * s); pg.mouse.down(); pg.mouse.move(x, y, steps=6); pg.mouse.up()
def text(pg, sel): return pg.eval_on_selector(sel, 'e=>e.innerText||e.textContent')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(800)
    shot(pg, '00_start')
    pg.click('#learn'); shot(pg, '01_uebersicht')
    def start(id): pg.click(f'.les[data-id="{id}"]'); pg.wait_for_timeout(100)
    def check(): pg.click('#lcheck'); pg.wait_for_timeout(200)
    def ok(): return pg.query_selector('.okh') is not None
    # 1.1
    start('1.1'); shot(pg, '1_1_intro'); pg.click('#lgo')
    check(); rep.append(('1.1 falsch abgelehnt', not ok() and 'bewegt' in text(pg, '#lmsg')))
    dragto(pg, 3, 2, (170, 115), 22); rep.append(('1.1 Status', text(pg, '#lstat'))); shot(pg, '1_1_aufgabe'); check(); rep.append(('1.1 gelöst per Ziehen', ok())); shot(pg, '1_1_erklaerung'); pg.click('#lnext')
    # 1.2
    shot(pg, '1_2_intro'); pg.click('#lgo'); dragto(pg, -3, -4, (170, 125), 18); rep.append(('1.2 Status', text(pg, '#lstat'))); shot(pg, '1_2_aufgabe'); check(); rep.append(('1.2 gelöst (Seil 5 kN)', ok())); rep.append(('1.2 Formel R = 5 kN', '= 5 kN' in text(pg, '.fbox'))); shot(pg, '1_2_erklaerung'); pg.click('#lnext')
    # 1.3
    pg.click('#lgo'); check(); rep.append(('1.3 Schätzung 2/6 abgelehnt', not ok())); setv(pg, 's_d', 5); setv(pg, 's_n', 8.5); shot(pg, '1_3_aufgabe'); check(); rep.append(('1.3 gelöst', ok())); rep.append(('1.3 Formel', text(pg, '.fbox'))); shot(pg, '1_3_erklaerung'); pg.click('#lnext')
    # 1.4 Wippe 2 m / 3 m
    pg.click('#lgo'); shot(pg, '1_4_kippt'); setv(pg, 's_a1', 2); setv(pg, 's_a2', 3); rep.append(('1.4 Status 2 m/3 m', text(pg, '#lstat'))); rep.append(('1.4 Bildtext 0,6 kNm', text(pg, '#lpic').count('0,6 kNm'))); shot(pg, '1_4_waagerecht'); check(); rep.append(('1.4 gelöst', ok())); shot(pg, '1_4_erklaerung'); pg.click('#lnext')
    # 1.5
    pg.click('#lgo'); setv(pg, 's_H', -2); setv(pg, 's_S', 9); check(); rep.append(('1.5 Misserfolgsmeldung', text(pg, '#lmsg'))); shot(pg, '1_5_ampeln_rot')
    setv(pg, 's_xs', 2); shot(pg, '1_5_ampeln_gruen'); check(); rep.append(('1.5 gelöst', ok())); rep.append(('1.5 Vereinfachungshinweis', 'Festigkeitslehre' in text(pg, '#lernen'))); shot(pg, '1_5_erklaerung_hinweis'); pg.click('#lnext')
    shot(pg, '02_uebersicht_kap1_fertig')
    # 2.1
    start('2.1'); shot(pg, '2_1_intro'); pg.click('#lgo')
    pg.click('button.slot[data-b="0"][data-s="0"]'); pg.click('button.slot[data-b="0"][data-s="0"]'); pg.click('button.slot[data-b="0"][data-s="1"]'); pg.click('button.slot[data-b="0"][data-s="1"]')
    check(); rep.append(('2.1 zwei Festlager -> Zwangskräfte', text(pg, '#lmsg')))
    for _ in range(3): pg.click('button.slot[data-b="0"][data-s="1"]')   # fest -> ein -> kein -> los
    for _ in range(3): pg.click('button.slot[data-b="1"][data-s="0"]')   # Einspannung
    pg.click('button.slot[data-b="2"][data-s="1"]')                    # Loslager
    shot(pg, '2_1_aufgabe'); check(); rep.append(('2.1 gelöst', ok())); pg.click('#lnext')
    # 2.2
    pg.click('#lgo'); rep.append(('2.2 los+los', text(pg, '#lstat'))); shot(pg, '2_2_beweglich')
    pg.click('button.slot[data-s="0"]'); shot(pg, '2_2_bestimmt'); pg.click('button.slot[data-s="2"]'); rep.append(('2.2 fest+fest', text(pg, '#tsvg svg'))); shot(pg, '2_2_unbestimmt')
    for _ in range(3): pg.click('button.slot[data-s="2"]')
    pg.click('button.slot[data-s="0"]'); pg.click('button.slot[data-s="0"]'); pg.click('button.slot[data-s="0"]'); pg.click('button.slot[data-s="1"]')  # los los los
    rep.append(('2.2 drei Loslager', text(pg, '#tsvg svg'))); check(); rep.append(('2.2 gelöst', ok())); pg.click('#lnext')
    # 2.3
    pg.click('#lgo'); setv(pg, 's_A', 20); setv(pg, 's_B', 10); shot(pg, '2_3_schaetzen'); pg.click('#lcheck'); pg.wait_for_timeout(700); shot(pg, '2_3_last_faehrt'); pg.wait_for_timeout(2500)
    rep.append(('2.3 gelöst', ok())); rep.append(('2.3 Text', text(pg, '.et'))); shot(pg, '2_3_erklaerung'); pg.click('#lnext')
    # 2.4
    pg.click('#lgo'); setv(pg, 's_M', 30); check(); rep.append(('2.4 gelöst', ok())); setv(pg, 's_L', 1.5); rep.append(('2.4 L=1,5', text(pg, '#lstat'))); setv(pg, 's_L', 3); rep.append(('2.4 L=3', text(pg, '#lstat'))); shot(pg, '2_4_erklaerung'); pg.click('#lnext')
    # 2.5
    pg.click('#lgo'); setv(pg, 's_A', 10); pg.click('#lcheck'); pg.wait_for_timeout(600); shot(pg, '2_5_schnee_faellt'); pg.wait_for_timeout(1500)
    rep.append(('2.5 gelöst', ok())); rep.append(('2.5 Formel', text(pg, '.fbox'))); shot(pg, '2_5_erklaerung_hinweis'); pg.click('#lnext')
    shot(pg, '03_uebersicht_fertig')
    rep.append(('localStorage', pg.evaluate("localStorage.getItem('bebenbau.lernen.v1')")))
    pg.reload(); pg.wait_for_timeout(500); pg.click('#learn'); rep.append(('nach Reload 5/5 + 5/5', text(pg, '#lernen').count('5/5')))
    pg.click('#lnback'); rep.append(('zurück zum Start', pg.is_visible('#play'))); pg.click('#play'); pg.wait_for_timeout(300); rep.append(('Spiel weiter erreichbar', pg.is_visible('#levelgrid')))
    b.close()
for k, v in rep: print(f'{k}: {v}')
print('JS-Fehler:', errors or 'keine')
