const $=s=>document.querySelector(s);
let currentImage=null, currentPdf=null, worker=null, records=[], pctt=[];
let headers=[
"Caixa","Setor","Código PCTT","Assunto/Atividade","Descrição","Data inicial","Data final",
"Quantidade","Observação","Situação da Revisão","Caixa atual diz que tem documento?"
];

function status(t,c=""){ $("#status").textContent=t; $("#status").className=c; }
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

function makeForm(){
 const el=$("#form"); el.innerHTML="";
 const grid=document.createElement("div"); grid.className="grid";
 headers.forEach(h=>{
   const lab=document.createElement("label"); lab.className="field"; lab.innerHTML=`${escapeHtml(h)}<small>${APP_CONFIG.dropdowns[h]?"preenchimento manual":"preenchido pelo OCR/PCTT quando possível"}</small>`;
   let input;
   if(APP_CONFIG.dropdowns[h]){
     input=document.createElement("select"); input.innerHTML='<option value="">— selecionar —</option>'+APP_CONFIG.dropdowns[h].map(x=>`<option>${escapeHtml(x)}</option>`).join("");
   }else if(h==="Observação"){
     input=document.createElement("textarea");
   }else{
     input=document.createElement("input");
   }
   input.dataset.field=h; lab.appendChild(input); grid.appendChild(lab);
 });
 el.appendChild(grid);
}
makeForm();

$("#imageInput").addEventListener("change",e=>{
 const f=e.target.files[0]; if(!f)return;
 const rd=new FileReader(); rd.onload=()=>{currentImage=rd.result;$("#preview").innerHTML=`<img class="thumb" src="${currentImage}">`;$("#ocrBtn").disabled=false;currentPdf=null;};rd.readAsDataURL(f);
});
$("#pdfInput").addEventListener("change",e=>{
 const f=e.target.files[0]; if(!f)return; currentPdf=f; currentImage=null; $("#preview").innerHTML="<p>PDF selecionado. Clique em Ler documento com OCR.</p>"; $("#ocrBtn").disabled=false;
});

async function imageFromPdf(file){
 const data=await file.arrayBuffer();
 const pdf=await pdfjsLib.getDocument({data}).promise;
 const page=await pdf.getPage(1);
 const vp=page.getViewport({scale:2.2});
 const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;
 await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
 return c.toDataURL("image/jpeg",.95);
}
function preprocess(data){
 return new Promise(resolve=>{
  const im=new Image(); im.onload=()=>{
   const scale=Math.min(2.2,2400/Math.max(im.width,im.height));
   const c=document.createElement("canvas");c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);
   const x=c.getContext("2d");x.drawImage(im,0,0,c.width,c.height);
   const d=x.getImageData(0,0,c.width,c.height), a=d.data;
   for(let i=0;i<a.length;i+=4){let g=.299*a[i]+.587*a[i+1]+.114*a[i+2];g=g<150?g*.78:g*1.12;a[i]=a[i+1]=a[i+2]=Math.max(0,Math.min(255,g));}
   x.putImageData(d,0,0);resolve(c.toDataURL("image/png"));
  }; im.src=data;
 });
}
$("#ocrBtn").onclick=async()=>{
 try{
  $("#ocrBtn").disabled=true;$("#bar").style.width="5%";status("Preparando imagem...");
  let img=currentImage||await imageFromPdf(currentPdf); img=await preprocess(img);
  if(!worker) worker=await Tesseract.createWorker("por",1,{logger:m=>{if(m.progress)$("#bar").style.width=Math.round(m.progress*100)+"%";}});
  status("Lendo documento...");
  const r=await worker.recognize(img); $("#ocrText").value=r.data.text||"";
  $("#bar").style.width="100%";status("OCR concluído. Revise o texto e clique em Classificar pelo PCTT.","ok");
  fillFromText(r.data.text||"");
 }catch(e){console.error(e);status("Erro no OCR: "+e.message,"err");}finally{$("#ocrBtn").disabled=false;}
};

function normalize(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function tokens(s){return normalize(s).split(/\s+/).filter(x=>x.length>2);}
function score(text,row){
 const tt=new Set(tokens(text)), rr=tokens([row.Codificacao,row.Codigo,row.Assunto,row.Classe,row.Subclasse,row.Atividade].join(" "));
 let hit=0; for(const x of rr) if(tt.has(x)) hit++;
 return rr.length?hit/Math.sqrt(rr.length):0;
}
function classify(){
 const text=$("#ocrText").value.trim(); if(!text){status("Nenhum texto para classificar.","warn");return;}
 if(!pctt.length){$("#matches").innerHTML="<p class='warn'>Nenhum PCTT foi carregado. Use o botão 'Carregar PCTT'.</p>";return;}
 const arr=pctt.map(r=>({...r,_score:score(text,r)})).sort((a,b)=>b._score-a._score).slice(0,8);
 $("#matches").innerHTML=arr.map((r,i)=>`<div class="match" onclick='selectPCTT(${i})'><strong>${escapeHtml(r.Codificacao||r.Codigo||"")} — ${escapeHtml(r.Assunto||r.Atividade||"")}</strong><span class="badge">correspondência ${Math.round(r._score*100)}%</span><div>${escapeHtml(r.Atividade||"")}</div></div>`).join("");
 window._matches=arr;
}
window.selectPCTT=i=>{
 const r=window._matches[i]; $("#pcttDetails").innerHTML=`<b>Código:</b> ${escapeHtml(r.Codificacao||r.Codigo)}<br><b>Assunto:</b> ${escapeHtml(r.Assunto)}<br><b>Classe:</b> ${escapeHtml(r.Classe)}<br><b>Subclasse:</b> ${escapeHtml(r.Subclasse)}<br><b>Atividade:</b> ${escapeHtml(r.Atividade)}<br><b>Corrente:</b> ${escapeHtml(r["Arquivo Corrente"]||"")}<br><b>Intermediário:</b> ${escapeHtml(r["Arquivo Intermediário"]||"")}<br><b>Destinação:</b> ${escapeHtml(r["Destinação Final"]||"")}`;
 set("Código PCTT",r.Codificacao||r.Codigo||"");set("Assunto/Atividade",r.Atividade||r.Assunto||"");
};
function set(h,v){const e=document.querySelector(`[data-field="${CSS.escape(h)}"]`);if(e&&!e.value)e.value=v;}
function fillFromText(t){
 const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
 const all=t.replace(/\s+/g," ");
 const num=all.match(/\b(?:caixa|cx)[\s:.-]*(\d{1,6})\b/i); if(num)set("Caixa",num[1]);
 const dates=[...all.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/g)].map(m=>m[1]);
 if(dates[0])set("Data inicial",dates[0]); if(dates[1])set("Data final",dates[1]);
 const q=all.match(/\b(?:qtd|quantidade|quant)[\s:.-]*(\d+)\b/i);if(q)set("Quantidade",q[1]);
 let best=APP_CONFIG.sectors.find(s=>normalize(all).includes(normalize(s)));
 if(best)set("Setor",best);
}
$("#classifyBtn").onclick=classify;

function addRecord(){
 const o={}; document.querySelectorAll("[data-field]").forEach(e=>o[e.dataset.field]=e.value);
 if(!o["Situação da Revisão"])o["Situação da Revisão"]="Dúvida";
 records.push(o);renderRecords();
}
$("#addBtn").onclick=addRecord;
function renderRecords(){
 $("#records").innerHTML=records.length?records.map((r,i)=>`<div class="record"><b>#${i+1}</b> — Caixa: ${escapeHtml(r.Caixa)} — ${escapeHtml(r["Código PCTT"])} — ${escapeHtml(r["Assunto/Atividade"])}<br><small>${escapeHtml(r.Descrição)}</small> <button onclick="removeRecord(${i})">Excluir</button></div>`).join(""):"<p class='muted'>Nenhum registro.</p>";
}
window.removeRecord=i=>{records.splice(i,1);renderRecords()};

$("#exportBtn").onclick=()=>{
 if(!records.length){status("Adicione pelo menos um registro.","warn");return;}
 const rows=records.map(r=>{const o={};headers.forEach(h=>o[h]=r[h]||"");return o});
 const ws=XLSX.utils.json_to_sheet(rows,{header:headers});
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Inventário");
 XLSX.writeFile(wb,"Inventario_TRF2_PCTT_OCR.xlsx");
};
const pcttInput=document.createElement("input");pcttInput.type="file";pcttInput.accept=".xlsx,.xls,.csv";pcttInput.style.display="none";document.body.appendChild(pcttInput);
const pcttBtn=document.createElement("button");pcttBtn.textContent="📚 Carregar PCTT (Excel)";document.querySelector("#matches").before(pcttBtn);
pcttBtn.onclick=()=>pcttInput.click();
pcttInput.onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 const ab=await f.arrayBuffer();const wb=XLSX.read(ab,{type:"array"});
 const sh=wb.Sheets[wb.SheetNames.find(n=>/PCTT JF/i.test(n))||wb.SheetNames[0]];
 pctt=XLSX.utils.sheet_to_json(sh,{defval:""});
 status(`PCTT carregado: ${pctt.length} registros.`,"ok");
};
renderRecords();
