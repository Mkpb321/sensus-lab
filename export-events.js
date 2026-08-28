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
function exportRelationStyle(node){
  const rel=RELATIONSHIPS[node.relationshipId];
  if(node.relationshipId==null) return {rel:null,color:"#98a2b3",dash:"7 6",width:1.8};
  if(!rel) return {rel:null,color:"#98a2b3",dash:"5 5",width:1.8};
  return {rel,color:CATEGORY_COLORS[rel.category]||"#475467",dash:"",width:1.85};
}
function buildPublicationExportSvg(){
  // Eigenständiger, bewusst reduzierter Export-Renderer: nur Titel, Text und Analysezeichnung.
  const pageLeft=30;
  const pageRight=34;
  const rowGap=15;
  const propTextWidth=690;
  const propFontSize=18;
  const propLineH=27;
  const propMinH=50;
  const labelMaxWidth=94;
  const roleMaxWidth=90;
  const bracketTextGap=28;
  const titleFontSize=24;
  const titleLineH=31;
  const subtitleFontSize=14;
  const subtitleLineH=21;
  const titleLines=state.title ? exportTextLines(state.title,propTextWidth,`700 ${titleFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`) : [];
  const subtitleLines=state.mainPointSummary ? exportTextLines(state.mainPointSummary,propTextWidth,`400 ${subtitleFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`) : [];
  const headerH=(titleLines.length || subtitleLines.length)
    ? 24 + titleLines.length*titleLineH + (subtitleLines.length ? 4 + subtitleLines.length*subtitleLineH : 0) + 18
    : 24;

  let cursorY=headerH;
  const anchorMap=new Map();
  const propLayouts=[];
  for(let i=0;i<state.propositions.length;i++){
    const p=state.propositions[i];
    const text=state.tokens.slice(p.tokenStart,p.tokenEnd+1).join("");
    const lines=exportTextLines(text,propTextWidth,`500 ${propFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`);
    const textHeight=Math.max(propLineH,lines.length*propLineH);
    const h=Math.max(propMinH,textHeight+12);
    const top=cursorY, bottom=top+h, center=(top+bottom)/2;
    anchorMap.set(p.id,{top,bottom,center});
    propLayouts.push({p,index:i,text,lines,top,bottom,center,h,textHeight});
    cursorY=bottom+rowGap;
  }
  const contentBottom=Math.max(headerH+80,cursorY-rowGap);
  const data=relationLayoutData(anchorMap);
  const exportGeometry=computeAdaptiveBracketGeometry(data);
  const maxDepth=data.length?exportGeometry.maxDepth:0;
  const outerReserve=data.length?Math.max(20,Math.ceil((exportGeometry.relationThicknessByDepth[maxDepth]||0)/2+10)):0;
  const bracketRight=data.length?pageLeft+outerReserve+exportGeometry.cumulative[maxDepth]:pageLeft;
  const textStart=data.length?bracketRight+bracketTextGap:pageLeft;
  const canvasW=Math.ceil(textStart+propTextWidth+pageRight);
  const canvasH=Math.ceil(contentBottom+28);
  const xForDepth=(depth)=>bracketRight-exportGeometry.cumulative[depth];
  const xById=new Map(data.map(item=>[item.node.id,xForDepth(item.depth)]));
  const portMemo=new Map();

  const rolePlacementByKey=new Map();
  for(const item of data){
    const {node}=item;
    const {rel}=exportRelationStyle(node);
    if(!rel || rel.primary==="all") continue;
    const x=xById.get(node.id);
    const targets=(node.children||[]).map(childId=>{
      const child=getNode(childId);
      return child&&child.kind==="relation"?(xById.get(childId)??bracketRight):bracketRight;
    });
    const parentHalf=(exportGeometry.relationMetricsById.get(node.id)?.metrics.height||0)/2;
    const nodeMaxRoleWidth=Math.min(roleMaxWidth,exportGeometry.maxRoleWidthByNode.get(node.id)||0);
    const commonRoleX=x+Math.max(parentHalf+8,20)+nodeMaxRoleWidth/2;
    (node.children||[]).forEach((childId,i)=>{
      const cy=bracketNodePortY(childId,anchorMap,portMemo); if(!Number.isFinite(cy)) return;
      const targetX=targets[i];
      const fullRole=node.roleOrder[i]||`Teil ${i+1}`;
      const displayRole=compactRole(fullRole);
      const lines=wrapBracketText(displayRole,13,2);
      const metrics=bracketTextMetrics(lines,{minWidth:32,maxWidth:roleMaxWidth,charWidth:4.25,lineHeight:9.2,padX:4.5,padY:2.8});
      const minX=x+Math.max(parentHalf+8,20)+metrics.width/2;
      const maxX=targetX-metrics.width/2-6;
      const rx=Math.max(minX,Math.min(commonRoleX,maxX));
      const centerY=cy;
      rolePlacementByKey.set(`${node.id}:${i}`,{rx,centerY,lines,metrics,fullRole});
    });
  }

  const pieces=[];
  const boxOverlays=[];
  pieces.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`);
  pieces.push(`<rect width="${canvasW}" height="${canvasH}" fill="#ffffff"/>`);
  pieces.push(`<style>
    text{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;text-rendering:auto;font-kerning:normal}
    .pub-line{fill:none;stroke-linecap:square;stroke-linejoin:miter}
    .pub-rel{font-size:10.25px;font-weight:500;text-anchor:middle;letter-spacing:.005em}
    .pub-role{font-size:10px;font-weight:400;fill:#475467;text-anchor:middle}
    .pub-prop{font-size:${propFontSize}px;font-weight:500;fill:#1d2939}
  </style>`);

  if(titleLines.length){
    const firstTitleY=30;
    pieces.push(`<text x="${pageLeft}" y="${firstTitleY}" font-size="${titleFontSize}" font-weight="720" letter-spacing="-.35" fill="#101828">${titleLines.map((line,li)=>`<tspan x="${pageLeft}" dy="${li===0?0:titleLineH}">${safeSvgText(line)}</tspan>`).join("")}</text>`);
  }
  if(subtitleLines.length){
    const subtitleStartY=30 + Math.max(0,(titleLines.length-1)*titleLineH) + (titleLines.length ? titleLineH - 3 : 0);
    pieces.push(`<text x="${pageLeft}" y="${subtitleStartY}" font-size="${subtitleFontSize}" font-weight="400" letter-spacing="0" fill="#667085">${subtitleLines.map((line,li)=>`<tspan x="${pageLeft}" dy="${li===0?0:subtitleLineH}">${safeSvgText(line)}</tspan>`).join("")}</text>`);
  }

  // Propositionen bleiben im Export reine Textzeilen; keine Karten, IDs, Status- oder App-Elemente.
  propLayouts.forEach(item=>{
    if(data.length) pieces.push(`<path d="M ${bracketRight} ${item.center} H ${textStart-10}" stroke="#d0d5dd" stroke-width="1"/>`);
    const tx=textStart;
    const firstY=item.center-((item.lines.length-1)*propLineH)/2+6;
    pieces.push(`<text class="pub-prop" x="${tx}" y="${firstY}">${item.lines.map((line,li)=>`<tspan x="${tx}" dy="${li===0?0:propLineH}">${safeSvgText(line)}</tspan>`).join("")}</text>`);
  });

  // Beziehungen und Klammern direkt aus dem Analysebaum.
  for(const item of data){
    const {node}=item;
    const {rel,color,dash,width}=exportRelationStyle(node);
    const x=xById.get(node.id);
    const childPorts=(node.children||[]).map(cid=>bracketNodePortY(cid,anchorMap,portMemo));
    const ports=childPorts.filter(Number.isFinite); if(!ports.length) continue;
    const topY=Math.min(...ports),bottomY=Math.max(...ports);
    const portY=bracketNodePortY(node.id,anchorMap,portMemo);
    const dashAttr=dash?` stroke-dasharray="${dash}"`:"";
    const relationTitle=rel?rel.label:"Offene Gruppe";
    const displayRelationTitle=compactRelation(relationTitle);
    const lines=wrapBracketText(displayRelationTitle,14,3);
    const metrics=bracketTextMetrics(lines,{minWidth:42,maxWidth:labelMaxWidth,charWidth:4.35,lineHeight:9.5,padX:4,padY:2.8});
    const labelScreenHeight=metrics.width;
    const labelScreenWidth=metrics.height;
    const y=(topY+bottomY)/2;
    const labelTop=y-labelScreenHeight/2;
    const labelBottom=y+labelScreenHeight/2;

    if(topY!==bottomY){
      const verticalSegments=[];
      if(labelTop>topY+4) verticalSegments.push([topY,labelTop]);
      if(labelBottom<bottomY-4) verticalSegments.push([labelBottom,bottomY]);
      verticalSegments.forEach(([segTop,segBottom])=>{
        pieces.push(`<path class="pub-line" d="M ${x} ${segTop} V ${segBottom}" stroke="${color}" stroke-width="${width}"${dashAttr}/>`);
      });
    }

    (node.children||[]).forEach((childId,i)=>{
      const cy=childPorts[i]; if(!Number.isFinite(cy)) return;
      const child=getNode(childId);
      const targetX=child&&child.kind==="relation"?(xById.get(childId)??bracketRight):bracketRight;
      const primary=(node.primaryChildIds||[]).includes(childId);
      const branchStartX=(cy>=labelTop-2 && cy<=labelBottom+2) ? x+labelScreenWidth/2 : x;
      pieces.push(`<path class="pub-line" d="M ${branchStartX} ${cy} H ${targetX}" stroke="${color}" stroke-width="${primary?2.45:width}"${dashAttr}/>`);
      const placement=rolePlacementByKey.get(`${node.id}:${i}`);
      if(placement){
        const {rx,centerY,lines,metrics,fullRole}=placement;
        boxOverlays.push(`<g><title>${safeSvgText(fullRole)}</title>`);
        boxOverlays.push(`<rect x="${rx-metrics.width/2-2}" y="${centerY-metrics.height/2-1}" width="${metrics.width+4}" height="${metrics.height+2}" rx="3" fill="#fff" stroke="#d8dee8" stroke-width="0.8"/>`);
        boxOverlays.push(svgMultilineText(lines,rx,centerY,"pub-role",null,metrics.lineHeight));
        boxOverlays.push(`</g>`);
      }
      if(primary && rel && rel.primary!=="all"){
        const sx=branchStartX+9;
        pieces.push(`<circle cx="${sx}" cy="${cy}" r="4.8" fill="#fff" stroke="${color}" stroke-width="1.15"/><text x="${sx}" y="${cy}" text-anchor="middle" font-size="6.8" fill="${color}" dominant-baseline="middle" alignment-baseline="middle">★</text>`);
      }
    });

    const labelX=x;
    boxOverlays.push(`<g><title>${safeSvgText(relationTitle)}</title>`);
    boxOverlays.push(`<rect x="${labelX-metrics.width/2-3}" y="${y-metrics.height/2-2}" width="${metrics.width+6}" height="${metrics.height+4}" rx="4" fill="#fff" stroke="${color}" stroke-width="0.9"${dashAttr} transform="rotate(-90 ${labelX} ${y})"/>`);
    boxOverlays.push(svgMultilineText(lines,labelX,y,"pub-rel",color,metrics.lineHeight).replace('<text ','<text transform="rotate(-90 '+labelX+' '+y+')" '));
    boxOverlays.push(`</g>`);
  }

  // Auch im Export werden Kästchen bewusst zuletzt gemalt. Dadurch liegen alle Linien
  // garantiert hinter den weißen Label-Flächen.
  pieces.push(...boxOverlays);
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
els.helpButton.addEventListener("click",()=>showDialog(els.helpDialog));
els.resetButton.addEventListener("click",resetAll);
els.extendedToggle.addEventListener("change",e=>setExtended(e.target.checked));
els.statusDetailsButton.addEventListener("click",openStatusDetails);
els.exportButton.addEventListener("click",exportImage);
els.jsonExportButton.addEventListener("click",exportJson);
els.importButton.addEventListener("click",()=>els.importInput.click());
els.importInput.addEventListener("change",e=>{if(e.target.files&&e.target.files[0]) importJsonFile(e.target.files[0]);});
els.projectMenuButton.addEventListener("click",e=>{e.stopPropagation();toggleProjectMenu();});
els.projectManagerButton.addEventListener("click",e=>{e.stopPropagation();openProjectManager();});
els.newProjectButton.addEventListener("click",()=>createNewProject());
els.projectList.addEventListener("click",e=>{
  const rename=e.target.closest("[data-project-rename]");
  if(rename){ renameProject(rename.dataset.projectRename); return; }
  const del=e.target.closest("[data-project-delete]");
  if(del){ deleteProject(del.dataset.projectDelete); return; }
  const opener=e.target.closest("[data-project-open]");
  if(opener){ activateProject(opener.dataset.projectOpen); }
});

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
loadProjects();
render();
