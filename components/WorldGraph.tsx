'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';
import { useWorldContext, ICharacter } from '../app/context/WorldContext';
import { Loader2, Maximize, ZoomIn, ZoomOut, Network, Search, X, User, LayoutGrid, Eye, Camera } from 'lucide-react';

// Importação dinâmica para evitar erros de SSR no Next.js
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// Paleta Oficial das Categorias
const CATEGORY_COLORS: Record<string, string> = {
  Conceito: '#f59e0b', // amber
  Criatura: '#f43f5e', // rose
  Divindade: '#eab308', // yellow
  Evento: '#0ea5e9', // sky
  Item: '#ec4899', // pink
  Local: '#10b981', // emerald
  Organização: '#f97316', // orange
  Personagem: '#a855f7', // purple
  Raças: '#14b8a6',    // teal
};

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || '#a855f7';

export default function WorldGraph() {
  const { selectedWorld, characters } = useWorldContext();
  
  // Estados de Dados e Loading
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [baseGraphData, setBaseGraphData] = useState({ nodes: [], links: [] }); // Guarda os dados originais para o filtro
  const [isLoading, setIsLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Estados de Interatividade
  const [hoverNode, setHoverNode] = useState<any | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<ICharacter | null>(null);
  
  // Estados de Filtro
  const [activeCategories, setActiveCategories] = useState<string[]>(Object.keys(CATEGORY_COLORS));
  const [searchTerm, setSearchTerm] = useState('');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
const graphRef = useRef<any>(null);
  const imgCache = useRef<Record<string, HTMLImageElement>>({});

  // Resize Observer para o Canvas responsivo
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Fetch de Dados Iniciais e Lógica de Centralidade (Tamanho dos Nós)
  useEffect(() => {
    if (!selectedWorld) return;
    
    const fetchAllRelations = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('entity_relations').select('*').eq('world_id', selectedWorld.id);

      if (!error && data) {
        const nodes: any[] = characters.map(c => ({
          id: c.id,
          name: c.name,
          img: c.avatar_url,
          category: c.category || 'Personagem',
          neighbors: [], // Inicializa vizinhos
        }));

        const links = data.map(r => ({
          source: r.from_entity_id,
          target: r.to_entity_id,
          label: r.relation_label
        }));

        // Validar links e calcular vizinhos
        const validNodeIds = new Set(nodes.map(n => n.id));
        const validLinks = links.filter(l => validNodeIds.has(l.source) && validNodeIds.has(l.target));

        validLinks.forEach(link => {
          const a = nodes.find(n => n.id === link.source);
          const b = nodes.find(n => n.id === link.target);
          if (a && b) {
            if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
            if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
          }
        });

        // LÓGICA 1: Calcular o tamanho dinâmico do Nó baseado na popularidade (Ligações)
        nodes.forEach(n => {
          const connCount = n.neighbors.length;
          // Tamanho base 14, cresce 1.5 por cada ligação (Máximo de 35 para não quebrar a tela)
          n.size = Math.min(14 + (connCount * 1.5), 35);
        });

        setBaseGraphData({ nodes: nodes as any, links: validLinks as any });
        setGraphData({ nodes: nodes as any, links: validLinks as any });
      }
      setIsLoading(false);
    };

    fetchAllRelations();
  }, [selectedWorld, characters]);

  // Efeito de Filtro (Categorias e Busca)
  useEffect(() => {
    let filteredNodes = baseGraphData.nodes.filter((n: any) => activeCategories.includes(n.category));
    
    if (searchTerm.trim()) {
      filteredNodes = filteredNodes.filter((n: any) => n.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    const validNodeIds = new Set(filteredNodes.map((n: any) => n.id));
    const filteredLinks = baseGraphData.links.filter((l: any) => 
      validNodeIds.has(l.source.id || l.source) && validNodeIds.has(l.target.id || l.target)
    );

    setGraphData({ nodes: filteredNodes, links: filteredLinks });
  }, [activeCategories, searchTerm, baseGraphData]);

  // Ações da Câmera
  const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.2, 400);
  const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() * 0.8, 400);
  const handleFit = () => graphRef.current?.zoomToFit(400, 80);

  // LÓGICA 3: Módulo de Exportação Fotográfica
  const handleScreenshot = () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `WorldCraft-Grafo-${selectedWorld?.name.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    // Zoom suave e centralização no nó clicado
    graphRef.current?.centerAt(node.x, node.y, 800);
    graphRef.current?.zoom(2.5, 800);
    
    setSelectedNode(node);
    const entityInfo = characters.find(c => c.id === node.id);
    setSelectedEntity(entityInfo || null);
  }, [characters]);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  // Renderização Dinâmica do Canvas
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const baseSize = node.size || 14;
    // Ligeiro aumento se estiver selecionado
    const size = selectedNode?.id === node.id ? baseSize + 4 : baseSize; 
    
    // LÓGICA 2: Modo Foco Profundo (Identifica quem deve brilhar e quem deve apagar)
    const isHovered = hoverNode && (hoverNode.id === node.id || hoverNode.neighbors?.includes(node.id));
    const isSelectedActive = selectedNode && (selectedNode.id === node.id || selectedNode.neighbors?.includes(node.id));
    
    let isDimmed = false;
    if (selectedNode) {
      isDimmed = !isSelectedActive; // Se há clique, foca apenas na rede do clicado
    } else if (hoverNode) {
      isDimmed = !isHovered; // Se há hover, foca na rede do hover
    }

    // Fade out nos nós não interligados
    ctx.globalAlpha = isDimmed ? 0.15 : 1;

    // Carregar imagem no cache do Canvas
    if (node.img && !imgCache.current[node.img]) {
      const img = new Image();
      img.src = node.img;
      imgCache.current[node.img] = img;
    }
    const img = node.img ? imgCache.current[node.img] : null;

    // Fundo circular e Clip de Imagem
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    if (img && img.complete && img.naturalWidth !== 0) {
      ctx.drawImage(img, node.x - size, node.y - size, size * 2, size * 2);
    } else {
      ctx.fillStyle = '#1e293b'; 
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${size}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name.charAt(0).toUpperCase(), node.x, node.y + 1);
    }
    ctx.restore();

    // Borda da Categoria
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, Math.PI * 2, true);
    ctx.strokeStyle = selectedNode?.id === node.id ? '#fff' : getCategoryColor(node.category);
    ctx.lineWidth = selectedNode?.id === node.id ? 3.5 : (isHovered ? 4 : 2.5);
    ctx.stroke();

    // Texto do Nome (Desaparece se a câmara estiver muito distante e não estiver em foco)
    if (!isDimmed && globalScale >= 1) {
      const fontSize = 12 / globalScale;
      ctx.font = `${selectedNode?.id === node.id ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textWidth = ctx.measureText(node.name).width;
      const textY = node.y + size + 8 + (fontSize/2);
      ctx.fillStyle = 'rgba(11, 16, 24, 0.7)'; // Fundo para legibilidade
      ctx.fillRect(node.x - textWidth/2 - 2, textY - fontSize/2 - 2, textWidth + 4, fontSize + 4);

      ctx.fillStyle = selectedNode?.id === node.id ? '#fff' : '#cbd5e1';
      ctx.fillText(node.name, node.x, textY);
    }

    ctx.globalAlpha = 1; // Reset da opacidade para o próximo elemento
  }, [hoverNode, selectedNode]);

  if (!selectedWorld) return null;

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col relative bg-[#090D14] overflow-hidden">
      
      {/* HEADER DO GRAFO */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-4 pointer-events-none">
         <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.15)]">
           <Network className="w-6 h-6 text-emerald-500" />
         </div>
         <div>
           <h2 className="text-2xl font-serif text-white leading-tight font-bold drop-shadow-md">Grafo do Mundo</h2>
           <p className="text-sm text-slate-400 mt-0.5 drop-shadow-md">{graphData.nodes.length} Entidades Interligadas</p>
         </div>
      </div>

      {/* CONTROLES DA CÂMERA & EXPORTAÇÃO */}
      <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
         <div className="flex bg-[#0B1018]/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-1 shadow-2xl mb-2">
           <Search className="w-4 h-4 text-slate-500 ml-2 my-auto" />
           <input 
             type="text" placeholder="Buscar no mapa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
             className="w-32 bg-transparent text-slate-200 text-xs px-2 py-1.5 outline-none"
           />
         </div>
         <button onClick={handleScreenshot} title="Tirar Foto do Mapa (PNG)" className="p-2.5 bg-[#0B1018]/80 backdrop-blur-md border border-slate-800/80 rounded-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all shadow-xl group"><Camera className="w-4 h-4 group-hover:scale-110 transition-transform"/></button>
         <button onClick={handleFit} title="Centralizar Mapa" className="p-2.5 bg-[#0B1018]/80 backdrop-blur-md border border-slate-800/80 rounded-xl text-slate-400 hover:text-white hover:border-emerald-500/50 transition-all shadow-xl mt-2"><Maximize className="w-4 h-4"/></button>
         <button onClick={handleZoomIn} title="Aproximar" className="p-2.5 bg-[#0B1018]/80 backdrop-blur-md border border-slate-800/80 rounded-xl text-slate-400 hover:text-white hover:border-emerald-500/50 transition-all shadow-xl"><ZoomIn className="w-4 h-4"/></button>
         <button onClick={handleZoomOut} title="Afastar" className="p-2.5 bg-[#0B1018]/80 backdrop-blur-md border border-slate-800/80 rounded-xl text-slate-400 hover:text-white hover:border-emerald-500/50 transition-all shadow-xl"><ZoomOut className="w-4 h-4"/></button>
      </div>

      {/* PAINEL DE FILTROS FLUTUANTE (RODAPÉ) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-2 bg-[#0B1018]/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl max-w-full overflow-x-auto custom-scrollbar">
         {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
           const isActive = activeCategories.includes(cat);
           return (
             <button 
               key={cat} onClick={() => toggleCategory(cat)}
               style={{ backgroundColor: isActive ? `${color}20` : 'transparent', borderColor: isActive ? `${color}50` : '#1e293b', color: isActive ? color : '#64748b' }}
               className="px-3 py-1.5 text-xs font-medium border rounded-xl transition-all whitespace-nowrap"
             >
               {cat}
             </button>
           );
         })}
      </div>

      {/* PAINEL DE INSPEÇÃO LATERAL (Ao clicar num nó) */}
      {selectedEntity && (
        <div className="absolute top-24 left-6 z-20 w-80 bg-[#0B1018]/90 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
           {/* Capa */}
           <div className="w-full h-32 bg-[#05080C] relative">
              {selectedEntity.avatar_url && <img src={selectedEntity.avatar_url} className="w-full h-full object-cover opacity-60" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1018]/90 to-transparent"></div>
              <button onClick={() => { setSelectedNode(null); setSelectedEntity(null); }} className="absolute top-3 right-3 p-1.5 bg-slate-900/50 text-slate-300 hover:text-white rounded-lg backdrop-blur-md"><X className="w-4 h-4"/></button>
           </div>
           
           <div className="p-5 -mt-10 relative z-10">
              <div className="w-16 h-16 rounded-xl border-2 border-[#0B1018] bg-slate-800 shadow-xl overflow-hidden mb-3">
                 {selectedEntity.avatar_url ? <img src={selectedEntity.avatar_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-3 text-slate-500" />}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-white">{selectedEntity.name}</h3>
              </div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium border mb-4" style={{ backgroundColor: `${getCategoryColor(selectedEntity.category || '')}15`, color: getCategoryColor(selectedEntity.category || ''), borderColor: `${getCategoryColor(selectedEntity.category || '')}30` }}>
                 {selectedEntity.category || 'Personagem'}
              </span>

              {/* Atributos do Nó Selecionado */}
              {selectedEntity.attributes && Object.entries(selectedEntity.attributes).length > 0 && (
                <div className="mb-4 bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-2 flex items-center gap-1.5"><LayoutGrid className="w-3 h-3"/> ATRIBUTOS</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                    {Object.entries(selectedEntity.attributes).slice(0,4).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[9px] uppercase text-slate-500">{k}</p>
                        <p className="text-xs text-slate-300 font-medium truncate" title={v as string}>{v || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm transition-colors cursor-not-allowed opacity-50" title="Acesse a Wiki para editar">
                <Eye className="w-4 h-4"/> Inspecionar Ficha
              </button>
           </div>
        </div>
      )}

      {/* MOTOR 2D DE FÍSICA E PARTÍCULAS */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : baseGraphData.nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <Network className="w-12 h-12 text-slate-700" />
          <p className="text-slate-500">Adicione entidades e crie conexões na Wiki para gerar o mapa.</p>
        </div>
      ) : (
        <div className="flex-1 cursor-grab active:cursor-grabbing">
          {dimensions.width > 0 && (
            <ForceGraph2D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeCanvasObject={drawNode}
              nodeRelSize={16}
              
              // Lógica de Foco Profundo nas Linhas
              linkColor={(link: any) => {
                if (selectedNode) return (selectedNode.id === link.source.id || selectedNode.id === link.target.id) ? getCategoryColor(selectedNode.category) : '#1e293b10';
                return hoverNode && (hoverNode.id === link.source.id || hoverNode.id === link.target.id) ? getCategoryColor(hoverNode.category) : '#1e293b';
              }}
              linkWidth={(link: any) => {
                if (selectedNode) return (selectedNode.id === link.source.id || selectedNode.id === link.target.id) ? 2 : 0.5;
                return hoverNode && (hoverNode.id === link.source.id || hoverNode.id === link.target.id) ? 2 : 1;
              }}
              
              // Partículas luminosas (Como dados viajando pelos cabos)
              linkDirectionalParticles={(link: any) => {
                if (selectedNode) return (selectedNode.id === link.source.id || selectedNode.id === link.target.id) ? 4 : 0;
                return hoverNode && (hoverNode.id === link.source.id || hoverNode.id === link.target.id) ? 3 : 0;
              }}
              linkDirectionalParticleWidth={2.5}
              linkDirectionalParticleSpeed={0.01}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              
              linkLabel="label"
              backgroundColor="#090D14"
              cooldownTicks={100}
              
              // Interatividade
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => { setSelectedNode(null); setSelectedEntity(null); }}
              onNodeHover={setHoverNode}
              onEngineStop={() => graphRef.current?.zoomToFit(400, 100)} // Enquadra tudo ao iniciar
            />
          )}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #1e293b; border-radius: 20px; }`}} />
    </div>
  );
}