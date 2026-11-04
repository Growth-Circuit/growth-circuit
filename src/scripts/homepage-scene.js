// Canvas artwork and scroll choreography adapted from the supplied homepage export.
/* ---------- small helpers ---------- */
function gcRng(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gcClamp(v,a,b){return v<a?a:v>b?b:v;}
function gcLerp(a,b,t){return a+(b-a)*t;}
function gcSmooth(a,b,x){var t=gcClamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function gcRgb(h){return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];}
function gcKeys(list,s){ /* list: [[s,[r,g,b],(alpha)],...] returns [r,g,b,a] */
  if(s<=list[0][0])return [list[0][1][0],list[0][1][1],list[0][1][2],list[0][2]||0];
  for(var i=1;i<list.length;i++){if(s<=list[i][0]){var a=list[i-1],b=list[i],t=(s-a[0])/(b[0]-a[0]);
    return [gcLerp(a[1][0],b[1][0],t),gcLerp(a[1][1],b[1][1],t),gcLerp(a[1][2],b[1][2],t),gcLerp(a[2]||0,b[2]||0,t)];}}
  var l=list[list.length-1];return [l[1][0],l[1][1],l[1][2],l[2]||0];
}
function gcKf(rows){return rows.map(function(r){return [r[0],gcRgb(r[1]),r[2]];});}
function gcCss(c,alpha){return 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+(alpha==null?1:alpha)+')';}

var GC_SKY_TOP=gcKf([[0,'#b4dff1'],[.3,'#a4d6ee'],[.5,'#9cc6dc'],[.64,'#8682b4'],[.78,'#343a72'],[.9,'#13283f'],[1,'#0b1e2b']]);
var GC_SKY_LOW=gcKf([[0,'#e8f5f6'],[.3,'#f8efd6'],[.5,'#ffcf86'],[.64,'#ffa56e'],[.78,'#ec7a68'],[.9,'#3f5079'],[1,'#20405a']]);
var GC_TINT=gcKf([[0,'#ffffff',0],[.3,'#9a7050',.02],[.5,'#7c4e40',.07],[.64,'#5f3a58',.12],[.78,'#3a2f66',.2],[.9,'#102a44',.34],[1,'#0c2233',.4]]);
var GC_SUN=gcKf([[0,'#f9b63a'],[.5,'#f89a34'],[.72,'#ee5f47'],[1,'#c6423f']]);
var GC_TONES={
 green:[gcKf([[0,'#1c5843'],[.5,'#27503a'],[.72,'#1c2a46'],[.95,'#0a1f2c']]),gcKf([[0,'#2d7b56'],[.5,'#4f7a3e'],[.72,'#2b3b56'],[.95,'#0e2835']]),gcKf([[0,'#4ea46a'],[.5,'#95a048'],[.72,'#474d62'],[.95,'#123140']]),gcKf([[0,'#93cf74'],[.5,'#dcc05c'],[.72,'#7c6c72'],[.95,'#183b4b']])],
 amber:[gcKf([[0,'#8a451c'],[.5,'#7a361a'],[.72,'#2a2444'],[.95,'#0a1f2c']]),gcKf([[0,'#c96f20'],[.5,'#b85c20'],[.72,'#3f3250'],[.95,'#0e2835']]),gcKf([[0,'#ea9c2c'],[.5,'#e78e2e'],[.72,'#6a4a58'],[.95,'#123140']]),gcKf([[0,'#f8cb5a'],[.5,'#f7bb52'],[.72,'#9a7468'],[.95,'#183b4b']])]
};

function GCScene(root,opts){
  var stage=root.querySelector('[data-stage]'),bg=root.querySelector('[data-bg]'),fg=root.querySelector('[data-fg]');
  var bx=bg.getContext('2d'),fx=fg.getContext('2d');
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W=0,H=0,D=1,u=1,yB=0,yLawn=0,yDeck=0,phone=false;
  var layers=[],trees=[],clouds=[],stars=[],lamps=[],particles=[],bulbs=[],trainSprite=null,trainLen=0,sunHalo=null,glow=null,warm=null;
  var ink='#17313a',season=opts.season||'early fall';
  var s=0,sT=0,d=0,dT=0,t=0,last=0,raf=0,dirty=true,alive=true,covered=false,scrollY=0;
  var anchors=[],ptr={x:-999,y:-999,sx:-999,sy:-999,e:0,px:0,py:0};
  var cue=root.querySelector('[data-cue]'),cap=root.querySelector('[data-caption]'),travel=root.querySelector('[data-travel]'),strip=root.querySelector('[data-strip]');

  function mk(){var c=document.createElement('canvas');c.width=Math.ceil(W*D);c.height=Math.ceil(H*D);var x=c.getContext('2d');x.scale(D,D);return {c:c,x:x};}

  /* --- drawing primitives --- */
  function dots(x,X,Y,w,h,p,r,col,o){o=o||{};x.fillStyle=col;x.beginPath();var rn=o.rand,row=0;
    for(var yy=Y;yy<Y+h;yy+=p){var off=(o.stagger&&row%2)?p/2:0;
      var ft=o.fadeFrom!=null?1-gcSmooth(o.fadeFrom,o.fadeTo,yy):1;
      if(ft>.04)for(var xx=X+off;xx<X+w;xx+=p){if(rn&&o.hole&&rn()<o.hole)continue;var rr=r*ft;x.moveTo(xx+rr,yy);x.arc(xx,yy,rr,0,6.283);}
      row++;}
    x.fill();}
  function poly(x,pts){x.beginPath();x.moveTo(pts[0],pts[1]);for(var i=2;i<pts.length;i+=2)x.lineTo(pts[i],pts[i+1]);x.closePath();}
  function cut(x,fn){x.save();x.globalCompositeOperation='destination-out';x.strokeStyle='#000';x.fillStyle='#000';fn();x.restore();}
  function winAdd(L,x,y,w,h,seed){L.win.push([x,y,w,h,seed]);}
  function waterTank(x,cx,top,k,col){
    var tw=16*k,th=17*k;x.fillStyle=col;x.strokeStyle=col;x.lineWidth=1.3*k;
    x.beginPath();x.moveTo(cx-tw*.4,top);x.lineTo(cx-tw*.46,top-9*k);x.moveTo(cx+tw*.4,top);x.lineTo(cx+tw*.46,top-9*k);x.moveTo(cx,top);x.lineTo(cx,top-9*k);x.stroke();
    x.fillRect(cx-tw/2,top-9*k-th,tw,th);
    poly(x,[cx-tw/2-1*k,top-9*k-th,cx,top-9*k-th-8*k,cx+tw/2+1*k,top-9*k-th]);x.fill();
    cut(x,function(){x.lineWidth=.8*k;for(var i=1;i<4;i++){x.beginPath();x.moveTo(cx-tw/2+i*tw/4,top-9*k-th+1);x.lineTo(cx-tw/2+i*tw/4,top-10*k);x.stroke();}});
  }

  /* --- landmarks (all invented drawings of real NYC silhouettes) --- */
  function empire(L,cx,b,k){var x=L.x,tiers=[[86,70],[70,70],[54,120],[42,110],[30,44],[18,26]],y=b;x.fillStyle=ink;
    tiers.forEach(function(ti,i){var w=ti[0]*k,h=ti[1]*k;x.fillRect(cx-w/2,y-h,w,h);
      var pitch=4.6*k;cut(x,function(){x.lineWidth=1.1*k;for(var q=cx-w/2+pitch*.7;q<cx+w/2-1;q+=pitch){x.beginPath();x.moveTo(q,y-h+2*k);x.lineTo(q,y);x.stroke();}});
      if(i>0)for(var wy=y-h+6*k;wy<y-3*k;wy+=7*k)for(var q=cx-w/2+pitch*.7;q<cx+w/2-1;q+=pitch*2)if(L.rn()<.55)winAdd(L,q-1*k,wy,2*k,3.4*k,L.rn());
      y-=h;});
    x.fillRect(cx-3.5*k,y-34*k,7*k,34*k);x.fillRect(cx-1.2*k,y-74*k,2.4*k,42*k);}
  function chrysler(L,cx,b,k){var x=L.x,w=44*k,sh=300*k,top=b-sh;x.fillStyle=ink;
    x.fillRect(cx-w/2-8*k,b-120*k,w+16*k,120*k);x.fillRect(cx-w/2,top,w,sh);
    x.beginPath();x.moveTo(cx-w/2,top);x.quadraticCurveTo(cx-w*.42,top-58*k,cx,top-104*k);x.quadraticCurveTo(cx+w*.42,top-58*k,cx+w/2,top);x.closePath();x.fill();
    x.fillRect(cx-1*k,top-150*k,2*k,50*k);
    cut(x,function(){x.lineWidth=1.3*k;[0,1,2,3,4].forEach(function(i){var yy=top-6*k-i*18*k,ww=w*.5*(1-i*.17);x.beginPath();x.moveTo(cx-ww,yy+2*k);x.quadraticCurveTo(cx-ww*.5,yy-14*k,cx,yy-20*k);x.quadraticCurveTo(cx+ww*.5,yy-14*k,cx+ww,yy+2*k);x.stroke();});
      x.lineWidth=1*k;for(var q=cx-w/2+5*k;q<cx+w/2;q+=7*k){x.beginPath();x.moveTo(q,top+6*k);x.lineTo(q,b);x.stroke();}});
    for(var wy=top+10*k;wy<b-10*k;wy+=8*k)for(var q=cx-w/2+8*k;q<cx+w/2-3*k;q+=7*k)if(L.rn()<.5)winAdd(L,q-1*k,wy,2.2*k,3.4*k,L.rn());}
  function wtc(L,cx,b,k){var x=L.x,bw=52*k,tw=30*k,h=440*k,sh=86*k,y0=b-sh,y1=b-h;x.fillStyle=ink;
    x.fillRect(cx-bw/2,y0,bw,sh);poly(x,[cx-bw/2,y0,cx-tw/2,y1,cx+tw/2,y1,cx+bw/2,y0]);x.fill();
    x.fillRect(cx-1.6*k,y1-86*k,3.2*k,86*k);x.fillRect(cx-5*k,y1-8*k,10*k,8*k);
    cut(x,function(){x.lineWidth=1.3*k;x.beginPath();x.moveTo(cx-bw/2,y0);x.lineTo(cx+tw/2,y1);x.moveTo(cx+bw/2,y0);x.lineTo(cx-tw/2,y1);x.moveTo(cx,y0);x.lineTo(cx,y1);x.stroke();
      x.lineWidth=.7*k;for(var yy=y1+6*k;yy<y0;yy+=6*k){var f=(yy-y1)/(y0-y1),ww=gcLerp(tw,bw,f)/2;x.beginPath();x.moveTo(cx-ww,yy);x.lineTo(cx+ww,yy);x.stroke();}});
    for(var wy=y1+8*k;wy<b-8*k;wy+=7*k){var ff=gcClamp((wy-y1)/(y0-y1),0,1),ww2=gcLerp(tw,bw,ff)/2;for(var q=cx-ww2+3*k;q<cx+ww2-2*k;q+=5*k)if(L.rn()<.38)winAdd(L,q-1*k,wy,2*k,3*k,L.rn());}}
  function citi(L,cx,b,k){var x=L.x,w=46*k,h=330*k,top=b-h;x.fillStyle=ink;poly(x,[cx-w/2,b,cx-w/2,top+w*.9,cx+w/2,top,cx+w/2,b]);x.fill();
    cut(x,function(){x.lineWidth=1.1*k;for(var yy=top+w+10*k;yy<b;yy+=7*k){x.beginPath();x.moveTo(cx-w/2+3*k,yy);x.lineTo(cx+w/2-3*k,yy);x.stroke();}});}
  function park432(L,cx,b,k){var x=L.x,w=23*k,h=430*k,top=b-h;x.fillStyle=ink;x.fillRect(cx-w/2,top,w,h);
    cut(x,function(){for(var yy=top+3*k;yy<b;yy+=7.6*k)for(var q=0;q<3;q++){x.fillRect(cx-w/2+2*k+q*6.8*k,yy,4.8*k,4.8*k);}});}

  /* --- layers --- */
  function buildFar(){var L=mk();L.win=[];L.rn=gcRng(11);var r=L.rn,p=Math.max(3.4,5*u),col='#7fb0d6',pf=phone?.8:1;
    for(var xx=-30;xx<W+40;){var bw=(26+r()*38)*u,fxx=xx/W,env=.2+.8*gcSmooth(.28,.62,fxx),h=(180+r()*280*env)*u*pf*(.5+.5*env);
      var top=yB-h,xr=Math.round(xx/p)*p,yr=Math.round(top/p)*p;
      dots(L.x,xr,yr,bw,yB-yr,p,p*.37,col,{fadeFrom:yB-230*u,fadeTo:yB-120*u});
      xx+=bw+(r()*10)*u;}
    return {c:L.c,win:L.win,k:.05,py:yB,dy:0};}
  function buildMid(){var L=mk();L.win=[];L.rn=gcRng(23);var r=L.rn,p=Math.max(3.6,5.6*u),pf=phone?.82:1,x=L.x;
    for(var xx=-20;xx<W+30;){var bw=(30+r()*44)*u,fxx=xx/W,env=gcSmooth(.34,.66,fxx),h=(205+r()*40+(r()*190+40)*env)*u*pf;
      if(fxx>.34||r()<.25){var top=yB-h,xr=Math.round(xx/p)*p,yr=Math.round(top/p)*p;
        var solid=r()<.3;
        if(solid){x.fillStyle=ink;x.fillRect(xr-p*.5,yr-p*.5,bw,yB-yr);cut(x,function(){for(var wy=yr+p*.4;wy<yB;wy+=p)for(var q=xr;q<xr+bw-p;q+=p){if(r()<.7)x.fillRect(q,wy,p*.42,p*.5);}});}
        else{dots(x,xr,yr,bw-p/2,yB-yr,p,p*.43,ink,{});}
        for(var wy=yr;wy<yB-190*u;wy+=p)for(var q=xr;q<xr+bw-p;q+=p)if(r()<.16)winAdd(L,q-p*.25,wy-p*.25,p*.5,p*.5,r());
        if(r()<.5)waterTank(x,xr+bw*(.3+r()*.4),yr-p*.5,u,ink);
      }
      xx+=bw+r()*14*u;}
    var k=u*pf;
    citi(L,W*.585,yB,k);empire(L,W*.665,yB,k*1.02);park432(L,W*.745,yB,k*.92);chrysler(L,W*.805,yB,k*.96);wtc(L,W*.925,yB,k*1.02);
    L.win.sort(function(a,b){return a[4]-b[4];});
    return {c:L.c,win:L.win,k:.1,py:yB,dy:0};}
  function buildDeck(){var L=mk(),x=L.x,stone='#ece4d3';
    /* suspension towers + cables on the right */
    var t1=W*.6,t2=W*.895,top=yDeck-(phone?120:142)*u;
    x.strokeStyle=ink;x.lineWidth=1.4*u;
    function cable(ax,ay,bx_,by,sag){x.beginPath();x.moveTo(ax,ay);x.quadraticCurveTo((ax+bx_)/2,(ay+by)/2+sag,bx_,by);x.stroke();
      var n=Math.floor(Math.abs(bx_-ax)/(7*u));x.save();x.lineWidth=.7*u;x.globalAlpha=.8;x.beginPath();
      for(var i=1;i<n;i++){var tt=i/n,mx=(1-tt)*(1-tt)*ax+2*(1-tt)*tt*(ax+bx_)/2+tt*tt*bx_,my=(1-tt)*(1-tt)*ay+2*(1-tt)*tt*((ay+by)/2+sag)+tt*tt*by;x.moveTo(mx,my);x.lineTo(mx,yDeck);}x.stroke();x.restore();}
    var sag=(yDeck-top)*1.7;
    cable(t1,top+6*u,t2,top+6*u,sag);
    cable(t1,top+6*u,-W*.02,yDeck-24*u,sag*.14);
    cable(t2,top+6*u,W*1.14,yDeck-20*u,sag*.2);
    /* deck */
    x.fillStyle=ink;x.fillRect(-10,yDeck,W+20,5*u);
    x.lineWidth=.9*u;x.beginPath();var bay=11*u;
    for(var q=-10;q<W+10;q+=bay){x.moveTo(q,yDeck+5*u);x.lineTo(q+bay/2,yDeck+15*u);x.lineTo(q+bay,yDeck+5*u);}x.stroke();
    x.fillRect(-10,yDeck+15*u,W+20,2.4*u);
    /* viaduct piers */
    for(var q2=W*.02;q2<W;q2+=156*u){x.fillStyle=ink;x.fillRect(q2,yDeck+16*u,8*u,240*u);}
    /* towers */
    [t1,t2].forEach(function(cx){var w=56*u,h=yDeck-top;x.fillStyle=stone;x.strokeStyle=ink;x.lineWidth=1.5*u;
      x.fillRect(cx-w/2,top,w,h+250*u);x.strokeRect(cx-w/2,top,w,h+250*u);
      x.fillStyle=ink;x.fillRect(cx-w/2-3*u,top-5*u,w+6*u,6*u);
      [-1,1].forEach(function(sd){var ax=cx+sd*w*.22,aw=w*.15,atop=top+22*u,abot=yDeck-4*u;
        x.beginPath();x.moveTo(ax-aw,abot);x.lineTo(ax-aw,atop+aw*2);x.quadraticCurveTo(ax-aw*.6,atop+aw*.5,ax,atop);x.quadraticCurveTo(ax+aw*.6,atop+aw*.5,ax+aw,atop+aw*2);x.lineTo(ax+aw,abot);x.closePath();
        x.save();x.globalCompositeOperation='destination-out';x.fill();x.restore();x.lineWidth=1.2*u;x.stroke();});
      x.strokeStyle='rgba(23,49,58,.35)';x.lineWidth=.6*u;x.beginPath();for(var yy=top+6*u;yy<top+20*u;yy+=3.4*u){x.moveTo(cx-w/2,yy);x.lineTo(cx+w/2,yy);}x.stroke();});
    return {c:L.c,win:[],k:.16,py:yB,dy:0,isDeck:true};}
  function brownstone(L,bx0,w,b,stories,col,dark){var x=L.x,r=L.rn,sh=35*u,ph=45*u,gh=20*u,cor=11*u,h=gh+ph+(stories-1)*sh+cor,top=b-h;
    x.fillStyle=col;x.fillRect(bx0,top,w,h);
    x.strokeStyle='rgba(23,49,58,.13)';x.lineWidth=.7*u;x.beginPath();for(var q=bx0+2*u;q<bx0+w;q+=3.2*u){x.moveTo(q,top+cor);x.lineTo(q,b);}x.stroke();
    /* cornice */
    x.fillStyle=ink;x.fillRect(bx0-1.5*u,top,w+3*u,4*u);x.fillStyle=dark;x.fillRect(bx0,top+4*u,w,7*u);
    x.fillStyle=ink;for(var q2=bx0+3*u;q2<bx0+w-2*u;q2+=6*u)x.fillRect(q2,top+5*u,2.6*u,5*u);
    x.strokeStyle=ink;x.lineWidth=1.1*u;x.strokeRect(bx0,top,w,h);
    var cols=w>84*u?3:2,cw=w/cols,winW=Math.min(cw*.5,16*u),glass='#cfe4ec';
    function win(cx,yy,ww,hh,arch){x.fillStyle=glass;x.fillRect(cx-ww/2,yy,ww,hh);x.strokeStyle=ink;x.lineWidth=1*u;x.strokeRect(cx-ww/2,yy,ww,hh);
      x.beginPath();x.moveTo(cx,yy);x.lineTo(cx,yy+hh);x.moveTo(cx-ww/2,yy+hh*.48);x.lineTo(cx+ww/2,yy+hh*.48);x.lineWidth=.6*u;x.stroke();
      x.lineWidth=1.5*u;x.beginPath();if(arch){x.arc(cx,yy,ww/2+1.5*u,Math.PI,0);}else{x.moveTo(cx-ww/2-2*u,yy-2.5*u);x.lineTo(cx+ww/2+2*u,yy-2.5*u);}x.stroke();
      winAdd(L,cx-ww/2+.8*u,yy+.8*u,ww-1.6*u,hh-1.6*u,r());}
    var yy=top+cor+6*u;
    for(var st=stories-1;st>=1;st--){for(var c=0;c<cols;c++){win(bx0+cw*(c+.5),yy,winW,sh-13*u,false);}yy+=sh;}
    /* parlor floor: door column plus tall windows */
    var doorCol=r()<.5?0:cols-1,py=yy;
    for(var c2=0;c2<cols;c2++){var cx=bx0+cw*(c2+.5);
      if(c2===doorCol){var dw=Math.min(cw*.58,19*u),dh=ph-9*u;x.fillStyle=ink;x.fillRect(cx-dw/2,py+1*u,dw,dh);x.lineWidth=1.8*u;x.strokeStyle=ink;x.beginPath();x.arc(cx,py+1*u,dw/2+1.5*u,Math.PI,0);x.stroke();
        winAdd(L,cx-dw/2+1.5*u,py+2*u,dw-3*u,6*u,r()*.4);
        /* stoop */
        var sy=py+dh+1*u,sb=b,sw=dw*1.22;x.fillStyle=dark;poly(x,[cx-sw/2,sy,cx+sw/2,sy,cx+sw/2+5*u,sb,cx-sw/2-5*u,sb]);x.fill();
        x.strokeStyle=ink;x.lineWidth=.8*u;x.beginPath();var steps=6;for(var i=0;i<=steps;i++){var f=i/steps,yy2=gcLerp(sy,sb,f),hw=sw/2+5*u*f;x.moveTo(cx-hw,yy2);x.lineTo(cx+hw,yy2);}x.stroke();
        x.lineWidth=1.3*u;x.beginPath();x.moveTo(cx-sw/2,sy-5*u);x.lineTo(cx-sw/2-6*u,sb-3*u);x.moveTo(cx+sw/2,sy-5*u);x.lineTo(cx+sw/2+6*u,sb-3*u);x.stroke();
      }else{win(cx,py+5*u,winW,ph-15*u,true);}
    }
    /* garden floor */
    var gy=b-gh+4*u;for(var c3=0;c3<cols;c3++){if(c3===doorCol)continue;var gx=bx0+cw*(c3+.5);x.fillStyle=ink;x.fillRect(gx-winW*.42,gy,winW*.84,gh-9*u);winAdd(L,gx-winW*.42+.8*u,gy+.8*u,winW*.84-1.6*u,gh-10.6*u,r());}
    return top;}
  function arch(L,cx,b,k){var x=L.x,w=136*k,h=118*k,top=b-h,stone='#efe7d6';
    x.fillStyle=stone;x.strokeStyle=ink;x.lineWidth=1.5*k;x.fillRect(cx-w/2,top,w,h);x.strokeRect(cx-w/2,top,w,h);
    var op=30*k,sp=b-58*k;x.beginPath();x.moveTo(cx-op,b);x.lineTo(cx-op,sp);x.arc(cx,sp,op,Math.PI,0);x.lineTo(cx+op,b);x.closePath();
    x.save();x.globalCompositeOperation='destination-out';x.fillStyle='#000';x.fill();x.restore();x.fillStyle='rgba(23,49,58,.1)';x.fill();x.stroke();
    x.lineWidth=1*k;x.strokeRect(cx-w/2-3*k,top-5*k,w+6*k,5*k);x.fillStyle=ink;x.fillRect(cx-w/2-3*k,top-5*k,w+6*k,2*k);
    /* columns */
    [-1,1].forEach(function(sd){for(var q=0;q<3;q++){var c=cx+sd*(op+7*k+q*7*k);x.beginPath();x.moveTo(c,top+18*k);x.lineTo(c,b);x.lineWidth=2*k;x.strokeStyle=ink;x.stroke();}});
    x.lineWidth=.8*k;x.beginPath();x.moveTo(cx-w/2,top+16*k);x.lineTo(cx+w/2,top+16*k);x.stroke();
    /* statue group on top: a chariot read as a dark tuft */
    x.fillStyle=ink;poly(x,[cx-13*k,top-5*k,cx-10*k,top-16*k,cx-4*k,top-19*k,cx-2*k,top-30*k,cx+2*k,top-30*k,cx+5*k,top-19*k,cx+11*k,top-15*k,cx+14*k,top-5*k]);x.fill();
    [-1,1].forEach(function(sd){var c=cx+sd*(w/2-12*k);poly(x,[c-6*k,top-5*k,c-3*k,top-14*k,c,top-20*k,c+3*k,top-14*k,c+6*k,top-5*k]);x.fill();});
  }
  function buildBrown(){var L=mk();L.win=[];L.rn=gcRng(37);var r=L.rn;var tones=[['#a9654c','#7f4936'],['#9b5a43','#6f3f2f'],['#b57458','#864f3b'],['#8f5541','#643a2b'],['#a2614f','#764536']];
    var xx=-14*u,i=0;while(xx<W+20){var w=(72+r()*26)*u,st=r()<.42?4:3,tn=tones[Math.floor(r()*tones.length)];
      var top=brownstone(L,xx,w,yB,st,tn[0],tn[1]);
      if(r()<.22)waterTank(L.x,xx+w*.5,top,u*.9,ink);
      xx+=w;i++;}
    var ax0=W*(phone?.18:.27),ak=u*(phone?.82:1);arch(L,ax0,yB+2*u,ak);L.win=L.win.filter(function(w){return !(w[0]+w[2]>ax0-72*ak&&w[0]<ax0+72*ak&&w[1]+w[3]>yB-125*ak);});
    L.win.sort(function(a,b){return a[4]-b[4];});
    return {c:L.c,win:L.win,k:.22,py:yB,dy:.015*H};}
  function buildLawn(){var L=mk(),x=L.x,r=gcRng(51),p=Math.max(4,6*u);
    /* hedge */
    var hedge=['#1f5f47','#2d7b56','#3d9462'];
    for(var c=0;c<3;c++){x.fillStyle=hedge[c];x.beginPath();for(var q=0;q<W+p;q+=p*.8){var hh=9*u+Math.sin(q*.03/u)*4*u+Math.sin(q*.11/u)*2*u;for(var yy=yLawn-hh;yy<yLawn+6*u;yy+=p*.8){if(r()<.34){var rr=p*(.2+r()*.26);var xq=q+r()*2;x.moveTo(xq+rr,yy);x.arc(xq,yy,rr,0,6.283);}}}x.fill();}
    /* lawn: halftone rows, path carved out of it */
    function pathY(q){return yLawn+(H-yLawn)*.5+Math.sin(q/W*5.2+.6)*(H-yLawn)*.22;}
    x.fillStyle='#2f7f58';x.fillRect(-2,yLawn+2*u,W+4,H-yLawn);
    var tones=['#3f9463','#5aaa6c','#7fc279'],row=0;
    for(var yy2=yLawn+4*u;yy2<H+p;yy2+=p*.92){var off=row%2?p/2:0;row++;
      for(var q2=off;q2<W+p;q2+=p){var py=pathY(q2),band=Math.abs(yy2-py)-(9*u+6*u*(yy2-yLawn)/(H-yLawn));
        if(band<0){continue;}
        var n=Math.sin(q2*.017/u+yy2*.03/u)+Math.sin(q2*.005/u-yy2*.07/u),tn=gcClamp(Math.floor((n+2)/4*3+r()*.8-.3),0,2);
        x.fillStyle=tones[tn];x.beginPath();x.arc(q2,yy2,p*(.22+r()*.2),0,6.283);x.fill();}}
    /* path */
    x.beginPath();var first=true;for(var q3=-4;q3<W+8;q3+=8){var pu=pathY(q3)-(9*u+6*u*(pathY(q3)-yLawn)/(H-yLawn));if(first){x.moveTo(q3,pu);first=false;}else x.lineTo(q3,pu);}
    for(var q4=W+8;q4>-8;q4-=8){var pl=pathY(q4)+(9*u+6*u*(pathY(q4)-yLawn)/(H-yLawn));x.lineTo(q4,pl);}x.closePath();x.fillStyle='#ecdfc5';x.fill();
    /* bishop's crook lamps */
    lamps=[];[.235,.5,.735].forEach(function(f){if(phone&&f===.5)return;var cx=W*f,bb=pathY(cx)-14*u,hh=(phone?78:96)*u;x.strokeStyle=ink;x.fillStyle=ink;x.lineWidth=2.6*u;
      x.beginPath();x.moveTo(cx,bb);x.lineTo(cx,bb-hh);x.arc(cx+9*u,bb-hh,9*u,Math.PI,Math.PI*1.95);x.stroke();
      x.fillRect(cx-2.5*u,bb-16*u,5*u,16*u);
      var lx=cx+18*u,ly=bb-hh+4*u;x.beginPath();x.moveTo(lx-5*u,ly);x.lineTo(lx+5*u,ly);x.lineTo(lx+3*u,ly+9*u);x.lineTo(lx-3*u,ly+9*u);x.closePath();x.fillStyle='#fff5da';x.fill();x.lineWidth=1.2*u;x.stroke();
      lamps.push({x:lx,y:ly+5*u});});
    return {c:L.c,win:[],k:.4,py:H,dy:0,pathY:pathY,isLawn:true};}

  /* --- trees --- */
  function makeTree(seed,x,y,R,th,kd,set){var r=gcRng(seed),blobs=[],n=7+Math.floor(r()*4);
    for(var i=0;i<n;i++){var a=r()*6.283,dd=R*(.25+r()*.55),br=R*(.38+r()*.34);blobs.push([Math.cos(a)*dd*1.12,Math.sin(a)*dd*.82,br]);}
    blobs.push([0,0,R*.62]);
    var p=Math.max(3.8,5.2*u),rowp=p*.98,buck=[[],[],[],[]],row=0;
    for(var yy=-R*1.3;yy<R*1.2;yy+=rowp){var off=row%2?p/2:0;row++;for(var xx=-R*1.4+off;xx<R*1.4;xx+=p){
      var best=1e9,bi=-1;for(var b=0;b<blobs.length;b++){var bb=blobs[b],qq=Math.hypot(xx-bb[0],yy-bb[1])/bb[2];if(qq<best){best=qq;bi=b;}}
      if(best>1)continue;var bb2=blobs[bi],nx=(xx-bb2[0])/bb2[2],ny=(yy-bb2[1])/bb2[2];
      var edge=gcSmooth(.78,1,best);if(r()<edge*.62)continue;
      var light=(nx*.5-ny*.8)*.62+(-yy/R)*.32+(r()-.5)*.34;light=gcClamp((light+.7)/1.4,0,1);
      var tone=light<.3?0:light<.55?1:light<.8?2:3;
      var rad=p*(.54-.22*light)*(1-edge*.35);
      buck[tone].push(xx,yy,rad,r()*6.283);}}
    var d=[];for(var tn=0;tn<4;tn++){d.push(new Float32Array(buck[tn]));}
    return {x:x,y:y,R:R,th:th,kd:kd,set:set,cy:-th,dots:d,blobs:blobs,lean:(r()-.5)*.12,br:[[.5,-.5,.7],[.62,.55,.55],[.8,-.3,.4]].map(function(q){return [q[0]*th,q[1]*R*.6,q[2]];})};}
  function copyBottom(){var e=root.querySelector('.hero .fine')||root.querySelector('.hero .done');return e?e.getBoundingClientRect().bottom-root.getBoundingClientRect().top:H*.5;}
  function buildTrees(){trees=[];var S=season==='summer'?0:season==='peak fall'?.72:.2,rn=gcRng(77);
    function set(){return rn()<S?'amber':'green';}
    var base=H-22*u,row=yLawn+6*u;
    var back=phone?[[.42,44],[.72,52]]:[[.385,52],[.47,44],[.62,62],[.70,44],[.79,56],[.565,40]];
    back.forEach(function(b,i){trees.push(makeTree(100+i,W*b[0],row+((i%3)*4)*u,b[1]*u,(58+b[1]*.5)*u,.22,set()));});
    var room=base-copyBottom()-14,fit=function(R0,th0){return phone?1:Math.min(1,room/(th0+R0*1.5));};
    var f1=fit(96*u,120*u),f3=fit(128*u,170*u);
    trees.push(makeTree(201,W*(phone?.04:.13),base-20*u,(phone?78:96*f1)*u,(phone?92:120*f1)*u,.34,'green'));
    trees.push(makeTree(202,W*(phone?.97:.875),base-14*u,(phone?84:116)*u,(phone?98:150)*u,.34,set()));
    if(!phone){trees.push(makeTree(203,W*.012,base+8*u,128*u*f3,170*u*f3,.42,'green'));trees.push(makeTree(204,W*.995,base+10*u,146*u,215*u,.42,set()));}
    if(trees[trees.length-1].set==='green'&&S>0){trees[phone?0:2].set='amber';}
    trees.forEach(function(tr){tr.cy=-tr.th-tr.R*.45;});
  }

  /* --- sprites --- */
  function buildSprites(){
    /* train */
    var carW=84*u,carH=24*u,cars=4,gapc=3*u;trainLen=cars*(carW+gapc);var c=document.createElement('canvas');c.width=Math.ceil(trainLen*D);c.height=Math.ceil((carH+8*u)*D);var x=c.getContext('2d');x.scale(D,D);
    for(var i=0;i<cars;i++){var X=i*(carW+gapc);x.fillStyle='#f4f8f7';x.strokeStyle=ink;x.lineWidth=1.3*u;x.beginPath();x.roundRect?x.roundRect(X+.6,.6,carW-1.2,carH,3.5*u):x.rect(X+.6,.6,carW-1.2,carH);x.fill();x.stroke();
      x.fillStyle='#6fb23f';x.fillRect(X+1,carH*.62,carW-2,3*u);
      x.fillStyle=ink;for(var w=0;w<6;w++){var wx=X+6*u+w*12.4*u;if(w===2||w===3){x.fillRect(wx,4*u,8*u,carH-7*u);}else{x.fillRect(wx,4.5*u,8*u,8*u);}}
      x.fillRect(X+10*u,carH+.6,12*u,3*u);x.fillRect(X+carW-22*u,carH+.6,12*u,3*u);}
    trainSprite=c;
    /* warm glow */
    glow=document.createElement('canvas');glow.width=glow.height=128;var g=glow.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,214,140,.95)');gr.addColorStop(.25,'rgba(255,190,110,.42)');gr.addColorStop(1,'rgba(255,170,90,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
    /* sun halo as dots */
    var R=(phone?78:118)*u,span=R*2.1,hc=document.createElement('canvas');hc.width=hc.height=Math.ceil(span*2*D);var h=hc.getContext('2d');h.scale(D,D);var pit=Math.max(5,8.5*u);h.fillStyle='#fbc65c';h.beginPath();
    for(var yy=pit/2;yy<span*2;yy+=pit)for(var xx=pit/2;xx<span*2;xx+=pit){var dd=Math.hypot(xx-span,yy-span);if(dd<R||dd>span)continue;var f=1-(dd-R)/(span-R);var rr=pit*.5*f*f;if(rr<.35)continue;h.moveTo(xx+rr,yy);h.arc(xx,yy,rr,0,6.283);}h.fill();
    sunHalo={c:hc,span:span,R:R};
    /* clouds */
    clouds=[];var r=gcRng(91);[[.58,.09,150],[.92,.2,120],[.22,.05,110],[.72,.31,84]].forEach(function(cl,i){var cw=cl[2]*u*2.2,ch=cl[2]*u*.72,cv=document.createElement('canvas');cv.width=Math.ceil(cw*D);cv.height=Math.ceil(ch*D);var q=cv.getContext('2d');q.scale(D,D);var pp=Math.max(4,6.2*u),blobs=[];for(var b=0;b<6;b++)blobs.push([cw*(.18+r()*.64),ch*(.45+r()*.3),ch*(.2+r()*.26)]);
      q.fillStyle='#fff';q.beginPath();var q2=[];for(var yy=pp/2;yy<ch;yy+=pp*.92){for(var xx=pp/2;xx<cw;xx+=pp){var best=9;for(var bb=0;bb<blobs.length;bb++){best=Math.min(best,Math.hypot(xx-blobs[bb][0],yy-blobs[bb][1])/blobs[bb][2]);}if(best<1.05){var rd=pp*.5*(1-best*.72);q.moveTo(xx+rd,yy);q.arc(xx,yy,rd,0,6.283);}}}q.fill();
      clouds.push({c:cv,w:cw,h:ch,x:cl[0]*W,y:cl[1]*H,v:(3+i*1.4)*u});});
    /* stars */
    stars=[];for(var si=0;si<(phone?90:190);si++){stars.push([r()*W,r()*H*.66,.5+r()*1.1,r()*6.283]);}
    /* string lights */
    bulbs=[];var ax=-.02*W,ay=H*.60,mx=W*.52,my=H*.72,bx_=W*1.02,by=H*.58;for(var b2=0;b2<(phone?26:46);b2++){var tt=b2/((phone?26:46)-1);var px=(1-tt)*(1-tt)*ax+2*(1-tt)*tt*mx+tt*tt*bx_,py=(1-tt)*(1-tt)*ay+2*(1-tt)*tt*my*1.05+tt*tt*by;bulbs.push([px,py,r(),r()*6.283]);}
  }

  /* --- build everything --- */
  function build(){
    W=stage.clientWidth||innerWidth;H=stage.clientHeight||innerHeight;
    D=lowRes?1:Math.min(window.devicePixelRatio||1,W>1800?1.5:2);
    phone=W<760;
    u=phone?gcClamp(W/640,.56,.72):Math.min(gcClamp(W/1440,.72,1.3),gcClamp(H/880,.72,1.3));
    yLawn=H-(phone?165:100)*u;yB=yLawn+10*u;yDeck=yB-(phone?196:205)*u;
    [bg,fg].forEach(function(c){c.width=Math.ceil(W*D);c.height=Math.ceil(H*D);});
    layers=[buildFar(),buildMid(),buildDeck(),buildBrown(),buildLawn()];
    buildTrees();buildSprites();measure();dirty=true;
  }

  /* --- scroll map --- */
  function top(el){var r=root.getBoundingClientRect(),e=el.getBoundingClientRect();return e.top-r.top;}
  function measure(){var total=root.scrollHeight-H,tv=travel?top(travel)+travel.offsetHeight-H*.2:H;
    var g1=root.querySelector('[data-gap1]'),bd=root.querySelector('[data-board]'),g2=root.querySelector('[data-gap2]'),cl=root.querySelector('[data-closing]');
    var y1=top(g1)+g1.offsetHeight/2-H/2,y2=top(bd)+bd.offsetHeight/2-H/2,y3=top(g2)+g2.offsetHeight/2-H/2,y4=top(cl)-H*.3;
    anchors=[[0,0],[tv,.3],[y1,.48],[y2,.6],[y3,.76],[y4,.92],[Math.max(total,y4+1),1]];
    dTrav=[H*.25,tv];}
  var dTrav=[0,1];
  function readScroll(){var y=-root.getBoundingClientRect().top;scrollY=y;var v=0;for(var i=1;i<anchors.length;i++){if(y<=anchors[i][0]){var a=anchors[i-1],b=anchors[i],q=gcClamp((y-a[0])/Math.max(1,b[0]-a[0]),0,1);v=gcLerp(a[1],b[1],q);break;}v=anchors[i][1];}
    sT=v;dT=gcSmooth(dTrav[0],dTrav[1],y);
    if(reduce){s=sT;d=dT;}
    if(cue)cue.style.opacity=y>30?0:1;
    if(cap&&travel){var ta=top(travel)-H*.5,tb=top(travel)+travel.offsetHeight-H*.72,o=gcSmooth(ta,ta+H*.26,y)*(1-gcSmooth(tb-H*.2,tb,y));cap.style.opacity=o;}
    if(strip){var rc=strip.getBoundingClientRect();strip.style.setProperty('--p',gcClamp((H*.82-rc.top)/(rc.height+H*.42),0,1).toFixed(4));}
    covered=false;var panels=root.querySelectorAll('.panel');for(var pi=0;pi<panels.length;pi++){var pr=panels[pi].getBoundingClientRect();if(pr.top<=-30&&pr.bottom>=H+30){covered=true;}}
    dirty=true;}

  /* --- render --- */
  function drawBg(){var low=gcKeys(GC_SKY_LOW,s),hi=gcKeys(GC_SKY_TOP,s);bx.setTransform(D,0,0,D,0,0);
    var g=bx.createLinearGradient(0,0,0,yB);g.addColorStop(0,gcCss(hi));g.addColorStop(1,gcCss(low));bx.fillStyle=g;bx.fillRect(0,0,W,H);
    var night=gcSmooth(.74,.94,s);
    if(night>0){bx.fillStyle='#fff';bx.beginPath();for(var i=0;i<stars.length;i++){var st=stars[i],a=reduce?1:(.7+.3*Math.sin(t*1.3+st[3]));if(i%3===0)continue;bx.moveTo(st[0]+st[2],st[1]);bx.arc(st[0],st[1],st[2],0,6.283);}bx.globalAlpha=night*.8;bx.fill();
      bx.beginPath();for(var j=0;j<stars.length;j+=3){var sj=stars[j],aj=reduce?1:(.5+.5*Math.sin(t*1.7+sj[3]));bx.globalAlpha=night*aj;bx.fillStyle='#fff';bx.beginPath();bx.arc(sj[0],sj[1],sj[2],0,6.283);bx.fill();}bx.globalAlpha=1;
      /* moon */
      var mx=W*(phone?.82:.88),my=H*(phone?.09:.14),mr=(phone?26:40)*u;bx.globalAlpha=night;bx.fillStyle='#f7efd6';bx.beginPath();bx.arc(mx,my,mr,0,6.283);bx.fill();
      bx.fillStyle=gcCss(gcKeys(GC_SKY_TOP,s));bx.beginPath();bx.arc(mx-mr*.42,my-mr*.12,mr*.86,0,6.283);bx.fill();bx.globalAlpha=1;}
    /* sun */
    var sunA=1-gcSmooth(.8,.88,s),R=sunHalo.R*(1+gcSmooth(.3,.8,s)*.1);
    if(sunA>0){var sx=W*gcLerp(phone?.74:.75,phone?.6:.68,gcSmooth(0,.84,s)),y0=H>W?Math.min(copyBottom()+sunHalo.R*1.05,yB-120*u):H*.25,sy=gcLerp(y0,yB-30*u,Math.pow(gcSmooth(0,.84,s),1.35));
      bx.globalAlpha=sunA;bx.drawImage(sunHalo.c,sx-sunHalo.span,sy-sunHalo.span,sunHalo.span*2,sunHalo.span*2);
      bx.fillStyle=gcCss(gcKeys(GC_SUN,s));bx.beginPath();bx.arc(sx,sy,R,0,6.283);bx.fill();bx.globalAlpha=1;}
    /* clouds */
    var ca=gcLerp(.92,.22,gcSmooth(.55,.95,s));bx.globalAlpha=ca;
    for(var c=0;c<clouds.length;c++){var cl=clouds[c],cxx=((cl.x+t*cl.v+cl.w)%(W+cl.w*2))-cl.w;bx.drawImage(cl.c,cxx,cl.y,cl.w,cl.h);}
    bx.globalAlpha=1;
    /* birds in the warm part of the day */
    var ba=gcSmooth(.25,.4,s)*(1-gcSmooth(.7,.82,s));if(ba>0){bx.strokeStyle=gcCss([23,49,58],ba);bx.lineWidth=1.6*u;bx.beginPath();for(var bi=0;bi<7;bi++){var bxx=((W*.35+bi*46*u+t*14*u+((bi*37)%60)*u)%(W+200))-100,byy=H*.2+((bi*53)%90)*u+Math.sin(t*.7+bi)*5*u,fl=(4+2.4*Math.sin(t*5+bi*1.7))*u;bx.moveTo(bxx-8*u,byy-fl*.3);bx.quadraticCurveTo(bxx-3*u,byy-fl,bxx,byy);bx.quadraticCurveTo(bxx+3*u,byy-fl,bxx+8*u,byy-fl*.3);}bx.stroke();}
  }
  function tint(){var tn=gcKeys(GC_TINT,s);if(tn[3]<=.002)return;fx.setTransform(1,0,0,1,0,0);fx.globalCompositeOperation='source-atop';fx.fillStyle=gcCss(tn,tn[3]);fx.fillRect(0,0,fg.width,fg.height);fx.globalCompositeOperation='source-over';}
  function layerXf(L){var k=1+L.k*d,px=W*.5,py=L.py;fx.setTransform(D*k,0,0,D*k,D*(px-px*k),D*(py-py*k+L.dy*d));}
  function drawWindows(L,frac,col){if(!L.win.length||frac<=0)return;fx.fillStyle=col;fx.beginPath();for(var i=0;i<L.win.length;i++){var w=L.win[i];if(w[4]>frac)break;fx.rect(w[0],w[1],w[2],w[3]);}fx.fill();}
  function drawTrain(L){var pos=((t*62*u+scrollY*.55)%(W+trainLen*1.6))-trainLen*1.1;fx.drawImage(trainSprite,pos,yDeck-27*u,trainLen,trainSprite.height/D);
    var night=gcSmooth(.66,.88,s);if(night>0){fx.fillStyle=gcCss([255,214,140],night);var carW=84*u,gapc=3*u;fx.beginPath();for(var i=0;i<4;i++){var X=pos+i*(carW+gapc);for(var w=0;w<6;w++){var wx=X+6*u+w*12.4*u;fx.rect(wx+.5*u,yDeck-27*u+5*u,7*u,7*u);}}fx.fill();}}
  function drawTree(tr,tones){var k=1+tr.kd*d,cx=W*.5,py=H,ox=cx+(tr.x-cx)*k,oy=py+(tr.y-py)*k;
    var trunk=gcCss(gcKeys(GC_TONES.green[0],s).map(function(v,i){return i<3?v*.55:v;}));
    fx.setTransform(D,0,0,D,0,0);fx.strokeStyle=trunk;fx.lineCap='round';
    var th=tr.th*k;fx.lineWidth=Math.max(2,tr.R*.1)*k;fx.beginPath();fx.moveTo(ox,oy);fx.lineTo(ox+tr.lean*th,oy-th-tr.R*.3*k);fx.stroke();
    fx.lineWidth=Math.max(1.2,tr.R*.05)*k;fx.beginPath();for(var b=0;b<tr.br.length;b++){var q=tr.br[b];fx.moveTo(ox+tr.lean*q[0]*k,oy-q[0]*k);fx.lineTo(ox+q[1]*k,oy-q[0]*k-tr.R*q[2]*.7*k);}fx.stroke();
    var cyy=oy+tr.cy*k,time=reduce?0:t,ptrOn=ptr.e>.01&&!reduce,R2=(90*u)*(90*u);
    var wb=Math.sin(time*.9+tr.x*.003)*1.2*u;fx.fillStyle=tones[tr.set][0];fx.beginPath();for(var bl=0;bl<tr.blobs.length;bl++){var B0=tr.blobs[bl],bx1=ox+(B0[0]+wb)*k,by1=cyy+B0[1]*k,br1=B0[2]*.84*k;fx.moveTo(bx1+br1,by1);fx.arc(bx1,by1,br1,0,6.283);}fx.fill();
    for(var tn=0;tn<4;tn++){var a=tr.dots[tn],n=a.length;if(!n)continue;fx.fillStyle=tones[tr.set][tn];fx.beginPath();
      for(var i=0;i<n;i+=4){var dx=a[i],dy=a[i+1],rr=a[i+2],ph=a[i+3];
        var hf=(tr.R-dy)/(tr.R*2),w=Math.sin(time*.9+dx*.012/u+tr.x*.003)*2.4*u*hf+Math.sin(time*2.3+ph)*.55*u;
        var xx=ox+(dx+w)*k,yy=cyy+(dy+w*.25)*k;
        if(ptrOn){var ex=xx-ptr.sx,ey=yy-ptr.sy,e2=ex*ex+ey*ey;if(e2<R2){var f=(1-Math.sqrt(e2/R2));f=f*f*ptr.e*11*u;var l=Math.sqrt(e2)||1;xx+=ex/l*f+Math.sin(ph+time*14)*f*.3;yy+=ey/l*f;}}
        var rd=rr*k;fx.moveTo(xx+rd,yy);fx.arc(xx,yy,rd,0,6.283);}
      fx.fill();}
  }
  function spawnLeaves(){if(reduce||particles.length>70)return;for(var i=0;i<trees.length;i++){var tr=trees[i],k=1+tr.kd*d,cx=W*.5,ox=cx+(tr.x-cx)*k,oy=H+(tr.y-H)*k+tr.cy*k;if(Math.hypot(ptr.sx-ox,ptr.sy-oy)<tr.R*k){var tones=gcKeys(GC_TONES[tr.set][2],s);particles.push({x:ptr.sx+(Math.random()-.5)*50*u,y:ptr.sy+(Math.random()-.5)*30*u,v:(14+Math.random()*22)*u,ph:Math.random()*6,r:(1.4+Math.random()*1.8)*u,c:tones,g:H-10*u-Math.random()*50*u});break;}}}
  function drawParticles(dt){fx.setTransform(D,0,0,D,0,0);for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.y+=p.v*dt;p.ph+=dt*2.2;var xx=p.x+Math.sin(p.ph)*11*u;fx.fillStyle=gcCss(p.c);fx.beginPath();fx.ellipse?fx.ellipse(xx,p.y,p.r*1.4,p.r*.8,p.ph,0,6.283):fx.arc(xx,p.y,p.r,0,6.283);fx.fill();if(p.y>p.g)particles.splice(i,1);}}
  function drawRunners(){var a=1-gcSmooth(.2,.34,s);if(a<=0)return;var L=layers[4],k=1+L.k*d,col=gcCss([23,49,58],a);fx.setTransform(D,0,0,D,0,0);fx.strokeStyle=col;fx.fillStyle=col;fx.lineCap='round';
    for(var i=0;i<5;i++){var q=((t*38*u+i*34*u+(i%2)*8*u)%(W+160*u))-80*u,yy=L.pathY(q)+(i%2?3:-3)*u,sc=u*1.05,sw=Math.sin(t*9+i*1.4);
      var bx0=W*.5+(q-W*.5)*k,by0=H+(yy-H)*k;fx.lineWidth=2.1*sc;fx.beginPath();
      fx.moveTo(bx0+1*sc,by0-13*sc);fx.lineTo(bx0,by0-5*sc);
      fx.moveTo(bx0,by0-5*sc);fx.lineTo(bx0+sw*4.4*sc,by0);
      fx.moveTo(bx0,by0-5*sc);fx.lineTo(bx0-sw*4.4*sc,by0);
      fx.moveTo(bx0+1*sc,by0-11*sc);fx.lineTo(bx0+1*sc-sw*3.4*sc,by0-7.5*sc);
      fx.moveTo(bx0+1*sc,by0-11*sc);fx.lineTo(bx0+1*sc+sw*3.4*sc,by0-7.5*sc);
      fx.stroke();fx.beginPath();fx.arc(bx0+1.6*sc,by0-16*sc,2.5*sc,0,6.283);fx.fill();}}
  function drawGlow(x,y,r,a){fx.globalAlpha=a;fx.drawImage(glow,x-r,y-r,r*2,r*2);fx.globalAlpha=1;}
  function drawNight(){var n=gcSmooth(.72,.9,s);fx.setTransform(D,0,0,D,0,0);
    /* lamps */
    if(n>0){var L=layers[4],k=1+L.k*d;fx.globalCompositeOperation='lighter';lamps.forEach(function(l,i){var lx=W*.5+(l.x-W*.5)*k,ly=H+(l.y-H)*k;drawGlow(lx,ly,(60+((i*7)%14))*u,n*.85);});fx.globalCompositeOperation='source-over';}
    /* the table under the string lights */
    var m=gcSmooth(.9,.99,s);if(m<=0)return;
    fx.globalCompositeOperation='lighter';
    var tcx=W*(phone?.5:.63),tw=Math.min(W*(phone?.86:.5),(phone?560:640)*u),ty=H-(phone?152:112)*u;
    fx.globalAlpha=m*.7;fx.drawImage(glow,tcx-tw*.85,ty-tw*.42,tw*1.7,tw*.8);fx.globalAlpha=1;
    for(var b=0;b<bulbs.length;b++){var B=bulbs[b],on=gcSmooth(B[2]*.75,B[2]*.75+.25,m);if(on<=0)continue;var tw2=reduce?1:(.82+.18*Math.sin(t*2.1+B[3]));drawGlow(B[0],B[1],13*u+7*u*tw2,on*tw2*.75);}
    fx.globalCompositeOperation='source-over';
    /* wire + bulbs */
    fx.strokeStyle=gcCss([8,20,28],m);fx.lineWidth=1.4*u;fx.beginPath();for(var w=0;w<bulbs.length;w++){var q=bulbs[w];if(w===0)fx.moveTo(q[0],q[1]-3*u);else fx.lineTo(q[0],q[1]-3*u);}fx.stroke();
    fx.fillStyle=gcCss([255,233,180],m);fx.beginPath();for(var b3=0;b3<bulbs.length;b3++){var Q=bulbs[b3];if(gcSmooth(Q[2]*.75,Q[2]*.75+.25,m)<=.5)continue;var rr=2.6*u;fx.moveTo(Q[0]+rr,Q[1]);fx.arc(Q[0],Q[1],rr,0,6.283);}fx.fill();
    /* table */
    fx.globalAlpha=m;var x0=tcx-tw/2,dark='#0a1b24',warmc='#ffdf9e',people=phone?7:11,sp=tw/(people+1);
    fx.fillStyle=dark;
    for(var pi=1;pi<=people;pi++){var px=x0+sp*pi,hh=(pi%2?1:1.06)*(24*u),hr=7.4*u;
      fx.beginPath();fx.moveTo(px-11*u,ty);fx.quadraticCurveTo(px-11*u,ty-hh,px,ty-hh);fx.quadraticCurveTo(px+11*u,ty-hh,px+11*u,ty);fx.closePath();fx.fill();
      fx.beginPath();fx.arc(px,ty-hh-hr+1*u,hr,0,6.283);fx.fill();
      fx.strokeStyle=warmc;fx.lineWidth=.9*u;fx.beginPath();fx.arc(px,ty-hh-hr+1*u,hr,-.9,.9);fx.stroke();}
    fx.fillStyle='#f6ead0';fx.fillRect(x0-14*u,ty,tw+28*u,6*u);
    fx.fillStyle=dark;fx.fillRect(x0-14*u,ty+6*u,tw+28*u,3*u);fx.fillRect(x0+6*u,ty+9*u,4*u,22*u);fx.fillRect(x0+tw-10*u,ty+9*u,4*u,22*u);
    for(var ci=0;ci<(phone?3:5);ci++){var cxx=x0+tw*(ci+.5)/(phone?3:5);fx.fillStyle='#f6ead0';fx.fillRect(cxx-1*u,ty-9*u,2*u,9*u);fx.fillStyle='#ffc765';fx.beginPath();fx.ellipse?fx.ellipse(cxx,ty-12*u,1.8*u,3*u,0,0,6.283):fx.arc(cxx,ty-12*u,2*u,0,6.283);fx.fill();}
    fx.globalAlpha=1;
  }
  function render(dt){
    drawBg();
    fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,fg.width,fg.height);
    var warmth=gcSmooth(.62,.92,s);
    for(var i=0;i<layers.length;i++){var L=layers[i];layerXf(L);fx.drawImage(L.c,0,0,W,H);
      if(L.isDeck)drawTrain(L);
      if(i===1)drawWindows(L,warmth*.42,'#ffcf86');
      if(i===3)drawWindows(L,warmth*.86,'#ffd690');
      tint();
    }
    /* pool night at the ground so the lawn and street sink into the dark */
    var ng=gcSmooth(.6,.95,s);if(ng>0){fx.setTransform(D,0,0,D,0,0);fx.globalCompositeOperation='source-atop';var gg=fx.createLinearGradient(0,yB-120*u,0,H);gg.addColorStop(0,'rgba(10,30,44,0)');gg.addColorStop(1,'rgba(10,30,44,'+(ng*.78)+')');fx.fillStyle=gg;fx.fillRect(0,0,W,H);fx.globalCompositeOperation='source-over';}
    drawRunners();
    var tones={green:[],amber:[]};['green','amber'].forEach(function(k){for(var q=0;q<4;q++)tones[k][q]=gcCss(gcKeys(GC_TONES[k][q],s));});
    for(var ti=0;ti<trees.length;ti++)drawTree(trees[ti],tones);
    drawParticles(dt);
    drawNight();
  }
  var perfN=0,perfT=0,lowRes=false;
  function frame(now){if(!alive)return;raf=requestAnimationFrame(frame);var raw=(now-last)/1000||0,dt=Math.min(.05,raw);last=now;
    if(!lowRes&&D>1&&!covered&&raw<.25){perfT+=raw;perfN++;if(perfN>=90){if(perfT/perfN>.032){lowRes=true;build();readScroll();}perfN=0;perfT=0;}}
    var moving=Math.abs(sT-s)>.0004||Math.abs(dT-d)>.0004;
    if(reduce&&!dirty)return;
    if(covered&&!moving&&!dirty)return;
    if(!reduce)t+=dt;
    s+=(sT-s)*Math.min(1,dt*7);d+=(dT-d)*Math.min(1,dt*7);
    ptr.sx+=(ptr.x-ptr.sx)*Math.min(1,dt*10);ptr.sy+=(ptr.y-ptr.sy)*Math.min(1,dt*10);ptr.e*=Math.pow(.2,dt);
    if(covered){dirty=false;return;}
    render(dt);dirty=false;}
  function onMove(e){var r=stage.getBoundingClientRect(),nx=e.clientX-r.left,ny=e.clientY-r.top,sp=Math.hypot(nx-ptr.x,ny-ptr.y);if(ptr.x<-900){ptr.sx=nx;ptr.sy=ny;}ptr.x=nx;ptr.y=ny;ptr.e=Math.min(1,ptr.e+sp*.012);if(sp>6&&Math.random()<.35)spawnLeaves();}
  var rz=0;function onResize(){clearTimeout(rz);rz=setTimeout(function(){build();readScroll();s=sT;d=dT;},140);}
  window.addEventListener('scroll',readScroll,{capture:true,passive:true});
  window.addEventListener('resize',onResize);
  window.addEventListener('pointermove',onMove,{passive:true});
  var ro=window.ResizeObserver?new ResizeObserver(function(){measure();readScroll();}):null;if(ro)ro.observe(root);

  build();readScroll();s=sT;d=dT;raf=requestAnimationFrame(frame);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(alive){measure();readScroll();}});
  this.setSeason=function(v){if(v!==season){season=v;buildTrees();dirty=true;}};
  this.destroy=function(){alive=false;cancelAnimationFrame(raf);window.removeEventListener('scroll',readScroll,{capture:true});window.removeEventListener('resize',onResize);window.removeEventListener('pointermove',onMove);if(ro)ro.disconnect();};
}


const root = document.querySelector('[data-homepage-scene]');
if (root) {
  const scene = new GCScene(root, { season: 'early fall' });
  document.addEventListener('astro:before-swap', () => scene.destroy(), { once: true });
}
