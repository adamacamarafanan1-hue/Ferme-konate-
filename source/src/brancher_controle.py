# Étape de construction : branche l'onglet Contrôle (appelée par build.py)
def appliquer(rep):
    rep('  ["resume","Résumé","voix","gris","À écouter ou envoyer"]\n];','  ["resume","Résumé","voix","gris","À écouter ou envoyer"],\n  ["ctrl","Contrôle de cohérence","loupe","gris","Ce qui ne colle pas dans les chiffres"]\n];')
    rep('var PAR_JOUR={jour:1,avant:1,journal:1,resume:1,dep:1};','var PAR_JOUR={jour:1,avant:1,journal:1,resume:1,dep:1,ctrl:1};')
    rep("  MENUS_DG.forEach(function(m){var k=m[0],v=valeurMenuDG(k,P)","  MENUS_DG.forEach(function(m){if(m[0]===\"ctrl\")return;var k=m[0],v=valeurMenuDG(k,P)")
    rep('  if(k==="dep")return contenuDepenses();\n','  if(k==="dep")return contenuDepenses();\n  if(k==="ctrl")return estDG()?contenuControle():"";\n')
    rep("  h+=grilleDG(P);\n  return h;","  h+=carteControle()+grilleDG(P);\n  return h;")
    rep('b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false")});pn.innerHTML=panneauMenu(P)}',
        'b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false")});var cc=document.querySelector(".ctrl-carte");if(cc)cc.classList.toggle("on",V.ouvertP==="ctrl");pn.innerHTML=panneauMenu(P)}')
    rep('+num("margeRam","Délai avant de signaler un retard (minutes)",R.margeRam);',
        '+num("margeRam","Délai avant de signaler un retard (minutes)",R.margeRam);\n    h+=\'<h3 class="sous-t">Références du contrôle de cohérence</h3>\'+num("poulesRef","Nombre de poules déclaré",R.poulesRef)+num("sacsMin","Minimum de sacs d\\\'aliment par jour",R.sacsMin)+num("sacsMax","Maximum de sacs d\\\'aliment par jour",R.sacsMax)+num("prixSac","Prix d\\\'un sac d\\\'aliment (GNF)",R.prixSac)+num("kgSac","Poids d\\\'un sac (kg)",R.kgSac)+num("ponteMin","Taux de ponte normal minimum (%)",R.ponteMin);')
    rep('["prix","oeufsAlv","objectif","seuilPonte","seuilMorts","seuilAliment","margeRam"].forEach',
        '["prix","oeufsAlv","objectif","seuilPonte","seuilMorts","seuilAliment","margeRam","poulesRef","sacsMin","sacsMax","prixSac","kgSac","ponteMin"].forEach')
    rep('function(a){return a.sacs})-somme(D.alimOut','function(a){return a.sacsRecus!=null?a.sacsRecus:a.sacs})-somme(D.alimOut')
    rep('versement:fVersement,','versement:fVersement,inventaire:fInventaire,reception:fReception,')
    rep('  h+=carteAction(actionTechnicien(d))+rappelsVaccins(d);\n','  h+=carteAction(actionTechnicien(d))+rappelsVaccins(d)+blocControleTech();\n')
    rep('  if(!(estDG()&&F.changerDate&&F.date&&F.date<=auj()))F.date=auj();\n','  if(!(estDG()&&F.changerDate&&F.date&&F.date<=auj()))F.date=auj();\n  if(F.type==="inventaire"||F.type==="reception")return validerControle(F);\n')
    rep('  else if(a==="okRejet"){','  else if(a==="ouvrirInv"){var ki=b.getAttribute("data-v");if(ki==="caisse"&&!estDG())return;V.F={type:"inventaire",kind:ki,n:"",note:"",date:auj()};rendre()}\n  else if(a==="ouvrirRecep"){var ar=D.alimIn.find(function(x){return x.id===b.getAttribute("data-id")});if(!ar)return;V.F={type:"reception",achat:ar.id,n:ar.sacs,date:auj()};rendre()}\n  else if(a==="okRejet"){')
    rep('(alerte?" alerte":"")+\'" data-act="menuOuvrir" data-v="\'+k+\'" aria-pressed','(alerte?" alerte":"")+(doitClignoter(k)?" clignote":"")+\'" data-act="menuOuvrir" data-v="\'+k+\'" aria-pressed',2)
    rep("  return h+'</div><div id=\"panneau-menu\">'+panneauMenu(P)+'</div>';\n}","  setTimeout(majClignote,0);return h+'</div><div id=\"panneau-menu\">'+panneauMenu(P)+'</div>';\n}",2)
    rep('  V.ouvertP=V.ouvertP===k?null:k;V.jourOuvert=null;V.cycleOuvert=null;','  V.ouvertP=V.ouvertP===k?null:k;V.jourOuvert=null;V.cycleOuvert=null;if(V.ouvertP==="dep")ecrireLS(CLE_DEP_VU,Date.now());setTimeout(majClignote,0);')
    rep("  return h;\n}\n\n/* ================== FEUILLES DE SAISIE","  return h+'<p class=\"version\">Version '+VERSION_APP+'</p>';\n}\n\n/* ================== FEUILLES DE SAISIE")
    rep('  var net=somme(D.prod.filter(','  var net=n0(D.reglages.ouvAlv)*D.reglages.oeufsAlv+somme(D.prod.filter(')
    rep('function stockAliment(d){return somme(','function stockAliment(d){return n0(D.reglages.ouvSacs)+somme(')
    rep('inventaire:fInventaire,reception:fReception,','inventaire:fInventaire,reception:fReception,ouverture:fOuverture,')
    rep('  if(F.type==="inventaire"||F.type==="reception")return validerControle(F);','  if(F.type==="inventaire"||F.type==="reception"||F.type==="ouverture")return validerControle(F);')
    rep('  else if(a==="ouvrirInv"){','  else if(a==="ouvrirOuv"){if(!estDG())return;var Ro=D.reglages;V.F={type:"ouverture",alv:"",sacs:"",n:"",date:auj()};rendre()}\n  else if(a==="ouvrirInv"){')
    rep('RAMS.forEach(function(r){var f=ramSaisi(c.id,d,r),rt2=!f&&ramEnRetard(c.id,d,r);\n      h+=\'<button class="gr-c \'+(f?"fait":rt2?"retard":"")+\'"',
        'RAMS.forEach(function(r){var f=ramSaisi(c.id,d,r),rt2=!f&&ramEnRetard(c.id,d,r),lh=!f&&!rt2&&aLHeure(d,r);\n      h+=\'<button class="gr-c \'+(f?"fait":rt2?"retard":lh?"a-lheure":"")+\'"')
    rep(":rt2?IC.horloge:'<small>'+(heureRamFr(r)||\"à faire\")+'</small>')+'</button>'",
        ":rt2?IC.horloge:lh?'<small class=\"lh-h\">'+heureRamFr(r)+'</small><small class=\"lh-t\">C\\'est l\\'heure</small>':'<small>'+(heureRamFr(r)||\"à faire\")+'</small>')+'</button>'")
    rep("Vert = fait (nombre d\\'alvéoles). Rouge avec horloge = en retard.","Vert = fait (nombre d\\'alvéoles). Orange qui clignote = c\\'est l\\'heure. Rouge avec horloge = en retard.")
    rep("Touchez une case pour saisir ou corriger.</p></div>';","Touchez une case pour saisir ou corriger.</p></div>';\n  h+=blocPonteCommercial(d);")
CSS = """
.ctrl-p.ctrl-cours{background:var(--trait);color:var(--gris)}
.ponte-com .pc-haut{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ponte-com .pc-v{display:block;font-family:Archivo,sans-serif;font-size:34px;line-height:1;color:var(--vert)}
.ponte-com .pc-v.pc-neutre{color:var(--encre)}.ponte-com .pc-v.pc-att{color:var(--c-prod)}.ponte-com .pc-v.pc-alr{color:var(--alerte)}
.ponte-com .pc-haut span{font-size:14px;color:var(--gris)}
.pc-bats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pc-bat{border:1px solid var(--trait);border-radius:12px;padding:8px 10px}.pc-bat small{display:block;color:var(--gris);font-size:12px}.pc-bat b{display:block;font-family:Archivo,sans-serif;font-size:20px}
.gr-c.a-lheure{border:2px solid var(--c-prod);background:var(--laterite-doux);color:var(--c-prod);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px;animation:lh-fond 1.2s ease-in-out infinite}
.gr-c.a-lheure .lh-h{font-family:Archivo,sans-serif;font-size:16px;line-height:1.1;font-weight:800;animation:lh-txt 1.2s ease-in-out infinite}
.gr-c.a-lheure .lh-t{font-size:9px;line-height:1.1;font-weight:800;text-transform:uppercase;letter-spacing:.03em}
@keyframes lh-fond{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c-prod) 50%,transparent)}50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--c-prod) 0%,transparent);background:color-mix(in srgb,var(--c-prod) 22%,var(--surface))}}
@keyframes lh-txt{50%{opacity:.35}}
.accueil-dg{display:flex;align-items:center;gap:14px;margin:-34px 0 12px;position:relative}
.accueil-dg img{width:84px;height:84px;border-radius:50%;object-fit:cover;border:4px solid var(--fond);box-shadow:0 4px 14px rgba(0,0,0,.18);flex:none;background:var(--laterite-doux)}
.accueil-dg small{display:block;color:var(--gris);font-size:13px;margin-top:22px}
.accueil-dg b{display:block;font-family:Archivo,sans-serif;font-size:21px;line-height:1.15}
.accueil-dg span{display:inline-block;margin-top:3px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--laterite)}
.devise{margin:0 0 18px;padding:14px 16px 12px;border-left:4px solid var(--laterite);background:var(--laterite-doux);border-radius:4px 14px 14px 4px;font-family:Archivo,sans-serif;font-size:18px;line-height:1.35;font-weight:600;color:var(--encre)}
.devise .guill{color:var(--laterite);font-weight:800;margin:0 4px}
.devise cite{display:block;margin-top:6px;font-family:inherit;font-style:normal;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gris)}
.rub{position:relative}
.rub.clignote{border-color:var(--m);animation:rub-bord 1.6s ease-in-out infinite}
@keyframes rub-bord{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--m) 0%,transparent)}50%{box-shadow:0 0 0 3px color-mix(in srgb,var(--m) 45%,transparent)}}
.rub.clignote .rub-ic{animation:rub-ic 1.6s ease-in-out infinite}
@keyframes rub-ic{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--m) 55%,transparent)}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--m) 0%,transparent)}}
.rub.on.clignote .rub-ic{animation-name:rub-ic-on}
@keyframes rub-ic-on{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.6)}50%{box-shadow:0 0 0 7px rgba(255,255,255,0)}}
.rub.on.clignote{animation-name:rub-bord-on}
@keyframes rub-bord-on{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 3px color-mix(in srgb,var(--m) 40%,transparent)}}
.rub.clignote::after{content:"";position:absolute;top:9px;right:9px;width:9px;height:9px;border-radius:50%;background:var(--m);animation:rub-point 1.6s ease-in-out infinite}
.rub.on.clignote::after{background:#fff}
.rub.clignote.a-nouv::after{display:none}
@keyframes rub-point{0%,100%{opacity:1}50%{opacity:.25}}
.rub-nouv{position:absolute;top:-9px;right:-3px;background:var(--alerte);color:#fff;font-size:11px;font-weight:800;letter-spacing:.01em;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.18);animation:rub-point 1.6s ease-in-out infinite}
.version{text-align:center;color:var(--gris);font-size:12px;margin:18px 0 8px}
.ctrl-invs{display:grid;gap:8px;margin:6px 0}
.ctrl-inv{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px;border-radius:14px;border:1.5px solid var(--trait);background:var(--surface);color:var(--encre);font:inherit;cursor:pointer}
.ctrl-inv .x{flex:1;min-width:0}.ctrl-inv b{display:block;font-size:16px}.ctrl-inv small{display:block;color:var(--gris);font-size:13px}
.ctrl-inv .rub-ic svg{width:24px;height:24px}.ctrl-inv .fl{font-weight:800;color:var(--laterite);font-size:14px}
.ctrl-inv.en-retard{border-color:var(--c-prod)}.ctrl-inv.en-retard small{color:var(--c-prod)}
.ctrl-carte{display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin:12px 0 10px;padding:14px;border-radius:16px;border:1.5px solid var(--trait);background:var(--surface);color:var(--encre);font:inherit;cursor:pointer}
.ctrl-carte .x{flex:1;min-width:0}.ctrl-carte b{display:block;font-family:Archivo,sans-serif;font-size:17px}.ctrl-carte small{display:block;color:var(--gris);font-size:13px;margin-top:2px}
.ctrl-carte .rub-ic svg{width:28px;height:28px}.ctrl-carte.ctrl-b2{border-color:var(--alerte)}.ctrl-carte.ctrl-b1{border-color:var(--c-prod)}.ctrl-carte.on{box-shadow:0 0 0 3px var(--laterite-doux)}
.ctrl-p{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}
.ctrl-p.ctrl-ok{background:var(--vert-doux);color:var(--vert)}.ctrl-p.ctrl-att{background:var(--laterite-doux);color:var(--c-prod)}.ctrl-p.ctrl-alr{background:var(--alerte-doux);color:var(--alerte)}
.ctrl-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 4px}
.ctrl-k{background:var(--surface);border:1px solid var(--trait);border-left:5px solid var(--vert);border-radius:12px;padding:10px}
.ctrl-k.ctrl-b1{border-left-color:var(--c-prod)}.ctrl-k.ctrl-b2{border-left-color:var(--alerte)}
.ctrl-k b{display:block;font-family:Archivo,sans-serif;font-size:22px}.ctrl-k span{display:block;font-weight:700;font-size:14px}.ctrl-k small{color:var(--gris);font-size:12px}
.ctrl-k.ctrl-b2 b{color:var(--alerte)}
.ctrl-pt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;margin:6px 0;font-size:15px;line-height:1.4}
.ctrl-pt svg{width:20px;height:20px;flex:none;margin-top:1px}
.ctrl-pt.ctrl-ok{background:var(--vert-doux)}.ctrl-pt.ctrl-ok svg{color:var(--vert)}.ctrl-pt.ctrl-att{background:var(--laterite-doux)}.ctrl-pt.ctrl-att svg{color:var(--c-prod)}.ctrl-pt.ctrl-alr{background:var(--alerte-doux)}.ctrl-pt.ctrl-alr svg{color:var(--alerte)}
.defile{overflow-x:auto}.ctrl-7 th{font-size:12px;color:var(--gris);text-align:right;padding:4px 6px}.ctrl-7 th:first-child{text-align:left}.ctrl-7 td{font-size:15px}
"""
