/* LaneHook language switcher for every page except the home page (which has its own copy). Dictionaries load on demand from /i18n/<code>.js */
(function(){
  'use strict';
  var CODES=['en','es','ru','uk','pa','uz','ar'];
  var LANGS=[{c:'en',n:'English',s:'EN'},{c:'es',n:'Español',s:'ES'},{c:'ru',n:'Русский',s:'RU'},{c:'uk',n:'Українська',s:'UA'},{c:'pa',n:'ਪੰਜਾਬੀ',s:'ਪੰ'},{c:'uz',n:'Oʻzbekcha',s:'UZ'},{c:'ar',n:'العربية',s:'ع'}];
  var FONTS={ru:'Manrope:wght@600;700;800',uk:'Manrope:wght@600;700;800',pa:'Noto+Sans+Gurmukhi:wght@400;600;800',ar:'IBM+Plex+Sans+Arabic:wght@400;600;700'},fontDone={};
  var D={},LANG='en',hooks=[],loading={},base=(document.currentScript&&document.currentScript.src||'').replace(/[^\/]*$/,'')||'/';
  var NUM=/\$?\d[\d,]*(?:\.\d+)?%?/g;
  function t(s){
    if(LANG==='en'||!s)return s;var d=D[LANG];if(!d)return s;var v=d[s];if(v!=null)return v;
    var nums=[],k=s.replace(NUM,function(m){nums.push(m);return '#'});
    if(nums.length){var v2=d[k];if(v2!=null){var i=0;return v2.replace(/#/g,function(){return i<nums.length?nums[i++]:''})}}
    return s;
  }
  function skip(el){return !el||el.closest('script,style,svg,textarea,[translate="no"],[data-notr]')}
  function trNode(n){
    var p=n.parentElement;if(skip(p))return;var v=n.nodeValue;if(!v||!v.trim())return;
    if(n.__tr===undefined||v!==n.__tr)n.__en=v;
    var m=n.__en.match(/^(\s*)([\s\S]*?)(\s*)$/),out=m[1]+t(m[2].replace(/\s+/g,' '))+m[3];
    if(out!==v)n.nodeValue=out;n.__tr=out;
  }
  var ATTRS=['placeholder','aria-label','title','alt'];
  function trAttrs(root){
    var els=root.querySelectorAll?root.querySelectorAll('[placeholder],[aria-label],[title],[alt]'):[];
    if(root.matches&&root.matches('[placeholder],[aria-label],[title],[alt]')){els=Array.prototype.slice.call(els);els.push(root)}
    Array.prototype.forEach.call(els,function(el){if(skip(el))return;ATTRS.forEach(function(a){
      var v=el.getAttribute(a);if(v==null)return;var k='data-en-'+a;
      if(!el.hasAttribute(k)||el.getAttribute('data-tr-'+a)!==v)el.setAttribute(k,v);
      var o=t(el.getAttribute(k));el.setAttribute('data-tr-'+a,o);if(o!==v)el.setAttribute(a,o)})});
  }
  function apply(root){
    if(root.nodeType===3){trNode(root);return}
    if(root.nodeType!==1||skip(root))return;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n;while(n=w.nextNode())trNode(n);trAttrs(root);
  }
  var titleEn=document.title;
  function loadFont(c){if(!FONTS[c]||fontDone[c])return;fontDone[c]=1;var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+FONTS[c]+'&display=swap';document.head.appendChild(l)}
  function ensure(c,cb){
    if(c==='en'||D[c])return cb();
    if(loading[c]){loading[c].push(cb);return}loading[c]=[cb];
    var s=document.createElement('script');s.src=base+'i18n/'+c+'.js?v=1';
    s.onload=s.onerror=function(){var q=loading[c];loading[c]=null;q.forEach(function(f){f()})};document.head.appendChild(s);
  }
  function paintButtons(){
    var cur=LANGS.filter(function(l){return l.c===LANG})[0]||LANGS[0];
    Array.prototype.forEach.call(document.querySelectorAll('.lhl-txt'),function(b){b.textContent=cur.s});
    Array.prototype.forEach.call(document.querySelectorAll('[data-lhl]'),function(x){var on=x.getAttribute('data-lhl')===LANG;x.classList.toggle('on',on);x.setAttribute('aria-checked',on?'true':'false')});
    Array.prototype.forEach.call(document.querySelectorAll('select.lhl-sel'),function(s){s.value=LANG});
  }
  function setLang(c,save){
    if(CODES.indexOf(c)<0)c='en';
    ensure(c,function(){
      LANG=c;var h=document.documentElement;h.lang=c;h.dir=c==='ar'?'rtl':'ltr';loadFont(c);
      apply(document.body);document.title=t(titleEn);paintButtons();
      if(save){try{localStorage.setItem('lh-lang',c)}catch(e){}}
      hooks.forEach(function(f){try{f(c)}catch(e){}});
    });
  }
  function detect(){
    var q=(location.search.match(/[?&]lang=([a-z]{2})/)||[])[1];if(q&&CODES.indexOf(q)>-1)return q;
    try{var s=localStorage.getItem('lh-lang');if(s&&CODES.indexOf(s)>-1)return s}catch(e){}
    var ls=(navigator.languages||[navigator.language||'en']);
    for(var i=0;i<ls.length;i++){var c=String(ls[i]).slice(0,2).toLowerCase();if(CODES.indexOf(c)>-1)return c}
    return 'en';
  }
  var css='.lhl{position:relative;display:inline-block;font-family:inherit}.lhl-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);color:#F8FAFC;font:600 13px/1 inherit;cursor:pointer}.lhl.light .lhl-btn{background:#fff;border-color:#CBD5E1;color:#0B132B}.lhl-menu{position:absolute;top:calc(100% + 6px);inset-inline-end:0;min-width:180px;background:#12204A;border:1px solid #22305A;border-radius:12px;padding:5px;box-shadow:0 14px 40px rgba(0,0,0,.4);display:none;z-index:200}.lhl.open .lhl-menu{display:block}.lhl.light .lhl-menu{background:#fff;border-color:#E2E8F0}.lhl-menu button{display:flex;justify-content:space-between;gap:12px;width:100%;background:none;border:0;color:#CBD5E1;font:500 14px/1.2 inherit;padding:10px;border-radius:8px;min-height:40px;text-align:start;cursor:pointer}.lhl.light .lhl-menu button{color:#0B132B}.lhl-menu button b{font-size:11px;opacity:.6}.lhl-menu button:hover{background:rgba(255,255,255,.08)}.lhl.light .lhl-menu button:hover{background:#F1F5F9}.lhl-menu button.on{background:#F59E0B;color:#0B132B}html[lang=ru] body,html[lang=uk] body{font-family:Manrope,system-ui,sans-serif}html[lang=pa] body{font-family:"Noto Sans Gurmukhi",system-ui,sans-serif}html[lang=ar] body{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif}';
  function injectCss(){if(document.getElementById('lhl-css'))return;var s=document.createElement('style');s.id='lhl-css';s.textContent=css;document.head.appendChild(s)}
  function mount(el,opts){
    injectCss();opts=opts||{};el.setAttribute('data-lhl-done','1');
    if(opts.select){el.innerHTML='<select class="lhl-sel" aria-label="Language" style="min-height:44px;font-size:16px;padding:0 10px;border-radius:12px;border:1px solid #CBD5E1;background:#fff;color:#0B132B;width:100%">'+LANGS.map(function(l){return '<option value="'+l.c+'" lang="'+l.c+'" translate="no">'+l.n+'</option>'}).join('')+'</select>';
      el.querySelector('select').onchange=function(){setLang(this.value,true)};paintButtons();return}
    el.className=(el.className?el.className+' ':'')+'lhl'+(opts.light?' light':'');
    el.innerHTML='<button class="lhl-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Language"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg><span class="lhl-txt" translate="no">EN</span></button><div class="lhl-menu" role="menu">'+LANGS.map(function(l){return '<button type="button" role="menuitemradio" data-lhl="'+l.c+'" lang="'+l.c+'" translate="no"><span>'+l.n+'</span><b>'+l.s+'</b></button>'}).join('')+'</div>';
    var b=el.querySelector('.lhl-btn');
    b.onclick=function(e){e.stopPropagation();var o=el.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false')};
    el.querySelector('.lhl-menu').onclick=function(e){var x=e.target.closest('[data-lhl]');if(!x)return;setLang(x.getAttribute('data-lhl'),true);el.classList.remove('open')};
    document.addEventListener('click',function(e){if(!el.contains(e.target))el.classList.remove('open')});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')el.classList.remove('open')});
    paintButtons();
  }
  function mountAll(){Array.prototype.forEach.call(document.querySelectorAll('[data-lhl-mount]:not([data-lhl-done])'),function(el){mount(el,{light:el.hasAttribute('data-light'),select:el.hasAttribute('data-select')})})}
  function init(){
    mountAll();
    new MutationObserver(function(ms){mountAll();if(LANG==='en')return;ms.forEach(function(m){
      if(m.type==='characterData')trNode(m.target);
      else if(m.type==='attributes'){trAttrs(m.target)}
      else Array.prototype.forEach.call(m.addedNodes,apply)})}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    setLang(detect(),false);
  }
  window.LHI={t:t,add:function(c,o){D[c]=Object.assign(D[c]||{},o)},setLang:setLang,mount:mount,init:init,lang:function(){return LANG},onChange:function(f){hooks.push(f)},codes:CODES};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
