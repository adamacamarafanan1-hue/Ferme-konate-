# Étape de construction : onglet « Ponte » chez le DG
def appliquer(rep):
    rep('  ["poules","Poules","poule","elev","Nombre par bâtiment"],','  ["poules","Poules","poule","elev","Nombre par bâtiment"],\n  ["ponte","Ponte","oeuf","prod","Qui a pondu, qui n\'a pas pondu, conseils"],')
    rep('  if(k==="poules")return [nb(effectifTotal(P.fin))+" poules","dans les "+R.comps.length+" bâtiments"];',
        '  if(k==="poules")return [nb(effectifTotal(P.fin))+" poules","dans les "+R.comps.length+" bâtiments"];\n  if(k==="ponte"){var BP=valeurPonte();return [BP[0],BP[1]]}')
    rep('  if(k==="poules")return [nb(effectifTotal(P.fin)),"poules"];',
        '  if(k==="poules")return [nb(effectifTotal(P.fin)),"poules"];\n  if(k==="ponte"){var BP2=valeurPonte();return [BP2[0],BP2[2]]}')
    rep('  if(k==="clients")return contenuClients();\n','  if(k==="clients")return contenuClients();\n  if(k==="ponte")return contenuPonte();\n')
    rep('  else if(a==="jourAlv"){','  else if(a==="jourPonte"){var np=decal(V.jourPonte||auj(),n0(v));if(np<=auj()){V.jourPonte=np;if(!majContenuOuvert())rendreApp()}}\n  else if(a==="jourAlv"){')
CSS = """
.pb-grille{display:grid;grid-template-columns:1fr;gap:10px;margin:10px 0}
@media(min-width:560px){.pb-grille{grid-template-columns:1fr 1fr}}
.pb-carte{border:1px solid var(--trait);border-left:6px solid var(--trait);border-radius:14px;padding:12px 14px;background:var(--surface)}
.pb-ok{border-left-color:var(--vert)}.pb-att{border-left-color:var(--c-prod)}.pb-alr{border-left-color:var(--alerte)}.pb-cours{border-left-color:var(--gris)}
.pb-tete{display:flex;justify-content:space-between;align-items:center;gap:8px}.pb-tete b{font-size:17px}
.pb-poules{margin:6px 0 8px}.pb-poules b{font-size:30px;line-height:1.1;display:block}.pb-poules span{color:var(--gris);font-size:14px}
.pb-barre{height:12px;border-radius:999px;background:var(--alerte-doux);overflow:hidden}
.pb-barre i{display:block;height:100%;background:var(--vert);border-radius:999px}
.pb-duo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.pb-duo>div{border-radius:10px;padding:8px 10px}.pb-duo b{display:block;font-size:22px}.pb-duo span{font-size:13px}
.pb-ont{background:var(--vert-doux)}.pb-ont b,.pb-ont span{color:var(--vert)}
.pb-pas{background:var(--alerte-doux)}.pb-pas b,.pb-pas span{color:var(--alerte)}
.pb-pied{margin:8px 0 0;font-size:13px;color:var(--gris)}.pb-pied b{color:var(--encre)}
.pb-conseils{list-style:none;margin:8px 0;padding:0;display:grid;gap:8px}
.pb-conseils li{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:10px 12px;background:var(--surface);border:1px solid var(--trait);font-size:15px;line-height:1.45}
.pb-conseils i{flex:none;width:12px;height:12px;border-radius:50%;margin-top:5px;background:var(--vert)}
.pb-conseils .pc-n1{background:var(--laterite-doux)}.pb-conseils .pc-n1 i{background:var(--c-prod)}
.pb-conseils .pc-n2{background:var(--alerte-doux)}.pb-conseils .pc-n2 i{background:var(--alerte)}
"""
