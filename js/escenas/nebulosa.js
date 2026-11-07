/* ============================================================
   La nebulosa de Anesthios (three.js)
   Menú de inicio: gas de colores, polvo cósmico y estrellas.
   formar(asistente): el polvo fluye y dibuja al asistente
   mientras el gas se condensa. disolver(asistente): el asistente
   se deshace en polvo que vuelve a ser la nebulosa.
   «La materia no se crea ni se destruye, solo se transforma.»
   ============================================================ */
import * as THREE from 'three';
import {FORMAS} from './transicion.js';

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const suave=x=>x*x*(3-2*x),lim=x=>Math.max(0,Math.min(1,x));

/* ---------- Texturas ---------- */
function texturaPunto(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#fff');gr.addColorStop(0.22,'rgba(255,255,255,.75)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function texturaEstrella(){                 // estrella con destellos en cruz
  const N=128,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0,64,64,20);gr.addColorStop(0,'#fff');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,N,N);
  for(const [w,h,a] of [[N,3,0.9],[3,N,0.9],[N*0.55,1.5,0.5],[1.5,N*0.55,0.5]]){
    const l=g.createLinearGradient(64-w/2,64-h/2,64+w/2,64+h/2);
    g.save();g.translate(64,64);if(a<0.9)g.rotate(Math.PI/4);g.globalAlpha=a;
    const lg=w>h?g.createLinearGradient(-w/2,0,w/2,0):g.createLinearGradient(0,-h/2,0,h/2);
    lg.addColorStop(0,'rgba(255,255,255,0)');lg.addColorStop(0.5,'#fff');lg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=lg;g.fillRect(-w/2,-h/2,w,h);g.restore();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
/* Nube de gas: ruido fractal con bordes suaves */
function texturaNube(seed){
  const N=128,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),rand=rng(seed);
  const G=9,red=[];for(let i=0;i<G*G*4;i++)red.push(rand());
  const ruido=(x,y,f,o)=>{x*=f;y*=f;const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,s=t=>t*t*(3-2*t);
    const v=(i,j)=>red[((i%G+G)%G+((j%G+G)%G)*G+o)%red.length];
    const a=v(xi,yi),b=v(xi+1,yi),cc=v(xi,yi+1),d=v(xi+1,yi+1);return a+(b-a)*s(xf)+(cc-a)*s(yf)+(a-b-cc+d)*s(xf)*s(yf);};
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const u=x/N,v=y/N,n=ruido(u,v,3,0)*0.55+ruido(u,v,6,17)*0.28+ruido(u,v,12,41)*0.17;
    const r=Math.hypot(u-0.5,v-0.5)*2,borde=Math.max(0,1-r*r);
    const a=Math.max(0,(n-0.32)*1.7)*borde,i=(y*N+x)*4;
    img.data[i]=img.data[i+1]=img.data[i+2]=255;img.data[i+3]=Math.min(255,a*255);
  }
  g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

/* ---------- Paleta de la nebulosa ---------- */
const PALETA=['#3fd0c8','#4aa3ff','#7b6cff','#c060ff','#ff5a9a','#ff8a50','#c8602a','#f6e7ff'].map(c=>new THREE.Color(c));

export function crearNebulosa(contenedor,N=2600){
  const rand=rng(2026);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
  renderer.domElement.className='nebulosa';contenedor.append(renderer.domElement);
  const escena=new THREE.Scene(),camara=new THREE.PerspectiveCamera(42,1,0.1,60);
  const mundo=new THREE.Group();escena.add(mundo);
  const tPunto=texturaPunto(),tEstrella=texturaEstrella(),tNubes=[1,2,3,4].map(texturaNube);

  /* Estrellas de fondo (fijas) */
  {const n=900,p=new Float32Array(n*3),c=new Float32Array(n*3);
   for(let i=0;i<n;i++){p[i*3]=(rand()-.5)*30;p[i*3+1]=(rand()-.5)*30;p[i*3+2]=-8-rand()*6;
     const col=PALETA[[0,1,7,7,7,5][Math.floor(rand()*6)]],k=0.4+rand()*0.6;c[i*3]=col.r*k;c[i*3+1]=col.g*k;c[i*3+2]=col.b*k;}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
   escena.add(new THREE.Points(g,new THREE.PointsMaterial({size:0.06,map:tPunto,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})));
   for(let i=0;i<16;i++){const m=new THREE.SpriteMaterial({map:tEstrella,color:PALETA[[0,1,5,7][i%4]],transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.8});
     const s=new THREE.Sprite(m);s.position.set((rand()-.5)*14,(rand()-.5)*20,-6-rand()*3);s.scale.setScalar(0.4+rand()*0.6);escena.add(s);}}

  /* Forma de la nebulosa: dos lóbulos (mariposa) + una cresta + un núcleo */
  function puntoNebulosa(){
    const k=rand(),p=new THREE.Vector3();let ci;
    if(k<0.55){                                             // lóbulos
      const t=(rand()<0.5?-1:1)*Math.pow(rand(),0.7)*2.1,abre=0.15+Math.abs(t)*0.55;
      const a=rand()*6.283,r=abre*Math.sqrt(rand());
      p.set(t,Math.cos(a)*r,Math.sin(a)*r*0.6).applyEuler(new THREE.Euler(0.2,0.3,0.75));
      const d=Math.abs(t)/2.1;ci=d<0.25?(rand()<0.5?7:4):d<0.6?[4,3,2][Math.floor(rand()*3)]:[0,1,0][Math.floor(rand()*3)];
    }else if(k<0.85){                                       // cresta
      const x=(rand()-.5)*4.6;p.set(x,-1.05-0.35*Math.sin(x*1.3)+(rand()-.5)*0.35-rand()*0.5,(rand()-.5)*0.8);
      ci=[5,6,5,6,4][Math.floor(rand()*5)];
    }else{                                                  // núcleo brillante
      const u=rand()*2-1,a=rand()*6.283,q=Math.sqrt(1-u*u),r=0.35*Math.cbrt(rand());p.set(q*Math.cos(a)*r,u*r,q*Math.sin(a)*r);ci=7;
    }
    return {p,c:PALETA[ci].clone()};
  }

  /* Polvo: las partículas que se transforman en los asistentes */
  const pos=new Float32Array(N*3),col=new Float32Array(N*3),pol=[];
  for(let i=0;i<N;i++){const q=puntoNebulosa();pol.push({casa:q.p,c:q.c,fase:rand()*6.283,vel:0.3+rand()*0.7,eje:new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize()});}
  const gPol=new THREE.BufferGeometry();gPol.setAttribute('position',new THREE.BufferAttribute(pos,3));gPol.setAttribute('color',new THREE.BufferAttribute(col,3));
  const mPol=new THREE.PointsMaterial({size:0.045,map:tPunto,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  const polvo=new THREE.Points(gPol,mPol);polvo.frustumCulled=false;mundo.add(polvo);

  /* Gas: nubes grandes y translúcidas */
  const nubes=[];
  for(let i=0;i<70;i++){
    const q=puntoNebulosa();
    const m=new THREE.SpriteMaterial({map:tNubes[i%4],color:q.c,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,rotation:rand()*6.283});
    const s=new THREE.Sprite(m);s.position.copy(q.p);const tam=0.9+rand()*1.6;s.scale.setScalar(tam);mundo.add(s);
    nubes.push({s,m,casa:q.p.clone(),tam,op:0.13+rand()*0.18,giro:(rand()-.5)*0.0002});
  }

  const mNuc=new THREE.SpriteMaterial({map:tPunto,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0});
  const nucleo=new THREE.Sprite(mNuc);nucleo.scale.setScalar(0.01);mundo.add(nucleo);
  const mHaloN=new THREE.SpriteMaterial({map:tNubes[0],color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0});
  const haloN=new THREE.Sprite(mHaloN);mundo.add(haloN);
  const DISCO=new THREE.Euler(0.5,0,0.18);
  let dist=6,t0=0,anim=null,W=1,H=1,zona={cx:0.5,cy:0.5,w:1,h:1};
  function redimensionar(w,h){W=w;H=h;renderer.setSize(w,h,false);camara.aspect=w/h;dist=camara.aspect<1?4.9/Math.max(0.55,camara.aspect)*0.62:4.3;camara.updateProjectionMatrix();}
  /* Dónde vive el asistente dentro de la pantalla (px), para que el polvo lo dibuje justo ahí */
  function encuadre(r){zona={cx:r.left+r.width/2,cy:r.top+r.height/2,w:r.width,h:r.height};}

  /* El asistente usa su propia cámara (≈ distancia 1.2/tan(fov/2)); para que la forma coincida,
     la nebulosa acerca la cámara al centro mientras forma. */
  const tmp=new THREE.Vector3(),orb=new THREE.Vector3(),cA=new THREE.Color(),cB=new THREE.Color();
  function preparar(asistente){
    const F=FORMAS[asistente](N,rand);
    return {F,dest:F.puntos,inc:F.inclinacion,hue:F.tono};
  }
  let formado=null;                 // al terminar de formar, el polvo se queda con la forma del asistente
  function formar(asistente,dur=9000){
    anim={tipo:'formar',...preparar(asistente),t:0,dur};
    for(const q of pol){q.r0=Math.min(2.3,0.35+q.casa.length())*(0.75+rand()*0.4);q.ang=Math.atan2(q.casa.z,q.casa.x)+rand()*0.5;
      q.alto=(rand()-.5)*0.5;q.ret=rand()*0.1;q.tx=rand()*6.283;q.ty=rand()*6.283;q.tz=rand()*6.283;}
    for(const n of nubes){n.ang=Math.atan2(n.casa.z,n.casa.x);n.r0=Math.max(0.3,n.casa.length());}
  }
  function disolver(asistente,dur=4200){anim={...(formado||preparar(asistente)),tipo:'disolver',t:0,dur};formado=null;}

  function distAsistente(){const aj=1.2/Math.tan(THREE.MathUtils.degToRad(18.5)),asp=zona.w/zona.h;
    return (asp<1?aj/asp:aj)*H/zona.h*Math.tan(THREE.MathUtils.degToRad(18.5))/Math.tan(THREE.MathUtils.degToRad(21));}
  function centrar(k){        // desplaza la imagen para que su centro caiga en el centro de la zona del asistente
    const dx=(zona.cx-W/2)*k,dy=(zona.cy-H/2)*k,ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax<0.5&&ay<0.5){camara.clearViewOffset();return;}
    camara.setViewOffset(W+2*ax,H+2*ay,ax-dx,ay-dy,W,H);
  }

  function dibujar(dT){
    t0+=dT;
    let p=0,forma=0,acerca=0,fGas=1;
    const A=anim||formado;
    if(!anim&&formado){forma=1;acerca=1;fGas=0;}
    if(anim){
      anim.t+=dT;p=lim(anim.t/anim.dur);
      forma=anim.tipo==='formar'?suave(lim((p-0.66)/0.3)):1-suave(lim((p-0.05)/0.75));
      acerca=anim.tipo==='formar'?suave(lim((p-0.05)/0.6)):1-suave(lim((p-0.25)/0.6));
      fGas=anim.tipo==='formar'?1-suave(lim((p-0.1)/0.45)):suave(lim((p-0.35)/0.5));
    }
    // cámara: lejos para ver la nebulosa; cerca y de frente cuando forma al asistente
    const dLejos=dist,dCerca=distAsistente();
    camara.position.set(0.15*(1-acerca)*Math.sin(t0*0.00005),0,dLejos+(dCerca-dLejos)*acerca);camara.lookAt(0,0,0);centrar(acerca);
    mundo.rotation.set(A?(A.inc*acerca):0,(1-acerca)*Math.sin(t0*0.00004)*0.25,0,'YXZ');
    // polvo
    const hue=A?A.hue:[0,0];
    // Nacimiento estelar: caos → disco de acreción alrededor de un centro que crece → calma y forma
    const nace=anim&&anim.tipo==='formar';
    const caos=nace?Math.sin(Math.PI*lim(p/0.5))*(1-lim((p-0.25)/0.35))*0.55:0;          // fuerte al inicio, se calma
    const aOrb=nace?suave(lim((p-0.04)/0.2)):0;                                         // entrar en órbita
    const cierra=nace?suave(lim((p-0.12)/0.55)):0;                                      // el disco se cierra
    const giro=nace?suave(lim((p-0.05)/0.15))*(1-suave(lim((p-0.62)/0.3))):0;            // girar rápido y luego frenar
    const masa=nace?suave(lim((p-0.08)/0.55)):0;
    for(let i=0;i<N;i++){
      const q=pol[i];
      tmp.copy(q.casa);
      const ond=0.05*(1-Math.max(forma,aOrb));tmp.x+=Math.sin(t0*0.0004*q.vel+q.fase)*ond;tmp.y+=Math.cos(t0*0.00033*q.vel+q.fase)*ond;
      if(nace){
        // órbita: más cerca del centro = más rápido (como las órbitas reales)
        const r=q.r0*(1-0.78*cierra)+0.04;
        q.ang+=dT*0.0042*giro*q.vel*0.6/Math.pow(Math.max(0.18,r),1.5);
        orb.set(Math.cos(q.ang)*r,q.alto*r*(1-cierra)*0.6,Math.sin(q.ang)*r).applyEuler(DISCO);
        tmp.lerp(orb,aOrb);
        // turbulencia caótica
        if(caos>0.001){tmp.x+=Math.sin(t0*0.011*q.vel+q.tx)*caos*q.vel;tmp.y+=Math.sin(t0*0.013*q.vel+q.ty)*caos*q.vel;tmp.z+=Math.sin(t0*0.009*q.vel+q.tz)*caos*0.6;}
        // calma: se acomoda en la forma del asistente
        const f=suave(lim((p-0.64-q.ret)/0.3));
        if(f>0)tmp.lerp(A.dest[i],f);
      }else if(A&&forma>0){
        const d=A.dest[i],arco=Math.sin(forma*Math.PI)*0.6;
        tmp.lerp(d,forma);tmp.x+=q.eje.x*arco;tmp.y+=q.eje.y*arco;tmp.z+=q.eje.z*arco;
      }
      pos[i*3]=tmp.x;pos[i*3+1]=tmp.y;pos[i*3+2]=tmp.z;
      cA.copy(q.c);
      const k=nace?suave(lim((p-0.3)/0.5)):forma;
      if(A){cB.setHSL((hue[0]+Math.sin(i)*hue[1])/360,0.9,0.64);cA.lerp(cB,k);}
      const parp=0.75+0.25*Math.sin(t0*0.002*q.vel+q.fase)+(nace?0.5*giro*Math.max(0,1-tmp.length()):0);
      col[i*3]=Math.min(1,cA.r*parp);col[i*3+1]=Math.min(1,cA.g*parp);col[i*3+2]=Math.min(1,cA.b*parp);
    }
    // el centro de gravedad: crece con la masa y cede su luz al asistente
    if(nace){
      const luz=masa*(1-suave(lim((p-0.78)/0.2)));
      cB.setHSL(hue[0]/360,0.6,0.85);mNuc.color.copy(cB).lerp(new THREE.Color(1,1,1),0.5);mHaloN.color.copy(cB);
      nucleo.scale.setScalar(0.05+0.55*masa);mNuc.opacity=luz;
      haloN.scale.setScalar(0.4+1.6*masa);mHaloN.opacity=0.35*luz;haloN.material.rotation=t0*0.0008*giro;
    }else{mNuc.opacity=0;mHaloN.opacity=0;}
    gPol.attributes.position.needsUpdate=true;gPol.attributes.color.needsUpdate=true;
    mPol.size=0.045-0.015*acerca;
    // gas: aparece al inicio, se condensa hacia el centro al formar
    const aparece=lim(t0/1500);
    for(const n of nubes){
      if(nace){const r=n.r0*(1-0.8*cierra);n.ang+=dT*0.003*giro/Math.pow(Math.max(0.3,r),1.2);
        orb.set(Math.cos(n.ang)*r,n.casa.y*(1-cierra),Math.sin(n.ang)*r).applyEuler(DISCO);
        n.s.position.copy(n.casa).lerp(orb,aOrb);n.s.position.x+=Math.sin(t0*0.008+n.tam*7)*caos*0.6;n.s.position.y+=Math.cos(t0*0.007+n.tam*5)*caos*0.6;}
      else n.s.position.copy(n.casa).multiplyScalar(1-0.85*(1-fGas));
      n.s.scale.setScalar(n.tam*(0.35+0.65*fGas));
      n.m.rotation+=n.giro*dT;n.m.opacity=n.op*aparece*fGas*(1-0.75*acerca);
    }
    renderer.render(escena,camara);
    if(anim&&p>=1){const fin=anim.tipo;formado=fin==='formar'?anim:null;anim=null;return fin;}
    return null;
  }
  return {redimensionar,encuadre,dibujar,formar,disolver,get animando(){return !!anim;},get progreso(){return anim?lim(anim.t/anim.dur):1;}};
}
