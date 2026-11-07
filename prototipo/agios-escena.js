/* ============================================================
   Escena «Agios» (three.js)
   Basada en el Indicador 3D, con lo que Agios necesita para
   expresar sus estados:
     S.energy    0 = apagado (gris, lento) · 1 = encendido (color)
     S.mult      multiplicador de velocidad (1 normal, 2 buscando, 3 procesando)
     S.apertura  0..1  el núcleo se abre en fragmentos
     S.temblor   0..1  vibración ligera
     S.destello  {color: THREE.Color, k: 0..1}  luz verde (éxito) o roja (error)
   Además expone:
     proyectar(vec3)      -> {x, y} en px CSS dentro del contenedor
     puntoDeAnillo(i, a)  -> posición en pantalla de un punto del anillo i
   ============================================================ */
import * as THREE from 'three';

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function texturaSuave(nitidez=0.25){
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(nitidez,'rgba(255,255,255,0.85)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx;
}

/* Color: azul↔morado encendido, gris apagado; el destello lo tiñe de verde o rojo */
function tono(t,off,S,destino){
  const e=S.energy,h=242+33*Math.sin(t*0.00035+(off||0));
  destino.setHSL(h/360,(8+77*e)/100,(62+4*e)/100,THREE.SRGBColorSpace);
  if(S.destello.k>0.001)destino.lerp(S.destello.color,Math.min(1,S.destello.k*1.15));
  return destino;
}
const alfa=(a,S)=>Math.min(1,a*(0.55+0.45*Math.max(S.energy,S.destello.k)));

function crearPistasEsfericas(n,rand){
  const LAT=1.15,out=[];
  const aXYZ=(lon,lat,r)=>new THREE.Vector3(r*Math.cos(lat)*Math.cos(lon),r*Math.sin(lat),r*Math.cos(lat)*Math.sin(lon));
  for(let i=0;i<n;i++){
    const r=[0.5,0.56,0.62][Math.floor(rand()*3)];
    let lon=rand()*Math.PI*2,lat=(rand()*2-1)*LAT;const xyz=[aXYZ(lon,lat,r)];
    const pasos=3+Math.floor(rand()*4);
    for(let k=0;k<pasos;k++){
      let lon2=lon,lat2=lat;
      if(k%2)lat2=Math.max(-LAT,Math.min(LAT,lat+(rand()<0.5?-1:1)*(0.12+rand()*0.22)));
      else lon2=lon+(rand()-.5)*0.9;
      const m=Math.max(2,Math.ceil((Math.abs(lon2-lon)+Math.abs(lat2-lat))/0.04));
      for(let s=1;s<=m;s++)xyz.push(aXYZ(lon+(lon2-lon)*s/m,lat+(lat2-lat)*s/m,r));
      lon=lon2;lat=lat2;
    }
    const largo=[0];for(let j=1;j<xyz.length;j++)largo.push(largo[j-1]+xyz[j].distanceTo(xyz[j-1]));
    out.push({xyz,largo,total:largo[largo.length-1],ph:rand(),sp:0.5+rand()});
  }
  return out;
}
function puntoEn(p,f,dest){
  const d=f*p.total;let j=1;while(j<p.largo.length-1&&p.largo[j]<d)j++;
  const a=p.largo[j-1],b=p.largo[j],k=b>a?(d-a)/(b-a):0;
  return dest.lerpVectors(p.xyz[j-1],p.xyz[j],k);
}
const holo=extra=>({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,...extra});

export default {
  id:'agios',
  nombre:'Agios',

  crear(contenedor,S){
    const rand=rng(42),R=1;
    const recursos=[];const guardar=o=>(recursos.push(o),o);

    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setClearColor(0x000000,0);
    renderer.domElement.className='escena';
    contenedor.prepend(renderer.domElement);

    const escena=new THREE.Scene();
    const camara=new THREE.PerspectiveCamera(38,1,0.1,50);
    const pivote=new THREE.Group();escena.add(pivote);
    const tex=guardar(texturaSuave(0.2)),texHalo=guardar(texturaSuave(0.02));
    let anchoCss=1,altoCss=1;

    /* ---- Esfera de circuitos ---- */
    const circuitos=new THREE.Group();pivote.add(circuitos);
    const pistas=crearPistasEsfericas(40,rand);
    const lineasPistas=pistas.map(p=>{
      const l=new THREE.Line(guardar(new THREE.BufferGeometry().setFromPoints(p.xyz)),guardar(new THREE.LineBasicMaterial(holo({opacity:0.35}))));
      circuitos.add(l);return l;
    });
    const nodosPos=[],nodosCol=new Float32Array(pistas.length*6);
    pistas.forEach(p=>nodosPos.push(p.xyz[0],p.xyz[p.xyz.length-1]));
    const gNodos=guardar(new THREE.BufferGeometry().setFromPoints(nodosPos));
    gNodos.setAttribute('color',new THREE.BufferAttribute(nodosCol,3));
    circuitos.add(new THREE.Points(gNodos,guardar(new THREE.PointsMaterial(holo({size:0.032,map:tex,vertexColors:true})))));
    const pulPos=new Float32Array(pistas.length*3),pulCol=new Float32Array(pistas.length*3);
    const gPul=guardar(new THREE.BufferGeometry());
    gPul.setAttribute('position',new THREE.BufferAttribute(pulPos,3));gPul.setAttribute('color',new THREE.BufferAttribute(pulCol,3));
    const pulsos=new THREE.Points(gPul,guardar(new THREE.PointsMaterial(holo({size:0.055,map:tex,vertexColors:true}))));
    pulsos.frustumCulled=false;circuitos.add(pulsos);

    /* ---- Anillo escáner ---- */
    const escaner=new THREE.Group();pivote.add(escaner);
    const RE=R*0.97,marcas=[];
    for(let i=0;i<72;i++){const a=i/72*Math.PI*2,l=i%6?0.035:0.09;marcas.push(new THREE.Vector3(Math.cos(a)*RE,Math.sin(a)*RE,0),new THREE.Vector3(Math.cos(a)*(RE-l),Math.sin(a)*(RE-l),0));}
    const mMarcas=guardar(new THREE.LineBasicMaterial(holo({opacity:0.6})));
    const anilloMarcas=new THREE.LineSegments(guardar(new THREE.BufferGeometry().setFromPoints(marcas)),mMarcas);escaner.add(anilloMarcas);
    const mGuia=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.3})));
    escaner.add(new THREE.Mesh(guardar(new THREE.TorusGeometry(RE,0.003,6,200)),mGuia));
    const mBarrido=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.9})));
    const barrido=new THREE.Mesh(guardar(new THREE.TorusGeometry(RE*0.95,0.014,8,60,0.9)),mBarrido);escaner.add(barrido);

    /* ---- Giroscopio ---- */
    const anillos=[];let padre=pivote;
    for(let k=3;k>=0;k--){
      const rr=R*(0.38+k*0.19)*0.82;
      const cardan=new THREE.Group();padre.add(cardan);
      const mA=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.55})));
      const aro=new THREE.Mesh(guardar(new THREE.TorusGeometry(rr,0.006+0.002*k,8,160)),mA);cardan.add(aro);
      const gP=guardar(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0,0,rr*1.05,rr*1.05,0,3.5).getPoints(120)));
      const mP=guardar(new THREE.LineDashedMaterial(holo({dashSize:0.012,gapSize:0.035,opacity:0.6})));
      const punteado=new THREE.Line(gP,mP);punteado.computeLineDistances();cardan.add(punteado);
      anillos.push({k,rr,cardan,mA,mP,punteado});padre=cardan;
    }

    /* ---- Núcleo que se abre: esfera interior + caparazón de 20 fragmentos ---- */
    const mNuc=guardar(new THREE.MeshBasicMaterial(holo({opacity:0.8})));
    const nucleo=new THREE.Mesh(guardar(new THREE.SphereGeometry(R*0.06,24,16)),mNuc);pivote.add(nucleo);
    const ico=new THREE.IcosahedronGeometry(R*0.12,0).toNonIndexed();
    const base=ico.attributes.position.array.slice();ico.dispose();
    const caras=[];                               // centro y normal de cada fragmento
    for(let f=0;f<base.length/9;f++){
      const c=new THREE.Vector3();
      for(let v=0;v<3;v++)c.add(new THREE.Vector3(base[f*9+v*3],base[f*9+v*3+1],base[f*9+v*3+2]));
      c.divideScalar(3);caras.push({c,n:c.clone().normalize()});
    }
    const fragPos=new Float32Array(caras.length*18);
    const gFrag=guardar(new THREE.BufferGeometry());gFrag.setAttribute('position',new THREE.BufferAttribute(fragPos,3));
    const mFrag=guardar(new THREE.LineBasicMaterial(holo({opacity:0.6})));
    const caparazon=new THREE.LineSegments(gFrag,mFrag);caparazon.frustumCulled=false;pivote.add(caparazon);
    const mHalo=guardar(new THREE.SpriteMaterial(holo({map:texHalo,opacity:0.6})));
    const halo=new THREE.Sprite(mHalo);pivote.add(halo);

    /* ---- Partículas ---- */
    const MAX=120;
    const nueva=(p,ini)=>{p.a=rand()*6.283;p.inc=Math.asin(rand()*2-1);p.r=ini?R*(0.1+rand()*0.85):R*0.1;p.s=(rand()-.5)*0.02;p.z=rand();return p;};
    const parts=[];for(let i=0;i<MAX;i++)parts.push(nueva({},true));
    const pPos=new Float32Array(MAX*3),pCol=new Float32Array(MAX*3);
    const gPart=guardar(new THREE.BufferGeometry());
    gPart.setAttribute('position',new THREE.BufferAttribute(pPos,3));gPart.setAttribute('color',new THREE.BufferAttribute(pCol,3));
    const particulas=new THREE.Points(gPart,guardar(new THREE.PointsMaterial(holo({size:0.04,map:tex,vertexColors:true}))));
    particulas.frustumCulled=false;pivote.add(particulas);

    /* ---- Cámara ---- */
    let distBase=4;
    function redimensionar(w,h){
      anchoCss=w;altoCss=h;renderer.setSize(w,h,false);camara.aspect=w/h;
      const ajuste=1.2/Math.tan(THREE.MathUtils.degToRad(camara.fov/2));
      distBase=camara.aspect<1?ajuste/camara.aspect:ajuste;camara.updateProjectionMatrix();
    }
    const v3=new THREE.Vector3();
    function proyectar(p){v3.copy(p).project(camara);return{x:(v3.x+1)/2*anchoCss,y:(1-v3.y)/2*altoCss};}
    function puntoDeAnillo(i,a=0){
      const an=anillos[anillos.length-1-(i%anillos.length)];   // 0 = interior
      const p=new THREE.Vector3(Math.cos(a)*an.rr,Math.sin(a)*an.rr,0);
      an.cardan.updateWorldMatrix(true,false);an.cardan.localToWorld(p);
      return proyectar(p);
    }

    const tmp=new THREE.Vector3(),col=new THREE.Color();
    const pintar=(arr,i,c,k)=>{arr[i*3]=c.r*k;arr[i*3+1]=c.g*k;arr[i*3+2]=c.b*k;};

    function dibujar(t,dT){
      const T=S.T,e=S.energy,paso=dT/16.7,ap=S.apertura,dk=S.destello.k;

      pivote.rotation.set(0.25+S.tilt*0.9,S.rot,0,'YXZ');
      const tb=S.temblor*0.018;
      camara.position.set((Math.random()-.5)*tb,(Math.random()-.5)*tb,distBase/S.zoom);camara.lookAt(0,0,0);

      circuitos.rotation.set(0.45+0.15*Math.sin(T*0.0002),T*0.00015,0.2);
      lineasPistas.forEach((l,i)=>{l.material.color.copy(tono(t,i*0.2,S,col));l.material.opacity=alfa(0.35,S);});
      for(let i=0;i<nodosPos.length;i++)pintar(nodosCol,i,tono(t,Math.floor(i/2)*0.2,S,col),alfa(0.8,S));
      gNodos.attributes.color.needsUpdate=true;
      const vp=Math.max(0,(e-0.3)/0.7);
      pistas.forEach((p,i)=>{
        puntoEn(p,((T*0.00025*p.sp)+p.ph)%1,tmp);
        pulPos[i*3]=tmp.x;pulPos[i*3+1]=tmp.y;pulPos[i*3+2]=tmp.z;pintar(pulCol,i,tono(t,i,S,col),vp);
      });
      gPul.attributes.position.needsUpdate=true;gPul.attributes.color.needsUpdate=true;

      escaner.rotation.set(1.15+0.3*Math.sin(T*0.00025),-T*0.0002,0.35*Math.cos(T*0.00018),'YXZ');
      anilloMarcas.rotation.z=-T*0.0002;
      mMarcas.color.copy(tono(t,0.5,S,col));mMarcas.opacity=alfa(0.6,S);
      mGuia.color.copy(tono(t,0.7,S,col));mGuia.opacity=alfa(0.3,S);
      barrido.rotation.z=T*0.002;mBarrido.color.copy(tono(t,1,S,col));mBarrido.opacity=alfa(0.9*e,S);

      anillos.forEach(({k,cardan,mA,mP,punteado})=>{
        const v=T*0.0004*(k%2?-1:1)+k;
        if(k===3)cardan.rotation.set(Math.PI/2,v,0);else if(k%2)cardan.rotation.set(v,0,0);else cardan.rotation.set(0,v,0);
        punteado.rotation.z=T*0.001;
        mA.color.copy(tono(t,k,S,col));mA.opacity=alfa(0.55,S);
        mP.color.copy(tono(t,k+0.5,S,col));mP.opacity=alfa(0.6,S);
      });

      // Núcleo: al abrirse, los fragmentos se separan y giran; la luz interior crece
      const pulso=0.5+0.5*Math.sin(T*0.004);
      nucleo.scale.setScalar((1+0.25*pulso*e)*(1+0.8*ap)*(1+0.6*dk));
      mNuc.color.copy(tono(t,0,S,col));mNuc.opacity=alfa(0.5+0.4*pulso+0.3*ap,S);
      const sep=ap*0.2,giro=ap*0.9;
      caras.forEach((f,i)=>{
        for(let v=0;v<3;v++){
          const a=v,b=(v+1)%3;
          for(const [w,src] of [[0,a],[1,b]]){
            tmp.set(base[i*9+src*3],base[i*9+src*3+1],base[i*9+src*3+2]).sub(f.c)
               .applyAxisAngle(f.n,giro).multiplyScalar(1-0.25*ap).add(f.c).addScaledVector(f.n,sep);
            const o=i*18+v*6+w*3;fragPos[o]=tmp.x;fragPos[o+1]=tmp.y;fragPos[o+2]=tmp.z;
          }
        }
      });
      gFrag.attributes.position.needsUpdate=true;
      caparazon.rotation.set(T*0.0003,T*0.0005,0);
      mFrag.color.copy(tono(t,0.2,S,col));mFrag.opacity=alfa(0.35+0.25*pulso+0.3*ap,S);
      halo.scale.setScalar(R*(0.45+0.15*pulso*e+0.35*ap+0.9*dk));
      mHalo.color.copy(tono(t,0,S,col));mHalo.opacity=alfa(0.25+0.45*pulso*e+0.3*ap+0.6*dk,S);

      const n=Math.min(MAX,S.particles|0);
      for(let i=0;i<MAX;i++){
        const p=parts[i];
        if(i<n){
          p.a+=p.s*S.mult*3*paso*(0.2+0.8*e);p.r+=0.0016*S.mult*e*paso;
          if(p.r>R*0.95)nueva(p,false);
          const c=Math.cos(p.inc)*p.r;
          pPos[i*3]=Math.cos(p.a)*c;pPos[i*3+1]=Math.sin(p.inc)*p.r;pPos[i*3+2]=Math.sin(p.a)*c;
          pintar(pCol,i,tono(t,i*0.1,S,col),(0.3+0.6*p.z)*e*(1-Math.max(0,(p.r-R*0.75)/(R*0.2))));
        }else pintar(pCol,i,col.setRGB(0,0,0),0);
      }
      gPart.attributes.position.needsUpdate=true;gPart.attributes.color.needsUpdate=true;

      renderer.render(escena,camara);
    }

    function destruir(){
      halo.geometry.dispose();recursos.forEach(r=>r.dispose&&r.dispose());
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    }
    return {redimensionar,dibujar,destruir,proyectar,puntoDeAnillo};
  }
};
