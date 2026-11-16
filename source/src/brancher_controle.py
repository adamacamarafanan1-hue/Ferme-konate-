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
CSS = """
.rub{position:relative}
.rub.clignote{border-color:color-mix(in srgb,var(--m) 70%,transparent)}
.rub.clignote::after{content:"";position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--m);animation:rub-onde 2.2s cubic-bezier(.2,.6,.4,1) infinite}
.rub.clignote.a-nouv::after{display:none}
.rub.on.clignote::after{background:#fff;--m:#ffffff}
.grille-rub .rub.alerte{margin:0}
@keyframes rub-onde{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--m) 60%,transparent)}75%,100%{box-shadow:0 0 0 8px color-mix(in srgb,var(--m) 0%,transparent)}}
.rub-nouv{position:absolute;top:-9px;right:-3px;background:var(--alerte);color:#fff;font-size:11px;font-weight:800;letter-spacing:.01em;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.18);animation:rub-onde-r 2.2s cubic-bezier(.2,.6,.4,1) infinite}
@keyframes rub-onde-r{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--alerte) 50%,transparent)}75%,100%{box-shadow:0 0 0 7px color-mix(in srgb,var(--alerte) 0%,transparent)}}
@media (prefers-reduced-motion:reduce){.rub.clignote::after,.rub-nouv{animation:none}}
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
