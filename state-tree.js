/* Sensus Lab – Text-/Zustandsmodell, Hydrierung, Verlauf, Baumlogik, Richtungslogik und Strukturmutationen. */
"use strict";

function normalizeRawText(input){
  const normalized = String(input ?? "").replace(/\r\n?/g,"\n");
  const lines = normalized.split("\n");
  while(lines.length && lines[0].trim()==="") lines.shift();
  while(lines.length && lines[lines.length-1].trim()==="") lines.pop();
  return lines.join("\n");
}
function tokenize(raw){ return raw ? (raw.match(/\s+|[^\s]+/gu) || []) : []; }
function isWhitespaceToken(t){ return /^\s+$/u.test(t); }
function firstContentToken(tokens=state.tokens){ return tokens.findIndex(t=>!isWhitespaceToken(t)); }
function rangeKey(a,b){ return a+":"+b; }

function deriveRanges(tokens,cuts){
  if(!tokens.length || !cuts.length) return [];
  const sorted=[...new Set(cuts)].sort((a,b)=>a-b);
  return sorted.map((start,i)=>({tokenStart:start,tokenEnd:(i+1<sorted.length?sorted[i+1]-1:tokens.length-1)}));
}
function rebuildPropositions(options={}){
  const oldProps = state.propositions || [];
  const oldExact = new Map(oldProps.map(p=>[rangeKey(p.tokenStart,p.tokenEnd),p.id]));
  const oldContainer = options.splitToken==null ? null : oldProps.find(p=>p.tokenStart < options.splitToken && p.tokenEnd >= options.splitToken);
  const ranges = deriveRanges(state.tokens,state.cuts);
  const newProps = [];
  const propNodes = {};
  for(const r of ranges){
    let id = oldExact.get(rangeKey(r.tokenStart,r.tokenEnd));
    if(!id && oldContainer && r.tokenStart===oldContainer.tokenStart) id=oldContainer.id;
    if(!id) id=makeId("p");
    const node={kind:"proposition",id,tokenStart:r.tokenStart,tokenEnd:r.tokenEnd};
    newProps.push(node); propNodes[id]=node;
  }
  const relationNodes = Object.fromEntries(Object.entries(state.nodesById||{}).filter(([,n])=>n && n.kind==="relation"));
  state.propositions=newProps;
  state.nodesById={...relationNodes,...propNodes};
  return newProps;
}
function initializeText(raw,title=state.title||"",mainPointSummary=state.mainPointSummary||""){
  state.title=String(title||"").trim();
  state.mainPointSummary=String(mainPointSummary||"").trim();
  state.rawText=raw;
  state.tokens=tokenize(raw);
  const first=firstContentToken(state.tokens);
  state.cuts=first>=0?[first]:[];
  state.nodesById={};
  state.propositions=[];
  rebuildPropositions();
  state.rootIds=state.propositions.map(p=>p.id);
  rebuildParentIds();
}
function resetRelationsKeepSegmentation(){
  const propMap={};
  for(const p of state.propositions) propMap[p.id]=p;
  state.nodesById=propMap;
  state.rootIds=state.propositions.map(p=>p.id);
}
function assertSafeStateShape(s){
  if(typeof s.title!=="string") throw new Error("Ungültiger Zustand: Titel muss Text sein.");
  if(typeof s.mainPointSummary!=="string") throw new Error("Ungültiger Zustand: Hauptaussage muss Text sein.");
  if(typeof s.rawText!=="string") throw new Error("Ungültiger Zustand: rawText muss Text sein.");
  if(!Array.isArray(s.tokens) || s.tokens.some(t=>typeof t!=="string")) throw new Error("Ungültiger Zustand: Tokenliste fehlt oder ist beschädigt.");
  if(s.tokens.join("")!==s.rawText) throw new Error("Ungültiger Zustand: Tokenisierung passt nicht zum Text.");
  if(!Array.isArray(s.cuts) || s.cuts.some(x=>!Number.isInteger(x) || x<0 || x>=s.tokens.length)) throw new Error("Ungültiger Zustand: Teilungsgrenzen sind beschädigt.");
  if(new Set(s.cuts).size!==s.cuts.length || s.cuts.some((x,i)=>i>0 && s.cuts[i-1]>=x)) throw new Error("Ungültiger Zustand: Teilungsgrenzen müssen eindeutig und sortiert sein.");
  if(s.rawText.trim()){
    const first=s.tokens.findIndex(t=>!/^\s+$/u.test(t));
    if(first<0 || s.cuts[0]!==first) throw new Error("Ungültiger Zustand: Die erste Proposition beginnt nicht am Textanfang.");
  }else if(s.cuts.length || s.propositions.length || s.rootIds.length){
    throw new Error("Ungültiger Zustand: Leerer Text darf keine Analyse enthalten.");
  }
  if(!Array.isArray(s.propositions) || !Array.isArray(s.rootIds) || !s.nodesById || typeof s.nodesById!=="object" || Array.isArray(s.nodesById)) throw new Error("Ungültiger Zustand: Baumdaten fehlen.");
  const ids=new Set();
  for(const p of s.propositions){
    if(!p || p.kind!=="proposition" || typeof p.id!=="string" || !p.id || !Number.isInteger(p.tokenStart) || !Number.isInteger(p.tokenEnd) || p.tokenStart<0 || p.tokenEnd<p.tokenStart || p.tokenEnd>=s.tokens.length) throw new Error("Ungültiger Zustand: Proposition ist beschädigt.");
    if(ids.has(p.id)) throw new Error("Ungültiger Zustand: Doppelte Proposition-ID.");
    ids.add(p.id);
  }
  const ranges=deriveRanges(s.tokens,s.cuts);
  if(ranges.length!==s.propositions.length || ranges.some((r,i)=>r.tokenStart!==s.propositions[i].tokenStart || r.tokenEnd!==s.propositions[i].tokenEnd)) throw new Error("Ungültiger Zustand: Propositionen passen nicht zu den Teilungsgrenzen.");
  for(const [id,n] of Object.entries(s.nodesById)){
    if(!n || typeof n!=="object" || n.id!==id || (n.kind!=="proposition" && n.kind!=="relation")) throw new Error("Ungültiger Zustand: Knoten ist beschädigt.");
    if(n.kind==="relation"){
      if(!Array.isArray(n.children) || n.children.length<2 || new Set(n.children).size!==n.children.length) throw new Error("Ungültiger Zustand: Eine Verbindung besitzt ungültige Kinder.");
      if(n.relationshipId!==null && typeof n.relationshipId!=="string") throw new Error("Ungültiger Zustand: Beziehungs-ID ist beschädigt.");
      if(!Array.isArray(n.roleOrder) || !Array.isArray(n.primaryChildIds)) throw new Error("Ungültiger Zustand: Rollen oder Hauptteile sind beschädigt.");
      if(n.directionFirstChildId!=null && (typeof n.directionFirstChildId!=="string" || !n.children.includes(n.directionFirstChildId))) throw new Error("Ungültiger Zustand: Beziehungsrichtung ist beschädigt.");
      if(n.primaryRoleChoice!=null && n.primaryRoleChoice!=="Handlung" && n.primaryRoleChoice!=="Ergebnis") throw new Error("Ungültiger Zustand: Hauptpunktwahl ist beschädigt.");
    }
  }
  for(const p of s.propositions){
    const n=s.nodesById[p.id];
    if(!n || n.kind!=="proposition" || n.tokenStart!==p.tokenStart || n.tokenEnd!==p.tokenEnd) throw new Error("Ungültiger Zustand: Proposition fehlt im Knotenbaum.");
  }
  const allIds=new Set(Object.keys(s.nodesById));
  if(new Set(s.rootIds).size!==s.rootIds.length || s.rootIds.some(id=>typeof id!=="string" || !allIds.has(id))) throw new Error("Ungültiger Zustand: Wurzelverweise sind beschädigt.");
  for(const n of Object.values(s.nodesById)){
    if(n.kind==="relation" && n.children.some(id=>!allIds.has(id))) throw new Error("Ungültiger Zustand: Eine Verbindung verweist auf eine fehlende Einheit.");
  }
  // Strukturelle Baum-Invarianten: Jeder Knoten hat genau einen Platz im Baum,
  // Wurzeln sind wirklich wurzeln, Kinder sind textlich geordnet/lückenlos und
  // alle Propositionen werden exakt einmal in Originalreihenfolge erreicht.
  const parentCount=new Map();
  for(const n of Object.values(s.nodesById)){
    if(n.kind!=="relation") continue;
    for(const childId of n.children) parentCount.set(childId,(parentCount.get(childId)||0)+1);
  }
  const rootSet=new Set(s.rootIds);
  for(const id of allIds){
    const count=parentCount.get(id)||0;
    if(rootSet.has(id)){
      if(count!==0) throw new Error("Ungültiger Zustand: Eine Wurzel ist zugleich Kind einer anderen Verbindung.");
    }else if(count!==1){
      throw new Error(count===0?"Ungültiger Zustand: Ein Knoten ist verwaist.":"Ungültiger Zustand: Ein Knoten besitzt mehrere Elternverbindungen.");
    }
  }

  const visiting=new Set(),done=new Set(),leafMemo=new Map();
  const leavesOf=id=>{
    if(leafMemo.has(id)) return leafMemo.get(id);
    if(visiting.has(id)) throw new Error("Ungültiger Zustand: Der Beziehungsbaum enthält einen Zyklus.");
    visiting.add(id);
    const n=s.nodesById[id];
    let leaves;
    if(n.kind==="proposition") leaves=[id];
    else{
      leaves=[];
      for(const childId of n.children) leaves.push(...leavesOf(childId));
    }
    visiting.delete(id);done.add(id);leafMemo.set(id,leaves);
    return leaves;
  };
  const propIndex=new Map(s.propositions.map((p,i)=>[p.id,i]));
  for(const n of Object.values(s.nodesById)){
    if(n.kind!=="relation") continue;
    let previousEnd=null;
    for(const childId of n.children){
      const leaves=leavesOf(childId);
      if(!leaves.length) throw new Error("Ungültiger Zustand: Eine Verbindung enthält ein leeres Kind.");
      const idxs=leaves.map(id=>propIndex.get(id));
      if(idxs.some(i=>!Number.isInteger(i))) throw new Error("Ungültiger Zustand: Eine Verbindung enthält eine unbekannte Proposition.");
      for(let i=1;i<idxs.length;i++) if(idxs[i]!==idxs[i-1]+1) throw new Error("Ungültiger Zustand: Ein Unterbaum ist nicht lückenlos.");
      if(previousEnd!==null && idxs[0]!==previousEnd+1) throw new Error("Ungültiger Zustand: Kinder einer Verbindung sind nicht direkt benachbart.");
      previousEnd=idxs[idxs.length-1];
    }
  }
  const rootLeaves=s.rootIds.flatMap(leavesOf);
  const expectedLeaves=s.propositions.map(p=>p.id);
  if(rootLeaves.length!==expectedLeaves.length || rootLeaves.some((id,i)=>id!==expectedLeaves[i])){
    throw new Error("Ungültiger Zustand: Wurzeln decken den Text nicht exakt und in Reihenfolge ab.");
  }
  for(const id of allIds) leavesOf(id);
}
function hydrateState(raw){
  const s=raw && typeof raw==="object" ? raw : createEmptyState();
  if(s.schemaVersion!==1) throw new Error("Unbekannte schemaVersion. Erwartet wird Version 1.");
  s.settings={...defaultSettings(),...(s.settings||{})};
  s.title=typeof s.title==="string"?s.title:"";
  s.mainPointSummary=typeof s.mainPointSummary==="string"?s.mainPointSummary:"";
  s.rawText=typeof s.rawText==="string"?s.rawText:"";
  s.tokens=Array.isArray(s.tokens)?s.tokens:tokenize(s.rawText);
  s.cuts=Array.isArray(s.cuts)?s.cuts:[];
  s.propositions=Array.isArray(s.propositions)?s.propositions:[];
  s.rootIds=Array.isArray(s.rootIds)?s.rootIds:[];
  s.nodesById=(s.nodesById && typeof s.nodesById==="object" && !Array.isArray(s.nodesById))?s.nodesById:{};
  for(const p of s.propositions){ if(p && typeof p.id==="string") s.nodesById[p.id]=p; }
  // Migration/Normalisierung für Handlung–Ergebnis:
  // Ohne gespeicherte explizite Wahl ist „Ergebnis“ der Hauptpunkt. Dadurch
  // liegen Stern, Gruppen-Port und der Anker für die nächste Verbindung beim Ergebnis.
  for(const n of Object.values(s.nodesById)){
    if(!n || n.kind!=="relation") continue;
    if(n.relationshipId==="handlung_ergebnis"){
      if(n.primaryRoleChoice!=="Handlung" && n.primaryRoleChoice!=="Ergebnis") n.primaryRoleChoice="Ergebnis";
      if(Array.isArray(n.roleOrder) && Array.isArray(n.children)){
        const idx=n.roleOrder.findIndex(role=>role===n.primaryRoleChoice);
        if(idx>=0 && n.children[idx]) n.primaryChildIds=[n.children[idx]];
      }
    }else if("primaryRoleChoice" in n){
      delete n.primaryRoleChoice;
    }
    const directionRel=RELATIONSHIPS[n.relationshipId];
    // Migration auf die kanonische Richtungsinformation. Ältere Versionen
    // verwendeten preferredPrimaryChildId dafür, obwohl das Feld semantisch
    // nicht den Hauptpunkt, sondern die zuerst gewählte/erste Rollen-Seite meinte.
    if(!n.directionFirstChildId || !n.children.includes(n.directionFirstChildId)){
      if(n.preferredPrimaryChildId && n.children.includes(n.preferredPrimaryChildId)){
        n.directionFirstChildId=n.preferredPrimaryChildId;
      }else if(directionRel?.allowRoleSwap && n.children.length===2 && Array.isArray(n.roleOrder)){
        const firstRoleIndex=n.roleOrder.indexOf(directionRel.roles?.[0]);
        if(firstRoleIndex>=0 && n.children[firstRoleIndex]) n.directionFirstChildId=n.children[firstRoleIndex];
      }else if(n.children.length===2){
        // Für alte Zustände ohne rekonstruierbare Klickrichtung ist die
        // Textreihenfolge die einzig deterministische, reproduzierbare Basis.
        n.directionFirstChildId=n.children[0];
      }
    }
    if("preferredPrimaryChildId" in n) delete n.preferredPrimaryChildId;
  }
  assertSafeStateShape(s);
  state=s;
  rebuildParentIds();
  return state;
}
function snapshot(){ return JSON.stringify(state); }
function restoreSnapshot(json){
  hydrateState(JSON.parse(json));
  selectionStartId=null;
  selectedRelationId=null;
  activeRelationId=null;
  chosenRelationshipId=null;
}
function pushHistorySnapshot(json){
  history.push(json);
  if(history.length>MAX_HISTORY) history.shift();
  future=[];
}
function performAction(label,mutator){
  const before=snapshot();
  try{
    const result=mutator();
    rebuildParentIds();
    // Jede Änderung wird atomar geprüft. Ein fehlerhafter Zwischenzustand gelangt
    // weder in UI/LocalStorage noch in den Undo-Verlauf.
    assertSafeStateShape(state);
    state.updatedAt=new Date().toISOString();
    pushHistorySnapshot(before);
    render();
    schedulePersist();
    announce(label);
    return result;
  }catch(err){
    console.error("Aktion zurückgerollt:",label,err);
    restoreSnapshot(before);
    render();
    announce(`Aktion nicht ausgeführt: ${err?.message||"ungültiger Zustand"}`);
    return null;
  }
}
function undo(){
  if(!history.length) return;
  future.push(snapshot());
  const prev=history.pop();
  restoreSnapshot(prev);
  render(); schedulePersist(); announce("Rückgängig");
}
function redo(){
  if(!future.length) return;
  history.push(snapshot());
  const next=future.pop();
  restoreSnapshot(next);
  render(); schedulePersist(); announce("Wiederholen");
}
function announce(text){
  els.liveRegion.textContent="";
  requestAnimationFrame(()=>{els.liveRegion.textContent=text;});
}

function getNode(id){ return state.nodesById[id] || null; }
function relationNodes(){ return Object.values(state.nodesById).filter(n=>n && n.kind==="relation"); }
function hasRelations(){ return relationNodes().length>0; }
function rebuildParentIds(){
  for(const n of relationNodes()) n.parentId=null;
  for(const n of relationNodes()){
    for(const childId of n.children||[]){
      const c=getNode(childId);
      if(c && c.kind==="relation") c.parentId=n.id;
    }
  }
}
function findParentInfo(nodeId){
  for(const rel of relationNodes()){
    const idx=(rel.children||[]).indexOf(nodeId);
    if(idx>=0) return {parentId:rel.id,siblings:rel.children,index:idx};
  }
  const idx=state.rootIds.indexOf(nodeId);
  if(idx>=0) return {parentId:null,siblings:state.rootIds,index:idx};
  return null;
}
function propIndexMap(){ return new Map(state.propositions.map((p,i)=>[p.id,i])); }
function collectLeaves(nodeId,seen=new Set()){
  if(seen.has(nodeId)) return [];
  seen.add(nodeId);
  const n=getNode(nodeId);
  if(!n) return [];
  if(n.kind==="proposition") return [n.id];
  return (n.children||[]).flatMap(id=>collectLeaves(id,seen));
}
function nodeSpan(nodeId){
  const map=propIndexMap();
  const leaves=collectLeaves(nodeId).map(id=>map.get(id)).filter(i=>Number.isInteger(i));
  if(!leaves.length) return {start:-1,end:-1};
  return {start:Math.min(...leaves),end:Math.max(...leaves)};
}
function nodeDepth(nodeId,memo=new Map()){
  if(memo.has(nodeId)) return memo.get(nodeId);
  const n=getNode(nodeId);
  if(!n || n.kind==="proposition"){memo.set(nodeId,0);return 0;}
  const d=1+Math.max(0,...(n.children||[]).map(id=>nodeDepth(id,memo)));
  memo.set(nodeId,d); return d;
}
function nodeLabel(nodeId){
  const n=getNode(nodeId);
  if(!n) return "Unbekannte Einheit";
  if(n.kind==="proposition"){
    const i=state.propositions.findIndex(p=>p.id===nodeId);
    return i>=0?"P"+(i+1):"Proposition";
  }
  const s=nodeSpan(nodeId);
  const rel=RELATIONSHIPS[n.relationshipId];
  const relationName=rel?rel.label:(n.relationshipId==null?"offen":"Unbekannte Beziehung");
  return s.start===s.end ? `Gruppe P${s.start+1} · ${relationName}` : `Gruppe P${s.start+1}–P${s.end+1} · ${relationName}`;
}
function nodeText(nodeId){
  const s=nodeSpan(nodeId);
  if(s.start<0) return "";
  const first=state.propositions[s.start], last=state.propositions[s.end];
  if(!first || !last) return "";
  return state.tokens.slice(first.tokenStart,last.tokenEnd+1).join("");
}
function descendantsContain(nodeId,propId){
  const n=getNode(nodeId);
  if(!n) return false;
  if(n.kind==="proposition") return n.id===propId;
  return (n.children||[]).some(id=>descendantsContain(id,propId));
}

function cardinalityOk(rel,count){
  if(!rel) return false;
  return count>=rel.min && (rel.max==null || count<=rel.max);
}
function cardinalityText(rel){
  if(rel.max==null) return `mindestens ${rel.min}`;
  if(rel.min===rel.max) return rel.min===2?"genau zwei":rel.min===3?"genau drei":`genau ${rel.min}`;
  return `${rel.min} bis ${rel.max}`;
}
function defaultRoleOrder(rel,count){
  if(rel.primary==="all") return Array(count).fill("Hauptteil");
  if(Array.isArray(rel.roles) && rel.roles.length===count) return [...rel.roles];
  if(Array.isArray(rel.roles) && rel.roles.length) return Array.from({length:count},(_,i)=>rel.roles[i]||`Teil ${i+1}`);
  return Array.from({length:count},(_,i)=>`Teil ${i+1}`);
}
function defaultPrimaryIds(rel,children){
  if(rel.primary==="all") return [...children];
  if(Array.isArray(rel.primary)) return rel.primary.map(i=>children[i]).filter(Boolean);
  return children[rel.primary]!=null?[children[rel.primary]]:[];
}
function primaryIdsFromRoleOrder(rel,children,roleOrder){
  if(rel.primary==="all") return [...children];
  if(Array.isArray(rel.primary)) return rel.primary.map(i=>children[i]).filter(Boolean);
  // Bei richtungsabhängigen binären Beziehungen ist primary der Index der
  // semantischen Hauptrolle im Katalog, nicht zwingend der sichtbare Kindindex.
  // Wenn die Rollen wegen der Klickreihenfolge gespiegelt wurden, folgt der
  // Hauptpunkt deshalb der Rolle mit – Stern und Gruppenanker wandern mit.
  if(rel.allowRoleSwap && children.length===2 && Array.isArray(rel.roles) && rel.roles[rel.primary]){
    const primaryRole=rel.roles[rel.primary];
    const visibleIndex=roleOrder.indexOf(primaryRole);
    if(visibleIndex>=0 && children[visibleIndex]) return [children[visibleIndex]];
  }
  return children[rel.primary]!=null?[children[rel.primary]]:[];
}
function isDirectionalBinary(rel,children){
  return !!(rel && rel.allowRoleSwap && Array.isArray(children) && children.length===2 && Array.isArray(rel.roles) && rel.roles.length>=2);
}
function inferDirectionFirstChildId(node,relOverride=null){
  if(!node || node.kind!=="relation" || !Array.isArray(node.children) || node.children.length!==2) return null;
  if(node.directionFirstChildId && node.children.includes(node.directionFirstChildId)) return node.directionFirstChildId;
  const rel=relOverride || RELATIONSHIPS[node.relationshipId];
  if(isDirectionalBinary(rel,node.children) && Array.isArray(node.roleOrder)){
    const firstRoleIndex=node.roleOrder.indexOf(rel.roles[0]);
    if(firstRoleIndex>=0 && node.children[firstRoleIndex]) return node.children[firstRoleIndex];
  }
  // Deterministischer Fallback für migrierte/alte Daten.
  return node.children[0]||null;
}
function orientedRelationDefaults(rel,children,directionFirstChildId=null){
  let roleOrder=defaultRoleOrder(rel,children.length);

  // Eine einzige kanonische Richtungsinformation steuert die sichtbare
  // Rollenzuordnung. Die Kinder bleiben immer in Textreihenfolge.
  if(isDirectionalBinary(rel,children) && directionFirstChildId && children.includes(directionFirstChildId)){
    if(children.indexOf(directionFirstChildId)===1) roleOrder=[...roleOrder].reverse();
  }

  const primaryChildIds=primaryIdsFromRoleOrder(rel,children,roleOrder);
  return {roleOrder,primaryChildIds};
}
function computedRelationState(node,rel,{directionFirstChildId=null,primaryRoleChoice=null}={}){
  const first=(directionFirstChildId && node.children.includes(directionFirstChildId))
    ? directionFirstChildId
    : inferDirectionFirstChildId(node,rel);
  const oriented=orientedRelationDefaults(rel,node.children,first);
  let primaryChildIds=[...oriented.primaryChildIds];
  let resolvedPrimaryRoleChoice=null;

  if(rel && rel===RELATIONSHIPS.handlung_ergebnis){
    resolvedPrimaryRoleChoice=(primaryRoleChoice==="Handlung" || primaryRoleChoice==="Ergebnis")
      ? primaryRoleChoice
      : inferPrimaryRoleChoice(node,"handlung_ergebnis") || "Ergebnis";
    const idx=oriented.roleOrder.findIndex(role=>role===resolvedPrimaryRoleChoice);
    if(idx>=0 && node.children[idx]) primaryChildIds=[node.children[idx]];
  }

  return {
    directionFirstChildId:first,
    roleOrder:oriented.roleOrder,
    primaryChildIds,
    primaryRoleChoice:resolvedPrimaryRoleChoice
  };
}
function applyComputedRelationState(node,rel,computed){
  node.roleOrder=[...computed.roleOrder];
  node.primaryChildIds=[...computed.primaryChildIds];
  if(computed.directionFirstChildId && node.children.includes(computed.directionFirstChildId)){
    node.directionFirstChildId=computed.directionFirstChildId;
  }
  if(rel===RELATIONSHIPS.handlung_ergebnis){
    node.primaryRoleChoice=computed.primaryRoleChoice || "Ergebnis";
  }else if("primaryRoleChoice" in node){
    delete node.primaryRoleChoice;
  }
}
function inferPrimaryRoleChoice(node,relationId){
  if(!node || node.kind!=="relation" || relationId!=="handlung_ergebnis") return null;
  if(node.primaryRoleChoice==="Handlung" || node.primaryRoleChoice==="Ergebnis") return node.primaryRoleChoice;
  // Bestehende Projekte aus älteren Versionen hatten keine explizite Wahl.
  // Für sie gilt ab jetzt ebenfalls der neue Standard: Ergebnis.
  return "Ergebnis";
}
function normalizedPrimaryIdsForChoice(relationId,children,roleOrder,basePrimaryChildIds){
  if(relationId!=="handlung_ergebnis") return [...basePrimaryChildIds];
  const wanted=selectedPrimaryRoleChoice==="Handlung" || selectedPrimaryRoleChoice==="Ergebnis" ? selectedPrimaryRoleChoice : "Ergebnis";
  const index=roleOrder.findIndex(role=>role===wanted);
  if(index>=0 && children[index]!=null) return [children[index]];
  return [...basePrimaryChildIds];
}
function sameIdArray(a,b){
  if(!Array.isArray(a) || !Array.isArray(b) || a.length!==b.length) return false;
  return a.every((id,i)=>id===b[i]);
}
function syncDialogRelationOptions(){
  const node=getNode(activeRelationId);
  if(chosenRelationshipId==="handlung_ergebnis"){
    if(selectedPrimaryRoleChoice!=="Handlung" && selectedPrimaryRoleChoice!=="Ergebnis"){
      selectedPrimaryRoleChoice=node && node.relationshipId==="handlung_ergebnis"
        ? (inferPrimaryRoleChoice(node,"handlung_ergebnis") || "Ergebnis")
        : "Ergebnis";
    }
  }else{
    selectedPrimaryRoleChoice=null;
  }
}
function canModifyRelations(){
  return state.settings.mode==="bearbeiten" && activeTool==="verbinden";
}
function normalizeRelationAfterChildChange(node){
  if(!node || node.kind!=="relation") return {opened:false};
  if(node.directionFirstChildId && !node.children.includes(node.directionFirstChildId)) node.directionFirstChildId=node.children[0]||null;
  if(node.relationshipId==null){
    node.roleOrder=[];
    node.primaryChildIds=[];
    return {opened:false};
  }
  const rel=RELATIONSHIPS[node.relationshipId];
  if(!rel || !cardinalityOk(rel,node.children.length)){
    // Wenn das Auflösen einer Untergruppe die Kardinalität des Elternknotens
    // verändert, bleibt die Gruppe bestehen, wird aber bewusst wieder "offen".
    // So entsteht niemals still ein semantisch ungültiger Elternknoten.
    node.relationshipId=null;
    node.roleOrder=[];
    node.primaryChildIds=[];
    delete node.primaryRoleChoice;
    return {opened:true};
  }
  if(rel.primary==="all"){
    node.roleOrder=defaultRoleOrder(rel,node.children.length);
    node.primaryChildIds=[...node.children];
    if("primaryRoleChoice" in node) delete node.primaryRoleChoice;
  }else{
    // Beziehung nach jeder Strukturänderung vollständig aus Typ + kanonischer
    // Richtung neu berechnen. So können Rollen, Stern und Gruppenanker nicht
    // auseinanderlaufen.
    const computed=computedRelationState(node,rel,{
      directionFirstChildId:inferDirectionFirstChildId(node,rel),
      primaryRoleChoice:node.relationshipId==="handlung_ergebnis" ? inferPrimaryRoleChoice(node,"handlung_ergebnis") : null
    });
    applyComputedRelationState(node,rel,computed);
  }
  return {opened:false};
}
function siblingArray(parentId){
  if(parentId==null) return state.rootIds;
  const parent=getNode(parentId);
  return parent&&parent.kind==="relation"?parent.children:null;
}
function validateContiguousSelection(selectedIds,parentId){
  if(!Array.isArray(selectedIds) || selectedIds.length<2 || new Set(selectedIds).size!==selectedIds.length) return false;
  const siblings=siblingArray(parentId);
  if(!siblings) return false;
  const first=siblings.indexOf(selectedIds[0]);
  if(first<0 || first+selectedIds.length>siblings.length) return false;
  for(let i=0;i<selectedIds.length;i++){
    if(siblings[first+i]!==selectedIds[i] || !getNode(selectedIds[i])) return false;
  }
  return true;
}
function canGroupInside(parentId,selectedCount){
  if(parentId==null) return selectedCount>=2;
  const p=getNode(parentId);
  if(!p || p.kind!=="relation") return false;
  const newCount=p.children.length-selectedCount+1;
  // Auch eine offene Gruppe muss nach dem Untergruppieren mindestens zwei Kinder behalten.
  if(p.relationshipId==null) return newCount>=2;
  const rel=RELATIONSHIPS[p.relationshipId];
  if(!rel || rel.primary!=="all") return false;
  return cardinalityOk(rel,newCount);
}
function connectionRangeForEndpoints(firstId,secondId){
  if(!firstId || !secondId || firstId===secondId) return null;
  const a=findParentInfo(firstId),b=findParentInfo(secondId);
  if(!a || !b || a.parentId!==b.parentId) return null;
  const from=Math.min(a.index,b.index),to=Math.max(a.index,b.index);
  const selected=a.siblings.slice(from,to+1);
  if(selected.length<2 || !validateContiguousSelection(selected,a.parentId)) return null;
  if(!canGroupInside(a.parentId,selected.length)) return null;
  return {parentId:a.parentId,selected};
}
function canUseConnectionAnchor(nodeId,startId=selectionStartId){
  if(!getNode(nodeId)) return false;
  const info=findParentInfo(nodeId);
  if(!info) return false;

  // Nach dem ersten Klick bleibt dieser Anker als Abwahlmöglichkeit sichtbar;
  // alle anderen Anker erscheinen nur noch, wenn der Bereich zwischen beiden
  // Endpunkten tatsächlich als neue Untergruppe angelegt werden darf.
  if(startId){
    if(nodeId===startId) return true;
    return !!connectionRangeForEndpoints(startId,nodeId);
  }

  // Ohne Startauswahl ist ein Anker nur sinnvoll, wenn es auf derselben Ebene
  // wenigstens einen Partner gibt, mit dem eine gültige neue Gruppe entsteht.
  return info.siblings.some(otherId=>otherId!==nodeId && !!connectionRangeForEndpoints(nodeId,otherId));
}
function connectOpen(selectedIds,parentId,firstSelectedChildId=null){
  if(!validateContiguousSelection(selectedIds,parentId)) throw new Error("Nur ein direkt benachbarter Geschwisterbereich kann verbunden werden.");
  if(!canGroupInside(parentId,selectedIds.length)) throw new Error("Diese Untergruppe würde die übergeordnete Verbindung ungültig machen.");
  const siblings=siblingArray(parentId);
  const firstIndex=siblings.indexOf(selectedIds[0]);
  const id=makeId("r");
  const node={kind:"relation",id,children:[...selectedIds],relationshipId:null,roleOrder:[],primaryChildIds:[],parentId,directionFirstChildId:firstSelectedChildId&&selectedIds.includes(firstSelectedChildId)?firstSelectedChildId:(selectedIds[0]||null)};
  state.nodesById[id]=node;
  siblings.splice(firstIndex,selectedIds.length,id);
  for(const childId of selectedIds){
    const c=getNode(childId);
    if(c && c.kind==="relation") c.parentId=id;
  }
  if(parentId!=null) normalizeRelationAfterChildChange(getNode(parentId));
  return id;
}
function removeRelationNode(id){
  const node=getNode(id);
  if(!node || node.kind!=="relation") throw new Error("Die Verbindung existiert nicht mehr.");
  const parent=findParentInfo(id);
  if(!parent) throw new Error("Die Verbindung ist nicht mehr im Analysebaum verankert.");
  const arr=siblingArray(parent.parentId);
  if(!arr) throw new Error("Die Elternstruktur der Verbindung ist beschädigt.");
  const idx=arr.indexOf(id);
  if(idx<0) throw new Error("Die Verbindung konnte in ihrer Ebene nicht gefunden werden.");
  arr.splice(idx,1,...node.children);
  for(const childId of node.children){
    const c=getNode(childId);
    if(c && c.kind==="relation") c.parentId=parent.parentId;
  }
  delete state.nodesById[id];
  const parentNormalization=parent.parentId!=null?normalizeRelationAfterChildChange(getNode(parent.parentId)):{opened:false};
  return {ok:true,parentOpened:!!parentNormalization.opened,parentId:parent.parentId};
}
function descendantRelationIds(id,out=[],seen=new Set()){
  if(seen.has(id)) return out;
  seen.add(id);
  const n=getNode(id);
  if(!n || n.kind!=="relation") return out;
  out.push(id);
  for(const c of n.children||[]) descendantRelationIds(c,out,seen);
  return out;
}
function deleteRelationSubtree(id){
  const node=getNode(id);
  if(!node || node.kind!=="relation") throw new Error("Der Teilbaum existiert nicht mehr.");
  const leaves=collectLeaves(id);
  if(leaves.length<2) throw new Error("Der Teilbaum besitzt keinen gültigen Textbereich.");
  const parent=findParentInfo(id);
  if(!parent) throw new Error("Der Teilbaum ist nicht mehr im Analysebaum verankert.");
  const arr=siblingArray(parent.parentId);
  if(!arr) throw new Error("Die Elternstruktur des Teilbaums ist beschädigt.");
  const idx=arr.indexOf(id);
  if(idx<0) throw new Error("Der Teilbaum konnte in seiner Ebene nicht gefunden werden.");
  arr.splice(idx,1,...leaves);
  for(const rid of descendantRelationIds(id,[])) delete state.nodesById[rid];
  const parentNormalization=parent.parentId!=null?normalizeRelationAfterChildChange(getNode(parent.parentId)):{opened:false};
  return {ok:true,parentOpened:!!parentNormalization.opened,parentId:parent.parentId};
}
