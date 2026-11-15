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
CSS = """
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
