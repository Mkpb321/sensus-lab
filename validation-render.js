/* Sensus Lab – Validierung, Status-/Propositions-Rendering und gemeinsame SVG-/Klammer-Hilfsfunktionen. */
"use strict";

function relationErrorIds(validation){
  return validation && validation.nodeErrors ? validation.nodeErrors : new Set();
}

function validateState(){
  const errors=[],warnings=[],nodeErrors=new Set();
  const addError=(message,...ids)=>{
    if(!errors.includes(message)) errors.push(message);
    ids.filter(Boolean).forEach(id=>nodeErrors.add(id));
  };
  if(!state.rawText || !state.rawText.trim()) return {errors,warnings,nodeErrors,openCount:0,complete:false};
  if(state.propositions.length<2) addError("Teile den Text in mindestens zwei Propositionen, um Beziehungen anzulegen.");

  const rels=relationNodes();
  const parentUse=new Map();
  for(const node of rels){
    const children=Array.isArray(node.children)?node.children:[];
    if(children.length<2 || new Set(children).size!==children.length){
      addError(`${nodeLabel(node.id)} benötigt mindestens zwei unterschiedliche Kinder.`,node.id);
    }
    for(const childId of children){
      parentUse.set(childId,(parentUse.get(childId)||0)+1);
      if(!getNode(childId)) addError(`${nodeLabel(node.id)} verweist auf eine fehlende Einheit.`,node.id);
    }
    const spans=children.map(nodeSpan);
    for(let i=0;i<spans.length;i++){
      if(spans[i].start<0 || spans[i].end<spans[i].start){
        addError(`${nodeLabel(node.id)}: Ein Kind besitzt keinen gültigen Textbereich.`,node.id); break;
      }
      if(i>0 && spans[i-1].end+1!==spans[i].start){
        addError(`${nodeLabel(node.id)}: Kinder müssen direkt benachbart und lückenlos sein.`,node.id); break;
      }
    }

    if(node.relationshipId==null){
      addError(`Wähle noch eine logische Beziehung für die graue Verbindung ${nodeLabel(node.id)}.`,node.id);
      continue;
    }
    const rel=RELATIONSHIPS[node.relationshipId];
    if(!rel){
      addError(`${nodeLabel(node.id)} verwendet eine unbekannte Beziehung.`,node.id);
      continue;
    }
    if(!cardinalityOk(rel,children.length)){
      addError(`${rel.label}: Diese Beziehung benötigt ${cardinalityText(rel)} Einheiten.`,node.id);
    }

    if(!Array.isArray(node.roleOrder) || node.roleOrder.length!==children.length){
      addError(`${rel.label}: Rollenreihenfolge ist unvollständig.`,node.id);
    }else{
      let rolesValid=true;
      if(rel.primary==="all"){
        rolesValid=node.roleOrder.every(role=>role==="Hauptteil");
      }else if(Array.isArray(rel.roles) && rel.roles.length===children.length){
        const exact=rel.roles.every((role,i)=>node.roleOrder[i]===role);
        const reversed=children.length===2 && !Array.isArray(rel.primary) && rel.primary!=="all" && rel.roles.every((role,i)=>node.roleOrder[children.length-1-i]===role);
        rolesValid=exact||reversed;
      }
      if(!rolesValid) addError(`${rel.label}: Die Rollenreihenfolge passt nicht zum Beziehungstyp.`,node.id);
    }

    if(!Array.isArray(node.primaryChildIds)){
      addError(`${rel.label}: Hauptteilmarkierung ist beschädigt.`,node.id);
    }else if(rel.primary==="all"){
      if(node.primaryChildIds.length!==children.length || children.some(id=>!node.primaryChildIds.includes(id))){
        addError(`${rel.label}: Alle Kinder müssen gleichrangige Hauptteile sein.`,node.id);
      }
    }else if(Array.isArray(rel.primary)){
      const required=rel.primary.map(i=>children[i]).filter(Boolean);
      if(required.length!==node.primaryChildIds.length || required.some(id=>!node.primaryChildIds.includes(id))){
        addError(`${rel.label}: Die Hauptteilmarkierung entspricht nicht der Beziehungsregel.`,node.id);
      }
    }else if(node.primaryChildIds.length!==1 || node.primaryChildIds.some(id=>!children.includes(id))){
      addError(`${rel.label}: Es fehlt eine gültige Hauptteilmarkierung.`,node.id);
    }

    // Zusätzliche kanonische Richtungsprüfung: Bei gerichteten binären
    // Beziehungen müssen Rollen und Hauptpunkt exakt aus Typ + gespeicherter
    // Richtung ableitbar sein. Dadurch kann kein Zwischenzustand existieren,
    // in dem z. B. die Rollen bereits gedreht sind, Stern/Anker aber noch nicht.
    if(isDirectionalBinary(rel,children)){
      const expected=computedRelationState(node,rel,{
        directionFirstChildId:inferDirectionFirstChildId(node,rel),
        primaryRoleChoice:node.relationshipId==="handlung_ergebnis" ? inferPrimaryRoleChoice(node,"handlung_ergebnis") : null
      });
      if(!sameIdArray(node.roleOrder,expected.roleOrder)){
        addError(`${rel.label}: Rollen und gespeicherte Richtung sind nicht konsistent.`,node.id);
      }
      if(!sameIdArray(node.primaryChildIds,expected.primaryChildIds)){
        addError(`${rel.label}: Hauptpunkt und gespeicherte Richtung sind nicht konsistent.`,node.id);
      }
    }
    if(rel.extended && !state.settings.includeExtended){
      warnings.push(`${rel.label} ist eine erweiterte Beziehung; zum Bearbeiten die erweiterten Beziehungen einschalten.`);
    }
  }

  for(const [childId,count] of parentUse){
    if(count>1){
      const child=getNode(childId);
      addError(`${child?.kind==="relation"?nodeLabel(childId):"Eine Proposition"} ist mehreren Elternverbindungen zugleich zugeordnet.`,child?.kind==="relation"?childId:null);
    }
  }
  for(const rootId of state.rootIds){
    if((parentUse.get(rootId)||0)>0) addError(`${nodeLabel(rootId)} ist zugleich Wurzel und Kind einer anderen Verbindung.`,getNode(rootId)?.kind==="relation"?rootId:null);
  }

  const relSpans=rels.map(n=>({id:n.id,...nodeSpan(n.id)}));
  for(let i=0;i<relSpans.length;i++){
    for(let j=i+1;j<relSpans.length;j++){
      const a=relSpans[i],b=relSpans[j];
      const overlap=Math.max(a.start,b.start)<=Math.min(a.end,b.end);
      const aContains=a.start<=b.start && a.end>=b.end;
      const bContains=b.start<=a.start && b.end>=a.end;
      if(overlap && !aContains && !bContains){
        addError("Diese Verbindung würde eine vorhandene Beziehung kreuzen.",a.id,b.id);
      }
    }
  }

  if(state.propositions.length>1 && state.rootIds.length!==1){
    addError("Verbinde die verbleibenden Hauptgruppen zu einer Gesamtstruktur.");
  }
  const reached=new Set();
  const walk=id=>{
    if(reached.has(id)) return;
    reached.add(id);
    const n=getNode(id);
    if(n && n.kind==="relation") for(const c of n.children||[]) walk(c);
  };
  for(const r of state.rootIds) walk(r);
  const missingProps=state.propositions.filter(p=>!reached.has(p.id));
  if(missingProps.length) addError("Mindestens eine Proposition ist verwaist und nicht Teil der Struktur.");
  const orphanRelations=rels.filter(n=>!reached.has(n.id));
  if(orphanRelations.length) addError("Mindestens eine Verbindung ist verwaist und nicht Teil der sichtbaren Gesamtstruktur.",...orphanRelations.map(n=>n.id));

  const openCount=rels.filter(n=>n.relationshipId==null).length;
  const complete=!!state.rawText && state.propositions.length>=2 && errors.length===0 && state.rootIds.length===1;
  return {errors,warnings,nodeErrors,openCount,complete};
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
}
function render(){
  if(selectedRelationId && !getNode(selectedRelationId)) selectedRelationId=null;
  lastValidation=validateState();
  document.body.dataset.mode=state.settings.mode;
  document.body.dataset.tool=activeTool;
  els.extendedToggle.checked=!!state.settings.includeExtended;
  els.editModeButton.setAttribute("aria-pressed",state.settings.mode==="bearbeiten");
  els.viewModeButton.setAttribute("aria-pressed",state.settings.mode==="ansicht");
  els.splitToolButton.setAttribute("aria-pressed",activeTool==="teilen");
  els.connectToolButton.setAttribute("aria-pressed",activeTool==="verbinden");
  els.toolGroup.style.display=state.settings.mode==="bearbeiten"?"flex":"none";
  els.documentHeading.hidden=!state.title;
  els.documentHeading.textContent=state.title||"";
  els.textButton.textContent="Text";
  els.textButton.title=state.rawText?"Text bearbeiten":"Text einfügen";
  const currentProject=activeProject();
  applyWorkspaceSplit();
  if(currentProject){
    els.projectMenuButton.setAttribute("aria-label",`Menü öffnen. Projekt: ${projectDisplayName(currentProject)}`);
    if(els.projectsDialog?.open) renderProjectManager();
  }
  els.centerModeLabel.textContent=state.settings.mode==="ansicht"?"Ansicht":(activeTool==="teilen"?"Teilen":"Verbinden");
  els.undoButton.disabled=!history.length;
  els.redoButton.disabled=!future.length;
  renderStatus();
  renderPropositions();
  renderUnitBar();
  renderTreeSummary();
  requestAnimationFrame(measureAndRenderSvgs);
}
function renderStatus(){
  const v=lastValidation;
  els.propStatus.textContent=`${state.propositions.length} ${state.propositions.length===1?"Proposition":"Propositionen"}`;
  els.openStatus.textContent=`${v.openCount} ${v.openCount===1?"offene Gruppe":"offene Gruppen"}`;
  els.rootStatus.textContent=`${state.rootIds.length} ${state.rootIds.length===1?"Wurzel":"Wurzeln"}`;
  els.errorStatus.textContent=`${v.errors.length} ${v.errors.length===1?"Fehler":"Fehler"}`;
  els.errorStatus.classList.toggle("problem",v.errors.length>0);
  els.saveStatus.textContent=saveStateText;
  if(selectedRelationId && getNode(selectedRelationId)?.kind==="relation") {
    els.selectionStatus.hidden=false;
    els.selectionStatus.textContent=`Auswahl: ${nodeLabel(selectedRelationId)}`;
  } else {
    els.selectionStatus.hidden=true;
    els.selectionStatus.textContent="";
  }
  if(!state.rawText){
    els.finishPill.textContent="Keine Analyse";
    els.finishPill.className="status-pill";
  }else if(v.complete){
    els.finishPill.textContent="Vollständig";
    els.finishPill.className="status-pill done";
  }else{
    els.finishPill.textContent="Unvollständig";
    els.finishPill.className="status-pill problem";
  }
  const items=[...v.errors,...v.warnings];
  if(items.length){
    els.validationStrip.className="validation-strip show";
    const shown=items.slice(0,3).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
    const more=items.length>3?`<li>… ${items.length-3} weitere Meldung${items.length-3===1?"":"en"} in den Statusdetails.</li>`:"";
    els.validationStrip.innerHTML=`<strong>Prüfung:</strong><ul>${shown}${more}</ul>`;
  }else{
    els.validationStrip.className="validation-strip";
    els.validationStrip.innerHTML="";
  }
}
function propositionHtml(p,i){
  const selected=selectionStartId===p.id?" selected":"";
  const edit=state.settings.mode==="bearbeiten";
  const connect=edit && activeTool==="verbinden";
  const content=[];
  for(let ti=p.tokenStart;ti<=p.tokenEnd;ti++){
    const tok=state.tokens[ti] ?? "";
    if(isWhitespaceToken(tok)){
      content.push(escapeHtml(tok));
      continue;
    }
    const canSplit=edit && activeTool==="teilen" && !state.cuts.includes(ti) && ti!==firstContentToken();
    if(canSplit){
      content.push(`<button class="split-word" type="button" data-split-token="${ti}" title="Neue Proposition vor „${escapeHtml(tok)}“ beginnen">${escapeHtml(tok)}</button>`);
    }else{
      content.push(`<span class="word-token">${escapeHtml(tok)}</span>`);
    }
  }
  const anchorAvailable=connect && canUseConnectionAnchor(p.id);
  const anchor=anchorAvailable?`<button class="unit-anchor${selectionStartId===p.id?" selected":""}" type="button" data-unit-id="${p.id}" aria-label="${nodeLabel(p.id)} zum Verbinden auswählen"></button>`:"";
  return `<div class="prop-wrap" data-prop-wrap="${p.id}">
    ${edit && activeTool==="teilen" && i>0?`<button class="merge-button" type="button" data-merge-index="${i}" title="Grenze entfernen" aria-label="Grenze vor P${i+1} entfernen">×</button>`:""}
    <article class="prop-card${selected}${anchorAvailable?" has-anchor":""}" data-prop-id="${p.id}">
      <div class="anchor-cell">${anchor}</div>
      <div class="prop-content"><span class="sr-only">P${i+1}: </span>${content.join("")}</div>
    </article>
  </div>`;
}
function renderPropositions(){
  if(!state.rawText){
    els.propList.innerHTML=`<div class="empty-center">
      <h2>Kein Text</h2>
      <button class="primary-action" type="button" data-empty-text>Text öffnen</button>
    </div>`;
    return;
  }
  els.propList.innerHTML=state.propositions.map(propositionHtml).join("");
}
function allSelectableUnits(){
  const ids=[];
  const add=id=>{if(id && getNode(id) && canUseConnectionAnchor(id) && !ids.includes(id)) ids.push(id);};

  // Keine zweite, abweichende Verfügbarkeitslogik in der Einheitenleiste:
  // Jeder Knoten wird ausschließlich durch canUseConnectionAnchor geprüft.
  // So stimmen Proposition-Anker, Beziehungs-Anker, Leiste und Klicklogik exakt überein.
  state.propositions.forEach(p=>add(p.id));
  relationNodes().forEach(rel=>add(rel.id));

  ids.sort((a,b)=>{
    const sa=nodeSpan(a),sb=nodeSpan(b);
    if(sa.start!==sb.start) return sa.start-sb.start;
    if(sa.end!==sb.end) return sa.end-sb.end;
    return getNode(a).kind==="proposition"?-1:1;
  });
  return ids;
}
function renderUnitBar(){
  const show=state.rawText && state.settings.mode==="bearbeiten" && activeTool==="verbinden";
  els.unitBar.classList.toggle("show",!!show);
  if(!show){els.unitButtons.innerHTML="";return;}
  const ids=allSelectableUnits();
  els.unitHint.textContent=selectedRelationId
    ? `${nodeLabel(selectedRelationId)} ausgewählt. Entf/Backspace löst genau diese Verbindung auf; Untergruppen bleiben erhalten.`
    : activeTool==="verbinden"
      ? (selectionStartId?`Start gewählt: ${nodeLabel(selectionStartId)}. Wähle nun eine Geschwistereinheit; der Bereich dazwischen wird gemeinsam gruppiert.`:"Wähle zuerst eine Einheit und danach das Ende eines zusammenhängenden Geschwisterbereichs. Klammern lassen sich anklicken und mit Entf löschen. Ein Klick auf den ausgeschriebenen Beziehungsnamen öffnet die Beziehungsauswahl.")
      :"Im Werkzeug „Teilen“ liegen die Teilungspunkte direkt vor den Wörtern.";
  els.unitButtons.innerHTML=ids.map(id=>{
    const n=getNode(id);
    const parent=findParentInfo(id);
    const parentText=parent && parent.parentId?` · innerhalb ${nodeLabel(parent.parentId)}`:" · Wurzelebene";
    const classes=["unit-chip"];
    if(selectionStartId===id || selectedRelationId===id) classes.push("selected");
    if(n.kind==="relation" && n.relationshipId==null) classes.push("open");
    return `<button type="button" class="${classes.join(" ")}" data-unit-id="${id}" title="${escapeHtml(nodeLabel(id)+parentText)}">${escapeHtml(nodeLabel(id))}</button>`;
  }).join("");
}
function renderTreeSummary(){
  if(!state.rawText){els.treeSummary.textContent="Keine Analyse vorhanden.";return;}
  const pMap=propIndexMap();
  function describe(id){
    const n=getNode(id);
    if(!n) return "Unbekannte Einheit";
    if(n.kind==="proposition") return `P${(pMap.get(id)??0)+1}`;
    const rel=RELATIONSHIPS[n.relationshipId];
    const name=rel?rel.label:"Offene Gruppe";
    const children=(n.children||[]).map((cid,i)=>{
      const role=n.roleOrder && n.roleOrder[i]?n.roleOrder[i]:"Teil";
      const main=(n.primaryChildIds||[]).includes(cid)?" Hauptteil":"";
      return `${role}${main}: ${describe(cid)}`;
    }).join("; ");
    return `${name}: ${children}`;
  }
  els.treeSummary.textContent=state.rootIds.map(describe).join(". ");
}
function openStatusDetails(){
  const v=lastValidation||validateState();
  const errors=v.errors.length?v.errors.map(e=>`<li>${escapeHtml(e)}</li>`).join(""):"<li>Keine Validierungsfehler.</li>";
  const warnings=v.warnings.length?v.warnings.map(e=>`<li>${escapeHtml(e)}</li>`).join(""):"<li>Keine Hinweise.</li>";
  els.statusDialogBody.innerHTML=`
    <p><strong>${v.complete?"Analyse vollständig":"Analyse unvollständig"}</strong></p>
    <p>${state.propositions.length} Propositionen · ${v.openCount} offene Gruppen · ${state.rootIds.length} Wurzeln · ${v.errors.length} Fehler.</p>
    <h3>Fehler</h3><ul class="status-dialog-list">${errors}</ul>
    <h3>Hinweise</h3><ul class="status-dialog-list">${warnings}</ul>
    <p class="small-note">Vollständig ist die Analyse nur bei genau einer beschrifteten Wurzel über allen Propositionen, ohne offene Gruppen, ungültige Kardinalitäten oder verwaiste Teile.</p>`;
  showDialog(els.statusDialog);
}

function getAnchorMap(){
  const map=new Map();
  const base=els.propList.getBoundingClientRect();
  for(const card of $$("[data-prop-id]",els.propList)){
    const rect=card.getBoundingClientRect();
    map.set(card.dataset.propId,{top:rect.top-base.top,bottom:rect.bottom-base.top,center:(rect.top+rect.bottom)/2-base.top});
  }
  return map;
}
function relationLayoutData(anchorMap){
  const depthMemo=new Map();
  return relationNodes().map(node=>{
    const leaves=collectLeaves(node.id);
    const first=anchorMap.get(leaves[0]), last=anchorMap.get(leaves[leaves.length-1]);
    if(!first || !last) return null;
    return {
      node,
      depth:nodeDepth(node.id,depthMemo),
      top:first.top,
      bottom:last.bottom,
      center:(first.top+last.bottom)/2,
      childCenters:(node.children||[]).map(cid=>{
        const cl=collectLeaves(cid);
        const a=anchorMap.get(cl[0]),b=anchorMap.get(cl[cl.length-1]);
        return a&&b?(a.center+b.center)/2:null;
      })
    };
  }).filter(Boolean).sort((a,b)=>a.depth-b.depth || a.top-b.top);
}
function relationStrokeInfo(node){
  const rel=RELATIONSHIPS[node.relationshipId];
  let color=node.relationshipId==null?"#77818c":(rel?relationshipColor(rel,node.relationshipId):"#77818c");
  let dash=node.relationshipId==null?"6 5":"";
  let width=2;
  if(lastValidation && lastValidation.nodeErrors.has(node.id)){color="#b42318";width=2.5;dash=node.relationshipId==null?"6 5":"";}
  if(selectionStartId===node.id || selectedRelationId===node.id){color="#2563eb";width=2.6;}
  return {rel,color,dash,width};
}
function safeSvgText(value){return escapeHtml(value).replace(/&#039;/g,"'");}

function compactRole(role){
  const map={
    "Hauptaussage":"HA",
    "Aussage":"Aus",
    "Grund":"Gr",
    "Schluss":"Schl",
    "Handlung":"H",
    "Ergebnis":"Erg",
    "Zweck":"Z",
    "Bedingung":"B",
    "Folge":"F",
    "Folgerung":"Fg",
    "Zeit":"Zt",
    "Ort":"O",
    "Art und Weise":"AW",
    "Vergleichsbild":"V",
    "Verneinung":"−",
    "Bejahung":"+",
    "Erklärung":"Erk",
    "Frage":"Q",
    "Antwort":"A",
    "Einräumung":"Einr",
    "Situation":"Sit",
    "Reaktion":"Re",
    "Allgemein":"All",
    "Spezifisch":"Sp",
    "Tatsache":"Tat",
    "Deutung":"Deu",
    "Ankündigung":"Ank",
    "Erfüllung":"Erf"
  };
  return map[role]||String(role||"");
}
function relationShortCode(relationshipOrNode){
  if(relationshipOrNode && typeof relationshipOrNode==="object" && !Array.isArray(relationshipOrNode)){
    return relationShortCode(relationshipOrNode.relationshipId??null);
  }
  if(relationshipOrNode==null) return "Offen";
  const rel=RELATIONSHIPS[relationshipOrNode];
  return rel && rel.uiCode ? String(rel.uiCode) : String(relationshipOrNode||"");
}
function relationLegendLabel(relationshipOrNode){
  if(relationshipOrNode && typeof relationshipOrNode==="object" && !Array.isArray(relationshipOrNode)){
    return relationLegendLabel(relationshipOrNode.relationshipId??null);
  }
  if(relationshipOrNode==null) return "Offene Gruppe";
  const rel=RELATIONSHIPS[relationshipOrNode];
  return rel && rel.label ? String(rel.label) : String(relationshipOrNode||"");
}
function relationLaneX(depth,canvasWidth,gap=108,rightEdge=24){
  // Tiefe 1 liegt direkt am Text. Jede weitere Verschachtelung bekommt eine
  // vollständig eigene horizontale Bahn. Der Abstand ist absichtlich groß
  // genug für Beziehungscode, Rollenbadge und Auswahlmarkierung.
  return canvasWidth-rightEdge-depth*gap;
}
function wrapBracketText(text,maxChars=17,maxLines=4){
  // Bereits verständlich gekürzte Beschriftungen dürfen bei Bedarf zusätzlich
  // an Wort- bzw. Gedankenstrichgrenzen auf mehrere SVG-Zeilen verteilt werden.
  const normalized=String(text||"").trim().replace(/–/g,"– ");
  const words=normalized.split(/\s+/).filter(Boolean);
  if(!words.length) return [""];
  const lines=[];
  let line="";
  for(const word of words){
    const candidate=line?`${line} ${word}`:word;
    if(line && candidate.length>maxChars){
      lines.push(line);
      line=word;
    }else{
      line=candidate;
    }
  }
  if(line) lines.push(line);
  if(lines.length<=maxLines) return lines;
  // Auch im Extremfall nicht kürzen: verbleibende Wörter werden in der letzten
  // sichtbaren Zeile zusammengeführt, statt mit Ellipse abgeschnitten zu werden.
  return [...lines.slice(0,maxLines-1),lines.slice(maxLines-1).join(" ")];
}
function bracketTextMetrics(lines,{minWidth=34,maxWidth=132,charWidth=5.55,lineHeight=12,padX=12,padY=7}={}){
  const longest=Math.max(1,...lines.map(x=>String(x).length));
  const width=Math.max(minWidth,Math.min(maxWidth,padX*2+longest*charWidth));
  const height=padY*2+Math.max(1,lines.length)*lineHeight;
  return {width,height,lineHeight,padX,padY};
}
function svgMultilineText(lines,x,centerY,className,fill,lineHeight=12){
  const safeLines=lines&&lines.length?lines:[""];
  const middle=(safeLines.length-1)/2;
  return `<text x="${x}" y="${centerY}" class="${className}" dominant-baseline="middle" alignment-baseline="middle"${fill?` fill="${fill}"`:""}>${safeLines.map((line,i)=>`<tspan x="${x}" y="${centerY+(i-middle)*lineHeight}" dominant-baseline="middle" alignment-baseline="middle">${safeSvgText(line)}</tspan>`).join("")}</text>`;
}
function chooseRelationLabelY({topY,bottomY,portY,labelHeight,canvasHeight,occupied,forbiddenYs=[]}){
  const half=labelHeight/2;
  const margin=6;
  const portClearance=half+24; // Platz für die eingehende Elternlinie.
  const center=(topY+bottomY)/2;
  const candidates=[
    topY+half+margin,
    bottomY-half-margin,
    center,
    topY-half-10,
    bottomY+half+10
  ];
  const valid=(y)=>{
    if(!Number.isFinite(y) || y-half<4 || y+half>canvasHeight-4) return false;
    if(Number.isFinite(portY) && Math.abs(y-portY)<portClearance) return false;
    // Jede horizontale Klammerlinie, die den reservierten Label-Korridor quert,
    // sperrt ihre y-Position. Damit kann ein Beziehungstitel keine Linie verdecken.
    if(forbiddenYs.some(fy=>Number.isFinite(fy) && Math.abs(y-fy)<half+10)) return false;
    return !occupied.some(([a,b])=>y+half+5>a && y-half-5<b);
  };
  for(const y of candidates){
    if(valid(y)){occupied.push([y-half,y+half]);return y;}
  }
  // Deterministischer Fallback: die nächstgelegene freie Position derselben Bahn suchen.
  const possible=[];
  for(let y=half+4;y<=canvasHeight-half-4;y+=6){
    if(valid(y)) possible.push(y);
  }
  const y=possible.length?possible.sort((a,b)=>Math.abs(a-center)-Math.abs(b-center))[0]:Math.max(half+4,Math.min(canvasHeight-half-4,center));
  occupied.push([y-half,y+half]);
  return y;
}
function bracketNodePortY(nodeId,anchorMap,memo=new Map()){
  if(memo.has(nodeId)) return memo.get(nodeId);
  const n=getNode(nodeId);
  if(!n) return null;
  if(n.kind==="proposition"){
    const a=anchorMap.get(nodeId);
    const y=a?a.center:null;
    memo.set(nodeId,y);
    return y;
  }
  const childPorts=(n.children||[]).map(cid=>bracketNodePortY(cid,anchorMap,memo)).filter(v=>Number.isFinite(v));
  if(!childPorts.length){memo.set(nodeId,null);return null;}
  const primaryPorts=(n.primaryChildIds||[])
    .map(cid=>bracketNodePortY(cid,anchorMap,memo))
    .filter(v=>Number.isFinite(v));
  let y;
  if(uiSettings.lineAttachment==="center"){
    // Rein visuelle Alternative: Der Port der Beziehung liegt unabhängig vom
    // semantischen Hauptpunkt exakt in der Mitte ihrer sichtbaren Kind-Ports.
    y=(Math.min(...childPorts)+Math.max(...childPorts))/2;
  }else if(primaryPorts.length===1) y=primaryPorts[0];
  else if(primaryPorts.length>1) y=(Math.min(...primaryPorts)+Math.max(...primaryPorts))/2;
  else y=(Math.min(...childPorts)+Math.max(...childPorts))/2;
  memo.set(nodeId,y);
  return y;
}
function chooseBracketCodeY(childPorts){
  const ys=[...new Set(childPorts.filter(Number.isFinite).map(v=>Math.round(v*10)/10))].sort((a,b)=>a-b);
  if(!ys.length) return 0;
  if(ys.length===1) return ys[0]-18;
  const geometric=(ys[0]+ys[ys.length-1])/2;
  const gaps=[];
  for(let i=0;i<ys.length-1;i++){
    const gap=ys[i+1]-ys[i];
    // Ein Code-Badge ist 18 px hoch. 26 px Mindestlücke gibt auf beiden
    // Seiten sichtbaren Abstand zu den horizontalen Ästen.
    if(gap>=26) gaps.push({y:(ys[i]+ys[i+1])/2,gap});
  }
  if(gaps.length){
    gaps.sort((a,b)=>Math.abs(a.y-geometric)-Math.abs(b.y-geometric) || b.gap-a.gap);
    return gaps[0].y;
  }
  // Extrem dichter Sonderfall: außerhalb der Äste platzieren. Dadurch wird
  // niemals eine Linie vom Label überdeckt.
  return ys[0]-16;
}
function setBracketCanvasWidth(svg,width){
  const wrap=svg.parentElement;
  const previous=Number(svg.dataset.layoutWidth||0);
  svg.dataset.layoutWidth=String(width);
  svg.style.width=width+"px";
  if(previous!==width){
    requestAnimationFrame(()=>{
      // Die textnahe Seite liegt rechts. Bei einer neuen Tiefe wird deshalb
      // einmalig dorthin ausgerichtet; danach darf frei horizontal gescrollt werden.
      wrap.scrollLeft=Math.max(0,wrap.scrollWidth-wrap.clientWidth);
    });
  }
}
