/* Sensus Lab – Adaptive Klammergeometrie, UI-Rendering, Dialoge, Beziehungsaktionen, Modi und Persistenz. */
"use strict";

function primaryDepthForProp(propId,layoutById){
  let max=0;
  for(const item of layoutById.values()){
    const n=item.node;
    const primary=n.primaryChildIds||[];
    if(primary.some(cid=>descendantsContain(cid,propId))) max=Math.max(max,item.depth);
  }
  return max;
}
function computeAdaptiveBracketGeometry(data){
  const maxDepth=Math.max(1,...data.map(x=>x.depth));
  const relationMetricsById=new Map();
  const roleDataByKey=new Map();
  const relationThicknessByDepth=Array(maxDepth+1).fill(0);
  const maxRoleWidthByDepth=Array(maxDepth+1).fill(0);
  const maxRoleWidthByNode=new Map();

  // Alle Bahnbreiten werden ausschließlich aus den tatsächlich gerenderten
  // Kurzlabels berechnet. Keine großzügigen Raster-/Mindestkorridore.
  for(const item of data){
    const {node}=item;
    const {rel}=relationStrokeInfo(node);
    const title=rel?rel.label:"Offene Gruppe";
    const displayTitle=relationShortCode(node);
    const relationLines=[displayTitle];
    const relationMetrics=bracketTextMetrics(relationLines,{minWidth:18,maxWidth:96,charWidth:4.75,lineHeight:9.8,padX:3.5,padY:2.0});
    relationMetricsById.set(node.id,{title,displayTitle,lines:relationLines,metrics:relationMetrics});
    // Nach 90° Drehung ist metrics.height die horizontale Dicke des Vertikallabels.
    relationThicknessByDepth[item.depth]=Math.max(relationThicknessByDepth[item.depth],relationMetrics.height);

    if(!rel || rel.primary==="all") continue;
    let nodeMaxRoleWidth=0;
    (node.children||[]).forEach((childId,i)=>{
      const fullRole=node.roleOrder[i]||`Teil ${i+1}`;
      const displayRole=roleDisplayText(node,childId,fullRole);
      const roleLines=[displayRole];
      const roleMetrics=bracketTextMetrics(roleLines,{minWidth:16,maxWidth:94,charWidth:4.75,lineHeight:9.6,padX:3.2,padY:1.8});
      roleDataByKey.set(`${node.id}:${i}`,{fullRole,displayRole,lines:roleLines,metrics:roleMetrics});
      nodeMaxRoleWidth=Math.max(nodeMaxRoleWidth,roleMetrics.width);
      maxRoleWidthByDepth[item.depth]=Math.max(maxRoleWidthByDepth[item.depth],roleMetrics.width);
    });
    maxRoleWidthByNode.set(node.id,nodeMaxRoleWidth);
  }

  // Korridor d: außen liegt das Vertikallabel der Beziehung auf Tiefe d,
  // innen ggf. das nächste Vertikallabel. Dazwischen muss nur das tatsächlich
  // gerenderte horizontale Rollenlabel Platz finden; ein Hauptpunkt-Stern ist
  // bei dünnen Linien bereits Teil dieses Labels.
  const laneWidths=Array(maxDepth+1).fill(0);
  for(let d=1;d<=maxDepth;d++){
    const parentHalf=relationThicknessByDepth[d]/2;
    const innerHalf=d===1?0:relationThicknessByDepth[d-1]/2;
    const edgeGap=3;
    const roleWidth=maxRoleWidthByDepth[d];
    const bareNeed=parentHalf+innerHalf+edgeGap*2;
    const roleNeed=roleWidth
      ? parentHalf+roleWidth+innerHalf+edgeGap*3
      : 0;
    laneWidths[d]=Math.ceil(Math.max(18,bareNeed,roleNeed));
  }

  const cumulative=Array(maxDepth+1).fill(0);
  for(let d=1;d<=maxDepth;d++) cumulative[d]=cumulative[d-1]+laneWidths[d];
  const outerHalf=relationThicknessByDepth[maxDepth]/2;
  const leftGutter=Math.ceil(Math.max(10,outerHalf+5));
  const rightGutter=2;
  const needed=leftGutter+rightGutter+cumulative[maxDepth]+3;

  return {
    maxDepth,laneWidths,cumulative,leftGutter,rightGutter,needed,
    relationMetricsById,roleDataByKey,relationThicknessByDepth,maxRoleWidthByNode
  };
}
function renderBracketSvg(anchorMap,height){
  const svg=els.bracketSvg;
  const data=relationLayoutData(anchorMap);
  const geometry=computeAdaptiveBracketGeometry(data);
  const clientWidth=Math.max(svg.parentElement.clientWidth,1);
  const {maxDepth,cumulative,leftGutter,rightGutter,needed,relationMetricsById,roleDataByKey,maxRoleWidthByNode}=geometry;
  svg.dataset.minWidth=String(Math.ceil(needed));
  const w=Math.max(clientWidth,needed);
  const effectiveRight=w-rightGutter;
  const xForDepth=(depth)=>effectiveRight-cumulative[depth];
  const xById=new Map(data.map(x=>[x.node.id,xForDepth(x.depth)]));
  const portMemo=new Map();

  // Rollenlabels werden – sofern Platz vorhanden ist – exakt in der Mitte der
  // tatsächlich sichtbaren horizontalen Linie platziert. Nur bei zu kurzen
  // Segmenten wird defensiv auf die maximal mögliche Position eingegrenzt.
  const rolePlacementByKey=new Map();
  for(const item of data){
    const {node}=item;
    const {rel}=relationStrokeInfo(node);
    if(!rel || rel.primary==="all") continue;
    const x=xById.get(node.id);
    const relationInfo=relationMetricsById.get(node.id);
    const relationMetrics=relationInfo?.metrics;
    const labelScreenHeight=relationMetrics?.width||0;
    const labelScreenWidth=relationMetrics?.height||0;
    const childPorts=(node.children||[]).map(cid=>bracketNodePortY(cid,anchorMap,portMemo));
    const childTargets=(node.children||[]).map(childId=>{
      const child=getNode(childId);
      return child && child.kind==="relation" ? (xById.get(childId) ?? effectiveRight) : effectiveRight;
    });
    const validPorts=childPorts.filter(Number.isFinite);
    const topY=validPorts.length?Math.min(...validPorts):0;
    const bottomY=validPorts.length?Math.max(...validPorts):0;
    const labelY=(topY+bottomY)/2;
    const labelTop=labelY-labelScreenHeight/2;
    const labelBottom=labelY+labelScreenHeight/2;
    (node.children||[]).forEach((childId,i)=>{
      const cy=childPorts[i]; if(!Number.isFinite(cy)) return;
      const roleInfo=roleDataByKey.get(`${node.id}:${i}`); if(!roleInfo) return;
      const targetX=childTargets[i];
      const {lines:roleLines,metrics:roleMetrics,fullRole}=roleInfo;
      const branchStartX=(cy>=labelTop-2 && cy<=labelBottom+2) ? x+labelScreenWidth/2 : x;
      const idealX=(branchStartX+targetX)/2;
      const minX=branchStartX+roleMetrics.width/2+3;
      const maxX=targetX-roleMetrics.width/2-3;
      const rx=Math.max(minX,Math.min(idealX,maxX));
      rolePlacementByKey.set(`${node.id}:${i}`,{rx,roleCenterY:cy,roleLines,roleMetrics,fullRole});
    });
  }

  svg.setAttribute("viewBox",`0 0 ${w} ${height}`);
  svg.setAttribute("height",String(height));
  svg.style.height=height+"px";
  setBracketCanvasWidth(svg,w);

  const pieces=[];
  const normalLinePieces=[];
  const primaryLinePieces=[];
  const labelPieces=[];
  const anchorPieces=[];
  for(const item of data){
    const {node}=item;
    const {rel,color,dash,width:strokeWidth}=relationStrokeInfo(node);
    const x=xById.get(node.id);
    const childPorts=(node.children||[]).map(cid=>bracketNodePortY(cid,anchorMap,portMemo));
    const validPorts=childPorts.filter(Number.isFinite);
    if(!validPorts.length) continue;

    const topY=Math.min(...validPorts), bottomY=Math.max(...validPorts);
    const portY=bracketNodePortY(node.id,anchorMap,portMemo);
    const dashAttr=dash?` stroke-dasharray="${dash}"`:"";
    const isSelected=selectedRelationId===node.id;
    const relationInfo=relationMetricsById.get(node.id);
    const title=relationInfo?.title||(rel?rel.label:"Offene Gruppe");
    const relationLines=relationInfo?.lines||[relationShortCode(node)];
    const relationMetrics=relationInfo?.metrics||bracketTextMetrics(relationLines,{minWidth:18,maxWidth:96,charWidth:4.75,lineHeight:9.8,padX:3.5,padY:2.0});

    pieces.push(`<g class="svg-rel" data-relation-id="${node.id}">`);

    // Beziehungsname exakt in der geometrischen Mitte der vertikalen Stamm-Linie.
    const relationLabelScreenHeight=relationMetrics.width;
    const relationLabelScreenWidth=relationMetrics.height;
    const labelY=(topY+bottomY)/2;
    const labelTop=labelY-relationLabelScreenHeight/2;
    const labelBottom=labelY+relationLabelScreenHeight/2;

    if(topY!==bottomY){
      const verticalSegments=[];
      if(labelTop>topY+4) verticalSegments.push([topY,labelTop]);
      if(labelBottom<bottomY-4) verticalSegments.push([labelBottom,bottomY]);
      verticalSegments.forEach(([segTop,segBottom])=>{
        normalLinePieces.push(`<path class="svg-hit-line" d="M ${x} ${segTop} V ${segBottom}"/>`);
        if(isSelected) normalLinePieces.push(`<path class="svg-selected-halo" d="M ${x} ${segTop} V ${segBottom}"/>`);
        normalLinePieces.push(`<path class="svg-tree-line" d="M ${x} ${segTop} V ${segBottom}" stroke="${color}" stroke-width="${strokeWidth}"${dashAttr}/>`);
      });
    }

    (node.children||[]).forEach((childId,i)=>{
      const cy=childPorts[i]; if(!Number.isFinite(cy)) return;
      const child=getNode(childId);
      const targetX=child && child.kind==="relation" ? (xById.get(childId) ?? effectiveRight) : effectiveRight;
      const primary=(node.primaryChildIds||[]).includes(childId);
      const isPrimaryBranch=primary && !!rel && rel.primary!=="all";
      const lineClass=isPrimaryBranch?"svg-tree-line svg-primary-line":"svg-tree-line";
      const branchStrokeWidth=isPrimaryBranch && uiSettings.emphasizePrimaryLines!==false?strokeWidth*2:strokeWidth;

      const branchStartX=(cy>=labelTop-2 && cy<=labelBottom+2) ? x+relationLabelScreenWidth/2 : x;
      const branchHit=`<path class="svg-hit-line" d="M ${branchStartX} ${cy} H ${targetX}"/>`;
      const branchHalo=isSelected?`<path class="svg-selected-halo" d="M ${branchStartX} ${cy} H ${targetX}"/>`:"";
      const branchPath=`<path class="${lineClass}" d="M ${branchStartX} ${cy} H ${targetX}" stroke="${color}" stroke-width="${branchStrokeWidth}"${dashAttr}/>`;
      const branchLayer=(isPrimaryBranch && uiSettings.emphasizePrimaryLines!==false)?primaryLinePieces:normalLinePieces;
      branchLayer.push(branchHit);
      if(branchHalo) branchLayer.push(branchHalo);
      branchLayer.push(branchPath);

      const placement=rolePlacementByKey.get(`${node.id}:${i}`);
      if(placement){
        const {rx,roleCenterY,roleLines,roleMetrics,fullRole}=placement;
        const roleX=rx-roleMetrics.width/2, roleY=roleCenterY-roleMetrics.height/2;
        labelPieces.push(`<g class="diagram-label-box diagram-role-label">`);
        labelPieces.push(`<rect class="svg-role-bg" x="${roleX-1}" y="${roleY}" width="${roleMetrics.width+2}" height="${roleMetrics.height}" rx="0"></rect>`);
        labelPieces.push(svgMultilineText(roleLines,rx,roleCenterY,"svg-role",null,roleMetrics.lineHeight));
        labelPieces.push(`<rect class="diagram-label-hit role-label-hit" data-diagram-tooltip="${escapeHtml(fullRole)}" x="${roleX}" y="${roleY}" width="${roleMetrics.width}" height="${roleMetrics.height}" rx="5"></rect>`);
        labelPieces.push(`</g>`);
      }

    });

    const labelX=x;
    const relX=labelX-relationMetrics.width/2, relY=labelY-relationMetrics.height/2;
    labelPieces.push(`<g class="diagram-label-box diagram-relation-label" transform="rotate(-90 ${labelX} ${labelY})">`);
    labelPieces.push(`<rect class="svg-code-bg" x="${relX-1}" y="${relY}" width="${relationMetrics.width+2}" height="${relationMetrics.height}" rx="0"></rect>`);
    labelPieces.push(svgMultilineText(relationLines,labelX,labelY,"svg-code",color,relationMetrics.lineHeight));
    labelPieces.push(`<rect class="diagram-label-hit relation-label-hit" data-edit-relation-id="${node.id}" data-diagram-tooltip="${escapeHtml(title)}" x="${relX}" y="${relY}" width="${relationMetrics.width}" height="${relationMetrics.height}" rx="6"></rect>`);
    labelPieces.push(`</g>`);
    pieces.push(`</g>`);

    if(state.settings.mode==="bearbeiten" && activeTool==="verbinden" && canUseConnectionAnchor(node.id)){
      const anchorY=Number.isFinite(portY)?portY:(topY+bottomY)/2;
      // Ein Beziehungs-Knoten wird von einer späteren/äußeren Klammer genau an
      // seiner eigenen vertikalen Bahn angeschlossen. Der Anker gehört deshalb
      // auf diese Ebene und nicht pauschal an den rechten Rand des Diagramms.
      // Ein kleiner Versatz nach links hält Kreis, Linie und ggf. gedrehtes
      // Beziehungslabel optisch getrennt.
      const relationHalfWidth=relationLabelScreenWidth/2;
      const anchorX=x-Math.max(18,relationHalfWidth+10);
      const selected=selectionStartId===node.id;
      anchorPieces.push(`<g data-unit-id="${node.id}" class="svg-connection-anchor" aria-label="${escapeHtml(nodeLabel(node.id))} zum Verbinden auswählen">`);
      anchorPieces.push(`<circle class="svg-connection-anchor-hit" cx="${anchorX}" cy="${anchorY}" r="13"/>`);
      anchorPieces.push(`<circle class="svg-connection-anchor-dot" cx="${anchorX}" cy="${anchorY}" r="7" fill="#fff" stroke="${selected?"#2563eb":"#94a3b8"}" stroke-width="${selected?2.6:1.4}"/>`);
      anchorPieces.push(`</g>`);
    }
  }

  // Labels liegen über den Linien; Verbindungsanker bilden die oberste Ebene,
  // damit weder Linien noch Badges die anklickbaren Kreise überzeichnen.
  svg.innerHTML=pieces.join("")+`<g class="svg-line-layer">${normalLinePieces.join("")}</g><g class="svg-primary-line-layer">${primaryLinePieces.join("")}</g><g class="svg-label-layer">${labelPieces.join("")}</g><g class="svg-anchor-layer">${anchorPieces.join("")}</g>`;

  els.bracketEmpty.textContent="";
  els.bracketEmpty.style.display=data.length?"none":"flex";
  if(!data.length) els.bracketEmpty.textContent=state.propositions.length<2?"Keine Struktur":"Keine Verbindungen";
}

function bibleArcNodeSpan(nodeId,anchorMap,memo=new Map()){
  if(memo.has(nodeId)) return memo.get(nodeId);
  const node=getNode(nodeId);
  if(!node) return null;
  if(node.kind==="proposition"){
    const anchor=anchorMap.get(nodeId);
    if(!anchor) return null;
    // Die Arc-Enden stehen bewusst etwas innerhalb der Propositionzeile statt
    // direkt an ihren oberen/unteren Grenzen. Dadurch bleiben einzelne Arcs
    // kompakter und benachbarte Bögen optisch klar voneinander getrennt.
    const rawHeight=Math.max(1,anchor.bottom-anchor.top);
    const inset=Math.min(7,Math.max(3,rawHeight*.12));
    const top=anchor.top+inset;
    const bottom=Math.max(top+1,anchor.bottom-inset);
    const span={top,bottom,center:(top+bottom)/2,height:Math.max(1,bottom-top)};
    memo.set(nodeId,span);
    return span;
  }
  const children=(node.children||[]).map(id=>bibleArcNodeSpan(id,anchorMap,memo)).filter(Boolean);
  if(!children.length) return null;
  const top=Math.min(...children.map(x=>x.top));
  const bottom=Math.max(...children.map(x=>x.bottom));
  const span={top,bottom,center:(top+bottom)/2,height:Math.max(1,bottom-top)};
  memo.set(nodeId,span);
  return span;
}
function bibleArcWidth(span){
  // Biblearc-Arcs werden annähernd so breit wie der vertikale Bereich, den sie umfassen.
  // Dadurch werden verschachtelte Gruppen unmittelbar an ihrer geometrischen Größe sichtbar.
  return Math.max(34,span.height*1.10);
}
function bibleArcPath(x,span){
  const width=bibleArcWidth(span);
  const control=width*4/3;
  const top=span.top+.5,bottom=span.bottom-.5;
  return `M ${x} ${top} C ${x+control} ${top}, ${x+control} ${bottom}, ${x} ${bottom}`;
}
function bibleArcSingleLabelRole(relationshipId){
  return ({
    begruendung:"Grund",
    folgerung:"Folgerung",
    zeit:"Zeit",
    ort:"Ort",
    vergleich:"Vergleichsbild",
    einraeumung:"Einräumung"
  })[relationshipId]||null;
}
function bibleArcLabelSpecs(node,rel,spanMemo,anchorMap){
  if(!rel || !node.relationshipId) return [];
  const color=relationshipStrongColor(rel,node.relationshipId);
  const code=relationShortCode(node);
  const childSpans=(node.children||[]).map(id=>bibleArcNodeSpan(id,anchorMap,spanMemo));
  const specs=[];

  // Biblearc setzt koordinierende Labels zwischen die jeweils verbundenen Arcs.
  if(rel.primary==="all"){
    for(let i=0;i<childSpans.length-1;i++){
      const a=childSpans[i],b=childSpans[i+1];
      if(!a||!b) continue;
      const innerWidth=Math.min(bibleArcWidth(a),bibleArcWidth(b));
      specs.push({text:code,x:1.5+Math.max(22,Math.min(68,innerWidth*.48)),y:(a.bottom+b.top)/2,color});
    }
    return specs;
  }

  // Bilateral ist der Sonderfall unter den unterordnenden Beziehungen: Biblearc
  // setzt BL wie bei einer koordinierenden Verbindung in die Mitte der Gruppe.
  if(node.relationshipId==="beidseitige_begruendung"){
    const span=bibleArcNodeSpan(node.id,anchorMap,spanMemo);
    if(span) specs.push({text:code,x:1.5+bibleArcWidth(span),y:span.center,color});
    return specs;
  }

  const codeParts=String(code||"").split("/").map(x=>x.trim()).filter(Boolean);
  if(codeParts.length===2 && Array.isArray(rel.roles) && rel.roles.length===2){
    // Zweiteilige Biblearc-Labels (z. B. Ac/Pur) stehen auf den jeweiligen Seiten.
    rel.roles.forEach((canonicalRole,roleIndex)=>{
      const childIndex=(node.roleOrder||[]).indexOf(canonicalRole);
      const span=childSpans[childIndex];
      if(childIndex<0||!span) return;
      const width=bibleArcWidth(span);
      specs.push({text:codeParts[roleIndex],x:1.5+width,y:span.center,color});
    });
    return specs;
  }

  // Einteilige unterordnende Labels stehen auf demjenigen Arc, den Biblearc
  // mit diesem Funktionslabel versieht; der jeweils andere Hauptteil bleibt unbeschriftet.
  const labelledRole=bibleArcSingleLabelRole(node.relationshipId);
  if(labelledRole){
    const childIndex=(node.roleOrder||[]).indexOf(labelledRole);
    const span=childSpans[childIndex];
    if(childIndex>=0&&span){
      const width=bibleArcWidth(span);
      specs.push({text:code,x:1.5+width,y:span.center,color});
      return specs;
    }
  }

  // Defensive Darstellung für unbekannte/importierte Beziehungstypen.
  const span=bibleArcNodeSpan(node.id,anchorMap,spanMemo);
  if(span) specs.push({text:code,x:1.5+bibleArcWidth(span),y:span.center,color});
  return specs;
}
function renderBibelArcs(anchorMap,height){
  const pane=els.bibleArcPane,svg=els.bibleArcSvg;
  if(!pane||!svg) return;
  const enabled=uiSettings.bibleArcing===true && !!state.rawText && state.propositions.length>0;
  if(els.centerColumn) els.centerColumn.classList.toggle("biblearc-enabled",enabled);
  if(els.bibleArcDivider) els.bibleArcDivider.hidden=!enabled;
  pane.hidden=!enabled;
  if(!enabled){
    svg.innerHTML="";
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width="";
    svg.style.height="";
    return;
  }
  applyBibleArcSplit();

  const spanMemo=new Map();
  const nodes=[];
  for(const p of state.propositions){
    const span=bibleArcNodeSpan(p.id,anchorMap,spanMemo);
    if(span) nodes.push({id:p.id,node:p,span,kind:"proposition"});
  }
  for(const node of relationNodes()){
    const span=bibleArcNodeSpan(node.id,anchorMap,spanMemo);
    if(span) nodes.push({id:node.id,node,span,kind:"relation"});
  }
  nodes.sort((a,b)=>a.span.height-b.span.height || a.span.top-b.span.top);

  const baseX=1.5;
  const maxArcWidth=Math.max(34,...nodes.map(item=>bibleArcWidth(item.span)));
  const svgWidth=Math.ceil(maxArcWidth+24);

  svg.setAttribute("viewBox",`0 0 ${svgWidth} ${height}`);
  svg.setAttribute("width",String(svgWidth));
  svg.setAttribute("height",String(height));
  svg.style.width=`${svgWidth}px`;
  svg.style.height=`${height}px`;

  const curves=[];
  const labels=[];
  for(const item of nodes){
    const node=item.node;
    let cls="biblearc-curve";
    if(item.kind==="proposition") cls+=" proposition";
    if(item.kind==="relation" && node.relationshipId==null) cls+=" open";
    curves.push(`<path class="${cls}" d="${bibleArcPath(baseX,item.span)}"/>`);
    if(item.kind!=="relation" || node.relationshipId==null) continue;
    const rel=RELATIONSHIPS[node.relationshipId];
    for(const spec of bibleArcLabelSpecs(node,rel,spanMemo,anchorMap)){
      labels.push(`<text class="biblearc-label" x="${spec.x}" y="${spec.y}" fill="${spec.color}">${safeSvgText(spec.text)}</text>`);
    }
  }
  svg.innerHTML=`<g class="biblearc-curves">${curves.join("")}</g><g class="biblearc-labels">${labels.join("")}</g>`;
}

function propositionContentHeight(){
  // Nicht propList.scrollHeight verwenden: Die Grid-Zeile kann durch das Arc-SVG
  // gestreckt werden und würde dessen Höhe beim nächsten Rendern erneut messen.
  // Die tatsächliche Unterkante der letzten Proposition ist dagegen unabhängig
  // von der Höhe des danebenliegenden SVG und verhindert so Rückkopplungswachstum.
  const rows=Array.from(els.propList?.children||[]).filter(el=>el.classList?.contains("prop-wrap"));
  const last=rows[rows.length-1];
  if(!last) return 260;
  return Math.max(260,Math.ceil(last.offsetTop+last.offsetHeight));
}
function measureAndRenderSvgs(){
  const height=propositionContentHeight();
  const anchors=getAnchorMap();
  renderBracketSvg(anchors,height);
  renderBibelArcs(anchors,height);
}

function showDialog(dialog){
  if(!dialog.open) dialog.showModal();
  const focusable=$$('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',dialog);
  if(focusable.length) requestAnimationFrame(()=>focusable[0].focus());
}
function closeDialog(dialog){
  if(dialog && dialog.open) dialog.close();
}
function openTextDialog(){
  els.textDialogTitle.textContent=state.rawText?"Text bearbeiten":"Text einfügen";
  els.textTitleInput.value=state.title||"";
  els.mainPointSummaryInput.value=state.mainPointSummary||"";
  els.rawTextInput.value=state.rawText||"";
  els.applyTextButton.textContent=state.rawText?"Text übernehmen":"Analyse starten";
  els.applyTextButton.disabled=!els.rawTextInput.value.trim();
  showDialog(els.textDialog);
  requestAnimationFrame(()=>{
    if(!state.rawText) els.textTitleInput.focus();
    else els.rawTextInput.focus();
  });
}
function applyTextFromDialog(){
  const title=String(els.textTitleInput.value||"").trim();
  const mainPointSummary=String(els.mainPointSummaryInput.value||"").trim();
  const raw=normalizeRawText(els.rawTextInput.value);
  if(!raw.trim()){announce("Bitte zuerst eigenen Text einfügen.");return;}
  const textChanged=raw!==state.rawText;
  const titleChanged=title!==(state.title||"");
  const summaryChanged=mainPointSummary!==(state.mainPointSummary||"");
  if(!textChanged && !titleChanged && !summaryChanged){closeDialog(els.textDialog);return;}
  if(textChanged){
    const hasAnalysisWork=state.propositions.length>1 || hasRelations();
    if(hasAnalysisWork && !confirm("Das Ändern des Textes setzt die Segmentierung auf eine Proposition zurück und löscht vorhandene Beziehungen. Fortfahren?")) return;
    selectionStartId=null;
    selectedRelationId=null;
    activeTool="teilen";
    performAction(state.rawText?"Text geändert":"Text übernommen",()=>initializeText(raw,title,mainPointSummary));
  }else{
    performAction(titleChanged && summaryChanged?"Titel und Hauptaussage geändert":titleChanged?"Titel geändert":"Hauptaussage geändert",()=>{state.title=title;state.mainPointSummary=mainPointSummary;});
  }
  closeDialog(els.textDialog);
}

function selectedConjunctionEntry(){
  return selectedConjunctionLookup ? CONJUNCTION_LOOKUP.find(item=>item.label===selectedConjunctionLookup)||null : null;
}
function relationshipEntriesForDialog(){
  const node=getNode(activeRelationId);
  if(!node || node.kind!=="relation") return [];
  const q=els.relationshipSearch.value.trim().toLocaleLowerCase("de");
  const conjunction=selectedConjunctionEntry();
  const allowedByConjunction=conjunction?new Set(conjunction.relations):null;
  return Object.entries(RELATIONSHIPS).filter(([id,rel])=>{
    const visible=!rel.extended || state.settings.includeExtended || node.relationshipId===id;
    if(!visible) return false;
    if(allowedByConjunction && !allowedByConjunction.has(id)) return false;
    if(!q) return true;
    const hay=[rel.label,rel.biblearcLabel,rel.uiCode,rel.definition,rel.test,...rel.signals].filter(Boolean).join(" ").toLocaleLowerCase("de");
    return hay.includes(q);
  });
}
function renderRelationshipDialog(){
  const node=getNode(activeRelationId);
  if(!node || node.kind!=="relation") return;
  syncDialogRelationOptions();
  els.relationshipDialogTitle.textContent=node.relationshipId?"Beziehung ändern":"Beziehung wählen";
  els.dialogExtendedToggle.checked=!!state.settings.includeExtended;
  renderConjunctionFilter();
  const entries=relationshipEntriesForDialog();
  const order=["koordination","eigenstaendige_stuetze","erlaeuternde_stuetze","gegensaetzliche_stuetze","erweitert"];
  const grouped=new Map(order.map(c=>[c,[]]));
  for(const entry of entries) grouped.get(entry[1].category)?.push(entry);
  const html=[];
  for(const cat of order){
    const rows=grouped.get(cat)||[];
    if(!rows.length) continue;
    const categoryColor=CATEGORY_STRONG_COLORS[cat]||"#475467";
    const [categoryMain,categoryDetail]=CATEGORY_HEADING_PARTS[cat]||[CATEGORY_LABELS[cat],null];
    html.push(`<div class="rel-category" style="--category-color:${categoryColor}"><span class="rel-category-main">${escapeHtml(categoryMain)}</span>${categoryDetail?` <span class="rel-category-detail">(${escapeHtml(categoryDetail)})</span>`:""}</div><div class="rel-list">`);
    for(const [id,rel] of rows){
      const ok=cardinalityOk(rel,node.children.length);
      const selected=chosenRelationshipId===id?" selected":"";
      const relColor=relationshipColor(rel,id);
      const relStrongColor=relationshipStrongColor(rel,id);
      html.push(`<button type="button" class="rel-card${selected}" data-rel-id="${id}" ${ok?"":"disabled"} aria-pressed="${chosenRelationshipId===id}" style="--rel-color:${relColor};--rel-strong:${relStrongColor}">
        <span class="rel-code">${escapeHtml(rel.uiCode)}</span>
        <span class="rel-card-copy"><span class="rel-name">${escapeHtml(rel.label)}</span><span class="rel-desc">${escapeHtml(rel.definition)}</span></span>
        <span class="cardinality">${escapeHtml(cardinalityText(rel))}</span>
      </button>`);
    }
    html.push("</div>");
  }
  els.relationshipList.innerHTML=html.join("") || `<p class="small-note">Keine passende Beziehung gefunden.</p>`;
  renderRelationshipDetails();
}
function relationRoleSummary(node){
  if(!node.relationshipId) return "Noch keine Beziehung zugewiesen.";
  const rel=RELATIONSHIPS[node.relationshipId];
  if(!rel) return "Unbekannte Beziehung.";
  return node.children.map((cid,i)=>{
    const main=node.primaryChildIds.includes(cid)?" ★ Hauptteil":"";
    return `${nodeLabel(cid)}: ${node.roleOrder[i]||"Teil"}${main}`;
  }).join(" · ");
}
function conjunctionLookupOptions(){
  return [`<option value="">Konjunktion auswählen …</option>`,...CONJUNCTION_LOOKUP.map(item=>`<option value="${escapeHtml(item.label)}"${selectedConjunctionLookup===item.label?" selected":""}>${escapeHtml(item.label)}</option>`)].join("");
}
function renderConjunctionFilter(){
  if(!els.conjunctionLookupSelect || !els.conjunctionFilterInfo) return;
  els.conjunctionLookupSelect.innerHTML=conjunctionLookupOptions();
  const item=selectedConjunctionEntry();
  if(!item){
    els.conjunctionFilterInfo.hidden=true;
    els.conjunctionFilterInfo.innerHTML="";
    return;
  }
  const names=item.relations.map(id=>RELATIONSHIPS[id]?.label).filter(Boolean);
  els.conjunctionFilterInfo.hidden=false;
  els.conjunctionFilterInfo.innerHTML=`<strong>${escapeHtml(item.label)}</strong> → ${escapeHtml(names.join(" · "))}${item.note?`<br>${escapeHtml(item.note)}`:""}`;
}
function chooseRelationshipForDialog(id){
  const node=getNode(activeRelationId);
  const rel=RELATIONSHIPS[id];
  if(!node || node.kind!=="relation" || !rel || !cardinalityOk(rel,node.children.length)) return false;
  chosenRelationshipId=id;
  syncDialogRelationOptions();
  els.relationshipList.querySelectorAll("[data-rel-id]").forEach(card=>{
    const selected=card.dataset.relId===id;
    card.classList.toggle("selected",selected);
    card.setAttribute("aria-pressed",String(selected));
  });
  renderRelationshipDetails();
  return true;
}
function renderRelationshipDetails(){
  const node=getNode(activeRelationId);
  if(!node || node.kind!=="relation") return;
  const current=RELATIONSHIPS[node.relationshipId];
  const rel=RELATIONSHIPS[chosenRelationshipId];
  const handlungErgebnisSetting=rel && chosenRelationshipId==="handlung_ergebnis" ? `
        <dt>Hauptpunkt</dt><dd>
          <div class="rel-setting">
            <div class="rel-setting-options">
              <label class="rel-setting-option"><input type="radio" name="handlungErgebnisPrimaryRole" value="Handlung" ${selectedPrimaryRoleChoice==="Handlung"?"checked":""}> Handlung</label>
              <label class="rel-setting-option"><input type="radio" name="handlungErgebnisPrimaryRole" value="Ergebnis" ${selectedPrimaryRoleChoice!=="Handlung"?"checked":""}> Ergebnis</label>
            </div>
            <div class="rel-setting-help">Bestimmt, welcher Teil der Hauptpunkt ist – also an welchem Teil der Anker sitzt und die Linie weitergeführt wird.</div>
          </div>
        </dd>` : "";
  els.relationshipDetails.innerHTML=`
    <div class="rel-current"><strong>Gruppe:</strong> ${escapeHtml(nodeLabel(node.id))}<br>
      ${current?`Aktuell: ${escapeHtml(current.label)}`:"Aktuell: offen"}<br>
      <span class="small-note">${escapeHtml(relationRoleSummary(node))}</span>
    </div>
    ${rel?`<h3>${escapeHtml(rel.label)}${rel.biblearcLabel?` <span class="rel-original">(${escapeHtml(rel.biblearcLabel)})</span>`:""}</h3>
      <div class="rel-meta"><span class="rel-color-chip" style="--chip-color:${relationshipColor(rel,chosenRelationshipId)}"></span>${escapeHtml(CATEGORY_LABELS[rel.category])} · ${escapeHtml(cardinalityText(rel))}</div>
      <dl>
        <dt>Definition</dt><dd>${escapeHtml(rel.definition)}</dd>
        <dt>Alltagsbeispiel</dt><dd class="rel-example">${escapeHtml(EVERYDAY_EXAMPLES[chosenRelationshipId]||"—")}</dd>
        <dt>Prüffrage</dt><dd>${escapeHtml(rel.test)}</dd>
        <dt>Signalwörter</dt><dd>${escapeHtml(rel.signals.join("; "))}</dd>
        <dt>Rollen</dt><dd>${escapeHtml(rel.primary==="all"?"Alle Kinder gleichrangige Hauptteile":(rel.roles.join(" → ")||"—"))}</dd>
        ${handlungErgebnisSetting}
        <dt>Umkehrung</dt><dd>${escapeHtml(rel.reversal||"—")}</dd>
        <dt>Hinweis</dt><dd>${escapeHtml(rel.note||"—")}</dd>
      </dl>`:
      `<p class="small-note">Keine Beziehung ausgewählt.</p>`}`;
  const currentRel=current;
  const canFlipDirection=isDirectionalBinary(currentRel,node.children);
  els.directionFlipButton.hidden=!canFlipDirection;
  els.directionFlipButton.disabled=!canFlipDirection;
  els.dissolveGroupButton.disabled=false;
  els.deleteSubtreeButton.disabled=false;
  els.leaveOpenButton.textContent=node.relationshipId?"Abbrechen":"Offen lassen";
  els.applyRelationshipButton.disabled=!(rel && cardinalityOk(rel,node.children.length));
}
function openRelationshipDialog(nodeId){
  if(!canModifyRelations()) return;
  const node=getNode(nodeId);
  if(!node || node.kind!=="relation") return;
  activeRelationId=nodeId;
  selectedRelationId=nodeId;
  chosenRelationshipId=node.relationshipId || null;
  selectedPrimaryRoleChoice=node.relationshipId==="handlung_ergebnis" ? inferPrimaryRoleChoice(node,"handlung_ergebnis") : null;
  selectedConjunctionLookup="";
  els.relationshipSearch.value="";
  renderRelationshipDialog();
  showDialog(els.relationshipDialog);
}
function closeRelationshipDialog(){
  closeDialog(els.relationshipDialog);
  activeRelationId=null; chosenRelationshipId=null; selectedPrimaryRoleChoice=null;
}
function applyRelationship(){
  if(!canModifyRelations()) return;
  const node=getNode(activeRelationId);
  const rel=RELATIONSHIPS[chosenRelationshipId];
  if(!node || node.kind!=="relation" || !rel || !cardinalityOk(rel,node.children.length)) return;

  const directionFirstChildId=inferDirectionFirstChildId(node,rel);
  const computed=computedRelationState(node,rel,{
    directionFirstChildId,
    primaryRoleChoice:chosenRelationshipId==="handlung_ergebnis" ? selectedPrimaryRoleChoice : null
  });
  const sameRelation=node.relationshipId===chosenRelationshipId;
  const sameRoles=sameIdArray(node.roleOrder,computed.roleOrder);
  const samePrimary=sameIdArray(node.primaryChildIds,computed.primaryChildIds);
  const sameChoice=chosenRelationshipId!=="handlung_ergebnis" || inferPrimaryRoleChoice(node,"handlung_ergebnis")===computed.primaryRoleChoice;
  if(sameRelation && sameRoles && samePrimary && sameChoice){ closeRelationshipDialog(); return; }

  performAction(`Beziehung ${rel.label} übernommen`,()=>{
    node.relationshipId=chosenRelationshipId;
    applyComputedRelationState(node,rel,computed);
  });
  closeRelationshipDialog();
}
function flipRelationDirection(){
  if(!canModifyRelations()) return;
  const node=getNode(activeRelationId);
  const rel=node&&RELATIONSHIPS[node.relationshipId];
  if(!node || !isDirectionalBinary(rel,node.children)) return;

  // Der Button verändert nur die kanonische Richtung. Alles andere wird aus
  // Beziehungstyp + Richtung (+ einer expliziten H/Erg-Hauptpunktwahl) neu
  // berechnet. So entsteht exakt ein Zustand, der auch durch die umgekehrte
  // ursprüngliche Klickreihenfolge hätte entstehen können.
  const currentFirst=inferDirectionFirstChildId(node,rel);
  const flippedFirst=currentFirst===node.children[0] ? node.children[1] : node.children[0];
  const primaryChoice=node.relationshipId==="handlung_ergebnis"
    ? inferPrimaryRoleChoice(node,"handlung_ergebnis")
    : null;
  const computed=computedRelationState(node,rel,{
    directionFirstChildId:flippedFirst,
    primaryRoleChoice:primaryChoice
  });

  performAction("Richtung umgekehrt",()=>{
    applyComputedRelationState(node,rel,computed);
  });
  renderRelationshipDialog();
}
function dissolveGroup(){
  if(!canModifyRelations()) return;
  const id=activeRelationId;
  if(!getNode(id)) return;
  selectionStartId=null;
  const ok=performAction("Verbindung gelöscht",()=>removeRelationNode(id));
  if(ok){
    selectedRelationId=null;
    closeRelationshipDialog();
    render();
    if(ok.parentOpened) announce("Verbindung gelöscht. Die übergeordnete Beziehung wurde geöffnet, weil ihre Kinderzahl sich geändert hat.");
  }
}
function deleteSubtree(){
  if(!canModifyRelations()) return;
  const id=activeRelationId;
  if(!getNode(id)) return;
  if(!confirm("Diesen Teilbaum löschen? Der Text bleibt erhalten; alle Beziehungen innerhalb dieser Gruppe werden entfernt.")) return;
  selectionStartId=null;
  const ok=performAction("Teilbaum gelöscht",()=>deleteRelationSubtree(id));
  if(ok){
    selectedRelationId=null;
    closeRelationshipDialog();
    render();
    if(ok.parentOpened) announce("Teilbaum gelöscht. Die übergeordnete Beziehung wurde geöffnet, weil ihre Kinderzahl sich geändert hat.");
  }
}

function selectRelation(nodeId,{openEditor=false}={}){
  if(!canModifyRelations()) return;
  const node=getNode(nodeId);
  if(!node || node.kind!=="relation") return;
  selectedRelationId=nodeId;
  render();
  announce(`${nodeLabel(nodeId)} ausgewählt. Entf oder Backspace löscht diese Verbindung.`);
  if(openEditor) openRelationshipDialog(nodeId);
}
function deleteSelectedRelation(nodeId=selectedRelationId){
  if(!canModifyRelations()) return false;
  const node=getNode(nodeId);
  if(!node || node.kind!=="relation") return false;
  const label=nodeLabel(nodeId);
  selectionStartId=null;
  const dialogWasActive=activeRelationId===nodeId;
  const ok=performAction("Verbindung gelöscht",()=>removeRelationNode(nodeId));
  if(!ok) return false;
  selectedRelationId=null;
  if(dialogWasActive) closeRelationshipDialog();
  render();
  announce(ok.parentOpened
    ? `${label} gelöscht. Untergruppen und Text bleiben erhalten; die übergeordnete Beziehung wurde wegen der geänderten Kinderzahl geöffnet.`
    : `${label} gelöscht. Untergruppen und Text bleiben erhalten.`);
  return true;
}

function handleUnitClick(nodeId){
  const node=getNode(nodeId);
  if(!node || !canModifyRelations()) return;
  if(!selectionStartId){
    if(!canUseConnectionAnchor(nodeId)) return;
    selectionStartId=nodeId; render(); announce(`${nodeLabel(nodeId)} als Start gewählt`);
    return;
  }
  if(selectionStartId===nodeId){
    selectionStartId=null; render(); announce("Auswahl aufgehoben"); return;
  }
  const range=connectionRangeForEndpoints(selectionStartId,nodeId);
  if(!range){
    announce("Diese beiden Einheiten können in der aktuellen Struktur nicht neu verbunden werden.");
    return;
  }
  const selected=range.selected;
  const parentId=range.parentId;
  let newId=null;
  // Merkt die zuerst angeklickte Einheit. Bei richtungsabhängigen Typen
  // erhält genau diese Einheit später die erste semantische Rolle des Typs.
  const firstSelectedChildId=selectionStartId;
  selectionStartId=null;
  performAction("Offene Gruppe angelegt",()=>{ newId=connectOpen(selected,parentId,firstSelectedChildId); });
  if(newId && getNode(newId)) openRelationshipDialog(newId);
}

function autoSplitNormalizedWord(token){
  return String(token??"").normalize("NFKC").toLocaleLowerCase("de")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,"");
}
function autoSplitTokenEndsWithPeriod(token){
  return /\.(?:["'»”’\)\]\}]+)?$/u.test(String(token??"").trim());
}
function automaticSplitCutIndices(){
  const words=[];
  for(let tokenIndex=0;tokenIndex<state.tokens.length;tokenIndex++){
    const raw=state.tokens[tokenIndex];
    if(isWhitespaceToken(raw)) continue;
    const word=autoSplitNormalizedWord(raw);
    if(word) words.push({tokenIndex,word,raw});
  }
  const cuts=new Set();
  const first=firstContentToken();

  // Bewusst grammatische Konjunktionen/Konjunktionsgefüge statt aller
  // Beziehungs-Signalwörter verwenden: Präpositionen wie „vor“ oder „durch“
  // sollen beim Auto-Teilen nicht pauschal neue Propositionen erzeugen.
  const conjunctionLabels=[
    "aber","als","als dass","als ob","anstatt dass","auch wenn","außer dass",
    "beziehungsweise","bis","da","damit","dass","denn","doch","ehe","entweder",
    "es sei denn","falls","indem","je","nachdem","nicht nur","noch","ob","obgleich",
    "obschon","obwohl","oder","ohne dass","seitdem","selbst wenn","sobald","so dass",
    "sodass","solange","sondern","sooft","sowie","sowohl","statt dass","und","während",
    "weil","wenn","wenngleich","weder","wie","wohingegen","zumal"
  ];
  const multiPatterns=conjunctionLabels
    .map(label=>label.split(/\s+/u).map(autoSplitNormalizedWord).filter(Boolean))
    .filter(parts=>parts.length>1)
    .sort((a,b)=>b.length-a.length);
  const singleWords=new Set(conjunctionLabels
    .map(label=>label.split(/\s+/u).map(autoSplitNormalizedWord).filter(Boolean))
    .filter(parts=>parts.length===1)
    .map(parts=>parts[0]));
  const coveredByPhrase=new Set();

  // Zuerst längere Gefüge erkennen, damit z. B. „es sei denn“ nur vor „es“
  // und nicht zusätzlich vor dem darin enthaltenen „denn“ geteilt wird.
  for(const parts of multiPatterns){
    for(let wi=0;wi+parts.length<=words.length;wi++){
      const matches=parts.every((part,offset)=>words[wi+offset]?.word===part);
      if(!matches) continue;
      if(words[wi].tokenIndex!==first) cuts.add(words[wi].tokenIndex);
      for(let offset=1;offset<parts.length;offset++) coveredByPhrase.add(wi+offset);
    }
  }
  for(let wi=0;wi<words.length;wi++){
    if(coveredByPhrase.has(wi)) continue;
    if(singleWords.has(words[wi].word) && words[wi].tokenIndex!==first) cuts.add(words[wi].tokenIndex);
  }

  // „um … zu“ ist ein diskontinuierliches Konjunktionsgefüge. Nur vor „um“
  // teilen, wenn im selben Satz tatsächlich ein „zu“ folgt.
  for(let wi=0;wi<words.length;wi++){
    if(words[wi].word!=="um") continue;
    let isPurposeConstruction=false;
    for(let look=wi+1;look<words.length;look++){
      if(words[look].word==="zu"){isPurposeConstruction=true;break;}
      if(autoSplitTokenEndsWithPeriod(words[look].raw)) break;
    }
    if(isPurposeConstruction && words[wi].tokenIndex!==first) cuts.add(words[wi].tokenIndex);
  }

  // Nach jedem Satzpunkt am nächsten Inhalts-Token teilen.
  for(let wi=0;wi<words.length-1;wi++){
    if(!autoSplitTokenEndsWithPeriod(words[wi].raw)) continue;
    const nextToken=words[wi+1].tokenIndex;
    if(nextToken!==first) cuts.add(nextToken);
  }

  return [...cuts].filter(index=>!state.cuts.includes(index)).sort((a,b)=>a-b);
}
function autoSplitText(){
  if(state.settings.mode!=="bearbeiten" || activeTool!=="teilen" || !state.rawText.trim()) return;
  const newCuts=automaticSplitCutIndices();
  if(!newCuts.length){
    announce("Keine weiteren automatischen Teilungspunkte gefunden.");
    return;
  }
  if(hasRelations() && !confirm("Das automatische Teilen löscht alle Beziehungen. Fortfahren?")) return;
  selectionStartId=null;
  selectedRelationId=null;
  performAction(`${newCuts.length} automatische Teilung${newCuts.length===1?"":"en"} gesetzt`,()=>{
    if(hasRelations()) resetRelationsKeepSegmentation();
    state.cuts=[...new Set([...state.cuts,...newCuts])].sort((a,b)=>a-b);
    rebuildPropositions();
    state.rootIds=state.propositions.map(p=>p.id);
  });
}

function splitBefore(tokenIndex){
  if(state.settings.mode!=="bearbeiten" || activeTool!=="teilen") return;
  if(tokenIndex===firstContentToken() || state.cuts.includes(tokenIndex)) return;
  if(hasRelations() && !confirm("Das Teilen oder Zusammenführen löscht alle Beziehungen. Fortfahren?")) return;
  selectionStartId=null; selectedRelationId=null;
  performAction("Proposition geteilt",()=>{
    if(hasRelations()) resetRelationsKeepSegmentation();
    state.cuts=[...state.cuts,tokenIndex].sort((a,b)=>a-b);
    rebuildPropositions({splitToken:tokenIndex});
    state.rootIds=state.propositions.map(p=>p.id);
  });
}
function mergeAtPropIndex(index){
  if(state.settings.mode!=="bearbeiten" || activeTool!=="teilen") return;
  if(index<=0 || index>=state.propositions.length) return;
  const cut=state.propositions[index].tokenStart;
  if(hasRelations() && !confirm("Das Teilen oder Zusammenführen löscht alle Beziehungen. Fortfahren?")) return;
  selectionStartId=null; selectedRelationId=null;
  performAction("Grenze entfernt",()=>{
    if(hasRelations()) resetRelationsKeepSegmentation();
    state.cuts=state.cuts.filter(x=>x!==cut);
    rebuildPropositions({mergeCut:cut});
    state.rootIds=state.propositions.map(p=>p.id);
  });
}
function openSettingsDialog(){
  closeProjectMenu();
  els.lineAttachmentToggle.checked=uiSettings.lineAttachment!=="center";
  els.primaryLineWeightToggle.checked=uiSettings.emphasizePrimaryLines!==false;
  els.bibleArcingToggle.checked=uiSettings.bibleArcing===true;
  showDialog(els.settingsDialog);
}
function setLineAttachmentMode(mode){
  const next=mode==="center"?"center":"primary";
  if(uiSettings.lineAttachment===next) return;
  // Nur die app-weite Darstellungspräferenz wird geändert. Der Analysezustand,
  // Knoten, Rollen, Hauptpunkte, Projekte und JSON-Daten bleiben unangetastet.
  uiSettings.lineAttachment=next;
  storeUiSettings();
  render();
  announce(next==="center"?"Linien werden jetzt zentriert angeschlossen.":"Linien werden jetzt am Hauptpunkt angeschlossen.");
}
function setPrimaryLineEmphasis(enabled){
  const next=!!enabled;
  if(uiSettings.emphasizePrimaryLines===next) return;
  uiSettings.emphasizePrimaryLines=next;
  storeUiSettings();
  render();
  announce(next?"Hauptlinien werden stärker hervorgehoben.":"Hauptlinien verwenden normale Linienstärke.");
}
function setBibleArcing(enabled){
  const next=!!enabled;
  if(uiSettings.bibleArcing===next) return;
  uiSettings.bibleArcing=next;
  storeUiSettings();
  render();
  announce(next?"Bibelarcing wird rechts vom Text angezeigt.":"Bibelarcing ist ausgeblendet.");
}
function bibleArcSplitBounds(){
  const rect=els.centerAnalysisBody?.getBoundingClientRect();
  const width=Math.max(1,rect?.width||0);
  // Text braucht nur eine kleine arbeitsfähige Mindestbreite; die Arc-Seite kann
  // horizontal scrollen und muss deshalb nur eine schmale sichtbare Restbreite behalten.
  const textNeeded=Math.min(180,Math.max(110,width*.18));
  const arcNeeded=Math.min(92,Math.max(56,width*.10));
  const min=Math.max(.12,Math.min(.78,(textNeeded+1)/width));
  const max=Math.min(.94,Math.max(min,1-(arcNeeded+1)/width));
  return {min,max};
}
function clampBibleArcSplit(split){
  const n=normalizeProjectBibleArcSplit(split);
  const {min,max}=bibleArcSplitBounds();
  return Math.min(max,Math.max(min,n));
}
function applyBibleArcSplit(){
  if(!els.centerColumn) return;
  const enabled=uiSettings.bibleArcing===true && !!state.rawText && state.propositions.length>0;
  els.centerColumn.classList.toggle("biblearc-enabled",enabled);
  if(els.bibleArcDivider) els.bibleArcDivider.hidden=!enabled;
  if(!enabled) return;
  const project=activeProject();
  const split=clampBibleArcSplit(project?.bibleArcSplit);
  els.centerColumn.style.setProperty("--biblearc-split",`${(split*100).toFixed(2)}%`);
  if(els.bibleArcDivider){
    const {min,max}=bibleArcSplitBounds();
    els.bibleArcDivider.setAttribute("aria-valuemin",String(Math.round(min*100)));
    els.bibleArcDivider.setAttribute("aria-valuemax",String(Math.round(max*100)));
    els.bibleArcDivider.setAttribute("aria-valuenow",String(Math.round(split*100)));
  }
}
function setBibleArcSplit(split,{persist=false}={}){
  const project=activeProject();
  if(!project || !els.centerColumn) return;
  project.bibleArcSplit=clampBibleArcSplit(split);
  applyBibleArcSplit();
  requestAnimationFrame(measureAndRenderSvgs);
  if(persist){
    project.updatedAt=new Date().toISOString();
    try{ storeProjectsNow(); saveStateText="Lokal gespeichert"; }catch(_){ saveStateText="Nur für diese Sitzung gespeichert"; }
    renderStatus();
  }
}
function workspaceSplitBounds(){
  const rect=els.canvasGrid?.getBoundingClientRect();
  const width=Math.max(1,rect?.width||0);
  const graphNeeded=Math.max(42,Number(els.bracketSvg?.dataset.minWidth)||42);
  // Propositionstext darf stark umbrechen; nur eine kleine arbeitsfähige Restbreite
  // bleibt reserviert. Die Graph-Seite stoppt dagegen erst an ihrer real benötigten
  // Geometriebreite statt an einem pauschalen Prozentwert.
  const textNeeded=Math.min(180,Math.max(120,width*.14));
  const min=Math.max(.03,Math.min(.82,(graphNeeded+4)/width));
  const max=Math.min(.97,Math.max(min,1-(textNeeded+2)/width));
  return {min,max};
}
function clampWorkspaceSplit(split){
  const n=normalizeProjectWorkspaceSplit(split);
  const {min,max}=workspaceSplitBounds();
  return Math.min(max,Math.max(min,n));
}
function applyWorkspaceSplit(){
  if(!els.canvasGrid) return;
  const project=activeProject();
  const split=clampWorkspaceSplit(project?.workspaceSplit);
  els.canvasGrid.style.setProperty("--workspace-split",`${(split*100).toFixed(2)}%`);
  if(els.workspaceDivider){
    const {min,max}=workspaceSplitBounds();
    els.workspaceDivider.setAttribute("aria-valuemin",String(Math.round(min*100)));
    els.workspaceDivider.setAttribute("aria-valuemax",String(Math.round(max*100)));
    els.workspaceDivider.setAttribute("aria-valuenow",String(Math.round(split*100)));
  }
}
function setWorkspaceSplit(split,{persist=false}={}){
  const project=activeProject();
  if(!project || !els.canvasGrid) return;
  project.workspaceSplit=clampWorkspaceSplit(split);
  applyWorkspaceSplit();
  requestAnimationFrame(measureAndRenderSvgs);
  if(persist){
    project.updatedAt=new Date().toISOString();
    try{ storeProjectsNow(); saveStateText="Lokal gespeichert"; }catch(_){ saveStateText="Nur für diese Sitzung gespeichert"; }
    renderStatus();
  }
}
function setMode(mode){
  state.settings.mode=mode;
  if(mode!=="bearbeiten"){
    selectionStartId=null; selectedRelationId=null;
    if(els.relationshipDialog.open) closeRelationshipDialog();
  }
  state.updatedAt=new Date().toISOString();
  render(); schedulePersist();
}
function setTool(tool){
  activeTool=normalizeProjectTool(tool);
  selectionStartId=null;
  if(activeTool!=="verbinden"){
    selectedRelationId=null;
    if(els.relationshipDialog.open) closeRelationshipDialog();
  }
  const project=activeProject();
  if(project) project.activeTool=activeTool;
  render();
  schedulePersist();
}
function setExtended(enabled){
  state.settings.includeExtended=!!enabled;
  if(!enabled && activeRelationId && chosenRelationshipId){
    const node=getNode(activeRelationId);
    const chosen=RELATIONSHIPS[chosenRelationshipId];
    if(chosen?.extended && node?.relationshipId!==chosenRelationshipId) chosenRelationshipId=node?.relationshipId||null;
  }
  state.updatedAt=new Date().toISOString(); render(); schedulePersist();
  if(els.relationshipDialog.open) renderRelationshipDialog();
}

function schedulePersist(){
  clearTimeout(saveTimer);
  saveStateText="Speichern …";
  renderStatus();
  saveTimer=setTimeout(persistNow,300);
}
function persistNow(){
  try{
    syncStateIntoActiveProject();
    storeProjectsNow();
    saveStateText="Lokal gespeichert";
  }catch(err){
    saveStateText="Nur für diese Sitzung gespeichert";
  }
  renderStatus();
  if(els.projectsDialog?.open) renderProjectManager();
}
function loadSaved(){ return loadProjects(); }
function resetAll(){
  if(!confirm("Aktuelles Projekt vollständig zurücksetzen? Text, Struktur und Verlauf dieses Projekts werden gelöscht. Andere Projekte bleiben erhalten.")) return;
  clearTimeout(saveTimer);
  state=createEmptyState(); history=[]; future=[]; selectionStartId=null; selectedRelationId=null; activeRelationId=null; chosenRelationshipId=null; activeTool="teilen";
  saveStateText="Speichern …";
  try{ syncStateIntoActiveProject(); storeProjectsNow(); saveStateText="Lokal gespeichert"; }
  catch(_){ saveStateText="Nur für diese Sitzung gespeichert"; }
  render(); announce("Aktuelles Projekt zurückgesetzt");
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function exportBaseFilename(){
  const source=(state.title||"analyse").trim().toLocaleLowerCase("de");
  const slug=source.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"analyse";
  return `sensus-lab-${slug}`;
}
function exportJson(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json;charset=utf-8"});
  downloadBlob(blob,`${exportBaseFilename()}.json`);
  announce("JSON exportiert");
}
