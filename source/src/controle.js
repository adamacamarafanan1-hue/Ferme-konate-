/* ---------- Contrôle de cohérence (réservé au DG) ----------
   Compare chaque jour ce qui est saisi avec ce qui est normal pour une ferme de pondeuses :
   ponte, aliment par poule, sacs donnés, stocks, argent. Personne n'a rien à saisir en plus. */
var G_MIN=105,G_MAX=130;
function prixSacReel(){
  var L=D.alimIn.filter(function(a){return n0(a.sacs)>0&&n0(a.montant)>0}).sort(function(a,b){return a.date<b.date?1:-1}).slice(0,5);
  var s=somme(L,function(a){return a.sacs});return s>0?somme(L,function(a){return a.montant})/s:n0(D.reglages.prixSac);
}
function signe(n){return (n>0?"+":"")+nb(n)}
function controleJour(d){
  var R=D.reglages,oeufs=oeufsJour(null,d),cas=cassesJour(null,d),alv=alvDe(oeufs,cas),sacs=alimJour(null,d),eff=effectifTotal(d);
  var poules=eff>0?eff:n0(R.poulesRef),ponteV=poules>0?oeufs/poules:NaN,g=poules>0?sacs*n0(R.kgSac)*1000/poules:NaN;
  var prixS=prixSacReel(),coutAlim=sacs*prixS,valeur=alv*n0(R.prix),mo=morts(null,d),pts=[];
  var prodOk=D.prod.some(function(p){return p.date===d}),alimOk=D.alimOut.some(function(a){return a.date===d});
  if(eff>0&&n0(R.poulesRef)>0&&Math.abs(eff-R.poulesRef)/R.poulesRef>0.03)
    pts.push({n:1,t:"Poules comptées : <b>"+nb(eff)+"</b>, mais "+nb(R.poulesRef)+" déclarées ("+signe(eff-R.poulesRef)+"). Faites un comptage."});
  if(prodOk&&isFinite(ponteV)){
    var pp=ponteV*100;
    if(pp<R.ponteMin-10)pts.push({n:2,t:"Ponte très basse : <b>"+Math.round(pp)+" %</b> (normal : au moins "+R.ponteMin+" %)."});
    else if(pp<R.ponteMin)pts.push({n:1,t:"Ponte basse : <b>"+Math.round(pp)+" %</b> (normal : au moins "+R.ponteMin+" %)."});
    var m7=ponteMoy7(null,d);if(isFinite(m7)&&m7>0&&ponteV<m7*0.9)pts.push({n:1,t:"La ponte a baissé de <b>"+pct(1-ponteV/m7)+"</b> par rapport aux 7 jours d'avant."});
  }
  if(!prodOk&&d<auj())pts.push({n:2,t:"Aucun ramassage saisi ce jour."});
  if(!alimOk&&d<auj())pts.push({n:1,t:"Aucun aliment saisi ce jour."});
  if(alimOk){
    if(sacs<R.sacsMin)pts.push({n:2,t:"<b>"+nb(sacs)+" sacs</b> donnés : moins que le minimum de "+nb(R.sacsMin)+" sacs."});
    else if(sacs>R.sacsMax)pts.push({n:2,t:"<b>"+nb(sacs)+" sacs</b> donnés : plus que le maximum de "+nb(R.sacsMax)+" sacs."});
    if(isFinite(g)){
      if(g<G_MIN)pts.push({n:1,t:"Ration faible : <b>"+Math.round(g)+" g</b> par poule. Une pondeuse a besoin de 110 à 125 g pour bien pondre."});
      else if(g>G_MAX)pts.push({n:1,t:"Ration très forte : <b>"+Math.round(g)+" g</b> par poule. Vérifiez les sacs ou le nombre de poules."});
      if(prodOk&&g>=110&&isFinite(ponteV)&&ponteV*100<R.ponteMin-10)pts.push({n:2,t:"Les poules mangent normalement mais la ponte est très basse : des œufs peuvent manquer au ramassage."});
    }
  }
  var st=stockAliment(d);if(st<0)pts.push({n:2,t:"On a donné <b>"+nb(-st)+" sacs</b> de plus que ce qui a été acheté : un achat d'aliment n'est pas saisi."});
  var so=stockOeufs(d);if(so<0)pts.push({n:2,t:"<b>"+nb(Math.ceil(-so/R.oeufsAlv))+" alvéoles</b> vendues de plus que ce qui a été ramassé : un ramassage n'est pas saisi."});
  if(poules>0&&mo/poules>0.002)pts.push({n:1,t:"<b>"+nb(mo)+" poules mortes</b> : plus que la normale (environ 1 pour 1 000 par jour)."});
  return {d:d,alv:alv,oeufs:oeufs,sacs:sacs,poules:poules,eff:eff,ponte:ponteV,g:g,prixS:prixS,coutAlim:coutAlim,valeur:valeur,reste:valeur-coutAlim,coutAlv:alv>0?coutAlim/alv:NaN,
    stockAlim:st,stockAlv:stockAlv(d),pts:pts.sort(function(a,b){return b.n-a.n}),etat:pts.some(function(p){return p.n===2})?2:pts.length?1:0,prodOk:prodOk,alimOk:alimOk};
}
var ETATS_CTRL=[["ok","Cohérent"],["att","À surveiller"],["alr","Incohérent"]];
function pastille(e){return '<span class="ctrl-p ctrl-'+ETATS_CTRL[e][0]+'">'+ETATS_CTRL[e][1]+'</span>'}
function carteControle(){
  if(!estDG())return "";
  var K=controleJour(auj()),H=controleJour(decal(auj(),-1)),e=Math.max(K.etat,H.etat),n=K.pts.length+H.pts.length,on=V.ouvertP==="ctrl";
  return '<button class="ctrl-carte ctrl-b'+e+(on?" on":"")+'" data-act="menuOuvrir" data-v="ctrl" aria-pressed="'+(on?"true":"false")+'"><span class="rub-ic">'+IC.loupe+'</span><span class="x"><b>Contrôle de cohérence</b><small>'+(n?n+" point"+(n>1?"s":"")+" à vérifier (aujourd'hui et hier)":"Les chiffres d'aujourd'hui et d'hier sont cohérents")+'</small></span>'+pastille(e)+'</button>';
}
function contenuControle(){
  var d=jourChoisi(),R=D.reglages,K=controleJour(d),h='';
  h+='<div class="temps-date"><button class="ico" data-act="bordJour" data-v="-1" aria-label="Jour d\'avant">'+ICO.retour+'</button><div><b>'+nomJour(d)+'</b><span>'+dComplete(d)+'</span></div><button class="ico" data-act="bordJour" data-v="1" aria-label="Jour d\'après" '+(d>=auj()?"disabled":"")+' style="transform:scaleX(-1)">'+ICO.retour+'</button></div>';
  var pp=isFinite(K.ponte)?Math.round(K.ponte*100):null,gg=isFinite(K.g)?Math.round(K.g):null;
  h+='<div class="ctrl-kpis">'+
    kCtrl(pp==null?"–":pp+" %","Taux de ponte","normal : "+R.ponteMin+" % et plus",pp==null?0:pp<R.ponteMin-10?2:pp<R.ponteMin?1:0)+
    kCtrl(K.alimOk?nb(K.sacs):"–","Sacs donnés","entre "+nb(R.sacsMin)+" et "+nb(R.sacsMax),!K.alimOk?0:(K.sacs<R.sacsMin||K.sacs>R.sacsMax)?2:0)+
    kCtrl(gg==null||!K.alimOk?"–":gg+" g","Aliment par poule","normal : 110 à 125 g",gg==null||!K.alimOk?0:(gg<G_MIN||gg>G_MAX)?1:0)+
    kCtrl(nb(K.poules),"Poules",K.eff>0?"déclarées : "+nb(R.poulesRef):"chiffre déclaré",K.eff>0&&Math.abs(K.eff-R.poulesRef)/R.poulesRef>0.03?1:0)+'</div>';
  h+='<h3 class="sous-t">Ce qu\'il faut vérifier</h3>';
  if(!K.pts.length)h+='<div class="ctrl-pt ctrl-ok">'+IC.ok+'<span>Tout est cohérent pour ce jour.</span></div>';
  else K.pts.forEach(function(p){h+='<div class="ctrl-pt ctrl-'+(p.n===2?"alr":"att")+'">'+IC.alerte+'<span>'+p.t+'</span></div>'});
  h+='<h3 class="sous-t">L\'argent du jour</h3><table class="t"><tbody>'+
    '<tr><td>Alvéoles ramassées × '+nb(R.prix)+'</td><td class="n">'+nb(K.alv)+' alv. = <b>'+gnf(K.valeur)+'</b></td></tr>'+
    '<tr><td>Aliment donné × '+nb(Math.round(K.prixS))+' le sac</td><td class="n">'+nb(K.sacs)+' sacs = <b>'+gnf(K.coutAlim)+'</b></td></tr>'+
    '<tr><td><b>Reste après l\'aliment</b></td><td class="n"><b'+(K.reste<0?' class="rouge"':'')+'>'+gnf(K.reste)+'</b></td></tr>'+
    '<tr><td>Aliment pour une alvéole</td><td class="n">'+(isFinite(K.coutAlv)?gnf(K.coutAlv):"–")+'</td></tr></tbody></table>';
  h+='<p class="aide">Les salaires, vaccins et autres dépenses ne sont pas comptés ici : ils sont dans le menu Dépenses.</p>';
  h+='<h3 class="sous-t">Ce qui doit rester en stock</h3><table class="t"><tbody>'+
    '<tr><td>Sacs d\'aliment (achetés − donnés)</td><td class="n"><b'+(K.stockAlim<0?' class="rouge"':'')+'>'+nb(K.stockAlim)+' sacs</b></td></tr>'+
    '<tr><td>Alvéoles (ramassées − cassées − vendues)</td><td class="n"><b>'+nb(K.stockAlv)+' alv.</b></td></tr></tbody></table>';
  h+='<p class="aide">Comptez ce qu\'il y a vraiment au magasin : s\'il y a moins, quelque chose est sorti sans être saisi.</p>';
  h+='<h3 class="sous-t">Les 7 derniers jours</h3><div class="defile"><table class="t ctrl-7"><thead><tr><th>Jour</th><th>Alv.</th><th>Ponte</th><th>Sacs</th><th>g/poule</th><th></th></tr></thead><tbody>';
  for(var i=0;i<7;i++){var j=decal(d,-i),C=controleJour(j);
    h+='<tr><td>'+dateCourte(j)+'</td><td class="n">'+(C.prodOk?nb(C.alv):"–")+'</td><td class="n">'+(C.prodOk&&isFinite(C.ponte)?Math.round(C.ponte*100)+" %":"–")+'</td><td class="n">'+(C.alimOk?nb(C.sacs):"–")+'</td><td class="n">'+(C.alimOk&&isFinite(C.g)?Math.round(C.g):"–")+'</td><td>'+pastille(C.etat)+'</td></tr>'}
  h+='</tbody></table></div>';
  h+='<p class="aide">Références : '+nb(R.poulesRef)+' poules, '+nb(R.sacsMin)+' à '+nb(R.sacsMax)+' sacs de '+nb(R.kgSac)+' kg par jour, '+gnf(R.prixSac)+' le sac, ponte d\'au moins '+R.ponteMin+' %. À changer dans Réglages → Ferme.</p>';
  return h;
}
function kCtrl(v,l,s,e){return '<div class="ctrl-k ctrl-b'+e+'"><b>'+v+'</b><span>'+l+'</span><small>'+s+'</small></div>'}
IC.loupe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 10.5l2 2 3.5-4"/></svg>';
