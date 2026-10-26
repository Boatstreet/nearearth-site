/* Near Space site: copy button, live app phones, hero sky */
(function(){
  // Copy address
  var btn=document.getElementById('copy'),addr=document.getElementById('addr');
  if(btn&&addr)btn.addEventListener('click',function(){
    var t=addr.textContent;
    function sel(){var r=document.createRange();r.selectNodeContents(addr);var s=getSelection();s.removeAllRanges();s.addRange(r);}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(function(){btn.textContent='Copied';setTimeout(function(){btn.textContent='Copy'},1600)},sel);
    } else sel();
  });


  // Live phones: scale each 412-px app to its screen; load when near view, unload when long gone
  var screens=[].slice.call(document.querySelectorAll('.screen[data-app]'));
  if(window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches)document.querySelectorAll('.caption .verb').forEach(function(v){v.textContent='Click'});
  function fit(sc){var w=sc.clientWidth; sc.style.setProperty('--k',(w/412).toFixed(4));}
  if(window.ResizeObserver){var ro=new ResizeObserver(function(es){es.forEach(function(e){fit(e.target)})});screens.forEach(function(sc){ro.observe(sc)})}
  screens.forEach(fit);
  function load(sc){var f=sc.querySelector('iframe');if(sc.dataset.on)return;sc.dataset.on='1';sc.classList.remove('live');f.onload=function(){if(!sc.dataset.on)return;var col=sc.closest('.phone-col');setTimeout(function(){sc.classList.add('live');if(col)col.classList.add('ready')},250);try{var d=f.contentWindow.document;['pointerdown','touchstart','wheel','keydown'].forEach(function(ev){d.addEventListener(ev,function(){sc.classList.add('used');if(col)col.classList.add('used')},{passive:true,once:true,capture:true})})}catch(e){}};f.src=f.dataset.src;}
  function unload(sc){var f=sc.querySelector('iframe');if(!sc.dataset.on)return;delete sc.dataset.on;sc.classList.remove('live');f.src='about:blank';}
  addEventListener('message',function(e){var d=e.data;if(!d||!d.demoLive)return;var sc=document.querySelector('.screen[data-app="'+d.demoLive+'"]');if(!sc)return;var c=sc.closest('.phone-col').querySelector('.src');if(c)c.textContent='live data';});
  function clk(){var d=new Date(),t=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);document.querySelectorAll('.sbar .clk').forEach(function(e){e.textContent=t})}clk();setInterval(clk,10000);
  var timers=new Map();
  if(window.IntersectionObserver){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){var sc=e.target;
      if(e.isIntersecting){clearTimeout(timers.get(sc));load(sc);}
      else{clearTimeout(timers.get(sc));timers.set(sc,setTimeout(function(){unload(sc)},30000));}
    })},{rootMargin:'300px 0px'});
    screens.forEach(function(sc){io.observe(sc)});
  } else screens.forEach(load);

  // Hero sky: twinkling stars, the Sun's glow, a satellite on its orbit, an occasional meteor.
  var c=document.getElementById('herosky');if(!c)return;
  var x=c.getContext('2d'),W,H,dpr,stars=[],t0=performance.now(),meteor=null;
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size(){
    dpr=Math.min(devicePixelRatio||1,2);W=c.clientWidth;H=c.clientHeight;
    c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0);
    stars=[];var n=Math.round(W*H/2600);
    for(var i=0;i<n;i++)stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+.2,p:Math.random()*6.28,s:.5+Math.random()*1.5});
  }
  function draw(now){
    var t=(now-t0)/1000;
    x.clearRect(0,0,W,H);
    // sun glow, upper right
    var sx=W*.86,sy=H*.22,sr=Math.max(W,H)*.32;
    var g=x.createRadialGradient(sx,sy,0,sx,sy,sr);
    g.addColorStop(0,'rgba(255,184,90,.55)');g.addColorStop(.12,'rgba(255,130,60,.28)');g.addColorStop(.45,'rgba(255,107,61,.06)');g.addColorStop(1,'rgba(255,107,61,0)');
    x.fillStyle=g;x.fillRect(0,0,W,H);
    // stars
    for(var i=0;i<stars.length;i++){var s=stars[i];var a=.35+.45*(.5+.5*Math.sin(t*s.s+s.p));x.fillStyle='rgba(220,228,255,'+a.toFixed(3)+')';x.beginPath();x.arc(s.x,s.y,s.r,0,6.283);x.fill();}
    // orbit
    var cx=W*.78,cy=H*.66,rx=Math.min(W*.34,420),ry=rx*.28,rot=-.32;
    x.save();x.translate(cx,cy);x.rotate(rot);
    x.strokeStyle='rgba(92,184,255,.22)';x.lineWidth=1;x.setLineDash([4,6]);x.beginPath();x.ellipse(0,0,rx,ry,0,0,6.283);x.stroke();x.setLineDash([]);
    var a=t*.35;var px=Math.cos(a)*rx,py=Math.sin(a)*ry;
    // trail
    for(var k=1;k<26;k++){var b=a-k*.025;x.fillStyle='rgba(92,184,255,'+(0.5*(1-k/26)).toFixed(3)+')';x.beginPath();x.arc(Math.cos(b)*rx,Math.sin(b)*ry,1.6,0,6.283);x.fill();}
    x.fillStyle='#fff';x.beginPath();x.arc(px,py,2.6,0,6.283);x.fill();
    x.restore();
    // meteor
    if(!still){
      if(!meteor&&Math.random()<.006)meteor={x:Math.random()*W*.7,y:Math.random()*H*.35,vx:6+Math.random()*4,vy:2.5+Math.random()*2,life:0};
      if(meteor){meteor.life++;meteor.x+=meteor.vx;meteor.y+=meteor.vy;
        var lg=x.createLinearGradient(meteor.x,meteor.y,meteor.x-meteor.vx*14,meteor.y-meteor.vy*14);
        lg.addColorStop(0,'rgba(185,160,255,.9)');lg.addColorStop(1,'rgba(185,160,255,0)');
        x.strokeStyle=lg;x.lineWidth=1.6;x.beginPath();x.moveTo(meteor.x,meteor.y);x.lineTo(meteor.x-meteor.vx*14,meteor.y-meteor.vy*14);x.stroke();
        if(meteor.life>60)meteor=null;}
    }
    if(!still)requestAnimationFrame(draw);
  }
  size();addEventListener('resize',function(){size();if(still)draw(performance.now());});
  if(still)draw(performance.now()+5000);else requestAnimationFrame(draw);
})();
