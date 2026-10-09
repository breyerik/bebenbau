"""Headless-Chrome-Test (iPhone-Größe 390x844 @2x): Bildschirme, Bedienung, Simulation, Screenshots."""
import json, sys, time
from playwright.sync_api import sync_playwright
OUT = '/workspace/spiel/test'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/index.html'
sol = json.load(open('/workspace/spiel-repo/tools/solutions.json'))
errors = []; report = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{OUT}/01_start.png')
    pg.click('#play'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/02_levelauswahl.png')
    # Level 1 öffnen, Intro zeigen
    pg.click('#levelgrid .lvl >> nth=0'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{OUT}/03_level1_intro.png')
    pg.click('#go'); pg.wait_for_timeout(300)
    # echte Ziehgeste (Maus-Pointer) vom linken Anker zu Rasterpunkt (1,0) und weiter (1,0)->(2,1)
    def scr(x, y): return pg.evaluate(f'[__bb.S.cam.X({x}), __bb.S.cam.Y({y})]')
    def drag(a, c):
        pa, pc = scr(*a), scr(*c)
        pg.mouse.move(*pa); pg.mouse.down(); pg.mouse.move((pa[0] + pc[0]) / 2, (pa[1] + pc[1]) / 2, steps=4); pg.mouse.move(*pc, steps=4); pg.mouse.up()
    drag((0, 0), (1, 0)); drag((1, 0), (2, -1)); drag((0, 0), (2, -1))
    report['drag_members'] = pg.evaluate('__bb.S.design.members.length')
    pg.click('#bundo'); report['after_undo'] = pg.evaluate('__bb.S.design.members.length')
    # Vorschau beim Ziehen festhalten (Screenshot im Baumodus)
    pg.evaluate('__bb.setDesign(%s)' % json.dumps(sol['1']['d']))
    pa, pc = scr(3, -1), scr(4, 0)
    pg.mouse.move(*pa); pg.mouse.down(); pg.mouse.move(pc[0], pc[1], steps=6)
    pg.wait_for_timeout(150)
    pg.screenshot(path=f'{OUT}/04_baumodus_level1.png')
    pg.mouse.up()
    pg.evaluate('__bb.setDesign(%s)' % json.dumps(sol['1']['d']))
    # Statik-Anzeige im Baumodus
    pg.click('#bstat'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/05_baumodus_statik.png')
    pg.click('#bstat')
    # Level 1: Test mit Lösung -> Sieg
    def run_until_result(maxsteps=6000):
        pg.evaluate("""(n)=>{ const S=__bb.S; for(let i=0;i<n && !S.resultShown;i++) __bb.stepSim(); }""", maxsteps)
    pg.click('#btest'); run_until_result()
    pg.wait_for_timeout(700)
    report['l1_solution'] = pg.evaluate('__bb.S.sim.result')
    pg.screenshot(path=f'{OUT}/06_sieg_level1.png')
    # schwache Konstruktion: nur Fahrbahn aus Mauerwerk -> muss scheitern
    pg.evaluate('__bb.backToBuild()')
    pg.evaluate("__bb.setDesign({nodes:[[0,0],[6,0],[3,0]],members:[[0,2,4],[2,1,4]]})")
    pg.click('#btest'); run_until_result()
    pg.wait_for_timeout(500)
    report['l1_weak'] = pg.evaluate('__bb.S.sim.result')
    report['l1_weak_explain'] = pg.evaluate('document.querySelector(".explain").innerText')
    pg.screenshot(path=f'{OUT}/07_einsturz_erklaerung_level1.png')
    # Großes Beben, unausgesteifter Turm: mitten im Einsturz
    pg.evaluate('__bb.startLevel(9)'); pg.click('#go')
    weak = {'nodes': [[0,0],[4,0],[8,0],[12,0]], 'members': []}
    # Rahmen ohne Diagonalen, nur unten eine Diagonale je Feld -> wackelig
    nodes = weak['nodes']; mem = weak['members']
    def n(x, y):
        for i, q in enumerate(nodes):
            if abs(q[0]-x) < 1e-6 and abs(q[1]-y) < 1e-6: return i
        nodes.append([x, y]); return len(nodes) - 1
    for y0, y1 in [(0,6),(6,12),(12,18),(18,24),(24,30)]:
        for x in (0, 12): mem.append([n(x,y0), n(x,y1), 2])
        mem.append([n(0,y1), n(12,y1), 0])
        if y0 < 12: mem.append([n(0,y0), n(12,y1), 1]); mem.append([n(12,y0), n(0,y1), 1])
    pg.evaluate('__bb.setDesign(%s)' % json.dumps(weak))
    pg.screenshot(path=f'{OUT}/08_baumodus_turm_level10.png')
    pg.click('#btest')
    br = 0
    for k in range(80):
        pg.evaluate("()=>{for(let i=0;i<15;i++) __bb.stepSim();}")
        br = pg.evaluate('__bb.S.sim.brokenCount')
        if br >= 3: break
    pg.evaluate("()=>{for(let i=0;i<10;i++) __bb.stepSim();}")
    report['l10_weak_broken_at_screenshot'] = br
    report['l10_weak_t'] = pg.evaluate('__bb.S.sim.t')
    pg.wait_for_timeout(50)
    pg.screenshot(path=f'{OUT}/09_beben_einsturz_level10.png')
    run_until_result(); pg.wait_for_timeout(400)
    report['l10_weak'] = pg.evaluate('__bb.S.sim.result')
    pg.screenshot(path=f'{OUT}/10_beben_ergebnis_level10.png')
    # Beben-Level 5 mit Lösung, Kraftanzeige während des Bebens
    pg.evaluate('__bb.startLevel(4)'); pg.click('#go')
    pg.evaluate('__bb.setDesign(%s)' % json.dumps(sol['5']['d']))
    pg.click('#btest'); pg.click('#tforces')
    pg.evaluate("()=>{for(let i=0;i<330;i++) __bb.stepSim();}")
    pg.screenshot(path=f'{OUT}/11_beben_kraefte_level5.png')
    run_until_result(); pg.wait_for_timeout(700)
    report['l5_solution'] = pg.evaluate('__bb.S.sim.result')
    pg.screenshot(path=f'{OUT}/12_sieg_beben_level5.png')
    # Lkw-Szenen
    pg.evaluate('__bb.startLevel(5)'); pg.click('#go')
    pg.evaluate('__bb.setDesign(%s)' % json.dumps(sol['6']['d']))
    pg.click('#btest'); pg.evaluate("()=>{for(let i=0;i<150;i++) __bb.stepSim();}")
    pg.screenshot(path=f'{OUT}/13_lkw_elbbruecke_level6.png')
    pg.evaluate('__bb.startLevel(2)'); pg.click('#go')
    pg.evaluate('__bb.setDesign(%s)' % json.dumps(sol['3']['d']))
    pg.click('#btest'); pg.evaluate("()=>{for(let i=0;i<500;i++) __bb.stepSim();}")
    pg.screenshot(path=f'{OUT}/14_sturm_steg_level3.png')
    # alle Level im Browser mit Referenzlösung durchrechnen
    res = pg.evaluate("""(sol)=>{ const out={}; const {levels,mats}=__bb; for (const lv of levels){ const d=sol[lv.nr]&&sol[lv.nr].d; if(!d){out[lv.nr]='keine';continue;}
        const s=new BB.Sim(lv,d,mats,{seed:42}); let g=0; while(!s.done&&g++<9000) s.step(); out[lv.nr]={win:s.result.win, cost:BB.designCost(d,mats), budget:lv.budget, reason:s.result.reason}; } return out; }""", sol)
    report['all_levels_browser'] = res
    pg.evaluate('__bb.goLevels()'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/15_levelauswahl_fortschritt.png')
    report['localStorage_stars'] = pg.evaluate("JSON.parse(localStorage.getItem('bebenbau.v1')).stars")
    report['manifest'] = pg.evaluate("fetch('manifest.json').then(r=>r.status)")
    b.close()
report['errors'] = errors
print(json.dumps(report, ensure_ascii=False, indent=1))
