# Étape de construction : téléphone des clients, menu Clients, annulation des dépenses
def appliquer(rep):
    # Vente : champ téléphone, enregistré avec la vente
    rep("""  h+='</div>'+compteur("alv","Nombre d'alvéoles",1,[-10,10])""", """  h+='</div>'+champTel()+compteur("alv","Nombre d'alvéoles",1,[-10,10])""")
    rep('if(type==="vente"){F.client="";','if(type==="vente"){F.tel=null;F.telTouche=false;F.client="";')
    rep('ok=ecrire(F.date,"ventes",uid(),{date:F.date,client:F.client.trim(),alv:alv,prix:n0(F.prix),paye:paye});',
        'if(F.tel&&!telValide(F.tel))return toast("Le numéro de téléphone n\'est pas valable");\n    ok=ecrire(F.date,"ventes",uid(),{date:F.date,client:F.client.trim(),alv:alv,prix:n0(F.prix),paye:paye,tel:telPropre(F.tel)});')
    # Menu Clients chez le DG
    rep('  ["resume","Résumé","voix","gris","À écouter ou envoyer"],','  ["resume","Résumé","voix","gris","À écouter ou envoyer"],\n  ["clients","Clients","clients","arg","Contacts et crédits"],')
    rep('  if(k==="ventes")return [gnf(C.enc),nb(C.alvVendues)+" alvéoles vendues"];','  if(k==="clients"){var LC=listeClients();return [nb(LC.length)+" clients",nb(LC.filter(function(c){return c.reste}).length)+" avec crédit"]}\n  if(k==="ventes")return [gnf(C.enc),nb(C.alvVendues)+" alvéoles vendues"];')
    rep('  if(k==="ventes")return [court(C.enc),"GNF rentrés"];','  if(k==="clients"){var LC2=listeClients();return [nb(LC2.length),LC2.some(function(c){return c.reste})?\'<span class="rouge">\'+LC2.filter(function(c){return c.reste}).length+\' à crédit</span>\':"clients"]}\n  if(k==="ventes")return [court(C.enc),"GNF rentrés"];')
    rep('  if(k==="dep")return contenuDepenses();\n','  if(k==="dep")return contenuDepenses();\n  if(k==="clients")return contenuClients();\n')
    # Dépenses du DG : bouton Annuler + liste des annulées
    rep("""'<small>'+(s2?'<button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">Voir le reçu</button>':'<span class="rouge">sans reçu</span>')+'</small>""",
        """'<small>'+(s2?'<button class="recu-btn" data-act="voirRecu" data-l="dep" data-id="'+x.id+'">Voir le reçu</button>':'<span class="rouge">sans reçu</span>')+' '+boutonAnnulerDep(x)+'</small>""")
    rep("""  return h+'<div class="tab-p journal"><table><thead><tr><th>Heure</th><th>Dépense</th><th class="n">GNF</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div>';""",
        """  return h+'<div class="tab-p journal"><table><thead><tr><th>Heure</th><th>Dépense</th><th class="n">GNF</th></tr></thead><tbody>'+rows.join("")+'</tbody></table></div>'+depensesAnnulees(Q);""")
    rep("""  if(!L.length)return h+'<div class="vide">Aucune dépense sur cette période.</div>';""","""  if(!L.length)return h+'<div class="vide">Aucune dépense sur cette période.</div>'+depensesAnnulees(Q);""")
    # Commercial : ses dépenses du jour, annulables
    rep("  if(cr.length){h+='<h3>Clients qui doivent de l\\'argent</h3>","  h+=mesDepensesDuJour(d);\n  if(cr.length){h+='<h3>Clients qui doivent de l\\'argent</h3>")
    # Feuille d'annulation et actions
    rep('inventaire:fInventaire,','inventaire:fInventaire,annulation:fAnnulation,')
    rep('  if(F.type==="inventaire"||F.type==="reception"||F.type==="ouverture")return validerControle(F);','  if(F.type==="annulation")return validerAnnulation(F);\n  if(F.type==="inventaire"||F.type==="reception"||F.type==="ouverture")return validerControle(F);')
    rep('  else if(a==="okRejet"){','  else if(a==="annulerDep"){var xd=D.dep.find(function(x){return x.id===b.getAttribute("data-id")});if(!xd)return;V.F={type:"annulation",dep:xd.id,motif:"",date:auj()};rendre()}\n  else if(a==="triClient"){V.triClient=b.getAttribute("data-v");majContenuOuvert()}\n  else if(a==="okRejet"){')
    # Onglet « Annuler » : menu chez le DG, bouton chez le commercial
    rep('  ["clients","Clients","clients","arg","Contacts et crédits"],','  ["clients","Clients","clients","arg","Contacts et crédits"],\n  ["annul","Annuler","note","arg","Dépenses annulées et pourquoi"],')
    rep('  if(k==="clients"){var LC=listeClients();','  if(k==="annul"){var NA=(D.depAnnulees||[]).length;return [nb(NA)+" annulée"+(NA>1?"s":""),"annuler une dépense"]}\n  if(k==="clients"){var LC=listeClients();')
    rep('  if(k==="clients"){var LC2=listeClients();','  if(k==="annul"){var NA2=(D.depAnnulees||[]).length;return [nb(NA2),NA2>1?"annulées":"annulée"]}\n  if(k==="clients"){var LC2=listeClients();')
    rep('  if(k==="clients")return contenuClients();\n','  if(k==="clients")return contenuClients();\n  if(k==="annul")return contenuAnnuler();\n')
    rep('dRam:dRam,','dRam:dRam,dAnnuler:dAnnuler,')
    rep(""" Dépense</button></div>';""",""" Dépense</button></div><button class="btn sec annuler-btn" data-act="ouvrir" data-v="dAnnuler">'+IC.note+' Annuler une dépense</button>';""")
    # Icônes illustrées
    rep('''<span class="rub-ic">'+IC[m[2]]+'</span>''','''<span class="rub-ic'+clsIc(k)+'">'+icMenu(k,m[2])+'</span>''',2)
    rep('''<span class="mv-ic">'+IC[m[2]]+'</span>''','''<span class="mv-ic'+clsIc(k)+'">'+icMenu(k,m[2])+'</span>''')
CSS = """
.rub-ic.ic-img,.mv-ic.ic-img{background:none!important;border-radius:0;width:58px;height:58px;margin-bottom:2px}
.rub-ic.ic-img img,.mv-ic.ic-img img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.18))}
.rub.on .rub-ic.ic-img img{filter:drop-shadow(0 2px 4px rgba(0,0,0,.35)) brightness(1.04)}
.mv-ic.ic-img{width:46px;height:46px}
.ctrl-carte .rub-ic.ic-img{width:48px;height:48px}
.rub.clignote .rub-ic.ic-img{animation:ic-pulse 1.6s ease-in-out infinite}
@keyframes ic-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.annuler-btn{margin-top:10px;width:100%}
.annulees li.nouv{background:var(--alerte-doux);border-radius:12px}
.annulees small{display:block}
.grille-rub>.rub:last-child:nth-child(3n+1){grid-column:1/-1}
.liste-clients{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}
.liste-clients li{border:1px solid var(--trait);border-radius:14px;padding:10px 12px;background:var(--surface)}
.lc-h{display:flex;align-items:center;gap:10px}.lc-h .x{flex:1;min-width:0}.lc-h b{display:block;font-size:16px}.lc-h small{color:var(--gris);font-size:14px}
.lc-c{display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0 8px;font-size:13px;color:var(--gris)}
.contact{display:flex;gap:8px;flex-wrap:wrap}.contact .btn{text-decoration:none}.sans-tel{font-size:13px;color:var(--gris)}
.lien.rouge{color:var(--alerte)}
.annulees s{color:var(--gris)}
"""
