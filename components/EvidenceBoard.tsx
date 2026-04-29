'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorldContext } from '../app/context/WorldContext';
import PlayerAccessPanel from './PlayerAccessPanel';
import { Shield } from 'lucide-react'; // já deve ter o useWorldContext
import {
  Loader2, Camera, X, ExternalLink, Link as LinkIcon, Save,
  Lock, Eye, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Fingerprint, Radio, AlertTriangle, ChevronRight, FileText,
  Crosshair, Trash2, RotateCcw
} from 'lucide-react';

interface WorldFile {
  id: string;
  name: string;
  external_url: string;
  mime_type: string;
  description: string;
}

interface Position { x: number; y: number }
interface Connection { id: string; source: string; target: string; label?: string }

export default function EvidenceBoard() {
  const { selectedWorld, isGM } = useWorldContext();
  const [isAccessPanelOpen, setIsAccessPanelOpen] = useState(false);
  const [images, setImages] = useState<WorldFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  const [selectedEvidence, setSelectedEvidence] = useState<WorldFile | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [isSavingDesc, setIsSavingDesc] = useState(false);

  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [connections, setConnections] = useState<Connection[]>([]);
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [zIndices, setZIndices] = useState<Record<string, number>>({});
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);

  const [dragInfo, setDragInfo] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const dragDistance = useRef(0);

  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<Position | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'photo' | 'details' | 'links'>('photo');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'gallery'>('board');

  const boardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const topZRef = useRef(100);

  // ── LOAD ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedWorld) return;
    const loadEvidenceData = async () => {
      setLoading(true);
      setLoadProgress(0);
      const t1 = setTimeout(() => setLoadProgress(30), 300);
      const t2 = setTimeout(() => setLoadProgress(65), 700);

      const { data: files } = await supabase
        .from('world_files').select('*')
        .eq('world_id', selectedWorld.id)
        .ilike('mime_type', 'image/%')
        .order('created_at', { ascending: false });

      const { data: layoutData } = await supabase
        .from('evidence_layouts').select('data')
        .eq('world_id', selectedWorld.id).single();

      setLoadProgress(90);
      if (files) {
        setImages(files);
        initializeBoard(files, layoutData?.data);
      }
      setTimeout(() => { setLoadProgress(100); setTimeout(() => { setLoading(false); isFirstLoad.current = false; }, 300); }, 200);
      clearTimeout(t1); clearTimeout(t2);
    };
    loadEvidenceData();
  }, [selectedWorld]);

  const initializeBoard = (data: WorldFile[], savedLayout: any) => {
    const loadedPositions: Record<string, Position> = savedLayout?.positions || {};
    const loadedConnections: Connection[] = savedLayout?.connections || [];
    const loadedRotations: Record<string, number> = savedLayout?.rotations || {};
    const newPositions = { ...loadedPositions };
    const newRotations = { ...loadedRotations };
    const newZIndices: Record<string, number> = {};

    data.forEach((img, i) => {
      if (!newPositions[img.id]) newPositions[img.id] = { x: 180 + (i % 5) * 280, y: 160 + Math.floor(i / 5) * 380 };
      if (newRotations[img.id] === undefined) newRotations[img.id] = (Math.random() * 8) - 4;
      newZIndices[img.id] = i + 1;
    });

    setPositions(newPositions);
    setConnections(loadedConnections);
    setRotations(newRotations);
    setZIndices(newZIndices);
  };

  // ── AUTO-SAVE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstLoad.current || !selectedWorld || Object.keys(positions).length === 0) return;
    const timeoutId = setTimeout(async () => {
      setIsSavingLayout(true);
      await supabase.from('evidence_layouts').upsert({
        world_id: selectedWorld.id,
        data: { positions, connections, rotations },
        updated_at: new Date().toISOString()
      });
      setIsSavingLayout(false);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1200);
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [positions, connections, rotations, selectedWorld]);

  // ── DRAG ──────────────────────────────────────────────────────────────────
  const bringToFront = useCallback((id: string) => {
    topZRef.current += 1;
    setZIndices(prev => ({ ...prev, [id]: topZRef.current }));
  }, []);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (connectingFrom) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    bringToFront(id);
    setDragInfo({ id, startX: e.clientX, startY: e.clientY, origX: positions[id].x, origY: positions[id].y });
    dragDistance.current = 0;
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (connectingFrom && boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      setMousePos({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
      return;
    }
    if (!dragInfo) return;
    const dx = (e.clientX - dragInfo.startX) / zoom;
    const dy = (e.clientY - dragInfo.startY) / zoom;
    dragDistance.current = Math.sqrt(dx * dx + dy * dy);
    setPositions(prev => ({
      ...prev,
      [dragInfo.id]: { x: dragInfo.origX + dx, y: Math.max(10, dragInfo.origY + dy) }
    }));
  }, [dragInfo, connectingFrom, zoom]);

  const handlePointerUp = (e: React.PointerEvent, img: WorldFile) => {
    if (dragInfo) {
      e.stopPropagation();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDragInfo(null);
      if (dragDistance.current < 5 && !connectingFrom) {
        setSelectedEvidence(img);
        setEditDesc(img.description || '');
        setActiveTab('photo');
      }
    }
  };

  // ── CONNECT ───────────────────────────────────────────────────────────────
  const handleLinkClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (connectingFrom === id) {
      setConnectingFrom(null);
    } else if (connectingFrom) {
      const newConn: Connection = { id: `${connectingFrom}-${id}`, source: connectingFrom, target: id };
      if (!connections.some(c =>
        (c.source === newConn.source && c.target === newConn.target) ||
        (c.source === newConn.target && c.target === newConn.source)
      )) setConnections(prev => [...prev, newConn]);
      setConnectingFrom(null);
    } else {
      setConnectingFrom(id);
    }
  };

  const removeConnection = (id: string) => setConnections(prev => prev.filter(c => c.id !== id));

  // ── SAVE DESC ─────────────────────────────────────────────────────────────
  const handleSaveDescription = async () => {
    if (!selectedEvidence) return;
    setIsSavingDesc(true);
    const { error } = await supabase.from('world_files').update({ description: editDesc }).eq('id', selectedEvidence.id);
    if (!error) {
      setImages(prev => prev.map(img => img.id === selectedEvidence.id ? { ...img, description: editDesc } : img));
      setSelectedEvidence(null);
    }
    setIsSavingDesc(false);
  };

  // ── ZOOM & PAN ────────────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const handleBoardPointerDown = (e: React.PointerEvent) => {
    if (connectingFrom) { setConnectingFrom(null); return; }
    if (e.target === boardRef.current || (e.target as HTMLElement).closest('.eb-canvas-wrapper')) {
      setIsPanning(true);
      panStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: panOffset.x, offsetY: panOffset.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    if (isPanning && panStart.current) {
      setPanOffset({
        x: panStart.current.offsetX + (e.clientX - panStart.current.mouseX),
        y: panStart.current.offsetY + (e.clientY - panStart.current.mouseY),
      });
    }
  };

  const handleBoardPointerUp = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  // ── UTILS ─────────────────────────────────────────────────────────────────
  const drawSaggingLine = (x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const sag = Math.max(24, dist * 0.13);
    return `M ${x1} ${y1} Q ${midX} ${midY + sag} ${x2} ${y2}`;
  };

  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

  const getConnectedCards = (id: string) => connections
    .filter(c => c.source === id || c.target === id)
    .map(c => c.source === id ? c.target : c.source);

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="eb-loading">
      <div className="eb-loading__inner">
        <div className="eb-loading__emblem">
          <div className="eb-loading__ring eb-loading__ring--1" />
          <div className="eb-loading__ring eb-loading__ring--2" />
          <div className="eb-loading__ring eb-loading__ring--3" />
          <Fingerprint className="eb-loading__icon" />
        </div>
        <div className="eb-loading__label">
          <span className="eb-loading__prefix">SYS://</span>
          <span className="eb-loading__text">DECRYPTING EVIDENCE FILES</span>
        </div>
        <div className="eb-loading__track">
          <div className="eb-loading__fill" style={{ width: `${loadProgress}%` }} />
          <div className="eb-loading__glow" style={{ left: `${loadProgress}%` }} />
        </div>
        <span className="eb-loading__pct">{loadProgress}%</span>
        <div className="eb-loading__dots">
          {['AUTHENTICATING', 'LOADING ASSETS', 'BUILDING BOARD'].map((s, i) => (
            <span key={s} className="eb-loading__dot-item" style={{ animationDelay: `${i * 0.3}s` }}>
              <span className="eb-loading__dot" />
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={`eb-root ${isFullscreen ? 'eb-root--fullscreen' : ''}`} ref={containerRef}>

      {/* ATMOSPHERE */}
      <div className="eb-atmosphere" />
      <div className="eb-vignette" />
      <div className="eb-scanlines" />
      {showGrid && <div className="eb-grid-overlay" />}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="eb-header">
        <div className="eb-header__left">
          <div className="eb-header__emblem">
            <div className="eb-header__emblem-ring" />
            <Camera className="eb-header__emblem-icon" />
          </div>
          <div className="eb-header__titles">
            <div className="eb-header__eyebrow">
              <span className="eb-header__dept">DIVISION: WORLDCRAFT</span>
              <span className="eb-header__sep">·</span>
              <Radio size={9} className="eb-header__live-icon" />
              <span className="eb-header__live-text">LIVE</span>
            </div>
            <h1 className="eb-header__title">INVESTIGATION BOARD</h1>
            <div className="eb-header__subtitle">
              <Eye size={11} />
              <span>{images.length} EVIDENCE ITEMS</span>
              {connections.length > 0 && <>
                <span className="eb-header__sep-dot" />
                <LinkIcon size={10} />
                <span>{connections.length} CONNECTIONS</span>
              </>}
              {isSavingLayout && (
                <span className="eb-header__sync">
                  <Loader2 size={9} className="eb-spin" /> SYNCING
                </span>
              )}
              {saveFlash && !isSavingLayout && (
                <span className="eb-header__saved">✓ SAVED</span>
              )}
            </div>
          </div>
        </div>
<div className="eb-header__right">
          {/* NOVO: Botão de Controlo do Mestre */}
          {isGM && (
            <button 
              onClick={() => setIsAccessPanelOpen(!isAccessPanelOpen)} 
              className={`eb-header__gm-btn ${isAccessPanelOpen ? 'is-open' : ''}`}
            >
              <Shield size={12} />
              <span>ACESSOS (GM)</span>
            </button>
          )}
          <div className="eb-header__classif">
            <Shield size={12} />
            <span>TOP SECRET</span>
          </div>
        </div>
      </header>

      {/* ── TOOLBAR ────────────────────────────────────────────── */}
      <div className="eb-toolbar">
        <div className="eb-toolbar__group">
          <button className="eb-toolbar__btn" onClick={() => setZoom(z => Math.min(2, z + 0.15))} title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <div className="eb-toolbar__zoom-val">{Math.round(zoom * 100)}%</div>
          <button className="eb-toolbar__btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <button className="eb-toolbar__btn" onClick={resetView} title="Reset View">
            <Crosshair size={15} />
          </button>
        </div>
        <div className="eb-toolbar__divider" />
        <div className="eb-toolbar__group">
          <button
            className={`eb-toolbar__btn ${showGrid ? 'eb-toolbar__btn--active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle Grid"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M5 1v13M10 1v13M1 5h13M1 10h13" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
          <button
            className={`eb-toolbar__btn ${viewMode === 'gallery' ? 'eb-toolbar__btn--active' : ''}`}
            onClick={() => setViewMode(v => v === 'board' ? 'gallery' : 'board')}
            title="Gallery View"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="1" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
              <rect x="8.5" y="1" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
              <rect x="1" y="8.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </button>
          <button
            className="eb-toolbar__btn"
            onClick={() => setIsFullscreen(f => !f)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ── CONNECT BANNER ─────────────────────────────────────── */}
      {connectingFrom && (
        <div className="eb-connect-banner" onClick={() => setConnectingFrom(null)}>
          <div className="eb-connect-banner__pulse" />
          <div className="eb-connect-banner__icon"><LinkIcon size={14} /></div>
          <div className="eb-connect-banner__text">
            <span className="eb-connect-banner__label">LINKING EVIDENCE</span>
            <span className="eb-connect-banner__hint">Select a target card · Click here to cancel</span>
          </div>
          <X size={14} className="eb-connect-banner__x" />
        </div>
      )}

      {/* ── BOARD / GALLERY ────────────────────────────────────── */}
      {viewMode === 'gallery' ? (
        <div className="eb-gallery custom-scrollbar">
          {images.map((img, i) => (
            <div key={img.id} className="eb-gallery__item" onClick={() => { setSelectedEvidence(img); setEditDesc(img.description || ''); setActiveTab('photo'); }}>
              <div className="eb-gallery__photo">
                <img src={img.external_url} alt={img.name} className="eb-gallery__img" draggable="false" />
                <div className="eb-gallery__photo-overlay" />
                <div className="eb-gallery__badge">EVD-{String(i + 1).padStart(3, '0')}</div>
              </div>
              <div className="eb-gallery__meta">
                <span className="eb-gallery__name">{img.name.slice(0, 22)}{img.name.length > 22 ? '…' : ''}</span>
                {img.description && <span className="eb-gallery__desc">{img.description.slice(0, 50)}…</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`eb-board-scroll custom-scrollbar ${isPanning ? 'eb-board-scroll--panning' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'grab' }}
        >
          {/* Cork textures */}
          <div className="eb-cork-base" />
          <div className="eb-cork-texture" />
          <div className="eb-cork-grain" />
          <div className="eb-cork-pinstripes" />

          <div
            ref={boardRef}
            className="eb-canvas"
            onPointerMove={handlePointerMove}
            onPointerUp={() => { if (dragInfo) setDragInfo(null); }}
            onPointerLeave={() => { if (dragInfo) setDragInfo(null); }}
            style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})` }}
          >

            {/* ── SVG THREADS ──────────────────────────────── */}
            <svg className="eb-svg-layer">
              <defs>
                <filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="1" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.95)" />
                </filter>
                <filter id="thread-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="thread-glow-hot" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <circle cx="3" cy="3" r="2" fill="#dc2626" />
                </marker>
              </defs>

              {connections.map(conn => {
                const p1 = positions[conn.source]; const p2 = positions[conn.target];
                if (!p1 || !p2) return null;
                const cx1 = p1.x + 110; const cy1 = p1.y + 130;
                const cx2 = p2.x + 110; const cy2 = p2.y + 130;
                const d = drawSaggingLine(cx1, cy1, cx2, cy2);
                const midX = (cx1 + cx2) / 2;
                const midY = (cy1 + cy2) / 2 + Math.max(24, Math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2) * 0.065);

                return (
                  <g key={conn.id} className="eb-thread-group" onClick={(e) => { e.stopPropagation(); removeConnection(conn.id); }}>
                    {/* Deep shadow */}
                    <path d={d} stroke="rgba(0,0,0,0.85)" strokeWidth="9" fill="none" filter="url(#thread-shadow)" />
                    {/* Dark twist core */}
                    <path d={d} stroke="#2d0808" strokeWidth="5" fill="none" />
                    {/* Main thread */}
                    <path d={d} stroke="#b91c1c" strokeWidth="3" fill="none" />
                    {/* Fiber highlight */}
                    <path d={d} stroke="rgba(248,113,113,0.5)" strokeWidth="1" fill="none" strokeDasharray="3,8" className="eb-thread-fiber" />
                    {/* Animated march */}
                    <path d={d} stroke="#dc2626" strokeWidth="2" fill="none" strokeDasharray="8,6" className="eb-thread-dash" opacity="0.7" />
                    {/* Hover glow */}
                    <path d={d} stroke="#f87171" strokeWidth="4" fill="none" opacity="0" filter="url(#thread-glow-hot)" className="eb-thread-glow" />
                    {/* Pin at midpoint */}
                    <circle cx={midX} cy={midY} r="5" fill="#991b1b" stroke="#fca5a5" strokeWidth="1" className="eb-thread-mid-pin" />
                    <circle cx={midX} cy={midY} r="2" fill="#fca5a5" className="eb-thread-mid-pin" />
                    {/* Wide invisible hit area */}
                    <path d={d} stroke="transparent" strokeWidth="36" fill="none" />
                  </g>
                );
              })}

              {/* Live connecting thread */}
              {connectingFrom && mousePos && positions[connectingFrom] && (
                <g>
                  <path
                    d={drawSaggingLine(positions[connectingFrom].x + 110, positions[connectingFrom].y + 130, mousePos.x, mousePos.y)}
                    stroke="#f43f5e" strokeWidth="3" fill="none" strokeDasharray="6,4"
                    className="eb-thread-live" filter="url(#thread-glow)"
                  />
                  <circle cx={mousePos.x} cy={mousePos.y} r="7" fill="none" stroke="#f43f5e" strokeWidth="2" className="eb-thread-cursor" />
                </g>
              )}
            </svg>

            {/* ── POLAROID CARDS ───────────────────────────── */}
            {images.map((img, index) => {
              const pos = positions[img.id] || { x: 0, y: 0 };
              const rot = rotations[img.id] || 0;
              const isDragging = dragInfo?.id === img.id;
              const isTarget = !!(connectingFrom && connectingFrom !== img.id);
              const isConnectSource = connectingFrom === img.id;
              const isHovered = hoveredCard === img.id;
              const connected = getConnectedCards(img.id);
              const tacksColors = ['#be123c', '#1d4ed8', '#047857', '#b45309', '#7c3aed'];
              const tackColor = tacksColors[index % tacksColors.length];

              return (
                <div
                  key={img.id}
                  className={`eb-card ${isDragging ? 'eb-card--dragging' : ''} ${isTarget ? 'eb-card--target' : ''} ${isConnectSource ? 'eb-card--source' : ''}`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: isDragging
                      ? `rotate(${rot * 0.3}deg) scale(1.08) translateY(-8px)`
                      : `rotate(${rot}deg)`,
                    zIndex: zIndices[img.id] || 10,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, img.id)}
                  onPointerUp={(e) => handlePointerUp(e, img)}
                  onPointerEnter={() => setHoveredCard(img.id)}
                  onPointerLeave={() => setHoveredCard(null)}
                >

                  {/* THUMBTACK */}
                  <div className="eb-tack" style={{ '--tack-color': tackColor } as React.CSSProperties}>
                    <div className="eb-tack__shadow" />
                    <div className="eb-tack__head">
                      <div className="eb-tack__shine" />
                      <div className="eb-tack__reflection" />
                    </div>
                    <div className="eb-tack__neck" />
                    <div className="eb-tack__stem" />
                  </div>

                  {/* POLAROID FRAME */}
                  <div className="eb-polaroid">

                    {/* Tape variants */}
                    {index % 4 === 0 && <div className="eb-tape eb-tape--top" />}
                    {index % 4 === 1 && <div className="eb-tape eb-tape--corner-r" />}
                    {index % 4 === 2 && <div className="eb-tape eb-tape--corner-l" />}
                    {index % 4 === 3 && <><div className="eb-tape eb-tape--corner-r" /><div className="eb-tape eb-tape--corner-l" /></>}

                    {/* Photo */}
                    <div className="eb-polaroid__photo">
                      <img
                        src={img.external_url}
                        alt={img.name}
                        className="eb-polaroid__img"
                        draggable="false"
                      />
                      <div className="eb-polaroid__film-grain" />
                      <div className="eb-polaroid__overlay" />
                      <div className="eb-polaroid__vignette" />
                      <div className="eb-polaroid__stamp">
                        <span>EVD</span>
                        <span className="eb-polaroid__stamp-num">{String(index + 1).padStart(3, '0')}</span>
                      </div>
                      {connected.length > 0 && (
                        <div className="eb-polaroid__conn-badge">
                          <LinkIcon size={8} />
                          <span>{connected.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Caption strip */}
                    <div className="eb-polaroid__caption">
                      <div className="eb-polaroid__caption-left">
                        <span className="eb-polaroid__ref">#{String(index + 1).padStart(3, '0')}</span>
                        {img.description && (
                          <span className="eb-polaroid__note-preview">{img.description.slice(0, 28)}{img.description.length > 28 ? '…' : ''}</span>
                        )}
                      </div>
                      <div className="eb-polaroid__caption-right">
                        <span className="eb-polaroid__year">{new Date().getFullYear()}</span>
                        {img.description && <div className="eb-polaroid__has-note"><FileText size={8} /></div>}
                      </div>
                    </div>

                  </div>

                  {/* LINK BUTTON */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleLinkClick(e, img.id)}
                    className={`eb-link-btn ${isConnectSource ? 'eb-link-btn--active' : ''}`}
                    title="Link Evidence"
                  >
                    <LinkIcon size={13} />
                  </button>

                  {/* ROTATE BUTTON */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRotations(prev => ({ ...prev, [img.id]: (prev[img.id] || 0) + 5 }));
                    }}
                    className="eb-rotate-btn"
                    title="Rotate"
                  >
                    <RotateCcw size={12} />
                  </button>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DOSSIER MODAL ─────────────────────────────────────── */}
      {selectedEvidence && (() => {
        const evidenceIndex = images.findIndex(i => i.id === selectedEvidence.id);
        const connected = getConnectedCards(selectedEvidence.id);
        const connectedItems = images.filter(i => connected.includes(i.id));

        return (
          <div className="eb-dossier-overlay">
            <div className="eb-dossier-backdrop" onClick={() => setSelectedEvidence(null)} />

            <div className="eb-dossier">

              {/* Left spine */}
              <div className="eb-dossier__spine">
                <div className="eb-dossier__spine-stripe eb-dossier__spine-stripe--red" />
                <span className="eb-dossier__spine-text">CLASSIFIED</span>
                <div className="eb-dossier__spine-stripe eb-dossier__spine-stripe--amber" />
              </div>

              {/* Folder body */}
              <div className="eb-dossier__body">
                <div className="eb-dossier__body-noise" />

                {/* ── LEFT: PHOTO PANEL ─────────────────────── */}
                <div className="eb-dossier__photo-panel">
                  <div className="eb-dossier__tape-top" />

                  {/* Photo frame */}
                  <div className="eb-dossier__photo-frame">
                    <div className="eb-dossier__photo-inner">
                      <img
                        src={selectedEvidence.external_url}
                        className="eb-dossier__photo-img"
                        alt={selectedEvidence.name}
                      />
                      <div className="eb-dossier__photo-film" />
                      <div className="eb-dossier__annotation" />
                      {/* Corner brackets */}
                      {['tl', 'tr', 'bl', 'br'].map(c => (
                        <div key={c} className={`eb-dossier__corner eb-dossier__corner--${c}`} />
                      ))}
                      <div className="eb-dossier__photo-ref">
                        REF: {selectedEvidence.id.slice(0, 8).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Stamp */}
                  <div className="eb-dossier__stamp">
                    <div className="eb-dossier__stamp-border">
                      <span>TOP SECRET</span>
                    </div>
                  </div>

                  {/* Evidence number tag */}
                  <div className="eb-dossier__evd-tag">
                    <span className="eb-dossier__evd-label">EVIDENCE</span>
                    <span className="eb-dossier__evd-num">#{String(evidenceIndex + 1).padStart(3, '0')}</span>
                  </div>

                  {/* Classification bars */}
                  <div className="eb-dossier__class-bars">
                    {['red', 'amber', 'red', 'amber'].map((c, i) => (
                      <div key={i} className={`eb-dossier__class-bar eb-dossier__class-bar--${c}`} />
                    ))}
                  </div>
                </div>

                {/* ── RIGHT: DOCUMENT PANEL ─────────────────── */}
                <div className="eb-dossier__doc-panel">
                  <div className="eb-dossier__lines" />
                  <div className="eb-dossier__margin" />
                  <div className="eb-dossier__holes">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="eb-dossier__hole">
                        <div className="eb-dossier__hole-inner" />
                      </div>
                    ))}
                  </div>
                  <div className="eb-dossier__watermark">CLASSIFIED</div>

                  {/* Header */}
                  <div className="eb-dossier__doc-header">
                    <div className="eb-dossier__doc-header-left">
                      <p className="eb-dossier__dept-label">DEPARTMENT OF WORLD AFFAIRS · EYES ONLY</p>
                      <h2 className="eb-dossier__subject-title">
                        Subject Report
                        <span className="eb-dossier__subject-name">[{selectedEvidence.name}]</span>
                      </h2>
                    </div>
                    <button className="eb-dossier__close-btn" onClick={() => setSelectedEvidence(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="eb-dossier__tabs">
                    {[
                      { id: 'photo', label: 'ANALYSIS', icon: <Eye size={12} /> },
                      { id: 'details', label: 'NOTES', icon: <FileText size={12} /> },
                      { id: 'links', label: `LINKS (${connectedItems.length})`, icon: <LinkIcon size={12} /> },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className={`eb-dossier__tab ${activeTab === tab.id ? 'eb-dossier__tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id as any)}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab: ANALYSIS */}
                  {activeTab === 'photo' && (
                    <div className="eb-dossier__tab-content">
                      <div className="eb-dossier__analysis-grid">
                        <div className="eb-dossier__analysis-row">
                          <span className="eb-dossier__analysis-key">FILE NAME</span>
                          <span className="eb-dossier__analysis-val">{selectedEvidence.name}</span>
                        </div>
                        <div className="eb-dossier__analysis-row">
                          <span className="eb-dossier__analysis-key">EVIDENCE ID</span>
                          <span className="eb-dossier__analysis-val eb-dossier__analysis-val--mono">{selectedEvidence.id.slice(0, 16).toUpperCase()}</span>
                        </div>
                        <div className="eb-dossier__analysis-row">
                          <span className="eb-dossier__analysis-key">MIME TYPE</span>
                          <span className="eb-dossier__analysis-val eb-dossier__analysis-val--mono">{selectedEvidence.mime_type}</span>
                        </div>
                        <div className="eb-dossier__analysis-row">
                          <span className="eb-dossier__analysis-key">CONNECTIONS</span>
                          <span className="eb-dossier__analysis-val">{connected.length} LINKED ITEMS</span>
                        </div>
                        <div className="eb-dossier__analysis-row">
                          <span className="eb-dossier__analysis-key">CLEARANCE</span>
                          <span className="eb-dossier__analysis-val eb-dossier__analysis-val--red">LEVEL 5 — TOP SECRET</span>
                        </div>
                        <div className="eb-dossier__analysis-row">
                          <span className="eb-dossier__analysis-key">DATE</span>
                          <span className="eb-dossier__analysis-val">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</span>
                        </div>
                      </div>
                      {selectedEvidence.external_url && (
                        <a href={selectedEvidence.external_url} target="_blank" rel="noopener noreferrer" className="eb-dossier__ext-link">
                          <ExternalLink size={13} />
                          VIEW ORIGINAL FILE
                          <ChevronRight size={13} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Tab: NOTES */}
                  {activeTab === 'details' && (
                    <div className="eb-dossier__tab-content eb-dossier__tab-content--notes">
                      <div className="eb-dossier__lock-label">
                        <Lock size={12} />
                        <span>TRANSCRIPTION LOG · DO NOT COPY · LEVEL 5 CLEARANCE</span>
                      </div>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="CLASSIFIED: Begin typing observation notes here..."
                        className="eb-dossier__textarea custom-scrollbar"
                      />
                    </div>
                  )}

                  {/* Tab: LINKS */}
                  {activeTab === 'links' && (
                    <div className="eb-dossier__tab-content">
                      {connectedItems.length === 0 ? (
                        <div className="eb-dossier__no-links">
                          <AlertTriangle size={24} className="eb-dossier__no-links-icon" />
                          <p>No connections established</p>
                          <span>Use the link button on a card to connect evidence</span>
                        </div>
                      ) : (
                        <div className="eb-dossier__links-list">
                          {connectedItems.map(item => (
                            <div key={item.id} className="eb-dossier__link-item" onClick={() => { setSelectedEvidence(item); setEditDesc(item.description || ''); setActiveTab('photo'); }}>
                              <div className="eb-dossier__link-thumb">
                                <img src={item.external_url} alt={item.name} className="eb-dossier__link-img" />
                              </div>
                              <div className="eb-dossier__link-info">
                                <span className="eb-dossier__link-name">{item.name}</span>
                                {item.description && <span className="eb-dossier__link-desc">{item.description.slice(0, 50)}</span>}
                              </div>
                              <ChevronRight size={14} className="eb-dossier__link-arrow" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="eb-dossier__footer">
                    <div className="eb-dossier__auth-block">
                      <p>AUTH: <strong>{selectedWorld?.id?.split('-')[0]?.toUpperCase()}</strong></p>
                      <p>DATE: <strong>{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}</strong></p>
                      <p>CLEARANCE: <strong className="eb-dossier__clearance-level">LEVEL 5</strong></p>
                    </div>
                    <button
                      onClick={handleSaveDescription}
                      disabled={isSavingDesc}
                      className="eb-dossier__save-btn"
                    >
                      {isSavingDesc
                        ? <><Loader2 size={15} className="eb-spin" /> ENCRYPTING…</>
                        : <><Save size={15} /> STAMP &amp; FILE</>
                      }
                    </button>
                  </div>

                  {/* Classification strip */}
                  <div className="eb-dossier__class-strip">
                    TOP SECRET // NOFORN // ORCON // HCS-P // SI-G // TK // CLASSIFICATION: EYES ONLY
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── STATUS BAR ────────────────────────────────────────── */}
      <div className="eb-statusbar">
        <div className="eb-statusbar__left">
          <span className="eb-statusbar__item">
            <span className="eb-statusbar__dot eb-statusbar__dot--green" />
            SECURE CONNECTION
          </span>
          <span className="eb-statusbar__sep">·</span>
          <span className="eb-statusbar__item">WORLD: {selectedWorld?.name?.toUpperCase() || '—'}</span>
        </div>
        <div className="eb-statusbar__right">
          <span className="eb-statusbar__item">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
          <span className="eb-statusbar__sep">·</span>
          <span className="eb-statusbar__item">ZOOM {Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* NOVO: Painel de Acessos Deslizante */}
      {isGM && isAccessPanelOpen && <PlayerAccessPanel />}

      {/* ══════════════════════════════════════════════════════════
          STYLES
      ══════════════════════════════════════════════════════════ */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=Share+Tech+Mono&family=Oswald:wght@400;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');

        /* ═══ TOKENS ════════════════════════════════════════════ */
        :root {
          --cork:         #1e1408;
          --cork-mid:     #2a1e0e;
          --cork-light:   #3d2b18;
          --paper:        #f2ead6;
          --paper-warm:   #ede3c4;
          --ink:          #1a1006;
          --ink-faint:    rgba(26,16,6,0.35);
          --red:          #dc2626;
          --red-dark:     #7f1d1d;
          --red-deep:     #4c0519;
          --red-bright:   #f87171;
          --amber:        #d97706;
          --amber-light:  #fbbf24;
          --teal:         #0f766e;
          --stamp-red:    rgba(185,28,28,0.8);
          --folder-tan:   #c8a87a;
          --folder-dark:  #8a6848;
          --folder-deep:  #5a4030;
          --shadow-hard:  0 40px 100px rgba(0,0,0,0.98);
          --font-type:    'Special Elite', 'Courier New', monospace;
          --font-mono:    'Share Tech Mono', monospace;
          --font-head:    'Oswald', sans-serif;
          --font-ui:      'Rajdhani', sans-serif;
        }

        /* ═══ LOADING ═══════════════════════════════════════════ */
        .eb-loading {
          display: flex; align-items: center; justify-content: center;
          flex: 1; height: 100%; width: 100%;
          background: #03060a;
          font-family: var(--font-mono);
          position: relative; overflow: hidden;
        }
        .eb-loading::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, rgba(127,29,29,0.12) 0%, transparent 70%);
        }
        .eb-loading__inner {
          display: flex; flex-direction: column; align-items: center; gap: 24px;
          position: relative; z-index: 1;
        }
        .eb-loading__emblem {
          position: relative; width: 100px; height: 100px;
          display: flex; align-items: center; justify-content: center;
        }
        .eb-loading__ring {
          position: absolute; border-radius: 50%; border-style: solid;
          border-color: transparent;
        }
        .eb-loading__ring--1 {
          inset: 0; border-width: 1px;
          border-top-color: rgba(220,38,38,0.6);
          animation: ring-spin 2s linear infinite;
        }
        .eb-loading__ring--2 {
          inset: 8px; border-width: 1px;
          border-right-color: rgba(220,38,38,0.35);
          animation: ring-spin 3s linear infinite reverse;
        }
        .eb-loading__ring--3 {
          inset: 16px; border-width: 1px;
          border-bottom-color: rgba(220,38,38,0.2);
          animation: ring-spin 4s linear infinite;
        }
        @keyframes ring-spin { to { transform: rotate(360deg); } }
        .eb-loading__icon { width: 40px; height: 40px; color: #f87171; animation: eb-pulse 2s ease-in-out infinite; }
        .eb-loading__label { display: flex; align-items: center; gap: 6px; }
        .eb-loading__prefix { color: rgba(220,38,38,0.5); font-size: 11px; letter-spacing: 0.1em; }
        .eb-loading__text { color: rgba(248,113,113,0.9); font-size: 11px; letter-spacing: 0.35em; }
        .eb-loading__track {
          width: 240px; height: 2px; background: rgba(255,255,255,0.05);
          border-radius: 2px; overflow: visible; position: relative;
        }
        .eb-loading__fill {
          height: 100%; background: linear-gradient(90deg, #7f1d1d, #dc2626, #f87171);
          border-radius: 2px; transition: width 0.4s ease;
        }
        .eb-loading__glow {
          position: absolute; top: -4px; width: 12px; height: 10px;
          background: #f87171; border-radius: 50%; filter: blur(5px);
          transform: translateX(-50%); transition: left 0.4s ease;
          opacity: 0.8;
        }
        .eb-loading__pct { color: rgba(220,38,38,0.6); font-size: 11px; letter-spacing: 0.2em; }
        .eb-loading__dots { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .eb-loading__dot-item {
          display: flex; align-items: center; gap: 10px;
          color: rgba(255,255,255,0.25); font-size: 10px; letter-spacing: 0.2em;
          opacity: 0; animation: dot-appear 0.5s ease forwards;
        }
        @keyframes dot-appear { to { opacity: 1; } }
        .eb-loading__dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(220,38,38,0.6);
          animation: eb-pulse 1.5s ease-in-out infinite;
        }

        /* ═══ ROOT ══════════════════════════════════════════════ */
        .eb-root {
          flex: 1; height: 100%; width: 100%;
          overflow: hidden; display: flex; flex-direction: column;
          position: relative; background: var(--cork);
          font-family: var(--font-mono);
        }
        .eb-root--fullscreen {
          position: fixed; inset: 0; z-index: 9999;
        }

        /* ATMOSPHERE */
        .eb-atmosphere {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 60% at 50% 30%, rgba(60,30,10,0.6) 0%, rgba(10,6,2,0.9) 100%);
        }
        .eb-vignette {
          position: absolute; inset: 0; z-index: 35; pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.88) 100%);
        }
        .eb-scanlines {
          position: absolute; inset: 0; z-index: 34; pointer-events: none; opacity: 0.02;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,1) 2px, rgba(0,0,0,1) 3px);
        }
        .eb-grid-overlay {
          position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0.06;
          background-image:
            linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* ═══ HEADER ════════════════════════════════════════════ */
        .eb-header {
          position: absolute; top: 0; left: 0; right: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px 16px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
          pointer-events: none;
        }
        .eb-header__left { display: flex; align-items: center; gap: 14px; }
        .eb-header__emblem {
          width: 52px; height: 52px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #4c0519 0%, #1a0009 70%);
          border: 1px solid rgba(220,38,38,0.4);
          display: flex; align-items: center; justify-content: center;
          position: relative; flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(220,38,38,0.1), 0 0 30px rgba(220,38,38,0.2), 0 8px 20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .eb-header__emblem-ring {
          position: absolute; inset: 5px; border-radius: 50%;
          border: 1px solid rgba(220,38,38,0.25);
          animation: eb-ring-pulse 3.5s ease-in-out infinite;
        }
        .eb-header__emblem-icon { width: 22px; height: 22px; color: #f87171; }
        .eb-header__titles {
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(16px) saturate(1.2);
          padding: 10px 20px 10px 16px;
          border-radius: 4px;
          border-left: 2px solid var(--red-dark);
          border: 1px solid rgba(255,255,255,0.04);
          border-left: 2px solid var(--red-dark);
          box-shadow: 0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02);
        }
        .eb-header__eyebrow {
          display: flex; align-items: center; gap: 6px;
          margin-bottom: 3px;
        }
        .eb-header__dept { font-size: 9px; letter-spacing: 0.25em; color: rgba(255,255,255,0.28); }
        .eb-header__sep { color: rgba(255,255,255,0.15); }
        .eb-header__live-icon { color: #dc2626; animation: eb-pulse 2s ease-in-out infinite; }
        .eb-header__live-text { font-size: 9px; letter-spacing: 0.3em; color: #dc2626; }
        .eb-header__title {
          font-family: var(--font-head);
          font-size: clamp(17px, 2.2vw, 26px); font-weight: 700;
          color: #f5eedf; letter-spacing: 0.22em; line-height: 1;
          text-shadow: 0 0 40px rgba(220,38,38,0.3);
        }
        .eb-header__subtitle {
          display: flex; align-items: center; gap: 7px; margin-top: 4px;
          color: rgba(248,113,113,0.65); font-size: 10px; letter-spacing: 0.2em;
        }
        .eb-header__sep-dot { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
        .eb-header__sync {
          display: flex; align-items: center; gap: 4px;
          font-size: 9px; padding: 2px 8px; border-radius: 2px;
          background: rgba(127,29,29,0.25); border: 1px solid rgba(127,29,29,0.4);
          color: #fca5a5;
        }
        .eb-header__saved {
          font-size: 9px; letter-spacing: 0.15em; color: #34d399;
          animation: eb-fade-in 0.3s ease;
        }
        .eb-header__right { display: flex; align-items: center; pointer-events: auto; }
        .eb-header__classif {
          display: flex; align-items: center; gap: 6px;
          background: rgba(127,29,29,0.9); border: 1px solid rgba(185,28,28,0.6);
          padding: 5px 12px; border-radius: 2px;
          color: #fca5a5; font-size: 9px; letter-spacing: 0.3em;
          box-shadow: 0 0 20px rgba(220,38,38,0.2);
          animation: eb-blink 5s ease-in-out infinite;
        }

        /* ═══ BOTÃO GM (NOVO) ═══════════════════════════════════ */
        .eb-header__gm-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1);
          padding: 5px 12px; border-radius: 2px; margin-right: 12px;
          color: #10b981; font-size: 9px; letter-spacing: 0.2em; cursor: pointer;
          transition: all 0.2s; backdrop-filter: blur(4px);
        }
        .eb-header__gm-btn:hover { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.4); }
        .eb-header__gm-btn.is-open { background: #10b981; color: #000; border-color: #10b981; }

        /* ═══ TOOLBAR ═══════════════════════════════════════════ */
        .eb-toolbar {
          position: absolute; bottom: 36px; right: 18px; z-index: 40;
          display: flex; align-items: center; gap: 4px;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px; padding: 6px 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.7);
        }
        .eb-toolbar__group { display: flex; align-items: center; gap: 2px; }
        .eb-toolbar__divider { width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 4px; }
        .eb-toolbar__btn {
          width: 32px; height: 32px; border-radius: 4px;
          background: transparent; border: none; cursor: pointer;
          color: rgba(255,255,255,0.45);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease;
          font-family: var(--font-mono); font-size: 10px;
        }
        .eb-toolbar__btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
        .eb-toolbar__btn--active { background: rgba(220,38,38,0.2) !important; color: #f87171 !important; border: 1px solid rgba(220,38,38,0.3); }
        .eb-toolbar__zoom-val {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em;
          color: rgba(255,255,255,0.4); min-width: 38px; text-align: center;
        }

        /* ═══ STATUS BAR ════════════════════════════════════════ */
        .eb-statusbar {
          position: absolute; bottom: 0; left: 0; right: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between;
          padding: 5px 18px;
          background: rgba(0,0,0,0.7);
          border-top: 1px solid rgba(255,255,255,0.04);
          font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em;
          color: rgba(255,255,255,0.3);
          pointer-events: none;
        }
        .eb-statusbar__left, .eb-statusbar__right { display: flex; align-items: center; gap: 8px; }
        .eb-statusbar__item { display: flex; align-items: center; gap: 5px; }
        .eb-statusbar__sep { color: rgba(255,255,255,0.12); }
        .eb-statusbar__dot { width: 5px; height: 5px; border-radius: 50%; }
        .eb-statusbar__dot--green { background: #10b981; box-shadow: 0 0 6px #10b981; animation: eb-pulse 3s ease-in-out infinite; }

        /* ═══ CONNECT BANNER ════════════════════════════════════ */
        .eb-connect-banner {
          position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
          z-index: 50;
          display: flex; align-items: center; gap: 12px;
          background: rgba(120,10,40,0.97);
          border: 1px solid rgba(244,63,94,0.7);
          padding: 12px 24px; border-radius: 40px;
          cursor: pointer; user-select: none;
          box-shadow: 0 0 60px rgba(244,63,94,0.5), 0 8px 40px rgba(0,0,0,0.9);
          animation: eb-pulse-border 1.8s ease-in-out infinite;
        }
        .eb-connect-banner__pulse {
          position: absolute; inset: -2px; border-radius: 40px;
          border: 1px solid rgba(244,63,94,0.4);
          animation: eb-expand 1.8s ease-out infinite; pointer-events: none;
        }
        .eb-connect-banner__icon {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(244,63,94,0.2); border: 1px solid rgba(244,63,94,0.5);
          display: flex; align-items: center; justify-content: center;
          color: #f87171;
        }
        .eb-connect-banner__text { display: flex; flex-direction: column; }
        .eb-connect-banner__label {
          font-family: var(--font-head); font-size: 13px; letter-spacing: 0.2em;
          color: white; font-weight: 600;
        }
        .eb-connect-banner__hint { font-size: 9px; letter-spacing: 0.15em; color: rgba(248,113,113,0.7); margin-top: 1px; }
        .eb-connect-banner__x { color: rgba(255,255,255,0.4); }

        /* ═══ BOARD ═════════════════════════════════════════════ */
        .eb-board-scroll {
          width: 100%; flex: 1; overflow: hidden;
          position: relative; background: var(--cork);
          user-select: none;
        }
        .eb-board-scroll--panning { cursor: grabbing !important; }
        .eb-cork-base {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 200% 150% at 20% 30%, #3d2a14 0%, #1e1408 60%),
            radial-gradient(ellipse 150% 200% at 80% 70%, #2d1f0f 0%, transparent 60%);
        }
        .eb-cork-texture {
          position: absolute; inset: 0; pointer-events: none; z-index: 1; opacity: 0.45; mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 400px 400px;
        }
        .eb-cork-grain {
          position: absolute; inset: 0; pointer-events: none; z-index: 2; opacity: 0.12;
          background-image:
            repeating-linear-gradient(87deg, rgba(255,255,255,0.025) 0px, transparent 1px, transparent 50px),
            repeating-linear-gradient(3deg, rgba(0,0,0,0.06) 0px, transparent 1px, transparent 70px);
        }
        .eb-cork-pinstripes {
          position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: 0.06;
          background-image: repeating-linear-gradient(
            175deg, transparent 0px, transparent 80px,
            rgba(200,168,122,0.3) 80px, rgba(200,168,122,0.3) 81px
          );
        }

        /* CANVAS */
        .eb-canvas {
          position: relative; width: 5000px; height: 4000px;
          z-index: 10; transform-origin: 0 0;
          will-change: transform;
        }

        /* SVG THREADS */
        .eb-svg-layer {
          position: absolute; inset: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 10;
        }
        .eb-thread-group { pointer-events: all; cursor: pointer; }
        .eb-thread-dash { animation: eb-march 0.5s linear infinite; }
        .eb-thread-fiber { animation: eb-march 1.5s linear infinite reverse; }
        .eb-thread-glow { opacity: 0; transition: opacity 0.2s; }
        .eb-thread-mid-pin { opacity: 0.7; transition: opacity 0.2s; }
        .eb-thread-group:hover .eb-thread-glow { opacity: 1; }
        .eb-thread-group:hover .eb-thread-mid-pin { opacity: 1; }
        .eb-thread-live { animation: eb-march 0.35s linear infinite; }
        .eb-thread-cursor { animation: eb-pulse 0.8s ease-in-out infinite; }

        /* ═══ CARDS ═════════════════════════════════════════════ */
        .eb-card {
          position: absolute; width: 216px;
          display: flex; flex-direction: column; align-items: center;
          cursor: grab;
          transition: filter 150ms ease;
          will-change: transform;
        }
        .eb-card:hover { z-index: 200 !important; }
        .eb-card--dragging { cursor: grabbing; }
        .eb-card--target { filter: drop-shadow(0 0 16px rgba(244,63,94,0.8)); }
        .eb-card--target .eb-polaroid { outline: 2px solid rgba(244,63,94,0.6); outline-offset: 3px; }
        .eb-card--source .eb-link-btn { opacity: 1 !important; }
        .eb-card:hover .eb-link-btn,
        .eb-card:hover .eb-rotate-btn { opacity: 1; }

        /* TACK */
        .eb-tack {
          position: relative; z-index: 30; margin-bottom: -3px;
          display: flex; flex-direction: column; align-items: center;
        }
        .eb-tack__shadow {
          position: absolute; top: 10px; left: 50%;
          transform: translateX(-50%);
          width: 30px; height: 10px;
          background: rgba(0,0,0,0.5); border-radius: 50%;
          filter: blur(4px);
        }
        .eb-tack__head {
          width: 24px; height: 24px; border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--tack-color, #be123c) 60%, white), var(--tack-color, #be123c) 55%, color-mix(in srgb, var(--tack-color, #be123c) 60%, black) 85%);
          border: 1px solid rgba(0,0,0,0.4);
          box-shadow: 2px 5px 10px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.2);
          position: relative;
        }
        .eb-tack__shine {
          position: absolute; top: 5px; left: 6px;
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,0.7); filter: blur(1.5px);
        }
        .eb-tack__reflection {
          position: absolute; bottom: 5px; right: 5px;
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(255,255,255,0.2); filter: blur(1px);
        }
        .eb-tack__neck { width: 4px; height: 5px; background: linear-gradient(to bottom, #9ca3af, #6b7280); }
        .eb-tack__stem { width: 3px; height: 9px; background: linear-gradient(to bottom, #6b7280, #374151); border-radius: 0 0 1px 1px; }

        /* POLAROID */
        .eb-polaroid {
          background: linear-gradient(160deg, #efece3 0%, #e8e4d8 100%);
          padding: 10px 10px 38px;
          width: 100%;
          box-shadow:
            8px 14px 35px rgba(0,0,0,0.9),
            0 2px 6px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.7),
            inset 0 -1px 0 rgba(0,0,0,0.08);
          border: 1px solid #c9c4b4;
          border-radius: 1px;
          position: relative;
          pointer-events: none;
          transition: box-shadow 150ms ease, transform 150ms ease;
        }
        .eb-card:hover .eb-polaroid {
          box-shadow:
            14px 24px 55px rgba(0,0,0,0.97),
            0 4px 12px rgba(0,0,0,0.45),
            inset 0 1px 0 rgba(255,255,255,0.7);
        }

        /* TAPE */
        .eb-tape {
          position: absolute; z-index: 10;
          background: rgba(232,224,195,0.58);
          backdrop-filter: blur(2px); mix-blend-mode: multiply;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        .eb-tape--top {
          top: -11px; left: 50%; transform: translateX(-50%) rotate(-1deg);
          width: 65px; height: 19px;
          clip-path: polygon(3% 15%, 97% 0%, 100% 85%, 0% 100%);
        }
        .eb-tape--corner-r {
          top: -9px; right: 14px; transform: rotate(14deg);
          width: 46px; height: 17px;
          clip-path: polygon(4% 10%, 96% 0%, 100% 90%, 0% 100%);
        }
        .eb-tape--corner-l {
          top: -9px; left: 14px; transform: rotate(-14deg);
          width: 46px; height: 17px;
          clip-path: polygon(0% 0%, 96% 10%, 100% 100%, 4% 90%);
        }

        /* PHOTO AREA */
        .eb-polaroid__photo {
          position: relative; width: 100%; aspect-ratio: 1;
          background: #0a0a0a;
          border: 1px solid rgba(0,0,0,0.3);
          overflow: hidden;
          box-shadow: inset 0 4px 12px rgba(0,0,0,0.85);
        }
        .eb-polaroid__img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          filter: grayscale(30%) contrast(1.15) sepia(0.15) brightness(0.92);
          transition: filter 0.3s ease;
        }
        .eb-card:hover .eb-polaroid__img { filter: grayscale(10%) contrast(1.2) sepia(0.08) brightness(0.97); }
        .eb-polaroid__film-grain {
          position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: 0.4;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .eb-polaroid__overlay {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 45%, rgba(0,0,0,0.15) 100%);
          mix-blend-mode: overlay;
        }
        .eb-polaroid__vignette {
          position: absolute; inset: 0; pointer-events: none;
          box-shadow: inset 0 0 32px rgba(0,0,0,0.65);
        }
        .eb-polaroid__stamp {
          position: absolute; top: 5px; left: 5px;
          display: flex; gap: 3px; align-items: center;
          font-family: var(--font-head); font-size: 7px; letter-spacing: 0.15em;
          color: rgba(220,38,38,0.7); background: rgba(0,0,0,0.55);
          padding: 2px 4px; border-radius: 1px; pointer-events: none;
        }
        .eb-polaroid__stamp-num { color: rgba(248,113,113,0.85); }
        .eb-polaroid__conn-badge {
          position: absolute; bottom: 5px; right: 5px;
          display: flex; align-items: center; gap: 3px;
          background: rgba(220,38,38,0.7); border-radius: 10px;
          padding: 2px 6px; font-size: 9px; font-family: var(--font-mono);
          color: white; pointer-events: none;
        }
        .eb-polaroid__caption {
          position: absolute; bottom: 5px; left: 10px; right: 10px;
          display: flex; justify-content: space-between; align-items: flex-end;
          border-top: 1px solid rgba(0,0,0,0.1); padding-top: 5px;
        }
        .eb-polaroid__caption-left { display: flex; flex-direction: column; gap: 2px; }
        .eb-polaroid__caption-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .eb-polaroid__ref {
          font-family: var(--font-type); font-size: 12px; font-weight: bold;
          color: rgba(26,18,9,0.75); letter-spacing: -0.01em;
        }
        .eb-polaroid__note-preview {
          font-family: var(--font-type); font-size: 8px;
          color: rgba(26,18,9,0.4); white-space: nowrap; overflow: hidden; max-width: 130px;
          text-overflow: ellipsis; font-style: italic;
        }
        .eb-polaroid__year { font-family: var(--font-mono); font-size: 9px; color: rgba(127,29,29,0.45); letter-spacing: 0.1em; }
        .eb-polaroid__has-note { color: rgba(127,29,29,0.5); }

        /* CARD BUTTONS */
        .eb-link-btn {
          position: absolute; right: -18px; top: 20px;
          width: 34px; height: 34px; border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #4c0519, #1a0009);
          border: 1px solid rgba(127,29,29,0.7);
          color: #f87171;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: all 0.18s ease;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(0,0,0,0.95), 0 0 0 1px rgba(220,38,38,0.1);
          z-index: 50;
        }
        .eb-link-btn:hover {
          background: radial-gradient(circle at 40% 35%, #881337, #4c0519);
          color: white; transform: scale(1.15);
          box-shadow: 0 8px 24px rgba(0,0,0,0.95), 0 0 18px rgba(244,63,94,0.45);
        }
        .eb-link-btn--active {
          opacity: 1 !important; background: #dc2626 !important; color: white !important;
          box-shadow: 0 0 28px rgba(220,38,38,0.9) !important;
          animation: eb-pulse 0.9s ease-in-out infinite;
        }
        .eb-rotate-btn {
          position: absolute; left: -18px; top: 20px;
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.4);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: all 0.18s ease;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.8); z-index: 50;
        }
        .eb-rotate-btn:hover { background: rgba(255,255,255,0.12); color: white; transform: scale(1.1) rotate(-15deg); }

        /* ═══ GALLERY ═══════════════════════════════════════════ */
        .eb-gallery {
          flex: 1; overflow-y: auto; padding: 80px 20px 50px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px; align-content: start;
          background: var(--cork);
        }
        .eb-gallery__item {
          background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 4px; overflow: hidden; cursor: pointer;
          transition: all 0.2s ease;
        }
        .eb-gallery__item:hover { border-color: rgba(220,38,38,0.4); transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.7); }
        .eb-gallery__photo { position: relative; aspect-ratio: 1; }
        .eb-gallery__img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(25%) sepia(0.1); }
        .eb-gallery__photo-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%); }
        .eb-gallery__badge {
          position: absolute; top: 6px; left: 6px;
          font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em;
          background: rgba(185,28,28,0.8); color: white; padding: 2px 6px; border-radius: 2px;
        }
        .eb-gallery__meta { padding: 10px 12px; }
        .eb-gallery__name { font-family: var(--font-mono); font-size: 11px; color: rgba(255,255,255,0.7); letter-spacing: 0.05em; display: block; }
        .eb-gallery__desc { font-family: var(--font-type); font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 4px; display: block; line-height: 1.4; }

        /* ═══ DOSSIER ═══════════════════════════════════════════ */
        .eb-dossier-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: clamp(16px, 4vw, 48px);
          animation: eb-fade-in 0.2s ease;
        }
        .eb-dossier-backdrop {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.93);
          backdrop-filter: blur(20px) saturate(0.8);
        }
        .eb-dossier {
          position: relative; z-index: 10;
          width: 100%; max-width: 1140px; height: min(88vh, 800px);
          display: flex; border-radius: 4px; overflow: hidden;
          box-shadow: 0 60px 140px rgba(0,0,0,0.99), 0 0 0 1px rgba(255,255,255,0.04), 0 0 100px rgba(0,0,0,0.9);
          animation: eb-zoom-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }

        /* SPINE */
        .eb-dossier__spine {
          width: 30px; flex-shrink: 0;
          background: linear-gradient(to right, #5a3a1a, #7a5228, #6a4820);
          border-right: 2px solid #3a2010;
          display: flex; flex-direction: column; align-items: center;
          justify-content: space-between; padding: 0;
          box-shadow: inset -5px 0 14px rgba(0,0,0,0.5), 3px 0 8px rgba(0,0,0,0.5);
        }
        .eb-dossier__spine-stripe { height: 6px; width: 100%; }
        .eb-dossier__spine-stripe--red { background: #7f1d1d; }
        .eb-dossier__spine-stripe--amber { background: #92400e; }
        .eb-dossier__spine-text {
          writing-mode: vertical-rl; transform: rotate(180deg);
          font-family: var(--font-head); font-size: 8px; letter-spacing: 0.4em;
          color: rgba(255,255,255,0.22);
        }

        /* BODY */
        .eb-dossier__body {
          flex: 1; display: flex;
          background: linear-gradient(140deg, #cba978 0%, #d8bc96 40%, #c5a46c 100%);
          position: relative; overflow: hidden;
        }
        .eb-dossier__body-noise {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.1;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* PHOTO PANEL */
        .eb-dossier__photo-panel {
          width: clamp(240px, 30%, 360px); flex-shrink: 0;
          padding: clamp(24px, 5%, 56px) clamp(18px, 4%, 40px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative;
          border-right: 1px solid rgba(0,0,0,0.1);
        }
        .eb-dossier__tape-top {
          position: absolute; top: clamp(24px, 6%, 60px); left: 50%; transform: translateX(-50%) rotate(-2.5deg);
          width: clamp(90px, 42%, 150px); height: 26px;
          background: rgba(220,210,175,0.58); backdrop-filter: blur(2px);
          clip-path: polygon(2% 12%, 98% 0%, 100% 88%, 0% 100%);
          mix-blend-mode: multiply;
          box-shadow: 0 1px 5px rgba(0,0,0,0.18);
          z-index: 5;
        }
        .eb-dossier__photo-frame {
          background: linear-gradient(160deg, #faf8f2, #f0ece0);
          padding: clamp(10px,3%,22px) clamp(10px,3%,22px) clamp(36px,8%,60px);
          box-shadow: 0 22px 60px rgba(0,0,0,0.7), 0 3px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.85);
          border: 1px solid rgba(0,0,0,0.12);
          transform: rotate(-2deg);
          position: relative; z-index: 2; width: 100%;
        }
        .eb-dossier__photo-inner {
          position: relative; aspect-ratio: 1; overflow: hidden;
          border: 1px solid rgba(0,0,0,0.25);
          box-shadow: inset 0 0 25px rgba(0,0,0,0.65);
        }
        .eb-dossier__photo-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          filter: grayscale(25%) contrast(1.12) sepia(0.1);
        }
        .eb-dossier__photo-film {
          position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: 0.3;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .eb-dossier__annotation {
          position: absolute; top: 18%; left: 18%; width: 64%; height: 64%;
          border: 2.5px solid rgba(185,28,28,0.75);
          border-radius: 44% 56% 40% 60% / 52% 46% 54% 48%;
          transform: rotate(9deg); mix-blend-mode: multiply; pointer-events: none;
          box-shadow: 0 0 0 1px rgba(185,28,28,0.18), inset 0 0 15px rgba(185,28,28,0.06);
        }
        .eb-dossier__corner {
          position: absolute; width: 14px; height: 14px;
          border-color: rgba(185,28,28,0.65); border-style: solid; pointer-events: none;
        }
        .eb-dossier__corner--tl { top: 5px; left: 5px; border-width: 2px 0 0 2px; }
        .eb-dossier__corner--tr { top: 5px; right: 5px; border-width: 2px 2px 0 0; }
        .eb-dossier__corner--bl { bottom: 5px; left: 5px; border-width: 0 0 2px 2px; }
        .eb-dossier__corner--br { bottom: 5px; right: 5px; border-width: 0 2px 2px 0; }
        .eb-dossier__photo-ref {
          position: absolute; bottom: 8px; left: 12px;
          font-family: var(--font-mono); font-size: 9px;
          color: rgba(0,0,0,0.55); letter-spacing: 0.06em;
        }
        .eb-dossier__stamp {
          position: absolute; bottom: clamp(20px, 7%, 50px); left: 50%;
          transform: translateX(-50%) rotate(-14deg);
          pointer-events: none; mix-blend-mode: multiply;
        }
        .eb-dossier__stamp-border {
          padding: 7px 18px; border: 4px solid var(--stamp-red); border-radius: 3px;
        }
        .eb-dossier__stamp-border span {
          font-family: var(--font-head);
          font-size: clamp(16px, 3vw, 26px); font-weight: 700; letter-spacing: 0.2em;
          color: var(--stamp-red); white-space: nowrap; display: block;
        }
        .eb-dossier__evd-tag {
          position: absolute; top: clamp(16px,4%,32px); right: 0;
          display: flex; flex-direction: column; align-items: flex-end;
          padding: 6px 10px 6px 12px;
          background: rgba(0,0,0,0.12);
          border-left: 3px solid rgba(185,28,28,0.5);
          border-radius: 2px 0 0 2px;
        }
        .eb-dossier__evd-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.25em; color: rgba(0,0,0,0.4); }
        .eb-dossier__evd-num { font-family: var(--font-head); font-size: 22px; color: rgba(127,29,29,0.7); font-weight: 700; line-height: 1; }
        .eb-dossier__class-bars {
          position: absolute; top: 0; right: 0;
          display: flex; flex-direction: column; gap: 2px; padding: 5px;
        }
        .eb-dossier__class-bar { height: 4px; width: 24px; border-radius: 2px; }
        .eb-dossier__class-bar--red { background: rgba(185,28,28,0.55); }
        .eb-dossier__class-bar--amber { background: rgba(217,119,6,0.55); }

        /* DOC PANEL */
        .eb-dossier__doc-panel {
          flex: 1;
          margin: clamp(12px,2.5%,22px);
          background: linear-gradient(160deg, #fdfbf5 0%, #f8f4ea 100%);
          border-radius: 2px;
          box-shadow: 0 6px 28px rgba(0,0,0,0.32), inset 0 0 80px rgba(139,69,19,0.03);
          padding: clamp(18px,3.5%,36px) clamp(18px,3.5%,44px) clamp(14px,2.5%,24px) clamp(44px,7%,76px);
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
        }
        .eb-dossier__lines {
          position: absolute; inset: 0; pointer-events: none;
          background-image: linear-gradient(transparent calc(100% - 1px), rgba(0,0,0,0.055) calc(100% - 1px));
          background-size: 100% 34px;
        }
        .eb-dossier__margin {
          position: absolute; top: 0; bottom: 0;
          left: clamp(38px,6.5%,68px); width: 1px;
          background: rgba(185,28,28,0.22); pointer-events: none;
        }
        .eb-dossier__holes {
          position: absolute; left: 10px; top: 0; bottom: 0;
          display: flex; flex-direction: column; align-items: center;
          justify-content: space-evenly; padding: 24px 0; pointer-events: none;
        }
        .eb-dossier__hole {
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--folder-tan); border: 1px solid rgba(0,0,0,0.12);
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
        }
        .eb-dossier__hole-inner { width: 8px; height: 8px; border-radius: 50%; background: var(--folder-dark); box-shadow: inset 0 1px 3px rgba(0,0,0,0.4); }
        .eb-dossier__watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-family: var(--font-head); font-size: clamp(36px, 7vw, 72px); font-weight: 900;
          letter-spacing: 0.18em; color: rgba(185,28,28,0.038); pointer-events: none;
          white-space: nowrap; user-select: none;
        }

        /* DOC HEADER */
        .eb-dossier__doc-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 12px; border-bottom: 2px solid rgba(0,0,0,0.15);
          padding-bottom: 14px; position: relative; z-index: 1;
        }
        .eb-dossier__dept-label {
          font-family: var(--font-mono); font-size: clamp(8px,1.1vw,11px);
          letter-spacing: 0.2em; color: rgba(0,0,0,0.38); text-transform: uppercase; margin-bottom: 5px;
        }
        .eb-dossier__subject-title {
          font-family: var(--font-head);
          font-size: clamp(15px,2.3vw,24px); color: rgba(0,0,0,0.85);
          letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.2;
          font-weight: 700;
        }
        .eb-dossier__subject-name {
          display: block; color: rgba(127,29,29,0.85);
          font-size: clamp(12px,1.7vw,19px); margin-top: 2px;
        }
        .eb-dossier__close-btn {
          color: rgba(0,0,0,0.22); background: rgba(0,0,0,0.06);
          border-radius: 50%; width: 38px; height: 38px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border: none; cursor: pointer; transition: all 0.15s ease; margin-left: 12px;
        }
        .eb-dossier__close-btn:hover { background: rgba(127,29,29,0.12); color: #dc2626; transform: scale(1.1) rotate(90deg); }

        /* TABS */
        .eb-dossier__tabs {
          display: flex; gap: 1px; margin-bottom: 14px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          position: relative; z-index: 1;
        }
        .eb-dossier__tab {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border: none; background: transparent; cursor: pointer;
          font-family: var(--font-ui); font-size: 11px; font-weight: 600; letter-spacing: 0.15em;
          color: rgba(0,0,0,0.38); border-bottom: 2px solid transparent;
          margin-bottom: -1px; transition: all 0.15s ease;
          text-transform: uppercase;
        }
        .eb-dossier__tab:hover { color: rgba(0,0,0,0.6); }
        .eb-dossier__tab--active { color: rgba(127,29,29,0.9); border-bottom-color: #dc2626; }

        /* TAB CONTENT */
        .eb-dossier__tab-content {
          flex: 1; position: relative; z-index: 1; overflow-y: auto;
          display: flex; flex-direction: column;
        }
        .eb-dossier__tab-content--notes { display: flex; flex-direction: column; }

        /* ANALYSIS GRID */
        .eb-dossier__analysis-grid { display: flex; flex-direction: column; gap: 0; margin-bottom: 16px; }
        .eb-dossier__analysis-row {
          display: flex; align-items: baseline; gap: 12px;
          padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .eb-dossier__analysis-key {
          font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.2em;
          color: rgba(0,0,0,0.35); text-transform: uppercase; min-width: 110px; flex-shrink: 0;
        }
        .eb-dossier__analysis-val {
          font-family: var(--font-type); font-size: 13px; color: rgba(0,0,0,0.75);
        }
        .eb-dossier__analysis-val--mono { font-family: var(--font-mono); font-size: 11px; }
        .eb-dossier__analysis-val--red { color: rgba(127,29,29,0.85); }
        .eb-dossier__ext-link {
          display: inline-flex; align-items: center; gap: 7px;
          margin-top: 12px; padding: 8px 14px; border-radius: 2px;
          background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.08);
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.15em;
          color: rgba(127,29,29,0.7); text-decoration: none;
          transition: all 0.15s; align-self: flex-start;
        }
        .eb-dossier__ext-link:hover { background: rgba(127,29,29,0.06); color: #dc2626; border-color: rgba(185,28,28,0.3); }

        /* NOTES TAB */
        .eb-dossier__lock-label {
          display: flex; align-items: center; gap: 7px;
          color: rgba(127,29,29,0.5); margin-bottom: 12px;
          font-family: var(--font-mono); font-size: clamp(8px,0.9vw,10px);
          letter-spacing: 0.18em; text-transform: uppercase;
        }
        .eb-dossier__textarea {
          flex: 1; width: 100%;
          background: transparent; border: none; outline: none; resize: none;
          font-family: var(--font-type);
          font-size: clamp(14px,1.7vw,18px); font-weight: bold;
          line-height: 34px; color: rgba(22,14,5,0.82);
          text-shadow: 0.4px 0 0 rgba(0,0,0,0.18);
          caret-color: #dc2626; min-height: 140px;
        }
        .eb-dossier__textarea::placeholder { color: rgba(0,0,0,0.17); font-style: italic; }

        /* LINKS TAB */
        .eb-dossier__no-links {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: rgba(0,0,0,0.3);
        }
        .eb-dossier__no-links-icon { color: rgba(0,0,0,0.18); }
        .eb-dossier__no-links p { font-family: var(--font-head); font-size: 14px; letter-spacing: 0.1em; color: rgba(0,0,0,0.4); }
        .eb-dossier__no-links span { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: rgba(0,0,0,0.25); }
        .eb-dossier__links-list { display: flex; flex-direction: column; gap: 8px; }
        .eb-dossier__link-item {
          display: flex; align-items: center; gap: 12px; padding: 10px 12px;
          background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.07); border-radius: 2px;
          cursor: pointer; transition: all 0.15s;
        }
        .eb-dossier__link-item:hover { background: rgba(127,29,29,0.06); border-color: rgba(185,28,28,0.25); }
        .eb-dossier__link-thumb { width: 44px; height: 44px; border-radius: 2px; overflow: hidden; flex-shrink: 0; }
        .eb-dossier__link-img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(20%) sepia(0.1); }
        .eb-dossier__link-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .eb-dossier__link-name { font-family: var(--font-type); font-size: 13px; color: rgba(0,0,0,0.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .eb-dossier__link-desc { font-family: var(--font-mono); font-size: 10px; color: rgba(0,0,0,0.38); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .eb-dossier__link-arrow { color: rgba(127,29,29,0.4); flex-shrink: 0; }

        /* FOOTER */
        .eb-dossier__footer {
          margin-top: 16px; padding-top: 14px;
          border-top: 1px solid rgba(0,0,0,0.1);
          display: flex; justify-content: space-between; align-items: flex-end;
          gap: 12px; flex-wrap: wrap; position: relative; z-index: 1;
        }
        .eb-dossier__auth-block {
          font-family: var(--font-mono); font-size: clamp(8px,0.9vw,10px);
          color: rgba(0,0,0,0.35); letter-spacing: 0.08em; line-height: 1.9;
          text-transform: uppercase;
        }
        .eb-dossier__auth-block strong { color: rgba(0,0,0,0.58); }
        .eb-dossier__clearance-level { color: rgba(127,29,29,0.8) !important; }
        .eb-dossier__save-btn {
          background: #111; color: #f5eedc;
          border: none; cursor: pointer;
          padding: 13px 28px; border-radius: 2px;
          font-family: var(--font-head); font-size: clamp(10px,1.3vw,13px);
          letter-spacing: 0.22em; text-transform: uppercase;
          display: flex; align-items: center; gap: 9px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.55);
          transition: all 0.18s ease; white-space: nowrap;
          position: relative; overflow: hidden; font-weight: 600;
        }
        .eb-dossier__save-btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, transparent 55%, rgba(255,255,255,0.04));
        }
        .eb-dossier__save-btn:hover { background: #7f1d1d; box-shadow: 0 8px 28px rgba(127,29,29,0.55); transform: translateY(-1px); }
        .eb-dossier__save-btn:active { transform: translateY(0); }
        .eb-dossier__save-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .eb-dossier__class-strip {
          margin-top: 10px; padding: 4px 0; border-top: 1px solid rgba(185,28,28,0.18);
          font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.1em;
          color: rgba(185,28,28,0.35); text-transform: uppercase; text-align: center;
          position: relative; z-index: 1;
        }

        /* ═══ SCROLLBAR ══════════════════════════════════════════ */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.12); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(127,29,29,0.45); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(185,28,28,0.65); }

        /* ═══ UTILITIES ══════════════════════════════════════════ */
        .eb-spin { animation: spin 1s linear infinite; }

        /* ═══ KEYFRAMES ══════════════════════════════════════════ */
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes eb-march { to { stroke-dashoffset: -14; } }
        @keyframes eb-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes eb-pulse-border {
          0%,100% { box-shadow: 0 0 60px rgba(244,63,94,0.6), 0 8px 40px rgba(0,0,0,0.9); }
          50% { box-shadow: 0 0 90px rgba(244,63,94,0.85), 0 8px 40px rgba(0,0,0,0.9); }
        }
        @keyframes eb-ring-pulse { 0%,100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.75; transform: scale(1.06); } }
        @keyframes eb-blink { 0%,88%,100% { opacity: 1; } 93% { opacity: 0.45; } }
        @keyframes eb-expand { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.15); opacity: 0; } }
        @keyframes eb-slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
        @keyframes eb-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes eb-zoom-in { from { opacity: 0; transform: scale(0.93) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}} />
    </div>
  );
}