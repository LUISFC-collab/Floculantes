
/* ===================== MOTOR .XER (modelo, escritura, fechas, cabecera, validacion, auditoria y UI) ===================== */
/* ============================================================================
   MOTOR .xer DE "Floculantes" \u2014 PARTE DEL AGENTE M
   ----------------------------------------------------------------------------
   Cuatro funciones, completas y listas para pegar en index.html:

     1. _crXerRefresco(c)            etapa 1 del contrato (refresco duro)
     2. _crXerModelo(c,opt)          etapa 2 (el modelo, con los numeros de la TABLA)
     3. _crXerEscribe(lineas,modelo) etapa 4 (TASK / TASKRSRC / RSRC / PROJWBS)
     4. _crXerAuditoria(lineas,modelo) etapa 8 (auditoria campo a campo)

   Mas los auxiliares que necesitan, todos con prefijo _crXerM* para no chocar
   con nada de index.html ni con lo que escriba el agente F.

   Estilo ES5 como el resto del archivo: var, sin let/const, sin funciones
   flecha, sin plantillas de cadena, sin encadenamiento opcional.

   Principio rector: los numeros salen de _crTablaDatos(c) (la TABLA del
   alcance). Nada se recalcula por otro camino, para que el archivo cuadre
   EXACTAMENTE con lo que el usuario ve en la tabla.
   ========================================================================== */


/* ==========================================================================
   0. AUXILIARES
   ========================================================================== */

/* redondeo a 2 decimales, el unico que se usa en todo el motor */
function _crXerM2(x){var n=Number(x);if(!isFinite(n))return 0;return Math.round(n*100)/100}

/* un numero para un campo del .xer: sin notacion exponencial (P6 lee el campo
   con un parser de punto decimal a secas y un "1e-7" se lo traga como 0) y sin
   ceros de relleno inutiles */
function _crXerMNum(x,dec){
  var n=Number(x);if(!isFinite(n))n=0;
  dec=(dec==null)?2:dec;
  if(Math.abs(n)<Math.pow(10,-dec)/2)n=0;
  var s=n.toFixed(dec);
  if(s.indexOf('.')>=0)s=s.replace(/0+$/,'').replace(/\.$/,'');
  if(s==='-0'||s==='')s='0';
  return s}

/* el valor de un campo de texto del .xer: sin tabuladores ni saltos de linea
   (partirian la fila en mas campos que los que declara su %F y P6 rechaza el
   archivo entero) y recortado al ancho del campo en P6.
   OJO: aqui NO se llama a _crPlano. El aplanado (tildes, comillas dobladas) lo
   aplica _crBytes UNA sola vez sobre el texto entero al descargar; hacerlo
   tambien aqui doblaba las comillas dos veces y toda actividad con pulgadas
   ('1"') salia marcada como renombrada en cada exportacion. */
function _crXerMTx(s,max){
  var x=String(s==null?'':s);
  x=x.replace(/[\t\r\n\v\f]+/g,' ').replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'');
  if(max>0)x=x.slice(0,max);
  return x}

/* normalizacion para comparar rutas y nombres de WBS */
function _crXerMNrm(s){
  if(typeof _crNrm==='function')return _crNrm(s);
  var x=String(s==null?'':s);
  try{x=x.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(_e){}
  return x.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').replace(/^\s+|\s+$/g,'')}

/* solo la parte de fecha de un valor del .xer ("2026-09-18 07:00" -> "2026-09-18") */
function _crXerMFec(s){
  if(typeof _crFec==='function')return _crFec(s);
  var x=String(s==null?'':s).replace(/^\s+|\s+$/g,'');return x?x.slice(0,10):''}

/* fecha + hora, con el mismo formato que ya usa el exportador */
function _crXerMFecH(iso,hora){return iso?(String(iso).slice(0,10)+' '+hora):''}

/* la hora a la que CIERRA la jornada, deducida de las horas por dia del
   calendario: apertura 07:00 y una hora de refrigerio a partir de 5 h de
   trabajo (10 h -> 18:00, 8 h -> 16:00). Es la misma aritmetica de
   _crXerHoraFin, puesta aparte para no depender del orden de pegado. */
function _crXerMCierre(hpd,horaIni){
  var h=Number(hpd)||0;if(!(h>0))h=10;
  var ab=7;
  var s=String(horaIni||'07:00');
  if(/^\d{1,2}:\d{2}$/.test(s))ab=Number(s.split(':')[0])+Number(s.split(':')[1])/60;
  var t=ab+h+((h>5)?1:0);
  if(t>23.99)t=23.99;
  var hh=Math.floor(t),mm=Math.round((t-hh)*60);if(mm===60){hh++;mm=0}
  return (hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm}

/* GUID con la pinta de los de P6, DETERMINISTA a partir de una semilla: dos
   exportaciones seguidas sin tocar nada tienen que dar el mismo archivo, y P6
   tiene que reconocer la actividad en vez de crear una nueva cada vez.
   El caracter 22 de un base64 de 16 bytes solo lleva 2 bits utiles: A Q g w. */
function _crXerMGuid(semilla){
  var A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',o='';
  var s=String(semilla==null?'':semilla);
  if(!s){
    for(var i=0;i<21;i++)o+=A.charAt(Math.floor(Math.random()*64));
    return o+'AQgw'.charAt(Math.floor(Math.random()*4))}
  var h1=2166136261>>>0,h2=2654435761>>>0;
  for(var j=0;j<s.length;j++){
    h1=(((h1^s.charCodeAt(j))>>>0)*16777619)>>>0;
    h2=(((h2^(s.charCodeAt(j)+j))>>>0)*2246822519)>>>0}
  for(var k=0;k<21;k++){
    h1=((h1*1103515245)+12345)>>>0;
    h2=(h2^(h1>>>7))>>>0;
    o+=A.charAt((h1^h2)&63)}
  return o+'AQgw'.charAt((h1^h2)&3)}

/* Las HH que una tarea se GANA de una partida repartida entre varias.
   Es _crGanadas con la lista de actividades pasada a mano: cuando algunas
   actividades programan un apartado concreto (_cpFaseDe) esas salen del
   reparto, y _crGanadas -que lee reparto._orden- repartiria entre todas y
   perderia horas. Con la lista completa da exactamente lo mismo que hoy. */
function _crXerMGana(lista,cod,hhTot,frac,cfg){
  var hh=Number(hhTot)||0,f=Math.min(1,Math.max(0,Number(frac)||0));
  var L=(lista||[]).slice(),n=L.length||1,trozo=hh/n;
  if(n<2)return trozo*f;
  if(cfg&&cfg.modo==='dividir')return trozo*f;
  if(cfg&&cfg.primero&&L.indexOf(cfg.primero)>=0)
    L=[cfg.primero].concat(L.filter(function(z){return z!==cfg.primero}));
  var k=L.indexOf(cod);if(k<0)k=0;
  return Math.max(0,Math.min(trozo,hh*f-k*trozo))}

/* Las LINEAS que la tabla del alcance ensena para una partida: una por
   apartado si los tiene (mas la de "Resto de la partida" cuando los apartados
   no cubren la partida entera), o la propia partida si no.
   Es la misma funcion `vis` de _crTablaHTML (linea ~21598): el TOTAL de la
   tabla es la suma de ESTAS lineas, asi que el .xer tiene que salir de ellas
   y no de las columnas de la cabecera de la partida. */
function _crXerMLineas(r){
  if(!(r&&r.partes&&r.partes.length))return [r];
  var L=r.partes.map(function(x,j){
    var m={},k;
    for(k in r)if(k!=='partes')m[k]=r[k];
    for(k in x)m[k]=x[k];
    m._np=j+1;return m});
  var K=['costo','costoC','dCosto','hhC','hh','hhM','costoM','hhA','costoA','hhAM','costoAM'];
  var KB={costo:1,costoC:1,dCosto:1,hhC:1,hh:1},resto={},hay=false;
  K.forEach(function(k){
    var sm=0;L.forEach(function(m){sm+=Number(m[k])||0});
    var d=Math.round(((Number(r[k])||0)-sm)*100)/100;
    resto[k]=(d>0)?d:0;
    if(d>0.05&&KB[k])hay=true});
  /* EL ACTUAL DEL RESTO (el cuadre con la Tabla 2 que pidio el usuario):
     _crTablaDatos machaca r.hhA con la SUMA de los apartados (22660-22663), asi
     que "Resto de la partida" salia siempre con hhA = r.hhA - suma = 0 y el
     .xer decia MENOS avance que la Tabla 2, que reparte cuenta x
     _crFracHechaAt sobre la partida ENTERA. Se le da al resto la misma
     fraccion que llevan los apartados, que es exactamente lo que la Tabla 2
     pinta en su propia fila "Resto de la partida".
     Algebra: suma_lineas hhA = suma(h_k r_k) + (cuenta - suma h_k) x
     (suma(h_k r_k)/suma h_k) = cuenta x frac = la Tabla 2. */
  if(hay){
    var _hT9=0,_hA9=0,_cT9=0,_cA9=0;
    L.forEach(function(m){_hT9+=Number(m.hh)||0;_hA9+=Number(m.hhA)||0;
      _cT9+=Number(m.costoC)||0;_cA9+=Number(m.costoA)||0});
    var _fH9=(_hT9>0)?(_hA9/_hT9):0,_fC9=(_cT9>0)?(_cA9/_cT9):0;
    if(!(_fH9>0))_fH9=0;if(_fH9>1)_fH9=1;
    if(!(_fC9>0))_fC9=0;if(_fC9>1)_fC9=1;
    resto.hhA=Math.round((Number(resto.hh)||0)*_fH9*100)/100;
    resto.costoA=Math.round((Number(resto.costoC)||0)*_fC9*100)/100;
    resto.hhAM=resto.hhA;resto.costoAM=resto.costoA}
  if(hay){
    var m2={},k3;
    for(k3 in r)if(k3!=='partes')m2[k3]=r[k3];
    K.forEach(function(k){m2[k]=resto[k]});
    /* el resto nunca lleva mayor metrado: sus columnas (MM) repiten forecast/actual */
    m2.hhM=m2.hh;m2.costoM=m2.costoC;m2.hhAM=m2.hhA;m2.costoAM=m2.costoA;
    m2.pert='Resto de la partida';
    m2.met=null;m2.metF=null;m2.metM=null;m2.metA=null;m2.metAM=null;
    m2.av=null;m2.pu=null;m2.hhu=null;m2.pct=null;m2.metR=null;m2.metRF=null;m2.hhR=null;m2.hhRF=null;m2.costoR=null;m2.costoRF=null;m2.rendQ=null;m2.rend=null;m2.durC=null;m2.durF=null;m2.durM=null;m2.durR=null;m2.dur=null;m2.ret='';m2.apOff='';
    m2._np=L.length+1;L.push(m2)}
  return L}

/* los cuatro numeros de una linea de la tabla, segun se pidio o no "mayor
   metrado": con MM mandan hhM/costoM y hhAM/costoAM; sin MM, hh/costoC y
   hhA/costoA. Son exactamente las columnas que el usuario ve. */
function _crXerMValores(m,mm){
  /* sin redondear: la tabla suma sus lineas exactas (v20260918d5) y el TOTAL
     del archivo tiene que ser ese mismo numero; cada tarea se redondea al escribirla */
  var n=function(x){var v=Number(x);return isFinite(v)?v:0};
  return {
    hhT:n(mm?m.hhM:m.hh),
    hhA:n(mm?m.hhAM:m.hhA),
    costoT:n(mm?m.costoM:m.costoC),
    costoA:n(mm?m.costoAM:m.costoA)}}

/* cuadra la suma de un campo de una lista de tareas con un objetivo exacto:
   al redondear tarea a tarea a 2 decimales el total se desvia unos centimos
   del TOTAL de la tabla, y el usuario pidio que cuadre EXACTAMENTE. Solo se
   absorbe la deriva del redondeo; una diferencia grande es una perdida real y
   tiene que salir en sinArchivo, no taparse aqui. */
function _crXerMCuadra(L,campo,objetivo){
  var s=0;L.forEach(function(m){s+=Number(m[campo])||0});
  s=_crXerM2(s);
  var d=_crXerM2(Number(objetivo)-s);
  if(!d)return 0;
  var tope=Math.max(0.05,L.length*0.005+0.01);
  if(Math.abs(d)>tope)return 0;
  var best=null;
  /* la tarea elegida tiene que ADMITIR el ajuste: el clamp que viene despues
     (if(m.hhA>m.hhT)m.hhA=m.hhT) deshacia el cuadre de hhA/costoA cuando la
     mas grande ya estaba al 100 % (X3 H8). Si ninguna lo admite se vuelve a la
     regla de antes, que al menos deja el desvio en la mayor. */
  var tope9=(campo==='hhA')?'hhT':((campo==='costoA')?'costoT':'');
  L.forEach(function(m){
    if(tope9&&((Number(m[campo])||0)+d)>(Number(m[tope9])||0)+1e-9)return;
    if(!best||(Number(m[campo])||0)>(Number(best[campo])||0))best=m});
  if(!best&&tope9)L.forEach(function(m){if(!best||(Number(m[campo])||0)>(Number(best[campo])||0))best=m});
  if(!best)return 0;
  var v=_crXerM2((Number(best[campo])||0)+d);
  if(v<0)v=0;
  best[campo]=v;
  return d}

/* miles con apostrofo y dos decimales, como pidio el usuario: 7'778.29 */
function _crXerMil(x){
  var n=Number(x);if(!isFinite(n))n=0;
  var s=n.toFixed(2);
  if(typeof _nMil==='function')return _nMil(s);
  var neg=(s.charAt(0)==='-');if(neg)s=s.slice(1);
  var q=s.split('.');
  return (neg?'-':'')+q[0].replace(/\B(?=(\d{3})+(?!\d))/g,"'")+'.'+q[1]}

/* las horas por dia del calendario por defecto del .xer */
function _crXerMHpd(T){
  try{
    var cal=T&&T.CALENDAR,h=0;
    if(cal&&cal.filas&&cal.filas.length){
      cal.filas.forEach(function(f){
        if(!h&&String(f.o.default_flag||'').replace(/^\s+|\s+$/g,'')==='Y')h=Number(f.o.day_hr_cnt)||0});
      if(!(h>0))h=Number(cal.filas[0].o.day_hr_cnt)||0}
    return (h>0)?h:8}
  catch(_e){return 8}}

/* el calendario por defecto del .xer, para las actividades nuevas */
function _crXerMClndr(T){
  try{
    var cal=T&&T.CALENDAR;if(!cal||!cal.filas||!cal.filas.length)return '';
    var id='';
    cal.filas.forEach(function(f){
      if(!id&&String(f.o.default_flag||'').replace(/^\s+|\s+$/g,'')==='Y')id=String(f.o.clndr_id||'')});
    return id||String(cal.filas[0].o.clndr_id||'')}
  catch(_e){return ''}}


/* ==========================================================================
   1. REFRESCO DURO - etapa 1 del contrato
   --------------------------------------------------------------------------
   Un .xer que se entrega no puede salir de caches de esta pestana. Se sube lo
   pendiente, se relee TODO del servidor, se tiran los memos de HH y se avisa
   de lo que quedo sin subir.

   No hay catch mudo: solo se tragan (y se avisan en `avisos`) los fallos de
   RED que no impiden exportar, porque con lo que hay en el equipo el archivo
   todavia sale. Lo que si impide exportar -no poder leer las actividades del
   cronograma- se lanza: sin ellas el .xer saldria con TODAS las HH en cero.
   ========================================================================== */
async function _crXerRefresco(c){
  if(!c||!c.cron_id)throw new Error('no se dijo que cronograma exportar');
  var cronId=String(c.cron_id),avisos=[],t0=Date.now();
  var red=function(que,e){
    avisos.push(que+': '+String((e&&e.message)||e));
    try{console.warn('[xer refresco] '+que,e)}catch(_e){}};

  /* --- 1. lo mio primero: si no, el archivo lleva algo que nadie mas tiene --- */
  if(typeof syncNow==='function'){
    try{await syncNow(true)}catch(e){red('no se pudo subir lo pendiente',e)}}

  /* --- 2. y luego lo de los demas (syncPull arrastra partes, retiros, fases,
         APU, cron_trabajo y relaciones segun como este cableado) --- */
  if(typeof syncPull==='function'){
    try{await syncPull()}catch(e){red('no se pudo releer del servidor',e)}}

  /* --- 3. fuera los caches del cronograma y todos los memos de HH --- */
  try{if(typeof _crInvalida==='function')_crInvalida(cronId);
      if(window._crTar)delete window._crTar[cronId];
      if(window._crAl)delete window._crAl[cronId];
      if(window._crAlT)delete window._crAlT[cronId];
      if(window._crAgr)delete window._crAgr[cronId];
      window._crCacheT=0;window._crCatT=0;window._crCatIx=null;
      window._hhCache=null;window._crEnT=null;window._crHechoMemo=null;
      window._pgUniv=null;window._ctAct=undefined;
      if(window._agCronCargado===cronId)window._agCronCargado=null;
      if(typeof _hhMemoTira==='function')_hhMemoTira()}
  catch(e){throw new Error('no se pudieron limpiar los datos en memoria: '+((e&&e.message)||e))}

  /* --- 4. y se vuelve a leer todo de la base, en paralelo --- */
  var tareas1a=function(nom,fn){
    return Promise.resolve().then(fn).then(function(r){return r},function(e){red('no se pudo releer '+nom,e);return null})};
  var P=[];
  P.push(tareas1a('la lista de cronogramas',function(){return (typeof _crPull==='function')?_crPull():null}));
  P.push(tareas1a('el catalogo de partidas',function(){return (typeof _crCatPull==='function')?_crCatPull():null}));
  P.push(tareas1a('las actividades del cronograma',function(){return _crTareas(cronId)}));
  P.push(tareas1a('el alcance del cronograma',function(){return _crAlc(cronId)}));
  P.push(tareas1a('las relaciones',function(){return (typeof _rlPull==='function')?_rlPull(cronId):null}));
  P.push(tareas1a('la configuracion de trabajo',function(){return (typeof _ctPull==='function')?_ctPull():null}));
  P.push(tareas1a('los rendimientos por actividad',function(){return (typeof _cnPull==='function')?_cnPull():null}));
  P.push(tareas1a('el reparto de partidas',function(){return (typeof _cpPull==='function')?_cpPull():null}));
  P.push(tareas1a('los saldos retirados',function(){return (typeof _retPull==='function')?_retPull():null}));
  P.push(tareas1a('los apartados (fases)',function(){return (typeof _fzPull==='function')?_fzPull():null}));
  P.push(tareas1a('los APU',function(){return (typeof _apuPull==='function')?_apuPull():null}));
  P.push(tareas1a('las agrupaciones',function(){return (typeof _agDe==='function')?_agDe(cronId):null}));
  var res=await Promise.all(P);
  var tar=res[2];

  /* los mapas del cronograma (nombres y mapeo guardados) */
  if(typeof _crMapasDe==='function'){
    try{await _crMapasDe(cronId)}catch(e){red('no se pudieron releer los mapas del cronograma',e)}}

  /* --- 5. la configuracion recien bajada cambia las HH: memos otra vez fuera --- */
  try{window._hhCache=null;window._crEnT=null;window._crCatIx=null;window._crHechoMemo=null;
      if(typeof _hhMemoTira==='function')_hhMemoTira()}catch(_e5){}

  /* --- 6. lo que NO se puede dejar pasar --- */
  if(!tar){tar=await _crTareas(cronId)}
  if(!tar||!tar.length)
    throw new Error('no se pudieron leer las actividades del cronograma '+cronId+
      ': sin ellas el .xer saldria con todas las HH en cero. Revisa la conexion y vuelve a intentarlo.');
  var cat=null;try{cat=(typeof _crPartidas==='function')?_crPartidas():null}catch(_e6){cat=null}
  if(!cat||!cat.length)
    throw new Error('no se pudo leer el catalogo de partidas: sin el, el .xer saldria con las HH de otro sitio');

  /* la cabecera VIGENTE del cronograma (etiqueta y tipo pueden haber cambiado) */
  var cVig=null;
  try{if(typeof _crLista==='function')
    cVig=_crLista().filter(function(x){return String(x.cron_id)===cronId})[0]||null}catch(_e7){}

  var pend=0;
  try{pend=(typeof pendingCount==='function')?(Number(pendingCount())||0):0}catch(_e8){pend=0}

  return {pendientes:pend,c:cVig||c,tareas:tar.length,avisos:avisos,ms:(Date.now()-t0)}}


/* ==========================================================================
   2. EL MODELO - etapa 2 del contrato
   --------------------------------------------------------------------------
   Todo lo que el .xer tiene que decir, sacado de la TABLA del alcance
   (_crTablaDatos) y de las tareas, relaciones y titulos del aplicativo.
   Ninguna otra etapa vuelve a calcular un numero.

   opt = { modo:'tal'|'rep', mm:false|true, corte:'YYYY-MM-DD', sem:n,
           alcLive:objeto|null, lineas:[..]|null, crudo:'...'|null }
   ========================================================================== */
async function _crXerModelo(c,opt){
  opt=opt||{};
  if(!c||!c.cron_id)throw new Error('no se dijo que cronograma exportar');
  var cronId=String(c.cron_id);
  var modo=String(opt.modo||'rep');
  var mm=!!opt.mm;
  var hoy=(typeof todayISO==='function')?todayISO():'';
  var corte=String(opt.corte||hoy||'');
  var sem=Number(opt.sem)||0;
  var avisos=[];

  /* ---- el .xer crudo: de ahi salen el tipo de cada tarea (hito/LOE), el
         calendario y las fechas contra las que se mide `movida` ---- */
  var lineas=null;
  if(opt.lineas&&opt.lineas.length)lineas=opt.lineas;
  else if(opt.crudo!=null&&opt.crudo!=='')lineas=String(opt.crudo).split(/\r?\n/);
  else{
    var fila=await sbSelect(T_CRO,'select=crudo&proyecto=eq.'+encodeURIComponent(DATA.proyecto)+
      '&cron_id=eq.'+encodeURIComponent(cronId)+'&limit=1');
    var crudo=(fila&&fila[0]&&fila[0].crudo)||'';
    if(!crudo)throw new Error('el cronograma '+cronId+' no guardo su archivo original: vuelve a cargar el .xer');
    lineas=String(crudo).split(/\r?\n/)}
  var T=_crXerTablas(lineas);
  var TAx=T.TASK;
  if(!TAx||!TAx.cs.length)throw new Error('el .xer guardado no trae la tabla TASK: no se puede exportar');
  var hpd=_crXerMHpd(T);
  var horaIni=String(opt.horaIni||'07:00');
  var horaFin=String(opt.horaFin||_crXerMCierre(hpd,horaIni));

  /* la fila TASK del archivo por codigo, en MAYUSCULAS: P6 no distingue caja en
     el Activity ID y la app tampoco al validar; si el indice distingue, se
     escriben dos filas con el mismo codigo y P6 rechaza la importacion */
  var enXer={};
  TAx.filas.forEach(function(f){enXer[_crTx(f.o.task_code).toUpperCase()]=f});
  /* las HH REALES que ya trae el archivo, para el modo "tal cual": P6 las suma
     de las asignaciones LABOR (regular + sobretiempo) */
  var trLab={};
  (function(){
    var RSx=T.RSRC,TRx=T.TASKRSRC,tip={};
    if(RSx&&RSx.filas)RSx.filas.forEach(function(f){tip[String(f.o.rsrc_id||'')]=String(f.o.rsrc_type||'RT_Labor')});
    if(!TRx||!TRx.filas)return;
    TRx.filas.forEach(function(x){
      var tp=String(x.o.rsrc_type||'')||tip[String(x.o.rsrc_id||'')]||'RT_Labor';
      if(tp!=='RT_Labor')return;
      var k=String(x.o.task_id);
      trLab[k]=(trLab[k]||0)+(Number(x.o.act_reg_qty)||0)+(Number(x.o.act_ot_qty)||0)})})();

  /* ---- la TABLA: de aqui salen TODOS los numeros ---- */
  var D=await _crTablaDatos(c,(opt&&opt.corte)||null);   /* la foto de la tabla al corte pedido */
  if(!D||!D.filas)throw new Error('no se pudo armar la tabla del alcance del cronograma '+cronId);

  /* ---- las actividades, el reparto y la programacion ---- */
  var tar=await _crTareas(cronId);
  if(!tar||!tar.length)throw new Error('el cronograma '+cronId+' no tiene actividades leidas');
  var alc=opt.alcLive||await _crAlc(cronId);
  var rp=_crReparto(tar);
  var prog={};
  try{prog=_rlPrograma(cronId,tar,alc)||{}}
  catch(e){throw new Error('no se pudo programar el cronograma con sus relaciones: '+((e&&e.message)||e))}

  /* las actividades DADAS DE BAJA en el aplicativo: hay que quitarlas del .xer,
     con su asignacion y sus predecesoras, o P6 las revive al importar */
  var vivasCod={};tar.forEach(function(t){vivasCod[String(t.task_code||'').toUpperCase()]=1});
  var tumbas=[];
  try{
    tumbas=(await sbSelect(T_CRT,'select=task_code,nombre,wbs,orden,tipo&proyecto=eq.'+
      encodeURIComponent(DATA.proyecto)+'&cron_id=eq.'+encodeURIComponent(cronId)+
      '&eliminado=is.true&limit=5000'))||[]}
  catch(e){avisos.push('no se pudieron leer las actividades borradas ('+String((e&&e.message)||e)+
    '): el .xer podria salir con alguna que ya no va')}
  tumbas=tumbas.filter(function(r){return r&&r.task_code&&!vivasCod[String(r.task_code).toUpperCase()]});

  /* ---- indices de la tabla ---- */
  var filaDe={},lineasDe={};
  D.filas.forEach(function(r){filaDe[r.id]=r;lineasDe[r.id]=_crXerMLineas(r)});

  /* que actividades reclaman cada partida, en el orden del reparto (por fecha
     de inicio, que es como _crGanadas consume lo ejecutado) */
  var reclaman={};
  if(rp&&rp._orden)Object.keys(rp._orden).forEach(function(i){
    var vistos={},L=[];
    (rp._orden[i]||[]).forEach(function(cod){if(vistos[cod])return;vistos[cod]=1;L.push(cod)});
    reclaman[i]=L});
  tar.forEach(function(t){(t.items||[]).forEach(function(i){
    if(!reclaman[i])reclaman[i]=[String(t.task_code)];
    else if(reclaman[i].indexOf(String(t.task_code))<0)reclaman[i].push(String(t.task_code))})});

  /* el apartado (fase) que programa cada actividad, resuelto a NOMBRE: la
     tabla identifica sus lineas de apartado por el nombre de la fase */
  var faseNom=function(item,cod){
    var fid='';
    try{fid=(typeof _cpFaseDe==='function')?_cpFaseDe(cronId,item,cod):''}catch(_e){fid=''}
    if(!fid)return '';
    var nom='';
    try{var fz=(typeof _fzDe==='function')?_fzDe(item,cronId):null;
      ((fz&&fz.fases)||[]).forEach(function(x){if(String(x.id)===String(fid))nom=String(x.nombre||'')})}
    catch(_e2){}
    return nom};

  /* ---- el esqueleto de cada tarea ---- */
  var M={},ordenCod=[];
  tar.forEach(function(t){
    var cod=String(t.task_code||'');if(!cod)return;
    var fx=enXer[cod.toUpperCase()]||null;
    var tipoX=fx?String(fx.o.task_type||'TT_Task'):'TT_Task';
    var o=prog[cod]||{};
    var iniX=fx?_crXerMFec(fx.o.target_start_date||fx.o.early_start_date||fx.o.act_start_date):'';
    var finX=fx?_crXerMFec(fx.o.target_end_date||fx.o.early_end_date||fx.o.act_end_date):'';
    var ini=String(o.ini||t.ini||'');
    var fin=String(o.fin||t.fin||ini);
    var mov=false;
    if(fx){mov=(!!ini&&ini!==iniX)||(!!fin&&fin!==finX)}
    else mov=true;   /* la que no esta en el archivo es, por definicion, nueva */
    if(!mov&&o.movida)mov=true;
    if(o.manIgnorada)avisos.push(cod+': la fecha puesta a mano ('+o.manIgnorada.ini+(o.manIgnorada.fin?(' \u2192 '+o.manIgnorada.fin):'')+') no manda porque la actividad tiene predecesoras; sale con la que le imponen ('+ini+' \u2192 '+fin+')');
    /* "tal cual": el real que trae el archivo NO se toca; solo cambia el
       presupuesto y el remanente pasa a ser lo que le falta a ese real */
    var xA=0,xPct=null,xSt='',xIR='',xFR='';
    if(modo==='tal'&&fx){
      xA=Number(fx.o.act_work_qty)||0;
      if(trLab[String(fx.o.task_id)]!=null)xA=trLab[String(fx.o.task_id)];
      xPct=Number(fx.o.phys_complete_pct)||0;
      xSt=String(fx.o.status_code||'').replace('TK_','');
      xIR=_crXerMFec(fx.o.act_start_date);xFR=_crXerMFec(fx.o.act_end_date)}
    var m={
      cod:cod,
      nombre:String(t.nombre||''),
      wbs:String(t.wbs||''),
      orden:Number(t.orden)||0,
      tipo:fx?'xer':'app',
      eliminado:false,
      items:(t.items||[]).slice(),
      hhT:0,hhA:0,hhR:0,costoT:0,costoA:0,costoR:0,
      hhIgnorada:0,costoIgnorado:0,
      pct:0,estado:'NotStart',
      iniReal:'',finReal:'',
      ini:ini,fin:fin,iniRem:'',
      hito:(tipoX==='TT_Mile'||tipoX==='TT_FinMile'),
      loe:(tipoX==='TT_LOE'||tipoX==='TT_WBS'),
      taskType:tipoX,
      movida:mov,
      informativa:(!((t.items||[]).length)&&!(fx&&(((Number(fx.o.target_work_qty)||0)>0)||((Number(fx.o.act_work_qty)||0)>0)))),   /* con HH en el archivo y sin partidas: se vacia, no se respeta */
      /* la regla del remanente: el alcance de la actividad y su % fisico se
         calculan mas abajo, con las filas de la tabla de sus partidas */
      alcance:true,motivoSinAlcance:'',partidasFuera:[],pctFis:null,
      pctTarea:Math.max(0,Math.min(100,Number(t.pct)||0)),
      rd:null,rr:0,rC:0,dias:0,porHH:false,
      taskId:fx?String(fx.o.task_id||''):'',
      clndrId:fx?String(fx.o.clndr_id||''):'',
      _aporte:{},
      durH:fx?(Number(fx.o.target_drtn_hr_cnt)||0):0,
      nomXer:fx?_crTx(fx.o.task_name||''):'',
      wbsIdXer:fx?String(fx.o.wbs_id||''):'',
      xA:xA,xPct:xPct,xSt:xSt,xIR:xIR,xFR:xFR,
      _lineas:[]};
    M[cod]=m;ordenCod.push(cod)});

  /* las tumbas entran al modelo solo para que _crXerEscribe las quite */
  tumbas.forEach(function(r){
    var cod=String(r.task_code||'');if(!cod||M[cod])return;
    var fx=enXer[cod.toUpperCase()]||null;
    M[cod]={cod:cod,nombre:String(r.nombre||''),wbs:String(r.wbs||''),orden:Number(r.orden)||0,
      tipo:fx?'xer':'app',eliminado:true,items:[],
      hhT:0,hhA:0,hhR:0,costoT:0,costoA:0,costoR:0,hhIgnorada:0,costoIgnorado:0,
      pct:0,estado:'NotStart',iniReal:'',finReal:'',ini:'',fin:'',iniRem:'',
      hito:false,loe:false,taskType:fx?String(fx.o.task_type||'TT_Task'):'TT_Task',
      movida:false,informativa:false,_aporte:{},
      taskId:fx?String(fx.o.task_id||''):'',clndrId:'',durH:0,
      nomXer:fx?_crTx(fx.o.task_name||''):'',wbsIdXer:fx?String(fx.o.wbs_id||''):'',
      _lineas:[]};
    ordenCod.push(cod)});

  /* ---- REPARTO: cada linea de la tabla va a las actividades que le tocan ---- */
  var sinArchivo=[],perdido={hhT:0,hhA:0,costoT:0,costoA:0};
  /* `cuenta:true`  = HH que SI estan en el TOTAL de la tabla y no llegan a
                      ninguna actividad: el archivo sale con menos que la tabla.
     `cuenta:false` = HH del CONTRATO que la propia tabla ya no cuenta (sin
                      actividad, fuera del cronograma, apagadas, lapida). No
                      descuadran nada, pero el usuario pidio saber de cuantas
                      HH se habla y de que partida. */
  var apunta=function(destino,motivo,r,vals,extra){
    sinArchivo.push({id:r.id,nombre:_crXerMTx(r.nom,180),apartado:String((extra&&extra.pert)||''),
      hhT:_crXerM2(vals.hhT),hhA:_crXerM2(vals.hhA),
      costoT:_crXerM2(vals.costoT),costoA:_crXerM2(vals.costoA),
      hhContrato:_crXerM2(r.hhC),costoContrato:_crXerM2(r.costo),
      estado:String(r.est||''),cuenta:true,motivo:motivo});
    perdido.hhT+=vals.hhT;perdido.hhA+=vals.hhA;
    perdido.costoT+=vals.costoT;perdido.costoA+=vals.costoA};

  D.filas.forEach(function(r){
    var L=lineasDe[r.id]||[];
    var cods=(reclaman[r.id]||[]).filter(function(cd){return !!M[cd]&&!M[cd].eliminado});
    var borradas=(reclaman[r.id]||[]).filter(function(cd){return !!M[cd]&&M[cd].eliminado});

    /* las actividades que programan un apartado concreto de esta partida */
    var porFase={},sinFase=[];
    cods.forEach(function(cd){
      var nom=faseNom(r.id,cd);
      var k=nom?_crXerMNrm(nom):'';
      if(k&&L.some(function(m){return _crXerMNrm(m.pert||'')===k})){
        (porFase[k]=porFase[k]||[]).push(cd)}
      else sinFase.push(cd)});

    var cfg=null;try{cfg=(typeof _cpDe==='function')?_cpDe(cronId,r.id):null}catch(_ec){cfg=null}

    /* el sobrante: todas las lineas que ningun apartado programado reclama */
    var restT={hhT:0,hhA:0,costoT:0,costoA:0},restoLin=[];

    L.forEach(function(m){
      var vals=_crXerMValores(m,mm);
      var k=_crXerMNrm(m.pert||'');
      var duenos=(k&&porFase[k])?porFase[k]:null;
      if(duenos&&duenos.length){
        /* la actividad programa ESTE apartado: se lleva su fila entera
           (repartida si hubiese mas de una actividad sobre el mismo apartado) */
        var n=duenos.length;
        var fr=(vals.hhT>0)?(vals.hhA/vals.hhT):0;
        var frC=(vals.costoT>0)?(vals.costoA/vals.costoT):0;
        duenos.forEach(function(cd){
          var t=M[cd];
          var aT=vals.hhT/n,aA=_crXerMGana(duenos,cd,vals.hhT,fr,cfg);
          var cT2=vals.costoT/n,cA2=_crXerMGana(duenos,cd,vals.costoT,frC,cfg);
          t.hhT+=aT;t.hhA+=aA;t.costoT+=cT2;t.costoA+=cA2;
          var ap=t._aporte[r.id]||(t._aporte[r.id]={hhT:0,hhA:0,costoT:0,costoA:0});
          ap.hhT+=aT;ap.hhA+=aA;ap.costoT+=cT2;ap.costoA+=cA2;
          if(t.items.indexOf(r.id)<0)t.items.push(r.id);
          t._lineas.push({id:r.id,pert:m.pert||'',metF:m.metF,metA:m.metA,pct:m.pct,dur:m.dur,durF:m.durF,durM:m.durM,metM:m.metM,metAM:m.metAM,rend:m.rend})});
        return}
      restT.hhT+=vals.hhT;restT.hhA+=vals.hhA;
      restT.costoT+=vals.costoT;restT.costoA+=vals.costoA;
      restoLin.push(m)});

    if(!(restT.hhT>0||restT.costoT>0||restT.hhA>0||restT.costoA>0))return;

    if(!sinFase.length){
      /* nadie se lo lleva: se dice, con sus HH y su motivo */
      var motivo;
      if(!cods.length&&borradas.length)motivo='la unica actividad que la agrupaba esta borrada en el aplicativo ('+borradas.join(', ')+')';
      else if(!cods.length)motivo=(String(r.est||'')==='Sin tarea')?'sin actividad que la agrupe':('sin actividad que la agrupe ('+String(r.est||'')+')');
      else motivo='sus actividades ('+cods.join(', ')+') programan solo apartados y este trozo no lo programa ninguna';
      apunta(null,motivo,r,restT,{pert:restoLin.length===1?restoLin[0].pert:''});
      return}

    var frH=(restT.hhT>0)?(restT.hhA/restT.hhT):0;
    var frC2=(restT.costoT>0)?(restT.costoA/restT.costoT):0;
    sinFase.forEach(function(cd){
      var t=M[cd];
      var aT=restT.hhT/sinFase.length,aA=_crXerMGana(sinFase,cd,restT.hhT,frH,cfg);
      var cT3=restT.costoT/sinFase.length,cA3=_crXerMGana(sinFase,cd,restT.costoT,frC2,cfg);
      t.hhT+=aT;t.hhA+=aA;t.costoT+=cT3;t.costoA+=cA3;
      var ap2=t._aporte[r.id]||(t._aporte[r.id]={hhT:0,hhA:0,costoT:0,costoA:0});
      ap2.hhT+=aT;ap2.hhA+=aA;ap2.costoT+=cT3;ap2.costoA+=cA3;
      if(t.items.indexOf(r.id)<0)t.items.push(r.id);
      restoLin.forEach(function(m){
        t._lineas.push({id:r.id,pert:m.pert||'',metF:m.metF,metA:m.metA,pct:m.pct,dur:m.dur,durF:m.durF,durM:m.durM,metM:m.metM,metAM:m.metAM,rend:m.rend})})})});

  /* ---- las partidas del CONTRATO que esta tabla ya no cuenta: no descuadran
         el total, pero el usuario pidio que el mensaje diga de cuantas HH se
         habla y de que partida ---- */
  var motivoEst={
    'Sin tarea':'sin actividad que la agrupe: no entra en el forecast de este cronograma',
    'Fuera':'partida fuera de este cronograma (configuracion de trabajo)',
    'HH apagadas':'HH apagadas en este cronograma',
    'Lapida':'partida borrada (lapida)',
    '\u004c\u00e1pida':'partida borrada (lapida)',
    'Sin HH':'la partida no tiene HH de contrato'};
  D.filas.forEach(function(r){
    var hhL=0,cL=0;
    (lineasDe[r.id]||[]).forEach(function(m){var v=_crXerMValores(m,mm);hhL+=v.hhT;cL+=v.costoT});
    if(_crXerM2(hhL)>0||_crXerM2(cL)>0)return;            /* algo aporta: no es este caso */
    if(!((Number(r.hhC)||0)>0||(Number(r.costo)||0)>0))return;   /* nada que decir */
    sinArchivo.push({id:r.id,nombre:_crXerMTx(r.nom,180),apartado:'',
      hhT:0,hhA:0,costoT:0,costoA:0,
      hhContrato:_crXerM2(r.hhC),costoContrato:_crXerM2(r.costo),
      estado:String(r.est||''),cuenta:false,
      motivo:motivoEst[String(r.est||'')]||('no cuenta en este cronograma ('+String(r.est||'?')+')')})});

  /* ---- los hitos y las LOE no pueden llevar HH: P6 se las borra al importar.
         Sus HH se apartan y se enumeran, que es justo lo que el usuario pidio
         que dijera el mensaje ---- */
  ordenCod.forEach(function(cod){
    var m=M[cod];
    if(m.eliminado)return;
    if(!(m.hito||m.loe))return;
    if(!(m.hhT>0||m.costoT>0))return;
    m.hhIgnorada=_crXerM2(m.hhT);m.costoIgnorado=_crXerM2(m.costoT);
    Object.keys(m._aporte||{}).forEach(function(i){
      var r=filaDe[i];if(!r)return;
      var ap=m._aporte[i];
      if(!(ap.hhT>0.004||ap.costoT>0.004))return;
      sinArchivo.push({id:i,nombre:_crXerMTx(r.nom,180),apartado:'',
        hhT:_crXerM2(ap.hhT),hhA:_crXerM2(ap.hhA),
        costoT:_crXerM2(ap.costoT),costoA:_crXerM2(ap.costoA),
        hhContrato:_crXerM2(r.hhC),costoContrato:_crXerM2(r.costo),
        estado:String(r.est||''),cuenta:true,
        motivo:'la actividad '+cod+' es '+(m.hito?'un hito':'de nivel de esfuerzo')+' en el .xer y no puede llevar HH'})});
    perdido.hhT+=m.hhT;perdido.hhA+=m.hhA;
    perdido.costoT+=m.costoT;perdido.costoA+=m.costoA;
    m.hhT=0;m.hhA=0;m.costoT=0;m.costoA=0});

  /* ---- redondeo, pct, estado y fechas reales ---- */
  var ps={};   /* memo de partes por partida */
  var partesDe=function(i){
    if(ps[i])return ps[i];
    var L=[];try{L=(typeof partesOf==='function')?(partesOf(i)||[]):[]}catch(_e){L=[]}
    ps[i]=L;return L};

  ordenCod.forEach(function(cod){
    var m=M[cod];
    m.hhT=_crXerM2(m.hhT);m.hhA=_crXerM2(m.hhA);
    m.costoT=_crXerM2(m.costoT);m.costoA=_crXerM2(m.costoA);
    if(modo==='tal'&&m.tipo==='xer'&&!m.eliminado){
      /* el real lo pone el ARCHIVO; si venia completa, se da por completa */
      var a=Math.max(0,Math.min(m.hhT,Number(m.xA)||0));
      if(m.xSt==='Complete')a=m.hhT;
      m.hhA=_crXerM2(a);
      m.costoA=_crXerM2((m.hhT>0)?(m.costoT*(m.hhA/m.hhT)):((m.xSt==='Complete')?m.costoT:0))}
    if(m.hhA>m.hhT)m.hhA=m.hhT;
    if(m.costoA>m.costoT)m.costoA=m.costoT});

  /* que el TOTAL del archivo cuadre EXACTAMENTE con el TOTAL de la tabla:
     se reparte la deriva del redondeo (centimos) en la tarea mas grande */
  var totTabla={hhT:0,hhA:0,costoT:0,costoA:0};
  D.filas.forEach(function(r){
    (lineasDe[r.id]||[]).forEach(function(m){
      var v=_crXerMValores(m,mm);
      totTabla.hhT+=v.hhT;totTabla.hhA+=v.hhA;
      totTabla.costoT+=v.costoT;totTabla.costoA+=v.costoA})});
  totTabla.hhT=_crXerM2(totTabla.hhT);totTabla.hhA=_crXerM2(totTabla.hhA);
  totTabla.costoT=_crXerM2(totTabla.costoT);totTabla.costoA=_crXerM2(totTabla.costoA);
  perdido.hhT=_crXerM2(perdido.hhT);perdido.hhA=_crXerM2(perdido.hhA);
  perdido.costoT=_crXerM2(perdido.costoT);perdido.costoA=_crXerM2(perdido.costoA);

  var conHH=[];ordenCod.forEach(function(cod){if(!M[cod].eliminado)conHH.push(M[cod])});
  _crXerMCuadra(conHH,'hhT',_crXerM2(totTabla.hhT-perdido.hhT));
  _crXerMCuadra(conHH,'costoT',_crXerM2(totTabla.costoT-perdido.costoT));
  /* en "tal cual" los reales son los del archivo, no los de la tabla: no se
     cuadran contra ella (y la auditoria tampoco los compara) */
  if(modo!=='tal'){
    _crXerMCuadra(conHH,'hhA',_crXerM2(totTabla.hhA-perdido.hhA));
    _crXerMCuadra(conHH,'costoA',_crXerM2(totTabla.costoA-perdido.costoA))}

  ordenCod.forEach(function(cod){
    var m=M[cod];
    if(m.hhA>m.hhT)m.hhA=m.hhT;
    if(m.costoA>m.costoT)m.costoA=m.costoT;
    m.hhR=_crXerM2(Math.max(0,m.hhT-m.hhA));
    m.costoR=_crXerM2(Math.max(0,m.costoT-m.costoA));

    /* --- el ALCANCE de la actividad (la regla del remanente) ---
       tiene alcance si al menos una de sus partidas CUENTA en este cronograma:
       incluida, sin las HH apagadas, no lapida y con algo por hacer o hecho.
       Las que no tienen partidas (informativas) tienen alcance por definicion. */
    var A9=_crRemAlc(m.items,filaDe);
    m.alcance=A9.alcance;
    m.pctFis=A9.pct;
    m.partidasFuera=A9.fuera;
    m.motivoSinAlcance=A9.motivo||'';

    /* --- el % --- */
    if(modo==='tal'&&m.tipo==='xer'&&m.xPct!=null)m.pct=_crXerM2(Math.max(0,Math.min(100,m.xPct)));
    else if(m.hhT>0)m.pct=_crXerM2(Math.max(0,Math.min(100,m.hhA/m.hhT*100)));
    else{
      /* sin HH manda el % FISICO de sus partidas (promedio ponderado por
         metrado forecast, el saldo retirado no cuenta como hecho); sin
         partidas, el % propio de la tarea (el del .xer o el que se edite) */
      m.pct=_crXerM2((A9.pct==null)?(Number(m.pctTarea)||0):A9.pct)}

    /* --- el estado --- */
    if(modo==='tal'&&m.tipo==='xer'){
      /* "tal cual": el estado y las fechas reales son los del archivo */
      m.estado=(m.xSt==='Complete'||m.xSt==='Active'||m.xSt==='NotStart')?m.xSt:'NotStart';
      m.iniReal=m.xIR||'';m.finReal=(m.estado==='Complete')?(m.xFR||m.xIR||''):'';
      if(m.estado==='Active'&&!m.iniReal)m.iniReal=m.ini||corte;
      if(m.estado==='Complete'&&!m.iniReal)m.iniReal=m.ini||corte;
      if(m.estado==='NotStart'){m.iniReal='';m.finReal='';m.pct=0}}
    else if(m.informativa&&m.hhT<=0&&m.costoT<=0){
      /* informativa: se respeta lo que trae el archivo, no se inventa estado */
      m.estado='';m.pct=null}
    /* COMPLETE SOLO CON EL REMANENTE EN CERO (X5 P1-A): m.pct sale de
       _crXerM2 (dos decimales), asi que un 99.996 % daba Complete con 0.04 hh
       de remanente, _crXerValida E-19 lo marca como ERROR y el .xer NO se
       descarga. hhT/hhA/hhR ya estan redondeados a 2 decimales, de modo que
       hhR<=0.004 equivale a hhR===0. Sin HH (hitos informativos, actividades
       sin alcance) manda el % fisico, como siempre. */
    else if((m.hhT>0.005)?(m.hhR<=0.004&&m.hhA>0.005):(m.pct>=100-1e-9)){m.estado='Complete';m.pct=100}
    else if(m.pct>=100-1e-9){m.estado='Active';m.pct=99.99}
    else if(m.pct>0)m.estado='Active';
    else m.estado='NotStart';
    /* Y EL ESTADO TAMPOCO PUEDE CONTRADECIR A LAS UNIDADES POR ABAJO (X3 H2):
       con un corte temprano una actividad de 10'000 hh con 0.30 hh reales
       redondea su % a 0.00 y salia TK_NotStart con act_work_qty 0.30, que
       tambien es E-19 y tampoco se descargaba. El umbral (0.005) es el mismo
       con el que _crXerMNum decide si escribe el campo en cero.
       En "tal cual" el estado es el del ARCHIVO y no se toca. */
    if(m.estado==='NotStart'&&!(modo==='tal'&&m.tipo==='xer')&&m.hhT>0&&m.hhA>0.005){
      m.estado='Active';if(!(m.pct>0))m.pct=0.01}
    /* sin alcance (HH apagadas, fuera, saldo retirado) pero ejecutada del todo
       sobre el metrado del CONTRATO: en P6 es Complete con sus fechas reales,
       no una Not Started con 0 dias (A1490: 1206 de 1206 m hechos) */
    if(m.alcance===false&&!(modo==='tal'&&m.tipo==='xer')&&m.estado!=='Complete'){
      var _hecho9=0,_tot9=0;
      (m.items||[]).forEach(function(i9){var r9=(typeof filaDe==='function')?filaDe(i9):(filaDe&&filaDe[i9]);if(!r9)return;
        var mt9=Number(r9.met)||0,av9=Number(r9.av)||0;_tot9+=mt9;_hecho9+=Math.min(mt9,av9)});
      if(_tot9>0&&_hecho9>=_tot9-1e-9){m.estado='Complete';m.pct=100}}

    /* --- las fechas reales, de los partes hasta el corte --- */
    if(modo==='tal'&&m.tipo==='xer'){/* ya vienen del archivo */}
    else if(m.estado&&m.estado!=='NotStart'){
      var pi='',pf='',vistos={};
      m.items.forEach(function(i){
        if(vistos[i])return;vistos[i]=1;
        partesDe(i).forEach(function(mv){
          var f=String((mv&&mv.fecha)||'');
          if(!f||(corte&&f>corte))return;
          var tiene=((Number(mv.cant)||0)>0)||((Number(mv.pctGlb)||0)>0);
          if(!tiene)return;
          if(!pi||f<pi)pi=f;
          if(!pf||f>pf)pf=f})});
      /* sin ningun parte con fecha (avance por saldo retirado o % inicial) el
         inicio real razonable es el planificado, no la fecha de exportacion:
         con el corte, toda la curva real se apelmaza en el dia de hoy */
      if(!pi)pi=m.ini||corte;
      if(corte&&pi>corte)pi=corte;
      m.iniReal=pi;
      if(m.estado==='Complete'){
        if(!pf)pf=pi;
        if(corte&&pf>corte)pf=corte;
        if(pf<pi)pf=pi;
        m.finReal=pf}
      else m.finReal=''}
    else if(!(modo==='tal'&&m.tipo==='xer')){m.iniReal='';m.finReal=''}

    /* --- el inicio del remanente: nunca antes de la fecha de datos --- */
    if(m.estado==='Complete')m.iniRem='';
    else if(m.estado==='Active')m.iniRem=corte;
    else{var ir=m.ini||corte;m.iniRem=(corte&&ir<corte)?corte:ir}

    /* LAS DURACIONES DE LA TABLA de esta actividad (Rendimiento APP): la
       mayor de sus lineas, en dias laborables (cada partida abarca toda su
       actividad, como reparte el engranaje). rd = restante (forecast o, con
       mayor metrado, (mayor - actual MM) / rendimiento); tot = duracion total
       (forecast o mayor metrado). Sin rendimiento en ninguna linea: null y
       manda la regla de HH. Se calcula ANTES de soltar _lineas. */
    (function(){var rd=null,tot=null;
      (m._lineas||[]).forEach(function(l){if(!(Number(l.rend)>0))return;
        var r1=mm?(((l.metM!=null&&l.metAM!=null)?(Math.max(0,Number(l.metM)-Number(l.metAM))/Number(l.rend)):null)):((l.dur!=null)?Number(l.dur):null);
        var t1=mm?((l.durM!=null)?Number(l.durM):null):((l.durF!=null)?Number(l.durF):null);
        if(r1!=null&&isFinite(r1)&&(rd==null||r1>rd))rd=r1;
        if(t1!=null&&isFinite(t1)&&(tot==null||t1>tot))tot=t1});
      m.durTab=(rd==null&&tot==null)?null:{rd:(rd==null?0:Math.round(rd*10000)/10000),tot:Math.round(Math.max(rd||0,tot||0)*10000)/10000}})();
    delete m._lineas;delete m._aporte});

  /* ---- las relaciones, incluidas las tumbas ---- */
  var relaciones=[];
  try{
    var all=(typeof _rlAll==='function')?_rlAll():{};
    Object.keys(all).forEach(function(k){
      var x=all[k];
      if(!x||String(x.cron_id)!==cronId||!x.succ||!x.pred)return;
      relaciones.push({succ:String(x.succ),pred:String(x.pred),
        tipo:String(x.tipo||'FS').toUpperCase(),
        lagD:Number(x.lag_d)||0,
        lag0:(x.lag0==null?null:Number(x.lag0)),
        origen:String(x.origen||''),
        eliminado:!!x.eliminado})})}
  catch(e){throw new Error('no se pudieron leer las relaciones del cronograma: '+((e&&e.message)||e))}
  relaciones.sort(function(a,b){
    var x=a.succ+'|'+a.pred,y=b.succ+'|'+b.pred;return (x<y)?-1:(x>y)?1:0});

  /* ---- los titulos de WBS renombrados en el aplicativo ---- */
  var wbsTitulos=[];
  try{
    ((typeof _crWbsDe==='function')?(await _crWbsDe(cronId)):[]).forEach(function(w){
      if(!w||!w.ruta)return;
      wbsTitulos.push({ruta:String(w.ruta),nombre:String(w.nombre||''),
        orden:Number(w.orden)||0,nivel:Number(w.nivel)||0})})}
  catch(e){avisos.push('no se pudieron leer los titulos de WBS ('+String((e&&e.message)||e)+
    '): el .xer saldra con los titulos del archivo original')}

  /* ---- el modelo ---- */
  var totalesTareas={hhT:0,hhA:0,hhR:0,costoT:0,costoA:0};
  ordenCod.forEach(function(cod){
    var m=M[cod];if(m.eliminado)return;
    totalesTareas.hhT+=m.hhT;totalesTareas.hhA+=m.hhA;totalesTareas.hhR+=m.hhR;
    totalesTareas.costoT+=m.costoT;totalesTareas.costoA+=m.costoA});
  Object.keys(totalesTareas).forEach(function(k){totalesTareas[k]=_crXerM2(totalesTareas[k])});

  /* las mismas partidas apuntadas varias veces se juntan en una sola linea */
  var porId={},sinArch2=[];
  sinArchivo.forEach(function(s){
    var k=s.id+'|'+s.motivo+'|'+s.apartado;
    if(porId[k]){porId[k].hhT=_crXerM2(porId[k].hhT+s.hhT);porId[k].hhA=_crXerM2(porId[k].hhA+s.hhA);
      porId[k].costoT=_crXerM2(porId[k].costoT+s.costoT);porId[k].costoA=_crXerM2(porId[k].costoA+s.costoA);return}
    porId[k]=s;sinArch2.push(s)});
  sinArch2.sort(function(a,b){
    if(!!b.cuenta!==!!a.cuenta)return b.cuenta?1:-1;
    if(b.hhT!==a.hhT)return b.hhT-a.hhT;
    if((b.hhContrato||0)!==(a.hhContrato||0))return (b.hhContrato||0)-(a.hhContrato||0);
    return (a.id<b.id)?-1:(a.id>b.id)?1:0});

  return {
    cron:c,cronId:cronId,modo:modo,mm:mm,corte:corte,hoy:hoy,sem:sem,
    hpd:hpd,horaIni:horaIni,horaFin:horaFin,
    clndrId:_crXerMClndr(T),
    tareas:M,
    orden:ordenCod,
    relaciones:relaciones,
    wbsTitulos:wbsTitulos,
    totales:{hhT:totTabla.hhT,hhA:totTabla.hhA,
             hhR:_crXerM2(totTabla.hhT-totTabla.hhA),
             costoT:totTabla.costoT,costoA:totTabla.costoA},
    totalesTareas:totalesTareas,
    perdido:perdido,
    sinArchivo:sinArch2,
    avisos:avisos,
    tabla:D}}


/* ==========================================================================
   3. ESCRITURA - etapa 4 del contrato
   --------------------------------------------------------------------------
   Reescribe TASK, TASKRSRC, RSRC y PROJWBS con lo que dice el modelo.
   Trabaja SOBRE `lineas` (las modifica en el sitio) y devuelve contadores.
   ========================================================================== */
function _crXerEscribe(lineas,modelo){
  if(!lineas||!lineas.length)throw new Error('no hay archivo .xer que escribir');
  if(!modelo||!modelo.tareas)throw new Error('no hay modelo que escribir en el .xer');

  var out={vaciadas:0,escritas:0,nuevas:0,borradas:0,renombradas:0,movidas:0,
           asigNuevas:0,asigCeradas:0,wbsNuevas:0,wbsRenom:0,wbsOrden:0,
           rsrcNuevos:0,hitos:0,informativas:0,sinCampo:0,sinModelo:[],avisos:[]};

  var hpd=Number(modelo.hpd)||8;
  var hIni=String(modelo.horaIni||'07:00');
  var hFin=String(modelo.horaFin||_crXerMCierre(hpd,hIni));
  var corte=String(modelo.corte||'');

  /* el modelo indexado en MAYUSCULAS: P6 no distingue caja en el Activity ID */
  var MU={},codReal={};
  Object.keys(modelo.tareas).forEach(function(cod){
    MU[String(cod).toUpperCase()]=modelo.tareas[cod];
    codReal[String(cod).toUpperCase()]=cod});

  /* ---------------------------------------------------------------------
     3.1 LAS BORRADAS: fuera del archivo antes de nada, porque quitar lineas
     renumera todo lo demas. Se van con su TASKRSRC y con toda TASKPRED que
     las toque (una predecesora huerfana hace fallar la importacion en P6).
     --------------------------------------------------------------------- */
  (function(){
    var T=_crXerTablas(lineas),TA=T.TASK;
    if(!TA||!TA.cs.length)return;
    var fuera={},idFuera={};
    TA.filas.forEach(function(f){
      var m=MU[_crTx(f.o.task_code).toUpperCase()];
      if(!m||!m.eliminado)return;
      fuera[f.i]=1;idFuera[String(f.o.task_id)]=1;out.borradas++});
    if(!out.borradas)return;
    if(T.TASKRSRC)T.TASKRSRC.filas.forEach(function(x){if(idFuera[String(x.o.task_id)])fuera[x.i]=1});
    if(T.TASKPRED)T.TASKPRED.filas.forEach(function(p){
      if(idFuera[String(p.o.task_id)]||idFuera[String(p.o.pred_task_id)])fuera[p.i]=1});
    if(T.TASKMEMO)T.TASKMEMO.filas.forEach(function(p){if(idFuera[String(p.o.task_id)])fuera[p.i]=1});
    if(T.UDFVALUE)T.UDFVALUE.filas.forEach(function(p){if(idFuera[String(p.o.fk_id)])fuera[p.i]=1});
    var res=[];
    for(var i=0;i<lineas.length;i++)if(!fuera[i])res.push(lineas[i]);
    lineas.length=0;
    res.forEach(function(l){lineas.push(l)})})();

  /* ---------------------------------------------------------------------
     3.2 el archivo ya limpio
     --------------------------------------------------------------------- */
  var T=_crXerTablas(lineas);
  var TA=T.TASK,TR=T.TASKRSRC,RS=T.RSRC,WB=T.PROJWBS;
  if(!TA||!TA.cs.length)throw new Error('el .xer no trae la tabla TASK: no se puede escribir nada');
  if(!TR||!TR.cs.length){TR=null;out.avisos.push('el .xer original no trae la tabla TASKRSRC: las HH viajan solo a nivel de actividad y P6 no vera unidades de recurso')}

  var projId='';
  try{projId=String((T.PROJECT&&T.PROJECT.filas[0]&&T.PROJECT.filas[0].o.proj_id)||TA.filas[0].o.proj_id||'')}catch(_ep){}
  var clndrProj=String(modelo.clndrId||_crXerMClndr(T)||'');

  var nuevasT=[],nuevasR=[],nuevasW=[],nuevasRS=[];

  /* ---------------------------------------------------------------------
     3.3 RECURSOS: tiene que existir uno de tipo LABOR o P6 no ve las HH
     --------------------------------------------------------------------- */
  var rsTipo={},labRsrc='';
  if(RS&&RS.cs.length)RS.filas.forEach(function(f){
    var id=String(f.o.rsrc_id||'');rsTipo[id]=String(f.o.rsrc_type||'RT_Labor');
    if(!labRsrc&&rsTipo[id]==='RT_Labor')labRsrc=id});
  /* "Auto Compute Actuals" del recurso: con Y, al aplicar actuals P6 tira las
     HH reales del aplicativo, pone el plan a la fecha y recalcula el remanente
     hasta el fin planificado (asi salio el LB1-FLOCULANTES del 19/09/2026 con
     3'074.86 hh reales en vez de 2'369.96). Las tareas ya van con N; los
     recursos del archivo original venian con Y y se les quita aqui */
  if(RS&&RS.cs.length&&RS.col.auto_compute_act_flag!=null)RS.filas.forEach(function(f){
    var j=RS.col.auto_compute_act_flag;
    if(String(f.v[j]||'').trim()!=='N'){f.v[j]='N';lineas[f.i]='%R\t'+f.v.join('\t');out.rsrcAuto=(out.rsrcAuto||0)+1}});
  var esLabor=function(x){
    var t=String(x.o.rsrc_type||'')||rsTipo[String(x.o.rsrc_id||'')]||'RT_Labor';
    return t==='RT_Labor'};

  if(!labRsrc&&RS&&RS.cs.length){
    /* el archivo no trae ningun recurso de mano de obra: se crea uno, si no
       las asignaciones nuevas cuelgan de un material y P6 no suma horas */
    var maxRS=0;RS.filas.forEach(function(f){maxRS=Math.max(maxRS,Number(f.o.rsrc_id)||0)});
    var baseRS=RS.filas.length?RS.filas[0].v.slice():RS.cs.map(function(){return ''});
    var vRS=_crXerMFila(baseRS,RS.cs.length);
    var pRS=function(campo,val){var j=RS.col[campo];if(j==null){out.sinCampo++;return}vRS[j]=val};
    maxRS++;
    pRS('rsrc_id',String(maxRS));
    pRS('parent_rsrc_id','');
    pRS('rsrc_seq_num',String(RS.filas.length+1));
    pRS('rsrc_short_name','APP-HH');
    pRS('rsrc_name',_crXerMTx('MANO DE OBRA (APLICATIVO)',100));
    pRS('rsrc_type','RT_Labor');
    pRS('rsrc_title_name','');
    pRS('clndr_id',clndrProj);
    pRS('unit_id','');
    pRS('cost_qty_type','QT_Hour');
    pRS('def_qty_per_hr','1');
    pRS('active_flag','Y');
    pRS('auto_compute_act_flag','N');
    pRS('def_cost_qty_link_flag','N');
    pRS('ot_flag','N');pRS('ot_factor','');
    pRS('curr_id','');pRS('email_addr','');pRS('office_phone','');pRS('other_phone','');
    pRS('user_id','');pRS('pobs_id','');pRS('role_id','');
    pRS('shift_id','');pRS('location_id','');
    pRS('guid',_crXerMGuid('RSRC|'+modelo.cronId));
    nuevasRS.push('%R\t'+vRS.join('\t'));
    labRsrc=String(maxRS);rsTipo[labRsrc]='RT_Labor';out.rsrcNuevos=1}

  /* la asignacion modelo que se clona para las nuevas */
  var modR=null;
  if(TR){
    TR.filas.forEach(function(f){if(!modR&&esLabor(f))modR=f});
    if(!modR&&TR.filas.length)modR=TR.filas[0]}

  /* ---------------------------------------------------------------------
     3.4 PROJWBS: indice por ruta, creacion de los nodos que falten y los
     titulos renombrados en el aplicativo
     --------------------------------------------------------------------- */
  var raiz='',padreDe={},nomDe={},porRuta={},porNombre={},maxW=0,seqW=0,modW=null;
  if(WB&&WB.cs.length){
    WB.filas.forEach(function(f){
      var id=String(f.o.wbs_id||'');
      maxW=Math.max(maxW,Number(f.o.wbs_id)||0);
      seqW=Math.max(seqW,Number(f.o.seq_num)||0);
      padreDe[id]=String(f.o.parent_wbs_id||'');
      nomDe[id]=_crTx(f.o.wbs_name||'');
      if(String(f.o.proj_node_flag||'').replace(/^\s+|\s+$/g,'')==='Y'){raiz=raiz||id;return}
      if(!modW)modW=f;
      var n=_crXerMNrm(nomDe[id]);
      if(n&&porNombre[n]==null)porNombre[n]=id});
    /* sin nodo raiz declarado, el que no tiene padre conocido: un wbs_id vacio
       hace que P6 rechace la importacion entera */
    if(!raiz)WB.filas.forEach(function(f){
      var p=String(f.o.parent_wbs_id||'');
      if(!raiz&&(!p||nomDe[p]===undefined))raiz=String(f.o.wbs_id||'')});
    if(!raiz&&WB.filas.length)raiz=String(WB.filas[0].o.wbs_id||'')}
  if(!raiz)raiz=String(TA.filas.length?(TA.filas[0].o.wbs_id||''):'');

  /* la ruta de un nodo INCLUYE el nodo raiz: es asi como _crDeXer la guarda en
     cron_tareas.wbs y en cron_wbs.ruta, y si aqui se omitiera, ninguna ruta del
     aplicativo casaria y se crearia un arbol nuevo entero */
  var rutaDeId=function(id){
    var o=[],g=0;
    while(id&&nomDe[id]!==undefined&&g++<24){o.unshift(_crXerMNrm(nomDe[id]));id=padreDe[id]}
    return o.join(' / ')};
  if(WB&&WB.cs.length)WB.filas.forEach(function(f){
    var id=String(f.o.wbs_id||''),r=rutaDeId(id);
    if(r&&porRuta[r]==null)porRuta[r]=id});

  var nodoDe=function(ruta){
    var r=String(ruta||'').split(' / ').filter(function(z){return z!==''&&z!=null});
    if(!r.length)return raiz;
    var k=r.map(function(z){return _crXerMNrm(z)}).join(' / ');
    if(porRuta[k]!=null)return porRuta[k];
    var padre=nodoDe(r.slice(0,-1).join(' / '))||raiz;
    if(!WB||!WB.cs.length||!modW)return padre;   /* sin tabla WBS usable, al padre */
    maxW++;seqW++;
    var w=_crXerMFila(modW.v.slice(),WB.cs.length);
    var pw=function(campo,val){var j=WB.col[campo];if(j==null)return;w[j]=val};
    var nom=_crXerMTx(r[r.length-1],100);
    pw('wbs_id',String(maxW));
    pw('proj_id',projId||String(modW.o.proj_id||''));
    pw('obs_id',String(modW.o.obs_id||''));
    pw('seq_num',String(seqW));
    pw('est_wt','1');
    pw('proj_node_flag','N');
    pw('sum_data_flag','N');
    pw('status_code','WS_Open');
    pw('wbs_short_name',_crXerMTx(nom,20));
    pw('wbs_name',nom);
    pw('phase_id','');
    pw('parent_wbs_id',String(padre));
    pw('ev_user_pct','0.06');pw('ev_etc_user_value','0.88');
    pw('orig_cost','0');pw('indep_remain_total_cost','0');pw('indep_remain_work_qty','0');
    pw('ann_dscnt_rate_pct','');pw('dscnt_period_type','');
    pw('ev_compute_type','EC_Cmp_pct');pw('ev_etc_compute_type','EE_Rem_hr');
    pw('anticip_start_date','');pw('anticip_end_date','');
    pw('guid',_crXerMGuid('WBS|'+modelo.cronId+'|'+k));
    pw('tmpl_guid','');
    padreDe[String(maxW)]=String(padre);nomDe[String(maxW)]=nom;
    porRuta[k]=String(maxW);
    if(porNombre[_crXerMNrm(nom)]==null)porNombre[_crXerMNrm(nom)]=String(maxW);
    nuevasW.push('%R\t'+w.join('\t'));out.wbsNuevas++;
    return String(maxW)};

  var wbsDe=function(ruta){
    var r=String(ruta||'').split(' / ').filter(function(z){return z!==''&&z!=null});
    if(!r.length)return raiz;
    var k=r.map(function(z){return _crXerMNrm(z)}).join(' / ');
    if(porRuta[k]!=null)return porRuta[k];
    return nodoDe(r.join(' / '))||raiz};

  /* los titulos renombrados: la RUTA es la llave, el nombre es lo editable */
  if(WB&&WB.cs.length&&WB.col.wbs_name!=null&&(modelo.wbsTitulos||[]).length){
    var titApp={};
    (modelo.wbsTitulos||[]).forEach(function(w){
      if(!w.nombre)return;
      var k=String(w.ruta||'').split(' / ').filter(function(z){return z})
        .map(function(z){return _crXerMNrm(z)}).join(' / ');
      if(k)titApp[k]=String(w.nombre)});
    WB.filas.forEach(function(f){
      if(String(f.o.proj_node_flag||'').replace(/^\s+|\s+$/g,'')==='Y')return;
      var nv=titApp[rutaDeId(String(f.o.wbs_id||''))];
      if(!nv)return;
      nv=_crXerMTx(nv,100);
      if(!nv||_crTx(f.o.wbs_name)===nv)return;
      f.v[WB.col.wbs_name]=nv;
      nomDe[String(f.o.wbs_id||'')]=nv;
      lineas[f.i]='%R\t'+f.v.join('\t');out.wbsRenom++})}

  /* ---------------------------------------------------------------------
     3.5 LAS TAREAS QUE YA ESTAN EN EL ARCHIVO
     --------------------------------------------------------------------- */
  var maxT=0;TA.filas.forEach(function(f){maxT=Math.max(maxT,Number(f.o.task_id)||0)});
  var maxR=0;if(TR)TR.filas.forEach(function(f){maxR=Math.max(maxR,Number(f.o.taskrsrc_id)||0)});
  var asigDe={};
  if(TR)TR.filas.forEach(function(x){(asigDe[String(x.o.task_id)]=asigDe[String(x.o.task_id)]||[]).push(x)});
  var yaEsta={};
  TA.filas.forEach(function(f){yaEsta[_crTx(f.o.task_code).toUpperCase()]=f});

  var estadoXer=function(e){
    if(e==='Complete')return 'TK_Complete';
    if(e==='Active')return 'TK_Active';
    return 'TK_NotStart'};

  TA.filas.forEach(function(fi){
    var codU=_crTx(fi.o.task_code).toUpperCase();
    var m=MU[codU];
    var pw=function(campo,val){var j=TA.col[campo];if(j==null){out.sinCampo++;return}fi.v[j]=val};

    /* --- la que el aplicativo no conoce: se vacia, y tambien su avance ---
       si se le deja el % y el estado del archivo viejo, P6 ensena
       actividades "en curso" con 0 horas */
    if(!m){
      out.sinModelo.push(_crTx(fi.o.task_code));
      _crXerMVacia(lineas,fi,TA,TR,asigDe[String(fi.o.task_id)]||[],out,true);
      return}

    if(m.eliminado)return;   /* ya salio del archivo en 3.1 */

    /* --- informativa (sin partidas y sin HH): se respeta lo que trae el
       archivo. Solo se le corrige el nombre, que es lo unico que el usuario
       edita de ella en el aplicativo. --- */
    if(m.informativa&&!(m.hhT>0||m.costoT>0)){
      out.informativas++;
      /* lo unico que NO se le respeta a una informativa: P6 no puede
         recalcular por su cuenta el avance de nada de este archivo. Con
         auto_compute_act_flag='Y' (lo que traen las del .xer original) el
         primer F9 le pone actuals por su cuenta y el corrido deja de ser el
         del aplicativo. Lo encontro el xer_check.js de X5 (E6). */
      if(TA.col.auto_compute_act_flag!=null&&String(fi.v[TA.col.auto_compute_act_flag]||'')!=='N'){
        fi.v[TA.col.auto_compute_act_flag]='N';lineas[fi.i]='%R'+_XTAB+fi.v.join(_XTAB)}
      var nomI=_crXerMTx(m.nombre,200);
      if(nomI&&_crTx(fi.o.task_name)!==nomI&&TA.col.task_name!=null){
        fi.v[TA.col.task_name]=nomI;lineas[fi.i]='%R\t'+fi.v.join('\t');out.renombradas++}
      return}

    /* --- nombre y sitio en la WBS: mandan desde el aplicativo --- */
    var nom=_crXerMTx(m.nombre,200);
    if(nom&&_crTx(fi.o.task_name)!==nom){pw('task_name',nom);out.renombradas++}
    var wN=wbsDe(m.wbs);
    if(wN&&String(fi.o.wbs_id)!==String(wN)){pw('wbs_id',String(wN));out.movidas++}

    /* --- hitos y LOE: sin HH y sin duracion propia. P6 les borra las
       unidades al importar y a las LOE les recalcula las fechas. --- */
    var hito=!!m.hito,loe=!!m.loe;
    if(hito||loe)out.hitos++;

    /* --- unidades --- */
    pw('target_work_qty',hito||loe?'0':_crXerMNum(m.hhT));
    pw('act_work_qty',hito||loe?'0':_crXerMNum(m.hhA));
    pw('remain_work_qty',hito||loe?'0':_crXerMNum(m.hhR));
    /* el aplicativo solo modela HH (labor): las de equipo del archivo viejo se
       ponen a cero para que el total de P6 sea el del aplicativo */
    pw('target_equip_qty','0');pw('remain_equip_qty','0');pw('act_equip_qty','0');
    /* "this period" es lo ganado desde la fecha de datos ANTERIOR, no el
       acumulado: se deja en cero y P6 lo llena al cerrar periodo */
    pw('act_this_per_work_qty','0');pw('act_this_per_equip_qty','0');

    /* --- duracion: con HH y duracion 0 P6 borra las unidades --- */
    var dur=Number(fi.o.target_drtn_hr_cnt)||0;
    /* LA REGLA DEL REMANENTE, tambien cuando la actividad no tiene HH: con HH
       manda lo que falta de HH; sin HH y con alcance, lo que falta por avance;
       sin alcance, cero. (_crXerFechas lo afina luego con el calendario real
       y el rendimiento propio, pero la fila ya sale coherente.) */
    var frRem=0;
    if(m.estado==='Complete')frRem=0;
    else if(m.hhT>0)frRem=(m.hhR/m.hhT);
    else if(m.alcance===false)frRem=0;
    else frRem=1-Math.max(0,Math.min(100,Number(m.pct)||0))/100;
    if(!(frRem>0))frRem=0;
    if(hito){dur=0;pw('target_drtn_hr_cnt','0');pw('remain_drtn_hr_cnt','0')}
    else if(!loe&&m.alcance===false&&m.estado!=='Complete'){
      /* sin alcance: P6 pone Remaining = Original en toda Not Started, asi que
         el remanente 0 exige duracion original 0 (no ocupa tiempo en el plan) */
      dur=0;pw('target_drtn_hr_cnt','0');pw('remain_drtn_hr_cnt','0')}
    else if(!loe){
      if(m.hhT>0&&!(dur>0)){dur=hpd;pw('target_drtn_hr_cnt',_crXerMNum(dur))}
      if(dur>0)pw('remain_drtn_hr_cnt',_crXerMNum(dur*frRem))}

    /* --- tipo de duracion: "Duracion y unidades fijas". Al correr la
       duracion en P6 las unidades no cambian, que es lo que el aplicativo
       necesita. Los hitos y las LOE no admiten tipo de duracion. --- */
    if(!hito&&!loe)pw('duration_type','DT_FixedDrtn');

    /* --- el avance --- */
    if(m.estado){
      pw('phys_complete_pct',_crXerMNum(m.pct==null?0:m.pct));
      pw('complete_pct_type','CP_Phys');
      pw('status_code',estadoXer(m.estado));
      if(m.estado==='Complete'){
        pw('act_start_date',_crXerMFecH(m.iniReal,hIni));
        pw('act_end_date',_crXerMFecH(m.finReal||m.iniReal,hFin));
        pw('restart_date','');pw('reend_date','');
        pw('rem_late_start_date','');pw('rem_late_end_date','')}
      else if(m.estado==='Active'){
        pw('act_start_date',_crXerMFecH(m.iniReal,hIni));
        pw('act_end_date','')}
      else{
        pw('act_start_date','');pw('act_end_date','')}}

    /* --- P6 no puede recalcular por su cuenta el avance que escribe el
       aplicativo, y las restricciones viejas deshacen el corrido en el
       primer F9 --- */
    pw('auto_compute_act_flag','N');
    pw('lock_plan_flag','N');
    pw('cstr_type','');pw('cstr_date','');pw('cstr_type2','');pw('cstr_date2','');
    pw('expect_end_date','');pw('suspend_date','');pw('resume_date','');

    lineas[fi.i]='%R\t'+fi.v.join('\t');out.escritas++;

    /* --- TASKRSRC: UNA sola asignacion LABOR lleva las HH y el costo --- */
    if(!TR)return;
    var mias=asigDe[String(fi.o.task_id)]||[];
    var lab=mias.filter(esLabor);
    var qT=(hito||loe)?0:m.hhT, qA=(hito||loe)?0:m.hhA, qR=(hito||loe)?0:m.hhR;
    var cT=(hito||loe)?0:m.costoT, cA=(hito||loe)?0:m.costoA, cR=(hito||loe)?0:m.costoR;
    var rdur=(dur>0)?(dur*frRem):0;

    var principal=lab.length?lab[0]:null;
    /* las demas se quedan a cero: dos asignaciones con las mismas horas hacen
       que P6 ensene el doble de unidades */
    mias.forEach(function(x){
      if(x===principal)return;
      _crXerMCeroAsig(lineas,x,TR);out.asigCeradas++});

    if(principal){
      _crXerMPonAsig(lineas,principal,TR,fi,{qT:qT,qA:qA,qR:qR,cT:cT,cA:cA,cR:cR,
        dur:dur,rdur:rdur,hIni:hIni,hFin:hFin,m:m},out)}
    else if(qT>0||cT>0){
      /* la tarea lleva HH y no tiene ninguna asignacion de trabajo: se le crea
         una, si no P6 no ve sus horas */
      if(!modR&&!labRsrc){out.avisos.push('la actividad '+m.cod+' lleva HH y el .xer no trae ninguna asignacion que copiar');return}
      maxR++;
      var w0=_crXerMFila(modR?modR.v.slice():TR.cs.map(function(){return ''}),TR.cs.length);
      var nueva={i:-1,v:w0,o:modR?modR.o:{}};
      var pR=function(campo,val){var j=TR.col[campo];if(j==null)return;w0[j]=val};
      pR('taskrsrc_id',String(maxR));
      pR('task_id',String(fi.o.task_id));
      pR('proj_id',String(fi.o.proj_id||projId||''));
      pR('wbs_id',String(fi.o.wbs_id||''));
      if(labRsrc)pR('rsrc_id',labRsrc);
      pR('role_id','');pR('acct_id','');
      pR('rsrc_type','RT_Labor');
      pR('guid',_crXerMGuid('TR|'+modelo.cronId+'|'+m.cod));
      pR('skill_level','');pR('rate_type','COST_PER_QTY');
      pR('curv_id','');pR('rsrc_curv_id','');
      pR('target_lag_drtn_hr_cnt','0');pR('relag_drtn_hr_cnt','0');
      pR('ot_factor','');pR('ts_pend_act_end_flag','N');
      pR('rollup_dates_flag','Y');pR('pend_complete_pct','');
      _crXerMPonAsig(lineas,nueva,TR,fi,{qT:qT,qA:qA,qR:qR,cT:cT,cA:cA,cR:cR,
        dur:dur,rdur:rdur,hIni:hIni,hFin:hFin,m:m},out);
      nuevasR.push('%R\t'+w0.join('\t'));out.asigNuevas++}});

  /* ---------------------------------------------------------------------
     3.6 LAS ACTIVIDADES NUEVAS DEL APLICATIVO
     --------------------------------------------------------------------- */
  /* la fila que se clona tiene que ser una TAREA normal: si se cuela un hito
     o un resumen de WBS, todas las nuevas nacen de ese tipo */
  var plantilla=null;
  var esTarea=function(f){var tp=String(f.o.task_type||'TT_Task');return tp==='TT_Task'||tp==='TT_Rsrc'};
  TA.filas.forEach(function(f){if(!plantilla&&esTarea(f)&&(Number(f.o.target_work_qty)||0)>0)plantilla=f});
  if(!plantilla)TA.filas.forEach(function(f){if(!plantilla&&esTarea(f))plantilla=f});
  if(!plantilla)plantilla=TA.filas[0];

  /* orden fijo: dos exportaciones seguidas tienen que dar el MISMO archivo */
  var pendientes=(modelo.orden||Object.keys(modelo.tareas)).slice()
    .filter(function(cod){
      var m=modelo.tareas[cod];
      return m&&!m.eliminado&&!yaEsta[String(cod).toUpperCase()]})
    .sort(function(a,b){
      var oa=Number(modelo.tareas[a].orden)||0,ob=Number(modelo.tareas[b].orden)||0;
      if(oa!==ob)return oa-ob;
      return (a<b)?-1:(a>b)?1:0});

  pendientes.forEach(function(cod){
    var m=modelo.tareas[cod];
    if(!plantilla){out.avisos.push('no hay ninguna fila TASK que copiar: la actividad '+cod+' no se pudo crear');return}
    maxT++;
    var v=_crXerMFila(plantilla.v.slice(),TA.cs.length);
    var pon=function(campo,val){var j=TA.col[campo];if(j==null)return;v[j]=val};
    var ini=m.ini||m.iniRem||corte;
    var fin=m.fin||ini;
    if(fin<ini)fin=ini;
    if(!ini){out.avisos.push('la actividad nueva '+cod+' no tiene ninguna fecha: se coloco en la fecha de datos');
      ini=corte;fin=corte}
    var dias=1;
    try{if(typeof _crXerDias==='function')dias=_crXerDias(ini,fin)}catch(_ed){dias=1}
    var horas=Math.max(hpd,Math.round(dias*hpd*100)/100);
    if(m.hito)horas=0;

    pon('task_id',String(maxT));
    pon('proj_id',projId||String(plantilla.o.proj_id||''));
    pon('wbs_id',String(wbsDe(m.wbs)||raiz));
    pon('clndr_id',clndrProj||String(plantilla.o.clndr_id||''));
    pon('task_code',_crXerMTx(cod,40));
    pon('task_name',_crXerMTx(m.nombre||cod,200));
    pon('task_type','TT_Task');
    pon('duration_type','DT_FixedDrtn');
    pon('priority_type','PT_Normal');
    pon('rsrc_id','');
    pon('target_work_qty',_crXerMNum(m.hhT));
    pon('act_work_qty',_crXerMNum(m.hhA));
    pon('remain_work_qty',_crXerMNum(m.hhR));
    pon('target_equip_qty','0');pon('act_equip_qty','0');pon('remain_equip_qty','0');
    pon('act_this_per_work_qty','0');pon('act_this_per_equip_qty','0');
    pon('target_drtn_hr_cnt',_crXerMNum(horas));
    /* la regla del remanente, igual que en las filas que ya existian */
    var frRem2=0;
    if(m.estado==='Complete')frRem2=0;
    else if(m.hhT>0)frRem2=(m.hhR/m.hhT);
    else if(m.alcance===false)frRem2=0;
    else frRem2=1-Math.max(0,Math.min(100,Number(m.pct)||0))/100;
    if(!(frRem2>0))frRem2=0;
    pon('remain_drtn_hr_cnt',_crXerMNum(horas*frRem2));
    pon('target_start_date',_crXerMFecH(ini,hIni));
    pon('target_end_date',_crXerMFecH(fin,hFin));
    pon('early_start_date',_crXerMFecH(m.iniRem||ini,hIni));
    pon('early_end_date',_crXerMFecH(fin,hFin));
    pon('late_start_date','');pon('late_end_date','');
    pon('restart_date',(m.estado==='Complete')?'':_crXerMFecH(m.iniRem||ini,hIni));
    pon('reend_date',(m.estado==='Complete')?'':_crXerMFecH(fin,hFin));
    pon('rem_late_start_date','');pon('rem_late_end_date','');
    pon('total_float_hr_cnt','');pon('free_float_hr_cnt','');
    pon('phys_complete_pct',_crXerMNum(m.pct==null?0:m.pct));
    pon('complete_pct_type','CP_Phys');
    pon('status_code',estadoXer(m.estado||'NotStart'));
    pon('act_start_date',(m.estado&&m.estado!=='NotStart')?_crXerMFecH(m.iniReal,hIni):'');
    pon('act_end_date',(m.estado==='Complete')?_crXerMFecH(m.finReal||m.iniReal,hFin):'');
    /* nada heredado de la plantilla que mueva, congele o recalcule la nueva */
    pon('auto_compute_act_flag','N');pon('lock_plan_flag','N');
    pon('cstr_type','');pon('cstr_date','');pon('cstr_type2','');pon('cstr_date2','');
    pon('expect_end_date','');pon('suspend_date','');pon('resume_date','');
    pon('float_path','');pon('float_path_order','');pon('driving_path_flag','N');
    pon('external_early_start_date','');pon('external_late_end_date','');
    pon('review_end_date','');pon('review_type','RT_Begin');pon('rev_fdbk_flag','N');
    pon('tmpl_guid','');
    pon('est_wt','1');
    pon('guid',_crXerMGuid('TASK|'+modelo.cronId+'|'+cod));
    nuevasT.push('%R\t'+v.join('\t'));
    out.nuevas++;
    m.taskId=String(maxT);

    /* y su asignacion de recurso, que es de donde P6 saca las horas y el costo */
    /* una actividad NUEVA informativa (sin partidas: 0 HH y 0 costo) no
       necesita asignacion de recurso; las que ya estaban en el archivo solo la
       llevan si(qT>0||cT>0), y asi las dos ramas dicen lo mismo (X3 H11) */
    if(!TR||m.hito||m.loe||!((Number(m.hhT)||0)>0||(Number(m.costoT)||0)>0))return;
    if(!modR&&!labRsrc){out.avisos.push('la actividad nueva '+cod+' se escribio sin asignacion de recurso: el .xer no trae ninguna que copiar');return}
    maxR++;
    var w=_crXerMFila(modR?modR.v.slice():TR.cs.map(function(){return ''}),TR.cs.length);
    var falsa={i:-1,v:w,o:modR?modR.o:{}};
    var ponR=function(campo,val){var j=TR.col[campo];if(j==null)return;w[j]=val};
    ponR('taskrsrc_id',String(maxR));
    ponR('task_id',String(maxT));
    ponR('proj_id',projId||String(plantilla.o.proj_id||''));
    ponR('wbs_id',String(wbsDe(m.wbs)||raiz));
    if(labRsrc)ponR('rsrc_id',labRsrc);
    ponR('role_id','');ponR('acct_id','');
    ponR('rsrc_type','RT_Labor');
    ponR('skill_level','');ponR('rate_type','COST_PER_QTY');
    ponR('curv_id','');ponR('rsrc_curv_id','');
    ponR('target_lag_drtn_hr_cnt','0');ponR('relag_drtn_hr_cnt','0');
    ponR('ot_factor','');ponR('ts_pend_act_end_flag','N');
    ponR('rollup_dates_flag','Y');ponR('pend_complete_pct','');
    ponR('guid',_crXerMGuid('TR|'+modelo.cronId+'|'+cod));
    _crXerMPonAsig(lineas,falsa,TR,{o:{task_id:String(maxT),
        target_start_date:_crXerMFecH(ini,hIni),target_end_date:_crXerMFecH(fin,hFin),
        act_start_date:(m.estado&&m.estado!=='NotStart')?_crXerMFecH(m.iniReal,hIni):'',
        act_end_date:(m.estado==='Complete')?_crXerMFecH(m.finReal||m.iniReal,hFin):'',
        restart_date:(m.estado==='Complete')?'':_crXerMFecH(m.iniRem||ini,hIni),
        reend_date:(m.estado==='Complete')?'':_crXerMFecH(fin,hFin)},v:[]},
      {qT:m.hhT,qA:m.hhA,qR:m.hhR,cT:m.costoT,cA:m.costoA,cR:m.costoR,
       dur:horas,rdur:horas*((m.hhT>0)?(m.hhR/m.hhT):0),hIni:hIni,hFin:hFin,m:m},out);
    nuevasR.push('%R\t'+w.join('\t'))});

  /* ---------------------------------------------------------------------
     3.7 el orden de los nodos WBS tal como se ve en la hoja 2: es lo unico
     del orden que el formato .xer permite fijar (las actividades dentro de un
     nodo las ordena el layout de P6, no el archivo)
     --------------------------------------------------------------------- */
  if(WB&&WB.cs.length&&WB.col.seq_num!=null){
    var ordRuta={},nOrd=0;
    (modelo.orden||[]).slice().sort(function(a,b){
      var oa=Number((modelo.tareas[a]||{}).orden)||0,ob=Number((modelo.tareas[b]||{}).orden)||0;
      if(oa!==ob)return oa-ob;return (a<b)?-1:(a>b)?1:0}).forEach(function(cod){
      var m=modelo.tareas[cod];if(!m||m.eliminado)return;
      var r=String(m.wbs||'').split(' / ').filter(function(z){return z});
      for(var j=0;j<r.length;j++){
        var k=r.slice(0,j+1).map(function(z){return _crXerMNrm(z)}).join(' / ');
        if(ordRuta[k]==null)ordRuta[k]=++nOrd}});
    WB.filas.forEach(function(f){
      if(String(f.o.proj_node_flag||'').replace(/^\s+|\s+$/g,'')==='Y')return;
      var o9=ordRuta[rutaDeId(String(f.o.wbs_id||''))];
      if(o9==null)return;
      if(String(f.o.seq_num)===String(o9))return;
      f.v[WB.col.seq_num]=String(o9);
      lineas[f.i]='%R\t'+f.v.join('\t');out.wbsOrden++})}

  /* ---------------------------------------------------------------------
     3.8 las filas nuevas, al final de SU tabla, de atras hacia delante para
     que los numeros de linea de la primera insercion sigan valiendo
     --------------------------------------------------------------------- */
  var puntos=[];
  if(nuevasR.length&&TR)puntos.push({i:TR.ultima+1,f:nuevasR});
  if(nuevasT.length)puntos.push({i:TA.ultima+1,f:nuevasT});
  if(nuevasW.length&&WB&&WB.cs.length)puntos.push({i:WB.ultima+1,f:nuevasW});
  if(nuevasRS.length&&RS&&RS.cs.length)puntos.push({i:RS.ultima+1,f:nuevasRS});
  puntos.sort(function(a,b){return b.i-a.i});
  puntos.forEach(function(z){Array.prototype.splice.apply(lineas,[z.i,0].concat(z.f))});

  return out}

/* una fila con EXACTAMENTE los campos que declara su %F: si el .xer de origen
   trae una fila truncada, el clon heredaria la truncadura y P6 rechazaria el
   archivo por conteo de campos */
function _crXerMFila(v,n){
  var o=(v||[]).slice(0,n);
  while(o.length<n)o.push('');
  for(var i=0;i<o.length;i++)if(o[i]==null)o[i]='';
  return o}

/* vaciar una tarea que el aplicativo ya no reconoce */
function _crXerMVacia(lineas,fi,TA,TR,mias,out,conAvance){
  var pw=function(campo,val){var j=TA.col[campo];if(j==null)return;fi.v[j]=val};
  var algo=(Number(fi.o.target_work_qty)||0)>0||(Number(fi.o.act_work_qty)||0)>0||
           (Number(fi.o.remain_work_qty)||0)>0||(Number(fi.o.target_equip_qty)||0)>0;
  if(!algo&&!conAvance)return;
  pw('target_work_qty','0');pw('remain_work_qty','0');pw('act_work_qty','0');
  pw('target_equip_qty','0');pw('remain_equip_qty','0');pw('act_equip_qty','0');
  pw('act_this_per_work_qty','0');pw('act_this_per_equip_qty','0');
  /* el .xer no puede salir con restricciones NI EN LAS AJENAS: al F9 de P6 una
     restriccion de una actividad que el aplicativo no gestiona empuja igual a
     sus sucesoras gestionadas y deshace el corrido. Lo mismo el fin esperado y
     la suspension, que le hacen recalcular la duracion remanente. */
  if(out&&out.cstrAjenas==null){out.cstrAjenas=0;out.cstrAjenasL=[]}
  var _ca=String(fi.o.cstr_type||'').trim(),_cb=String(fi.o.cstr_type2||'').trim();
  if(out&&(_ca||_cb)){out.cstrAjenas++;
    if(out.cstrAjenasL.length<200)out.cstrAjenasL.push(_crTx(fi.o.task_code)+' '+(_ca||_cb).replace(/^CS_/,''))}
  pw('cstr_type','');pw('cstr_date','');pw('cstr_type2','');pw('cstr_date2','');
  pw('expect_end_date','');pw('suspend_date','');pw('resume_date','');
  if(conAvance){
    /* sin HH del aplicativo no puede quedar el % del archivo viejo: P6 ensena
       actividades "en curso" con cero horas */
    pw('phys_complete_pct','0');pw('complete_pct_type','CP_Phys');
    pw('status_code','TK_NotStart');pw('act_start_date','');pw('act_end_date','')}
  lineas[fi.i]='%R\t'+fi.v.join('\t');
  out.vaciadas++;
  (mias||[]).forEach(function(x){_crXerMCeroAsig(lineas,x,TR)})}

/* una asignacion a cero, sin horas ni costo */
function _crXerMCeroAsig(lineas,x,TR){
  if(!TR)return;
  var pr=function(campo,val){var j=TR.col[campo];if(j==null)return;x.v[j]=val};
  pr('target_qty','0');pr('remain_qty','0');pr('act_reg_qty','0');pr('act_ot_qty','0');
  pr('target_cost','0');pr('remain_cost','0');pr('act_reg_cost','0');pr('act_ot_cost','0');
  pr('act_this_per_qty','0');pr('act_this_per_cost','0');
  pr('target_qty_per_hr','0');pr('remain_qty_per_hr','0');
  pr('cost_qty_link_flag','N');
  if(x.i>=0)lineas[x.i]='%R\t'+x.v.join('\t')}

/* la asignacion que lleva las HH y el costo de la actividad */
function _crXerMPonAsig(lineas,x,TR,fi,d,out){
  var pr=function(campo,val){var j=TR.col[campo];if(j==null){if(out)out.sinCampo++;return}x.v[j]=val};
  pr('target_qty',_crXerMNum(d.qT));
  pr('act_reg_qty',_crXerMNum(d.qA));
  /* P6 suma Actual Units = act_reg_qty + act_ot_qty: si la sobretiempo vieja se
     queda, el archivo ensena mas horas reales que el aplicativo */
  pr('act_ot_qty','0');
  pr('remain_qty',_crXerMNum(d.qR));
  pr('target_qty_per_hr',((d.dur>0)?(d.qT/d.dur):0).toFixed(6));
  pr('remain_qty_per_hr',((d.rdur>0)?(d.qR/d.rdur):0).toFixed(6));
  pr('target_cost',(Number(d.cT)||0).toFixed(4));
  pr('act_reg_cost',(Number(d.cA)||0).toFixed(4));
  pr('act_ot_cost','0.0000');
  pr('remain_cost',(Number(d.cR)||0).toFixed(4));
  pr('cost_per_qty',((d.qT>0)?(d.cT/d.qT):0).toFixed(4));
  /* el costo lo manda el aplicativo: con el enlace en 'Y' P6 lo recalcula como
     cantidad x precio del recurso y lo escrito aqui se pierde */
  pr('cost_qty_link_flag','N');
  /* "this period" no es el acumulado */
  pr('act_this_per_qty','0');pr('act_this_per_cost','0.0000');
  /* las fechas de la asignacion, las de su tarea */
  pr('target_start_date',String(fi.o.target_start_date||''));
  pr('target_end_date',String(fi.o.target_end_date||''));
  /* una asignacion con inicio real y 0 unidades reales es incoherente para P6 */
  if((Number(d.qA)||0)>0){
    pr('act_start_date',String(fi.o.act_start_date||''));
    pr('act_end_date',String(fi.o.act_end_date||''))}
  else{pr('act_start_date','');pr('act_end_date','')}
  pr('restart_date',String(fi.o.restart_date||''));
  pr('reend_date',String(fi.o.reend_date||''));
  pr('rem_late_start_date','');pr('rem_late_end_date','');
  if(x.i>=0)lineas[x.i]='%R\t'+x.v.join('\t')}


/* ==========================================================================
   4. AUDITORIA - etapa 8 del contrato
   --------------------------------------------------------------------------
   Se relee el archivo YA ARMADO y se compara, campo a campo y tarea a tarea,
   con el modelo. Devuelve las diferencias, no una impresion.

   Tolerancia: 0.01 por tarea y 0.05 en totales, redondeando cada lado a 2
   decimales antes de restar.
   ========================================================================== */
function _crXerAuditoria(lineas,modelo){
  if(!lineas||!lineas.length)throw new Error('no hay archivo .xer que auditar');
  if(!modelo||!modelo.tareas)throw new Error('no hay modelo contra el que auditar');

  var TOL=0.01,TOLT=0.05;
  var difs=[],avisos=[];
  var dif=function(cod,campo,arch,app){difs.push({cod:cod,campo:campo,archivo:arch,aplicativo:app})};
  var cmp=function(cod,campo,arch,app){
    var a=_crXerM2(arch),b=_crXerM2(app);
    if(Math.abs(a-b)>TOL+1e-9){dif(cod,campo,a,b);return false}
    return true};

  var T=_crXerTablas(lineas);
  var TA=T.TASK||{filas:[],col:{},cs:[]};
  var TR=T.TASKRSRC||null;
  var TP=T.TASKPRED||null;
  var WB=T.PROJWBS||null;
  var RS=T.RSRC||null;

  var hpd=Number(modelo.hpd)||8;

  /* --- indices del archivo --- */
  var rsTipo={};
  if(RS&&RS.filas)RS.filas.forEach(function(f){rsTipo[String(f.o.rsrc_id||'')]=String(f.o.rsrc_type||'RT_Labor')});
  var esLabor=function(x){
    var t=String(x.o.rsrc_type||'')||rsTipo[String(x.o.rsrc_id||'')]||'RT_Labor';
    return t==='RT_Labor'};
  var asigDe={};
  if(TR&&TR.filas)TR.filas.forEach(function(x){(asigDe[String(x.o.task_id)]=asigDe[String(x.o.task_id)]||[]).push(x)});
  var wbsNom={},wbsPadre={},wbsRaiz='';
  if(WB&&WB.filas)WB.filas.forEach(function(f){
    var id=String(f.o.wbs_id||'');
    wbsNom[id]=_crTx(f.o.wbs_name||'');
    wbsPadre[id]=String(f.o.parent_wbs_id||'');
    if(String(f.o.proj_node_flag||'').replace(/^\s+|\s+$/g,'')==='Y'&&!wbsRaiz)wbsRaiz=id});
  var rutaDe=function(id){
    var o=[],g=0;
    while(id&&wbsNom[id]!==undefined&&g++<24){o.unshift(_crXerMNrm(wbsNom[id]));id=wbsPadre[id]}
    return o.join(' / ')};

  var enArch={},idDe={},codDe={};
  TA.filas.forEach(function(f){
    var cod=_crTx(f.o.task_code);
    enArch[cod.toUpperCase()]=f;
    idDe[cod.toUpperCase()]=String(f.o.task_id||'');
    codDe[String(f.o.task_id||'')]=cod});

  /* --- tarea a tarea --- */
  var tot={hhT:0,hhA:0,hhR:0,costoT:0,costoA:0};
  var nOk=0,nRev=0;
  var codigos=(modelo.orden&&modelo.orden.length)?modelo.orden.slice():Object.keys(modelo.tareas);

  codigos.forEach(function(cod){
    var m=modelo.tareas[cod];if(!m)return;
    var f=enArch[String(cod).toUpperCase()];

    if(m.eliminado){
      if(f)dif(cod,'borrada','sigue en el archivo','quitada en el aplicativo');
      return}
    if(!f){
      dif(cod,'ausente','\u2014',_crXerMil(m.hhT)+' hh');
      return}
    nRev++;
    var n0=difs.length;

    /* --- LA REGLA DEL REMANENTE: remain_drtn_hr_cnt = rd x horas de jornada,
       en TODAS las actividades, con HH y sin ellas. Las de nivel de esfuerzo y
       resumen no se tocan (P6 las deriva) y no traen rd. --- */
    if(m.rd!=null&&!m.loe){
      var hpdT=Number(m.hpdCal)||hpd;
      var espRem=_crXerM2((Number(m.rd)||0)*hpdT);
      var remArch=_crXerM2(Number(f.o.remain_drtn_hr_cnt)||0);
      if(Math.abs(remArch-espRem)>0.02+1e-9)
        dif(cod,'duracion remanente (h)',remArch,espRem);
      if(m.alcance===false&&remArch>0.02)
        dif(cod,'remanente sin alcance',remArch+' h',0)}

    var lab=(asigDe[String(f.o.task_id)]||[]).filter(esLabor);
    var aT=Number(f.o.target_work_qty)||0;
    var aA=Number(f.o.act_work_qty)||0;
    var aR=Number(f.o.remain_work_qty)||0;
    var rT=0,rA=0,rR=0,cT=0,cA=0,cR=0;
    lab.forEach(function(x){
      rT+=Number(x.o.target_qty)||0;
      rA+=(Number(x.o.act_reg_qty)||0)+(Number(x.o.act_ot_qty)||0);
      rR+=Number(x.o.remain_qty)||0});
    (asigDe[String(f.o.task_id)]||[]).forEach(function(x){
      cT+=Number(x.o.target_cost)||0;
      cA+=(Number(x.o.act_reg_cost)||0)+(Number(x.o.act_ot_cost)||0);
      cR+=Number(x.o.remain_cost)||0});

    /* informativa: se respeta lo que trae el archivo, no se audita */
    if(m.informativa&&!(m.hhT>0||m.costoT>0)){
      tot.hhT+=aT;tot.hhA+=aA;tot.hhR+=aR;tot.costoT+=cT;tot.costoA+=cA;
      if(difs.length===n0)nOk++;
      return}

    var espT=(m.hito||m.loe)?0:m.hhT;
    var espA=(m.hito||m.loe)?0:m.hhA;
    var espR=(m.hito||m.loe)?0:m.hhR;
    var espCT=(m.hito||m.loe)?0:m.costoT;
    var espCA=(m.hito||m.loe)?0:m.costoA;

    cmp(cod,'HH presupuestadas (TASK)',aT,espT);
    cmp(cod,'HH reales (TASK)',aA,espA);
    cmp(cod,'HH remanentes (TASK)',aR,espR);
    if(lab.length||espT>0){
      cmp(cod,'HH presupuestadas (asignaciones)',rT,espT);
      cmp(cod,'HH reales (asignaciones)',rA,espA);
      cmp(cod,'HH remanentes (asignaciones)',rR,espR)}
    else if(espT>0&&TR)
      dif(cod,'asignacion','ninguna LABOR','1 asignacion con '+_crXerMil(espT)+' hh');
    cmp(cod,'costo presupuestado',cT,espCT);
    cmp(cod,'costo real',cA,espCA);
    cmp(cod,'costo remanente',cR,(m.hito||m.loe)?0:m.costoR);

    /* pct y estado */
    if(m.estado){
      var pcA=Number(f.o.phys_complete_pct)||0;
      var pcM=(m.pct==null)?0:Number(m.pct);
      if(Math.abs(_crXerM2(pcA)-_crXerM2(pcM))>TOL+1e-9)dif(cod,'% fisico',_crXerM2(pcA),_crXerM2(pcM));
      var stA=String(f.o.status_code||'');
      var stM=(m.estado==='Complete')?'TK_Complete':(m.estado==='Active'?'TK_Active':'TK_NotStart');
      if(stA!==stM)dif(cod,'estado',stA,stM);
      if(String(f.o.complete_pct_type||'')!=='CP_Phys')
        dif(cod,'tipo de %',String(f.o.complete_pct_type||'\u2014'),'CP_Phys');
      /* fechas reales */
      var aI=_crXerMFec(f.o.act_start_date),aF=_crXerMFec(f.o.act_end_date);
      var eI=(m.estado==='NotStart')?'':String(m.iniReal||'');
      var eF=(m.estado==='Complete')?String(m.finReal||m.iniReal||''):'';
      if(aI!==eI)dif(cod,'inicio real',aI||'\u2014',eI||'\u2014');
      if(aF!==eF)dif(cod,'fin real',aF||'\u2014',eF||'\u2014')}

    /* duracion: con HH y duracion 0 P6 borra las unidades al importar */
    if(espT>0&&!((Number(f.o.target_drtn_hr_cnt)||0)>0))
      dif(cod,'duracion','0','>0 (P6 le borraria las '+_crXerMil(espT)+' hh)');

    /* nombre */
    var nomM=_crXerMTx(m.nombre,200);
    if(nomM&&_crTx(f.o.task_name)!==nomM)
      dif(cod,'nombre',_crTx(f.o.task_name),nomM);

    /* WBS */
    if(WB&&WB.filas&&WB.filas.length){
      var idW=String(f.o.wbs_id||'');
      if(wbsNom[idW]===undefined)dif(cod,'WBS','wbs_id '+idW+' no existe en PROJWBS',String(m.wbs||''));
      else{
        var rM=String(m.wbs||'').split(' / ').filter(function(z){return z})
          .map(function(z){return _crXerMNrm(z)}).join(' / ');
        var rA2=rutaDe(idW);
        /* la ruta del archivo siempre empieza por el nodo raiz; la del
           aplicativo tambien, salvo una ruta inventada a mano, que se cuelga
           del raiz. Por eso vale que la del archivo TERMINE en la del modelo. */
        var casa=(rM===rA2)||(rA2.length>rM.length&&rA2.slice(rA2.length-rM.length-3)===' / '+rM);
        if(rM&&!casa)dif(cod,'WBS',wbsNom[idW]||idW,String(m.wbs||''))}}

    tot.hhT+=aT;tot.hhA+=aA;tot.hhR+=aR;tot.costoT+=cT;tot.costoA+=cA;
    if(difs.length===n0)nOk++});

  /* las tareas del archivo que el modelo no conoce: tienen que estar vacias */
  TA.filas.forEach(function(f){
    var cod=_crTx(f.o.task_code);
    if(modelo.tareas[cod]||modelo.tareas[cod.toUpperCase()])return;
    var hay=false;
    Object.keys(modelo.tareas).forEach(function(k){if(String(k).toUpperCase()===cod.toUpperCase())hay=true});
    if(hay)return;
    var q=Number(f.o.target_work_qty)||0;
    if(q>TOL)dif(cod,'fuera del aplicativo',_crXerM2(q)+' hh','0 (esa actividad no existe en el aplicativo)')});

  /* --- relaciones --- */
  var enRel={},dupRel=[];
  if(TP&&TP.filas)TP.filas.forEach(function(p){
    var su=codDe[String(p.o.task_id)],pr=codDe[String(p.o.pred_task_id)];
    if(!su||!pr)return;
    var k=su.toUpperCase()+'|'+pr.toUpperCase();
    if(enRel[k])dupRel.push(su+' <- '+pr);
    enRel[k]={tipo:String(p.o.pred_type||'PR_FS').replace(/^PR_/,''),
              lagH:Number(p.o.lag_hr_cnt)||0}});
  var vistas={};
  (modelo.relaciones||[]).forEach(function(r){
    var k=String(r.succ).toUpperCase()+'|'+String(r.pred).toUpperCase();
    if(r.eliminado){
      if(enRel[k])dif(r.succ+' <- '+r.pred,'relacion','sigue en el archivo','quitada en el aplicativo');
      return}
    vistas[k]=1;
    if(!idDe[String(r.succ).toUpperCase()]||!idDe[String(r.pred).toUpperCase()]){
      avisos.push('la relacion '+r.succ+' <- '+r.pred+' apunta a una actividad que no esta en el .xer');
      return}
    var a=enRel[k];
    if(!a){dif(r.succ+' <- '+r.pred,'relacion','\u2014','viva en el aplicativo');return}
    if(a.tipo!==String(r.tipo||'FS'))dif(r.succ+' <- '+r.pred,'tipo de relacion',a.tipo,String(r.tipo||'FS'));
    /* el lag viaja en HORAS: dias del aplicativo x horas por dia del calendario */
    var lagEsp=_crXerM2((Number(r.lagD)||0)*hpd);
    if(Math.abs(_crXerM2(a.lagH)-lagEsp)>TOL+1e-9)
      dif(r.succ+' <- '+r.pred,'lag (horas)',_crXerM2(a.lagH),lagEsp)});
  Object.keys(enRel).forEach(function(k){
    if(vistas[k])return;
    var p=k.split('|');
    avisos.push('la relacion '+p[0]+' <- '+p[1]+' esta en el .xer y el aplicativo no la conoce (se deja como esta)')});
  /* la misma pareja dos veces en TASKPRED es un problema estructural del
     archivo (P6 la rechaza como repetida) y lo resuelve quien escribe
     TASKPRED, no el modelo: aqui se avisa, no se cuenta como diferencia */
  dupRel.forEach(function(z){avisos.push('la relacion '+z+' esta DOS veces en el archivo: P6 la rechaza como repetida')});

  /* --- fecha de datos --- */
  var P0=(T.PROJECT&&T.PROJECT.filas&&T.PROJECT.filas[0])||null;
  var fechaDatos=P0?_crXerMFec(P0.o.last_recalc_date):'';
  if(modelo.corte&&fechaDatos!==String(modelo.corte))
    dif('PROJECT','fecha de datos',fechaDatos||'\u2014',String(modelo.corte));

  /* --- totales --- */
  tot.hhT=_crXerM2(tot.hhT);tot.hhA=_crXerM2(tot.hhA);tot.hhR=_crXerM2(tot.hhR);
  tot.costoT=_crXerM2(tot.costoT);tot.costoA=_crXerM2(tot.costoA);
  var tabla={hhT:_crXerM2(modelo.totales.hhT),hhA:_crXerM2(modelo.totales.hhA),
             costoT:_crXerM2(modelo.totales.costoT),costoA:_crXerM2(modelo.totales.costoA)};
  var perd=modelo.perdido||{hhT:0,hhA:0,costoT:0,costoA:0};
  var esperado={hhT:_crXerM2(tabla.hhT-perd.hhT),hhA:_crXerM2(tabla.hhA-perd.hhA),
                costoT:_crXerM2(tabla.costoT-perd.costoT),costoA:_crXerM2(tabla.costoA-perd.costoA)};
  var totMal=[];
  if(Math.abs(tot.hhT-esperado.hhT)>TOLT+1e-9)totMal.push('HH presupuestadas');
  if(Math.abs(tot.costoT-esperado.costoT)>TOLT+1e-9)totMal.push('costo presupuestado');
  /* en "tal cual" los reales son los del archivo original, no los de la tabla */
  if(String(modelo.modo||'')!=='tal'){
    if(Math.abs(tot.hhA-esperado.hhA)>TOLT+1e-9)totMal.push('HH reales');
    if(Math.abs(tot.costoA-esperado.costoA)>TOLT+1e-9)totMal.push('costo real')}
  totMal.forEach(function(k){difs.push({cod:'TOTAL',campo:k,
    archivo:(k.indexOf('costo')===0)?((k.indexOf('real')>0)?tot.costoA:tot.costoT):((k.indexOf('reales')>0)?tot.hhA:tot.hhT),
    aplicativo:(k.indexOf('costo')===0)?((k.indexOf('real')>0)?esperado.costoA:esperado.costoT):((k.indexOf('reales')>0)?esperado.hhA:esperado.hhT)})});

  var faltan=(modelo.sinArchivo||[]).slice();

  /* --- LA REGLA DEL REMANENTE: las actividades SIN ALCANCE (remanente 0) y
     las que, sin HH, van por su % de avance --- */
  var sinAlcance=[],porPct=[];
  codigos.forEach(function(cod){
    var m=modelo.tareas[cod];
    if(!m||m.eliminado||m.loe)return;
    var fz=enArch[String(cod).toUpperCase()];
    var remA=fz?_crXerM2(Number(fz.o.remain_drtn_hr_cnt)||0):0;
    if(m.alcance===false){
      sinAlcance.push({cod:cod,nombre:String(m.nombre||''),
        motivo:String(m.motivoSinAlcance||'sin alcance en este cronograma'),
        partidas:(m.partidasFuera||[]).slice(),
        dias:Number(m.dias)||0,rd:Number(m.rd)||0,remH:remA,pct:_crXerM2(m.pct==null?0:m.pct)});
      return}
    if(m.porHH===false&&m.rd!=null&&!m.hito&&!((Number(m.hhT)||0)>0))
      /* las informativas van con el % del propio archivo (m.pct viene null) */
      porPct.push({cod:cod,nombre:String(m.nombre||''),
        pct:_crXerM2((m.pct==null)?(fz?(Number(fz.o.phys_complete_pct)||0):0):m.pct),
        dias:Number(m.dias)||0,
        rd:Number(m.rd)||0,remH:remA,
        partidas:(m.items||[]).slice()})});

  /* --- el resumen en espanol, con dos decimales y miles con apostrofo --- */
  var R=[];
  var ok=(difs.length===0);
  R.push((ok?'\u2714 CUADRA':'\u26d4 NO CUADRA')+' \u00b7 '+nOk+' de '+nRev+' actividad(es) revisadas sin diferencias.');
  R.push('Tabla '+_crXerMil(tabla.hhT)+' hh / archivo '+_crXerMil(tot.hhT)+' hh'+
    ((Math.abs(tabla.hhT-tot.hhT)>0.005)?(' \u00b7 faltan '+_crXerMil(tabla.hhT-tot.hhT)+' hh'):' \u00b7 sin diferencia')+'.');
  R.push('HH reales: '+((String(modelo.modo||'')==='tal')
      ?('las del archivo original (modo tal cual): '+_crXerMil(tot.hhA)+' hh')
      :('tabla '+_crXerMil(tabla.hhA)+' hh / archivo '+_crXerMil(tot.hhA)+' hh'))+
    ' \u00b7 remanente del archivo '+_crXerMil(tot.hhR)+' hh.');
  R.push('Costo: tabla '+_crXerMil(tabla.costoT)+' / archivo '+_crXerMil(tot.costoT)+
    ' \u00b7 costo real tabla '+_crXerMil(tabla.costoA)+' / archivo '+_crXerMil(tot.costoA)+'.');
  R.push('Fecha de datos del archivo: '+(fechaDatos||'\u2014')+' (corte '+(modelo.corte||'\u2014')+').');

  var pierden=faltan.filter(function(s){return s.cuenta!==false});
  var fuera=faltan.filter(function(s){return s.cuenta===false});
  if(pierden.length){
    var sH=0,sC=0;
    pierden.forEach(function(s){sH+=Number(s.hhT)||0;sC+=Number(s.costoT)||0});
    R.push('');
    R.push('PARTIDAS DE LA TABLA QUE NO LLEGAN AL ARCHIVO ('+pierden.length+', '+
      _crXerMil(sH)+' hh y '+_crXerMil(sC)+' de costo):');
    pierden.forEach(function(s){
      R.push('  \u00b7 '+s.id+(s.apartado?(' ['+s.apartado+']'):'')+' '+s.nombre+
        ' \u2014 '+_crXerMil(s.hhT)+' hh presupuestadas, '+_crXerMil(s.hhA)+' hh reales, '+
        _crXerMil(s.costoT)+' de costo \u00b7 '+s.motivo)})}
  else R.push('Ninguna partida del TOTAL de la tabla se queda fuera del archivo.');
  if(fuera.length){
    var cH=0,cC=0;
    fuera.forEach(function(s){cH+=Number(s.hhContrato)||0;cC+=Number(s.costoContrato)||0});
    R.push('');
    R.push('PARTIDAS DEL CONTRATO QUE ESTE CRONOGRAMA NO CUENTA ('+fuera.length+', '+
      _crXerMil(cH)+' hh de contrato y '+_crXerMil(cC)+' de costo; no descuadran el total):');
    fuera.forEach(function(s){
      R.push('  \u00b7 '+s.id+' '+s.nombre+' \u2014 '+_crXerMil(s.hhContrato)+
        ' hh de contrato, '+_crXerMil(s.costoContrato)+' de costo \u00b7 '+s.motivo)})}

  if(sinAlcance.length){
    R.push('');
    R.push('ACTIVIDADES SIN ALCANCE EN ESTE CRONOGRAMA ('+sinAlcance.length+'): remanente 0, no restan dias');
    sinAlcance.forEach(function(s){
      R.push('  · '+s.cod+' '+s.nombre+' — '+_crXerMil(s.dias)+' d de duracion, resta '+
        _crXerMil(s.rd)+' d ('+_crXerMil(s.remH)+' h en el archivo) · '+s.motivo)})}
  if(porPct.length){
    R.push('');
    R.push('ACTIVIDADES SIN HH QUE VAN POR SU % DE AVANCE ('+porPct.length+'):');
    porPct.forEach(function(s){
      R.push('  · '+s.cod+' '+s.nombre+' — '+_crXerMil(s.pct)+' % de '+
        _crXerMil(s.dias)+' d: resta '+_crXerMil(s.rd)+' d ('+_crXerMil(s.remH)+' h)'+
        (s.partidas.length?(' · partidas: '+s.partidas.join(', ')):' · sin partidas (informativa)'))})}

  if(difs.length){
    R.push('');
    R.push('DIFERENCIAS ('+difs.length+'):');
    difs.forEach(function(d){
      var a=(typeof d.archivo==='number')?_crXerMil(d.archivo):String(d.archivo);
      var b=(typeof d.aplicativo==='number')?_crXerMil(d.aplicativo):String(d.aplicativo);
      R.push('  \u00b7 '+d.cod+' \u2014 '+d.campo+': archivo '+a+' / aplicativo '+b)})}

  if(avisos.length){
    R.push('');
    R.push('AVISOS ('+avisos.length+'):');
    avisos.forEach(function(a){R.push('  \u00b7 '+a)})}
  if((modelo.avisos||[]).length){
    R.push('');
    R.push('AVISOS DEL MODELO ('+modelo.avisos.length+'):');
    modelo.avisos.forEach(function(a){R.push('  \u00b7 '+a)})}

  return {ok:ok,difs:difs,faltan:faltan,avisos:avisos,
    sinAlcance:sinAlcance,porPct:porPct,
    totales:{tabla:tabla,archivo:{hhT:tot.hhT,hhA:tot.hhA,hhR:tot.hhR,costoT:tot.costoT,costoA:tot.costoA},
             esperado:esperado,perdido:perd},
    fechaDatos:fechaDatos,revisadas:nRev,sinDiferencias:nOk,
    resumen:R.join('\n')}}


/* ---- para poder probarlo con Node contra datos reales de PRUEBA-XER ------- */
try{if(typeof module!=='undefined'&&module.exports){module.exports={
  _crXerRefresco:_crXerRefresco,_crXerModelo:_crXerModelo,
  _crXerEscribe:_crXerEscribe,_crXerAuditoria:_crXerAuditoria,
  _crXerM2:_crXerM2,_crXerMNum:_crXerMNum,_crXerMTx:_crXerMTx,_crXerMNrm:_crXerMNrm,
  _crXerMFec:_crXerMFec,_crXerMFecH:_crXerMFecH,_crXerMCierre:_crXerMCierre,
  _crXerMGuid:_crXerMGuid,_crXerMGana:_crXerMGana,_crXerMLineas:_crXerMLineas,
  _crXerMValores:_crXerMValores,_crXerMCuadra:_crXerMCuadra,_crXerMil:_crXerMil,
  _crXerMHpd:_crXerMHpd,_crXerMClndr:_crXerMClndr,_crXerMFila:_crXerMFila,
  _crXerMVacia:_crXerMVacia,_crXerMCeroAsig:_crXerMCeroAsig,_crXerMPonAsig:_crXerMPonAsig
}}}catch(_emod){}

/* ---------- fechas, calendario, cabecera, validacion, orquestador y UI ---------- */
/* ############################################################################
   MOTOR DE EXPORTACION .xer DE FLOCULANTES  -  PARTE DEL AGENTE F

   Calendario real del archivo, fechas y predecesoras, cabecera del proyecto,
   validacion estructural, orquestador de las ocho etapas y la interfaz.

   Todo ES5 (var, function, sin arrow, sin template strings, sin ?.), con
   async function / await como el resto de index.html.

   Lo que este bloque REEMPLAZA de index.html:
     _crPlano (7383), _crBytes (7397), _crXerGuid (7421), _crExportUI (7818)
   Lo que deja OBSOLETO:
     _crXerConRelaciones (4427), _crXerComprueba (4442), _crXerRelaciones (4489),
     _crXerLab/_crXerSnap/_crXerDias/_crXerFinDias/_crXerHoraFin (7430-7441),
     _crXerPlanTarea (7448), _crXerHpd (7464), _crXerFechaDatos (7718),
     _crXerRenombra (7733), _crExportar (7752), _crFecXer (7379) y el par
     onclick de #_crFeXrel (3832) + _crFeXerBaja (3847).
   Lo que NECESITA del agente M:
     _crXerRefresco, _crXerModelo, _crXerEscribe, _crXerAuditoria.
   ############################################################################ */

/* ============================================================================
   AGENTE F - motor de exportacion .xer de Floculantes
   Bloque 1/4 - texto, bytes Windows-1252, numeros y CALENDARIO REAL.

   Todo ES5: var, function, sin arrow, sin template strings, sin ?.
   Depende de index.html: _crXerTablas, _crXerFec, _crTx, _crFec,
   _crASerial, _crDeSerial.
   ============================================================================ */

/* ---------------------------------------------------------------------------
   0.1  Un valor de campo del .xer.
   El .xer es tabulado puro: un tabulador o un salto dentro de un nombre parte
   la fila en mas campos de los que declara el %F y P6 rechaza el archivo.
   P6 codifica los saltos de linea DENTRO de un campo con dos DEL (\x7f\x7f);
   aqui no se generan, se colapsan a un espacio.
   --------------------------------------------------------------------------- */
function _crXerVal(s,max){
  var x=String(s==null?'':s);
  x=x.replace(/[\t\r\n\v\f\x7f]+/g,' ').replace(/\s+/g,' ').replace(/^ | $/g,'');
  if(max>0)x=x.slice(0,max);
  return x}

/* ---------------------------------------------------------------------------
   0.2  _crPlano: el texto del archivo tal como se va a escribir en bytes.
   REEMPLAZA a la version de index.html (~7383).

   Cambios respecto a la vieja y por que:
   a) NO se aplanan tildes ni la ene. El archivo se LEE con
      new TextDecoder('windows-1252') (index.html ~3206) y se escribe con
      charCodeAt&0xff, que para 0xA0-0xFF es exactamente cp1252; devolver el
      texto tal cual es un viaje de ida y vuelta exacto. Aplanarlo cambiaba
      TODOS los nombres de actividad y de WBS del cliente.
   b) Se CONSERVA \x7f (DEL). Comprobado en el crudo real de PRUEBA-XER:
      CALENDAR.clndr_data trae 384 DEL, OBS 18 y SCHEDOPTIONS 2, siempre en
      pareja \x7f\x7f, que es como P6 codifica un salto de linea dentro de un
      campo. La version vieja los borraba y destrozaba el calendario.
   c) Se conserva el tramo alto de cp1252 (0xA0-0xFF) y se MAPEAN al tramo
      0x80-0x9F los caracteres unicode que cp1252 pone ahi (el euro es 0x80,
      no 0xAC). En el crudo real hay libra, yen y euro en CURRTYPE.
   d) La COMILLA DOBLE SE SIGUE DUPLICANDO. Comprobado con evidencia sobre el
      crudo original de PRUEBA-XER: 76 comillas, 38 parejas, y la fila de OBS
      trae <body bgcolor=""#ffffff"">, que en el HTML real es una sola comilla.
      Es decir: P6 ESCRIBE la comilla duplicada. Colapsar y volver a duplicar
      es idempotente sobre el archivo original y ademas escapa bien las
      comillas de los textos que pone el aplicativo (TUBERIA 12").
   --------------------------------------------------------------------------- */
var _XER_CP1252={'€':'','‚':'','ƒ':'','„':'',
  '…':'','†':'','‡':'','ˆ':'','‰':'',
  'Š':'','‹':'','Œ':'','Ž':'','•':'',
  '˜':'','™':'','š':'','›':'','œ':'',
  'ž':'','Ÿ':''};
function _crPlano(t){
  var x=String(t==null?'':t);
  /* NFC: la e con acento descompuesta (e + U+0301) se junta en un solo
     caracter que cp1252 si tiene */
  try{x=x.normalize('NFC')}catch(_e){}
  x=x.replace(/[‘’‛]/g,"'")
     .replace(/[“”‟]/g,'"')
     .replace(/[‐-―]/g,'-')
     .replace(/ /g,' ');
  /* fuera todo lo que cp1252 no puede representar; se dejan pasar los que
     luego se mapean al tramo 0x80-0x9F */
  x=x.replace(/[^\x09\x0a\x0d\x20-\x7e\x7f -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ•˜™š›œžŸ]/g,'');
  x=x.replace(/[€‚ƒ„…†‡ˆ‰Š‹ŒŽ•˜™š›œžŸ]/g,function(ch){return _XER_CP1252[ch]||''});
  /* la comilla doble, como la escribe P6 */
  x=x.replace(/""/g,'"').replace(/"/g,'""');
  return x}

/* los bytes del archivo: un Blob hecho con una cadena sale siempre en UTF-8
   por mucho que el MIME diga otra cosa, por eso se entregan bytes. */
function _crBytes(txt){
  var t=_crPlano(txt),b=new Uint8Array(t.length);
  for(var i=0;i<t.length;i++){var n=t.charCodeAt(i);b[i]=(n>255?63:n)&0xff}
  return b}

/* ---------------------------------------------------------------------------
   0.3  Numeros del .xer: sin notacion exponencial, sin coma decimal y sin
   separador de miles. P6 lee el campo con un parser de punto decimal a secas.
   --------------------------------------------------------------------------- */
function _crXerNum(x,dec){
  var n=Number(x);if(!isFinite(n))n=0;
  var d=(dec==null)?2:dec,p=Math.pow(10,d);
  n=Math.round(n*p)/p;
  if(Math.abs(n)<0.5/p)n=0;
  var s=n.toFixed(d);
  if(s.indexOf('.')>=0)s=s.replace(/0+$/,'').replace(/\.$/,'');
  if(s==='-0')s='0';
  return s}

/* dos decimales siempre, para los mensajes */
function _crXer2(x){var n=Number(x);if(!isFinite(n))n=0;return n.toFixed(2)}

/* ---------------------------------------------------------------------------
   0.4  Guid con la pinta de los de P6, DETERMINISTA cuando se le da semilla:
   el mismo objeto saca siempre el mismo guid y dos exportaciones seguidas dan
   el mismo archivo. El caracter 22 de un base64 de 16 bytes solo lleva 2 bits
   utiles, asi que sale de A Q g w.
   REEMPLAZA a la version de index.html (~7421); la llamada sin argumento sigue
   siendo aleatoria, asi que el codigo viejo no se rompe.
   --------------------------------------------------------------------------- */
function _crXerGuid(sem){
  var A='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',o='',i;
  if(sem==null||sem===''){
    for(i=0;i<21;i++)o+=A.charAt(Math.floor(Math.random()*64));
    return o+'AQgw'.charAt(Math.floor(Math.random()*4))}
  var s=String(sem),h1=2166136261>>>0,h2=2654435761>>>0;
  for(i=0;i<s.length;i++){
    h1=(((h1^s.charCodeAt(i))>>>0)*16777619)>>>0;
    h2=(((h2^(s.charCodeAt(i)+i))>>>0)*2246822519)>>>0}
  for(i=0;i<21;i++){h1=((h1*1103515245)+12345)>>>0;h2=(h2^(h1>>>7))>>>0;o+=A.charAt((h1^h2)&63)}
  h1=((h1*1103515245)+12345)>>>0;
  return o+'AQgw'.charAt(h1&3)}

/* ============================================================================
   1.  EL CALENDARIO REAL DEL .XER  (CALENDAR.clndr_data)

   Formato comprobado sobre el crudo real de PRUEBA-XER (cronograma
   'Fluculantes 5x2', clndr_id 7055, default_flag Y, day_hr_cnt 10):

     (0||CalendarData()(
       (0||DaysOfWeek()(
         (0||1()())                                  <- domingo, no laborable
         (0||2()( (0||0(s|07:00|f|12:00)())
                  (0||1(s|13:00|f|18:00)()) ))       <- lunes, 5 h + 5 h = 10 h
         ...
         (0||7()()) ))                               <- sabado, no laborable
       (0||VIEW(ShowTotal|N)())
       (0||Exceptions()(
         (0||0(d|36897)())                           <- feriado (sin turnos)
         (0||81(d|45598)( (0||0(s|08:00|f|16:00)()) ))  <- dia especial con horario
       )))

   * El indice del dia va de 1 (domingo) a 7 (sabado); aqui se guarda en el
     indice de getUTCDay() (0=domingo .. 6=sabado), o sea N-1.
   * El serial de (d|NNNNN) es el mismo serial que usa el aplicativo
     (_crASerial / _crDeSerial: dias desde 1899-12-30). Comprobado:
     45573 = 2024-10-08 (Combate de Angamos) y 45597 = 2024-11-01.
   * Los espacios que separan los nodos son en realidad parejas \x7f\x7f
     (saltos de linea codificados por P6) mas espacios; el parser no depende
     de ellos.
   ============================================================================ */

/* devuelve el indice JUSTO DESPUES del parentesis que cierra el nodo que
   empieza en i (s.charAt(i) tiene que ser '(') */
function _crXerCalNodo(s,i){
  var d=0;
  for(var k=i;k<s.length;k++){
    var ch=s.charAt(k);
    if(ch==='(')d++;
    else if(ch===')'){d--;if(d<=0)return k+1}}
  return s.length}

/* 'HH:MM' -> horas decimales; '' si no parsea */
function _crXerHoraNum(h){
  var m=/^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(h||''));
  if(!m)return '';
  return Number(m[1])+Number(m[2])/60}
/* horas decimales -> 'HH:MM' (redondeo al minuto, tope 23:59) */
function _crXerHoraTxt(x){
  var t=Number(x);if(!isFinite(t)||t<0)t=0;
  var mm=Math.round(t*60);if(mm>1439)mm=1439;
  var hh=Math.floor(mm/60);mm=mm-hh*60;
  return (hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm}

/* los turnos de un nodo: [{a:7,b:12},{a:13,b:18}] */
function _crXerCalTurnos(cuerpo){
  var re=/\(s\|(\d{1,2}:\d{2})\|f\|(\d{1,2}:\d{2})\)/g,m,out=[];
  while((m=re.exec(cuerpo))){
    var a=_crXerHoraNum(m[1]),b=_crXerHoraNum(m[2]);
    if(a===''||b==='')continue;
    if(b<=a)b=b+24*Math.ceil((a-b+0.0001)/24);   /* turno que cruza medianoche */
    out.push({a:a,b:b})}
  out.sort(function(x,y){return x.a-y.a});
  return out}
function _crXerCalHorasDe(turnos){var h=0;(turnos||[]).forEach(function(t){h+=(t.b-t.a)});return Math.round(h*1e6)/1e6}

/* el calendario por defecto cuando el archivo no trae CALENDAR legible:
   lunes a viernes, 07:00-18:00 con una hora de refrigerio, 10 h */
function _crXerCalDefecto(){
  var tur=[{a:7,b:12},{a:13,b:18}],dias=[false,true,true,true,true,true,false],hor=[],tt=[];
  for(var d=0;d<7;d++){hor.push(dias[d]?10:0);tt.push(dias[d]?tur:[])}
  return {ok:false,clndrId:'',nombre:'(supuesto)',hpd:10,dias:dias,horas:hor,turnos:tt,
    abre:'07:00',cierra:'18:00',feriados:{},esp:{},semana:50}}

var _XER_CAL={sig:'',cals:{},def:null};
function _crXerCalReset(){_XER_CAL={sig:'',cals:{},def:null}}

/* ---------------------------------------------------------------------------
   _crXerCalendario(lineas,clndrId)
   Devuelve el calendario de ese clndr_id (o el del proyecto, o el primero):
     {hpd, dias:[0..6 booleanos], abre:'07:00', cierra:'18:00', feriados:{iso:1},
      horas:[0..6], turnos:[0..6][], esp:{iso:{horas,turnos}}, clndrId, nombre,
      semana, ok}
   Nunca cablea lunes-viernes ni 8 h: solo cae al supuesto si no hay CALENDAR.
   --------------------------------------------------------------------------- */
function _crXerCalendario(lineas,clndrId){
  var sig=String(lineas.length)+'|'+String(lineas[0]||'').slice(0,60)+'|'+String(lineas[Math.max(0,lineas.length-3)]||'');
  if(_XER_CAL.sig!==sig){
    _XER_CAL={sig:sig,cals:{},def:null};
    var T=_crXerTablas(lineas),CAL=T.CALENDAR,PR=T.PROJECT;
    var idProy=(PR&&PR.filas.length)?String(PR.filas[0].o.clndr_id||''):'';
    if(CAL&&CAL.filas.length){
      CAL.filas.forEach(function(f){
        var C=_crXerCalParsea(String(f.o.clndr_data||''),Number(f.o.day_hr_cnt)||0);
        C.clndrId=String(f.o.clndr_id||'');
        C.nombre=_crXerVal(f.o.clndr_name,60);
        C.semana=Number(f.o.week_hr_cnt)||0;
        _XER_CAL.cals[C.clndrId]=C;
        if(!_XER_CAL.def&&String(f.o.default_flag||'').trim()==='Y')_XER_CAL.def=C});
      if(idProy&&_XER_CAL.cals[idProy])_XER_CAL.def=_XER_CAL.cals[idProy];
      if(!_XER_CAL.def)_XER_CAL.def=_XER_CAL.cals[String(CAL.filas[0].o.clndr_id||'')]||null}}
  var k=String(clndrId==null?'':clndrId);
  return _XER_CAL.cals[k]||_XER_CAL.def||_crXerCalDefecto()}

function _crXerCalParsea(dat,dayHr){
  var C={ok:false,clndrId:'',nombre:'',hpd:0,dias:[false,false,false,false,false,false,false],
    horas:[0,0,0,0,0,0,0],turnos:[[],[],[],[],[],[],[]],abre:'',cierra:'',feriados:{},esp:{},semana:0};
  var s=String(dat||'');
  /* --- dias de la semana --- */
  var p=s.indexOf('(0||DaysOfWeek');
  if(p>=0){
    var blo=s.slice(p,_crXerCalNodo(s,p));
    var re=/\(0\|\|([1-7])\(\)/g,m;
    while((m=re.exec(blo))){
      var i0=m.index,i1=_crXerCalNodo(blo,i0);
      var tur=_crXerCalTurnos(blo.slice(i0,i1));
      var d=(Number(m[1])||1)-1;                 /* 1=domingo -> getUTCDay 0 */
      C.turnos[d]=tur;C.horas[d]=_crXerCalHorasDe(tur);C.dias[d]=tur.length>0;
      C.ok=true;
      re.lastIndex=i1}}
  /* --- excepciones: feriados (sin turnos) y dias con horario propio --- */
  var q=s.indexOf('(0||Exceptions');
  if(q>=0){
    var bq=s.slice(q,_crXerCalNodo(s,q));
    var rx=/\(0\|\|\d+\(d\|(\d+)\)/g,x;
    while((x=rx.exec(bq))){
      var j0=x.index,j1=_crXerCalNodo(bq,j0);
      var tt=_crXerCalTurnos(bq.slice(j0,j1));
      var iso='';try{iso=_crDeSerial(Number(x[1])||0)}catch(_e){iso=''}
      if(iso){
        if(tt.length)C.esp[iso]={horas:_crXerCalHorasDe(tt),turnos:tt};
        else C.feriados[iso]=1}
      rx.lastIndex=j1}}
  /* --- apertura y cierre de la jornada --- */
  var ab='',ci='';
  for(var d2=0;d2<7;d2++){
    var t2=C.turnos[d2];if(!t2.length)continue;
    var a=_crXerHoraTxt(t2[0].a),b=_crXerHoraTxt(t2[t2.length-1].b);
    if(!ab||a<ab)ab=a;
    if(!ci||b>ci)ci=b}
  C.abre=ab||'07:00';C.cierra=ci||'18:00';
  /* --- horas por dia: manda el day_hr_cnt que declara P6 --- */
  if(dayHr>0)C.hpd=dayHr;
  else{var sh=0,nd=0;for(var d3=0;d3<7;d3++)if(C.dias[d3]){sh+=C.horas[d3];nd++}
    C.hpd=nd?Math.round(sh/nd*1e4)/1e4:10}
  if(!(C.hpd>0))C.hpd=10;
  if(!C.ok){var D=_crXerCalDefecto();C.dias=D.dias;C.horas=D.horas;C.turnos=D.turnos;
    C.abre=C.abre||D.abre;C.cierra=C.cierra||D.cierra}
  return C}

/* ---------------------------------------------------------------------------
   1.1  Helpers del calendario. Todos toman C y fechas ISO 'YYYY-MM-DD'.
   --------------------------------------------------------------------------- */
/* es dia habil? manda la excepcion, luego el feriado, luego la semana */
function _crXerCalLab(C,iso){
  if(!iso)return false;
  var k=String(iso).slice(0,10);
  if(C.esp&&C.esp[k])return C.esp[k].horas>0;
  if(C.feriados&&C.feriados[k])return false;
  var t=Date.parse(k+'T00:00:00Z');if(isNaN(t))return false;
  return !!C.dias[new Date(t).getUTCDay()]}

/* horas de jornada de ESE dia (0 si no es habil) */
function _crXerCalHorasDia(C,iso){
  var k=String(iso||'').slice(0,10);if(!k)return 0;
  if(C.esp&&C.esp[k])return C.esp[k].horas;
  if(C.feriados&&C.feriados[k])return 0;
  var t=Date.parse(k+'T00:00:00Z');if(isNaN(t))return 0;
  var d=new Date(t).getUTCDay();
  return C.dias[d]?C.horas[d]:0}

/* los turnos de ESE dia */
function _crXerCalTurnosDia(C,iso){
  var k=String(iso||'').slice(0,10);if(!k)return [];
  if(C.esp&&C.esp[k])return C.esp[k].turnos||[];
  if(C.feriados&&C.feriados[k])return [];
  var t=Date.parse(k+'T00:00:00Z');if(isNaN(t))return [];
  var d=new Date(t).getUTCDay();
  return C.dias[d]?(C.turnos[d]||[]):[]}

/* hora de entrada y de salida de ESE dia */
function _crXerCalAbre(C,iso){var t=_crXerCalTurnosDia(C,iso);return t.length?_crXerHoraTxt(t[0].a):(C.abre||'07:00')}
function _crXerCalCierra(C,iso){var t=_crXerCalTurnosDia(C,iso);return t.length?_crXerHoraTxt(t[t.length-1].b):(C.cierra||'18:00')}

/* el dia habil mas cercano: hacia adelante (atras=false) o hacia atras */
/* retroceder N dias laborables desde una fecha (para completar el inicio
   real: fecha de datos menos los dias ya trabajados) */
function _crXerCalAtras(C,iso,dias){var n=Math.max(0,Math.round(Number(dias)||0));var s0=_crASerial(iso);if(s0==='')return iso;var g=0,d=s0;
  while(g<n&&d>s0-3000){d--;if(_crXerCalLab(C,_crDeSerial(d)))g++}
  var r=_crDeSerial(d);if(!_crXerCalLab(C,r))r=_crXerCalSnap(C,r,true);return r}
function _crXerCalSnap(C,iso,atras){
  if(!iso)return iso;
  var n=_crASerial(iso);if(n==='')return iso;
  var k=0;
  while(!_crXerCalLab(C,_crDeSerial(n))&&k<800){n+=atras?-1:1;k++}
  return _crDeSerial(n)}

/* el SIGUIENTE dia habil, estrictamente despues de iso */
function _crXerCalSig(C,iso){
  var n=_crASerial(iso);if(n==='')return iso;
  var k=0,d=n+1;
  while(!_crXerCalLab(C,_crDeSerial(d))&&k<800){d++;k++}
  return _crDeSerial(d)}
/* el ANTERIOR dia habil, estrictamente antes de iso */
function _crXerCalAnt(C,iso){
  var n=_crASerial(iso);if(n==='')return iso;
  var k=0,d=n-1;
  while(!_crXerCalLab(C,_crDeSerial(d))&&k<800){d--;k++}
  return _crDeSerial(d)}

/* sumar n dias habiles a iso: n=1 devuelve el propio iso si es habil (el dia
   1 de la actividad), n=0 devuelve el dia habil de partida. n negativo
   retrocede. */
function _crXerCalSuma(C,iso,n){
  var a=_crASerial(iso);if(a==='')return iso;
  n=Math.round(Number(n)||0);
  var d=a,k=0;
  if(n>=0){
    d=_crASerial(_crXerCalSnap(C,iso,false));
    var falta=Math.max(0,n-1);
    while(falta>0&&k<20000){d++;k++;if(_crXerCalLab(C,_crDeSerial(d)))falta--}
    return _crDeSerial(d)}
  d=_crASerial(_crXerCalSnap(C,iso,true));
  var f2=-n;
  while(f2>0&&k<20000){d--;k++;if(_crXerCalLab(C,_crDeSerial(d)))f2--}
  return _crDeSerial(d)}

/* dias habiles entre dos fechas, ambas incluidas */
function _crXerCalCuenta(C,ini,fin){
  var a=_crASerial(ini),b=_crASerial(fin);
  if(a===''||b==='')return 0;
  if(b<a)b=a;
  if(b-a>20000)b=a+20000;
  var n=0;
  for(var d=a;d<=b;d++)if(_crXerCalLab(C,_crDeSerial(d)))n++;
  return n}

/* horas de calendario entre dos fechas, ambas incluidas */
function _crXerCalHoras(C,ini,fin){
  var a=_crASerial(ini),b=_crASerial(fin);
  if(a===''||b==='')return 0;
  if(b<a)b=a;
  if(b-a>20000)b=a+20000;
  var h=0;
  for(var d=a;d<=b;d++)h+=_crXerCalHorasDia(C,_crDeSerial(d));
  return Math.round(h*100)/100}

/* la hora del dia iso a la que se han consumido h horas de jornada */
function _crXerCalHoraDe(C,iso,h){
  var tt=_crXerCalTurnosDia(C,iso);
  if(!tt.length)return _crXerCalCierra(C,iso);
  var rest=Number(h)||0;
  if(rest<=1e-9)return _crXerHoraTxt(tt[0].a);
  for(var i=0;i<tt.length;i++){
    var d=tt[i].b-tt[i].a;
    if(rest<=d+1e-9)return _crXerHoraTxt(tt[i].a+rest);
    rest-=d}
  return _crXerHoraTxt(tt[tt.length-1].b)}

/* las horas de jornada YA pasadas de ese dia a esa hora de reloj */
function _crXerCalPasadas(C,iso,hora){
  var tt=_crXerCalTurnosDia(C,iso),x=_crXerHoraNum(hora);
  if(x===''||!tt.length)return 0;
  var h=0;
  for(var i=0;i<tt.length;i++){
    if(x>=tt[i].b)h+=tt[i].b-tt[i].a;
    else if(x>tt[i].a)h+=x-tt[i].a}
  return Math.round(h*1e6)/1e6}

/* consumir `horas` de jornada empezando el dia habil ini (a su hora de entrada,
   o a `desde` si se le da una hora de reloj): devuelve {iso, hora, dias}. Es lo
   que hace que la duracion en horas y el par de fechas digan lo mismo. */
function _crXerCalFinHoras(C,ini,horas,desde){
  var a=_crASerial(_crXerCalSnap(C,ini,false));
  if(a==='')return {iso:ini,hora:_crXerCalCierra(C,ini),dias:0};
  var iso0=_crDeSerial(a);
  var ya=desde?_crXerCalPasadas(C,iso0,desde):0;
  var H=Number(horas)||0;
  if(H<=1e-9)return {iso:iso0,hora:desde||_crXerCalAbre(C,iso0),dias:0};
  var d=a,k=0,rest=H,dias=0;
  while(k<20000){
    var iso=_crDeSerial(d),hd=_crXerCalHorasDia(C,iso);
    var off=(d===a)?ya:0;
    if(hd-off>1e-9){dias++;
      if(rest<=(hd-off)+1e-9)return {iso:iso,hora:_crXerCalHoraDe(C,iso,off+rest),dias:dias};
      rest-=(hd-off)}
    d++;k++}
  return {iso:_crDeSerial(d),hora:_crXerCalCierra(C,_crDeSerial(d)),dias:dias}}

/* ---------------------------------------------------------------------------
   1.2  La FECHA DE DATOS.
   El avance del aplicativo llega HASTA EL CORTE INCLUSIVE, asi que el reloj
   del proyecto arranca el primer dia habil SIGUIENTE al corte, a la hora de
   entrada de ese dia. Si se pone a las 18:00 del propio corte, los reinicios
   de las 07:00 quedan por detras y el primer F9 de P6 los empuja.
   --------------------------------------------------------------------------- */
function _crXerDataDate(C,corte){
  /* pedido del usuario (19/09/2026): la fecha de datos es el PROPIO dia de
     corte a las 23:59, no la manana del habil siguiente; asi el acumulado de
     P6 en ese dia es exactamente lo real (2'369.96 hh al 17/09/2026). Lo
     remanente sigue arrancando al habil siguiente (DD.piso). */
  var n=_crASerial(corte);
  if(n==='')return {iso:String(corte||'').slice(0,10),hora:'23:59'};
  return {iso:_crDeSerial(n),hora:'23:59'}}

/* la fecha de datos que toca segun el modo; se memoiza en el modelo para que
   _crXerFechas y _crXerCabecera escriban EXACTAMENTE la misma. */
function _crXerDD(lineas,modelo){
  if(modelo&&modelo._dd)return modelo._dd;
  var T=_crXerTablas(lineas),PR=T.PROJECT;
  var C=_crXerCalendario(lineas,(PR&&PR.filas.length)?PR.filas[0].o.clndr_id:'');
  var DD;
  if(String(modelo.modo)==='rep')DD=_crXerDataDate(C,modelo.corte||modelo.hoy);
  else{
    /* 'tal cual esta': la fecha de datos del propio archivo, escrita a
       proposito para que nunca quede vacia (si lo esta, P6 usa plan_start y
       el remanente nace descuadrado) */
    var v='',h='';
    if(PR&&PR.filas.length){
      var cru=String(PR.filas[0].o.last_recalc_date||'').trim();
      if(!cru)cru=String(PR.filas[0].o.plan_start_date||'').trim();
      if(cru){v=cru.slice(0,10);h=(cru.length>=16)?cru.slice(11,16):''}}
    if(!v){DD=_crXerDataDate(C,modelo.corte||modelo.hoy)}
    else{
      var iso=_crXerCalLab(C,v)?v:_crXerCalSnap(C,v,false);
      DD={iso:iso,hora:(/^\d{2}:\d{2}$/.test(h)&&h!=='00:00')?h:_crXerCalAbre(C,iso)}}}
  DD.C=C;
  /* el PISO del remanente: el primer instante laborable en o despues de la
     fecha de datos. En modo 'tal' el archivo puede declarar la fecha de datos
     a las 18:00 (el cierre de la jornada), y entonces lo remanente empieza de
     verdad a la manana siguiente. La fecha de datos que se ESCRIBE en PROJECT
     sigue siendo la del archivo; esto solo acota lo remanente. */
  DD.piso=(function(){
    var iso=DD.iso,hora=DD.hora;
    if(!_crXerCalLab(C,iso)){iso=_crXerCalSnap(C,iso,false);return {iso:iso,hora:_crXerCalAbre(C,iso)}}
    var ab=_crXerCalAbre(C,iso),ci=_crXerCalCierra(C,iso);
    if(hora>=ci){iso=_crXerCalSig(C,iso);return {iso:iso,hora:_crXerCalAbre(C,iso)}}
    return {iso:iso,hora:(hora>ab?hora:ab)}})();
  if(modelo)modelo._dd=DD;
  return DD}
/* ============================================================================
   AGENTE F - Bloque 2/4 - _crXerFechas (TASK + TASKPRED)
   ============================================================================ */

/* que se hace con las late_* (tardias) y con el flotante. Tres politicas:
   'vacio'  POR DEFECTO: late_*, rem_late_* y los dos flotantes en blanco. Sin
            una pasada hacia atras por la red no hay tardia correcta, y
            escribir late = early deja TODO el cronograma con flotante cero (la
            ruta critica seria el proyecto entero y el usuario no podria leer
            ninguna holgura). En blanco P6 las calcula en el primer F9, que es
            lo que piden xer_rev_03 (hallazgo 5), xer_rev_04 (H11) y
            xer_rev_10 (C11), y lo que espera el agente M.
   'igual'  late = early y flotante 0 (archivo coherente consigo mismo, pero
            con holgura cero en todo hasta el primer F9)
   'nada'   no se tocan (deja el flotante de la corrida vieja del archivo, que
            ya no corresponde a las fechas escritas: NO recomendado) */
var _XER_LATE='vacio';
/* NINGUNA restriccion en el archivo (pedido del usuario): en todas las
   actividades que el aplicativo gestiona salen vacios cstr_type, cstr_date,
   cstr_type2 y cstr_date2. Una restriccion vieja devuelve la actividad a su
   fecha en el primer F9 de P6 y deshace el "corrido". Se cuentan y se
   enumeran en el mensaje. */
var _XER_LIBERA_CSTR=true;
/* anclar con CS_MSOA las movidas: DESACTIVADO. El usuario no quiere que el
   .xer salga con restricciones, ni siquiera con las que pondria el
   aplicativo para sostener una fecha movida a mano. */
var _XER_ANCLA_MOVIDAS=false;
/* el calendario con el que se traduce el lag: por contrato, el de la SUCESORA.
   Si el archivo trae SCHEDOPTIONS.sched_calendar_on_relationship_lag se
   respeta lo que diga (en PRUEBA-XER dice rcal_Predecessor, pero todas las
   TASK usan el mismo calendario 7055, asi que da el mismo numero). */
var _XER_LAG_SEGUN_SCHEDOPT=true;

function _crXerTipoRel(t){
  var x=String(t||'FS').toUpperCase().replace(/^PR_/,'');
  return (x==='SS'||x==='FF'||x==='SF')?x:'FS'}

/* las horas por dia con las que se convierte el lag de una relacion */
function _crXerHpdLag(lineas,T,filaSuc,filaPred){
  var modo='suc';
  if(_XER_LAG_SEGUN_SCHEDOPT){
    var SO=T.SCHEDOPTIONS&&T.SCHEDOPTIONS.filas[0];
    var v=String((SO&&SO.o&&SO.o.sched_calendar_on_relationship_lag)||'');
    if(/predecessor/i.test(v))modo='pred';
    else if(/successor/i.test(v))modo='suc';
    else if(/24/.test(v))modo='24';
    else if(/project/i.test(v))modo='proy'}
  if(modo==='24')return 24;
  var f=(modo==='pred')?(filaPred||filaSuc):(modo==='proy'?null:(filaSuc||filaPred));
  var id=(f&&f.o)?f.o.clndr_id:((T.PROJECT&&T.PROJECT.filas[0])?T.PROJECT.filas[0].o.clndr_id:'');
  var C=_crXerCalendario(lineas,id);
  return (C&&C.hpd>0)?C.hpd:10}

/* ----------------------------------------------------------------------------
   _crXerFechas(lineas,modelo)

   Escribe, para cada tarea GESTIONADA (la que existe en modelo.tareas):
     target_start_date / target_end_date      = el PLAN que ve el usuario
     early_start_date / early_end_date        = lo que de verdad va a pasar
     late_start_date  / late_end_date         = segun _XER_LATE
     restart_date / reend_date                = el REMANENTE, nunca antes de la
                                                fecha de datos
     rem_late_start_date / rem_late_end_date  = segun _XER_LATE
     expect_end_date                          = SIEMPRE vacio
     suspend_date / resume_date               = vacios
     cstr_type2 / cstr_date2                  = vacios
     target_drtn_hr_cnt                       = horas del calendario entre las
                                                fechas planificadas
     remain_drtn_hr_cnt                       = rd x horas de jornada, con el rd
                                                de la hoja 2 AGRUPADO (durTxt):
                                                resta / (rendimiento propio, o
                                                HH entre dias). reend_date sale
                                                de consumir esas mismas horas
     duration_type                            = DT_FixedDrtn, Fixed Duration
                                                and Units/Time (solo tareas)
     total_float_hr_cnt / free_float_hr_cnt   = segun _XER_LATE

   Reglas:
   * hitos (TT_Mile / TT_FinMile): duracion 0 y las dos fechas iguales.
   * nivel de esfuerzo y resumen (TT_LOE / TT_WBS): no se tocan, P6 las deriva.
   * Complete: sin restart ni reend, remanente 0.
   * informativas (sin partidas y sin HH): se respeta lo que trae el archivo,
     salvo que el usuario haya movido sus fechas (t.movida).
   * lo que NO esta en modelo.tareas no se toca.

   Y reescribe TASKPRED: altas, cambios de tipo y de lag, bajas (tumbas), sin
   duplicados, con task_pred_id unicos y proj_id / pred_proj_id correctos.
   ---------------------------------------------------------------------------- */
function _crXerFechas(lineas,modelo){
  var out={fechas:0,hitos:0,loe:0,informativas:0,sinModelo:0,sinFecha:[],
    cstrLib:0,cstrLibL:[],cstrAnc:0,dupCod:[],
    rend:{},conRend:0,rendL:[],
    sinAlc:0,sinAlcL:[],porPct:0,porPctL:[],
    rel_new:0,rel_act:0,rel_del:0,rel_dup:0,rel_huerf:0,rel_ajenas:0,rel_sin:[],
    dataDate:'',dataHora:'',calendario:'',avisos:[]};
  if(!modelo||!modelo.tareas)throw new Error('_crXerFechas: el modelo no trae tareas');
  _crXerCalReset();
  var T=_crXerTablas(lineas),TA=T.TASK;
  if(!TA||!TA.cs.length)throw new Error('el .xer no trae tabla TASK: no se pueden escribir las fechas');

  var DD=_crXerDD(lineas,modelo);
  out.dataDate=DD.iso;out.dataHora=DD.hora;
  out.pisoRem=DD.piso.iso+' '+DD.piso.hora;
  out.calendario=(DD.C&&DD.C.nombre)?(DD.C.nombre+' ('+_crXer2(DD.C.hpd)+' h/dia)'):'';
  var ddSer=_crASerial(DD.piso.iso);
  /* el piso del remanente en el calendario de CADA tarea */
  var piso=function(C){
    var iso=DD.piso.iso,hora=DD.piso.hora;
    if(!_crXerCalLab(C,iso)){iso=_crXerCalSnap(C,iso,false);hora=_crXerCalAbre(C,iso)}
    else{var ab=_crXerCalAbre(C,iso);if(hora<ab)hora=ab}
    return {iso:iso,hora:hora}};

  /* --- indices por codigo --- */
  var idDe={},codDeId={},projDe={},filaDe={};
  TA.filas.forEach(function(fi){
    var cod=_crTx(fi.o.task_code);
    if(idDe[cod]!=null&&out.dupCod.indexOf(cod)<0)out.dupCod.push(cod);
    idDe[cod]=String(fi.o.task_id);
    codDeId[String(fi.o.task_id)]=cod;
    projDe[String(fi.o.task_id)]=String(fi.o.proj_id||'');
    filaDe[cod]=fi});

  /* --- quien tiene predecesoras vivas (para decidir el anclaje) --- */
  var tienePred={};
  (modelo.relaciones||[]).forEach(function(r){
    if(r&&!r.eliminado&&r.succ)tienePred[_crTx(r.succ)]=1});

  /* ======================= 1) las fechas de cada TASK ===================== */
  TA.filas.forEach(function(fi){
    var cod=_crTx(fi.o.task_code),t=modelo.tareas[cod],toca=false;
    var pw=function(campo,val){
      var j=TA.col[campo];if(j==null)return;
      var s=String(val==null?'':val);
      if(fi.v[j]!==s){fi.v[j]=s;toca=true}};
    /* la foto de las fechas y duraciones ANTES de tocar nada: sirve para
       distinguir "la fila se reescribio" de "la actividad se movio de
       verdad" (las tardias y los flotantes se limpian siempre) */
    var _CMP=['target_start_date','target_end_date','early_start_date','early_end_date',
      'restart_date','reend_date','target_drtn_hr_cnt','remain_drtn_hr_cnt'];
    var foto=function(){var o=[];for(var q=0;q<_CMP.length;q++){var j=TA.col[_CMP[q]];o.push((j==null)?'':fi.v[j])}return o.join('|')};
    var antes=foto();
    var cierra=function(){if(!toca)return;
      lineas[fi.i]='%R\t'+fi.v.join('\t');out.fechas++;
      if(foto()!==antes)out.movidas=(out.movidas||0)+1};

    if(!t){out.sinModelo++;return}
    if(t.eliminado)return;

    /* el TIPO manda desde el ARCHIVO: es lo que P6 va a leer. Si el modelo dice
       otra cosa, se avisa pero no se convierte una tarea en hito por la
       espalda (eso es trabajo de _crXerEscribe, que es quien crea las filas). */
    var tt=String(fi.o.task_type||'TT_Task').trim()||'TT_Task';
    var esHito=(tt==='TT_Mile'||tt==='TT_FinMile');
    var esDeriv=(tt==='TT_LOE'||tt==='TT_WBS');
    if(t.hito&&!esHito)out.avisos.push(cod+': el aplicativo la trata como hito y el .xer la trae como '+tt);
    if(t.loe&&!esDeriv)out.avisos.push(cod+': el aplicativo la trata de nivel de esfuerzo y el .xer la trae como '+tt);
    /* lo que rompe el remanente se limpia SIEMPRE, hasta en las informativas,
       en los hitos, en las de nivel de esfuerzo y en las que no tienen fecha:
       un fin esperado viejo hace que P6 recalcule la duracion remanente y pise
       lo escrito (SCHEDOPTIONS.sched_use_expect_end_flag viene en Y), y una
       restriccion vieja devuelve la actividad a su fecha en el primer F9.
       Va ANTES de los return de LOE / hito / sin fecha: si no, una informativa
       de esos tipos se cuela con su restriccion y E-28 bloquea la descarga. */
    var ct=String(fi.o.cstr_type||'').trim(),cd=_crFec(fi.o.cstr_date);
    var ct2=String(fi.o.cstr_type2||'').trim(),cd2=_crFec(fi.o.cstr_date2);
    if(ct||cd||ct2||cd2){
      out.cstrLib++;
      if(out.cstrLibL.length<400)out.cstrLibL.push(cod+
        (ct?(' ('+ct.replace(/^CS_/,'')+(cd?(' '+cd):'')+')'):'')+
        (ct2?(' + '+ct2.replace(/^CS_/,'')+(cd2?(' '+cd2):'')):''))}
    pw('expect_end_date','');pw('suspend_date','');pw('resume_date','');
    pw('cstr_type','');pw('cstr_date','');
    pw('cstr_type2','');pw('cstr_date2','');
    if(esDeriv){cierra();out.loe++;return}

    var C=_crXerCalendario(lineas,fi.o.clndr_id);

    /* INFORMATIVA (KOM, movilizacion, ingenieria: sin partidas y sin HH) que el
       usuario no ha movido: el PLAN, el estado y el avance salen del propio
       archivo, no del modelo. Pasa por el mismo camino que las demas para que
       la fila quede coherente consigo misma (lo remanente nunca por detras de
       la fecha de datos, y la duracion remanente cuadrando con restart->reend).
       Si nada se ha movido, lo que se escribe es identico a lo que ya habia y
       la fila no se toca. */
    var info=(t.informativa&&!t.movida);
    if(info)out.informativas++;
    var est=info?(String(fi.o.status_code||'TK_NotStart').replace(/^TK_/,'')||'NotStart')
                :String(t.estado||'NotStart');
    var ini=info?(_crFec(fi.o.target_start_date)||_crFec(fi.o.early_start_date)||_crFec(fi.o.act_start_date))
                :(String(t.ini||'').slice(0,10)||_crFec(fi.o.target_start_date));
    var fin=info?(_crFec(fi.o.target_end_date)||_crFec(fi.o.early_end_date)||ini)
                :(String(t.fin||'').slice(0,10)||_crFec(fi.o.target_end_date)||ini);
    var pctFuente=info?(Number(fi.o.phys_complete_pct)||0):Number(t.pct);
    var iniRemF=info?(_crFec(fi.o.restart_date)||ini):(String(t.iniRem||'').slice(0,10)||ini);
    var iniRealF=info?_crFec(fi.o.act_start_date):String(t.iniReal||'').slice(0,10);
    var finRealF=info?_crFec(fi.o.act_end_date):String(t.finReal||'').slice(0,10);
    /* el aplicativo no tiene fechas para ella: se cae a las del .xer y hay
       que decirlo, o el usuario cree que exporto un plan que no puso */
    if(!info&&(!String(t.ini||'')||!String(t.fin||'')))
      out.avisos.push(cod+' ('+String(t.nombre||'')+'): no tiene fechas en el aplicativo; sale con las del .xer ('+(ini||'sin fecha')+(fin&&fin!==ini?(' → '+fin):'')+') para '+_crXer2(Number(t.hhR)||0)+' hh remanentes. Ponle inicio y fin en la hoja 2 antes de exportar');
    if(!ini){out.sinFecha.push(cod);cierra();return}
    ini=_crXerCalSnap(C,ini,false);
    fin=_crXerCalSnap(C,fin,true);
    if(_crASerial(fin)<_crASerial(ini))fin=ini;

    /* ---------------- hitos ---------------- */
    if(esHito){
      var fh=(tt==='TT_FinMile')?fin:ini;
      var hh=(tt==='TT_FinMile')?_crXerCalCierra(C,fh):_crXerCalAbre(C,fh);
      pw('target_start_date',_crXerFec(fh,hh));pw('target_end_date',_crXerFec(fh,hh));
      pw('target_drtn_hr_cnt','0');pw('remain_drtn_hr_cnt','0');
      var fr=fh,hr=hh;
      if(est==='Complete'){pw('restart_date','');pw('reend_date','');
        /* P6 deja las tempranas de lo TERMINADO en la fecha de datos (lo que
           se ve en las columnas Start y Finish son las fechas reales, que las
           escribe el agente M); asi el archivo usa la misma convencion que el
           que exporta P6 y no sale lleno de diferencias gratuitas */
        pw('early_start_date',_crXerFec(DD.iso,DD.hora));
        pw('early_end_date',_crXerFec(DD.iso,DD.hora))}
      else{
        var PH=piso(C);
        /* un hito de FIN conserva su hora de cierre aunque se corra a la
           fecha de datos; uno de inicio, la de entrada */
        if(ddSer!==''&&_crASerial(fr)<ddSer){fr=PH.iso;
          hr=(tt==='TT_FinMile')?_crXerCalCierra(C,fr):PH.hora}
        pw('restart_date',_crXerFec(fr,hr));pw('reend_date',_crXerFec(fr,hr));
        pw('early_start_date',_crXerFec(fr,hr));pw('early_end_date',_crXerFec(fr,hr))}
      _crXerLate(pw,fr,hr,fr,hr,est);
      /* un hito no dura: ni HH ni rendimiento que repartir */
      t.rd=0;t.rr=0;t.rC=0;t.diasCal=0;t.dias=0;t.porHH=false;t.hpdCal=(C.hpd>0)?C.hpd:10;t.remH=0;
      out.rend[cod]={rd:0,rr:0,rC:0,dias:0,hhT:Number(t.hhT)||0,hhA:Number(t.hhA)||0,resta:0,remH:0,porHH:false,
        alcance:(t.alcance!==false),pct:_crXerM2(pctFuente),motivo:'hito'};
      out.hitos++;cierra();return}

    /* ---------------- tarea normal ---------------- */
    var hIni=_crXerCalAbre(C,ini),hFin=_crXerCalCierra(C,fin);
    var durH=_crXerCalHoras(C,ini,fin);
    if(!(durH>0))durH=C.hpd;
    pw('duration_type','DT_FixedDrtn');
    pw('target_start_date',_crXerFec(ini,hIni));
    pw('target_end_date',_crXerFec(fin,hFin));
    pw('target_drtn_hr_cnt',_crXerNum(durH));

    var pct=Number(pctFuente);if(!isFinite(pct))pct=0;
    if(pct<0)pct=0;if(pct>100)pct=100;
    var eIni=ini,hEi=hIni,eFin=fin,hEf=hFin;

    if(est==='Complete'){
      pw('remain_drtn_hr_cnt','0');
      pw('restart_date','');pw('reend_date','');
      t.rd=0;t.rr=0;t.rC=0;t.diasCal=_crXerCalCuenta(C,ini,fin);
      t.dias=t.diasCal;t.porHH=false;t.hpdCal=(C.hpd>0)?C.hpd:10;t.remH=0;
      out.rend[cod]={rd:0,rr:0,rC:0,dias:t.diasCal,hhT:Number(t.hhT)||0,
        hhA:Number(t.hhA)||0,resta:0,remH:0,porHH:false,
        alcance:(t.alcance!==false),pct:_crXerM2(pctFuente),motivo:'terminada'};
      var ri=iniRealF||_crFec(fi.o.act_start_date)||ini;
      var rf=finRealF||_crFec(fi.o.act_end_date)||fin;
      eIni=_crXerCalSnap(C,ri,false);eFin=_crXerCalSnap(C,rf,true);
      /* NUNCA DESPUES DE LA FECHA DE DATOS (X4 H3): con el corte en domingo o
         en feriado, el snap HACIA DELANTE del inicio real se pasaba del corte
         y, como P6 reparte el presupuesto sobre las fechas PLANIFICADAS, todo
         el trabajo de una TERMINADA caia despues de la fecha de datos y el
         acumulado del archivo dejaba de ser lo real. El tope es el ultimo dia
         laborable en o antes de la fecha de datos. */
      var _tp9=_crXerCalLab(C,DD.iso)?DD.iso:_crXerCalSnap(C,DD.iso,true);
      if(_crASerial(_tp9)!==''){
        if(_crASerial(eIni)>_crASerial(_tp9))eIni=_tp9;
        if(_crASerial(eFin)>_crASerial(_tp9))eFin=_tp9}
      /* si aun asi el fin queda antes del inicio, se baja el INICIO (bajarlo
         no puede volver a pasarse de la fecha de datos; subir el fin, si) */
      if(_crASerial(eFin)<_crASerial(eIni))eIni=eFin;
      hEi=_crXerCalAbre(C,eIni);hEf=_crXerCalCierra(C,eFin);
      /* las TEMPRANAS de lo terminado, en la fecha de datos: es lo que
         escribe P6 en su propio .xer (las fechas que se ven en Start y
         Finish son act_start_date / act_end_date, que pone el agente M) */
      pw('early_start_date',_crXerFec(DD.iso,DD.hora));
      pw('early_end_date',_crXerFec(DD.iso,DD.hora));
      _crXerLate(pw,DD.iso,DD.hora,DD.iso,DD.hora,est);
      /* el PLAN de una terminada son sus fechas reales y su duracion original
         la real: P6 reparte las HH presupuestadas sobre las fechas
         PLANIFICADAS (target_*), y con las del plan viejo su curva ponia el
         trabajo donde no se hizo (A1040: hecha del 03/07 al 31/07 y P6 la
         pintaba del 20/07 al 24/07) */
      pw('target_start_date',_crXerFec(eIni,hEi));
      pw('target_end_date',_crXerFec(eFin,hEf));
      var durC9=_crXerCalHoras(C,eIni,eFin);if(!(durC9>0))durC9=(C.hpd>0)?C.hpd:10;
      pw('target_drtn_hr_cnt',_crXerNum(durC9));
      t.durH=durC9}
    else{
      /* ---- LA DURACION REMANENTE, EXACTAMENTE LA DE LA HOJA 2 AGRUPADO ----
         Lo que el usuario lee ahi es  '(reloj) N d . resta X d . a Y hh/d'  y
         sale de durTxt (index.html 4900-4906). Aqui se repite la misma cuenta,
         con el calendario REAL en vez de lunes-viernes:
             dias  = dias laborables de las fechas VIGENTES de la actividad
             hhT   = HH de la actividad          (modelo.tareas[cod].hhT)
             gT    = HH ganadas                  (modelo.tareas[cod].hhA)
             resta = max(0, hhT - gT)            (modelo.tareas[cod].hhR)
             rC    = rendimiento propio, hh/dia  (_cnDe(cronId,cod), el engranaje)
             rDef  = dias>0 ? hhT/dias : 0
             rr    = rC || rDef
             rd    = rr>0 ? resta/rr : 0         (dias laborables)
         y de ahi:  remain_drtn_hr_cnt = rd x horas de jornada,
         reend = consumir esas horas desde restart (si rd es entero, cae en el
         cierre del ultimo dia) y remain_qty_per_hr = rr / hpd, que es lo que
         sale solo al repartir remain_qty entre la duracion remanente.
         Sin HH (informativas, partidas retiradas, partidas fuera) no hay
         rendimiento del que tirar: manda LA REGLA DEL REMANENTE (_crRemDe, la
         misma funcion que usa la hoja 2): con alcance, dias x (1 - pct/100)
         con el % fisico de sus partidas; SIN alcance, cero, porque no puede
         restar una duracion de algo que este cronograma no va a hacer. */
      var hpdC=(C.hpd>0)?C.hpd:10;
      var dias=_crXerCalCuenta(C,ini,fin);
      var hhT=Number(t.hhT)||0,gT=Number(t.hhA)||0;
      var resta=(t.hhR!=null&&isFinite(Number(t.hhR)))?Math.max(0,Number(t.hhR)):Math.max(0,hhT-gT);
      var rC=0;
      if(t.rend!=null&&Number(t.rend)>0)rC=Number(t.rend);
      else{try{if(typeof _cnDe==='function'){var _q=_cnDe(modelo.cronId,cod);if(_q>0)rC=Number(_q)}}catch(_er){}}
      /* las informativas van con lo del archivo, y ahi hay alcance por
         definicion (no tienen partidas que mirar) */
      var alc9=info?true:(t.alcance!==false);
      var R9=_crRemDe({hhT:hhT,hhA:gT,hhR:resta,dias:dias,rC:rC,pct:pct,alcance:alc9});
      var rDef=R9.rDef,rr=R9.rr,rd=R9.rd,porHH=R9.porHH;
      /* REMANENTE POR LA TABLA (Rendimiento APP): la duracion restante de la
         tabla manda; el rendimiento implicito es resta / rd. Y el real se
         completa: la actividad dura en total lo que dice la tabla, asi que
         en una iniciada el inicio real se pone (total - restante) dias
         laborables antes de la fecha de datos y la duracion original es ese
         total: original = real + remanente, congruente para P6. */
      var deTabla=false,totTab=null;
      if(String(modelo.rem||'')==='tabla'&&!info&&t.durTab&&t.durTab.rd!=null&&alc9){
        deTabla=true;rd=Math.max(0,Number(t.durTab.rd)||0);totTab=Math.max(rd,Number(t.durTab.tot)||0);
        if(rd>0&&resta>0)rr=resta/rd;porHH=true;R9.motivo='tabla';
        out.remTabla=(out.remTabla||0)+1;if(!out.remTablaL)out.remTablaL=[];
        if(out.remTablaL.length<300)out.remTablaL.push(cod+': resta '+_crXer2(rd)+' d de '+_crXer2(totTab)+' d')}
      else if(String(modelo.rem||'')==='tabla'&&!info){out.remSinTabla=(out.remSinTabla||0)+1;if(!out.remSinTablaL)out.remSinTablaL=[];
        if(out.remSinTablaL.length<300)out.remSinTablaL.push(cod+(alc9?': sin rendimiento en la tabla':': sin alcance')+' \u00b7 por la regla de HH')}
      if(rd>5000){out.avisos.push(cod+': el rendimiento propio ('+_crXer2(rC)+' hh/dia) da '+_crXer2(rd)+' dias de remanente; se corta en 5000');rd=5000}
      rd=Math.round(rd*10000)/10000;
      var remH=Math.round(rd*hpdC*100)/100;
      if(!(remH>0))remH=0;
      /* se guarda para que la auditoria y el mensaje puedan comparar */
      t.rd=rd;t.rr=Math.round(rr*100)/100;t.rC=Math.round(rC*100)/100;t.diasCal=dias;
      t.dias=dias;t.porHH=porHH;t.hpdCal=hpdC;t.remH=remH;
      out.rend[cod]={rd:rd,rr:Math.round(rr*100)/100,rC:Math.round(rC*100)/100,
        dias:dias,hhT:Math.round(hhT*100)/100,hhA:Math.round(gT*100)/100,
        resta:Math.round(resta*100)/100,remH:remH,porHH:porHH,
        alcance:alc9,pct:_crXerM2(pct),motivo:R9.motivo};
      if(!porHH){
        if(!alc9){out.sinAlc=(out.sinAlc||0)+1;
          if(!out.sinAlcL)out.sinAlcL=[];
          if(out.sinAlcL.length<300)out.sinAlcL.push(cod+': '+(t.motivoSinAlcance||'sin alcance en este cronograma')+' · remanente 0')}
        else{out.porPct=(out.porPct||0)+1;
          if(!out.porPctL)out.porPctL=[];
          if(out.porPctL.length<300)out.porPctL.push(cod+': sin HH, resta '+_crXer2(rd)+' d de '+dias+' d por su % de avance ('+_crXer2(pct)+' %)')}}
      if(rC>0){out.conRend++;
        if(out.rendL.length<300)out.rendL.push(cod+': resta '+_crXer2(rd)+' d a '+_crXer2(rC)+' hh/dia (por defecto '+_crXer2(rDef)+')')}
      var ir=iniRemF||ini;
      ir=_crXerCalSnap(C,ir,false);
      var hIr=_crXerCalAbre(C,ir);
      var PR=piso(C);
      if(ddSer!==''&&_crASerial(ir)<ddSer){ir=PR.iso;hIr=PR.hora}
      else if(ddSer!==''&&_crASerial(ir)===_crASerial(PR.iso)&&hIr<PR.hora)hIr=PR.hora;
      var F=(remH>0)?_crXerCalFinHoras(C,ir,remH,hIr):{iso:ir,hora:hIr};
      pw('restart_date',_crXerFec(ir,hIr));
      pw('reend_date',_crXerFec(F.iso,F.hora));
      pw('remain_drtn_hr_cnt',_crXerNum(remH));
      if(!deTabla&&est==='Active'&&!info){
        /* P6 reparte las HH PRESUPUESTADAS de una iniciada de forma lineal
           entre su inicio real (= inicio planificado, P6 los iguala) y ese
           inicio + duracion original. Para que su acumulado en la fecha de
           datos sea EXACTAMENTE lo real (pedido del usuario: 2'369.96 hh al
           17/09/2026) el tramo real tiene que pesar lo mismo que las HH
           reales:  actH = remH x (real / remanente)  y  original = actH +
           remH. El inicio real sale entonces sintetico, actH horas de
           calendario antes de la fecha de datos (como ya hacia el remanente
           por la tabla); el real de verdad queda en los periodos
           financieros, que son los que ensenan el avance por semana. */
        var A9h=Math.max(0,Number(t.hhA)||0),R9h=Number(t.hhR);
        if(!(R9h>0))R9h=Math.max(0,(Number(t.hhT)||0)-A9h);
        var actH9=(R9h>0&&remH>0&&A9h>0)?Math.round(remH*A9h/R9h*100)/100:0;
        var topeH9=5000*((C.hpd>0)?C.hpd:10);if(actH9>topeH9)actH9=topeH9;
        var arP;
        if(actH9>0)arP=_crXerPSub(C,{iso:PR.iso,hora:PR.hora},actH9);
        else{var ar9=iniRealF||_crFec(fi.o.act_start_date)||ini;ar9=_crXerCalSnap(C,ar9,false);arP={iso:ar9,hora:_crXerCalAbre(C,ar9)};
          var antP9=_crXerCalAnt(C,PR.iso);actH9=(_crASerial(antP9)!==''&&_crASerial(ar9)!==''&&_crASerial(antP9)>=_crASerial(ar9))?_crXerCalHoras(C,ar9,antP9):0}
        var totH9=Math.round((actH9+remH)*100)/100;if(!(totH9>0))totH9=(C.hpd>0)?C.hpd:10;
        pw('act_start_date',_crXerFec(arP.iso,arP.hora));
        pw('target_start_date',_crXerFec(arP.iso,arP.hora));
        pw('target_end_date',_crXerFec(F.iso,F.hora));
        pw('target_drtn_hr_cnt',_crXerNum(totH9));
        ini=arP.iso;hIni=arP.hora;
        t.iniReal=arP.iso;t.iniRealTabla=true;t.iniRealSint=true;t.durH=totH9;
        out.iniSint=(out.iniSint||0)+1}
      if(deTabla){
        var totH=Math.round(totTab*hpdC*100)/100;
        if(est==='Active'){
          /* el inicio real: (total - restante) dias laborables antes de la fecha de datos */
          var actD=Math.max(0,Math.round((totTab-rd)*100)/100);
          var ar=_crXerCalAtras(C,PR.iso,actD),hAr=_crXerCalAbre(C,ar);
          pw('act_start_date',_crXerFec(ar,hAr));
          pw('target_start_date',_crXerFec(ar,hAr));
          ini=ar;hIni=hAr;
          /* el modelo lleva el mismo inicio real: la auditoria compara contra el */
          t.iniReal=ar;t.iniRealTabla=true;
          /* el plan de una iniciada acaba donde acaba su remanente */
          pw('target_end_date',_crXerFec(F.iso,F.hora));
          pw('target_drtn_hr_cnt',_crXerNum(totH));
          t.durH=totH}
        else{
          /* sin empezar: original = remanente (regla de P6) y fin = inicio + duracion */
          var F0=(remH>0)?_crXerCalFinHoras(C,ini,remH,hIni):{iso:ini,hora:hIni};
          pw('target_end_date',_crXerFec(F0.iso,F0.hora));
          pw('target_drtn_hr_cnt',_crXerNum(remH));
          t.durH=remH}
        t.deTabla=true;t.totTab=totTab}
      if(!alc9&&!info){
        /* sin alcance: duracion original 0 y fin = inicio, o P6 vuelve a poner
           Remaining = Original al importar una Not Started */
        pw('target_drtn_hr_cnt','0');pw('target_end_date',_crXerFec(ini,hIni));
        t.durH=0}
      /* en curso y sin empezar, las TEMPRANAS son las del remanente (es lo
         que hace P6: para una actividad iniciada, early_start es el reinicio,
         no la fecha real, que ya viaja en act_start_date) */
      eIni=ir;hEi=hIr;
      eFin=F.iso;hEf=F.hora;
      pw('early_start_date',_crXerFec(eIni,hEi));
      pw('early_end_date',_crXerFec(eFin,hEf));
      _crXerLate(pw,ir,hIr,F.iso,F.hora,est,eIni,hEi,eFin,hEf)}

    /* las restricciones ya se vaciaron y se contaron arriba, antes de los
       return de LOE / hito / sin fecha */

    cierra()});

  /* ============ 1b) las asignaciones siguen a su tarea ==================== 
     Las fechas planificadas y las del remanente se copian de la TASK, y los
     ratios unidades/hora se rehacen con las duraciones que se acaban de
     escribir: _crXerEscribe los dejo con la duracion vieja y, si no se
     rehacen, P6 recalcula las unidades al correr la duracion (F13 de
     xer_rev_09). Las fechas REALES no se tocan: son del agente M. */
  var TRd=T.TASKRSRC;
  if(TRd&&TRd.cs.length){
    var porT={};TA.filas.forEach(function(f){porT[String(f.o.task_id)]=f});
    var CAMPOS=['target_start_date','target_end_date','restart_date','reend_date','rem_late_start_date','rem_late_end_date'];
    TRd.filas.forEach(function(x){
      var fi=porT[String(x.o.task_id)];if(!fi)return;
      var cod=_crTx(fi.o.task_code),t=modelo.tareas[cod];
      if(!t||t.eliminado)return;
      var tt2=String(fi.o.task_type||'TT_Task').trim();
      if(tt2==='TT_LOE'||tt2==='TT_WBS')return;
      var ch=false;
      var pr=function(campo,val){var j=TRd.col[campo];if(j==null)return;
        var sv=String(val==null?'':val);if(x.v[j]!==sv){x.v[j]=sv;ch=true}};
      CAMPOS.forEach(function(k){var j=TA.col[k];if(j==null)return;pr(k,fi.v[j])});
      /* con el remanente por la tabla el inicio real de la tarea cambio: la
         asignacion que lleva horas reales lo sigue */
      if((t.deTabla||t.iniRealSint)&&(Number(x.o.act_reg_qty)||0)>0){var ja=TA.col.act_start_date;if(ja!=null)pr('act_start_date',fi.v[ja])}
      var jd=TA.col.target_drtn_hr_cnt,jr=TA.col.remain_drtn_hr_cnt;
      var dur=(jd==null)?0:(Number(fi.v[jd])||0);
      var rdur=(jr==null)?0:(Number(fi.v[jr])||0);
      var q=Number(x.o.target_qty)||0,rq=Number(x.o.remain_qty)||0;
      pr('target_qty_per_hr',(dur>0?(q/dur):0).toFixed(6));
      pr('remain_qty_per_hr',(rdur>0?(rq/rdur):0).toFixed(6));
      if(ch){lineas[x.i]='%R	'+x.v.join('	');out.asigFechas=(out.asigFechas||0)+1}})}

  /* ==================== 2) TASKPRED: altas, cambios y bajas =============== */
  var CSTP=['task_pred_id','task_id','pred_task_id','proj_id','pred_proj_id','pred_type','lag_hr_cnt','comments','float_path','aref','arls'];
  var TP=T.TASKPRED;
  if(!TP||!TP.cs.length){
    /* el .xer no trae la tabla: se crea JUSTO ANTES del %E final (P6 exige que
       vaya despues de TASK, y el final del archivo cumple ese orden) */
    var iE=-1;
    for(var z=lineas.length-1;z>=0;z--){if(String(lineas[z]).indexOf('%E')===0){iE=z;break}}
    if(iE<0)iE=lineas.length;
    lineas.splice(iE,0,'%T\tTASKPRED','%F\t'+CSTP.join('\t'));
    T=_crXerTablas(lineas);TA=T.TASK;TP=T.TASKPRED;
    /* los indices de linea cambiaron: se rehacen los mapas */
    idDe={};codDeId={};projDe={};filaDe={};
    TA.filas.forEach(function(fi){var cod=_crTx(fi.o.task_code);
      idDe[cod]=String(fi.o.task_id);codDeId[String(fi.o.task_id)]=cod;
      projDe[String(fi.o.task_id)]=String(fi.o.proj_id||'');filaDe[cod]=fi});
    out.avisos.push('el .xer no traia tabla TASKPRED: se creo al final del archivo')}

  var vivas={},tumbas={};
  (modelo.relaciones||[]).forEach(function(r){
    if(!r||!r.succ||!r.pred)return;
    var su=_crTx(r.succ),pr=_crTx(r.pred);
    if(su===pr)return;
    var k=su+'|'+pr;
    if(r.eliminado){if(!vivas[k])tumbas[k]=1;return}
    vivas[k]={succ:su,pred:pr,tipo:_crXerTipoRel(r.tipo),lagD:Number(r.lagD)||0};
    delete tumbas[k]});

  var drop={},vistas={},maxId=0;
  TP.filas.forEach(function(fi){var n=Number(fi.o.task_pred_id)||0;if(n>maxId)maxId=n});
  TP.filas.forEach(function(fi){
    var ti=String(fi.o.task_id),pi=String(fi.o.pred_task_id);
    var su=codDeId[ti],pr=codDeId[pi];
    /* huerfana o autorreferencia: P6 rechaza el archivo entero */
    if(!su||!pr||ti===pi){drop[fi.i]=1;out.rel_huerf++;return}
    var k=su+'|'+pr;
    if(tumbas[k]){drop[fi.i]=1;out.rel_del++;return}
    var r=vivas[k];
    if(!r){out.rel_ajenas++;return}          /* del .xer y el aplicativo no la conoce: intacta */
    if(vistas[k]){drop[fi.i]=1;out.rel_dup++;return}
    vistas[k]=1;
    var toca=false;
    var pw=function(campo,val){var j=TP.col[campo];if(j==null)return;
      var s=String(val==null?'':val);if(fi.v[j]!==s){fi.v[j]=s;toca=true}};
    var hpdL=_crXerHpdLag(lineas,T,filaDe[su],filaDe[pr]);
    if(modelo.hpd&&Math.abs(hpdL-Number(modelo.hpd))>0.001&&out.avisos.length<40)
      out.avisos.push('la relacion '+su+' <- '+pr+' usa un calendario de '+_crXer2(hpdL)+' h/dia y el modelo trabaja con '+_crXer2(modelo.hpd));
    var tipo='PR_'+r.tipo,lag=_crXerNum(r.lagD*hpdL);
    var cambio=(String(fi.o.pred_type||'')!==tipo)||(Math.abs((Number(fi.o.lag_hr_cnt)||0)-Number(lag))>0.005);
    pw('pred_type',tipo);pw('lag_hr_cnt',lag);
    pw('proj_id',projDe[ti]||'');pw('pred_proj_id',projDe[pi]||projDe[ti]||'');
    if(toca){lineas[fi.i]='%R\t'+fi.v.join('\t');if(cambio)out.rel_act++}});

  var nuevas=[],plantilla=TP.filas.length?TP.filas[0]:null;
  var claves=[];Object.keys(vivas).forEach(function(k){claves.push(k)});
  claves.sort();                                   /* orden fijo: dos exportaciones iguales dan el mismo archivo */
  claves.forEach(function(k){
    if(vistas[k])return;
    var r=vivas[k],ti=idDe[r.succ],pi=idDe[r.pred];
    if(!ti||!pi){out.rel_sin.push(r.succ+' <- '+r.pred+(ti?' (falta la predecesora en el .xer)':' (falta la sucesora en el .xer)'));return}
    var v=plantilla?plantilla.v.slice():TP.cs.map(function(){return ''});
    while(v.length<TP.cs.length)v.push('');
    v.length=TP.cs.length;
    var pw=function(campo,val){var j=TP.col[campo];if(j!=null)v[j]=String(val==null?'':val)};
    var hpdL=_crXerHpdLag(lineas,T,filaDe[r.succ],filaDe[r.pred]);
    pw('task_pred_id',String(++maxId));
    pw('task_id',ti);pw('pred_task_id',pi);
    pw('proj_id',projDe[ti]||'');pw('pred_proj_id',projDe[pi]||projDe[ti]||'');
    pw('pred_type','PR_'+r.tipo);
    pw('lag_hr_cnt',_crXerNum(r.lagD*hpdL));
    pw('comments','');pw('float_path','');pw('aref','');pw('arls','');
    nuevas.push('%R\t'+v.join('\t'));out.rel_new++});

  if(nuevas.length||_crXerAlgo(drop)){
    var res=[],met=false,i;
    for(i=0;i<lineas.length;i++){
      /* la insercion va atada a la POSICION, no a que la fila sobreviva: si la
         ultima de TASKPRED se borraba, las nuevas se perdian en silencio */
      if(!drop[i])res.push(lineas[i]);
      if(i===TP.ultima&&nuevas.length&&!met){met=true;
        for(var q=0;q<nuevas.length;q++)res.push(nuevas[q])}}
    if(nuevas.length&&!met){
      var iE2=res.length;
      for(i=res.length-1;i>=0;i--){if(String(res[i]).indexOf('%E')===0){iE2=i;break}}
      res=res.slice(0,iE2).concat(nuevas,res.slice(iE2))}
    lineas.length=0;
    for(i=0;i<res.length;i++)lineas.push(res[i])}

  /* la red corrida a la fecha de datos: como el F9 de P6 */
  try{_crXerCorrer(lineas,modelo,out)}catch(_ecr){out.avisos.push('no se pudo correr la red: '+((_ecr&&_ecr.message)||_ecr))}
  return out}

/* ============================================================================
   CORRER LA RED (el F9 del aplicativo) y PERIODOS FINANCIEROS
   ----------------------------------------------------------------------------
   Pedido del usuario (19/09/2026): el .xer tiene que salir "corrido" a la
   fecha de datos, como lo deja P6 despues de F9, y con el avance real de cada
   semana (lo que ensena la Tabla 2) guardado como periodos financieros.

   _crXerCorrer   pasada hacia delante y hacia atras por TASKPRED con el
                  calendario de cada actividad, la fecha de datos como piso,
                  retained logic o progress override segun SCHEDOPTIONS y el
                  calendario del lag segun sched_calendar_on_relationship_lag.
                  Escribe restart/reend, early_*, late_*, rem_late_*, target_*
                  de las no iniciadas y los dos flotantes.
   _crXerGanadoSem lo GANADO por actividad y por semana (viernes a jueves,
                  el corte del reporte) hasta el corte, con la misma cuenta de
                  la curva roja y de la Tabla 2 (_crFracHechaAt + _crGanadas).
   _crXerPeriodos escribe FINDATES (una fila por semana), TRSRCFIN (HH y costo
                  real por asignacion y periodo) y TASKFIN (por actividad);
                  cada serie se cuadra al centimo con act_work_qty / act_reg_qty
                  y act_this_per_* queda en 0 (todo el real esta en periodos
                  cerrados). PROJECT.last_fin_dates_id = el ultimo periodo.
   ============================================================================ */
var _XTAB=String.fromCharCode(9);
function _crXerPt(s){s=String(s||'');var m=/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s);if(m)return {iso:m[1],hora:m[2]};var d=s.slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(d))return {iso:d,hora:'07:00'};return null}
function _crXerPk(p){return p?(p.iso+' '+p.hora):''}
function _crXerPmax(a,b){if(!a)return b;if(!b)return a;return (_crXerPk(b)>_crXerPk(a))?b:a}
function _crXerPmin(a,b){if(!a)return b;if(!b)return a;return (_crXerPk(b)<_crXerPk(a))?b:a}
/* un punto como INICIO de trabajo en el calendario C: dia habil y dentro de la jornada */
function _crXerPIni(C,p){
  if(!p)return p;var iso=p.iso,hora=p.hora;
  if(!_crXerCalLab(C,iso)){iso=_crXerCalSnap(C,iso,false);return {iso:iso,hora:_crXerCalAbre(C,iso)}}
  var hd=_crXerCalHorasDia(C,iso),pas=_crXerCalPasadas(C,iso,hora);
  if(pas>=hd-1e-9){iso=_crXerCalSig(C,iso);return {iso:iso,hora:_crXerCalAbre(C,iso)}}
  return {iso:iso,hora:_crXerCalHoraDe(C,iso,pas)}}
/* un punto como FIN de trabajo: dia habil y no antes de la entrada */
function _crXerPFin(C,p){
  if(!p)return p;var iso=p.iso,hora=p.hora;
  if(!_crXerCalLab(C,iso)){iso=_crXerCalSnap(C,iso,true);return {iso:iso,hora:_crXerCalCierra(C,iso)}}
  var pas=_crXerCalPasadas(C,iso,hora);
  if(pas<=1e-9){iso=_crXerCalAnt(C,iso);return {iso:iso,hora:_crXerCalCierra(C,iso)}}
  return {iso:iso,hora:_crXerCalHoraDe(C,iso,pas)}}
function _crXerPAdd(C,p,H){H=Number(H)||0;if(!p)return p;if(H<=1e-9)return p;var q=_crXerPIni(C,p);var r=_crXerCalFinHoras(C,q.iso,H,q.hora);return {iso:r.iso,hora:r.hora}}
function _crXerPSub(C,p,H){H=Number(H)||0;if(!p)return p;
  var q=_crXerPFin(C,p),iso=q.iso,hora=q.hora;
  var rest=H,d=_crASerial(iso),k=0;if(d==='')return p;
  var pas=_crXerCalPasadas(C,iso,hora);
  if(rest<=pas+1e-9)return {iso:iso,hora:_crXerCalHoraDe(C,iso,Math.max(0,pas-rest))};
  rest-=pas;
  while(k<20000){d--;k++;var f=_crDeSerial(d),hd=_crXerCalHorasDia(C,f);if(!(hd>1e-9))continue;
    if(rest<=hd+1e-9)return {iso:f,hora:_crXerCalHoraDe(C,f,hd-rest)};rest-=hd}
  return {iso:_crDeSerial(d),hora:_crXerCalAbre(C,_crDeSerial(d))}}
/* horas de jornada entre dos puntos (negativo si b es anterior a a) */
function _crXerPHoras(C,a,b){
  if(!a||!b)return 0;
  if(_crXerPk(b)<_crXerPk(a))return -_crXerPHoras(C,b,a);
  var da=_crASerial(a.iso),db=_crASerial(b.iso);if(da===''||db==='')return 0;
  var pa=_crXerCalPasadas(C,a.iso,a.hora),pb=_crXerCalPasadas(C,b.iso,b.hora);
  if(da===db)return Math.round((pb-pa)*100)/100;
  var h=_crXerCalHorasDia(C,a.iso)-pa;
  for(var d=da+1;d<db;d++)h+=_crXerCalHorasDia(C,_crDeSerial(d));
  h+=pb;return Math.round(h*100)/100}
/* sumar horas de reloj (calendario de 24 h) */
function _crXerP24(p,H){
  var t=Date.parse(p.iso+'T'+p.hora+':00Z');if(!isFinite(t))return p;
  var d=new Date(t+(Number(H)||0)*3600e3);
  var hh=d.getUTCHours(),mi=d.getUTCMinutes();
  return {iso:d.toISOString().slice(0,10),hora:(hh<10?'0':'')+hh+':'+(mi<10?'0':'')+mi}}

function _crXerCorrer(lineas,modelo,out){
  var res={n:0,movidas:0,ciclos:0,fin:'',logica:'',detalle:[]};
  out.corrido=res;
  var T=_crXerTablas(lineas),TA=T.TASK,TP=T.TASKPRED;
  if(!TA||!TA.cs.length)return res;
  var DD=_crXerDD(lineas,modelo);
  var P0={iso:DD.piso.iso,hora:DD.piso.hora};
  var SO=(T.SCHEDOPTIONS&&T.SCHEDOPTIONS.filas[0])?T.SCHEDOPTIONS.filas[0].o:{};
  var override=String(SO.sched_progress_override||'N').trim()==='Y';
  var lagCal=String(SO.sched_calendar_on_relationship_lag||'');
  res.logica=override?'progress override':'retained logic';
  var N={},lista=[];
  TA.filas.forEach(function(fi){
    var o=fi.o,tt=String(o.task_type||'TT_Task').trim();
    if(tt==='TT_LOE'||tt==='TT_WBS')return;
    var st=String(o.status_code||'TK_NotStart').trim();
    var n={id:String(o.task_id),fi:fi,o:o,tt:tt,st:st,cod:_crTx(o.task_code),
      C:_crXerCalendario(lineas,o.clndr_id),
      rem:(st==='TK_Complete')?0:Math.max(0,Number(o.remain_drtn_hr_cnt)||0),
      preds:[],succs:[],ind:0};
    if(tt==='TT_Mile'||tt==='TT_FinMile')n.rem=0;
    n.aS=_crXerPt(o.act_start_date);n.aF=_crXerPt(o.act_end_date);
    N[n.id]=n;lista.push(n)});
  if(TP&&TP.cs.length)TP.filas.forEach(function(f){
    var s=N[String(f.o.task_id)],p=N[String(f.o.pred_task_id)];
    if(!s||!p||s===p)return;
    var tipo=String(f.o.pred_type||'PR_FS').replace(/^PR_/,'').toUpperCase(),lag=Number(f.o.lag_hr_cnt)||0;
    var Cl=(/predecessor/i.test(lagCal))?p.C:((/24/.test(lagCal))?null:s.C);
    var r={s:s,p:p,tipo:tipo,lag:lag,Cl:Cl};
    s.preds.push(r);p.succs.push(r)});
  var addL=function(Cl,pt,lag){
    if(!pt)return pt;lag=Number(lag)||0;if(!(Math.abs(lag)>1e-9))return pt;
    if(!Cl)return _crXerP24(pt,lag);
    return (lag>0)?_crXerPAdd(Cl,pt,lag):_crXerPSub(Cl,pt,-lag)};
  /* orden topologico */
  lista.forEach(function(n){n.ind=n.preds.length});
  var cola=lista.filter(function(n){return n.ind===0}),orden=[],vis={};
  while(cola.length){var n0=cola.shift();if(vis[n0.id])continue;vis[n0.id]=1;orden.push(n0);
    n0.succs.forEach(function(r){r.s.ind--;if(r.s.ind===0)cola.push(r.s)})}
  var enCiclo=lista.filter(function(n){return !vis[n.id]});
  res.ciclos=enCiclo.length;
  if(enCiclo.length)out.avisos.push('la red tiene un bucle: '+enCiclo.slice(0,8).map(function(n){return n.cod}).join(', ')+(enCiclo.length>8?'...':'')+' quedan sin correr (P6 tampoco las programa)');
  /* ---- hacia delante ---- */
  orden.forEach(function(n){
    if(n.st==='TK_Complete'){n.S=n.aS;n.F=n.aF||n.aS;n.ES=n.S;n.EF=n.F;return}
    var base=_crXerPIni(n.C,P0),ini=base,finC=null;
    n.preds.forEach(function(r){
      var p=r.p;
      var pS=(p.st==='TK_NotStart')?p.ES:(p.aS||p.ES),pF=p.EF;
      if(!pS&&!pF)return;
      if(r.tipo==='FS'){if(pF)ini=_crXerPmax(ini,addL(r.Cl,pF,r.lag))}
      else if(r.tipo==='SS'){if(pS)ini=_crXerPmax(ini,addL(r.Cl,pS,r.lag))}
      else if(r.tipo==='FF'){if(pF)finC=_crXerPmax(finC,addL(r.Cl,pF,r.lag))}
      else if(r.tipo==='SF'){if(pS)finC=_crXerPmax(finC,addL(r.Cl,pS,r.lag))}});
    if(n.st==='TK_Active'&&override)ini=base;
    var ES=_crXerPIni(n.C,ini);
    /* una FF/SF manda sobre el fin: con duracion fija el inicio se corre */
    if(finC){var f7=_crXerPFin(n.C,finC);var s7=_crXerPIni(n.C,_crXerPSub(n.C,f7,n.rem));if(_crXerPk(s7)>_crXerPk(ES))ES=s7}
    var EF=(n.rem>0)?_crXerPAdd(n.C,ES,n.rem):ES;
    n.ES=ES;n.EF=EF;n.S=(n.st==='TK_Active'&&n.aS)?n.aS:ES;n.F=EF});
  /* ---- hacia atras ---- */
  var finP=null;
  lista.forEach(function(n){if(n.st!=='TK_Complete'&&n.EF)finP=_crXerPmax(finP,n.EF)});
  if(!finP)finP=P0;
  res.fin=_crXerFec(finP.iso,finP.hora);
  for(var q=orden.length-1;q>=0;q--){
    var n=orden[q];if(n.st==='TK_Complete')continue;
    var LF=null;
    n.succs.forEach(function(r){
      var s=r.s;if(s.st==='TK_Complete'||!s.LS||!s.LF)return;
      var c9=null;
      if(r.tipo==='FS')c9=addL(r.Cl,s.LS,-r.lag);
      else if(r.tipo==='FF')c9=addL(r.Cl,s.LF,-r.lag);
      else if(r.tipo==='SS'){var ls=addL(r.Cl,s.LS,-r.lag);c9=(n.rem>0)?_crXerPAdd(n.C,ls,n.rem):ls}
      else if(r.tipo==='SF'){var lf=addL(r.Cl,s.LF,-r.lag);c9=(n.rem>0)?_crXerPAdd(n.C,lf,n.rem):lf}
      if(c9)LF=_crXerPmin(LF,c9)});
    if(!LF)LF=finP;
    if(_crXerPk(LF)<_crXerPk(n.EF))LF=n.EF;   /* sin restricciones no hay flotante negativo */
    n.LF=_crXerPFin(n.C,LF);
    n.LS=(n.rem>0)?_crXerPSub(n.C,n.LF,n.rem):n.LF;
    n.TF=Math.max(0,_crXerPHoras(n.C,n.EF,n.LF));
    var ff=null;
    n.succs.forEach(function(r){
      var s=r.s;if(s.st==='TK_Complete'||!s.ES)return;var h=null;
      if(r.tipo==='FS')h=_crXerPHoras(n.C,addL(r.Cl,n.EF,r.lag),s.ES);
      else if(r.tipo==='SS')h=_crXerPHoras(n.C,addL(r.Cl,n.S||n.ES,r.lag),s.ES);
      else if(r.tipo==='FF')h=_crXerPHoras(n.C,addL(r.Cl,n.EF,r.lag),s.EF);
      else if(r.tipo==='SF')h=_crXerPHoras(n.C,addL(r.Cl,n.S||n.ES,r.lag),s.EF);
      if(h!=null&&(ff==null||h<ff))ff=h});
    n.FF=(ff==null)?n.TF:Math.max(0,Math.min(ff,n.TF))}
  /* ---- escribir ---- */
  var CAMPOS=['target_start_date','target_end_date','restart_date','reend_date','rem_late_start_date','rem_late_end_date'];
  orden.forEach(function(n){
    if(n.st==='TK_Complete'||!n.ES||!n.EF||!n.LS||!n.LF)return;
    var fi=n.fi,toca=false;
    var pw=function(campo,val){var j=TA.col[campo];if(j==null)return;var s=String(val==null?'':val);if(fi.v[j]!==s){fi.v[j]=s;toca=true}};
    var rs0=String(fi.o.restart_date||'').slice(0,16),re0=String(fi.o.reend_date||'').slice(0,16);
    var esF=_crXerFec(n.ES.iso,n.ES.hora),efF=_crXerFec(n.EF.iso,n.EF.hora);
    var lsF=_crXerFec(n.LS.iso,n.LS.hora),lfF=_crXerFec(n.LF.iso,n.LF.hora);
    pw('restart_date',esF);pw('reend_date',efF);
    pw('early_start_date',esF);pw('early_end_date',efF);
    pw('rem_late_start_date',lsF);pw('rem_late_end_date',lfF);pw('late_end_date',lfF);
    if(n.st==='TK_NotStart'){pw('target_start_date',esF);pw('target_end_date',efF);pw('late_start_date',lsF);
      /* P6 IGUALA Remaining a Original en toda no iniciada al importar (lo dice
         el propio comentario de _crXerEscribe): si el archivo sale con
         original = span del plan viejo y remanente = rd x hpd, el remanente
         que calculo la hoja 2 se pierde y la actividad dura lo que decia el
         plan (X5 P1-C). El plan de una no iniciada ES su remanente, y ademas
         asi el par de fechas planificadas y la duracion original cuadran.
         Las informativas que el usuario no ha movido se dejan con lo del
         archivo, que es la regla de _crXerFechas para ellas. */
      var _ti9=(modelo&&modelo.tareas)?modelo.tareas[n.cod]:null;
      if(!(_ti9&&_ti9.informativa&&!_ti9.movida)){
        pw('target_drtn_hr_cnt',_crXerNum(n.rem));
        if(_ti9)_ti9.durH=n.rem}}
    else{
      /* iniciada con inicio real SINTETICO (remanente por HH): la red pudo
         correr su fin, y el tramo real tiene que seguir pesando exactamente
         las HH reales sobre TODO el plan (inicio real -> fin del remanente,
         hueco de la logica incluido): actH = tramo x real / remanente,
         original = actH + tramo, inicio real = fecha de datos - actH */
      var t9=(modelo&&modelo.tareas)?modelo.tareas[n.cod]:null;
      if(t9&&t9.iniRealSint){
        var A9=Number(fi.o.act_work_qty)||0,R9=Number(fi.o.remain_work_qty)||0;
        var p0=_crXerPIni(n.C,P0),span=Math.max(0,_crXerPHoras(n.C,p0,n.EF));
        if(A9>0&&R9>0&&span>0){
          var actH=Math.round(span*A9/R9*100)/100;
          var topeH=5000*((n.C.hpd>0)?n.C.hpd:10);if(actH>topeH)actH=topeH;
          var AS=_crXerPSub(n.C,p0,actH),asF=_crXerFec(AS.iso,AS.hora);
          pw('act_start_date',asF);pw('target_start_date',asF);
          pw('target_drtn_hr_cnt',_crXerNum(Math.round((actH+span)*100)/100));
          n.aS=AS;t9.iniReal=AS.iso;t9.durH=Math.round((actH+span)*100)/100}}
      pw('target_end_date',efF);
      /* CON EL REMANENTE POR LA TABLA la duracion original la escribio
         _crXerFechas como el total de la tabla x hpd, y aqui la red acaba de
         correr el fin: el par de fechas planificadas pasa a valer otra cosa y
         P6 reparte el presupuesto sobre ESE tramo, no sobre target_drtn (X4
         H4: plan 09/09-29/09 = 180 h con target_drtn 150 h daba 200.00 hh
         acumuladas frente a 240.00 reales). La rama del inicio real sintetico
         ya rehace su propia duracion mas arriba. */
      if(n.aS&&t9&&t9.deTabla&&!t9.iniRealSint&&t9.alcance!==false){
        var _td9=_crXerPHoras(n.C,_crXerPIni(n.C,n.aS),n.EF);
        if(_td9>0){_td9=Math.round(_td9*100)/100;pw('target_drtn_hr_cnt',_crXerNum(_td9));t9.durH=_td9}}
      pw('late_start_date',n.aS?_crXerFec(n.aS.iso,n.aS.hora):lsF)}
    pw('total_float_hr_cnt',_crXerNum(n.TF));pw('free_float_hr_cnt',_crXerNum(n.FF));
    res.n++;
    if(esF.slice(0,10)!==rs0.slice(0,10)||efF.slice(0,10)!==re0.slice(0,10)){res.movidas++;
      if(res.detalle.length<300)res.detalle.push(n.cod+': '+((esF.slice(0,10)!==rs0.slice(0,10))?(rs0.slice(0,10)+' -> '+esF.slice(0,10)):('inicio '+esF.slice(0,16)))+((efF.slice(0,10)!==re0.slice(0,10))?(' (fin '+re0.slice(0,10)+' -> '+efF.slice(0,10)+')'):''))}
    else if(esF.slice(0,16)!==rs0||efF.slice(0,16)!==re0)res.horas=(res.horas||0)+1;
    if(toca)lineas[fi.i]='%R'+_XTAB+fi.v.join(_XTAB)});
  /* las asignaciones siguen a su tarea */
  var TR=T.TASKRSRC;
  if(TR&&TR.cs.length){
    var porT={};TA.filas.forEach(function(f){porT[String(f.o.task_id)]=f});
    TR.filas.forEach(function(x){
      var fi=porT[String(x.o.task_id)];if(!fi)return;var ch=false;
      CAMPOS.forEach(function(k){var j=TA.col[k],jj=TR.col[k];if(j==null||jj==null)return;var v=String(fi.v[j]==null?'':fi.v[j]);if(x.v[jj]!==v){x.v[jj]=v;ch=true}});
      /* LOS RATIOS UNIDADES/TIEMPO, otra vez (X5 P1-B): _crXerFechas los rehizo
         en su bloque 1b, pero _crXerCorrer corre DESPUES y acaba de cambiar
         target_drtn_hr_cnt. Con duration_type = DT_FixedDrtn (Fixed Duration
         AND Units/Time) P6 deriva Unidades = Duracion x Unidades/Tiempo en
         cuanto algo toca la duracion, y el presupuesto se moveria solo. */
      try{var _jd=TA.col.target_drtn_hr_cnt,_jr=TA.col.remain_drtn_hr_cnt;
        var _d=(_jd==null)?0:(Number(fi.v[_jd])||0),_r=(_jr==null)?0:(Number(fi.v[_jr])||0);
        var _q=Number(x.o.target_qty)||0,_rq=Number(x.o.remain_qty)||0;
        var _ju=TR.col.target_qty_per_hr,_jru=TR.col.remain_qty_per_hr;
        if(_ju!=null){var _u=(_d>0?(_q/_d):0).toFixed(6);if(x.v[_ju]!==_u){x.v[_ju]=_u;ch=true}}
        if(_jru!=null){var _ru=(_r>0?(_rq/_r):0).toFixed(6);if(x.v[_jru]!==_ru){x.v[_jru]=_ru;ch=true}}}catch(_eu){}
      /* la asignacion con horas reales sigue el inicio real sintetico de su tarea */
      try{if((Number(x.o.act_reg_qty)||0)>0){
          /* toda asignacion con horas reales lleva las fechas reales de su
             tarea (el inicio sintetico de las iniciadas, y en las terminadas
             tambien el fin: cinco asignaciones de terminadas salian sin
             fechas reales y P6 no sabe donde repartir esas horas) */
          var ja=TA.col.act_start_date,jb=TR.col.act_start_date;if(ja!=null&&jb!=null){var va=String(fi.v[ja]||'');if(x.v[jb]!==va){x.v[jb]=va;ch=true}}
          var jc=TA.col.act_end_date,jd=TR.col.act_end_date;if(jc!=null&&jd!=null){var vb=(String(fi.o.status_code||'')==='TK_Complete')?String(fi.v[jc]||''):'';if(x.v[jd]!==vb){x.v[jd]=vb;ch=true}}}}catch(_e8){}
      if(ch)lineas[x.i]='%R'+_XTAB+x.v.join(_XTAB)})}
  return res}

/* lo ganado por actividad y por semana (viernes a jueves) hasta el corte */
/* ============================================================================
   LA VENTANA DE AVANCE DE UN CRONOGRAMA  (la Tabla 2, sin armar la Tabla 2)

   _crXerRangoAvance(c) devuelve el universo del alcance, las fechas con
   movimiento, la PRIMERA y la ULTIMA fecha con avance REAL (la ultima columna
   de la Tabla 2 con dato) y una funcion `gan(iso)` con lo ganado a esa fecha.
   De aqui salen el `max` del input de corte del dialogo, el aviso "la Tabla 2
   solo tiene avance hasta dd/mm/yyyy" y el % fisico al corte.

   Se mide con la MISMA cuenta de la Tabla 2 y de la curva roja
   (_crFracHechaAt ponderado por las HH del alcance, = _crCurvaReal) sobre
   _crTablaDatosMemo(c) -- la tabla SIN corte, igual que _t23Datos y que
   _crXerGanadoSem -- para no rearmar la tabla del alcance en cada tecla.

   El tope NO puede salir de `per[].fin` de la Tabla 2: en modo semana
   _t23Periodos emite el jueves COMPLETO de la semana en curso, que es una
   fecha futura. El tope correcto es min(hoy, ultimo evento que MUEVE la
   fraccion): una celda de la Tabla 2 solo es distinta de cero donde la
   fraccion cambia, y la fraccion solo cambia en una fecha de _t23Eventos.
   Un retroceso (delta negativo) tambien pinta celda, por eso el criterio es
   |delta| > 1e-6 y no delta > 0.
   ============================================================================ */
/* los memos de la Tabla 2 se tiran solos cuando cambian los partes, los
   metrados o los borrados: MISMA firma que la cabecera de _t23Datos, y sobre
   la MISMA variable window._t23SigP, para que sea idempotente con ella */
function _crXerFrescoT23(){
  try{var _sp=(typeof state!=='undefined'&&state.partes)||[],_ts=0;
    for(var _q=0;_q<_sp.length;_q++){var _z=_sp[_q];if(!_z)continue;_ts+=((Number(_z.ts)||0)%1e9)+(Number(_z.cant)||0)+(Number(_z.hh)||0)+(Number(_z.pctGlb)||0)+(String(_z.fecha||'').length)}
    var _mt=(typeof state!=='undefined'&&state.meta)||{},_tm=0;for(var _k in _mt){var _y=_mt[_k];if(_y)_tm+=((Number(_y.ts)||0)%1e9)+(Number(_y.total)||0)}
    var _sg=_sp.length+'|'+_ts+'|'+(((typeof state!=='undefined'&&state.delpartes)||[]).length)+'|'+_tm;
    if(window._t23SigP!==_sg){window._t23SigP=_sg;_t23Tira()}}catch(_es){}}
/* el ultimo jueves <= iso: el corte del reporte semanal y de la Tabla 2 */
function _crXerJueves(iso){
  try{var n=_crASerial(iso);if(n==='')return '';
    var dw=new Date(String(iso).slice(0,10)+'T00:00:00Z').getUTCDay();
    return _crDeSerial(n-((dw-4+7)%7))}catch(_e){return String(iso||'').slice(0,10)}}
/* dd/mm/yyyy para los mensajes */
function _crXerDMY(iso){var t=String(iso||'').slice(0,10);
  return (t.length===10)?(t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4)):t}
async function _crXerRangoAvance(c){
  _crXerFrescoT23();
  var hoy=(typeof todayISO==='function')?todayISO():'';
  var D=await _crTablaDatosMemo(c);
  var u=(D&&D.u)||{items:{},hh:0},porId={},id;
  ((D&&D.filas)||[]).forEach(function(r){if(r&&r.id)porId[r.id]=r});
  var hhT=0;for(id in u.items)hhT+=Number(u.items[id])||0;
  /* las fechas con movimiento de TODO el universo (partes y fases), hasta hoy */
  var E={};for(id in u.items){try{(_t23Eventos(id)||[]).forEach(function(f){if(f&&(!hoy||f<=hoy))E[f]=1})}catch(_e1){}}
  var ev=Object.keys(E).sort();
  var memo={},gan=function(iso){iso=String(iso||'').slice(0,10);if(!iso)return 0;
    if(memo[iso]!=null)return memo[iso];
    var g=0;for(var i in u.items){var hi=Number(u.items[i])||0;if(!(hi>0))continue;
      g+=hi*Math.max(0,Math.min(1,Number(_crFracHechaAt(porId[i],iso))||0))}
    return (memo[iso]=g)};
  /* la ULTIMA fecha con dato: el ultimo evento en el que lo ganado CAMBIA.
     Un parte que no mueve la fraccion (o uno de una partida fuera del
     universo) no pinta celda en la Tabla 2 y no vale como corte. */
  var ult='',j=ev.length-1,g1=ev.length?gan(ev[ev.length-1]):0,vuelta=0;
  while(j>=0&&vuelta<60){vuelta++;
    var g0=(j>0)?gan(ev[j-1]):0;
    if(Math.abs(g1-g0)>1e-6){ult=ev[j];break}
    g1=g0;j--}
  /* si NINGUN evento mueve nada (todos los partes en 0) no se bloquea al
     usuario: el tope cae en el ultimo evento */
  if(!ult&&ev.length)ult=ev[ev.length-1];
  return {cid:String((c&&c.cron_id)||''),hoy:hoy,hhUni:hhT,ev:ev,
    min:(ev[0]||''),ult:ult,gan:gan,max:(ult||hoy)}}

async function _crXerGanadoSem(c,corte,modo,modelo){
  corte=String(corte||'').slice(0,10);modo=(modo==='dia')?'dia':'sem';
  var tar=((await _crTareas(c.cron_id))||[]).filter(function(t){return t&&!t.eliminado});
  var alc=await _crAlc(c.cron_id),u=_crUniverso(c.cron_id,alc);
  /* LA MISMA FOTO QUE EL MODELO: _crXerModelo ya armo la tabla al corte y la
     dejo en modelo.tabla; esto era una SEGUNDA pasada completa de
     _crTablaDatos por exportacion. El numero no cambia -y por tanto el .xer
     sigue cuadrando con lo que el usuario VE en la Tabla 2 (X4 H9)- porque
     _crFracHechaAt solo lee campos que no dependen de la foto (r.metF, r.met y,
     de cada apartado, hh y metF) y remide el avance por su cuenta en cada
     p.fin con _fzAvanceAt / acumCantAt. Sin modelo se cae a la tabla al corte,
     que es la que usa el resto del motor (X3 H3). */
  var filas=(((modelo&&modelo.tabla)||(await _crTablaDatos(c,corte)))||{}).filas||[],P={};
  filas.forEach(function(r){if(r&&r.id)P[r.id]=r});
  var rp=_crReparto(tar);
  var _mF={},frac=function(id,iso){var k=id+'|'+iso,v=_mF[k];if(v!=null)return v;v=Math.max(0,Math.min(1,Number(_crFracHechaAt(P[id],iso))||0));_mF[k]=v;return v};
  var min='';
  for(var id in u.items){try{var ev=(typeof _t23Eventos==='function')?_t23Eventos(id):[];if(ev.length&&(!min||ev[0]<min))min=ev[0]}catch(_e){}}
  /* sin periodos, pero DICIENDO POR QUE (X4 H6): hasta ahora el .xer salia
     sin un solo FINDATES y en silencio */
  if(!min||!corte||min>corte)return {per:[],W:{},modo:modo,corte:corte,t2:0,t2Tar:0,hh:0,
    motivo:(min?('el corte '+corte+' es anterior al primer avance ('+min+')')
               :'ninguna partida del alcance tiene partes con fecha')};
  var s0=_crASerial(min);if(s0==='')return {per:[],W:{},modo:modo,corte:corte,t2:0,t2Tar:0,hh:0,motivo:'la fecha del primer avance ('+min+') no es una fecha valida'};
  var per=[],k=0;
  if(modo==='dia'){
    /* DIA A DIA: un periodo por cada dia natural desde el primer parte hasta el corte */
    var a1=min;while(a1<=corte&&k<2000){k++;per.push({ini:a1,fin:a1});a1=_crDeSerial(_crASerial(a1)+1)}}
  else{
    var d0=new Date(min+'T00:00:00Z').getUTCDay(),back=(d0-5+7)%7;
    var a=_crDeSerial(s0-back);
    while(a<=corte&&k<400){k++;var fin=_crDeSerial(_crASerial(a)+6);if(fin>corte)fin=corte;per.push({ini:a,fin:fin});a=_crDeSerial(_crASerial(fin)+1)}}
  var W={};
  tar.forEach(function(t){
    var cod=String(t.task_code||'');if(!cod)return;
    var prev=0,ser=[];
    per.forEach(function(p){
      var g=0;
      (t.items||[]).forEach(function(i){var hi=Number(u.items[i])||0;if(!(hi>0))return;g+=_crGanadas(rp,i,cod,hi,frac(i,p.fin))});
      if(g<prev)g=prev;ser.push(g-prev);prev=g});
    W[cod]=ser});
  /* EL ACUMULADO DE LA TABLA 2 AL CORTE, que es el numero contra el que el
     usuario quiere cuadrar el archivo:
        t2  = suma_i u.items[i] x _crFracHechaAt(fila_i, corte)   (TODO el
              universo del cronograma, con actividad o sin ella)
        t2Tar = la suma de la matriz W = lo que llega a alguna actividad y por
              tanto lo unico que puede salir en el .xer; la diferencia es
              modelo.perdido
        hh  = las HH forecast del universo, para el % al corte
     Se calcula aqui porque `frac` ya esta memoizada y no cuesta una pasada mas. */
  var t29=0,hh9=0,id9;
  for(id9 in u.items){var h9=Number(u.items[id9])||0;if(!(h9>0))continue;hh9+=h9;t29+=h9*frac(id9,corte)}
  var tT9=0,cd9;
  for(cd9 in W)(W[cd9]||[]).forEach(function(v9){tT9+=Number(v9)||0});
  return {per:per,W:W,modo:modo,corte:corte,
    t2:Math.round(t29*100)/100,t2Tar:Math.round(tT9*100)/100,hh:Math.round(hh9*100)/100}}

function _crXerPeriodos(lineas,modelo,G){
  var res={n:0,tareas:0,asig:0,hh:0,desde:'',hasta:'',avisos:[]};
  /* el acumulado de la Tabla 2 al corte viaja hasta el mensaje aunque no haya
     un solo periodo financiero que escribir */
  if(G){res.t2=(G.t2==null)?null:Number(G.t2);res.t2Tar=(G.t2Tar==null)?null:Number(G.t2Tar);
    res.hhUniv=(G.hh==null)?null:Number(G.hh);res.corte=String(G.corte||'')}
  if(!G||!G.per||!G.per.length){if(G&&G.motivo)res.avisos.push('el .xer sale SIN periodos financieros: '+G.motivo);return res}
  var T=_crXerTablas(lineas),TA=T.TASK,TR=T.TASKRSRC,PR=T.PROJECT;
  if(!TA||!TA.cs.length)return res;
  if(T.FINDATES||T.TRSRCFIN||T.TASKFIN){res.avisos.push('el archivo ya traia periodos financieros: se conservan y no se anaden los de la Tabla 2');return res}
  var r2=function(x){return Math.round((Number(x)||0)*100)/100};
  var per=G.per,W=G.W||{};
  /* la etiqueta sale del MODO, no de que el periodo dure un dia: con el corte
     en viernes la ultima semana dura un solo dia y salia rotulada "D 18/09"
     dentro de una serie S31...S38 (X4 H2). Y el periodo recortado en el corte
     se marca, para que en P6 se vea cual es el parcial. */
  var modoP=(G&&G.modo==='dia')?'dia':'sem';
  var nom=function(p){var f=function(iso){return iso.slice(8,10)+'/'+iso.slice(5,7)};
    if(modoP==='dia')return 'D '+f(p.fin)+'/'+p.fin.slice(0,4);
    var s='';try{s='S'+_crSemNum(p.fin)+' '}catch(_e){s=''}
    var par='';try{if(_crASerial(p.fin)!==_crSemSerial(_crSemNum(p.fin)))par=' corte'}catch(_e2){par=''}
    return s+f(p.ini)+'-'+f(p.fin)+'/'+p.fin.slice(0,4)+par};
  var ftId=String((T.FINTMPL&&T.FINTMPL.filas[0]&&T.FINTMPL.filas[0].o.fintmpl_id)||'');
  var csF=['fin_dates_id','fin_dates_name','start_date','end_date'];if(ftId)csF.push('fintmpl_id');
  var filF=[];
  per.forEach(function(p,i){var v=[String(i+1),_crXerVal(nom(p),30),p.ini+' 00:00',p.fin+' 23:59'];if(ftId)v.push(ftId);filF.push('%R'+_XTAB+v.join(_XTAB))});
  var csR=['fin_dates_id','taskrsrc_id','task_id','proj_id','act_qty','act_cost'];
  var csT=['fin_dates_id','task_id','proj_id','act_work_qty','act_equip_qty','act_mat_cost','act_work_cost','act_equip_cost','act_expense_cost','bcwp','bcws','perfm_work_qty','sched_work_qty'];
  var filR=[],filT=[];
  var asigDe={};if(TR&&TR.cs.length)TR.filas.forEach(function(x){(asigDe[String(x.o.task_id)]=asigDe[String(x.o.task_id)]||[]).push(x)});
  TA.filas.forEach(function(fi){
    var o=fi.o,cod=_crTx(o.task_code);
    var A=Number(o.act_work_qty)||0;if(!(A>0.005))return;
    var ser=(W[cod]||[]).slice(),s=0;ser.forEach(function(v){s+=v});
    var q;
    if(s>1e-9)q=per.map(function(p,i){return (Number(ser[i])||0)/s*A});
    else{q=per.map(function(){return 0});
      /* SIN SERIE DE LA TABLA 2 (las HH reales que solo trae el .xer original y
         el aplicativo no mide, y las partidas compartidas con apartados en las
         que _crGanadas reparte distinto que _crXerMGana): antes TODO caia en el
         ULTIMO periodo, que con un corte a media semana es el parcial y
         deformaba la curva (X4 H7, X3 H4). Ahora va al periodo de su fecha
         real, y se cuenta para poder avisarlo. */
      var _f9=_crFec(o.act_end_date)||_crFec(o.act_start_date)||'',_j9=per.length-1;
      if(_f9)for(var _z9=0;_z9<per.length;_z9++){if(_f9<=per[_z9].fin){_j9=_z9;break}}
      q[_j9]=A;
      res.sinSerie=(res.sinSerie||0)+1;if(!res.sinSerieL)res.sinSerieL=[];
      if(res.sinSerieL.length<200)res.sinSerieL.push(cod+' ('+_crXer2(A)+' hh)')}
    var acc=0,last=-1;q=q.map(function(v,i){var x=r2(v);if(x>0)last=i;acc+=x;return x});
    if(last>=0)q[last]=r2(q[last]+(A-acc));else q[q.length-1]=r2(A);
    var lab=(asigDe[String(o.task_id)]||[]).filter(function(x){return (Number(x.o.act_reg_qty)||0)>0.005});
    var sumA=0;lab.forEach(function(x){sumA+=Number(x.o.act_reg_qty)||0});
    var costoP=per.map(function(){return 0});
    lab.forEach(function(x){
      var qa=Number(x.o.act_reg_qty)||0,ca=Number(x.o.act_reg_cost)||0,sh=(sumA>0)?(qa/sumA):(1/lab.length);
      var accQ=0,lastQ=-1;
      var qq=q.map(function(v,i){var y=r2(v*sh);if(y>0)lastQ=i;accQ+=y;return y});
      if(lastQ>=0)qq[lastQ]=r2(qq[lastQ]+(qa-accQ));
      var cc=qq.map(function(v){return r2((qa>0)?(v/qa*ca):0)}),accC=0;cc.forEach(function(v){accC+=v});
      if(lastQ>=0)cc[lastQ]=r2(cc[lastQ]+(ca-accC));
      qq.forEach(function(v,i){
        if(!(Math.abs(v)>0.005)&&!(Math.abs(cc[i])>0.005))return;
        filR.push('%R'+_XTAB+[String(i+1),String(x.o.taskrsrc_id),String(o.task_id),String(o.proj_id||x.o.proj_id||''),_crXer2(v),(Number(cc[i])||0).toFixed(4)].join(_XTAB));
        costoP[i]+=cc[i]});
      var jq=TR.col.act_this_per_qty,jc=TR.col.act_this_per_cost,ch=false;
      if(jq!=null&&x.v[jq]!=='0'){x.v[jq]='0';ch=true}
      if(jc!=null&&x.v[jc]!=='0'){x.v[jc]='0';ch=true}
      if(ch)lineas[x.i]='%R'+_XTAB+x.v.join(_XTAB);
      res.asig++});
    q.forEach(function(v,i){
      if(!(Math.abs(v)>0.005))return;
      filT.push('%R'+_XTAB+[String(i+1),String(o.task_id),String(o.proj_id||''),_crXer2(v),'0','0',(Number(costoP[i])||0).toFixed(4),'0','0','0','0','0','0'].join(_XTAB));
      res.hh+=v});
    res.tareas++});
  if(!filT.length)return res;
  var bloqueF=['%T'+_XTAB+'FINDATES','%F'+_XTAB+csF.join(_XTAB)].concat(filF);
  var bloqueR=['%T'+_XTAB+'TRSRCFIN','%F'+_XTAB+csR.join(_XTAB)].concat(filR);
  var bloqueT=['%T'+_XTAB+'TASKFIN','%F'+_XTAB+csT.join(_XTAB)].concat(filT);
  var pos1=(T.FINTMPL&&T.FINTMPL.ultima!=null)?T.FINTMPL.ultima:((T.CURRTYPE&&T.CURRTYPE.ultima!=null)?T.CURRTYPE.ultima:0);
  var pos2=(TR&&TR.cs.length&&TR.ultima!=null)?TR.ultima:TA.ultima;
  var ins=[{i:pos2+1,f:((TR&&TR.cs.length&&filR.length)?bloqueR:[]).concat(bloqueT)},{i:pos1+1,f:bloqueF}];
  ins.sort(function(a,b){return b.i-a.i});
  ins.forEach(function(z){Array.prototype.splice.apply(lineas,[z.i,0].concat(z.f))});
  /* PROJECT: el ultimo periodo cerrado (los indices de linea cambiaron: se relee) */
  try{var T2=_crXerTablas(lineas),P2=T2.PROJECT;
    if(P2&&P2.filas.length&&P2.col.last_fin_dates_id!=null)P2.filas.forEach(function(f){f.v[P2.col.last_fin_dates_id]=String(per.length);lineas[f.i]='%R'+_XTAB+f.v.join(_XTAB)})}catch(_e2){}
  res.n=per.length;res.desde=per[0].ini;res.hasta=per[per.length-1].fin;res.hh=r2(res.hh);res.modo=G.modo||'sem';
  return res}

function _crXerAlgo(o){for(var k in o){if(Object.prototype.hasOwnProperty.call(o,k))return true}return false}

/* las tardias y el flotante, segun la politica _XER_LATE */
function _crXerLate(pw,ri,hRi,rf,hRf,est,eIni,hEi,eFin,hEf){
  if(_XER_LATE==='nada')return;
  if(_XER_LATE==='vacio'){
    pw('late_start_date','');pw('late_end_date','');
    pw('rem_late_start_date','');pw('rem_late_end_date','');
    pw('total_float_hr_cnt','');pw('free_float_hr_cnt','');
    return}
  var li=(eIni!=null)?eIni:ri,lhi=(hEi!=null)?hEi:hRi;
  var lf=(eFin!=null)?eFin:rf,lhf=(hEf!=null)?hEf:hRf;
  pw('late_start_date',_crXerFec(li,lhi));
  pw('late_end_date',_crXerFec(lf,lhf));
  if(est==='Complete'){pw('rem_late_start_date','');pw('rem_late_end_date','')}
  else{pw('rem_late_start_date',_crXerFec(ri,hRi));pw('rem_late_end_date',_crXerFec(rf,hRf))}
  /* con tardias iguales a las tempranas el flotante del archivo viejo ya no
     vale: a cero, y P6 lo recalcula en el primer F9 */
  pw('total_float_hr_cnt','0');pw('free_float_hr_cnt','0')}
/* ============================================================================
   AGENTE F - Bloque 3/4 - _crXerCabecera y _crXerValida
   ============================================================================ */

var _XER_PROY_NOMBRE='REPOSICION DEL SISTEMA DE FLOCULANTES';

/* ----------------------------------------------------------------------------
   El Project ID con el que entra a P6: solo letras, numeros, punto, guion y
   guion bajo, y 20 caracteres como maximo (es lo que admite el campo en todas
   las versiones, de la 8 a la 23). El sufijo manda: si no cabe todo, lo que se
   recorta es el nombre del cronograma.
   ---------------------------------------------------------------------------- */
function _crXerNomProy(nom,suf){
  var s=String(suf||'').toUpperCase().replace(/[^A-Z0-9._-]+/g,'-').replace(/-+/g,'-');
  var b=String(nom||'').toUpperCase().replace(/[^A-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'');
  var libre=Math.max(3,20-s.length);
  var r=(b.slice(0,libre)+s).replace(/-+/g,'-').replace(/^-+|-+$/g,'');
  return r||'CRON'}
/* es un Project ID que P6 acepta tal cual? */
function _crXerNomOk(s){
  var x=String(s||'');
  return !!x&&x.length<=20&&!/[^A-Za-z0-9._-]/.test(x)}

/* ----------------------------------------------------------------------------
   _crXerCabecera(lineas,modelo)

   PROJECT (solo la fila del proyecto PRINCIPAL, el que tiene las actividades):
     last_recalc_date / sum_data_date / last_tasksum_date / last_schedule_date
        = la fecha de datos CON HORA
     checkout_flag = 'N'   (si el .xer salio con el proyecto en checkout, P6 lo
                            importa bloqueado)
     scd_end_date  = se limpia si esta vencido (un Must Finish By anterior al
                     nuevo fin mete holgura negativa en TODO el cronograma)
     plan_start_date = INTACTO (es el arranque planificado, no la fecha de
                       datos). Si alguna actividad arranca antes, se avisa:
                       P6 no deja empezar nada antes de esa fecha.
     proj_short_name = saneado, <=20 caracteres, y solo aqui.
   PROJWBS: el nodo raiz de ese proyecto repite el Project ID.
   ERMHDR: fecha de hoy y usuario; la version y la moneda NO se tocan (la
     version le dice a P6 que esquema esperar y la moneda tiene que seguir
     casando con PROJECT.base_currency_id y con CURRTYPE).

   Devuelve {nombre, projShort, dataDate, ...}: `nombre` es el nombre de
   archivo ya saneado, sin la extension.
   ---------------------------------------------------------------------------- */
function _crXerCabecera(lineas,modelo){
  var out={nombre:'',projShort:'',projShortAntes:'',dataDate:'',dataHora:'',
    proyectos:0,ermhdr:0,scdLimpia:'',cambios:[],avisos:[]};
  if(!modelo)throw new Error('_crXerCabecera: falta el modelo');
  var T=_crXerTablas(lineas),PR=T.PROJECT,TA=T.TASK,WB=T.PROJWBS;
  if(!PR||!PR.filas.length)throw new Error('el .xer no trae tabla PROJECT: P6 no puede importarlo');
  out.proyectos=PR.filas.length;

  /* --- cual es el proyecto principal: el que tiene mas actividades --- */
  var pjT='';
  if(TA&&TA.filas.length){
    var cuenta={},mx=0;
    TA.filas.forEach(function(f){var p=String(f.o.proj_id||'');cuenta[p]=(cuenta[p]||0)+1});
    for(var p1 in cuenta){if(cuenta[p1]>mx){mx=cuenta[p1];pjT=p1}}}
  if(!pjT)pjT=String(PR.filas[0].o.proj_id||'');
  if(PR.filas.length>1)out.avisos.push('el archivo trae '+PR.filas.length+' proyectos: solo se renombra el que tiene las actividades (proj_id '+pjT+')');

  var DD=_crXerDD(lineas,modelo);
  var val=_crXerFec(DD.iso,DD.hora);
  out.dataDate=DD.iso;out.dataHora=DD.hora;

  /* --- la ventana real de las actividades, para decidir scd_end_date --- */
  var minIni='',maxFin='';
  if(TA)TA.filas.forEach(function(f){
    var a=_crFec(f.o.act_start_date)||_crFec(f.o.target_start_date)||_crFec(f.o.early_start_date);
    var b=_crFec(f.o.act_end_date)||_crFec(f.o.reend_date)||_crFec(f.o.target_end_date)||_crFec(f.o.early_end_date);
    if(a&&(!minIni||a<minIni))minIni=a;
    if(b&&(!maxFin||b>maxFin))maxFin=b});

  /* --- nombre del proyecto --- */
  var base=String(modelo.cronId||'');
  try{if(typeof _wkNomCr==='function')base=_wkNomCr(modelo.cronId)||base}catch(_e){}
  var sem=Number(modelo.sem)||0;
  var nuevoId='';
  var actual=String(PR.filas[0].o.proj_short_name||'');
  if(sem>0)nuevoId=_crXerNomProy(base,'-SEMANA'+sem);
  else if(!_crXerNomOk(actual))nuevoId=_crXerNomProy(actual||base,'');
  out.projShortAntes=actual;

  var n=0;
  PR.filas.forEach(function(f){
    if(String(f.o.proj_id||'')!==pjT)return;
    var toca=false;
    var pon=function(campo,v){var j=PR.col[campo];if(j==null)return;
      var s=String(v==null?'':v);if(f.v[j]!==s){f.v[j]=s;toca=true}};
    ['last_recalc_date','sum_data_date','last_tasksum_date','last_schedule_date'].forEach(function(campo){pon(campo,val)});
    pon('checkout_flag','N');
    var scd=_crFec(f.o.scd_end_date);
    if(scd&&maxFin&&scd<maxFin){pon('scd_end_date','');out.scdLimpia=scd}
    var ps=_crFec(f.o.plan_start_date);
    if(ps&&minIni&&minIni<ps)out.avisos.push('hay actividades que arrancan el '+minIni+', antes del inicio planificado del proyecto ('+ps+'): P6 las empujara al programar');
    if(nuevoId){pon('proj_short_name',nuevoId);out.projShort=nuevoId;
      /* cada -SEMANAn entra a P6 como proyecto propio: si repite el guid del
         crudo original, en la base acaban N proyectos con el mismo
         identificador global y cualquier round-trip posterior (XML,
         reflections, baselines) los confunde (X5 P2-D) */
      if(PR.col.guid!=null)pon('guid',_crXerMGuid('PROJ|'+modelo.cronId+'|'+nuevoId))}
    else out.projShort=actual;
    if(toca){lineas[f.i]='%R\t'+f.v.join('\t');n++}});
  if(nuevoId&&nuevoId!==actual)out.cambios.push('Project ID: "'+actual+'" -> "'+nuevoId+'"');

  /* --- el nodo raiz del WBS repite el Project ID --- */
  if(WB&&WB.filas.length&&nuevoId){
    WB.filas.forEach(function(f){
      if(String(f.o.proj_id||'')!==pjT)return;
      if(String(f.o.proj_node_flag||'').trim()!=='Y')return;
      var toca=false;
      var pon=function(campo,v){var j=WB.col[campo];if(j==null)return;
        var s=String(v==null?'':v);if(f.v[j]!==s){f.v[j]=s;toca=true}};
      pon('wbs_short_name',nuevoId);
      if(sem>0)pon('wbs_name',_crXerVal(_XER_PROY_NOMBRE,100));
      if(toca)lineas[f.i]='%R\t'+f.v.join('\t')})}

  /* --- ERMHDR: fecha de hoy y usuario; version y moneda intactas --- */
  var quien='';
  try{quien=(typeof state!=='undefined'&&state&&state.user&&state.user.supervisor)||''}catch(_e2){quien=''}
  for(var i=0;i<lineas.length&&i<4;i++){
    if(String(lineas[i]).indexOf('ERMHDR')!==0)continue;
    var q=String(lineas[i]).split('\t');
    if(q.length>=3)q[2]=String(modelo.hoy||'').slice(0,10)||q[2];
    if(q.length>=6&&quien)q[5]=_crXerVal(quien,30);
    lineas[i]=q.join('\t');out.ermhdr=1;break}
  if(!out.ermhdr)out.avisos.push('el archivo no trae la cabecera ERMHDR: P6 lo rechazara');

  /* --- el nombre del archivo --- */
  var fn;
  if(sem>0)fn=nuevoId;
  else{
    var b2=String(base).toUpperCase().replace(/[^A-Za-z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
    fn=(b2||'CRON')+(String(modelo.modo)==='tal'?'_tal_cual_':'_reprogramacion_')+String(modelo.corte||modelo.hoy||'').replace(/-/g,'')}
  if(modelo.mm)fn=fn+'_MM';
  out.nombre=_crXerVal(fn,60).replace(/[^A-Za-z0-9._-]+/g,'_');
  return out}

/* ----------------------------------------------------------------------------
   Los totales del ARCHIVO, leidos del texto ya armado. P6 suma las unidades
   LABOR de las asignaciones; si una tarea no tiene ninguna, cuenta las de la
   propia tarea.
   ---------------------------------------------------------------------------- */
function _crXerTotales(lineas){
  var T=_crXerTablas(lineas),TA=T.TASK||{filas:[],col:{}},TR=T.TASKRSRC,RS=T.RSRC;
  var tipoDe={};if(RS)RS.filas.forEach(function(f){tipoDe[String(f.o.rsrc_id)]=String(f.o.rsrc_type||'RT_Labor')});
  var o={hhT:0,hhA:0,hhR:0,costoT:0,costoA:0,tareas:0,conAsig:0,asig:0,sinAsig:0,sinAsigL:[]};
  var con={};
  if(TR)TR.filas.forEach(function(x){
    var tp=String(x.o.rsrc_type||'')||tipoDe[String(x.o.rsrc_id)]||'RT_Labor';
    if(tp!=='RT_Labor')return;
    con[String(x.o.task_id)]=1;o.asig++;
    o.hhT+=Number(x.o.target_qty)||0;
    o.hhA+=(Number(x.o.act_reg_qty)||0)+(Number(x.o.act_ot_qty)||0);
    o.hhR+=Number(x.o.remain_qty)||0;
    o.costoT+=Number(x.o.target_cost)||0;
    o.costoA+=(Number(x.o.act_reg_cost)||0)+(Number(x.o.act_ot_cost)||0)});
  TA.filas.forEach(function(f){
    o.tareas++;
    if(con[String(f.o.task_id)]){o.conAsig++;return}
    o.hhT+=Number(f.o.target_work_qty)||0;
    o.hhA+=Number(f.o.act_work_qty)||0;
    o.hhR+=Number(f.o.remain_work_qty)||0;
    /* sin asignacion LABOR, P6 no ve horas de recurso y el COSTO no viaja:
       la tabla TASK del .xer no tiene ninguna columna de costo */
    if((Number(f.o.target_work_qty)||0)>0){o.sinAsig++;
      if(o.sinAsigL.length<400)o.sinAsigL.push(_crTx(f.o.task_code)+' ('+_crXer2(f.o.target_work_qty)+' hh)')}});
  var r=function(x){return Math.round(x*100)/100};
  o.hhT=r(o.hhT);o.hhA=r(o.hhA);o.hhR=r(o.hhR);o.costoT=r(o.costoT);o.costoA=r(o.costoA);
  return o}

/* ============================================================================
   _crXerValida(lineas)  -  validacion ESTRUCTURAL del archivo que sale.

   errores  = P6 rechaza el archivo o lo importa mal -> NO se descarga
   avisos   = P6 lo importa pero recalcula o hay algo que conviene saber

   Reglas (xer_rev_10.md, seccion E):
     E-1  ERMHDR como primera linea, >=5 campos (aviso si la version < 8)
     E-2  toda linea es %T/%F/%R/%E (o vacia al final)
     E-3  cada %T con su %F antes del primer %R; nombre no vacio ni repetido
     E-4  conteo de campos: cada %R tiene tantos valores como campos el %F
     E-5  la ultima linea con contenido es %E
     E-6  orden de tablas (aviso)
     E-7  los *_id de las tablas clave son enteros
     E-8  ids unicos por tabla; task_code unico dentro de cada proj_id
     E-9  fechas vacias o 'YYYY-MM-DD HH:MM' validas
     E-10 numeros sin exponente, sin coma y sin separador de miles
     E-11 los *_flag valen Y, N o vacio
     E-12 enumerados conocidos
     E-13 guid de 22 caracteres con el ultimo en [AQgw] (aviso)
     E-14 TASK.wbs_id en PROJWBS, TASK.clndr_id en CALENDAR, TASK.proj_id en PROJECT
     E-15 TASKPRED contra TASK: sin huerfanas, sin autorrelacion, sin parejas
          repetidas del mismo tipo
     E-16 TASKRSRC contra TASK y RSRC; proj_id igual al de su TASK
     E-17 PROJWBS: padres existentes, un solo raiz por proyecto, sin ciclos
     E-19 coherencia status_code <-> fechas reales, remanentes y restart/reend
     E-20 hitos con duracion 0
     E-21 phys_complete_pct > 0 con complete_pct_type distinto de CP_Phys (aviso)
     E-22 HH > 0 con duracion 0 (aviso: P6 borra las unidades)
     E-23 suma de TASKRSRC LABOR distinta de TASK.target_work_qty (aviso)
     E-25 fecha de datos incoherente con las fechas reales / el remanente (aviso)
     E-26 longitudes de texto (aviso)
     E-27 el aplanado a Windows-1252 no puede cambiar el numero de campos
   ============================================================================ */
function _crXerValida(lineas,modelo){
  var err=[],avi=[];
  var E=function(m){if(err.length<300)err.push(m)};
  var A=function(m){if(avi.length<300)avi.push(m)};
  var L=lineas||[];
  var T={},orden=[],cur=null,cs=null,fin=-1,i,j;

  /* ---- E-1 ---- */
  if(!/^ERMHDR\t/.test(String(L[0]||'')))E('la primera linea no es la cabecera ERMHDR');
  else{
    var h=String(L[0]).split('\t');
    if(h.length<5)E('la cabecera ERMHDR trae '+h.length+' campos (minimo 5)');
    var ver=parseFloat(h[1]);
    if(isFinite(ver)&&ver<8)A('el archivo declara P6 '+h[1]+': P6 abrira el dialogo de conversion al importar');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(h[2]||'')))A('la fecha del ERMHDR no tiene forma YYYY-MM-DD: "'+String(h[2]||'')+'"')}

  /* ---- E-2 a E-5 y E-27 ---- */
  for(i=1;i<L.length;i++){
    var ln=String(L[i]==null?'':L[i]);
    if(ln===''){
      var resto='';for(j=i;j<L.length;j++)resto+=String(L[j]||'');
      if(resto!=='')E('linea '+(i+1)+' en blanco en medio del archivo');
      continue}
    if(ln==='%E'){if(fin<0)fin=i;else E('hay mas de una linea %E (linea '+(i+1)+')');continue}
    if(fin>=0){E('linea '+(i+1)+' despues del %E final: "'+ln.slice(0,50)+'"');continue}
    var p=ln.split('\t'),m=p[0];
    /* E-27: el aplanado no puede partir ni juntar campos */
    try{if(_crPlano(ln).split('\t').length!==p.length)
      E('linea '+(i+1)+' ('+(cur||'?')+'): al pasarla a Windows-1252 cambia el numero de campos')}catch(_e){}
    if(m==='%T'){
      cur=String(p[1]||'').trim();
      if(!cur)E('linea '+(i+1)+': %T sin nombre de tabla');
      else if(T[cur])E('la tabla '+cur+' aparece dos veces (linea '+(i+1)+')');
      else{T[cur]={cs:null,col:{},filas:[],ln:i};orden.push(cur)}
      cs=null;continue}
    if(m==='%F'){
      if(!cur){E('linea '+(i+1)+': %F sin su %T');continue}
      if(!T[cur])T[cur]={cs:null,col:{},filas:[],ln:i};
      cs=p.slice(1);
      for(j=0;j<cs.length;j++)cs[j]=String(cs[j]).trim();
      T[cur].cs=cs;T[cur].col={};
      for(j=0;j<cs.length;j++)T[cur].col[cs[j]]=j;
      continue}
    if(m==='%R'){
      if(!cur||!cs){E('linea '+(i+1)+': %R sin su %T/%F');continue}
      var v=p.slice(1);
      if(v.length!==cs.length){
        var cod9=(T[cur].col.task_code!=null&&v[T[cur].col.task_code]!=null)?(' ('+v[T[cur].col.task_code]+')'):'';
        E(cur+' linea '+(i+1)+': '+v.length+' campos, el %F declara '+cs.length+cod9);
        continue}
      var o={};for(j=0;j<cs.length;j++)o[cs[j]]=v[j];
      T[cur].filas.push({i:i,o:o,v:v});
      continue}
    E('linea '+(i+1)+' suelta (no es %T/%F/%R/%E): "'+ln.slice(0,50)+'" - casi seguro un salto de linea dentro de un nombre')}
  if(fin<0)E('falta la linea final %E');

  /* ---- E-3: %T sin %F ---- */
  for(var tb in T)if(T[tb]&&!T[tb].cs)E('la tabla '+tb+' no declara sus campos (%F)');

  /* ---- E-6: orden de tablas ---- */
  var pos=function(t){return orden.indexOf(t)};
  if(pos('TASK')>=0){
    if(pos('PROJWBS')>=0&&pos('PROJWBS')>pos('TASK'))A('PROJWBS va despues de TASK: P6 prefiere el orden CALENDAR/PROJECT/PROJWBS/TASK');
    if(pos('CALENDAR')>=0&&pos('CALENDAR')>pos('TASK'))A('CALENDAR va despues de TASK');
    if(pos('TASKPRED')>=0&&pos('TASKPRED')<pos('TASK'))E('TASKPRED va antes que TASK: P6 no puede resolver las referencias');
    if(pos('TASKRSRC')>=0&&pos('TASKRSRC')<pos('TASK'))E('TASKRSRC va antes que TASK')}

  var t_=function(n){return T[n]||{cs:[],col:{},filas:[]}};
  var PRO=t_('PROJECT'),WBS=t_('PROJWBS'),CAL=t_('CALENDAR'),RSR=t_('RSRC'),
      TAS=t_('TASK'),TPR=t_('TASKPRED'),TRS=t_('TASKRSRC');

  /* ---- E-7 y E-8: ids enteros y unicos ---- */
  var claves=[['PROJECT',PRO,'proj_id'],['PROJWBS',WBS,'wbs_id'],['CALENDAR',CAL,'clndr_id'],
    ['RSRC',RSR,'rsrc_id'],['TASK',TAS,'task_id'],['TASKPRED',TPR,'task_pred_id'],['TASKRSRC',TRS,'taskrsrc_id']];
  var setDe={};
  claves.forEach(function(q){
    var nom=q[0],tab=q[1],campo=q[2],vis={},rep=0,noEnt=0;
    if(!tab.filas.length)return;
    if(tab.col[campo]==null){E('la tabla '+nom+' no trae la columna '+campo);return}
    tab.filas.forEach(function(f){
      var x=String(f.o[campo]||'');
      if(!/^\d+$/.test(x)){if(noEnt<3)E(nom+' linea '+(f.i+1)+': '+campo+' "'+x+'" no es un entero');noEnt++;return}
      if(vis[x]){if(rep<3)E(nom+': '+campo+' '+x+' repetido (linea '+(f.i+1)+')');rep++}
      vis[x]=1});
    setDe[nom]=vis});
  /* task_code unico por proyecto */
  (function(){
    var vis={},rep=0;
    TAS.filas.forEach(function(f){
      var k=String(f.o.proj_id||'')+'|'+_crTx(f.o.task_code);
      if(vis[k]){if(rep<5)E('TASK: el codigo '+_crTx(f.o.task_code)+' esta repetido en el proyecto '+String(f.o.proj_id||'')+' (linea '+(f.i+1)+')');rep++}
      vis[k]=1})})();

  /* ---- E-9 a E-13: tipos por campo ---- */
  /* los enumerados se comprueban POR TABLA: status_code vale TK_* en TASK y
     WS_* en PROJWBS, y mezclarlos daba falsos avisos */
  var ENUMT={
    'TASK|status_code':['TK_NotStart','TK_Active','TK_Complete'],
    'TASK|task_type':['TT_Task','TT_Rsrc','TT_LOE','TT_Mile','TT_FinMile','TT_WBS'],
    'TASK|duration_type':['DT_FixedDrtn','DT_FixedDUR2','DT_FixedQty','DT_FixedRate'],
    'TASK|complete_pct_type':['CP_Drtn','CP_Phys','CP_Units'],
    'PROJECT|def_complete_pct_type':['CP_Drtn','CP_Phys','CP_Units'],
    'PROJECT|def_duration_type':['DT_FixedDrtn','DT_FixedDUR2','DT_FixedQty','DT_FixedRate'],
    'PROJECT|def_task_type':['TT_Task','TT_Rsrc','TT_LOE','TT_Mile','TT_FinMile','TT_WBS'],
    'PROJWBS|status_code':['WS_Open','WS_Inactive','WS_Planned','WS_Requested','WS_Template','WS_What-If'],
    'TASKPRED|pred_type':['PR_FS','PR_SS','PR_FF','PR_SF'],
    'RSRC|rsrc_type':['RT_Labor','RT_Mat','RT_Equip'],
    'TASKRSRC|rsrc_type':['RT_Labor','RT_Mat','RT_Equip'],
    'CALENDAR|clndr_type':['CA_Base','CA_Rsrc','CA_Project']};
  var reFecha=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,reNum=/^-?\d+(\.\d+)?$/;
  var nFec=0,nNum=0,nFlag=0,nEnum=0,nGuid=0;
  ['PROJECT','PROJWBS','CALENDAR','RSRC','TASK','TASKPRED','TASKRSRC'].forEach(function(nom){
    var tab=T[nom];if(!tab||!tab.cs)return;
    tab.filas.forEach(function(f){
      for(var c=0;c<tab.cs.length;c++){
        var campo=tab.cs[c],x=String(f.v[c]==null?'':f.v[c]);
        if(x==='')continue;
        if(/_date$/.test(campo)){
          if(!reFecha.test(x)||!_crXerFechaOk(x)){nFec++;if(nFec<=6)E(nom+' linea '+(f.i+1)+': '+campo+' = "'+x+'" no es una fecha YYYY-MM-DD HH:MM valida')}
          continue}
        if(/(_qty|_cost|_cnt|_pct|_per_hr|_num|_rate|_factor)$/.test(campo)&&campo!=='name_sep_char'){
          if(!reNum.test(x)){nNum++;if(nNum<=6)E(nom+' linea '+(f.i+1)+': '+campo+' = "'+x+'" no es un numero (sin exponente, sin coma y sin separador de miles)')}
          continue}
        if(/_flag$/.test(campo)){
          if(x!=='Y'&&x!=='N'){nFlag++;if(nFlag<=6)E(nom+' linea '+(f.i+1)+': '+campo+' = "'+x+'" (solo Y, N o vacio)')}
          continue}
        var lis=ENUMT[nom+'|'+campo];
        if(lis){if(lis.indexOf(x)<0){nEnum++;if(nEnum<=6)A(nom+' linea '+(f.i+1)+': '+campo+' = "'+x+'" no es un valor conocido')}continue}
        if(campo==='cstr_type'||campo==='cstr_type2'){
          if(x.indexOf('CS_')!==0){nEnum++;if(nEnum<=6)A(nom+' linea '+(f.i+1)+': '+campo+' = "'+x+'" no empieza por CS_')}
          continue}
        if(campo==='guid'||campo==='tmpl_guid'){
          if(!/^[A-Za-z0-9+/]{22}$/.test(x)||'AQgw'.indexOf(x.charAt(21))<0){nGuid++;if(nGuid<=3)A(nom+' linea '+(f.i+1)+': guid "'+x+'" no tiene la forma de los de P6')}
          continue}}})});

  /* ---- E-14: referencias de TASK ---- */
  (function(){
    var wbs=setDe.PROJWBS||{},cal=setDe.CALENDAR||{},pro=setDe.PROJECT||{};
    var a=0,b=0,c2=0;
    TAS.filas.forEach(function(f){
      var w=String(f.o.wbs_id||'');
      if(WBS.filas.length&&(!w||!wbs[w])){a++;if(a<=5)E('TASK '+_crTx(f.o.task_code)+' (linea '+(f.i+1)+'): wbs_id "'+w+'" no existe en PROJWBS')}
      var k=String(f.o.clndr_id||'');
      if(CAL.filas.length&&(!k||!cal[k])){b++;if(b<=5)E('TASK '+_crTx(f.o.task_code)+': clndr_id "'+k+'" no existe en CALENDAR')}
      var p2=String(f.o.proj_id||'');
      if(PRO.filas.length&&(!p2||!pro[p2])){c2++;if(c2<=5)E('TASK '+_crTx(f.o.task_code)+': proj_id "'+p2+'" no existe en PROJECT')}})})();

  /* ---- E-15: TASKPRED ---- */
  (function(){
    var tid=setDe.TASK||{},pj={},vis={},a=0,b=0,c2=0;
    TAS.filas.forEach(function(f){pj[String(f.o.task_id)]=String(f.o.proj_id||'')});
    TPR.filas.forEach(function(f){
      var ti=String(f.o.task_id||''),pi=String(f.o.pred_task_id||'');
      if(!tid[ti]){a++;if(a<=5)E('TASKPRED linea '+(f.i+1)+': task_id '+ti+' no existe en TASK');return}
      if(!tid[pi]){a++;if(a<=5)E('TASKPRED linea '+(f.i+1)+': pred_task_id '+pi+' no existe en TASK');return}
      if(ti===pi){b++;if(b<=5)E('TASKPRED linea '+(f.i+1)+': la actividad es su propia predecesora');return}
      var k=ti+'|'+pi+'|'+String(f.o.pred_type||'');
      if(vis[k]){c2++;if(c2<=5)E('TASKPRED linea '+(f.i+1)+': relacion repetida '+ti+' <- '+pi+' ('+String(f.o.pred_type||'')+')')}
      vis[k]=1;
      if(pj[ti]&&String(f.o.proj_id||'')!==pj[ti])A('TASKPRED linea '+(f.i+1)+': proj_id no es el de su actividad sucesora');
      if(pj[pi]&&String(f.o.pred_proj_id||'')!==pj[pi])A('TASKPRED linea '+(f.i+1)+': pred_proj_id no es el de su actividad predecesora')})})();

  /* ---- E-16: TASKRSRC ---- */
  (function(){
    var tid=setDe.TASK||{},rid=setDe.RSRC||{},pj={},a=0,b=0;
    TAS.filas.forEach(function(f){pj[String(f.o.task_id)]=String(f.o.proj_id||'')});
    TRS.filas.forEach(function(f){
      var ti=String(f.o.task_id||'');
      if(!tid[ti]){a++;if(a<=5)E('TASKRSRC linea '+(f.i+1)+': task_id '+ti+' no existe en TASK');return}
      var ri=String(f.o.rsrc_id||'');
      if(ri&&RSR.filas.length&&!rid[ri]){b++;if(b<=5)E('TASKRSRC linea '+(f.i+1)+': rsrc_id '+ri+' no existe en RSRC')}
      if(!ri&&!String(f.o.role_id||''))A('TASKRSRC linea '+(f.i+1)+': asignacion sin recurso ni rol');
      if(pj[ti]&&String(f.o.proj_id||'')!==pj[ti])A('TASKRSRC linea '+(f.i+1)+': proj_id no es el de su actividad')})})();

  /* ---- E-17: PROJWBS ---- */
  (function(){
    var wid=setDe.PROJWBS||{},padre={},raiz={},a=0;
    WBS.filas.forEach(function(f){
      var w=String(f.o.wbs_id||''),pa=String(f.o.parent_wbs_id||'');
      padre[w]=pa;
      if(String(f.o.proj_node_flag||'').trim()==='Y'){var p2=String(f.o.proj_id||'');raiz[p2]=(raiz[p2]||0)+1;return}
      if(!pa||!wid[pa]){a++;if(a<=5)E('PROJWBS linea '+(f.i+1)+': parent_wbs_id "'+pa+'" no existe')}});
    for(var p3 in raiz)if(raiz[p3]!==1)E('el proyecto '+p3+' tiene '+raiz[p3]+' nodos raiz de WBS (tiene que haber exactamente uno)');
    var ciclo=0;
    for(var w2 in padre){
      var k=0,x=w2;
      while(padre[x]&&k<40){x=padre[x];k++}
      if(k>=40){ciclo++;if(ciclo<=3)E('PROJWBS: el nodo '+w2+' esta en un ciclo de padres')}}})();

  /* ---- E-19 a E-26 ---- */
  (function(){
    var asig={},labor={},tipoDe={};
    RSR.filas.forEach(function(f){tipoDe[String(f.o.rsrc_id)]=String(f.o.rsrc_type||'RT_Labor')});
    TRS.filas.forEach(function(x){
      var ti=String(x.o.task_id||'');
      (asig[ti]=asig[ti]||[]).push(x);
      var tp=String(x.o.rsrc_type||'')||tipoDe[String(x.o.rsrc_id)]||'RT_Labor';
      if(tp==='RT_Labor')labor[ti]=(labor[ti]||0)+(Number(x.o.target_qty)||0)});
    var dd='';
    if(PRO.filas.length)dd=String(PRO.filas[0].o.last_recalc_date||'');
    var nE19=0,nE20=0,nE22=0,nE23=0,nE25=0,nE26=0;
    TAS.filas.forEach(function(f){
      var cod=_crTx(f.o.task_code),st=String(f.o.status_code||''),ti=String(f.o.task_id||'');
      var ai=_crFec(f.o.act_start_date),af=_crFec(f.o.act_end_date);
      var rs=_crFec(f.o.restart_date),re=_crFec(f.o.reend_date);
      var rd=Number(f.o.remain_drtn_hr_cnt)||0,rw=Number(f.o.remain_work_qty)||0;
      var tw=Number(f.o.target_work_qty)||0,aw=Number(f.o.act_work_qty)||0;
      var td=Number(f.o.target_drtn_hr_cnt)||0,pc=Number(f.o.phys_complete_pct)||0;
      var tt=String(f.o.task_type||'TT_Task');
      /* E-19 */
      if(st==='TK_Complete'){
        if(!ai){nE19++;if(nE19<=8)E(cod+': terminada sin fecha real de inicio')}
        if(!af){nE19++;if(nE19<=8)E(cod+': terminada sin fecha real de fin')}
        if(rs||re){nE19++;if(nE19<=8)E(cod+': terminada y con fechas de remanente (restart/reend)')}
        if(rd>0.005||rw>0.005){nE19++;if(nE19<=8)E(cod+': terminada y con remanente ('+_crXer2(rd)+' h de duracion, '+_crXer2(rw)+' HH)')}}
      else if(st==='TK_Active'){
        if(!ai){nE19++;if(nE19<=8)E(cod+': en curso sin fecha real de inicio (P6 no lo admite)')}
        if(af){nE19++;if(nE19<=8)E(cod+': en curso y con fecha real de fin')}}
      else if(st==='TK_NotStart'){
        if(ai||af){nE19++;if(nE19<=8)E(cod+': sin empezar y con fechas reales')}
        if(aw>0.005){nE19++;if(nE19<=8)E(cod+': sin empezar y con '+_crXer2(aw)+' HH reales')}}
      else if(st){nE19++;if(nE19<=8)E(cod+': status_code "'+st+'" desconocido')}
      if(ai&&af&&af<ai){nE19++;if(nE19<=8)E(cod+': la fecha real de fin ('+af+') es anterior a la de inicio ('+ai+')')}
      if(rs&&re&&re<rs){nE19++;if(nE19<=8)E(cod+': reend ('+re+') es anterior a restart ('+rs+')')}
      /* E-20 */
      if(tt==='TT_Mile'||tt==='TT_FinMile'){
        if(td>0.005||rd>0.005){nE20++;if(nE20<=8)E(cod+': es un hito y lleva duracion ('+_crXer2(td)+' h)')}
        if(asig[ti]&&asig[ti].length)A(cod+': es un hito y tiene asignacion de recurso');
        if(_crFec(f.o.target_start_date)&&_crFec(f.o.target_end_date)&&_crFec(f.o.target_start_date)!==_crFec(f.o.target_end_date))
          A(cod+': es un hito y sus dos fechas planificadas no coinciden')}
      /* E-21 */
      if(pc>0&&String(f.o.complete_pct_type||'')!=='CP_Phys')A(cod+': lleva % fisico con complete_pct_type "'+String(f.o.complete_pct_type||'')+'"');
      /* E-22 */
      if(tw>0.005&&!(td>0)&&tt!=='TT_Mile'&&tt!=='TT_FinMile'&&tt!=='TT_LOE'&&tt!=='TT_WBS'){
        nE22++;if(nE22<=8)A(cod+': '+_crXer2(tw)+' HH con duracion 0 (P6 le borra las unidades al importar)')}
      /* E-23 */
      if(labor[ti]!=null&&Math.abs(labor[ti]-tw)>Math.max(0.05,tw*1e-4)){
        nE23++;if(nE23<=8)A(cod+': TASK '+_crXer2(tw)+' HH pero sus asignaciones LABOR suman '+_crXer2(labor[ti])+' (P6 se queda con las asignaciones)')}
      /* E-25 */
      if(dd){
        var d10=dd.slice(0,10);
        if(af&&af>d10){nE25++;if(nE25<=6)A(cod+': terminada el '+af+', despues de la fecha de datos ('+d10+')')}
        if(rs&&rs<d10){nE25++;if(nE25<=6)A(cod+': el remanente arranca el '+rs+', antes de la fecha de datos ('+d10+')')}}
      /* E-26 */
      if(cod.length>40){nE26++;if(nE26<=5)A('el codigo "'+cod+'" pasa de 40 caracteres')}
      if(_crTx(f.o.task_name).length>200){nE26++;if(nE26<=5)A(cod+': el nombre pasa de 200 caracteres')}});
    PRO.filas.forEach(function(f){
      var s=String(f.o.proj_short_name||'');
      if(s.length>20)A('el Project ID "'+s+'" pasa de 20 caracteres: P6 lo trunca');
      if(/[^A-Za-z0-9._-]/.test(s))A('el Project ID "'+s+'" trae caracteres que P6 no admite')});
    WBS.filas.forEach(function(f){
      if(_crTx(f.o.wbs_short_name).length>40)A('PROJWBS: el codigo "'+_crTx(f.o.wbs_short_name)+'" pasa de 40 caracteres')})})();

  /* ---- E-29 a E-34: lo que P6 recalcula o fusiona en silencio (X5) ----
     Gravedad: se avisa (A) de todo lo que puede venir del .xer ORIGINAL -guid
     repetidos, periodos de la empresa que van mas alla de la fecha de datos,
     sumas de periodos ajenos- porque bloquear la descarga por eso es lo
     contrario de lo que se pide; se marca como ERROR (E) solo lo que escribe
     el propio aplicativo y deja el archivo incoherente. */
  (function(){
    /* E-29: guid repetido dentro de una tabla. Si el %F del archivo no trae la
       columna guid, los pon('guid',...) de _crXerEscribe fallan en silencio y
       las filas nuevas heredan el guid de la plantilla. */
    ['PROJWBS','RSRC','TASK','TASKRSRC'].forEach(function(nom){
      var tab=T[nom];if(!tab||!tab.cs||tab.col.guid==null)return;
      var g={},rep9=0,L9=[];
      tab.filas.forEach(function(f){var x=String(f.o.guid||'');if(!x)return;
        if(g[x]){rep9++;if(L9.length<5)L9.push((nom==='TASK')?_crTx(f.o.task_code):String(f.o.guid))}g[x]=1});
      if(rep9)A(nom+': '+rep9+' fila(s) con guid repetido ('+L9.join(', ')+'): P6 las fusiona al importar')});
    var asg={};TRS.filas.forEach(function(x){(asg[String(x.o.task_id)]=asg[String(x.o.task_id)]||[]).push(x)});
    var n30=0,n31=0,n32=0,n33=0;
    TAS.filas.forEach(function(f){
      var cod=_crTx(f.o.task_code),st=String(f.o.status_code||'');
      var td=Number(f.o.target_drtn_hr_cnt)||0,rd=Number(f.o.remain_drtn_hr_cnt)||0;
      var pc=Number(f.o.phys_complete_pct)||0,tt=String(f.o.task_type||'TT_Task');
      /* E-30 */
      if(st==='TK_Complete'&&Math.abs(pc-100)>0.01){n30++;if(n30<=5)A(cod+': terminada con '+_crXer2(pc)+' % fisico (P6 la pone al 100)')}
      /* E-33 */
      if(st==='TK_NotStart'&&tt!=='TT_LOE'&&tt!=='TT_WBS'&&Math.abs(td-rd)>0.05){
        n33++;if(n33<=5)A(cod+': sin empezar con duracion original '+_crXer2(td)+' h y remanente '+_crXer2(rd)+' h (P6 las iguala al importar)')}
      (asg[String(f.o.task_id)]||[]).forEach(function(x){
        var q=Number(x.o.target_qty)||0,rq=Number(x.o.remain_qty)||0,aq=Number(x.o.act_reg_qty)||0;
        var uh=Number(x.o.target_qty_per_hr)||0,ruh=Number(x.o.remain_qty_per_hr)||0;
        /* E-31 */
        if(aq>0.005&&!_crFec(x.o.act_start_date)){n31++;if(n31<=5)E(cod+': asignacion con '+_crXer2(aq)+' HH reales y sin fecha real de inicio')}
        if(st==='TK_NotStart'&&aq>0.005){n31++;if(n31<=5)E(cod+': sin empezar y con HH reales en su asignacion')}
        /* E-32 */
        if(td>0&&q>0.05&&Math.abs(uh*td-q)>Math.max(0.5,q*0.005)){n32++;if(n32<=5)A(cod+': unidades/tiempo '+uh.toFixed(6)+' x '+_crXer2(td)+' h = '+_crXer2(uh*td)+' y las unidades son '+_crXer2(q)+' (con DT_FixedDrtn P6 recalcula)')}
        if(rd>0&&rq>0.05&&Math.abs(ruh*rd-rq)>Math.max(0.5,rq*0.005)){n32++;if(n32<=5)A(cod+': remanente unidades/tiempo descuadrado')}})});
    /* E-34: los periodos financieros */
    var FD=t_('FINDATES'),TF=t_('TASKFIN'),RF=t_('TRSRCFIN');
    if(!FD.filas.length){if(TF.filas.length||RF.filas.length)E('hay TASKFIN/TRSRCFIN sin tabla FINDATES');return}
    var per9=FD.filas.map(function(f){return {id:String(f.o.fin_dates_id),a:String(f.o.start_date||''),b:String(f.o.end_date||''),n:String(f.o.fin_dates_name||'')}})
      .sort(function(x,y){return (x.a<y.a)?-1:(x.a>y.a)?1:0});
    for(var z=1;z<per9.length;z++)if(per9[z].a<=per9[z-1].b){A('los periodos financieros '+per9[z-1].n+' y '+per9[z].n+' se solapan');break}
    var ddP=PRO.filas.length?String(PRO.filas[0].o.last_recalc_date||''):'';
    if(ddP&&per9.length&&per9[per9.length-1].b.slice(0,10)>ddP.slice(0,10))
      A('el ultimo periodo financiero termina el '+per9[per9.length-1].b.slice(0,10)+', despues de la fecha de datos ('+ddP.slice(0,10)+')');
    var fd={};FD.filas.forEach(function(f){fd[String(f.o.fin_dates_id)]=1});
    var sT={},sR={},n34=0;
    TF.filas.forEach(function(f){if(!fd[String(f.o.fin_dates_id)])E('TASKFIN linea '+(f.i+1)+': fin_dates_id '+f.o.fin_dates_id+' no existe en FINDATES');
      sT[String(f.o.task_id)]=(sT[String(f.o.task_id)]||0)+(Number(f.o.act_work_qty)||0)});
    RF.filas.forEach(function(f){if(!fd[String(f.o.fin_dates_id)])E('TRSRCFIN linea '+(f.i+1)+': fin_dates_id '+f.o.fin_dates_id+' no existe en FINDATES');
      sR[String(f.o.taskrsrc_id)]=(sR[String(f.o.taskrsrc_id)]||0)+(Number(f.o.act_qty)||0)});
    TAS.filas.forEach(function(f){var aw=Number(f.o.act_work_qty)||0,q=sT[String(f.o.task_id)];
      if(q!=null&&Math.abs(q-aw)>0.02){n34++;if(n34<=5)A(_crTx(f.o.task_code)+': los periodos financieros suman '+_crXer2(q)+' HH y act_work_qty es '+_crXer2(aw))}});
    TRS.filas.forEach(function(x){var aq=Number(x.o.act_reg_qty)||0,q=sR[String(x.o.taskrsrc_id)];
      if(q!=null&&Math.abs(q-aq)>0.02){n34++;if(n34<=5)A('taskrsrc '+x.o.taskrsrc_id+': los periodos suman '+_crXer2(q)+' y act_reg_qty es '+_crXer2(aq))}})})();

  /* ---- E-28: NINGUNA restriccion en lo que gestiona el aplicativo ----
     Pedido del usuario: el .xer no puede salir con restricciones. Si el modelo
     viene, se miran solo sus actividades; sin modelo, todas las de TASK. */
  (function(){
    if(!TAS.filas.length)return;
    var ges=(modelo&&modelo.tareas)?modelo.tareas:null;
    var n=0,LS=[];
    var nA=0,LA=[];
    TAS.filas.forEach(function(f){
      var cod=_crTx(f.o.task_code);
      var a=String(f.o.cstr_type||'').trim(),b=String(f.o.cstr_type2||'').trim();
      if(!a&&!b)return;
      if(ges&&!(ges[cod]||ges[String(cod).toUpperCase()])){
        nA++;if(LA.length<30)LA.push(cod+' '+(a||b).replace(/^CS_/,''));return}
      n++;if(LS.length<30)LS.push(cod+' '+(a||b).replace(/^CS_/,''))});
    if(n)E(n+' actividad(es) del aplicativo salen con restriccion: '+LS.join(', ')+
      ' · el .xer tiene que salir sin restricciones (cstr_type y cstr_type2 vacios)');
    if(nA)E(nA+' actividad(es) que el aplicativo no gestiona salen con restriccion: '+LA.join(', ')+
      ' · al F9 empujan igual a sus sucesoras y el .xer tiene que salir sin ninguna')})();

  return {ok:err.length===0,errores:err,avisos:avi,tablas:orden,
    n:{tareas:TAS.filas.length,rel:TPR.filas.length,asig:TRS.filas.length,wbs:WBS.filas.length,proyectos:PRO.filas.length}}}

/* una fecha 'YYYY-MM-DD HH:MM' con mes, dia y hora posibles */
function _crXerFechaOk(x){
  var m=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(x||''));
  if(!m)return false;
  var Y=Number(m[1]),M=Number(m[2]),D=Number(m[3]),h=Number(m[4]),mi=Number(m[5]);
  if(M<1||M>12||D<1||D>31||h>23||mi>59)return false;
  if(Y<1900||Y>2200)return false;
  var d=new Date(Date.UTC(Y,M-1,D));
  return d.getUTCFullYear()===Y&&(d.getUTCMonth()+1)===M&&d.getUTCDate()===D}
/* ============================================================================
   AGENTE F - Bloque 4/4 - el orquestador _crXerArma y la interfaz
   ============================================================================ */

/* ----------------------------------------------------------------------------
   _crXerArma(c,opt)

   opt = { modo:'tal'|'rep', mm:false|true, corte:'YYYY-MM-DD' (por defecto hoy),
           sem:numero|0, alcLive:objeto|null, aviso:function(texto) }

   Las OCHO etapas del contrato, en ese orden y sin ningun catch mudo: si algo
   falla, se lanza y el usuario lo ve.
     1 refresco duro del servidor           (_crXerRefresco, agente M)
     2 modelo del aplicativo                (_crXerModelo,   agente M)
     3 el .xer original, del servidor
     4 cantidades, estados, altas y bajas   (_crXerEscribe,  agente M)
     5 calendario, fechas y TASKPRED        (_crXerFechas)
     6 cabecera, fecha de datos y nombre    (_crXerCabecera)
     7 validacion estructural               (_crXerValida)
     8 auditoria campo a campo              (_crXerAuditoria, agente M)

   Devuelve {txt (CRLF), nombre, modelo, val, aud, ...}
   ---------------------------------------------------------------------------- */
async function _crXerArma(c,opt){
  opt=opt||{};
  if(!c||!c.cron_id)throw new Error('_crXerArma: falta el cronograma');
  var modo=(opt.modo==='tal')?'tal':'rep';
  var mm=!!opt.mm;
  var hoy=(typeof todayISO==='function')?todayISO():'';
  var corte=String(opt.corte||hoy).slice(0,10)||hoy;
  var sem=Number(opt.sem)||0;
  var di=(typeof opt.aviso==='function')?opt.aviso:function(){};
  if(typeof _crXerRefresco!=='function')throw new Error('falta _crXerRefresco (etapa 1): el motor del .xer esta incompleto');
  if(typeof _crXerModelo!=='function')throw new Error('falta _crXerModelo (etapa 2): el motor del .xer esta incompleto');
  if(typeof _crXerEscribe!=='function')throw new Error('falta _crXerEscribe (etapa 4): el motor del .xer esta incompleto');
  if(typeof _crXerAuditoria!=='function')throw new Error('falta _crXerAuditoria (etapa 8): el motor del .xer esta incompleto');

  /* --- 1. refresco duro: nada sale de cache --- */
  di('1/8 Subiendo lo pendiente y releyendo TODO del servidor…');
  var ref=await _crXerRefresco(c);
  if(ref&&ref.c)c=ref.c;

  /* --- 2. el .xer original, leido del servidor ---
     La etapa 3 del contrato (leer el crudo) se ADELANTA a la 2 porque
     _crXerModelo necesita las lineas del archivo para saber el tipo de cada
     actividad (hito / LOE), su calendario y contra que fechas se mide
     `movida`; asi ademas el modelo y el archivo son el mismo texto y no se
     lee dos veces. El orden de ESCRITURA, que es lo que fija el contrato, no
     cambia: 4 escribe cantidades, 5 fechas y predecesoras, 6 cabecera. */
  di('2/8 Leyendo el .xer original del servidor…');
  var fila=await sbSelect(T_CRO,'select=crudo&proyecto=eq.'+encodeURIComponent(DATA.proyecto)+'&cron_id=eq.'+encodeURIComponent(c.cron_id)+'&limit=1');
  var crudo=(fila&&fila[0]&&fila[0].crudo)||'';
  if(!crudo)throw new Error('ese cronograma no guardo su archivo original: vuelve a cargar el .xer');
  var lineas=crudo.split(/\r?\n/);

  /* --- 3. el modelo del aplicativo, con el calendario REAL del archivo --- */
  di('3/8 Armando el modelo del aplicativo (HH, costo, estados y fechas)…');
  _crXerCalReset();
  var T0=_crXerTablas(lineas);
  var Cp=_crXerCalendario(lineas,(T0.PROJECT&&T0.PROJECT.filas.length)?T0.PROJECT.filas[0].o.clndr_id:'');
  var modelo=await _crXerModelo(c,{modo:modo,mm:mm,corte:corte,sem:sem,hoy:hoy,
    alcLive:opt.alcLive||null,lineas:lineas,
    hpd:Cp.hpd,horaIni:Cp.abre,horaFin:Cp.cierra});
  if(!modelo||!modelo.tareas)throw new Error('_crXerModelo no devolvio un modelo con tareas');
  modelo.cron=modelo.cron||c;
  modelo.cronId=modelo.cronId||c.cron_id;
  modelo.modo=modo;modelo.mm=mm;modelo.corte=corte;modelo.sem=sem;
  modelo.rem=(opt.rem==='tabla')?'tabla':'hh';   /* de donde sale el remanente */
  modelo.hoy=modelo.hoy||hoy;
  /* el calendario del archivo manda sobre lo que el modelo dedujo por su cuenta */
  modelo.hpd=Cp.hpd;modelo.horaIni=Cp.abre;modelo.horaFin=Cp.cierra;

  /* las restricciones que traia el ARCHIVO ORIGINAL: hay que contarlas aqui,
     porque _crXerEscribe ya las vacia y despues _crXerFechas no ve ninguna */
  var _cstr0=(function(){
    var TT=_crXerTablas(lineas),TX=TT.TASK,n=0,L=[];
    if(TX&&TX.cs.length)TX.filas.forEach(function(f){
      var a=String(f.o.cstr_type||'').trim(),b=String(f.o.cstr_type2||'').trim();
      var da=_crFec(f.o.cstr_date),db=_crFec(f.o.cstr_date2);
      if(!a&&!b&&!da&&!db)return;
      n++;if(L.length<400)L.push(_crTx(f.o.task_code)+
        (a?(' ('+a.replace(/^CS_/,'')+(da?(' '+da):'')+')'):'')+
        (b?(' + '+b.replace(/^CS_/,'')+(db?(' '+db):'')):''))});
    return {n:n,L:L}})();

  /* --- 4. cantidades, estados, reales, remanentes, altas y bajas --- */
  di('4/8 Escribiendo HH, costo, estados, actividades y WBS…');
  /* lo ganado por actividad y por semana (Tabla 2) hasta el corte, para los periodos financieros */
  var G=null;if(modo==='rep'){try{G=await _crXerGanadoSem(c,corte,opt.per,modelo)}catch(_eg){G=null;try{console.warn('periodos .xer:',_eg)}catch(_e9){}}}
  var esc9=await _crXerEscribe(lineas,modelo);

  /* --- 5. calendario real, fechas y predecesoras --- */
  di('5/8 Calendario real, fechas, duraciones y predecesoras…');
  var fe=_crXerFechas(lineas,modelo);
  /* --- 5b. periodos financieros: el real de cada semana, como la Tabla 2 --- */
  var per={n:0};try{per=_crXerPeriodos(lineas,modelo,G)}catch(_ep){per={n:0,error:String((_ep&&_ep.message)||_ep)};fe.avisos.push('no se pudieron escribir los periodos financieros: '+per.error)}
  if(per.avisos&&per.avisos.length)fe.avisos=(fe.avisos||[]).concat(per.avisos);
  fe.cstrLib=_cstr0.n;fe.cstrLibL=_cstr0.L;

  /* --- 6. cabecera del proyecto y del archivo --- */
  di('6/8 Fecha de datos, nombre del proyecto y cabecera…');
  var cab=_crXerCabecera(lineas,modelo);

  /* --- 7. validacion estructural --- */
  di('7/8 Comprobando la estructura del archivo…');
  var val=_crXerValida(lineas,modelo);

  /* --- 8. auditoria campo a campo contra el modelo ---
     La auditoria compara PROJECT.last_recalc_date con modelo.corte, y la fecha
     de datos NO es el corte: es el primer dia habil SIGUIENTE (el avance llega
     hasta el corte inclusive, asi que el reloj del proyecto arranca despues).
     Se le pasa ese valor en modelo.corte y el corte del avance se queda en
     modelo.corteAvance, que es lo que se ensena en el mensaje. */
  modelo.corteAvance=corte;
  if(cab.dataDate)modelo.corte=cab.dataDate;
  di('8/8 Auditando el archivo contra la tabla del alcance…');
  var aud=await _crXerAuditoria(lineas,modelo);
  modelo.corte=corte;

  var tot=_crXerTotales(lineas);
  var r={txt:lineas.join('\r\n'),nombre:cab.nombre,modelo:modelo,val:val,aud:aud,
    esc:esc9,fe:fe,per:per,cab:cab,ref:ref,tot:tot,c:c,modo:modo,mm:mm,corte:corte,sem:sem};
  try{window._crXerUltimo=r}catch(_e){}
  return r}

/* ============================================================================
   LA INTERFAZ
   ============================================================================ */

function _crXerEsc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function _crXerHH(x){var n=Number(x);if(!isFinite(n))n=0;
  try{return _nMil(n.toFixed(2))}catch(_e){return n.toFixed(2)}}
function _crXerS(x){var n=Number(x);if(!isFinite(n))n=0;
  try{return _nMon(n)}catch(_e){return n.toFixed(2)}}
function _crXerDif(a,b){return Math.abs((Number(a)||0)-(Number(b)||0))}

/* las partidas de la tabla que NO llegan al archivo. El agente M las devuelve
   en aud.faltan (y en modelo.sinArchivo) como
   {id, nombre, apartado, hhT, hhA, costoT, motivo, cuenta}; `cuenta:false`
   marca las del contrato que ESTE cronograma no cuenta, que no descuadran el
   total. Se aceptan tambien otras formas por si el modelo cambia. */
function _crXerFaltantes(aud,modelo){
  var L=[],crudo=null,i;
  if(aud&&aud.faltan&&aud.faltan.length!=null)crudo=aud.faltan;
  else if(modelo&&modelo.sinArchivo&&modelo.sinArchivo.length!=null)crudo=modelo.sinArchivo;
  else if(aud&&(aud.faltantes||aud.sinLlegar||aud.partidasFuera))crudo=aud.faltantes||aud.sinLlegar||aud.partidasFuera;
  else if(aud&&aud.resumen&&typeof aud.resumen==='object'&&aud.resumen.faltantes)crudo=aud.resumen.faltantes;
  if(!crudo)return L;
  if(typeof crudo==='string')return [{txt:crudo,cuenta:true}];
  for(i=0;i<crudo.length;i++){
    var x=crudo[i];
    if(x==null)continue;
    if(typeof x==='string'){L.push({txt:x,cuenta:true});continue}
    L.push({id:x.id||x.item||x.cod||'',nombre:x.nombre||x.nom||'',
      apartado:x.apartado||'',
      hhT:(x.hhT!=null)?x.hhT:(x.hh!=null?x.hh:x.hhContrato),
      hhA:(x.hhA!=null)?x.hhA:0,
      costo:(x.costoT!=null)?x.costoT:((x.costo!=null)?x.costo:x.costoContrato),
      hhContrato:(x.hhContrato!=null)?x.hhContrato:((x.hhT!=null)?x.hhT:0),
      costoContrato:(x.costoContrato!=null)?x.costoContrato:((x.costoT!=null)?x.costoT:0),
      motivo:x.motivo||x.por||x.razon||'',
      cuenta:(x.cuenta===false)?false:true,txt:''})}
  return L}

/* el mensaje final, en HTML: lo que cuadra en claro y TODO lo que no cuadra en
   rojo, sin recortar nada. Lleva, como pidio el usuario:
   totales del archivo frente al TOTAL de la tabla (HH target, HH actual y
   costo), la fecha de datos, las relaciones (nuevas / cambiadas / quitadas),
   las actividades nuevas y borradas, y en rojo TODAS las diferencias y TODAS
   las partidas que no llegan al archivo con sus HH y su motivo. */
function _crXerMensaje(r,modo,mm){
  var T=(r.modelo&&r.modelo.totales)||{};
  var A=r.tot||{hhT:0,hhA:0,hhR:0,costoT:0,costoA:0};
  var val=r.val||{ok:true,errores:[],avisos:[]};
  var aud=r.aud||{};
  var fe=r.fe||{},esc9=r.esc||{};
  var H=[];
  var rojo='#FFB4A8',verde='#9FE8B0',ambar='#E8C9A0',claro='#cfe3ff';
  var lin=function(col,txt){H.push('<div style="color:'+col+';margin:2px 0;line-height:1.5">'+txt+'</div>')};
  var lista=function(col,arr){
    if(!arr||!arr.length)return;
    var o=[];
    for(var i=0;i<arr.length;i++)o.push('<li>'+arr[i]+'</li>');
    H.push('<ul style="color:'+col+';margin:2px 0 6px 16px;padding:0;line-height:1.5">'+o.join('')+'</ul>')};

  var falt=_crXerFaltantes(aud,r.modelo);
  var pierden=[],fueraCron=[],sH=0,sA=0,sC=0;
  for(var i=0;i<falt.length;i++){
    if(falt[i].cuenta===false){fueraCron.push(falt[i]);continue}
    pierden.push(falt[i]);
    sH+=Number(falt[i].hhT)||0;sA+=Number(falt[i].hhA)||0;sC+=Number(falt[i].costo)||0}

  var difHH=_crXerDif(A.hhT,T.hhT),difA=_crXerDif(A.hhA,T.hhA),difC=_crXerDif(A.costoT,T.costoT);
  var cuadra=(aud.ok!==false)&&difHH<=0.05&&difA<=0.05&&difC<=0.05;

  lin(val.ok?(cuadra?verde:rojo):rojo,
    (val.ok?(cuadra?'✔ ':'⚠ '):'✖ ')+'<b>'+_crXerEsc(r.nombre)+'.xer</b> · '+
    (modo==='tal'?'tal cual esta':'para reprogramacion')+
    (mm?' · <b>CON MAYOR METRADO</b>':' · normal')+
    (val.ok?'':' · NO SE DESCARGO')+' · <span style="opacity:.6">'+_crXerEsc(typeof APP_VER!=='undefined'?APP_VER:'')+'</span>');

  /* --- de donde sale el remanente y el tipo de duracion --- */
  var remT=String((r.modelo&&r.modelo.rem)||'hh');
  if(remT==='tabla'){
    lin(claro,'Remanente: <b>por las duraciones de la tabla</b> (Rendimiento APP): '+(fe.remTabla||0)+' actividades con la duraci\u00f3n restante de la tabla'+
      ((fe.remSinTabla||0)?(' \u00b7 <span style="color:'+ambar+'">'+fe.remSinTabla+' sin rendimiento en la tabla o sin alcance: por la regla de HH</span>'):'')+
      '. En las iniciadas el inicio real se completa para que original = real + remanente.');
    lista(ambar,(fe.remSinTablaL||[]).slice(0,60))}
  else lin(claro,'Remanente: <b>por HH y rendimiento de la actividad</b> (hoja 2: resta entre el rendimiento propio, o HH entre d\u00edas).');
  lin(claro,'Tipo de duraci\u00f3n: <b>Fixed Duration and Units/Time</b> en todas las tareas; unidades = duraci\u00f3n \u00d7 unidades/tiempo, con las HH reales y remanentes del aplicativo.');
  /* --- totales del archivo frente al TOTAL de la tabla --- */
  lin(difHH<=0.05?claro:rojo,'HH target: archivo <b>'+_crXerHH(A.hhT)+'</b> hh · TOTAL de la tabla <b>'+_crXerHH(T.hhT)+'</b> hh'+
    ((difHH>0.05)?(' · <b>faltan '+_crXerHH((Number(T.hhT)||0)-A.hhT)+' hh</b>'):' · sin diferencia'));
  lin(difA<=0.05?claro:rojo,'HH actual: archivo <b>'+_crXerHH(A.hhA)+'</b> hh · TOTAL de la tabla <b>'+_crXerHH(T.hhA)+'</b> hh'+
    ((difA>0.05)?(' · <b>faltan '+_crXerHH((Number(T.hhA)||0)-A.hhA)+' hh</b>'):' · sin diferencia'));
  lin(claro,'HH remanente del archivo: <b>'+_crXerHH(A.hhR)+'</b> hh'+
    ((T.hhR!=null)?(' · tabla <b>'+_crXerHH(T.hhR)+'</b> hh'):''));
  lin(difC<=0.05?claro:rojo,'Costo: archivo <b>'+_crXerS(A.costoT)+'</b> · TOTAL de la tabla <b>'+_crXerS(T.costoT)+'</b>'+
    ((difC>0.05)?(' · <b>faltan '+_crXerS((Number(T.costoT)||0)-A.costoT)+'</b>'):' · sin diferencia')+
    ' · costo real archivo '+_crXerS(A.costoA)+' / tabla '+_crXerS(T.costoA));

  /* --- fecha de datos y calendario --- */
  /* ================== EL CUADRE QUE PIDIO EL USUARIO ====================
     % al corte segun la Tabla 2 y su diferencia con el archivo, las unidades
     tal como las suma P6, la identidad Remaining = Budgeted - Actual, las
     actividades por estado y el cuadre de los periodos con la fecha de datos. */
  (function(){
    var t29=(r.per&&r.per.t2!=null)?Number(r.per.t2):null;
    var hU9=(r.per&&r.per.hhUniv!=null)?Number(r.per.hhUniv):null;
    if(t29!=null){
      var dT9=Math.abs(t29-(Number(A.hhA)||0));
      var base9=(hU9>0)?hU9:(Number(T.hhT)||0);
      var pT9=(base9>0)?(t29/base9*100):0;
      var pA9=((Number(A.hhT)||0)>0)?((Number(A.hhA)||0)/Number(A.hhT)*100):0;
      lin((dT9<=0.05||mm)?claro:rojo,
        'Tabla 2 al corte <b>'+_crXerEsc(r.corte||'')+'</b>: <b>'+_crXerHH(t29)+'</b> hh ganadas (<b>'+
        _crXerHH(pT9)+' %</b>) \u00b7 el archivo lleva <b>'+_crXerHH(A.hhA)+'</b> hh (<b>'+_crXerHH(pA9)+
        ' %</b>) \u00b7 '+((dT9<=0.05)?'<b>diferencia 0.00</b>':('<b>diferencia '+_crXerHH((Number(A.hhA)||0)-t29)+' hh</b>'))+
        (mm?(' \u00b7 <b>con mayor metrado el archivo pasa de la Tabla 2 a proposito</b>: el sobremetrado ganado no esta en ella'):'')+
        (((r.per.t2Tar!=null)&&Math.abs(Number(r.per.t2Tar)-t29)>0.05)?
          (' \u00b7 de esas, '+_crXerHH(t29-Number(r.per.t2Tar))+' hh son de partidas que no llegan a ninguna actividad (ver abajo)'):''))}
    var TT9=null;try{TT9=_crXerTablas(String(r.txt||'').split(/\r?\n/))}catch(_et9){TT9=null}
    if(TT9){
      var TX9=TT9.TASK,FN9=TT9.FINDATES,TF9=TT9.TASKFIN;
      var nC9=0,nA9=0,nN9=0,nH9=0;
      if(TX9&&TX9.cs.length)TX9.filas.forEach(function(f){
        var st9=String(f.o.status_code||'');
        if(st9==='TK_Complete')nC9++;else if(st9==='TK_Active')nA9++;else nN9++;
        if((Number(f.o.target_work_qty)||0)>0.005)nH9++});
      var id9=Math.abs((Number(A.hhT)||0)-(Number(A.hhA)||0)-(Number(A.hhR)||0));
      lin((id9<=0.05)?claro:rojo,'Unidades como las suma P6 (asignaciones LABOR; sin asignacion, la propia actividad): '+
        'Budgeted <b>'+_crXerHH(A.hhT)+'</b> \u00b7 Actual <b>'+_crXerHH(A.hhA)+'</b> \u00b7 Remaining <b>'+_crXerHH(A.hhR)+'</b> hh \u00b7 '+
        ((id9<=0.05)?('Budgeted \u2212 Actual = Remaining'):('<b>OJO: Budgeted \u2212 Actual \u2260 Remaining</b>')));
      lin(claro,'Actividades por estado: <b>'+nC9+'</b> terminadas \u00b7 <b>'+nA9+'</b> en curso \u00b7 <b>'+nN9+'</b> sin empezar \u00b7 '+nH9+' con HH');
      if(FN9&&FN9.cs.length&&TF9&&TF9.cs.length){
        var sF9=0;TF9.filas.forEach(function(f){sF9+=Number(f.o.act_work_qty)||0});
        var ul9='';FN9.filas.forEach(function(f){var b9=String(f.o.end_date||'').slice(0,10);if(b9>ul9)ul9=b9});
        var dF9=Math.abs(sF9-(Number(A.hhA)||0));
        lin((dF9<=0.05)?claro:rojo,'Periodos financieros: suman <b>'+_crXerHH(sF9)+'</b> hh reales \u00b7 el archivo lleva <b>'+
          _crXerHH(A.hhA)+'</b> hh \u00b7 diferencia <b>'+_crXerHH(dF9)+'</b> \u00b7 el ultimo llega al <b>'+_crXerEsc(ul9)+'</b>'+
          ((ul9===String(fe.dataDate||'').slice(0,10))?' (= la fecha de datos)':(' <b>(\u2260 la fecha de datos)</b>')))}}
    if(String((r.modelo&&r.modelo.rem)||'')==='tabla')
      lin(ambar,'Con el remanente <b>por la tabla</b> el acumulado de P6 en la fecha de datos sale de las DURACIONES (total \u2212 restante, en dias, antes del corte) y no de las HH: puede no coincidir con lo real. Con el remanente por HH coincide al centimo.');
    if(r.per&&r.per.sinSerie)
      lin(ambar,'<b>'+r.per.sinSerie+'</b> actividad(es) con HH reales y <b>sin serie en la Tabla 2</b> (tipicamente las que solo trae el .xer original): su real se carga entero en el periodo de su fecha real. '+
        _crXerEsc((r.per.sinSerieL||[]).slice(0,40).join(' \u00b7 ')));
    if(r.per&&r.per.modo==='sem'&&r.corte&&r.sem)
      lin(claro,'El archivo se rotula <b>SEMANA'+r.sem+'</b> (la ultima semana CERRADA, como el informe) y el avance llega al <b>'+
        _crXerEsc(r.corte)+'</b>: si el corte cae a media semana, el ultimo periodo financiero es parcial y la Tabla 2 en pantalla puede ensenar de mas en su ultima columna, porque no la recorta en el corte.')})();

  lin(claro,'Fecha de datos: <b>'+_crXerEsc(fe.dataDate||'')+' '+_crXerEsc(fe.dataHora||'')+'</b>'+
    ' · avance hasta el corte <b>'+_crXerEsc(r.corte||'')+'</b>'+
    (fe.calendario?(' · calendario <b>'+_crXerEsc(fe.calendario)+'</b>'):'')+
    ((r.cab&&r.cab.projShort)?(' · entra a P6 como <b>'+_crXerEsc(r.cab.projShort)+'</b>'):''));
  if(fe.corrido){var cr9=fe.corrido;
    lin(claro,'Red corrida a la fecha de datos, como el F9 de P6 ('+_crXerEsc(cr9.logica||'')+'): <b>'+(cr9.n||0)+'</b> actividades programadas, <b>'+(cr9.movidas||0)+'</b> movidas por sus predecesoras'+(cr9.fin?(' · fin del proyecto <b>'+_crXerEsc(String(cr9.fin).slice(0,10))+'</b>'):'')+(cr9.ciclos?(' · <b>'+cr9.ciclos+' en bucle</b>'):''));
    if(cr9.movidas&&cr9.detalle&&cr9.detalle.length)lin(claro,'<span style="opacity:.85;font-size:11px">'+_crXerEsc(cr9.detalle.slice(0,80).join(' · '))+(cr9.detalle.length>80?' ...':'')+'</span>')}
  if(r.per&&r.per.n)lin(claro,'Periodos financieros: <b>'+r.per.n+'</b> '+(r.per.modo==='dia'?'días (uno por día natural)':'semanas')+' ('+_crXerEsc(r.per.desde)+' → '+_crXerEsc(r.per.hasta)+') con las HH reales de cada '+(r.per.modo==='dia'?'día, según las fechas de los partes':'semana, las de la Tabla 2')+': <b>'+_nMil2(r.per.hh)+' hh</b> en '+r.per.tareas+' actividades. En P6: Ver → Escala de tiempo → intervalo <b>Periodo financiero</b>, y la columna <b>Actual Units</b> (acumulada) da semana a semana lo de la Tabla 2. Con la escala por semanas o días P6 reparte el real en línea recta entre el inicio real y la fecha de datos y NO coincide con la Tabla 2: eso no se puede cambiar desde el archivo');

  /* --- relaciones --- */
  lin(claro,'Relaciones: <b>'+(fe.rel_new||0)+'</b> nuevas · <b>'+(fe.rel_act||0)+'</b> cambiadas · <b>'+(fe.rel_del||0)+'</b> quitadas'+
    ((fe.rel_dup||0)?(' · '+fe.rel_dup+' repetidas quitadas'):'')+
    ((fe.rel_huerf||0)?(' · '+fe.rel_huerf+' huerfanas quitadas'):'')+
    ((fe.rel_ajenas||0)?(' · '+fe.rel_ajenas+' del .xer que el aplicativo no conoce (se dejan como estan)'):''));

  /* --- actividades --- */
  lin(claro,'Actividades: <b>'+(esc9.nuevas||0)+'</b> nuevas · <b>'+(esc9.borradas||0)+'</b> borradas · '+
    ((val.n&&val.n.tareas)||0)+' en el archivo'+
    ((esc9.escritas||0)?(' · '+esc9.escritas+' con HH del aplicativo'):'')+
    ((esc9.vaciadas||0)?(' · '+esc9.vaciadas+' vaciadas (sin HH del aplicativo)'):'')+
    ((esc9.renombradas||0)?(' · '+esc9.renombradas+' renombradas'):'')+
    ((esc9.movidas||0)?(' · '+esc9.movidas+' cambiadas de WBS'):'')+
    ((esc9.asigNuevas||0)?(' · '+esc9.asigNuevas+' asignaciones de recurso creadas'):'')+
    ((esc9.wbsNuevas||0)?(' · '+esc9.wbsNuevas+' nodos de WBS creados'):'')+
    ((esc9.rsrcNuevos||0)?(' · '+esc9.rsrcNuevos+' recursos creados'):''));
  lin(claro,'Fechas: <b>'+(fe.fechas||0)+'</b> filas reescritas, <b>'+(fe.movidas||0)+'</b> con la fecha o la duracion cambiada'+
    ((fe.hitos||0)?(' · '+fe.hitos+' hitos (duracion 0)'):'')+
    ((fe.informativas||0)?(' · '+fe.informativas+' informativas con lo del archivo'+((fe.remCorrido||0)?(', '+fe.remCorrido+' con el remanente corrido a la fecha de datos'):'')):'')+
    ((fe.loe||0)?(' · '+fe.loe+' de nivel de esfuerzo o resumen sin tocar'):'')+
    ((fe.asigFechas||0)?(' · '+fe.asigFechas+' asignaciones sincronizadas con su actividad'):''));

  /* --- el rendimiento con el que sale el remanente --- */
  if((fe.conRend||0)){
    lin(ambar,'⚙ <b>'+fe.conRend+'</b> actividad(es) con <b>rendimiento propio</b>: su duracion remanente sale de las HH que restan entre ese rendimiento, no del % de avance');
    lista(ambar,(fe.rendL||[]).map(function(x){return _crXerEsc(x)}))}

  /* --- LA REGLA DEL REMANENTE: sin alcance y por % --- */
  var sAl=(aud&&aud.sinAlcance)||[],sPc=(aud&&aud.porPct)||[];
  if(sAl.length){
    lin(ambar,'⚠ <b>'+sAl.length+'</b> actividad(es) <b>sin alcance en este cronograma</b>: salen con remanente <b>0</b> (sus partidas no cuentan aqui)');
    var lA=[];
    for(i=0;i<sAl.length;i++){
      var a9=sAl[i];
      lA.push('<b>'+_crXerEsc(a9.cod)+'</b> '+_crXerEsc(a9.nombre)+' — '+_crXerHH(a9.dias)+' d de duracion, remanente <b>'+
        _crXerHH(a9.remH)+' h</b>'+
        (a9.partidas&&a9.partidas.length?(' · <i>sus partidas: '+_crXerEsc(a9.partidas.join(', '))+'</i>'):' · <i>'+_crXerEsc(a9.motivo)+'</i>'))}
    lista(ambar,lA)}
  if(sPc.length){
    lin(claro,'<b>'+sPc.length+'</b> actividad(es) <b>sin HH</b>: su remanente sale del <b>% de avance</b> (dias × (1 − %))');
    var lP=[];
    for(i=0;i<sPc.length;i++){
      var p9=sPc[i];
      lP.push('<b>'+_crXerEsc(p9.cod)+'</b> '+_crXerEsc(p9.nombre)+' — '+_crXerHH(p9.pct)+' % de '+
        _crXerHH(p9.dias)+' d: resta <b>'+_crXerHH(p9.rd)+' d</b> ('+_crXerHH(p9.remH)+' h)'+
        (p9.partidas&&p9.partidas.length?(' · partidas: '+_crXerEsc(p9.partidas.join(', '))):' · sin partidas (informativa)'))}
    lista(claro,lP)}

  /* --- EN ROJO: las partidas de la tabla que no llegan al archivo --- */
  if(pierden.length){
    lin(rojo,'⛔ <b>'+pierden.length+' partida(s) del TOTAL de la tabla NO llegan al archivo</b> ('+
      _crXerHH(sH)+' hh target, '+_crXerHH(sA)+' hh actual, '+_crXerS(sC)+' de costo):');
    var l1=[];
    for(i=0;i<pierden.length;i++){
      var x=pierden[i];
      if(x.txt&&!x.id){l1.push(_crXerEsc(x.txt));continue}
      l1.push('<b>'+_crXerEsc(x.id)+'</b>'+(x.apartado?(' ['+_crXerEsc(x.apartado)+']'):'')+' '+_crXerEsc(x.nombre)+
        ' — '+_crXerHH(x.hhT)+' hh target, '+_crXerHH(x.hhA)+' hh actual, '+_crXerS(x.costo)+
        (x.motivo?(' · <i>'+_crXerEsc(x.motivo)+'</i>'):''))}
    lista(rojo,l1)}
  else lin(verde,'✔ Ninguna partida del TOTAL de la tabla se queda fuera del archivo.');

  if(fueraCron.length){
    var l2=[],fH=0,fC=0;
    for(i=0;i<fueraCron.length;i++){
      var y=fueraCron[i];
      var yH=(y.hhContrato!=null)?y.hhContrato:y.hhT,yC=(y.costoContrato!=null)?y.costoContrato:y.costo;
      fH+=Number(yH)||0;fC+=Number(yC)||0;
      l2.push('<b>'+_crXerEsc(y.id)+'</b> '+_crXerEsc(y.nombre)+' — '+_crXerHH(yH)+' hh de contrato, '+
        _crXerS(yC)+(y.motivo?(' · <i>'+_crXerEsc(y.motivo)+'</i>'):''))}
    H.push('<div style="margin-top:4px;color:'+ambar+';font-weight:800">'+
      fueraCron.length+' partida(s) del contrato que este cronograma no cuenta ('+_crXerHH(fH)+' hh de contrato, '+
      _crXerS(fC)+'; no descuadran el total)</div>');
    lista(ambar,l2)}

  /* --- EN ROJO: todas las diferencias de la auditoria --- */
  var difs=(aud&&aud.difs)||[];
  if(difs.length){
    lin(rojo,'⛔ <b>'+difs.length+' diferencia(s) entre el archivo y el aplicativo</b>:');
    var l3=[];
    for(i=0;i<difs.length;i++){
      var d=difs[i];
      l3.push('<b>'+_crXerEsc(d.cod||'')+'</b> '+_crXerEsc(d.campo||'')+
        ': archivo <b>'+_crXerEsc(d.archivo)+'</b> ≠ aplicativo <b>'+_crXerEsc(d.aplicativo)+'</b>'+
        (d.txt?(' · '+_crXerEsc(d.txt)):''))}
    lista(rojo,l3)}
  else if(aud&&aud.ok===true)lin(verde,'✔ La auditoria campo a campo no encontro ninguna diferencia'+
    ((aud.revisadas!=null)?(' ('+aud.sinDiferencias+' de '+aud.revisadas+' actividades revisadas)'):'')+'.');

  /* --- lo que no se pudo escribir --- */
  if((fe.rel_sin||[]).length){
    lin(rojo,'⛔ <b>'+fe.rel_sin.length+' relacion(es) no se pudieron escribir</b> (falta la actividad en el .xer):');
    lista(rojo,fe.rel_sin.map(function(x){return _crXerEsc(x)}))}
  if((fe.sinFecha||[]).length)
    lin(rojo,'⛔ '+fe.sinFecha.length+' actividad(es) sin fecha planificada: se quedan con la del archivo · '+_crXerEsc(fe.sinFecha.join(', ')));
  if((fe.dupCod||[]).length)
    lin(rojo,'⛔ codigos de actividad repetidos en el .xer: '+_crXerEsc(fe.dupCod.join(', ')));
  if((A.sinAsig||0)){
    lin(rojo,'⛔ <b>'+A.sinAsig+' actividad(es) con HH y SIN asignacion de recurso LABOR</b>: P6 no vera sus horas como unidades de recurso y su costo no viaja (la tabla TASK del .xer no tiene columna de costo):');
    lista(rojo,(A.sinAsigL||[]).map(function(x){return _crXerEsc(x)}))}
  if((esc9.sinCampo||0))
    lin(rojo,'⛔ '+esc9.sinCampo+' dato(s) no se pudieron escribir porque el %F del archivo no trae ese campo: revisa de donde salio este .xer');
  if((esc9.sinModelo||[]).length)
    lin(ambar,'⚠ '+esc9.sinModelo.length+' actividad(es) del .xer que el aplicativo no gestiona (se dejan como estan): '+
      _crXerEsc(esc9.sinModelo.slice(0,20).join(', '))+(esc9.sinModelo.length>20?'…':''));
  else if(fe.sinModelo)
    lin(ambar,'⚠ '+fe.sinModelo+' actividad(es) del .xer que el aplicativo no gestiona: se dejan como estan');

  /* --- restricciones: el archivo sale SIN ninguna --- */
  if((fe.cstrLib||0)){
    lin(ambar,'Restricciones: se limpiaron <b>'+(fe.cstrLib||0)+'</b> (el .xer sale sin ninguna restriccion; si no, el primer F9 de P6 deshace el corrido)');
    lista(ambar,(fe.cstrLibL||[]).map(function(x){return _crXerEsc(x)}))}
  else lin(claro,'Restricciones: el archivo sale <b>sin ninguna</b> en las actividades del aplicativo.');
  /* sin restricciones, en P6 lo unico que sostiene una fecha es la logica */
  (function(){
    var TT=_crXerTablas(r.txt.split(/\r?\n/)),TX=TT.TASK,TQ=TT.TASKPRED;
    if(!TX||!TX.cs.length)return;
    var np={};if(TQ&&TQ.cs.length)TQ.filas.forEach(function(f){np[String(f.o.task_id)]=1});
    var dd=String(fe.dataDate||'').slice(0,10),L=[];
    TX.filas.forEach(function(f){
      if(np[String(f.o.task_id)])return;
      if(String(f.o.status_code||'')==='TK_Complete')return;
      var rs=String(f.o.restart_date||'').slice(0,10);
      if(!dd||!rs||rs<=dd)return;
      if(L.length<40)L.push(_crTx(f.o.task_code)+' '+_crTx(f.o.task_name)+' — arranca el '+rs+', sin ninguna predecesora')});
    if(!L.length)return;
    lin(ambar,'⚠ <b>'+L.length+' actividad(es) sin predecesoras arrancan despues de la fecha de datos ('+_crXerEsc(dd)+')</b>: como el .xer sale sin restricciones, al primer F9 P6 las va a traer a la fecha de datos. Si esa fecha tiene que sostenerse, ponle una predecesora en el aplicativo antes de exportar');
    lista(ambar,L.map(function(x){return _crXerEsc(x)}))})();

  /* --- validacion estructural --- */
  if(!val.ok){
    lin(rojo,'✖ <b>NO SE DESCARGA</b>: el archivo tiene '+val.errores.length+' cosa(s) que P6 rechaza:');
    lista(rojo,val.errores.map(function(x){return _crXerEsc(x)}));
    lin(rojo,'Arreglalo y vuelve a exportar. Copia este detalle y mandalo si no sabes de donde sale.')}
  if((val.avisos||[]).length)
    H.push('<details style="margin-top:4px"><summary style="color:'+ambar+';cursor:pointer;font-weight:800">'+
      val.avisos.length+' aviso(s) de estructura (P6 lo importa, pero recalcula)</summary>'+
      '<ul style="color:'+ambar+';margin:2px 0 6px 16px;padding:0;line-height:1.5"><li>'+
      val.avisos.map(function(x){return _crXerEsc(x)}).join('</li><li>')+'</li></ul></details>');

  /* --- avisos sueltos --- */
  var av=(fe.avisos||[]).concat((r.cab&&r.cab.avisos)||[]).concat((esc9.avisos||[]));
  for(i=0;i<av.length;i++)lin(ambar,'⚠ '+_crXerEsc(av[i]));
  var cam=(r.cab&&r.cab.cambios)||[];
  for(i=0;i<cam.length;i++)lin(claro,_crXerEsc(cam[i]));
  if(r.cab&&r.cab.scdLimpia)lin(ambar,'⚠ se limpio el "Must Finish By" vencido del proyecto ('+_crXerEsc(r.cab.scdLimpia)+'): metia holgura negativa en todo el cronograma');
  if(r.ref&&r.ref.pend)lin(ambar,'⚠ quedan '+r.ref.pend+' cambio(s) sin subir a la base: el archivo los lleva, pero nadie mas los ve todavia');

  /* --- el informe completo de la auditoria, tal cual lo arma el agente M --- */
  if(aud&&typeof aud.resumen==='string'&&aud.resumen)
    H.push('<details style="margin-top:6px"><summary style="color:'+(aud.ok===false?rojo:claro)+';cursor:pointer;font-weight:800">'+
      'Informe completo de la auditoria</summary>'+
      '<div style="color:'+claro+';white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:10.5px;line-height:1.45;margin-top:4px">'+
      _crXerEsc(aud.resumen)+'</div></details>');

  return H.join('')}

/* pinta el mensaje en el hueco de la pantalla de alcance */
function _crXerPinta(html){
  var e=document.getElementById('_crFeMsg');
  if(!e)return;
  e.style.cssText='flex:1 1 100%;min-width:120px;font-size:11px;color:#9db4d6;display:block;max-height:240px;overflow:auto;white-space:normal;background:#0d1117;border:1px solid #1d2c47;border-radius:8px;padding:8px';
  e.innerHTML=html}

/* ----------------------------------------------------------------------------
   La descarga. Solo baja el archivo si val.ok.
   ---------------------------------------------------------------------------- */
async function _crXerDescarga(c,modo,mm,o){
  o=o||{};
  var pinta=(typeof o.pinta==='function')?o.pinta:_crXerPinta;
  var aviso=(typeof o.aviso==='function')?o.aviso:function(t){pinta('<div style="color:#9db4d6">'+_crXerEsc(t)+'</div>')};
  var hoy=(typeof todayISO==='function')?todayISO():'';
  var corte=o.corte||hoy;
  var sem=(o.sem!=null)?Number(o.sem)||0:((modo==='rep')?_crXerSemReporte(corte):0);
  var r=await _crXerArma(c,{modo:modo,mm:mm,corte:corte,sem:sem,alcLive:o.alcLive||null,aviso:aviso,rem:(o.rem||_crXerRemPref()),per:(o.per||_crXerPerPref())});
  var html=_crXerMensaje(r,modo,mm);
  if(!r.val.ok){pinta(html);return r}
  var blob=new Blob([_crBytes(r.txt)],{type:'application/octet-stream'});
  var url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=r.nombre+'.xer';
  document.body.appendChild(a);a.click();
  setTimeout(function(){try{URL.revokeObjectURL(url);a.remove()}catch(_e){}},4000);
  try{if(typeof logCambio==='function')logCambio('cronograma',c.cron_id,'.xer exportado ('+modo+(mm?' mayor metrado':'')+'): '+r.nombre)}catch(_e){}
  pinta(html);
  return r}

/* la semana que se REPORTA es la ultima CERRADA (la del jueves de corte), la
   misma que usa el Excel semanal; la semana en curso solo tiene dias sin
   cerrar y el .xer saldria rotulado un numero por delante del informe */
/* `cerrada` (opcional, por defecto true) = la semana que se reporta es la
   ultima CERRADA, que es lo que hace hoy y lo que pide el brief. Con
   cerrada===false devuelve la semana que CONTIENE al corte, que es lo que
   rotularia un corte a media semana (X4 H1): el dialogo puede ofrecerlo. */
function _crXerSemReporte(iso,cerrada){
  try{
    var s=_crSemNum(iso),ser=_crASerial(iso);
    if(cerrada!==false&&ser!==''&&ser<_crSemSerial(s))s--;
    return (s>0)?s:0}catch(_e){return 0}}

/* ----------------------------------------------------------------------------
   El menu del boton. Cuatro opciones y el texto dice lo que lleva cada una.
   Sustituye al onclick de #_crFeXrel (index.html ~3832).
   Uso:  document.getElementById('_crFeXrel').onclick=function(){_crXerMenuUI(this,c,{pinta:..., alcLive:...})}
   ---------------------------------------------------------------------------- */
/* de donde sale el remanente del .xer: 'hh' (HH y rendimiento de la
   actividad, hoja 2) o 'tabla' (las duraciones de la tabla, Rendimiento APP);
   se recuerda en la configuracion del usuario (tabla_config, realtime) */
function _crXerRemPref(){try{return (_tbCfg().xerRem==='tabla')?'tabla':'hh'}catch(e){return 'hh'}}
function _crXerRemSet(v){try{var cfg=_tbCfg();cfg.xerRem=(v==='tabla')?'tabla':'hh';_tbCfgSave(cfg)}catch(e){}}
/* los periodos financieros del .xer: por semana (el corte del jueves, como la Tabla 2) o dia a dia (la corrida diaria segun las fechas reales de los partes) */
function _crXerPerPref(){try{return (_tbCfg().xerPer==='dia')?'dia':'sem'}catch(e){return 'sem'}}
function _crXerPerSet(v){try{var cfg=_tbCfg();cfg.xerPer=(v==='dia')?'dia':'sem';_tbCfgSave(cfg)}catch(e){}}
function _crXerMenuUI(b,c,o){
  o=o||{};
  var old=document.getElementById('_crXerMenu');if(old){old.remove();return}
  var menu=document.createElement('div');menu.id='_crXerMenu';
  menu.style.cssText='position:fixed;z-index:2147483600;background:#101d2e;border:1px solid #33447a;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:7px;box-shadow:0 8px 24px rgba(0,0,0,.55);max-width:470px';
  var rb=b.getBoundingClientRect();
  /* el corte del avance: por defecto el ultimo jueves (el del reporte); se recuerda el ultimo elegido */
  var hoyM=(typeof todayISO==='function')?todayISO():'';
  var corteDef=String(window._crXerCorteUlt||'').slice(0,10);
  if(!corteDef&&hoyM){try{var sdM=_crASerial(hoyM),dwM=new Date(hoyM+'T00:00:00Z').getUTCDay();corteDef=_crDeSerial(sdM-((dwM-4+7)%7))}catch(_ec){corteDef=hoyM}}
  menu.style.left=Math.max(8,Math.min(rb.left,window.innerWidth-490))+'px';
  menu.style.top=(rb.bottom+6)+'px';
  var bt=function(m,mm,col,tit,desc){
    return '<button data-m="'+m+'" data-mm="'+(mm?'1':'0')+'" style="background:'+col+';color:#fff;border:0;border-radius:8px;padding:8px 10px;text-align:left;cursor:pointer;font-family:inherit">'+
      '<b style="font-size:12px">'+tit+'</b><br><span style="font-size:10.5px;opacity:.92;white-space:normal">'+desc+'</span></button>'};
  var perB=function(v,txt){var on=(_crXerPerPref()===v);return '<button data-per="'+v+'" style="background:'+(on?'#1B5E8A':'#151c28')+';color:'+(on?'#fff':'#9db4d6')+';border:1px solid '+(on?'#8ECBF5':'#24344f')+';border-radius:8px;padding:5px 8px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:'+(on?'800':'600')+'">'+txt+'</button>'};
  var remB=function(v,txt){var on=(_crXerRemPref()===v);return '<button data-rem="'+v+'" style="background:'+(on?'#1B5E8A':'#151c28')+';color:'+(on?'#fff':'#9db4d6')+';border:1px solid '+(on?'#8ECBF5':'#24344f')+';border-radius:8px;padding:5px 8px;cursor:pointer;font-family:inherit;font-size:10.5px;font-weight:'+(on?'800':'600')+'">'+txt+'</button>'};
  menu.innerHTML='<b style="font-size:11px;color:#8ECBF5;letter-spacing:.04em">\u00bfQU\u00c9 .XER QUIERES?</b>'+
    '<div id="_crXerRemFila" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:#cfe3ff;padding:2px 0 4px;border-bottom:1px solid #24344f"><span style="font-weight:800;color:#8ECBF5">Remanente:</span>'+remB('hh','\u23f1 por HH y rendimiento de la actividad (hoja 2)')+remB('tabla','\ud83d\udcca por las duraciones de la tabla (Rendimiento APP)')+'</div>'+
    '<div id="_crXerPerFila" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:#cfe3ff;padding:2px 0 4px;border-bottom:1px solid #24344f"><span style="font-weight:800;color:#8ECBF5">Periodos financieros (real por fecha):</span>'+perB('sem','por semana (corte jueves, como la Tabla 2)')+perB('dia','día a día')+'</div>'+
    '<div id="_crXerCorteFila" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:#cfe3ff;padding:2px 0 4px;border-bottom:1px solid #24344f"><span style="font-weight:800;color:#8ECBF5">Corte del avance:</span>'+
    '<input type="date" id="_crXerCorte" value="'+corteDef+'" style="background:#151c28;color:#cfe3ff;border:1px solid #8ECBF5;border-radius:6px;padding:3px 6px;font-family:inherit;font-size:11px">'+
    '<span style="color:#9db4d6">avance hasta ese día inclusive: la fecha de datos queda en ESE mismo día a las 23:59, lo que falta arranca el hábil siguiente y el archivo se abre ya corrido (sin F9)</span></div>'+
    bt('tal',0,'#4a2f7a','📄 Tal cual está · normal',
      'HH y costo <b>forecast</b> de la tabla, fechas, duraciones y predecesoras del aplicativo, y el calendario real del archivo. '+
      '<b>Conserva</b> los avances y la fecha de datos que trae el .xer y su mismo Project ID: P6 te ofrecerá ACTUALIZAR el proyecto que ya tienes.')+
    bt('tal',1,'#5c3b96','📄 Tal cual está · con mayor metrado',
      'Lo mismo, pero el presupuesto sale de <b>HH forecast mayor metrado</b> y <b>Costo forecast mayor metrado</b> de la tabla.')+
    bt('rep',0,'#1B5E8A','🔁 Para reprogramación · normal',
      'Todo lo anterior <b>más lo ejecutado al corte</b>: HH usadas, HH y duración remanentes, % físico y fechas reales. '+
      'Entra como <b>proyecto nuevo</b> (-SEMANAn) con la fecha de datos a las <b>23:59 del día de corte</b>; lo que falta arranca el hábil siguiente y el archivo se abre ya corrido (sin F9).')+
    bt('rep',1,'#2477AE','🔁 Para reprogramación · con mayor metrado',
      'Lo mismo, con <b>HH/Costo forecast mayor metrado</b> como presupuesto y <b>HH/Costo actual forecast (MM)</b> como real.')+
    '<button data-m="no" data-mm="0" style="background:#151c28;color:#9db4d6;border:1px solid #24344f;border-radius:8px;padding:6px 10px;cursor:pointer;font-family:inherit">Cancelar</button>';
  (document.getElementById('_crAlcOv')||document.body).appendChild(menu);
  var cierra=function(){try{menu.remove()}catch(_e){}document.removeEventListener('pointerdown',fuera,true)};
  var fuera=function(ev){if(!menu.contains(ev.target)&&ev.target!==b)cierra()};
  setTimeout(function(){document.addEventListener('pointerdown',fuera,true)},0);
  var rs=menu.querySelectorAll('button[data-rem]');
  for(var j=0;j<rs.length;j++)(function(x){x.onclick=function(ev){ev.stopPropagation();_crXerRemSet(x.getAttribute('data-rem'));
    for(var q=0;q<rs.length;q++){var on=(rs[q].getAttribute('data-rem')===_crXerRemPref());rs[q].style.background=on?'#1B5E8A':'#151c28';rs[q].style.color=on?'#fff':'#9db4d6';rs[q].style.borderColor=on?'#8ECBF5':'#24344f';rs[q].style.fontWeight=on?'800':'600'}}})(rs[j]);
  var ps=menu.querySelectorAll('button[data-per]');
  for(var j2=0;j2<ps.length;j2++)(function(x){x.onclick=function(ev){ev.stopPropagation();_crXerPerSet(x.getAttribute('data-per'));
    for(var q=0;q<ps.length;q++){var on=(ps[q].getAttribute('data-per')===_crXerPerPref());ps[q].style.background=on?'#1B5E8A':'#151c28';ps[q].style.color=on?'#fff':'#9db4d6';ps[q].style.borderColor=on?'#8ECBF5':'#24344f';ps[q].style.fontWeight=on?'800':'600'}}})(ps[j2]);
  var xs=menu.querySelectorAll('button[data-m]');
  for(var i=0;i<xs.length;i++)(function(x){
    x.onclick=async function(ev){
      ev.stopPropagation();
      var m=x.getAttribute('data-m'),mm=x.getAttribute('data-mm')==='1';
      var o2=o;try{var inC=document.getElementById('_crXerCorte'),cv=inC&&String(inC.value||'').slice(0,10);if(cv&&/^\d{4}-\d{2}-\d{2}$/.test(cv)){window._crXerCorteUlt=cv;o2={};for(var kk in o)o2[kk]=o[kk];o2.corte=cv}}catch(_ei){o2=o}
      cierra();
      if(m==='no')return;
      if(b)b.disabled=true;
      try{await _crXerDescarga(c,m,mm,o2)}
      catch(e){_crXerPinta('<div style="color:#FFB4A8;font-weight:800">✖ '+
        _crXerEsc((typeof _crPorQue==='function')?_crPorQue(e):((e&&e.message)||e))+'</div>')}
      if(b)b.disabled=false}})(xs[i])}

/* ----------------------------------------------------------------------------
   EL HANDLER DEL BOTON.

   _crXerBotonUI(c) engancha el boton `#_crFeXrel` de la pantalla de alcance y
   devuelve la funcion que el cierre de _crAlcanceUI conocia como
   `_crFeXerBaja(modo,mm)`. Sustituye a la vez al onclick de #_crFeXrel
   (index.html ~3832) y al `var _crFeXerBaja=async function(modo){...}`
   (~3847).

   --- lo que hay que dejar dentro de _crAlcanceUI, en el sitio de los dos ---
       var _crFeXerBaja=_crXerBotonUI(c);
   --- fin ---

   Nada mas: el boton, su menu de cuatro opciones, el mensaje y la descarga
   quedan montados. Si se quiere llamar a mano desde la consola:
       _crXerDescarga(c,'rep',true,{})     // reprogramacion con mayor metrado
   ---------------------------------------------------------------------------- */
function _crXerBotonUI(c){
  var baja=async function(modo,mm){
    var b=document.getElementById('_crFeXrel');
    if(b)b.disabled=true;
    try{await _crXerDescarga(c,modo,!!mm,{alcLive:_crXerAlcLive()})}
    catch(e){
      _crXerPinta('<div style="color:#FFB4A8;font-weight:800">✖ '+
        _crXerEsc((typeof _crPorQue==='function')?_crPorQue(e):((e&&e.message)||e))+'</div>');
      try{console.error('.xer:',e)}catch(_e){}}
    if(b)b.disabled=false};
  var bt=document.getElementById('_crFeXrel');
  if(bt){
    bt.title='Cuatro formas de sacar el .xer: el plan como esta o el plan mas lo ejecutado, cada una con el presupuesto normal o con el de mayor metrado';
    bt.onclick=function(){_crXerMenuUI(this,c,{alcLive:_crXerAlcLive()})}}
  return baja}

/* el alcance que se ve AHORA en la pantalla, este abierta la hoja que este.
   Solo se acepta la foto del editor de relaciones si es de la hoja 2 y de este
   mismo cronograma; si no, se exporta lo guardado (y el agente M lo avisa). */
function _crXerAlcLive(){
  try{
    var x=window._rlEdCtx;
    if(x&&x.alcX&&x.hoja===2&&window._crCtx&&x.cron===window._crCtx)return x.alcX;
    if(x&&x.alcX&&window._crCtx&&x.cron===window._crCtx&&typeof _crHoja!=='undefined'&&_crHoja===2)return x.alcX}catch(_e){}
  return null}

/* EL CRONOGRAMA "ACTUAL": la misma cadena que usan el analisis de
   restricciones (_rxNoCumplidasT23), la Tabla R (_rxAbreTablaR), el universo
   del calendario (_pgUnivListo) y la curva flotante.
     1) la configuracion de trabajo activa (_ctActiva, cron_trabajo) si su
        cronograma sigue VIVO en la lista;
     2) si no, el ULTIMO de tipo ACTUAL del catalogo (como _ctPorDefectoId);
     3) si no, el ultimo de la lista.
   Ojo: _ctActiva() puede devolver una fila con activa:false (el fallback "el
   ultimo con el que se trabajo"), y esa fila igual manda en los numeros; por
   eso se preselecciona igual y la insignia lo distingue. */
function _crActualDe(L){
  L=(L||[]).filter(function(c){return c&&c.cron_id!=null&&c.cron_id!==''&&!c.eliminado});
  if(!L.length)return null;
  var c=null;
  try{var a=(typeof _ctActiva==='function')?_ctActiva():null;
    if(a&&a.cron_id!=null)c=L.filter(function(z){return String(z.cron_id)===String(a.cron_id)})[0]||null}catch(_e){}
  if(!c)L.forEach(function(z){if(String(z.tipo||'').toUpperCase()==='ACTUAL')c=z});
  if(!c)c=L[L.length-1];
  return c}
/* el estado de un cronograma frente a la configuracion de trabajo:
     'activa' = es la fila ACTUAL de cron_trabajo (el badge verde de la lista)
     'ultima' = _ctActiva() lo devuelve por fallback, pero su fila no esta activa
     'propia' = tiene fila propia, pero no manda
     'sigue'  = NO tiene fila propia: hereda la de la ACTUAL (_crFilaDe), o sea
                sus HH apagadas, sus partidas fuera y sus saldos retirados
                salen de OTRO cronograma */
function _crActualEstado(cronId){
  try{var r=(typeof _ctDe==='function')?_ctDe(cronId):null;
    if(r&&r.activa)return 'activa';
    var a=(typeof _ctActiva==='function')?_ctActiva():null;
    if(a&&String(a.cron_id)===String(cronId))return 'ultima';
    return r?'propia':'sigue'}catch(_e){return 'sigue'}}

/* ============================================================================
   _crExportUI  -  el boton semanal del panel de administracion.
   Mismo motor, modo 'rep', con la semana y el corte que elija el usuario.
   REEMPLAZA a la version de index.html (~7818).
   ============================================================================ */
function _crExportUI(){
  if(!(typeof esAdmin==='function'&&esAdmin())){toast('Solo el administrador');return}
  var ov=document.getElementById('_crExpOv');if(ov)ov.remove();
  ov=document.createElement('div');ov.id='_crExpOv';
  ov.style.cssText='position:fixed;inset:0;z-index:2147483591;background:rgba(10,18,32,.66);display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML='<div style="background:#fff;width:100%;max-width:560px;border-radius:16px 16px 0 0;padding:17px 16px;box-sizing:border-box;max-height:92vh;overflow:auto">'+
    '<div style="font-weight:900;font-size:15.5px;color:#1F3864;margin-bottom:4px">⏫ Exportar a Primavera (.xer corrido)</div>'+
    '<div style="font-size:12px;color:#5C6779;line-height:1.5;margin-bottom:12px">Sale el .xer original con los datos de la <b>tabla del alcance</b>: HH y costo forecast como presupuesto, HH y costo actual como reales, remanente = target − actual, y las fechas, duraciones y predecesoras del aplicativo sobre el <b>calendario real del archivo</b>. La fecha de datos queda a las 23:59 del día de corte, lo que falta arranca el hábil siguiente y el archivo se abre ya corrido (sin F9). Antes de bajarlo se comprueba la estructura: si algo lo haría fallar en P6, no se descarga.</div>'+
    '<label style="display:block;font-size:11px;font-weight:800;color:#1F3864;margin-bottom:4px">Cronograma</label>'+
    '<select id="_crExpSel" style="width:100%;box-sizing:border-box;border:1.5px solid #C7D2E0;border-radius:11px;padding:12px;font-size:14px;font-family:inherit;background:#fff;margin-bottom:11px"></select>'+
    '<label style="display:block;font-size:11px;font-weight:800;color:#1F3864;margin-bottom:4px">Semana que se crea</label>'+
    '<input type="number" id="_crExpSem" min="1" max="99" step="1" placeholder="38" style="width:100%;box-sizing:border-box;border:1.5px solid #C7D2E0;border-radius:11px;padding:12px;font-size:14px;font-family:inherit;background:#fff;margin-bottom:4px">'+
    '<div id="_crExpSemNota" style="font-size:11px;color:#5C6779;margin-bottom:11px"></div>'+
    '<label style="display:block;font-size:11px;font-weight:800;color:#1F3864;margin-bottom:4px">Corrido a (fecha de datos / corte del avance)</label>'+
    '<input type="date" id="_crExpFec" style="width:100%;box-sizing:border-box;border:1.5px solid #C7D2E0;border-radius:11px;padding:12px;font-size:14px;font-family:inherit;background:#fff;margin-bottom:5px">'+
    '<div id="_crExpFecNota" style="font-size:11px;color:#5C6779;line-height:1.45;margin-bottom:7px">El .xer sale con el avance hasta ese día <b>inclusive</b>: la <b>fecha de datos</b> queda en ese mismo día a las <b>23:59</b>, lo que falta arranca el hábil siguiente y el archivo se abre <b>ya corrido</b> (no hace falta F9). No se puede pedir una fecha que la Tabla 2 todavía no tiene.</div>'+
    '<div id="_crExpPct" style="font-size:11.5px;line-height:1.5;color:#1F3864;background:#F2F6FC;border:1px solid #D8E3F2;border-radius:10px;padding:8px 10px;margin-bottom:11px">Elige el cronograma y la fecha de corte.</div>'+
    (function(){
      var b2=function(at,v,on,txt){return '<button type="button" data-'+at+'="'+v+'" style="background:'+(on?'#1F3864':'#F2F6FC')+';color:'+(on?'#fff':'#41526B')+';border:1px solid '+(on?'#1F3864':'#C7D2E0')+';border-radius:8px;padding:6px 9px;cursor:pointer;font-family:inherit;font-size:10.5px;font-weight:'+(on?'800':'600')+'">'+txt+'</button>'};
      var rp=(typeof _crXerRemPref==='function')?_crXerRemPref():'hh';
      var pp=(typeof _crXerPerPref==='function')?_crXerPerPref():'sem';
      return '<div style="font-size:11px;font-weight:800;color:#1F3864;border-top:1px solid #E7EDF5;padding-top:9px;margin-bottom:6px">Opciones de <i>Para reprogramación</i> (las mismas del menú del cronograma)</div>'+
        '<div id="_crExpRem" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:#41526B;margin-bottom:7px"><span style="font-weight:800;color:#1F3864">Remanente:</span>'+
        b2('rem','hh',rp==='hh','⏱ por HH y rendimiento de la actividad (hoja 2)')+
        b2('rem','tabla',rp==='tabla','📊 por las duraciones de la tabla (Rendimiento APP)')+'</div>'+
        '<div id="_crExpPer" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:11px;color:#41526B;margin-bottom:11px"><span style="font-weight:800;color:#1F3864">Periodos financieros (real por fecha):</span>'+
        b2('per','sem',pp==='sem','por semana (corte jueves, como la Tabla 2)')+
        b2('per','dia',pp==='dia','día a día')+'</div>'})()+
    '<label style="display:flex;gap:8px;align-items:center;font-size:12px;color:#1F3864;font-weight:700;margin-bottom:11px">'+
    '<input type="checkbox" id="_crExpMM" style="width:17px;height:17px"> Con <b>mayor metrado</b> (HH y costo forecast mayor metrado)</label>'+
    '<div id="_crExpMsg" style="font-size:12px;color:#5C6779;margin-bottom:11px"></div>'+
    '<div style="display:flex;gap:9px">'+
    '<button id="_crExpNo" style="flex:1;background:#E7EDF5;color:#1B2433;border:0;border-radius:12px;padding:14px;font-weight:800;font-size:13.5px">Cancelar</button>'+
    '<button id="_crExpGo" style="flex:2;background:#5B3A8A;color:#fff;border:0;border-radius:12px;padding:14px;font-weight:800;font-size:13.5px">⬇ Generar .xer</button></div></div>';
  document.body.appendChild(ov);
  ov.onclick=function(e){if(e.target===ov)ov.remove()};
  document.getElementById('_crExpNo').onclick=function(){ov.remove()};
  var hoy=(typeof todayISO==='function')?todayISO():'';
  document.getElementById('_crExpFec').value=hoy;
  /* ---- los dos pares de opciones de "Para reprogramacion" (misma preferencia
         que el menu del cronograma: _tbCfg().xerRem / .xerPer) ---- */
  (function(){
    var luce=function(sel,at,pref){var xs=ov.querySelectorAll(sel+' button[data-'+at+']');
      for(var q=0;q<xs.length;q++){var on=(xs[q].getAttribute('data-'+at)===pref);
        xs[q].style.background=on?'#1F3864':'#F2F6FC';xs[q].style.color=on?'#fff':'#41526B';
        xs[q].style.borderColor=on?'#1F3864':'#C7D2E0';xs[q].style.fontWeight=on?'800':'600'}};
    var ata=function(sel,at,set,get){var xs=ov.querySelectorAll(sel+' button[data-'+at+']');
      for(var j=0;j<xs.length;j++)(function(x){x.onclick=function(ev){ev.preventDefault();ev.stopPropagation();
        try{set(x.getAttribute('data-'+at))}catch(_e){}
        luce(sel,at,get())}})(xs[j])};
    try{ata('#_crExpRem','rem',_crXerRemSet,_crXerRemPref)}catch(_e1){}
    try{ata('#_crExpPer','per',_crXerPerSet,_crXerPerPref)}catch(_e2){}})();
  /* ---- el cronograma elegido, su rango de avance y la validacion del corte ---- */
  var _rango=null,_seq=0,_actId='',_actEst='sigue',_ini=true,_valT=null;
  var _cronSel=function(){var id=(document.getElementById('_crExpSel')||{}).value||'';
    return _crLista().filter(function(x){return String(x.cron_id)===String(id)})[0]||null};
  var _caja=function(html,col){var p=document.getElementById('_crExpPct');if(!p)return;
    p.style.background=(col==='mal')?'#FDF0EE':((col==='ojo')?'#FFF7E8':'#F2F6FC');
    p.style.borderColor=(col==='mal')?'#F0C2BB':((col==='ojo')?'#EBD7AC':'#D8E3F2');
    p.style.color=(col==='mal')?'#B42318':((col==='ojo')?'#7A4B00':'#1F3864');
    p.innerHTML=html};
  var _sincroSem=function(){var f=document.getElementById('_crExpFec'),e=document.getElementById('_crExpSem');
    if(!f||!e)return;var w=_crXerSemReporte(f.value);if(w>0)e.value=w};
  var _goOn=function(on){var b=document.getElementById('_crExpGo');if(!b)return;
    b.disabled=!on;b.style.opacity=on?'1':'.5';b.style.cursor=on?'pointer':'not-allowed'};
  /* los avisos del cronograma, debajo del select: si no es el ACTUAL y si no
     tiene configuracion de trabajo propia (hereda la de la ACTUAL) */
  var _avisoCron=function(){
    var n=document.getElementById('_crExpCron');if(!n)return;
    var c=_cronSel(),id=c?String(c.cron_id):'';
    if(!id){n.innerHTML='';return}
    var a=_crLista().filter(function(x){return String(x.cron_id)===String(_actId)})[0]||null;
    var quien=a?('<b>'+esc(_crNomVis(a))+'</b>'):'la ACTUAL';
    var caja=function(bg,bd,col,txt){return '<div style="background:'+bg+';border:1px solid '+bd+';border-radius:9px;padding:7px 9px;color:'+col+';font-size:11px;line-height:1.45;margin-bottom:6px">'+txt+'</div>'};
    var H=[];
    if(_actId&&id===_actId&&_actEst==='activa')
      H.push(caja('#EAF3EC','#BFD8C6','#0C5132','⚙ <b>ACTUAL ✓</b> — es el cronograma con el que trabajan el análisis de restricciones, la Tabla R, las tarjetas y la curva.'));
    else if(_actId&&id===_actId)
      H.push(caja('#FFF7E8','#EBD7AC','#7A4B00','⚙ Ninguna configuración está marcada como <b>ACTUAL</b>: se está usando la última con la que se trabajó.'));
    else
      H.push(caja('#FDF0EE','#F0C2BB','#B42318','⚠ Estás exportando <b>'+esc(_crNomVis(c))+'</b>, que <b>no</b> es el cronograma ACTUAL ('+quien+'). El .xer saldrá con las actividades, el alcance y los rendimientos de <b>'+esc(_crNomVis(c))+'</b>.'));
    if(_crActualEstado(id)==='sigue')
      H.push(caja('#FFF7E8','#EBD7AC','#7A4B00','⚠ <b>'+esc(_crNomVis(c))+'</b> no tiene configuración de trabajo propia: sus <b>HH apagadas</b>, sus <b>partidas fuera</b>, sus <b>saldos retirados</b> y su base del peso salen de '+quien+'.'));
    n.innerHTML=H.join('')};
  /* mide el rango de avance del cronograma elegido y valida la fecha de corte.
     Lleva guardia de secuencia: el usuario puede cambiar de cronograma
     mientras se mide. */
  var _crExpVal=async function(recarga){
    var f=document.getElementById('_crExpFec'),c=_cronSel();
    _avisoCron();
    if(!c){_goOn(false);return}
    var q=++_seq;
    if(recarga||!_rango||_rango.cid!==String(c.cron_id)){
      _caja('Midiendo el avance de la Tabla 2…');_goOn(false);
      var R=null;try{R=await _crXerRangoAvance(c)}catch(_e){R=null}
      if(q!==_seq)return;
      if(!R){_rango=null;_caja('⚠ No se pudo medir el avance de este cronograma: revisa que sus actividades y su alcance hayan cargado.','ojo');_goOn(false);return}
      _rango=R;
      if(f){
        f.max=R.max||R.hoy;
        var cur=String(f.value||'').slice(0,10);
        /* por defecto, la ultima fecha con avance; si el ultimo jueves cae
           dentro del avance, ese (es el corte con el que se reporta y con el
           que la Tabla 2 cierra semana) */
        var def=R.ult||R.hoy,ju=_crXerJueves(R.hoy||'');
        if(R.ult&&ju&&ju<=R.ult&&(!R.min||ju>=R.min))def=ju;
        /* al cambiar de cronograma la fecha del usuario solo se pisa si ya no vale */
        if(_ini||!cur||(R.hoy&&cur>R.hoy)||(R.ult&&cur>R.ult)){f.value=def;_sincroSem();_nota()}
        _ini=false}}
    if(q!==_seq)return;
    var R2=_rango;if(!R2){_goOn(false);return}
    var v=(f&&String(f.value||'').slice(0,10))||'';
    var mide=function(iso){var g=R2.gan(iso),hh=Number(R2.hhUni)||0,p=(hh>0)?(g/hh*100):0;
      return '<b>'+_nMil2(p)+' %</b> físico al corte  ·  <b>'+_nMil2(g)+'</b> hh ganadas de '+_nMil2(hh)+' hh del alcance'};
    var ok=true,col='',txt='';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){ok=false;col='mal';txt='⚠ Pon la fecha a la que quieres el .xer corrido.'}
    else if(R2.hoy&&v>R2.hoy){ok=false;col='mal';txt='⚠ No se puede correr el .xer a una fecha futura: hoy es '+_crXerDMY(R2.hoy)+'.'}
    else if(R2.ult&&v>R2.ult){ok=false;col='mal';txt='⚠ <b>la Tabla 2 solo tiene avance hasta '+_crXerDMY(R2.ult)+'</b>: elige esa fecha o una anterior.'}
    else if(!R2.ult){col='ojo';txt='⚠ Este cronograma no tiene ningún avance en la Tabla 2 todavía: el .xer saldría con 0 % ejecutado.'}
    else if(R2.min&&v<R2.min){col='ojo';txt='⚠ Esa fecha es anterior al primer avance ('+_crXerDMY(R2.min)+'): el .xer sale con 0 % ejecutado y sin periodos financieros.<br>'+mide(v)}
    else txt=mide(v)+'<br><span style="font-size:10.5px;color:#41526B">Fecha de datos '+_crXerDMY(v)+' 23:59 (el archivo se abre ya corrido)  ·  la Tabla 2 tiene avance hasta '+_crXerDMY(R2.ult)+'</span>';
    _caja(txt,col);_goOn(ok)};
  var _valPronto=function(rec){try{if(_valT)clearTimeout(_valT)}catch(_e){}
    _valT=setTimeout(function(){_valT=null;_crExpVal(rec)},180)};
  var _nota=function(){
    var e=document.getElementById('_crExpSem'),n=document.getElementById('_crExpSemNota');
    if(!e||!n)return;
    var v=parseInt(e.value,10),id=(document.getElementById('_crExpSel')||{}).value||'';
    var base=id;try{if(typeof _wkNomCr==='function')base=_wkNomCr(id)||id}catch(_e){}
    n.textContent=(v>0&&id)
      ?('Entra a P6 como  '+_crXerNomProy(base,'-SEMANA'+v)+'  ·  '+_XER_PROY_NOMBRE)
      :'Sin numero, el archivo conserva el Project ID que ya traia.'};
  (function(){
    var f=document.getElementById('_crExpFec'),e=document.getElementById('_crExpSem');
    if(e&&f){
      var v=_crXerSemReporte(f.value);if(v>0)e.value=v;
      e.oninput=_nota;
      var mueve=function(){_sincroSem();_nota();_valPronto(false)};
      f.addEventListener('change',mueve);
      f.addEventListener('input',mueve)}
    _nota()})();
  _crPull().then(function(L){
    var s=document.getElementById('_crExpSel');if(!s)return;
    if(!L.length){
      s.innerHTML='<option>— no hay cronogramas cargados —</option>';
      document.getElementById('_crExpGo').disabled=true;
      document.getElementById('_crExpGo').style.opacity='.5';
      document.getElementById('_crExpMsg').innerHTML='Primero carga un .xer en 📅 Cronogramas.';return}
    s.innerHTML=L.map(function(c){return '<option value="'+esc(c.cron_id)+'">'+esc(_crNomVis(c))+' — '+esc(String(c.nombre||'').slice(0,48))+'</option>'}).join('');
    (function(){
      var act=_crActualDe(L);
      _actId=act?String(act.cron_id):'';
      _actEst=_actId?_crActualEstado(_actId):'sigue';
      s.innerHTML=L.map(function(c){var id=String(c.cron_id),mk='';
        if(id===_actId)mk=((_actEst==='activa')?'⚙ ACTUAL ✓ ':'⚙ con este se trabaja ')+'· ';
        return '<option value="'+esc(id)+'">'+mk+esc(_crNomVis(c))+' — '+esc(String(c.tipo||'LB'))+' — '+esc(String(c.nombre||'').slice(0,40))+'</option>'}).join('');
      /* el atributo `selected` no siempre gana sobre un <select> recien
         pintado (iOS/Safari): se fija tambien el value */
      if(_actId)s.value=_actId;
      if(!document.getElementById('_crExpCron'))s.insertAdjacentHTML('afterend','<div id="_crExpCron" style="font-size:11px;line-height:1.45;margin:-7px 0 9px"></div>')})();
    s.onchange=function(){_nota();_crExpVal(true)};
    _nota();_crExpVal(true)});
  document.getElementById('_crExpGo').onclick=async function(){
    var b=this,msg=document.getElementById('_crExpMsg');
    b.disabled=true;b.textContent='Armando…';
    try{
      var id=document.getElementById('_crExpSel').value;
      var c=_crLista().filter(function(x){return String(x.cron_id)===String(id)})[0];
      if(!c)throw new Error('no encuentro ese cronograma');
      var corte=String(document.getElementById('_crExpFec').value||'').slice(0,10)||hoy;
      var sem=parseInt(document.getElementById('_crExpSem').value,10);
      var mm=!!document.getElementById('_crExpMM').checked;
      /* la misma validacion del boton, por si alguien fuerza la fecha a mano */
      if(_rango&&_rango.cid===String(id)){
        if(_rango.hoy&&corte>_rango.hoy)throw new Error('no se puede correr el .xer a una fecha futura: hoy es '+_crXerDMY(_rango.hoy));
        if(_rango.ult&&corte>_rango.ult)throw new Error('la Tabla 2 solo tiene avance hasta '+_crXerDMY(_rango.ult))}
      /* remanente y periodos financieros: las MISMAS preferencias del menu del
         cronograma, para que los dos caminos den el mismo archivo */
      var rem=(typeof _crXerRemPref==='function')?_crXerRemPref():'hh';
      var per=(typeof _crXerPerPref==='function')?_crXerPerPref():'sem';
      /* el alcance vivo del editor de relaciones solo vale si esta abierto en
         ESTE mismo cronograma; si no, se exporta lo guardado */
      var live=null;try{if(String(window._crCtx||'')===String(id)&&typeof _crXerAlcLive==='function')live=_crXerAlcLive()}catch(_el){live=null}
      var pinta=function(h){msg.innerHTML='<div style="background:#0d1117;border-radius:10px;padding:9px 11px">'+h+'</div>'};
      await _crXerDescarga(c,'rep',mm,{corte:corte,sem:(sem>0?sem:0),
        rem:rem,per:per,alcLive:live,
        pinta:pinta,
        aviso:function(t){msg.innerHTML='<div style="color:#5C6779;font-weight:700">'+esc(t)+'</div>'}});
      try{window._crXerCorteUlt=corte}catch(_e9){}
      setTimeout(function(){try{_crExpVal(false)}catch(_ev){}},0);
      b.textContent='⬇ Generar otra vez';b.disabled=false}
    catch(e){
      msg.innerHTML='<div style="color:#B42318;font-weight:800">✖ '+
        esc(String((typeof _crPorQue==='function')?_crPorQue(e):((e&&e.message)||e)))+'</div>';
      b.textContent='⬇ Generar .xer';b.disabled=false}}}
