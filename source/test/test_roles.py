"""Test complet des 3 rôles sur l'application reliée au (faux) Supabase."""
import json, os, sys, time, datetime
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/"
MOCK = open(os.path.join(os.path.dirname(__file__), "mock-supabase.js"), encoding="utf-8").read()
SHOTS = "/home/claude/app/test/captures"
os.makedirs(SHOTS, exist_ok=True)
DG_ID = "d842f523-0d8a-4889-b31d-050b71f4f32c"
erreurs, resultats = [], []

def ok(cond, lib):
    resultats.append(("OK " if cond else "ÉCHEC ") + lib)
    print(("  ✓ " if cond else "  ✗ ") + lib, flush=True)

def page_neuve(ctx, nom):
    p = ctx.new_page()
    p.on("pageerror", lambda e: erreurs.append(f"[{nom}] {e}"))
    p.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and erreurs.append(f"[{nom}] console: {m.text}"))
    p.goto(BASE)
    p.wait_for_timeout(500)
    return p

import urllib.request
def base(p=None):
    return json.loads(urllib.request.urlopen("http://127.0.0.1:8766/db").read())

def taper(p, code):
    for c in code:
        p.click(f'.clavier button[data-v="{c}"]')
        p.wait_for_timeout(40)

def entrer(p, nom, code):
    p.click(f'button[data-act="choixUser"]:has-text("{nom}")')
    taper(p, code)
    p.wait_for_timeout(700)

def sortir(p):
    p.once("dialog", lambda d: d.accept())
    p.click('button[data-act="sortir"]')
    p.wait_for_timeout(400)

def valider(p):
    p.click('#feuille button[data-act="valider"]')
    p.wait_for_timeout(500)

def fermer_ok(p):
    if p.locator('#feuille button[data-act="fermer"]').count():
        p.click('#feuille button[data-act="fermer"]')
        p.wait_for_timeout(300)

def capture(p, nom):
    p.screenshot(path=f"{SHOTS}/{nom}.png", full_page=False)

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    def telephone():
        c = nav.new_context(viewport={"width": 390, "height": 844}, locale="fr-FR", timezone_id="Africa/Conakry", device_scale_factor=2)
        c.route("**/supabase.js", lambda r: r.fulfill(body=MOCK, content_type="application/javascript"))
        c.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        c.route("**/fonts.gstatic.com/**", lambda r: r.abort())
        return c
    ctx = telephone()

    # ---------- Base de départ : seulement le DG, avec son code de départ ----------
    A = page_neuve(ctx, "A")
    A.evaluate("""(id)=>{var b=window.__mockBase();b.profils=[{id:id,nom:'Mohamed Konaté',role:'dg',bloque:false,retire:false,code_a_changer:true}];
      b.codes[id]='000000';window.__mockGarder(b);localStorage.removeItem('fermeKonate.sb.equipe')}""", DG_ID)
    A.reload(); A.wait_for_timeout(600)

    print("1. Connexion du DG et code de départ")
    ok(A.locator('button[data-act="choixUser"]').count() == 1, "écran « Qui êtes-vous ? » : seul le DG apparaît")
    capture(A, "01_connexion")
    entrer(A, "Mohamed", "000000")
    ok(A.locator("text=Choisissez votre code secret").count() == 1, "le DG doit d'abord remplacer son code de départ")
    capture(A, "02_nouveau_code")
    taper(A, "111111"); A.wait_for_timeout(200)
    ok(A.locator("text=trop facile").count() == 1, "code trop facile refusé")
    taper(A, "280419"); taper(A, "280418"); A.wait_for_timeout(300)
    ok(A.locator("text=pas pareils").count() == 1, "deux codes différents refusés")
    taper(A, "280419"); taper(A, "280419"); A.wait_for_timeout(900)
    ok(base(A)["codes"][DG_ID] == "280419", "nouveau code du DG enregistré")
    ok(A.locator("#panneau-menu, .grille-dg, [data-act=menuOuvrir]").count() > 0, "le DG arrive sur son écran")
    capture(A, "03_dg_accueil_vide")

    print("2. Le DG ajoute Laye et Malien")
    A.click('button[data-act="page"][data-v="reglages"]'); A.wait_for_timeout(300)
    capture(A, "04_equipe")
    A.fill("#uNom", "Laye"); c1 = A.input_value("#uPin")
    A.evaluate("rendreApp()"); A.wait_for_timeout(200)
    ok(A.input_value("#uPin") == c1 and A.input_value("#uNom") == "Laye", "le code proposé et le nom ne changent pas quand l'écran se met à jour")
    A.fill("#uPin", "258013")
    A.click('form[data-f="user"] button.btn'); A.wait_for_timeout(900)
    ok(A.locator("text=258 013").count() >= 1, "code de Laye affiché au DG pour le lui donner")
    fermer_ok(A)
    A.fill("#uNom", "Malien"); A.click('form[data-f="user"] button[data-v="gest"]'); A.fill("#uPin", "147092")
    A.click('form[data-f="user"] button.btn'); A.wait_for_timeout(900); fermer_ok(A)
    b = base(A)
    roles = sorted((p["nom"], p["role"]) for p in b["profils"])
    ok(roles == [("Laye", "commercial"), ("Malien", "technicien"), ("Mohamed Konaté", "dg")], f"équipe : {roles}")
    LAYE = next(p["id"] for p in b["profils"] if p["nom"] == "Laye")
    MALIEN = next(p["id"] for p in b["profils"] if p["nom"] == "Malien")
    A.fill("#uNom", "Test"); A.fill("#uPin", "123456"); A.click('form[data-f="user"] button.btn'); A.wait_for_timeout(500)
    ok(len(base(A)["profils"]) == 3, "code 123456 refusé à l'ajout")
    A.click('button[data-act="page"][data-v="accueil"]'); A.wait_for_timeout(300)

    # ---------- Historique réaliste (12 jours passés) ----------
    A.evaluate("""([L,M,DG])=>{var b=window.__mockBase(),j0=new Date();
      function jr(n){var d=new Date(j0.getTime()-n*864e5);return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
      function id(){return crypto.randomUUID()}
      function ligne(t,o,qui,j,h){o.id=id();o.jour=j;o.saisi_par=qui;o.saisi_le=j+'T'+(h||'10:00')+':00Z';o.annule=false;o.apres_coup=false;b.t[t].push(o)}
      ligne('comptages_poules',{batiment_id:'B1',nombre:1480},M,jr(12));ligne('comptages_poules',{batiment_id:'B2',nombre:1610},M,jr(12));
      for(var n=12;n>=1;n--){var j=jr(n);
        [['08:05',1],['12:10',2],['14:05',3],['18:10',4]].forEach(function(x){['B1','B2'].forEach(function(bt){
          if(n===3&&x[1]===4&&bt==='B2')return;
          ligne('ramassages',{batiment_id:bt,numero:x[1],alveoles:bt==='B1'?9+(n%3):10+(n%2),oeufs_plus:n%7,casses:n%4},L,j,x[0])})});
        ligne('mouvements_poules',{batiment_id:'B1',type:'mort',nombre:n%3,note:null},M,j,'17:00');ligne('mouvements_poules',{batiment_id:'B2',type:'mort',nombre:(n+1)%2,note:null},M,j,'17:01');
        ligne('aliment_donne',{batiment_id:'B1',sacs:4},M,j,'07:30');ligne('aliment_donne',{batiment_id:'B2',sacs:4.5},M,j,'07:31');
        ligne('ventes',{client:['Mamadou','Fanta','Kaba'][n%3],alveoles:60+n,prix_alveole:47000,paye:(60+n)*47000-(n%4===0?470000:0)},L,j,'16:00');
        ligne('depenses',{categorie:['Carburant et transport','Eau','Électricité','Réparations'][n%4],montant:[500000,80000,150000,250000][n%4],detail:'',imprevu:n===5,recu_chemin:null,achat_aliment_id:null},L,j,'11:00');
      }
      ligne('depenses',{categorie:'Salaires',montant:1500000,detail:'Malien',imprevu:false,recu_chemin:null,achat_aliment_id:null},L,jr(2),'09:00');
      ligne('malades',{batiment_id:'B2',nombre:4,signes:'Diarrhée',traitement:'Vitamines'},M,jr(2),'09:30');
      ligne('vaccins',{batiment_id:null,produit:'Newcastle',rappel:jr(-1),rappel_fait:false},M,jr(6),'08:30');
      window.__mockGarder(b)}""", [LAYE, MALIEN, DG_ID])
    A.reload(); A.wait_for_timeout(1200)

    print("3. Mauvais code puis connexion de Laye (commercial)")
    sortir(A)
    entrer(A, "Laye", "111222")
    ok(A.locator("text=Encore 4 essais").count() == 1, "mauvais code : « Encore 4 essais »")
    taper(A, "258013"); A.wait_for_timeout(1000)
    ok(A.locator("text=Commercial").count() >= 1, "Laye est sur l'écran du commercial")
    capture(A, "05_commercial")
    nb_ram = lambda: len([r for r in base(A)["t"]["ramassages"] if not r["annule"]])
    avant = nb_ram()
    A.click('button[data-act="ouvrir"][data-v="oeufs"][data-c="B1"][data-r="1"]'); A.wait_for_timeout(300)
    A.fill("#cpt_alv", "12"); A.fill("#cpt_plus", "7") if A.locator("#cpt_plus").count() else None
    capture(A, "06_saisie_ramassage")
    valider(A)
    ok(nb_ram() == avant + 1, "ramassage 1 du Bâtiment 1 enregistré dans la base")
    r = [x for x in base(A)["t"]["ramassages"] if x["saisi_par"] == LAYE and x["jour"] == datetime.date.today().isoformat()]
    ok(len(r) == 1 and r[0]["alveoles"] == 12, f"bon nombre d'alvéoles et date du jour automatique ({r[0]['jour'] if r else '?'})")
    capture(A, "07_enregistre")
    fermer_ok(A)

    print("4. Sans réseau : la saisie attend puis part")
    A.evaluate("localStorage.setItem('__hors','1');window.dispatchEvent(new Event('offline'))")
    A.click('button[data-act="ouvrir"][data-v="oeufs"][data-c="B2"][data-r="1"]'); A.wait_for_timeout(300)
    A.fill("#cpt_alv", "11"); valider(A); fermer_ok(A); A.wait_for_timeout(500)
    ok(nb_ram() == avant + 1, "rien n'arrive dans la base tant qu'il n'y a pas de réseau")
    ok(A.locator("#statut").inner_text().find("attente") >= 0 or A.locator("#statut").inner_text().find("réseau") >= 0, f"statut : « {A.locator('#statut').inner_text()} »")
    ok(A.evaluate("D.prod.some(function(p){return p.comp==='B2'&&p.r===1&&p.date===auj()})"), "la saisie est déjà visible sur le téléphone")
    capture(A, "08_hors_ligne")
    A.evaluate("localStorage.setItem('__hors','1')")
    A.reload(); A.wait_for_timeout(800)
    ok(A.evaluate("OUT.length") >= 1, "la saisie en attente survit à la fermeture de l'application")
    A.evaluate("localStorage.removeItem('__hors');window.__horsLigne=false;window.dispatchEvent(new Event('online'))"); A.wait_for_timeout(1500)
    ok(nb_ram() == avant + 2, "le réseau revient : la saisie est envoyée")
    ok(A.evaluate("OUT.length") == 0, "file d'attente vide")

    print("5. Dépense avec photo du reçu, salaire sans nom, vente à crédit")
    nb_dep = len(base(A)["t"]["depenses"])
    A.click('button[data-act="ouvrir"][data-v="depense"]'); A.wait_for_timeout(300)
    A.click('#feuille button[data-v="Salaires"]'); A.fill("#m_montant", "1000000"); valider(A)
    ok(len(base(A)["t"]["depenses"]) == nb_dep, "salaire sans le nom de la personne : refusé")
    A.click('#feuille button[data-v="Carburant et transport"]'); A.wait_for_timeout(200)
    A.fill("#m_montant", "500000")
    from PIL import Image; Image.new("RGB", (800, 1000), (240, 230, 210)).save("/tmp/claude-recu.jpg")
    A.set_input_files('#feuille input[type=file]', "/tmp/claude-recu.jpg"); A.wait_for_timeout(1200)
    capture(A, "09_depense_recu")
    valider(A); A.wait_for_timeout(1500)
    deps = base(A)["t"]["depenses"]
    d = [x for x in deps if x["categorie"] == "Carburant et transport" and x["saisi_par"] == LAYE and x["jour"] == datetime.date.today().isoformat()]
    ok(len(d) == 1 and d[0]["montant"] == 500000, "dépense carburant 500 000 enregistrée")
    ok(bool(d and d[0]["recu_chemin"]) and d[0]["recu_chemin"] in base(A)["stock"], "photo du reçu envoyée dans le stockage privé")
    fermer_ok(A)
    A.click('button[data-act="ouvrir"][data-v="vente"]'); A.wait_for_timeout(300)
    A.fill("#vc", "Mamadou"); A.fill("#cpt_alv", "10"); A.click('#feuille button[data-v="partie"]'); A.wait_for_timeout(200)
    A.fill("#m_paye", "300000"); valider(A); fermer_ok(A)
    v = [x for x in base(A)["t"]["ventes"] if x["saisi_par"] == LAYE and x["jour"] == datetime.date.today().isoformat()]
    ok(len(v) == 1 and v[0]["alveoles"] == 10 and v[0]["paye"] == 300000, "vente de 10 alvéoles avec 300 000 payés (crédit 170 000)")
    capture(A, "10_commercial_apres")
    ok(A.locator(".ponte-com").count() == 1 and "Pas bon" in A.locator(".ponte-com").inner_text(), "le commercial voit le contrôle de la ponte")
    ok(A.locator(".ponte-com .ctrl-p").count() >= 7, "la ponte des 7 derniers jours est jugée (normal / un peu bas / anormal)")
    A.locator(".ponte-com").screenshot(path=f"{SHOTS}/10b_ponte_commercial.png")

    print("6. Le DG voit en direct sur un autre téléphone")
    B = page_neuve(telephone(), "B")
    entrer(B, "Mohamed", "280419"); B.wait_for_timeout(1000)
    vu_avant = B.evaluate("D.prod.filter(function(p){return p.date===auj()}).length")
    A.click('button[data-act="ouvrir"][data-v="oeufs"][data-c="B1"][data-r="2"]'); A.wait_for_timeout(300)
    A.fill("#cpt_alv", "10"); valider(A); fermer_ok(A); B.wait_for_timeout(1500)
    print("   debug", vu_avant, B.evaluate("D.prod.filter(function(p){return p.date===auj()}).length"), A.evaluate("D.prod.filter(function(p){return p.date===auj()}).length"), len([r for r in base()["t"]["ramassages"] if r["jour"]==datetime.date.today().isoformat()]), B.evaluate("[ETAT.direct, Object.keys(STATE.rows.prod).length]"))
    ok(B.evaluate("D.prod.filter(function(p){return p.date===auj()}).length") == vu_avant + 1, "le ramassage de Laye apparaît chez le DG sans rien toucher")
    capture(B, "11_dg_accueil")
    ok(B.locator(".pdg").count() == 1, "le DG voit le bandeau de la ponte en haut de son écran")
    cl = lambda k: "clignote" in (B.locator(f'.grille-rub > button[data-v="{k}"]').get_attribute("class") or "")
    ok(cl("jour"), "le menu Aujourd'hui clignote")
    ok(cl("dep"), "le menu Dépenses clignote : des dépenses pas encore vues")
    B.click('.grille-rub > button[data-v="dep"]'); B.wait_for_timeout(400)
    B.click('.grille-rub > button[data-v="dep"]'); B.wait_for_timeout(400)
    ok(cl("dep") and cl("jour") and B.locator('.grille-rub > button[data-v="dep"] .rub-nouv').count() == 0, "après ouverture, Dépenses clignote toujours, la pastille « nouvelles » disparaît")
    A.evaluate("V.F=null;ecrire(auj(),'dep',uid(),{date:auj(),cat:'Eau',montant:50000,note:'',imprevu:false})"); A.wait_for_timeout(1500)
    B.wait_for_timeout(3500)
    ok(cl("dep") and "1 nouvelle" in B.locator('.grille-rub > button[data-v="dep"]').inner_text(), "nouvelle dépense de Laye : Dépenses clignote avec « 1 nouvelle »")
    capture(B, "11b_clignote")
    cles = B.eval_on_selector_all('.grille-rub > button[data-act="menuOuvrir"]', "l=>l.map(b=>b.dataset.v)")
    n = len(cles)
    ok(n == 12, f"{n} menus dans la grille du DG")
    def ouvrir_menu(k):
        bt = B.locator(f'.grille-rub > button[data-v="{k}"]')
        if "on" not in (bt.get_attribute("class") or ""): bt.click(); B.wait_for_timeout(350)
    for i, k in enumerate(cles):
        ouvrir_menu(k)
        vide = B.locator("#panneau-menu").inner_text().strip() == ""
        if vide: ok(False, f"menu {k} vide")
        capture(B, f"12_menu_{i:02d}_{k}")
    dep_txt = ""
    ouvrir_menu("dep")
    if B.locator('[data-act="depPer"][data-v="tout"]').count():
        B.click('[data-act="depPer"][data-v="tout"]'); B.wait_for_timeout(300)
    dep_txt = B.locator("#panneau-menu").inner_text()
    ok("Carburant" in dep_txt and "Salaires" in dep_txt and "Malien" in dep_txt, "le DG voit les dépenses par catégorie, avec le nom du salarié")
    capture(B, "13_dg_depenses")
    ouvrir_menu("vers")
    vt = B.locator("#panneau-menu").inner_text()
    ok("47 000" in vt or "47 000" in vt.replace(" ", " "), "versement : la valeur des alvéoles à 47 000 est expliquée")
    capture(B, "14_dg_versements")

    print("6b. Contrôle de cohérence")
    B.click('button.ctrl-carte'); B.wait_for_timeout(400)
    txt = B.locator("#panneau-menu").inner_text()
    ok("Taux de ponte" in txt and "Aliment par poule" in txt and "7 derniers jours" in txt, "l'onglet Contrôle s'ouvre avec ponte, aliment et 7 jours")
    B.click('[data-act="bordJour"][data-v="-1"]'); B.wait_for_timeout(400)
    txt = B.locator("#panneau-menu").inner_text()
    ok("plus que le maximum de 7 sacs" in txt, "8,5 sacs donnés hier : signalé au-dessus du maximum de 7")
    ok("plus que ce qui a été acheté" not in txt and "Inventaire d'ouverture à faire" in txt, "sans inventaire d'ouverture : pas de fausse alerte de stock, mais l'invitation à le faire")
    capture(B, "14b_controle")
    B.locator("#panneau-menu").screenshot(path=f"{SHOTS}/14c_controle_panneau.png")
    ok(A.locator("button.ctrl-carte").count() == 0, "le commercial ne voit pas le contrôle")

    print("7. Le technicien Malien")
    C = page_neuve(telephone(), "C")
    entrer(C, "Malien", "147092"); C.wait_for_timeout(1000)
    ok(C.locator("text=Technicien").count() >= 1, "Malien est sur l'écran du technicien")
    ok(C.evaluate("D.ventes.length") == 0 and C.evaluate("D.dep.length") == 0, "le technicien ne reçoit ni les ventes ni les dépenses")
    ok(B.evaluate("D.malades.length") >= 1 and A.evaluate("D.malades.length") == 0, "le commercial ne reçoit pas les poules malades, le DG oui")
    capture(C, "15_technicien")
    if C.locator('[data-act="ongletTech"][data-v="poules"]').count():
        C.click('[data-act="ongletTech"][data-v="poules"]'); C.wait_for_timeout(300)
    C.click('button[data-act="ouvrir"][data-v="poules"][data-c="B1"]'); C.wait_for_timeout(300)
    C.fill("#cpt_n", "1475"); valider(C); fermer_ok(C)
    ok(any(x["nombre"] == 1475 and x["saisi_par"] == MALIEN for x in base(C)["t"]["comptages_poules"]), "nombre de poules du Bâtiment 1 changé (1 475)")
    capture(C, "16_technicien_poules")
    A.wait_for_timeout(800)
    ok(A.evaluate("effectif('B1',auj())") == 1475, "le commercial voit tout de suite le nouveau nombre de poules")
    ok(C.evaluate("(function(){try{ouvrir('oeufs','B1',null,1);valider();return true}catch(e){return e.message}})()") is not None, "")
    C.wait_for_timeout(800)
    ok(len([r for r in base(C)["t"]["ramassages"] if r["saisi_par"] == MALIEN]) == 0, "le technicien ne peut pas saisir un ramassage (refusé par la base)")
    fermer_ok(C)

    print("8. Saisie après coup par le DG, rappel de vaccin")
    hier = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    B.evaluate("ouvrir('oeufs','B2',null,4)"); B.wait_for_timeout(200)
    B.click('#feuille [data-act="changerDate"]'); B.wait_for_timeout(200)
    B.fill("#jourPasse", (datetime.date.today() - datetime.timedelta(days=3)).isoformat()); B.wait_for_timeout(300)
    B.fill("#cpt_alv", "9"); valider(B); fermer_ok(B)
    tr = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()
    x = [r for r in base(B)["t"]["ramassages"] if r["jour"] == tr and r["batiment_id"] == "B2" and r["numero"] == 4]
    ok(len(x) == 1 and x[0]["apres_coup"], "le DG complète le ramassage oublié il y a 3 jours, marqué « après coup »")
    C.click('[data-act="ongletTech"][data-v="jour"]'); C.wait_for_timeout(300); capture(C, "16b_technicien_rappel")
    if C.locator('[data-act="rappelFait"]').count():
        C.click('[data-act="rappelFait"]'); C.wait_for_timeout(800)
        ok(any(v["rappel_fait"] for v in base(C)["t"]["vaccins"]), "le technicien note le rappel de vaccin comme fait")
    else:
        ok(False, "bouton « Rappel fait » visible chez le technicien")

    print("8b. Comptages réels et réception de l'aliment")
    B.evaluate("V.ouvertP=null;rendreApp()"); B.click('button.ctrl-carte'); B.wait_for_timeout(400)
    ok(B.locator('[data-act="ouvrirOuv"]').count() >= 1 and "Inventaire d'ouverture à faire" in B.locator("#panneau-menu").inner_text(), "le DG est invité à faire l'inventaire d'ouverture")
    B.click('[data-act="ouvrirOuv"]'); B.wait_for_timeout(300)
    B.fill("#cpt_alv", "40"); B.fill("#cpt_sacs", "12"); B.fill("#m_n", "500000"); valider(B); fermer_ok(B)
    rg = base()["reglages"][0]
    ok(rg.get("ouv_date") and rg.get("ouv_caisse") is not None, "inventaire d'ouverture enregistré")
    ok(B.evaluate("stockAliment(auj())") == 12, "les sacs attendus = les 12 sacs comptés")
    ok(B.evaluate("D.inv.filter(function(x){return x.note===\"Inventaire d'ouverture\"}).length") == 3, "les 3 comptages d'ouverture sont gardés (les écarts restent visibles)")
    B.click('button.ctrl-carte'); B.wait_for_timeout(300)
    A.click('button[data-act="ouvrir"][data-v="achat"]') if A.locator('button[data-act="ouvrir"][data-v="achat"]').count() else A.evaluate("ouvrir('achat')")
    A.wait_for_timeout(300); A.fill("#cpt_sacs", "10"); A.fill("#m_montant", "2900000"); valider(A); fermer_ok(A)
    ach = [x for x in base()["t"]["achats_aliment"] if x["saisi_par"] == LAYE]
    ok(len(ach) == 1 and ach[0]["sacs"] == 10, "Laye achète 10 sacs d'aliment")
    C.wait_for_timeout(1000); C.evaluate("rendreApp()"); C.wait_for_timeout(200)
    ok(C.locator('[data-act="ouvrirRecep"]').count() >= 1, "le technicien voit la réception à confirmer")
    capture(C, "20_technicien_reception")
    C.click('[data-act="ouvrirRecep"]'); C.wait_for_timeout(300); C.fill("#cpt_n", "8"); valider(C)
    ok("Il manque 2 sacs" in C.locator("#feuille").inner_text(), "Malien confirme 8 sacs reçus : il en manque 2")
    fermer_ok(C)
    ok(base()["t"]["achats_aliment"][0].get("sacs_recus") == 8, "sacs reçus enregistrés dans la base")
    C.click('[data-act="ouvrirInv"][data-v="alveoles"]'); C.wait_for_timeout(300)
    ok("attendu" not in C.locator("#feuille").inner_text().lower(), "le technicien compte sans voir le chiffre attendu")
    C.fill("#cpt_n", "150"); valider(C); fermer_ok(C)
    inv = [x for x in base()["t"]["inventaires"] if not x.get("note")]
    ok(len(inv) == 1 and inv[0]["compte"] == 150 and inv[0]["theorique"] is not None, f"comptage des alvéoles enregistré avec l'attendu ({inv[0]['theorique'] if inv else '?'})")
    ok(A.evaluate("D.inv.length") == 0, "le commercial ne voit pas les comptages")
    ok(C.locator('[data-act="ouvrirInv"][data-v="caisse"]').count() == 0, "le technicien ne peut pas compter la caisse")
    B.wait_for_timeout(800)
    B.evaluate("V.ouvertP=null;rendreApp()"); B.click('button.ctrl-carte'); B.wait_for_timeout(400)
    B.click('[data-act="ouvrirInv"][data-v="caisse"]'); B.wait_for_timeout(300)
    attendu = B.evaluate("caisseTheorique()")
    B.fill("#m_n", str(int(attendu) - 200000)); valider(B)
    ok("Écart" in B.locator("#feuille").inner_text(), f"le DG compte la caisse : écart de 200 000 affiché (attendu {attendu})")
    fermer_ok(B); B.wait_for_timeout(300)
    txt = B.locator("#panneau-menu").inner_text().replace("\u202f", " ").replace("\xa0", " ")
    ok("10 sacs payés, 8 reçus" in txt, "signal : 10 sacs payés, 8 reçus")
    ok("Argent chez le commercial" in txt and "200 000" in txt, "signal : écart de caisse")
    ok("Coût d'une alvéole" in txt and "Indice de consommation" in txt, "chiffres du mois affichés")
    B.locator("#panneau-menu").screenshot(path=f"{SHOTS}/21_controle_comptable.png")

    print("9. Annulation et blocage")
    nA = len([r for r in base(A)["t"]["ventes"] if r["annule"]])
    A.evaluate("ecrire(auj(),'prod',D.prod.find(function(p){return p.parId!==PROFIL.id}).id,null)"); A.wait_for_timeout(800)
    ok(A.evaluate("ETAT.rejets.length") >= 1, "Laye ne peut pas annuler la saisie d'un autre jour : refus affiché")
    capture(A, "17_refus")
    B.click('button[data-act="page"][data-v="reglages"]'); B.wait_for_timeout(300)
    B.once("dialog", lambda d: d.accept())
    B.click(f'button[data-act="bloquer"][data-id="{LAYE}"]'); B.wait_for_timeout(1200)
    A.wait_for_timeout(1000)
    ok(A.locator('button[data-act="choixUser"]').count() >= 1 and A.locator("text=bloqué").count() >= 1, "Laye bloqué : il est sorti tout de suite de l'application")
    ok(A.locator(f'button[data-act="choixUser"]:has-text("Laye")').count() == 0, "Laye n'apparaît plus dans la liste d'entrée")
    capture(A, "18_laye_bloque")
    capture(B, "19_equipe_bloque")
    B.click(f'button[data-act="bloquer"][data-id="{LAYE}"]'); B.wait_for_timeout(1200)
    ok(not next(p for p in base(B)["profils"] if p["id"] == LAYE)["bloque"], "Laye débloqué par le DG")

    print("\nErreurs JavaScript :", len(erreurs))
    for e in erreurs[:20]: print("  ", e)
    nav.close()

echecs = [r for r in resultats if r.startswith("ÉCHEC")]
print(f"\n{len(resultats)-len(echecs)}/{len(resultats)} vérifications réussies")
sys.exit(1 if echecs or erreurs else 0)
