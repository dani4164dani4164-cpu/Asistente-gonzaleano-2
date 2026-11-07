/* ============================================================
   Escena «Kyrien» (three.js) — asistente de la Doctrina Gonzaleana
   Diseño original y volumétrico: un globo ocular de luz dorada, con
   anillos de inscripciones (símbolos generados, propios) que orbitan
   a su alrededor en distintos planos, como un astrolabio; un mandala
   de geometría sagrada al fondo y chispas tipo portal.

   Mismo contrato y estados que Agios (encaja en Anesthios):
     S.energy    0 = apagado (ojo cerrado, gris) · 1 = encendido
     S.mult      velocidad (1 normal, 2 buscando = el ojo escanea, 3 procesando)
     S.apertura  0..1  la pupila se dilata y se vuelve un portal de chispas
     S.temblor   0..1  vibración ligera
     S.destello  {color: THREE.Color, k: 0..1}  luz verde o roja
   Expone: redimensionar, dibujar, destruir, proyectar(p), puntoDeAnillo(i, a)
   ============================================================ */
import * as THREE from 'three';

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- Texturas generadas en canvas (blancas; el color lo pone el material) ---------- */
function texturaSuave(n=0.2){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'#fff');gr.addColorStop(n,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
/* Un símbolo inventado: trazos sobre una rejilla 3×3, a veces con un punto o un arco */
function glifo(g,x,y,s,rand){
  const P=[];for(let j=0;j<3;j++)for(let i=0;i<3;i++)P.push([x+(i-1)*s/2,y+(j-1)*s/2]);
  g.beginPath();let a=P[Math.floor(rand()*9)];g.moveTo(a[0],a[1]);
  const n=2+Math.floor(rand()*3);
  for(let k=0;k<n;k++){const b=P[Math.floor(rand()*9)];if(rand()<0.25)g.moveTo(b[0],b[1]);else g.lineTo(b[0],b[1]);}
  g.stroke();
  if(rand()<0.35){g.beginPath();g.arc(x,y-s*0.55,s*0.09,0,6.283);g.fill();}
  if(rand()<0.25){g.beginPath();g.arc(x,y,s*0.35,Math.PI*(0.2+rand()),Math.PI*(1.2+rand()));g.stroke();}
}
/* Anillo de inscripciones: dos bordes, marcas y una fila de símbolos alrededor */
function texturaAnillo(seed,{ri=0.80,re=0.98,simbolos=36,marcas=120}={}){
  const N=1024,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const rand=rng(seed),C=N/2,R=N/2;
  g.strokeStyle=g.fillStyle='#fff';g.lineCap='round';g.lineJoin='round';g.lineWidth=N*0.004;
  for(const r of [re,ri]){g.beginPath();g.arc(C,C,R*r,0,6.283);g.stroke();}
  g.lineWidth=N*0.0018;g.beginPath();g.arc(C,C,R*(re-0.025),0,6.283);g.stroke();
  for(let i=0;i<marcas;i++){
    const a=i/marcas*6.283,l=i%10?0.012:0.03;
    g.beginPath();g.moveTo(C+Math.cos(a)*R*(re-0.03),C+Math.sin(a)*R*(re-0.03));
    g.lineTo(C+Math.cos(a)*R*(re-0.03-l),C+Math.sin(a)*R*(re-0.03-l));g.stroke();
  }
  const rm=(ri+re-0.05)/2,s=R*(re-ri)*0.42;g.lineWidth=N*0.0032;
  for(let i=0;i<simbolos;i++){
    const a=i/simbolos*6.283;g.save();g.translate(C+Math.cos(a)*R*rm,C+Math.sin(a)*R*rm);g.rotate(a+Math.PI/2);
    glifo(g,0,0,s,rand);g.restore();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

/* ---------- Color: dorado encendido, gris apagado; el destello tiñe de verde o rojo ---------- */
function tono(t,off,S,dest){
  const e=S.energy,h=33+7*Math.sin(t*0.0003+(off||0));
  dest.setHSL(h/360,(10+82*e)/100,(56+9*e)/100,THREE.SRGBColorSpace);
  if(S.destello.k>0.001)dest.lerp(S.destello.color,Math.min(1,S.destello.k*1.15));
  return dest;
}
const alfa=(a,S)=>Math.min(1,a*(0.5+0.5*Math.max(S.energy,S.destello.k)));
const holo=x=>({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,...x});

/* ---------- Sistema de chispas reutilizable ---------- */
function crearChispas(padre,max,tam,tex,guardar){
  const ps=[];for(let i=0;i<max;i++)ps.push({vida:0});
  const pos=new Float32Array(max*3),col=new Float32Array(max*3);
  const geo=guardar(new THREE.BufferGeometry());
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const pts=new THREE.Points(geo,guardar(new THREE.PointsMaterial(holo({size:tam,map:tex,vertexColors:true}))));
  pts.frustumCulled=false;padre.add(pts);
  let sig=0;
  return {
    // Chispas que salen tangentes a un círculo de radio r (en el plano XY del padre), como de un portal
    emitir(r,cuantas,vel,rand){
      for(let n=0;n<cuantas;n++){
        const p=ps[sig];sig=(sig+1)%max;const a=rand()*6.283,s=rand()<0.5?1:-1;
        p.x=Math.cos(a)*r;p.y=Math.sin(a)*r;p.z=(rand()-0.5)*0.02;
        p.vx=(-Math.sin(a)*s*0.8+Math.cos(a)*0.35)*vel*(0.5+rand());p.vy=(Math.cos(a)*s*0.8+Math.sin(a)*0.35)*vel*(0.5+rand());
        p.vz=(rand()-0.5)*vel*0.6;p.vida=1;p.dec=0.012+rand()*0.02;
      }
    },
    rafaga(x,y,z,cuantas,vel,rand){
      for(let n=0;n<cuantas;n++){
        const p=ps[sig];sig=(sig+1)%max;const u=rand()*2-1,a=rand()*6.283,q=Math.sqrt(1-u*u),v=vel*(0.3+rand());
        p.x=x;p.y=y;p.z=z;p.vx=q*Math.cos(a)*v;p.vy=q*Math.sin(a)*v;p.vz=u*v;p.vida=1;p.dec=0.01+rand()*0.015;
      }
    },
    avanzar(paso,c,e){
      for(let i=0;i<max;i++){const p=ps[i];
        if(p.vida>0){p.x+=p.vx*paso;p.y+=p.vy*paso;p.z+=p.vz*paso;p.vx*=0.985;p.vy*=0.985;p.vida-=p.dec*paso;
          pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;const k=Math.max(0,p.vida)*(0.6+0.4*e);
          col[i*3]=Math.min(1,c.r*1.2+0.2)*k;col[i*3+1]=Math.min(1,c.g*1.1+0.1)*k;col[i*3+2]=c.b*k;}
        else col[i*3]=col[i*3+1]=col[i*3+2]=0;}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
    }
  };
}


/* ---------- Piedra rúnica: textura de roca + runas y grietas que brillan ---------- */
function ruido2(x,y,s){return Math.sin(x*1.7+s)*Math.cos(y*1.3-s*0.7)+0.5*Math.sin(x*3.9-y*2.3+s*1.9)+0.25*Math.sin(x*8.3+y*7.1-s);}
function texturasPiedra(seed){
  const W=1024,H=512,rand=rng(seed);
  // Color de la roca: tonos pardos oscuros con vetas
  const c1=document.createElement('canvas');c1.width=W;c1.height=H;const a=c1.getContext('2d');
  const img=a.createImageData(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=x/W*6.283,v=y/H*3.1416;
    const n=ruido2(u*2,v*2,seed)*0.5+ruido2(u*6,v*6,seed*2)*0.25+ruido2(u*14,v*14,seed*3)*0.12;
    const b=34+n*22,i=(y*W+x)*4;img.data[i]=b*1.15;img.data[i+1]=b*0.98;img.data[i+2]=b*0.78;img.data[i+3]=255;
  }
  a.putImageData(img,0,0);
  // Brillo (emisivo): runas en bandas y grietas que serpentean
  const c2=document.createElement('canvas');c2.width=W;c2.height=H;const g=c2.getContext('2d');
  g.fillStyle='#000';g.fillRect(0,0,W,H);g.strokeStyle=g.fillStyle='#fff';g.lineCap='round';g.lineJoin='round';
  // grietas
  g.lineWidth=2.2;
  for(let k=0;k<22;k++){
    let x=rand()*W,y=H*(0.15+rand()*0.7),ang=rand()*6.283;g.beginPath();g.moveTo(x,y);
    const pasos=12+Math.floor(rand()*20);
    for(let i=0;i<pasos;i++){ang+=(rand()-0.5)*1.2;x+=Math.cos(ang)*14;y+=Math.sin(ang)*9;g.lineTo(x,y);
      if(rand()<0.12){const bx=x,by=y;g.moveTo(bx,by);g.lineTo(bx+(rand()-.5)*40,by+(rand()-.5)*30);g.moveTo(bx,by);}}
    g.globalAlpha=0.55+rand()*0.45;g.stroke();g.globalAlpha=1;
  }
  // dos bandas de runas (como inscripciones talladas alrededor de la piedra)
  g.lineWidth=3;
  for(const fila of [0.33,0.67]){
    const n=26;for(let i=0;i<n;i++){const x=(i+0.5)/n*W;
      // deja libre el frente, donde va el ojo (u≈0.5)
      if(Math.abs((i+0.5)/n-0.5)<0.1)continue;
      glifo(g,x,H*fila,H*0.075,rand);}
    g.lineWidth=1.4;g.globalAlpha=0.6;
    g.beginPath();g.moveTo(0,H*fila-H*0.07);g.lineTo(W,H*fila-H*0.07);g.moveTo(0,H*fila+H*0.07);g.lineTo(W,H*fila+H*0.07);g.stroke();
    g.globalAlpha=1;g.lineWidth=3;
  }
  // el frente (donde está el ojo) queda limpio: se borra con un degradado
  {const gr=g.createRadialGradient(W/2,H/2,0,W/2,H/2,H*0.32);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(0.75,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');
   g.globalAlpha=1;g.fillStyle=gr;g.save();g.translate(W/2,H/2);g.scale(0.55,1);g.translate(-W/2,-H/2);g.fillRect(0,0,W,H);g.restore();}
  // un leve resplandor alrededor de los trazos
  const c3=document.createElement('canvas');c3.width=W;c3.height=H;const h=c3.getContext('2d');
  h.filter='blur(3px)';h.drawImage(c2,0,0);h.filter='none';h.globalCompositeOperation='lighter';h.drawImage(c2,0,0);
  const t1=new THREE.CanvasTexture(c1),t2=new THREE.CanvasTexture(c3);
  t1.colorSpace=t2.colorSpace=THREE.SRGBColorSpace;t1.anisotropy=t2.anisotropy=8;
  return {color:t1,brillo:t2};
}
/* Geometría de roca: esfera facetada con relieve irregular (más lisa en el frente, donde está el ojo) */
const SX=1.12,SY=0.9,ZS=0.55,FRENTE=0.97;     // proporciones de la roca
function geometriaRoca(r,seed){
  const geo=new THREE.IcosahedronGeometry(r,3),p=geo.attributes.position,v=new THREE.Vector3();
  const rand=rng(Math.floor(seed*1000));
  // unos cuantos "golpes" que achatan o abultan zonas de la roca
  const bultos=[];for(let i=0;i<9;i++){const d=new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1).normalize();
    if(d.z>0.3)d.z=-d.z;                                        // no deformar el frente, donde va el ojo
    bultos.push({d,k:(rand()<0.5?-1:1)*(0.08+rand()*0.12),w:0.55+rand()*0.35});}
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i).normalize();
    let n=Math.sin(v.x*3.1+seed)*Math.cos(v.y*2.7-seed)*0.55+Math.sin(v.z*4.3+v.x*2.2)*0.3+Math.sin(v.y*9-v.z*7+seed)*0.15;
    let b=0;for(const q of bultos){const c=v.dot(q.d);if(c>q.w)b+=q.k*(c-q.w)/(1-q.w);}
    const frente=Math.min(1,Math.max(0,v.z-0.5)/0.3);          // 0 fuera … 1 en la cara donde va el ojo
    const rad=r*(1+(0.16*n+b)*(1-frente)-(1-FRENTE)*frente);
    v.multiplyScalar(rad);v.x*=SX;v.y*=SY;v.z*=ZS;
    p.setXYZ(i,v.x,v.y,v.z);
  }
  geo.computeVertexNormals();
  // UV esféricas para que las texturas envuelvan la roca
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).normalize();uv[i*2]=0.5+Math.atan2(v.x,v.z)/(2*Math.PI);uv[i*2+1]=0.5+Math.asin(v.y)/Math.PI;}
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return geo;
}

/* z de la cara frontal de la roca en (x, y) (zona lisa: elipsoide exacto) */
function zFrente(r,x,y){const a=x/(r*FRENTE*SX),b=y/(r*FRENTE*SY);return r*FRENTE*ZS*Math.sqrt(Math.max(0,1-a*a-b*b));}


/* ---------- El hechizo: círculo mágico original (canvas) ---------- */
function texturaHechizo(seed){
  const N=1024,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const rand=rng(seed),C=N/2,R=N/2*0.96;
  g.strokeStyle=g.fillStyle='#fff';g.lineCap='round';g.lineJoin='round';
  const circ=(r,w)=>{g.lineWidth=w;g.beginPath();g.arc(C,C,R*r,0,6.283);g.stroke();};
  circ(1,5);circ(0.965,2);circ(0.83,2.5);circ(0.8,1.5);
  // banda de símbolos
  g.lineWidth=3;for(let i=0;i<44;i++){const a=i/44*6.283;g.save();g.translate(C+Math.cos(a)*R*0.895,C+Math.sin(a)*R*0.895);g.rotate(a+Math.PI/2);glifo(g,0,0,R*0.075,rand);g.restore();}
  // geometría: heptagrama + dos triángulos + círculos interiores (diseño propio)
  const poli=(n,r,salto,giro,w)=>{g.lineWidth=w;g.beginPath();for(let i=0;i<=n;i++){const a=giro+(i*salto)%n/n*6.283;const x=C+Math.cos(a)*R*r,y=C+Math.sin(a)*R*r;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();};
  poli(7,0.78,3,-Math.PI/2,2.5);poli(7,0.78,2,-Math.PI/2,1.5);
  circ(0.5,2.5);circ(0.47,1.2);
  poli(3,0.46,1,-Math.PI/2,2);poli(3,0.46,1,Math.PI/2,2);
  circ(0.2,3);circ(0.12,1.5);
  for(let i=0;i<7;i++){const a=-Math.PI/2+i/7*6.283;g.beginPath();g.arc(C+Math.cos(a)*R*0.78,C+Math.sin(a)*R*0.78,R*0.025,0,6.283);g.fill();
    g.lineWidth=1.2;g.beginPath();g.moveTo(C+Math.cos(a)*R*0.2,C+Math.sin(a)*R*0.2);g.lineTo(C+Math.cos(a)*R*0.47,C+Math.sin(a)*R*0.47);g.stroke();}
  // resplandor
  const c2=document.createElement('canvas');c2.width=c2.height=N;const h=c2.getContext('2d');
  h.filter='blur(6px)';h.drawImage(c,0,0);h.filter='none';h.globalCompositeOperation='lighter';h.drawImage(c,0,0);
  const t=new THREE.CanvasTexture(c2);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function texturaGlifo(seed){
  const N=96,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  g.strokeStyle=g.fillStyle='#fff';g.lineCap='round';g.lineJoin='round';g.lineWidth=5;g.shadowColor='#fff';g.shadowBlur=10;
  glifo(g,N/2,N/2,N*0.55,rng(seed));
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
/* Parte una geometría de roca en trozos agrupando sus caras por dirección */
function trozosDeRoca(geo,n,seed){
  const rand=rng(seed),dirs=[];for(let i=0;i<n;i++)dirs.push(new THREE.Vector3(rand()*2-1,rand()*2-1,rand()*2-1).normalize());
  const p=geo.attributes.position,uv=geo.attributes.uv,grupos=dirs.map(()=>({p:[],uv:[]})),c=new THREE.Vector3(),v=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){
    c.set(0,0,0);for(let k=0;k<3;k++)c.add(v.fromBufferAttribute(p,i+k));c.normalize();
    let mejor=0,md=-2;dirs.forEach((d,j)=>{const x=d.dot(c);if(x>md){md=x;mejor=j;}});
    for(let k=0;k<3;k++){grupos[mejor].p.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));grupos[mejor].uv.push(uv.getX(i+k),uv.getY(i+k));}
  }
  return grupos.filter(q=>q.p.length).map(q=>{
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(q.p,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(q.uv,2));
    gg.computeBoundingSphere();const centro=gg.boundingSphere.center.clone();gg.translate(-centro.x,-centro.y,-centro.z);gg.computeVertexNormals();
    return {geo:gg,centro,dir:centro.clone().normalize(),dist:0.35+rand()*0.45,eje:new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize(),giro:1+rand()*2.5};
  });
}

export default {
  id:'kyrien',
  nombre:'Kyrien',

  /* Estados (mismo contrato que Agios):
       S.energy    0 dormido (ojo cerrado, gris) · 1 despierto
       S.mult      1 normal · 2 buscando (el ojo se dilata y la pupila brilla) · 3 procesando
       S.apertura  0..1  el hechizo se deshace: la roca estalla, el ojo desaparece y los anillos se rompen.
                   Al procesar, la app lo baja de 1 a 0 según el avance: el hechizo se vuelve a armar.
       S.temblor, S.destello  igual que Agios
     Extras: invocar() forma el círculo mágico con símbolos de los anillos;
             puntoDeHechizo(i, n) da dónde nace cada ventana de resultado. */
  crear(contenedor,S){
    const R=1,rand=rng(7);
    const recursos=[];const g=o=>(recursos.push(o),o);

    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
    renderer.domElement.className='escena';contenedor.prepend(renderer.domElement);
    const escena=new THREE.Scene(),camara=new THREE.PerspectiveCamera(36,1,0.1,50);
    const pivote=new THREE.Group();escena.add(pivote);
    const tex=g(texturaSuave(0.2)),texHalo=g(texturaSuave(0.02));
    let anchoCss=1,altoCss=1;
    // materiales que se colorean cada cuadro: [material, desfase, opacidad, grupo]
    const colorear=[];const reg=(m,off,a,grupo='')=>(colorear.push([m,off,a,grupo]),m);
    const poli=(n,r,giro)=>{const p=[];for(let i=0;i<=n;i++){const a=giro+i/n*6.283;p.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}return p;};
    const linea=(pts,off,a,padre,grupo)=>{const m=reg(g(new THREE.LineBasicMaterial(holo({}))),off,a,grupo);const l=new THREE.Line(g(new THREE.BufferGeometry().setFromPoints(pts)),m);padre.add(l);return l;};

    /* ---- Fondo tenue ---- */
    const fondo=new THREE.Group();fondo.position.z=-0.45;pivote.add(fondo);
    linea(poli(120,R*0.88,0),0.2,0.16,fondo,'aura');

    /* ---- Anillos de inscripciones hechos de arcos (para poder romperse) ---- */
    function anilloEnArcos(padre,seed,radio,ri,re,piezas,off,a,simbolos,marcas){
      const tx=g(texturaAnillo(seed,{ri,re,simbolos,marcas}));
      const m=reg(g(new THREE.MeshBasicMaterial(holo({map:tx,side:THREE.DoubleSide}))),off,a,'anillo');
      const arcos=[];
      for(let k=0;k<piezas;k++){
        const t0=k/piezas*6.283,len=6.283/piezas;
        // RingGeometry usa UV planas respecto a su radio exterior: coinciden con la textura del plano completo
        const geo=g(new THREE.RingGeometry(radio*(ri-0.06),radio,10,1,t0,len));
        const me=new THREE.Mesh(geo,m);padre.add(me);
        arcos.push({me,mid:t0+len/2,d:0.25+rand()*0.35,gx:(rand()-.5)*1.6,gy:(rand()-.5)*1.6,gz:(rand()-.5)*0.6,dz:(rand()-.5)*0.4});
      }
      return arcos;
    }
    const incA=new THREE.Group();pivote.add(incA);const giraA=new THREE.Group();incA.add(giraA);
    const arcosA=anilloEnArcos(giraA,11,R*0.975,0.84,0.985,12,0,0.9,40,144);
    const chispasA=crearChispas(incA,300,0.045,tex,g);
    const incB=new THREE.Group();pivote.add(incB);const giraB=new THREE.Group();incB.add(giraB);
    const arcosB=anilloEnArcos(giraB,23,R*0.79,0.84,0.98,8,1.2,0.5,30,90);

    /* ---- Hexagrama, aro y corona ---- */
    const incH=new THREE.Group();pivote.add(incH);const hexa=new THREE.Group();incH.add(hexa);
    linea(poli(3,R*0.68,Math.PI/2),0.6,0.28,hexa,'aura');linea(poli(3,R*0.68,-Math.PI/2),0.7,0.28,hexa,'aura');
    const aro=new THREE.Group();pivote.add(aro);
    aro.add(new THREE.Mesh(g(new THREE.TorusGeometry(R*0.6,0.0035,6,140)),reg(g(new THREE.MeshBasicMaterial(holo({}))),0.9,0.45,'aura')));
    const corona=new THREE.Group();pivote.add(corona);
    {const pts=[];for(let i=0;i<72;i++){const a=i/72*6.283;pts.push(new THREE.Vector3(Math.cos(a)*R*0.76,Math.sin(a)*R*0.76,0));}
     corona.add(new THREE.Points(g(new THREE.BufferGeometry().setFromPoints(pts)),reg(g(new THREE.PointsMaterial(holo({size:0.026,map:tex}))),0.8,0.5,'aura')));}

    /* ---- La roca rúnica, en trozos que pueden separarse ---- */
    const RG=R*0.44;
    const ojo=new THREE.Group();pivote.add(ojo);
    const globo=new THREE.Group();ojo.add(globo);
    const tp=texturasPiedra(5);g(tp.color);g(tp.brillo);
    const mRoca=g(new THREE.MeshStandardMaterial({map:tp.color,emissiveMap:tp.brillo,emissive:new THREE.Color(1,0.6,0.2),
      emissiveIntensity:1,roughness:0.92,metalness:0.08,flatShading:true}));
    const geoRoca=geometriaRoca(RG,1.7);
    const trozos=trozosDeRoca(geoRoca,26,3).map(t=>{g(t.geo);const me=new THREE.Mesh(t.geo,mRoca);me.position.copy(t.centro);globo.add(me);return {...t,me};});
    geoRoca.dispose();
    const chispasR=crearChispas(globo,260,0.04,tex,g);
    const mEngaste=reg(g(new THREE.MeshBasicMaterial(holo({}))),0.2,0.45,'ojo');
    const engaste=new THREE.Mesh(g(new THREE.TorusGeometry(R*0.215,0.004,8,96)),mEngaste);engaste.position.z=zFrente(RG,0,0)+0.02;globo.add(engaste);
    const luzA=new THREE.AmbientLight(0xffffff,0.35),luzF=new THREE.DirectionalLight(0xffe2b0,1.1);luzF.position.set(0.6,0.8,2);
    const luzC=new THREE.PointLight(0xffa030,2,3,1.5);luzC.position.set(0,0,-0.9);escena.add(luzA,luzF,luzC);

    /* ---- El ojo, grabado en la cara frontal ---- */
    const SOBRE=0.03;
    const frente=new THREE.Group();frente.position.z=zFrente(RG,0,0)+SOBRE;globo.add(frente);
    const iris=new THREE.Group();iris.scale.setScalar(1.12);frente.add(iris);
    linea(poli(80,R*0.17,0),0.05,0.95,iris,'ojo');linea(poli(80,R*0.105,0),0.1,0.6,iris,'ojo');
    {const f=[];for(let i=0;i<44;i++){const a=i/44*6.283,r1=R*(0.11+0.01*(i%3)),r2=R*(0.158-0.012*(i%2));
      f.push(new THREE.Vector3(Math.cos(a)*r1,Math.sin(a)*r1,0),new THREE.Vector3(Math.cos(a)*r2,Math.sin(a)*r2,0));}
     iris.add(new THREE.LineSegments(g(new THREE.BufferGeometry().setFromPoints(f)),reg(g(new THREE.LineBasicMaterial(holo({}))),0.25,0.5,'ojo')));}
    const giroIris=new THREE.Group();iris.add(giroIris);
    giroIris.add(new THREE.Mesh(g(new THREE.RingGeometry(R*0.125,R*0.133,64,1,0,4.2)),reg(g(new THREE.MeshBasicMaterial(holo({side:THREE.DoubleSide}))),0.35,0.85,'ojo')));
    const mPup=g(new THREE.MeshBasicMaterial({color:0x05040a,transparent:true,opacity:0.92,depthWrite:false}));
    const pupila=new THREE.Mesh(g(new THREE.CircleGeometry(R*0.055,48)),mPup);pupila.position.z=0.004;iris.add(pupila);
    const bordePup=new THREE.Mesh(g(new THREE.RingGeometry(R*0.055,R*0.064,64)),reg(g(new THREE.MeshBasicMaterial(holo({side:THREE.DoubleSide}))),0,1,'ojo'));
    bordePup.position.z=0.006;iris.add(bordePup);
    const mLuzPup=g(new THREE.SpriteMaterial(holo({map:texHalo})));const luzPup=new THREE.Sprite(mLuzPup);luzPup.position.z=0.01;iris.add(luzPup);
    const mBrillo=reg(g(new THREE.SpriteMaterial(holo({map:texHalo}))),0,0.5,'ojo');const brillo=new THREE.Sprite(mBrillo);frente.add(brillo);
    const LW=R*0.3,LH=R*0.16,NP=48,parpados=[];
    for(const lado of [1,-1])for(const k of [0,1]){
      const geom=g(new THREE.BufferGeometry());geom.setAttribute('position',new THREE.BufferAttribute(new Float32Array((NP+1)*3),3));
      const l=new THREE.Line(geom,reg(g(new THREE.LineBasicMaterial(holo({}))),lado>0?0.1:0.15,k?0.6:1,'ojo'));l.frustumCulled=false;globo.add(l);parpados.push({lado,k,geom});
    }
    const mHalo=reg(g(new THREE.SpriteMaterial(holo({map:texHalo}))),0.5,0.1);const halo=new THREE.Sprite(mHalo);halo.position.z=-0.3;pivote.add(halo);

    /* ---- El círculo mágico que se invoca al encontrar resultados ---- */
    const hechizo=new THREE.Group();hechizo.position.z=0.62;hechizo.visible=false;pivote.add(hechizo);
    const mHech=reg(g(new THREE.MeshBasicMaterial(holo({map:g(texturaHechizo(31)),side:THREE.DoubleSide}))),0.1,1,'hechizo');
    const discoH=new THREE.Mesh(g(new THREE.PlaneGeometry(R*1.25,R*1.25)),mHech);hechizo.add(discoH);
    const mHech2=reg(g(new THREE.MeshBasicMaterial(holo({map:g(texturaAnillo(47,{ri:0.86,re:0.98,simbolos:28,marcas:96})),side:THREE.DoubleSide}))),0.4,0.8,'hechizo');
    const anilloH=new THREE.Mesh(g(new THREE.PlaneGeometry(R*1.45,R*1.45)),mHech2);anilloH.position.z=-0.01;hechizo.add(anilloH);
    // símbolos que vuelan de los anillos al círculo
    const texG=[0,1,2,3,4,5].map(i=>g(texturaGlifo(100+i)));
    const glifos=[];for(let i=0;i<22;i++){const m=g(new THREE.SpriteMaterial(holo({map:texG[i%6]})));const sp=new THREE.Sprite(m);sp.visible=false;pivote.add(sp);glifos.push({sp,m,ini:new THREE.Vector3(),fin:new THREE.Vector3(),ret:i*0.018});}
    let tHech=-1;                               // ms desde la invocación (-1 = inactivo)
    const HECH_VUELO=900,HECH_FIN=5200;
    function invocar(){
      tHech=0;hechizo.visible=true;
      glifos.forEach((q,i)=>{
        const desdeA=i%2===0,arcos=desdeA?arcosA:arcosB,padre=desdeA?giraA:giraB,r=desdeA?R*0.9:R*0.72;
        const a=arcos[i%arcos.length].mid+(rand()-.5)*0.4;
        q.ini.set(Math.cos(a)*r,Math.sin(a)*r,0);padre.updateWorldMatrix(true,false);padre.localToWorld(q.ini);pivote.worldToLocal(q.ini);
        const b=i/glifos.length*6.283;q.fin.set(Math.cos(b)*R*0.66,Math.sin(b)*R*0.66,0.62);
        q.sp.visible=true;
      });
    }

    /* ---- Cámara y proyección ---- */
    let distBase=4;
    function redimensionar(w,h){anchoCss=w;altoCss=h;renderer.setSize(w,h,false);camara.aspect=w/h;
      const ajuste=1.2/Math.tan(THREE.MathUtils.degToRad(camara.fov/2));distBase=camara.aspect<1?ajuste/camara.aspect:ajuste;camara.updateProjectionMatrix();}
    const v3=new THREE.Vector3();
    function proyectar(p){v3.set(p.x,p.y,p.z).project(camara);return{x:(v3.x+1)/2*anchoCss,y:(1-v3.y)/2*altoCss};}
    function puntoDeAnillo(i,a=0){const [obj,r]=[[giraB,R*0.72],[hexa,R*0.68],[giraA,R*0.9]][i%3];
      const p=new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0);obj.updateWorldMatrix(true,false);obj.localToWorld(p);return proyectar(p);}
    function puntoDeHechizo(i,n){const a=-Math.PI/2+i/Math.max(1,n)*6.283+discoH.rotation.z;
      const p=new THREE.Vector3(Math.cos(a)*R*0.5,Math.sin(a)*R*0.5,0);hechizo.updateWorldMatrix(true,false);hechizo.localToWorld(p);return proyectar(p);}

    /* ---- Mirada y parpadeo ---- */
    let mirX=0,mirY=0,objX=0,objY=0,proxMirada=0,parpadeo=0,proxParpadeo=4000,reloj=0,romperAnt=0;
    const col=new THREE.Color(),q=new THREE.Quaternion(),negro=new THREE.Color(0x05040a);
    const suaveP=x=>x*x*(3-2*x);

    function dibujar(t,dT){
      const T=S.T,e=S.energy,dk=S.destello.k,paso=dT/16.7;reloj+=dT;
      const rom=suaveP(Math.max(0,Math.min(1,S.apertura)));        // cuánto está deshecho el hechizo
      const busca=Math.max(0,Math.min(1,(S.mult-1)))*(S.mult<2.5?1:0);
      pivote.rotation.set(0.16+S.tilt*0.9+0.06*Math.sin(T*0.00021),S.rot+0.28*Math.sin(T*0.00015),0,'YXZ');
      const tb=S.temblor*0.018;camara.position.set((Math.random()-.5)*tb,(Math.random()-.5)*tb,distBase/S.zoom);camara.lookAt(0,0,0);

      // Órbitas
      incA.rotation.set(1.18+0.08*Math.sin(T*0.0002),0,0.25);giraA.rotation.z=T*0.00018;
      incB.rotation.set(0.35,-0.95+0.1*Math.sin(T*0.00017),0);giraB.rotation.z=-T*0.0004;
      incH.rotation.set(-0.75,0.5,T*0.00012);hexa.rotation.z=T*0.0003;
      aro.rotation.set(T*0.0005,1.2,0);corona.rotation.set(1.45,0.2,-T*0.00035);
      giroIris.rotation.z=T*0.0016;

      // Romper / armar: los arcos de los anillos se dispersan; la roca estalla en trozos
      for(const arcos of [arcosA,arcosB])for(const a of arcos){
        const d=rom*a.d;a.me.position.set(Math.cos(a.mid)*d,Math.sin(a.mid)*d,a.dz*rom);
        a.me.rotation.set(a.gx*rom,a.gy*rom,a.gz*rom);
      }
      for(const tr of trozos){
        tr.me.position.copy(tr.centro).addScaledVector(tr.dir,rom*tr.dist*R);
        q.setFromAxisAngle(tr.eje,rom*tr.giro+rom*T*0.0006*tr.giro);tr.me.quaternion.copy(q);
      }
      hexa.scale.setScalar(1+0.35*rom);aro.scale.setScalar(1+0.3*rom);corona.scale.setScalar(1+0.25*rom);
      if(rom>0.08&&romperAnt<=0.08)chispasR.rafaga(0,0,0,180,0.012,rand);     // estallido
      if(rom<0.08&&romperAnt>=0.08)chispasR.rafaga(0,0,0,120,0.008,rand);     // se cierra el hechizo
      romperAnt=rom;

      // Colores y opacidades por grupo
      const fOjo=1-Math.min(1,rom*1.6),fAura=1-0.55*rom;
      const tH=tHech<0?0:tHech,fH=tHech<0?0:Math.min(1,Math.max(0,(tH-HECH_VUELO*0.55)/450))*(1-Math.max(0,(tH-HECH_FIN+700)/700));
      for(const [m,off,a,gr] of colorear){m.color.copy(tono(t,off,S,col));
        let o=alfa(a,S);if(gr==='ojo')o*=fOjo;else if(gr==='aura'||gr==='anillo')o*=fAura;else if(gr==='hechizo')o*=fH;m.opacity=o;}
      mHalo.opacity=alfa(0.04+0.09*e+0.35*dk+0.1*rom+0.15*fH,S);halo.scale.setScalar(R*(2.1+0.5*dk));

      // Runas de la piedra: arden más al romperse
      tono(t,0.3,S,col);mRoca.emissive.copy(col);
      mRoca.emissiveIntensity=0.12+1.1*e*(0.75+0.25*Math.sin(T*0.004))+1.4*rom+1.2*dk;
      luzC.intensity=0.4+2.2*e+2*dk+1.5*rom;luzC.color.copy(col);

      // Párpados
      if(e>0.6&&reloj>proxParpadeo&&busca<0.1){parpadeo=1;proxParpadeo=reloj+5000+Math.random()*7000;}
      parpadeo=Math.max(0,parpadeo-dT/180);
      const cierre=parpadeo>0?Math.sin(parpadeo*Math.PI):0;
      const abre=Math.max(0.025,Math.min(1,e*1.1-0.1))*(1-cierre*0.95)*(1+0.12*busca);
      for(const {lado,k,geom} of parpados){
        const arr=geom.attributes.position.array,ex=k?1.04:1;
        for(let i=0;i<=NP;i++){const u=i/NP*2-1,x=u*LW*ex,y=lado*LH*ex*abre*Math.pow(1-u*u,0.7);
          arr[i*3]=x;arr[i*3+1]=y;arr[i*3+2]=zFrente(RG,x,y)+SOBRE+0.002;}
        geom.attributes.position.needsUpdate=true;
      }
      // Mirada: la pupila se mueve dentro de la almendra; al buscar se queda al frente, concentrada
      if(reloj>proxMirada){objX=(Math.random()-0.5)*0.4;objY=(Math.random()-0.5)*0.2;proxMirada=reloj+1800+Math.random()*2500;}
      const vel=Math.min(1,0.06*paso);
      mirX+=(objX*e*(1-busca)-mirX)*vel;mirY+=(objY*e*(1-busca)-mirY)*vel;
      globo.rotation.set(-mirY*0.35,mirX*0.35,0);
      const ix=Math.max(-1,Math.min(1,mirX/0.2))*R*0.07*abre,iy=Math.max(-1,Math.min(1,mirY/0.1))*R*0.025*abre;
      iris.position.set(ix,iy,zFrente(RG,ix,iy)-zFrente(RG,0,0));
      iris.scale.set(1.12,1.12*Math.min(1,abre*1.15),1.12);
      // Pupila: al buscar se dilata y se enciende
      const pulso=0.5+0.5*Math.sin(T*0.004),dil=1+0.08*pulso*e+0.45*busca;
      pupila.scale.setScalar(dil);bordePup.scale.setScalar(dil);
      tono(t,0,S,col);mPup.color.copy(negro).lerp(col,0.75*busca);mPup.opacity=0.92*fOjo;
      luzPup.scale.setScalar(R*(0.12+0.1*busca*(0.8+0.4*pulso))*dil);mLuzPup.color.copy(col);mLuzPup.opacity=busca*(0.6+0.4*pulso)*fOjo;
      brillo.scale.setScalar(R*(0.42+0.18*pulso*e+0.25*busca+0.7*dk));mBrillo.opacity=alfa(0.18+0.25*e+0.3*busca+0.5*dk,S)*fOjo;

      // Hechizo invocado: vuelan los símbolos, se forma el círculo, gira y se desvanece
      if(tHech>=0){
        tHech+=dT;
        glifos.forEach(g2=>{
          const k=Math.max(0,Math.min(1,(tHech/HECH_VUELO)-g2.ret));const kk=suaveP(k);
          g2.sp.position.lerpVectors(g2.ini,g2.fin,kk);g2.sp.position.y+=Math.sin(kk*Math.PI)*0.18;
          g2.sp.scale.setScalar(R*(0.07+0.03*Math.sin(kk*Math.PI)));
          g2.m.color.copy(tono(t,0.2,S,col));g2.m.opacity=(k>0?1:0)*(1-Math.max(0,(tHech-HECH_VUELO)/500));
        });
        const ent=Math.min(1,Math.max(0,(tHech-HECH_VUELO*0.55)/600));
        hechizo.scale.setScalar(0.2+0.8*suaveP(ent));
        discoH.rotation.z=tHech*0.0006;anilloH.rotation.z=-tHech*0.0003;
        hechizo.rotation.set(-pivote.rotation.x*0.6,-pivote.rotation.y*0.6,0);   // casi de frente a quien mira
        if(tHech>HECH_FIN){tHech=-1;hechizo.visible=false;glifos.forEach(g2=>g2.sp.visible=false);}
      }

      // Chispas
      if(e>0.2&&rom<0.5)chispasA.emitir(R*0.92,Math.random()<0.7*e?Math.ceil(S.mult*1.5):0,0.006,rand);
      if(rom>0.2&&Math.random()<rom*0.8)chispasR.rafaga((rand()-.5)*RG,(rand()-.5)*RG,(rand()-.5)*RG*0.5,1,0.004,rand);
      tono(t,0.4,S,col);chispasA.avanzar(paso,col,e);chispasR.avanzar(paso,col,Math.max(e,rom));

      renderer.render(escena,camara);
    }

    function destruir(){recursos.forEach(r=>r.dispose&&r.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
    return {redimensionar,dibujar,destruir,proyectar,puntoDeAnillo,invocar,puntoDeHechizo};
  }
};
