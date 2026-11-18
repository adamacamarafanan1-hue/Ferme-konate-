/* ---------- Onglet « Ponte » du DG : poules par bâtiment, ont pondu / pas pondu, conseils ---------- */
/* Règle : une poule pond au plus 1 œuf par jour, donc 1 œuf ramassé = 1 poule qui a pondu */
var PONTE_G_MIN=105,PONTE_G_MAX=125; /* grammes d'aliment par poule et par jour pour une pondeuse */
function rapsFaits(c,d){return RAMS.filter(function(r){return ramSaisi(c,d,r)}).length}
function bilanJourBat(c,d){
  var e=Math.max(0,effectif(c,d)),o=oeufsJour(c,d),ca=cassesJour(c,d),fait=rapsFaits(c,d),sacs=alimJour(c,d);
  var m=recMort(c,d),mal=somme(D.malades.filter(function(x){return x.comp===c&&x.date===d}),function(x){return x.n});
  var p=e>0&&fait?o/e:NaN;
  return {c:c,poules:e,oeufs:o,casses:ca,ont:Math.min(e,o),pas:Math.max(0,e-o),fait:fait,complet:fait>=RAMS.length,taux:p,
    etat:fait>=RAMS.length?etatPonte(p):-1,sacs:sacs,g:e>0&&sacs>0?sacs*n0(D.reglages.kgSac)*1000/e:NaN,morts:m?n0(m.n):0,mal:mal};
}
function tauxJourBat(c,d){return rapsFaits(c,d)>=RAMS.length?ponte(c,d):NaN}
/* Taux des 7 jours complets avant d, par bâtiment */
function serie7(c,d){var L=[];for(var i=7;i>=1;i--){var j=decal(d,-i);L.push({d:j,t:tauxJourBat(c,j)})}return L}
function moy(L){var t=0,k=0;L.forEach(function(x){if(isFinite(x.t)){t+=x.t;k++}});return k?t/k:NaN}
function dernierJourComplet(d){for(var i=0;i<30;i++){var j=decal(d,-i);if(D.reglages.comps.every(function(c){return rapsFaits(c.id,j)>=RAMS.length}))return j}return null}

function carteBatPonte(B,nomB){
  var e=B.etat,cls=B.fait?(B.complet?LIB_PONTE[e<0?0:e][0]:"cours"):"vide",pt=B.poules>0?Math.round(B.ont/B.poules*100):0;
  var h='<div class="pb-carte pb-'+cls+'"><div class="pb-tete"><b>'+esc(nomB)+'</b>'+pillPonte(e,B.fait&&!B.complet)+'</div>';
  h+='<div class="pb-poules"><b>'+nb(B.poules)+'</b><span>poules dans le bâtiment</span></div>';
  if(!B.fait)return h+'<p class="aide" style="margin:6px 0 0">Aucun ramassage saisi ce jour-là.</p></div>';
  h+='<div class="pb-barre" role="img" aria-label="'+pt+' % ont pondu"><i style="width:'+pt+'%"></i></div>';
  h+='<div class="pb-duo"><div class="pb-ont"><b>'+nb(B.ont)+'</b><span>ont pondu</span></div><div class="pb-pas"><b>'+nb(B.pas)+'</b><span>'+(B.complet?"n'ont pas pondu":"pas encore pondu")+'</span></div></div>';
  h+='<p class="pb-pied">'+(B.complet?'Ponte : <b>'+pct(B.taux)+'</b>':'Après '+B.fait+' ramassage'+(B.fait>1?"s":"")+' sur '+RAMS.length+' · <b>'+pt+' %</b> pour l\'instant')+
    ' · '+nb(B.oeufs)+' œufs'+(B.casses?' dont '+nb(B.casses)+' cassés':'')+(B.sacs?' · '+nb(B.sacs)+' sac'+(B.sacs>1?"s":"")+' ('+Math.round(B.g)+' g/poule)':'')+'</p>';
  return h+'</div>';
}

function conseilsPonte(d,Bs){
  var R=D.reglages,L=[],add=function(n,t){L.push({n:n,t:t})};
  var dc=Bs.every(function(B){return B.complet})?d:dernierJourComplet(decal(d,-1));
  var Bc=dc===d?Bs:dc?R.comps.map(function(c){return bilanJourBat(c.id,dc)}):[];
  var quand=dc===d?"":(dc?" (dernière journée complète : "+dateCourte(dc)+")":"");
  Bc.forEach(function(B){var nom=comp(B.c).court,m7=moy(serie7(B.c,dc));
    if(B.etat===2)add(2,'<b>'+nom+' : ponte faible ('+pct(B.taux)+')'+quand+'.</b> Vérifiez dans l\'ordre : l\'eau (abreuvoirs pleins et propres toute la journée), l\'aliment (quantité et qualité du dernier lot), la lumière (environ 16 h par jour), puis l\'état des poules (malades, poux, stress). Faites ramasser tous les nids et vérifier que chaque œuf est bien noté.');
    else if(B.etat===1)add(1,'<b>'+nom+' : ponte moyenne ('+pct(B.taux)+')'+quand+'.</b> Surveillez les prochains jours. Si ça ne remonte pas, contrôlez l\'eau, l\'aliment et la lumière.');
    if(isFinite(B.taux)&&isFinite(m7)&&m7-B.taux>=0.08)add(1,'<b>'+nom+' : la ponte a baissé de '+Math.round((m7-B.taux)*100)+' points</b> par rapport à sa moyenne des 7 derniers jours ('+pct(m7)+'). Une baisse brutale annonce souvent une maladie, un manque d\'eau ou un changement d\'aliment.');
    if(isFinite(B.g)&&B.g<PONTE_G_MIN)add(1,'<b>'+nom+' : '+Math.round(B.g)+' g d\'aliment par poule.</b> Une pondeuse a besoin d\'environ '+PONTE_G_MIN+' à '+PONTE_G_MAX+' g par jour. Trop peu d\'aliment fait baisser la ponte.');
    if(isFinite(B.g)&&B.g>PONTE_G_MAX+15)add(1,'<b>'+nom+' : '+Math.round(B.g)+' g d\'aliment par poule.</b> C\'est plus que le besoin ('+PONTE_G_MIN+' à '+PONTE_G_MAX+' g). Vérifiez le gaspillage dans les mangeoires et les sacs réellement donnés.');
    if(B.oeufs>0&&B.casses/B.oeufs>0.03)add(1,'<b>'+nom+' : '+Math.round(B.casses/B.oeufs*100)+' % d\'œufs cassés.</b> Ramassez plus souvent, ajoutez de la litière dans les nids et vérifiez le calcium dans l\'aliment (coquilles fragiles).');
  });
  if(Bc.length===2&&Bc.every(function(B){return isFinite(B.taux)})){var a=Bc[0],b=Bc[1],ec=Math.abs(a.taux-b.taux);
    if(ec>=0.10){var bas=a.taux<b.taux?a:b,haut=bas===a?b:a;add(1,'<b>Écart de '+Math.round(ec*100)+' points entre les bâtiments.</b> '+comp(bas.c).court+' pond moins que '+comp(haut.c).court+'. Comparez les deux : eau, aliment donné, chaleur, lumière, âge des poules. Ce qui marche dans '+comp(haut.c).court+' doit être appliqué dans '+comp(bas.c).court+'.')}}
  Bs.forEach(function(B){var nom=comp(B.c).court;
    if(B.mal>0)add(2,'<b>'+nom+' : '+nb(B.mal)+' poule'+(B.mal>1?"s":"")+' malade'+(B.mal>1?"s":"")+' signalée'+(B.mal>1?"s":"")+'.</b> Isolez-les tout de suite et appelez le vétérinaire si les signes durent.');
    if(B.morts>=3)add(2,'<b>'+nom+' : '+nb(B.morts)+' poules mortes aujourd\'hui.</b> Au-delà de 2 par jour, faites examiner un cadavre par un vétérinaire.');
  });
  R.comps.forEach(function(c){var k=dernierComptage(c.id,d),age=k?Math.round((new Date(d+"T12:00:00")-new Date(k.date+"T12:00:00"))/864e5):null;
    if(!k)add(1,'<b>'+c.court+' : aucun comptage des poules.</b> Demandez au technicien de compter les poules : sans le vrai nombre, le taux de ponte n\'est pas fiable.');
    else if(age>30)add(0,'<b>'+c.court+' : dernier comptage il y a '+age+' jours.</b> Refaites un comptage une fois par mois pour garder des chiffres justes.')});
  if(!Bc.length)add(0,'Les conseils apparaîtront après la première journée complète (les '+RAMS.length+' ramassages saisis dans chaque bâtiment).');
  else if(!L.some(function(x){return x.n>0}))add(0,'<b>Tout va bien'+quand+'.</b> Gardez le même rythme : eau propre à volonté, aliment à heure fixe ('+PONTE_G_MIN+' à '+PONTE_G_MAX+' g par poule), ramassage aux '+RAMS.length+' heures prévues.');
  return L.sort(function(a,b){return b.n-a.n});
}

function contenuPonte(){
  var d=V.jourPonte||auj(),R=D.reglages,Bs=R.comps.map(function(c){return bilanJourBat(c.id,d)});
  var T={poules:somme(Bs,function(B){return B.poules}),ont:somme(Bs,function(B){return B.ont}),pas:somme(Bs,function(B){return B.pas})};
  var complet=Bs.every(function(B){return B.complet}),fait=Bs.some(function(B){return B.fait});
  var h='<div class="nav-jour petit"><button class="ico" data-act="jourPonte" data-v="-1" aria-label="Jour précédent">'+ICO.retour+'</button><div><b>'+(d===auj()?"Aujourd'hui":jourSem(d))+'</b><small>'+dComplete(d)+'</small></div><button class="ico" data-act="jourPonte" data-v="1" aria-label="Jour suivant" '+(d>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>';
  h+=kpis([[nb(T.poules),"poules en tout"],[fait?nb(T.ont):"–","ont pondu"],[fait?nb(T.pas):"–",complet?"n'ont pas pondu":"pas encore pondu",fait&&T.poules>0&&T.ont/T.poules*100<n0(R.ponteMoyen)&&complet]]);
  h+='<div class="pb-grille">'+Bs.map(function(B){return carteBatPonte(B,comp(B.c).nom||comp(B.c).court)}).join("")+'</div>';
  if(fait&&!complet)h+='<p class="note-t">La journée n\'est pas finie : les poules qui n\'ont « pas encore pondu » peuvent encore pondre avant le dernier ramassage de '+heureRamFr(RAMS.length)+'.</p>';
  h+=bareme();
  /* 7 derniers jours */
  var lignes=[];for(var i=0;i<7;i++){var j=decal(d,-i),cells=R.comps.map(function(c){var t=tauxJourBat(c.id,j),e=etatPonte(t);return isFinite(t)?'<td class="n"><span class="ctrl-p ctrl-'+LIB_PONTE[e][0]+'">'+pct(t)+'</span><small>'+nb(Math.max(0,effectif(c.id,j)-oeufsJour(c.id,j)))+' pas pondu</small></td>':cellN(null)});
    lignes.push('<tr><td><b>'+(j===auj()?"Aujourd'hui":dateCourte(j))+'</b><small>'+jourSem(j)+'</small></td>'+cells.join("")+'</tr>')}
  h+='<h3 class="sous-t">Les 7 derniers jours</h3>'+tableau(["Jour"].concat(R.comps.map(function(c){return c.court})),lignes)+'<p class="note-t">Seules les journées complètes (les '+RAMS.length+' ramassages) ont un taux.</p>';
  var C=conseilsPonte(d,Bs);
  h+='<h3 class="sous-t">Recommandations</h3><ul class="pb-conseils">'+C.map(function(x){return '<li class="pc-n'+x.n+'"><i aria-hidden="true"></i><span>'+x.t+'</span></li>'}).join("")+'</ul>';
  return h+'<p class="note-t">Calcul : 1 œuf ramassé = 1 poule qui a pondu (une poule pond au plus un œuf par jour). Le nombre de poules vient du dernier comptage, moins les mortes et les sorties saisies depuis.</p>';
}
/* Valeur sur la carte du menu : taux du jour (ou de la dernière journée complète) */
function valeurPonte(){var a=auj(),R=D.reglages,fini=R.comps.every(function(c){return rapsFaits(c.id,a)>=RAMS.length}),d=fini?a:dernierJourComplet(decal(a,-1));
  if(!d)return ["–","pas encore de journée complète","à suivre"];
  var t=ponte(null,d),e=etatPonte(t),pas=Math.max(0,effectifTotal(d)-oeufsJour(null,d)),lib=nb(pas)+" n'ont pas pondu"+(d===a?"":" ("+dateCourte(d)+")");
  return [pct(t),lib,e===2?'<span class="rouge">'+LIB_PONTE[e][1]+'</span>':LIB_PONTE[e][1]+" · "+dateCourte(d)]}
