/* Faux Supabase pour les tests (mêmes règles que la vraie base, en plus simple).
   Base partagée entre les onglets via localStorage, « temps réel » via l'événement storage. */
(function(){
  var K="__mockdb";
  var LECTURE={comptages_poules:["dg","technicien","commercial"],mouvements_poules:["dg","technicien","commercial"],aliment_donne:["dg","technicien","commercial"],
    malades:["dg","technicien"],vaccins:["dg","technicien"],ramassages:["dg","commercial"],ventes:["dg","commercial"],paiements_credits:["dg","commercial"],depenses:["dg","commercial"],achats_aliment:["dg","commercial"],versements:["dg","commercial"]};
  var ECRITURE={comptages_poules:["dg","technicien"],mouvements_poules:["dg","technicien"],aliment_donne:["dg","technicien"]};
  function xhr(m,u,c){var x=new XMLHttpRequest();x.open(m,"http://127.0.0.1:8766"+u,false);if(c)x.setRequestHeader("content-type","application/json");x.send(c||null);return x.responseText?JSON.parse(x.responseText):null}
  function base(){var b=xhr("GET","/db");if(!b){b={t:{},profils:[],reglages:[{id:true,ferme:"Ferme avicole de M. Konaté",lieu:"Kankan",prix_alveole:47000,oeufs_par_alveole:30,objectif_alveoles:80,heures_ramassage:["08:00:00","12:00:00","14:00:00","18:00:00"],marge_retard_min:30,jours_cycle:15,debut_cycles:null,seuil_ponte:70,seuil_morts:5,seuil_aliment:5}],batiments:[{id:"B1",nom:"Bâtiment 1",court:"Bât. 1",ordre:1},{id:"B2",nom:"Bâtiment 2",court:"Bât. 2",ordre:2}],codes:{},essais:{},stock:{}};}
    Object.keys(LECTURE).forEach(function(t){b.t[t]=b.t[t]||[]});return b}
  function garder(b,evt){xhr("PUT","/db",JSON.stringify({db:b,evt:evt||[]}))}
  window.__mockBase=base;window.__mockGarder=garder;
  function aujd(){var z=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
  var hors=function(){return !!window.__horsLigne||localStorage.getItem("__hors")==="1"};
  var ERR_RESEAU={data:null,error:{message:"TypeError: Failed to fetch",code:""},status:0};
  var cle="fermeKonate.auth";
  function jeton(){try{var s=JSON.parse(localStorage.getItem(cle)||"null");return s&&s.access_token}catch(e){return null}}
  function moi(b){var t=jeton();if(!t)return null;var id=t.replace(/^tok-/,"");var p=b.profils.find(function(x){return x.id===id});return p&&!p.bloque&&!p.retire?p:null}
  function uid(){return crypto.randomUUID()}
  /* ---------- requêtes ---------- */
  function Requete(table){this.t=table;this.op="select";this.filtres=[];this.de=0;this.a=1e9}
  Requete.prototype.select=function(){if(this.op==="select")this.op="select";this.retour=true;return this};
  Requete.prototype.order=function(){return this};
  Requete.prototype.range=function(a,z){this.de=a;this.a=z;return this};
  Requete.prototype.eq=function(k,v){this.filtres.push([k,v]);return this};
  Requete.prototype.insert=function(row){this.op="insert";this.row=row;return this};
  Requete.prototype.update=function(p){this.op="update";this.patch=p;return this};
  Requete.prototype.then=function(ok,ko){var r;try{r=this.executer()}catch(e){r={data:null,error:{message:String(e),code:"XX000"},status:500}}var p=new Promise(function(res){setTimeout(function(){res(r)},15)});return p.then(ok,ko)};
  Requete.prototype.executer=function(){
    if(hors())return ERR_RESEAU;
    var b=base(),m=moi(b),t=this.t;
    if(!m)return {data:[],error:null,status:200};
    if(t==="profils"||t==="reglages"||t==="batiments"){
      var L=b[t];
      if(this.op==="select")return {data:L.slice(this.de,this.a+1),error:null,status:200};
      if(this.op==="update"){if(m.role!=="dg")return {data:[],error:null,status:200};var f=this.filtres,P=this.patch,out=[];
        L.forEach(function(x){if(f.every(function(q){return String(x[q[0]])===String(q[1])})){Object.assign(x,P);out.push(x)}});garder(b,out.map(function(x){return {table:t,new:x}}));return {data:out,error:null,status:200}}
    }
    var tab=b.t[t];
    if(this.op==="select"){if(LECTURE[t].indexOf(m.role)<0)return {data:[],error:null,status:200};return {data:tab.slice(this.de,this.a+1),error:null,status:200}}
    if(this.op==="insert"){
      if((ECRITURE[t]||["dg","commercial"]).indexOf(m.role)<0&&!(t==="malades"||t==="vaccins")||((t==="malades"||t==="vaccins")&&["dg","technicien"].indexOf(m.role)<0))
        return {data:null,error:{message:"new row violates row-level security policy",code:"42501"},status:403};
      var r=Object.assign({},this.row),a=aujd();
      if(tab.some(function(x){return x.id===r.id}))return {data:null,error:{message:'duplicate key value violates unique constraint "'+t+'_pkey"',code:"23505"},status:409};
      r.saisi_par=m.id;r.saisi_le=new Date().toISOString();r.annule=false;r.modifie_le=null;
      if(r.jour&&r.jour<a&&(m.role==="dg"||r.jour>=new Date(Date.now()-3*864e5).toISOString().slice(0,10)))r.apres_coup=true;else{r.jour=a;r.apres_coup=false}
      if(t==="ramassages"&&tab.some(function(x){return !x.annule&&x.jour===r.jour&&x.batiment_id===r.batiment_id&&x.numero===r.numero}))return {data:null,error:{message:"duplicate key value violates unique constraint \"ramassage_unique\"",code:"23505"},status:409};
      if(t==="depenses"&&r.categorie==="Salaires"&&!r.detail)return {data:null,error:{message:"check",code:"23514"},status:400};
      ["oeufs_plus","casses"].forEach(function(k){if(t==="ramassages"&&r[k]==null)r[k]=0});
      tab.push(r);garder(b,[{table:t,new:r}]);return {data:[r],error:null,status:201};
    }
    if(this.op==="update"){
      var f2=this.filtres,P2=this.patch,out2=[];
      tab.forEach(function(x){if(!f2.every(function(q){return String(x[q[0]])===String(q[1])}))return;
        var autorise=m.role==="dg"||((ECRITURE[t]||(t==="malades"||t==="vaccins"?["dg","technicien"]:["dg","commercial"])).indexOf(m.role)>=0&&x.saisi_par===m.id&&x.jour===aujd());
        if(!autorise)return;Object.assign(x,P2);if(P2.annule){x.annule_le=new Date().toISOString();x.annule_par=m.id}x.modifie_le=new Date().toISOString();out2.push(x)});
      garder(b,out2.map(function(x){return {table:t,new:x}}));return {data:out2,error:null,status:200};
    }
  };
  /* ---------- temps réel ---------- */
  var ecouteurs=[];
  function emettre(evts){evts.forEach(function(ev){ecouteurs.forEach(function(cb){try{cb({table:ev.table,new:JSON.parse(JSON.stringify(ev.new)),eventType:"UPDATE"})}catch(e){console.error(e)}})})}
  var vu=xhr("GET","/evt?n=0").n;
  setInterval(function(){if(hors()||!ecouteurs.length)return;var r=xhr("GET","/evt?n="+vu);vu=r.n;if(r.e.length)emettre(r.e)},300);
  /* ---------- fonction « acces » ---------- */
  var fetchOrig=window.fetch.bind(window);
  function rep(j,s){return Promise.resolve(new Response(JSON.stringify(j),{status:s||200,headers:{"Content-Type":"application/json"}}))}
  window.fetch=function(url,o){
    if(typeof url==="string"&&url.indexOf("/functions/v1/acces")>0){
      if(hors())return Promise.reject(new TypeError("Failed to fetch"));
      var c=JSON.parse(o.body),b=base(),a=c.action;window.__appels=(window.__appels||[]).concat([a]);
      if(a==="liste")return rep({ferme:b.reglages[0].ferme,lieu:b.reglages[0].lieu,equipe:b.profils.filter(function(p){return !p.bloque&&!p.retire}).map(function(p){return {id:p.id,nom:p.nom,role:p.role}})});
      if(a==="entrer"){var p=b.profils.find(function(x){return x.id===c.id});if(!p||p.retire)return rep({erreur:"Code incorrect."},401);if(p.bloque)return rep({erreur:"Accès bloqué par le DG.",bloque:true},403);
        if(b.codes[p.id]!==c.code){b.essais[p.id]=(b.essais[p.id]||0)+1;garder(b);var rest=5-b.essais[p.id];return rest<=0?rep({erreur:"Trop d'essais. Réessayez dans 15 minutes.",secondes:900},429):rep({erreur:"Code incorrect.",restant:rest},401)}
        b.essais[p.id]=0;garder(b);return rep({session:{access_token:"tok-"+p.id,refresh_token:"ref-"+p.id,expires_at:Date.now()/1000+3600},profil:{id:p.id,nom:p.nom,role:p.role,code_a_changer:!!p.code_a_changer}})}
      var h=(o.headers&&o.headers.Authorization||"").replace("Bearer ",""),qui=b.profils.find(function(x){return "tok-"+x.id===h});
      if(!qui||qui.role!=="dg"||qui.bloque)return rep({erreur:"Réservé au DG."},403);
      var faible=function(k){return !/^\d{6}$/.test(k)||/^(\d)\1{5}$/.test(k)||k==="123456"||k==="654321"};
      if(a==="ajouter"){if(faible(c.code))return rep({erreur:"Ce code est trop facile à deviner."},400);var id=uid();b.profils.push({id:id,nom:c.nom,role:c.role,bloque:false,retire:false,code_a_changer:false});b.codes[id]=c.code;garder(b,[{table:"profils",new:b.profils[b.profils.length-1]}]);return rep({ok:true,id:id})}
      var cib=b.profils.find(function(x){return x.id===c.id});if(!cib)return rep({erreur:"Personne inconnue."},404);
      if(a==="changer_code"){if(faible(c.code))return rep({erreur:"Ce code est trop facile à deviner."},400);b.codes[cib.id]=c.code;if(cib.id===qui.id)cib.code_a_changer=false;garder(b,[{table:"profils",new:cib}]);return rep({ok:true})}
      if(cib.role==="dg")return rep({erreur:"Le DG ne peut pas être bloqué ni retiré."},400);
      if(a==="bloquer"){cib.bloque=c.bloque!==false;garder(b,[{table:"profils",new:cib}]);return rep({ok:true,bloque:cib.bloque})}
      if(a==="retirer"){cib.retire=true;cib.bloque=true;garder(b,[{table:"profils",new:cib}]);return rep({ok:true})}
      return rep({erreur:"Action inconnue."},400);
    }
    return fetchOrig(url,o);
  };
  /* ---------- client ---------- */
  window.supabase={createClient:function(){
    var abo=[];
    var auth={
      getSession:function(){var t=jeton();return Promise.resolve({data:{session:t?{access_token:t}:null},error:null})},
      setSession:function(s){localStorage.setItem(cle,JSON.stringify(s));abo.forEach(function(f){f("SIGNED_IN",s)});return Promise.resolve({data:{session:s},error:null})},
      refreshSession:function(){if(hors())return Promise.reject(new TypeError("Failed to fetch"));var b=base();return Promise.resolve(moi(b)?{data:{},error:null}:{data:{},error:{message:"Invalid Refresh Token: banned"}})},
      signOut:function(){localStorage.removeItem(cle);return Promise.resolve({error:null})},
      onAuthStateChange:function(f){abo.push(f);return {data:{subscription:{unsubscribe:function(){}}}}}
    };
    return {auth:auth,
      from:function(t){return new Requete(t)},
      rpc:function(f,args){var q={then:function(ok,ko){var r;if(hors())r=ERR_RESEAU;else{var b=base(),m=moi(b);
        if(f==="marquer_rappel_fait"){if(!m||["dg","technicien"].indexOf(m.role)<0)r={data:null,error:{message:"Réservé",code:"42501"},status:403};else{var v=b.t.vaccins.find(function(x){return x.id===args.p_id});if(v){v.rappel_fait=true;garder(b,[{table:"vaccins",new:v}])}r={data:!!v,error:null,status:200}}}}
        return new Promise(function(res){setTimeout(function(){res(r)},15)}).then(ok,ko)}};return q},
      storage:{from:function(){return {
        upload:function(path,blob){if(hors())return Promise.reject(new TypeError("Failed to fetch"));var b=base();b.stock[path]=blob.size;garder(b);window.__uploads=(window.__uploads||[]).concat([path]);return Promise.resolve({data:{path:path},error:null})},
        createSignedUrls:function(L){var b=base();return Promise.resolve({data:L.map(function(p){return {path:p,signedUrl:b.stock[p]?"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23cc8844'/%3E%3C/svg%3E":null}}),error:null})}
      }}},
      channel:function(){var ch={on:function(a,b,cb){ecouteurs.push(cb);return ch},subscribe:function(cb){setTimeout(function(){cb("SUBSCRIBED")},20);return ch}};return ch},
      removeChannel:function(){ecouteurs=[]}
    };
  }};
})();
