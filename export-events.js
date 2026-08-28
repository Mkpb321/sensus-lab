/* Sensus Lab – Bildexport, JSON-Import, Ereignisbindung, Tastatursteuerung und App-Initialisierung. */
"use strict";

function exportTextLines(text,maxWidth,font){
  const canvas=exportTextLines._canvas||(exportTextLines._canvas=document.createElement("canvas"));
  const ctx=canvas.getContext("2d");
  ctx.font=font;
  const paragraphs=String(text??"").replace(/\r\n?/g,"\n").split("\n");
  const lines=[];
  const splitOversizeWord=(word)=>{
    if(ctx.measureText(word).width<=maxWidth) return [word];
    const parts=[]; let part="";
    for(const ch of Array.from(word)){
      const candidate=part+ch;
      if(part && ctx.measureText(candidate).width>maxWidth){parts.push(part);part=ch;}
      else part=candidate;
    }
    if(part) parts.push(part);
    return parts;
  };
  for(let pi=0;pi<paragraphs.length;pi++){
    const words=paragraphs[pi].trim().split(/\s+/).filter(Boolean).flatMap(splitOversizeWord);
    if(!words.length){
      if(pi<paragraphs.length-1) lines.push("");
      continue;
    }
    let line="";
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(line && ctx.measureText(candidate).width>maxWidth){lines.push(line);line=word;}
      else line=candidate;
    }
    if(line) lines.push(line);
    if(pi<paragraphs.length-1) lines.push("");
  }
  while(lines.length>1 && lines[lines.length-1]==="") lines.pop();
  return lines.length?lines:[""];
}
function exportMeasureText(text,font){
  const canvas=exportTextLines._canvas||(exportTextLines._canvas=document.createElement("canvas"));
  const ctx=canvas.getContext("2d");
  ctx.font=font;
  return ctx.measureText(String(text??"")).width;
}
function exportRelationStyle(node){
  const rel=RELATIONSHIPS[node.relationshipId];
  if(node.relationshipId==null) return {rel:null,color:"#98a2b3",dash:"7 6",width:1.8};
  if(!rel) return {rel:null,color:"#98a2b3",dash:"5 5",width:1.8};
  return {rel,color:relationshipColor(rel,node.relationshipId),dash:"",width:1.85};
}
function exportCodeParts(code){
  return String(code??"").split("/").map(part=>part.trim()).filter(Boolean);
}
function exportLegendSections(data){
  const relationItems=[];
  const relationSeen=new Set();
  for(const {node} of data){
    const key=node.relationshipId==null?"__open__":String(node.relationshipId);
    if(relationSeen.has(key)) continue;
    relationSeen.add(key);
    const rel=RELATIONSHIPS[node.relationshipId];
    relationItems.push({
      code:relationShortCode(node),
      label:relationLegendLabel(node),
      color:node.relationshipId==null?"#98a2b3":relationshipColor(rel,node.relationshipId),
      dash:node.relationshipId==null?"7 6":"",
      kind:"relation"
    });
  }

  // Ein Rollenkürzel wird nur dann durch ein vertikales Kürzel ersetzt, wenn
  // genau die Beziehung, an deren Linie diese Rolle steht, es selbst enthält.
  // Taucht dasselbe Kürzel lediglich bei einer anderen Beziehung auf, bleibt
  // der Rolleneintrag in der Legende erhalten.
  const roleUsage=new Map();
  for(const {node} of data){
    const rel=RELATIONSHIPS[node.relationshipId];
    if(!rel || rel.primary==="all") continue;
    const localRelationParts=new Set(exportCodeParts(relationShortCode(node)));
    (node.roleOrder||[]).forEach((fullRole,i)=>{
      const roleLabel=String(fullRole||`Teil ${i+1}`);
      const code=compactRole(roleLabel);
      if(!code) return;
      const entry=roleUsage.get(code)||{code,label:roleLabel,needsLegend:false,kind:"role"};
      if(!localRelationParts.has(code)) entry.needsLegend=true;
      roleUsage.set(code,entry);
    });
  }
  const roleItems=[...roleUsage.values()].filter(item=>item.needsLegend).map(({needsLegend,...item})=>item);

  const sections=[];
  if(relationItems.length) sections.push({title:"Beziehungen",items:relationItems,kind:"relation"});
  if(roleItems.length) sections.push({title:"Rollen",items:roleItems,kind:"role"});
  return sections;
}
function buildPublicationExportSvg(){
  // Publikations-Renderer: bewusst keine App-Oberfläche nachzeichnen.
  // Die Ausgabe besteht nur aus Titel, Analysezeichnung, Text und einer kompakten Legende.
  const pageX=34;
  const pageTop=30;
  const pageBottom=30;
  const textWidth=720;
  const graphTextGap=8;
  const rowPadY=9;
  const rowGap=2;
  const propFontSize=17;
  const propLineH=25;
  const propMinH=48;
  const roleMaxWidth=82;
  const relationLabelMaxWidth=74;
  const fontStack='system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  const ink="#172230";
  const muted="#667085";
  const hairline="#e3e8ef";

  const title=String(state.title||"").trim();
  const summary=String(state.mainPointSummary||"").trim();
  const titleLines=title?exportTextLines(title,1000,`700 27px ${fontStack}`):[];
  const summaryLines=summary?exportTextLines(summary,1000,`400 13px ${fontStack}`):[];
  const titleLineH=33;
  const summaryLineH=20;
  let contentTop=pageTop;
  if(titleLines.length) contentTop+=titleLines.length*titleLineH;
  if(summaryLines.length) contentTop+=(titleLines.length?5:0)+summaryLines.length*summaryLineH;
  if(titleLines.length||summaryLines.length) contentTop+=18;

  // Propositionen zuerst vollständig vermessen; ihre Mittelpunkte sind die alleinige Y-Wahrheit
  // für Text, Klammern, Rollenlabels und Hauptpunkt-Anschlüsse.
  const propFont=`500 ${propFontSize}px ${fontStack}`;
  const propLayouts=[];
  const anchorMap=new Map();
  let y=contentTop;
  for(let i=0;i<state.propositions.length;i++){
    const p=state.propositions[i];
    const raw=state.tokens.slice(p.tokenStart,p.tokenEnd+1).join("");
    const lines=exportTextLines(raw,textWidth,propFont);
    const textH=Math.max(propLineH,lines.length*propLineH);
    const h=Math.max(propMinH,textH+rowPadY*2);
    const top=y;
    const bottom=top+h;
    const center=(top+bottom)/2;
    propLayouts.push({p,index:i,raw,lines,top,bottom,center,h});
    anchorMap.set(p.id,{top,bottom,center});
    y=bottom+rowGap;
  }
  const contentBottom=propLayouts.length?propLayouts[propLayouts.length-1].bottom:contentTop+60;

  // Geometrie aus denselben absoluten Ankern berechnen. Kein zweites Koordinatensystem,
  // damit verschachtelte Beziehungen niemals in den Kopfbereich springen können.
  const data=relationLayoutData(anchorMap);
  const geometry=computeAdaptiveBracketGeometry(data);
  const maxDepth=data.length?geometry.maxDepth:0;
  const graphWidth=data.length
    ? Math.ceil(geometry.leftGutter+geometry.cumulative[maxDepth]+geometry.rightGutter+4)
    : 0;
  const textX=pageX+(graphWidth?graphWidth+graphTextGap:0);
  const canvasW=Math.ceil(textX+textWidth+pageX);
  const bracketRight=graphWidth?textX-10:pageX;
  const xForDepth=(depth)=>bracketRight-geometry.cumulative[depth];
  const xById=new Map(data.map(item=>[item.node.id,xForDepth(item.depth)]));
  const portMemo=new Map();

  // Rollenlabels werden als kurze Cutouts direkt auf ihrer Linie platziert.
  const rolePlacementByKey=new Map();
  for(const item of data){
    const {node}=item;
    const {rel}=exportRelationStyle(node);
    if(!rel || rel.primary==="all") continue;
    const x=xById.get(node.id);
    const parentHalf=(geometry.relationMetricsById.get(node.id)?.metrics.height||0)/2;
    const maxRoleWidth=Math.min(roleMaxWidth,geometry.maxRoleWidthByNode.get(node.id)||0);
    const commonX=x+parentHalf+14+maxRoleWidth/2+3;
    (node.children||[]).forEach((childId,i)=>{
      const cy=bracketNodePortY(childId,anchorMap,portMemo);
      if(!Number.isFinite(cy)) return;
      const child=getNode(childId);
      const targetX=child&&child.kind==="relation"?(xById.get(childId)??bracketRight):bracketRight;
      const fullRole=node.roleOrder[i]||`Teil ${i+1}`;
      const shortRole=compactRole(fullRole);
      const lines=[shortRole];
      const metrics=bracketTextMetrics(lines,{minWidth:16,maxWidth:roleMaxWidth,charWidth:4.7,lineHeight:9.2,padX:3.2,padY:1.8});
      const minX=x+parentHalf+14+metrics.width/2+3;
      const maxX=targetX-metrics.width/2-3;
      const rx=Math.max(minX,Math.min(commonX,maxX));
      rolePlacementByKey.set(`${node.id}:${i}`,{rx,cy,lines,metrics,fullRole});
    });
  }

  // Legende: horizontale Kürzel nur aufnehmen, wenn sie nicht bereits als Teil
  // eines verwendeten vertikalen Beziehungskürzels erklärt sind.
  const legendSections=exportLegendSections(data);
  const legendStartY=contentBottom+28;
  const legendContentW=canvasW-pageX*2;
  const legendRowH=19;
  const legendSectionTitleH=20;
  const legendSectionGap=12;
  const legendLayouts=[];
  let legendY=legendStartY;
  for(const section of legendSections){
    const count=section.items.length;
    if(!count) continue;
    const columns=Math.min(3,Math.max(1,Math.ceil(count/5)));
    const rows=Math.ceil(count/columns);
    const h=legendSectionTitleH+rows*legendRowH;
    legendLayouts.push({...section,columns,rows,y:legendY,h,colW:legendContentW/columns});
    legendY+=h+legendSectionGap;
  }
  const legendHeight=legendLayouts.length?legendY-legendStartY-legendSectionGap:0;
  const canvasH=Math.ceil((legendHeight?legendStartY+legendHeight:contentBottom)+pageBottom);

  const pieces=[];
  const overlays=[];
  pieces.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`);
  pieces.push(`<rect width="${canvasW}" height="${canvasH}" fill="#ffffff"/>`);
  pieces.push(`<style>
    text{font-family:${fontStack};text-rendering:auto;font-kerning:normal}
    .pub-line{fill:none;stroke-linecap:square;stroke-linejoin:miter}
    .pub-rel{font-size:10px;font-weight:700;text-anchor:middle;letter-spacing:.005em}
    .pub-role{font-size:9.5px;font-weight:600;fill:#475467;text-anchor:middle}
    .pub-prop{font-size:${propFontSize}px;font-weight:500;fill:${ink}}
  </style>`);

  // Ruhiger Kopf ohne Metadaten-/App-Zeile.
  let headerY=pageTop+4;
  if(titleLines.length){
    pieces.push(`<text x="${pageX}" y="${headerY}" font-size="27" font-weight="700" letter-spacing="-.02em" fill="${ink}">${titleLines.map((line,i)=>`<tspan x="${pageX}" dy="${i===0?0:titleLineH}">${safeSvgText(line)}</tspan>`).join("")}</text>`);
    headerY+=titleLines.length*titleLineH;
  }
  if(summaryLines.length){
    if(titleLines.length) headerY+=2;
    pieces.push(`<text x="${pageX}" y="${headerY}" font-size="13" font-weight="400" fill="${muted}">${summaryLines.map((line,i)=>`<tspan x="${pageX}" dy="${i===0?0:summaryLineH}">${safeSvgText(line)}</tspan>`).join("")}</text>`);
  }
  if(titleLines.length||summaryLines.length){
    pieces.push(`<line x1="${pageX}" y1="${contentTop-10}" x2="${canvasW-pageX}" y2="${contentTop-10}" stroke="${hairline}" stroke-width="1"/>`);
  }

  // Propositionen: nur Text und feine Satzlinien – keine Tabellenflächen oder Karten.
  propLayouts.forEach((item,i)=>{
    const firstY=item.center-((item.lines.length-1)*propLineH)/2+5.5;
    pieces.push(`<text class="pub-prop" x="${textX}" y="${firstY}">${item.lines.map((line,li)=>`<tspan x="${textX}" dy="${li===0?0:propLineH}">${safeSvgText(line)}</tspan>`).join("")}</text>`);
    if(i<propLayouts.length-1){
      const sepY=item.bottom+rowGap/2;
      pieces.push(`<line x1="${textX}" y1="${sepY}" x2="${textX+textWidth}" y2="${sepY}" stroke="${hairline}" stroke-width="1"/>`);
    }
  });

  // Klammerzeichnung.
  for(const item of data){
    const {node}=item;
    const {rel,color,dash,width}=exportRelationStyle(node);
    const x=xById.get(node.id);
    const childPorts=(node.children||[]).map(cid=>bracketNodePortY(cid,anchorMap,portMemo));
    const ports=childPorts.filter(Number.isFinite);
    if(!ports.length) continue;
    const topY=Math.min(...ports),bottomY=Math.max(...ports);
    const dashAttr=dash?` stroke-dasharray="${dash}"`:"";
    const relationTitle=rel?rel.label:"Offene Gruppe";
    const short=relationShortCode(node);
    const relationLines=[short];
    const relationMetrics=bracketTextMetrics(relationLines,{minWidth:18,maxWidth:relationLabelMaxWidth,charWidth:4.65,lineHeight:9.4,padX:3.3,padY:1.8});
    const labelScreenH=relationMetrics.width;
    const labelScreenW=relationMetrics.height;
    const labelY=(topY+bottomY)/2;
    const labelTop=labelY-labelScreenH/2;
    const labelBottom=labelY+labelScreenH/2;

    if(topY!==bottomY){
      if(labelTop>topY+3) pieces.push(`<path class="pub-line" d="M ${x} ${topY} V ${labelTop}" stroke="${color}" stroke-width="${width}"${dashAttr}/>`);
      if(labelBottom<bottomY-3) pieces.push(`<path class="pub-line" d="M ${x} ${labelBottom} V ${bottomY}" stroke="${color}" stroke-width="${width}"${dashAttr}/>`);
    }

    (node.children||[]).forEach((childId,i)=>{
      const cy=childPorts[i];
      if(!Number.isFinite(cy)) return;
      const child=getNode(childId);
      const targetX=child&&child.kind==="relation"?(xById.get(childId)??bracketRight):bracketRight;
      const primary=(node.primaryChildIds||[]).includes(childId);
      const hasStar=primary && !!rel && rel.primary!=="all";
      const startX=(cy>=labelTop-2&&cy<=labelBottom+2)?x+labelScreenW/2:x;
      const branchWidth=hasStar&&uiSettings.emphasizePrimaryLines!==false?width*2:width;
      pieces.push(`<path class="pub-line" d="M ${startX} ${cy} H ${targetX}" stroke="${color}" stroke-width="${branchWidth}"${dashAttr}/>`);

      const placement=rolePlacementByKey.get(`${node.id}:${i}`);
      if(placement){
        const {rx,cy:roleY,lines,metrics,fullRole}=placement;
        overlays.push(`<g><title>${safeSvgText(fullRole)}</title>`);
        overlays.push(`<rect x="${rx-metrics.width/2-2}" y="${roleY-metrics.height/2-1}" width="${metrics.width+4}" height="${metrics.height+2}" fill="#ffffff"/>`);
        overlays.push(svgMultilineText(lines,rx,roleY,"pub-role",null,metrics.lineHeight));
        overlays.push(`</g>`);
      }
      if(hasStar){
        const sx=startX+8;
        pieces.push(`<text x="${sx}" y="${cy}" text-anchor="middle" font-size="8" font-weight="700" fill="${color}" dominant-baseline="middle" alignment-baseline="middle">★</text>`);
      }
    });

    overlays.push(`<g><title>${safeSvgText(relationTitle)}</title>`);
    overlays.push(`<rect x="${x-relationMetrics.width/2-2}" y="${labelY-relationMetrics.height/2-1}" width="${relationMetrics.width+4}" height="${relationMetrics.height+2}" fill="#ffffff" transform="rotate(-90 ${x} ${labelY})"/>`);
    overlays.push(svgMultilineText(relationLines,x,labelY,"pub-rel",color,relationMetrics.lineHeight).replace('<text ','<text transform="rotate(-90 '+x+' '+labelY+')" '));
    overlays.push(`</g>`);
  }
  pieces.push(...overlays);

  // Kompakte, druckartige Legende ohne umschließende Karte.
  if(legendLayouts.length){
    pieces.push(`<line x1="${pageX}" y1="${legendStartY-13}" x2="${canvasW-pageX}" y2="${legendStartY-13}" stroke="${hairline}" stroke-width="1"/>`);
    pieces.push(`<text x="${pageX}" y="${legendStartY}" font-size="11" font-weight="700" fill="${ink}" letter-spacing=".02em">LEGENDE</text>`);
    const legendBaseY=legendStartY+18;
    let priorOffset=0;
    legendLayouts.forEach(section=>{
      const sy=legendBaseY+priorOffset;
      pieces.push(`<text x="${pageX}" y="${sy}" font-size="10" font-weight="700" fill="${muted}" letter-spacing=".04em">${safeSvgText(section.title.toUpperCase())}</text>`);
      const itemTop=sy+15;
      section.items.forEach((entry,index)=>{
        const col=Math.floor(index/section.rows);
        const row=index%section.rows;
        const ix=pageX+col*section.colW;
        const iy=itemTop+row*legendRowH;
        const codeX=ix+22;
        if(entry.kind==="relation"){
          const d=entry.dash?` stroke-dasharray="${entry.dash}"`:"";
          pieces.push(`<line x1="${ix}" y1="${iy-4}" x2="${ix+14}" y2="${iy-4}" stroke="${entry.color}" stroke-width="2"${d}/>`);
        }else{
          pieces.push(`<text x="${ix+7}" y="${iy}" text-anchor="middle" font-size="9" font-weight="700" fill="#667085">·</text>`);
        }
        pieces.push(`<text x="${codeX}" y="${iy}" font-size="10.5" font-weight="700" fill="${ink}">${safeSvgText(entry.code)}</text>`);
        const codeW=exportMeasureText(entry.code,`700 10.5px ${fontStack}`);
        pieces.push(`<text x="${codeX+codeW+6}" y="${iy}" font-size="10.5" font-weight="400" fill="${muted}">${safeSvgText(entry.label)}</text>`);
      });
      priorOffset+=section.h+legendSectionGap;
    });
  }

  pieces.push(`</svg>`);
  return {svg:pieces.join(""),width:canvasW,height:canvasH};
}
async function exportImage(){
  if(!state.rawText || !state.propositions.length){
    announce("Bitte zuerst eine Analyse anlegen, bevor du ein Bild exportierst.");
    return;
  }
  const button=els.exportButton;
  const oldText=button.textContent;
  button.disabled=true;
  button.textContent="Exportiere …";
  try{
    const out=buildPublicationExportSvg();
    const svgBlob=new Blob([out.svg],{type:"image/svg+xml;charset=utf-8"});
    const svgUrl=URL.createObjectURL(svgBlob);
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=()=>reject(new Error("Exportgrafik konnte nicht gerendert werden."));
        img.src=svgUrl;
      });
      const scale=Math.min(2.25,10000/out.width,10000/out.height);
      if(!(scale>0)) throw new Error("Ungültige Exportgröße.");
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(out.width*scale));
      canvas.height=Math.max(1,Math.round(out.height*scale));
      const ctx=canvas.getContext("2d");
      if(!ctx) throw new Error("Canvas ist in diesem Browser nicht verfügbar.");
      ctx.fillStyle="#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,"image/png",1));
      if(!png) throw new Error("PNG konnte nicht erzeugt werden.");
      downloadBlob(png,`${exportBaseFilename()}.png`);
      announce("Optimiertes Bild als PNG exportiert");
    }finally{URL.revokeObjectURL(svgUrl);}
  }catch(err){
    console.error("Bildexport fehlgeschlagen:",err);
    try{
      const out=buildPublicationExportSvg();
      downloadBlob(new Blob([out.svg],{type:"image/svg+xml;charset=utf-8"}),`${exportBaseFilename()}.svg`);
      announce("PNG-Export war nicht möglich; die optimierte Grafik wurde als SVG exportiert.");
    }catch(fallbackErr){
      alert(`Bildexport fehlgeschlagen: ${fallbackErr.message||fallbackErr}`);
    }
  }finally{
    button.disabled=false;
    button.textContent=oldText;
  }
}
async function importJsonFile(file){
  try{
    const text=await file.text();
    const parsed=JSON.parse(text);
    if(parsed.schemaVersion!==1) throw new Error("Unbekannte schemaVersion. Erwartet wird Version 1.");
    const previous=snapshot();
    hydrateState(parsed);
    history.push(previous); if(history.length>MAX_HISTORY)history.shift(); future=[];
    state.updatedAt=new Date().toISOString();
    render(); schedulePersist(); announce("JSON importiert");
  }catch(err){
    alert(`Import fehlgeschlagen: ${err.message||err}`);
  }finally{
    els.importInput.value="";
  }
}

function renderSignalTable(){
  els.signalTableBody.innerHTML=SIGNAL_WORDS.map(row=>`<tr>${row.map(cell=>`<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
}

function moveFocusAmongUnits(current,delta){
  const controls=$$(".unit-chip:not(:disabled),.unit-anchor:not(:disabled)",document).filter(el=>el.offsetParent!==null);
  const i=controls.indexOf(current);
  if(i<0 || !controls.length) return;
  controls[(i+delta+controls.length)%controls.length].focus();
}

els.textButton.addEventListener("click",openTextDialog);
els.rawTextInput.addEventListener("input",()=>{els.applyTextButton.disabled=!els.rawTextInput.value.trim();});
els.textForm.addEventListener("submit",e=>{e.preventDefault();applyTextFromDialog();});
els.editModeButton.addEventListener("click",()=>setMode("bearbeiten"));
els.viewModeButton.addEventListener("click",()=>setMode("ansicht"));
els.splitToolButton.addEventListener("click",()=>setTool("teilen"));
els.connectToolButton.addEventListener("click",()=>setTool("verbinden"));
els.undoButton.addEventListener("click",undo);
els.redoButton.addEventListener("click",redo);
els.helpButton.addEventListener("click",()=>{closeProjectMenu();showDialog(els.helpDialog);});
els.resetButton.addEventListener("click",()=>{closeProjectMenu();resetAll();});
els.extendedToggle.addEventListener("change",e=>setExtended(e.target.checked));
els.statusDetailsButton.addEventListener("click",openStatusDetails);
els.exportButton.addEventListener("click",()=>{closeProjectMenu();exportImage();});
els.jsonExportButton.addEventListener("click",()=>{closeProjectMenu();exportJson();});
els.importButton.addEventListener("click",()=>{closeProjectMenu();els.importInput.click();});
els.importInput.addEventListener("change",e=>{if(e.target.files&&e.target.files[0]) importJsonFile(e.target.files[0]);});
els.projectMenuButton.addEventListener("click",e=>{e.stopPropagation();toggleProjectMenu();});
window.addEventListener("resize",()=>{if(els.projectMenu && !els.projectMenu.hidden) positionProjectMenu();});
els.projectManagerButton.addEventListener("click",e=>{e.stopPropagation();openProjectManager();});
els.settingsMenuButton.addEventListener("click",e=>{e.stopPropagation();openSettingsDialog();});
els.lineAttachmentToggle.addEventListener("change",e=>{
  setLineAttachmentMode(e.target.checked?"primary":"center");
});
els.primaryLineWeightToggle.addEventListener("change",e=>{
  setPrimaryLineEmphasis(e.target.checked);
});
els.newProjectButton.addEventListener("click",()=>createNewProject());
els.projectList.addEventListener("click",e=>{
  const rename=e.target.closest("[data-project-rename]");
  if(rename){ renameProject(rename.dataset.projectRename); return; }
  const del=e.target.closest("[data-project-delete]");
  if(del){ deleteProject(del.dataset.projectDelete); return; }
  const opener=e.target.closest("[data-project-open]");
  if(opener){ activateProject(opener.dataset.projectOpen); }
});

let workspaceDividerDrag=null;
function workspaceSplitFromClientX(clientX){
  const rect=els.canvasGrid?.getBoundingClientRect();
  if(!rect || rect.width<=0) return null;
  return normalizeProjectWorkspaceSplit((clientX-rect.left)/rect.width);
}
if(els.workspaceDivider){
  els.workspaceDivider.addEventListener("pointerdown",e=>{
    if(e.button!==0) return;
    workspaceDividerDrag={pointerId:e.pointerId};
    els.workspaceDivider.setPointerCapture?.(e.pointerId);
    els.workspaceDivider.classList.add("dragging");
    document.body.classList.add("resizing-workspace");
    e.preventDefault();
  });
  els.workspaceDivider.addEventListener("pointermove",e=>{
    if(!workspaceDividerDrag || workspaceDividerDrag.pointerId!==e.pointerId) return;
    const split=workspaceSplitFromClientX(e.clientX);
    if(split!=null) setWorkspaceSplit(split);
  });
  const finishWorkspaceDividerDrag=e=>{
    if(!workspaceDividerDrag || (e.pointerId!=null && workspaceDividerDrag.pointerId!==e.pointerId)) return;
    workspaceDividerDrag=null;
    els.workspaceDivider.classList.remove("dragging");
    document.body.classList.remove("resizing-workspace");
    const project=activeProject();
    if(project) setWorkspaceSplit(project.workspaceSplit,{persist:true});
  };
  els.workspaceDivider.addEventListener("pointerup",finishWorkspaceDividerDrag);
  els.workspaceDivider.addEventListener("pointercancel",finishWorkspaceDividerDrag);
  els.workspaceDivider.addEventListener("keydown",e=>{
    if(e.key!=="ArrowLeft" && e.key!=="ArrowRight" && e.key!=="Home" && e.key!=="End") return;
    const project=activeProject();
    const current=normalizeProjectWorkspaceSplit(project?.workspaceSplit);
    const next=e.key==="Home"?.25:e.key==="End"?.72:current+(e.key==="ArrowRight"?.025:-.025);
    setWorkspaceSplit(next,{persist:true});
    e.preventDefault();
  });
}

// Diagramm-Tooltip: bewusst unabhängig von SVG-<title>, damit er in allen Browsern
// zuverlässig sowohl auf horizontalen als auch vertikalen Kästchen funktioniert.
const diagramTooltip=(()=>{
  const el=document.createElement("div");
  el.className="diagram-tooltip";
  el.setAttribute("role","tooltip");
  document.body.appendChild(el);
  return el;
})();
function positionDiagramTooltip(e){
  const gap=12;
  const rect=diagramTooltip.getBoundingClientRect();
  let x=e.clientX+gap, y=e.clientY+gap;
  if(x+rect.width>window.innerWidth-8) x=e.clientX-rect.width-gap;
  if(y+rect.height>window.innerHeight-8) y=e.clientY-rect.height-gap;
  diagramTooltip.style.left=Math.max(8,x)+"px";
  diagramTooltip.style.top=Math.max(8,y)+"px";
}
els.bracketSvg.addEventListener("pointerover",e=>{
  const hit=e.target.closest("[data-diagram-tooltip]");
  if(!hit) return;
  diagramTooltip.textContent=hit.dataset.diagramTooltip||"";
  diagramTooltip.classList.add("visible");
  positionDiagramTooltip(e);
});
els.bracketSvg.addEventListener("pointermove",e=>{
  if(diagramTooltip.classList.contains("visible")) positionDiagramTooltip(e);
});
els.bracketSvg.addEventListener("pointerout",e=>{
  const hit=e.target.closest("[data-diagram-tooltip]");
  if(!hit) return;
  const next=e.relatedTarget;
  if(next && next.closest && next.closest("[data-diagram-tooltip]")===hit) return;
  diagramTooltip.classList.remove("visible");
});
els.bracketSvg.addEventListener("pointerleave",()=>diagramTooltip.classList.remove("visible"));

els.propList.addEventListener("click",e=>{
  const empty=e.target.closest("[data-empty-text]"); if(empty){openTextDialog();return;}
  const split=e.target.closest("[data-split-token]"); if(split){splitBefore(Number(split.dataset.splitToken));return;}
  const merge=e.target.closest("[data-merge-index]"); if(merge){mergeAtPropIndex(Number(merge.dataset.mergeIndex));return;}
  const unit=e.target.closest("[data-unit-id]"); if(unit){handleUnitClick(unit.dataset.unitId);}
});
els.unitButtons.addEventListener("click",e=>{
  const unit=e.target.closest("[data-unit-id]"); if(unit) handleUnitClick(unit.dataset.unitId);
});
els.bracketSvg.addEventListener("click",e=>{
  // 1) Horizontale Rollenkästchen: niemals klickbar. Sie haben ausschließlich Tooltip-Funktion.
  if(e.target.closest(".role-label-hit")) return;

  // 2) Vertikale Beziehungskästchen: nur Bearbeiten → Verbinden öffnet die Beziehungsbearbeitung.
  const relationLabel=e.target.closest(".relation-label-hit[data-edit-relation-id]");
  if(relationLabel){
    if(state.settings.mode==="bearbeiten" && activeTool==="verbinden"){
      selectRelation(relationLabel.dataset.editRelationId,{openEditor:true});
    }
    return;
  }

  // 3) Alle übrigen Diagramm-Interaktionen existieren ebenfalls nur im Verbinden-Modus.
  if(state.settings.mode!=="bearbeiten" || activeTool!=="verbinden") return;

  const handle=e.target.closest("[data-unit-id]");
  if(handle){ handleUnitClick(handle.dataset.unitId); return; }

  const rel=e.target.closest("[data-relation-id]");
  if(rel) selectRelation(rel.dataset.relationId,{openEditor:false});
});
els.relationshipSearch.addEventListener("input",renderRelationshipDialog);
els.conjunctionLookupSelect.addEventListener("change",e=>{
  selectedConjunctionLookup=e.target.value;
  renderRelationshipDialog();
});
els.dialogExtendedToggle.addEventListener("change",e=>setExtended(e.target.checked));
els.relationshipList.addEventListener("click",e=>{
  const card=e.target.closest("[data-rel-id]");
  if(!card || card.disabled) return;
  chooseRelationshipForDialog(card.dataset.relId);
});
els.relationshipList.addEventListener("dblclick",e=>{
  const card=e.target.closest("[data-rel-id]");
  if(!card || card.disabled) return;
  if(chooseRelationshipForDialog(card.dataset.relId)) applyRelationship();
});
els.relationshipDetails.addEventListener("change",e=>{
  const control=e.target.closest('input[name="handlungErgebnisPrimaryRole"]');
  if(!control) return;
  selectedPrimaryRoleChoice=control.value==="Handlung" ? "Handlung" : "Ergebnis";
});
els.applyRelationshipButton.addEventListener("click",applyRelationship);
els.leaveOpenButton.addEventListener("click",closeRelationshipDialog);
els.directionFlipButton.addEventListener("click",flipRelationDirection);
els.dissolveGroupButton.addEventListener("click",dissolveGroup);
els.deleteSubtreeButton.addEventListener("click",deleteSubtree);

document.addEventListener("click",e=>{
  if(!els.projectMenu.hidden && !e.target.closest("#projectMenuWrap")) closeProjectMenu();
  const closer=e.target.closest("[data-close-dialog]");
  if(!closer) return;
  const d=document.getElementById(closer.dataset.closeDialog);
  if(d===els.relationshipDialog) closeRelationshipDialog(); else closeDialog(d);
});
document.addEventListener("click",e=>{
  if(!selectedRelationId) return;
  if(e.target.closest("[data-relation-id],[data-unit-id],.unit-chip,dialog,.statusbar,.topbar")) return;
  selectedRelationId=null;
  render();
});
document.addEventListener("keydown",e=>{
  const openDialogs=$$("dialog[open]");
  const dialog=openDialogs.length?openDialogs[openDialogs.length-1]:null;
  if(dialog && e.key==="Tab"){
    const focusable=$$('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',dialog)
      .filter(el=>el.offsetParent!==null);
    if(focusable.length){
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    }
    return;
  }
  const tag=(document.activeElement&&document.activeElement.tagName||"").toLowerCase();
  const editableFocus=["textarea","input","select"].includes(tag) || (document.activeElement&&document.activeElement.isContentEditable);

  // Entf darf auch im Beziehungsdialog die dort aktive Verbindung löschen. Backspace wird in Formularfeldern nie abgefangen.
  if((e.key==="Delete" || e.key==="Backspace") && !editableFocus && canModifyRelations()){
    const targetId=(dialog===els.relationshipDialog && activeRelationId)?activeRelationId:selectedRelationId;
    if(targetId && getNode(targetId)?.kind==="relation"){
      e.preventDefault();
      deleteSelectedRelation(targetId);
      return;
    }
  }
  if(dialog) return;
  const formFocus=editableFocus || tag==="button";
  if((e.ctrlKey||e.metaKey) && !e.altKey && e.key.toLowerCase()==="z"){
    e.preventDefault();
    if(e.shiftKey) redo(); else undo();
    return;
  }
  if(e.key==="Escape"){
    if(!els.projectMenu.hidden){ closeProjectMenu(); els.projectMenuButton.focus(); return; }
    let changed=false;
    if(selectionStartId){selectionStartId=null;changed=true;}
    if(selectedRelationId){selectedRelationId=null;changed=true;}
    if(changed){render();announce("Auswahl abgebrochen");}
    return;
  }
  if(e.code==="Space" && !formFocus){
    e.preventDefault();setMode(state.settings.mode==="bearbeiten"?"ansicht":"bearbeiten");return;
  }
});
document.addEventListener("keydown",e=>{
  const unit=e.target.closest && e.target.closest(".unit-chip,.unit-anchor");
  if(!unit) return;
  if(e.key==="ArrowRight"||e.key==="ArrowDown"){e.preventDefault();moveFocusAmongUnits(unit,1);}
  if(e.key==="ArrowLeft"||e.key==="ArrowUp"){e.preventDefault();moveFocusAmongUnits(unit,-1);}
});

els.relationshipDialog.addEventListener("close",()=>{
  activeRelationId=null;chosenRelationshipId=null;els.relationshipSearch.value="";
});
for(const d of $$("dialog")){
  d.addEventListener("cancel",()=>{ if(d===els.relationshipDialog){activeRelationId=null;chosenRelationshipId=null;} });
}

window.addEventListener("beforeunload",()=>{
  clearTimeout(saveTimer);
  try{ syncStateIntoActiveProject(); storeProjectsNow(); }catch(_){ }
});
window.addEventListener("resize",()=>requestAnimationFrame(measureAndRenderSvgs));
if("ResizeObserver" in window){
  resizeObserver=new ResizeObserver(()=>requestAnimationFrame(measureAndRenderSvgs));
  resizeObserver.observe(els.propList);
}
renderSignalTable();
loadUiSettings();
loadProjects();
render();
