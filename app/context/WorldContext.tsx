'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

// --- INTERFACES ---
export interface IWorld { id: string; name: string; description?: string; genre?: string; owner_id?: string; }
export interface ICharacter { 
  id: string; name: string; biography: string; avatar_url: string | null; role: string; 
  category?: string; attributes?: Record<string, string>; tags?: string[]; is_public?: boolean; sort_order?: number; owner_id?: string;
}
export type WikiCounts = { Conceito: number; Criatura: number; Divindade: number; Evento: number; Item: number; Local: number; Organização: number; Personagem: number; Raças: number; };

export interface IRelation {
  id: string; from_entity_id: string; to_entity_id: string; relation_label: string; world_id: string; owner_id?: string;
  from_entity?: { id: string; name: string; avatar_url: string | null; role: string; };
  to_entity?: { id: string; name: string; avatar_url: string | null; role: string; };
}

export interface ICampaign {
  id: string; world_id: string; owner_id: string; name: string; description?: string; is_active: boolean;
}

export interface ICampaignMember {
  id: string; campaign_id: string; user_id: string; role: 'player' | 'co-gm'; 
  display_name: string; avatar_color: string; joined_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ICampaignInvite {
  id: string; campaign_id: string; invite_code: string; email?: string; max_uses: number; uses_count: number; expires_at?: string;
}

export interface IEntityPermission {
  id: string; campaign_id: string; entity_id: string; member_id: string;
  can_view: boolean; revealed_fields: string[];
}

export interface IPlayerNote {
  id: string; campaign_id: string; entity_id: string; author_id: string;
  content: string; is_private: boolean; is_pinned: boolean; 
  created_at: string; updated_at: string;
}

interface WorldContextType {
  session: any; worlds: IWorld[]; selectedWorld: IWorld | null; setSelectedWorld: (world: IWorld | null) => void;
  fetchWorlds: () => Promise<void>; handleCreateWorld: (name: string, description?: string, genre?: string) => Promise<void>;
  handleDeleteWorld: (worldId: string) => Promise<void>; 
  characters: ICharacter[]; selectedCharacter: string | null; setSelectedCharacter: (id: string | null) => void;
  currentCharacterData: ICharacter | undefined;
  charBio: string; setCharBio: (bio: string) => void; avatarUrl: string | null; setAvatarUrl: (url: string | null) => void;
  entityAttributes: Record<string, string>; setEntityAttributes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  entityTags: string[]; setEntityTags: React.Dispatch<React.SetStateAction<string[]>>;
  isPublic: boolean; setIsPublic: (val: boolean) => void; sortOrder: number; setSortOrder: (val: number) => void;
  wikiCounts: WikiCounts; loadCharacterData: (char: ICharacter) => void; handleSaveCharacterInfo: () => Promise<void>;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleCreateEntity: (name: string, type: string, mode: 'livre' | 'molde', preformattedBio?: string) => Promise<ICharacter | null>;
  handleDeleteEntity: (entityId: string) => Promise<void>; 
  duplicateEntity: (entityId: string) => Promise<ICharacter | null>;
  isSavingChar: boolean; isUploading: boolean; fileInputRef: React.RefObject<HTMLInputElement>;
  searchQuery: string; setSearchQuery: (q: string) => void; filteredCharacters: ICharacter[];
  fetchRelations: (entityId: string) => Promise<IRelation[]>;
  createRelation: (fromEntityId: string, toEntityId: string, label: string) => Promise<void>;
  deleteRelation: (relationId: string) => Promise<void>;
  
  // --- Campanhas & Jogadores ---
  campaigns: ICampaign[]; selectedCampaign: ICampaign | null; setSelectedCampaign: (c: ICampaign | null) => void;
  fetchCampaigns: () => Promise<void>; handleCreateCampaign: (name: string, description?: string) => Promise<void>;
  handleDeleteCampaign: (campaignId: string) => Promise<void>;
  campaignInvites: ICampaignInvite[]; generateInviteCode: (campaignId: string, maxUses?: number) => Promise<ICampaignInvite | null>;
  revokeInvite: (inviteId: string) => Promise<void>;
  campaignMembers: ICampaignMember[]; handleApproveMember: (memberId: string) => Promise<void>;
  handleRejectMember: (memberId: string) => Promise<void>;
  joinCampaignWithCode: (inviteCode: string, displayName: string) => Promise<string>;
  isGM: boolean; currentMember: ICampaignMember | undefined;
  
  // --- Permissões & Visibilidade ---
  entityPermissions: IEntityPermission[]; fetchEntityPermissions: (campaignId: string) => Promise<void>;
  updateEntityPermission: (campaignId: string, entityId: string, memberId: string, canView: boolean, revealedFields: string[]) => Promise<void>;
  getVisibleEntities: () => ICharacter[];
  getRevealedFields: (entityId: string) => string[];
  
  // --- Notas dos Jogadores ---
  playerNotes: IPlayerNote[]; fetchPlayerNotes: (campaignId: string, entityId: string) => Promise<void>;
  createPlayerNote: (campaignId: string, entityId: string, content: string, isPrivate: boolean) => Promise<void>;
  deletePlayerNote: (noteId: string, campaignId: string, entityId: string) => Promise<void>;
}

const WorldContext = createContext<WorldContextType | null>(null);

export const useWorldContext = () => {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorldContext must be used inside WorldProvider');
  return ctx;
};

// --- CONFIGURAÇÕES DE WIKI ---
export const WIKI_MODULES: Record<string, string[]> = {
  'Personagem': ['História', 'Habilidades', 'Inventário', 'Relações', 'Notas'],
  'Local': ['Geografia', 'Cultura', 'Segredos', 'Pontos de Interesse'],
  'Item': ['Origem', 'Propriedades', 'Portadores Famosos', 'Localização'],
  'Criatura': ['Anatomia', 'Ecologia', 'Lendas', 'Combate'],
  'Organização': ['Propósito', 'Estrutura', 'Métodos', 'Membros Notáveis'],
  'Conceito': ['Teoria', 'Aplicações', 'Impacto', 'Histórico'],
  'Divindade': ['Dogma', 'Mitos', 'Adoração', 'Artefatos Sagrados'],
  'Evento': ['Antecedentes', 'O Incidente', 'Desdobramentos', 'Figuras Chave'],
  'Raças': ['Biologia', 'Cultura', 'Relações', 'História']
};

export const formatEntityModulesToHTML = (type: string, data: Record<string, string>) => {
  const modules = WIKI_MODULES[type] || WIKI_MODULES['Personagem'];
  return modules.map(mod => {
    const content = data[mod] || '';
    if (!content.trim()) return ''; 
    return `<h2>${mod}</h2><p>${content.replace(/\n/g, '<br>')}</p><hr>`;
  }).join('');
};

const TEMPLATE_LIVRE = `<p></p>`;

export const WIKI_ATTRIBUTES: Record<string, Record<string, string>> = {
  'Conceito': { 'Domínio': 'Magia / Ciência', 'Complexidade': 'Alta', 'Origem Conhecida': 'Desconhecida' },
  'Criatura': { 'Classificação': 'Besta / Monstruosidade', 'Habitat': 'Florestas Escuras', 'Dieta': 'Carnívoro', 'Nível de Ameaça': 'Mortal', 'Raridade': 'Lendário' },
  'Divindade': { 'Panteão': 'Os Antigos', 'Alinhamento': 'Caótico e Neutro', 'Domínios': 'Guerra, Morte, Fogo', 'Símbolo Sagrado': 'Uma espada em chamas', 'Arma Favorecida': 'Montante', 'Status': 'Venerado' },
  'Evento': { 'Data/Era': 'Era do Caos', 'Duração': '3 Dias', 'Localização': 'Capital', 'Vítimas/Impacto': 'Incalculável' },
  'Item': { 'Tipo de Equipamento': 'Arma Mágica', 'Raridade': 'Artefato', 'Valor Estimado': 'Inestimável', 'Peso': 'Pesado', 'Atenção': 'Requer Sintonização' },
  'Local': { 'Região/Continente': 'Norte', 'Clima': 'Frio Extremo', 'População': 'Escassa', 'Tipo de Governo': 'Monarquia Absoluta', 'Perigo Local': 'Bandidos / Feras' },
  'Organização': { 'Líder Supremo': 'Desconhecido', 'Sede Base': 'Submundo da Capital', 'Área de Atuação': 'Contrabando e Informação', 'Recrutamento': 'Apenas por convite' },
  'Personagem': { 'Idade': '30', 'Ocupação/Classe': 'Guerreiro', 'Local de Nascimento': 'Vila Rural', 'Status Atual': 'Vivo', 'Alinhamento Moral': 'Neutro e Bom' },
  'Raças': { 'Longevidade': 'Até 300 anos', 'Tamanho Médio': '1.80m', 'Idiomas Conhecidos': 'Comum, Élfico', 'Traço Exclusivo': 'Visão no Escuro' },
};

export function WorldProvider({ session, children }: { session: any; children: ReactNode }) {
  const [worlds, setWorlds] = useState<IWorld[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<IWorld | null>(null);
  const [characters, setCharacters] = useState<ICharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [charBio, setCharBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [entityAttributes, setEntityAttributes] = useState<Record<string, string>>({});
  const [entityTags, setEntityTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  const [isSavingChar, setIsSavingChar] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [wikiCounts, setWikiCounts] = useState<WikiCounts>({ Conceito: 0, Criatura: 0, Divindade: 0, Evento: 0, Item: 0, Local: 0, Organização: 0, Personagem: 0, Raças: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null!);

  // --- Estados de Campanha & Permissões ---
  const [campaigns, setCampaigns] = useState<ICampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<ICampaign | null>(null);
  const [campaignInvites, setCampaignInvites] = useState<ICampaignInvite[]>([]);
  const [campaignMembers, setCampaignMembers] = useState<ICampaignMember[]>([]);
  const [entityPermissions, setEntityPermissions] = useState<IEntityPermission[]>([]);
  const [playerNotes, setPlayerNotes] = useState<IPlayerNote[]>([]);

  const isGM = selectedCampaign ? selectedCampaign.owner_id === session?.user?.id : true; 
  const currentMember = campaignMembers.find(m => m.user_id === session?.user?.id && m.status === 'approved');

  const updateCounts = (charList: ICharacter[]) => {
    const counts = { Conceito: 0, Criatura: 0, Divindade: 0, Evento: 0, Item: 0, Local: 0, Organização: 0, Personagem: 0, Raças: 0 };
    charList.forEach(c => { const cat = c.category || 'Personagem'; if (counts[cat as keyof WikiCounts] !== undefined) counts[cat as keyof WikiCounts]++; });
    setWikiCounts(counts);
  };

  // --- MÉTODOS DE CAMPANHA & JOGADORES ---
  const fetchCampaigns = useCallback(async () => {
    if (!selectedWorld) return;
    try {
      const { data, error } = await supabase.from('campaigns').select('*').eq('world_id', selectedWorld.id).order('created_at', { ascending: false });
      if (error) throw error;
      setCampaigns(data || []); 
      if (data && data.length > 0 && !selectedCampaign) setSelectedCampaign(data[0]); 
    } catch (err: any) { console.error("Erro ao buscar campanhas:", err.message); }
  }, [selectedWorld, selectedCampaign]);

  useEffect(() => { if (selectedWorld) fetchCampaigns(); }, [selectedWorld, fetchCampaigns]);

  const fetchInvites = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase.from('campaign_invites').select('*').eq('campaign_id', campaignId);
    if (!error && data) setCampaignInvites(data);
  }, []);

  const fetchCampaignMembers = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase.from('campaign_members').select('*').eq('campaign_id', campaignId);
    if (!error && data) setCampaignMembers(data);
  }, []);

  useEffect(() => {
    if (selectedCampaign) { fetchInvites(selectedCampaign.id); fetchCampaignMembers(selectedCampaign.id); } 
    else { setCampaignInvites([]); setCampaignMembers([]); }
  }, [selectedCampaign, fetchInvites, fetchCampaignMembers]);

  const handleCreateCampaign = useCallback(async (name: string, description?: string) => {
    if (!selectedWorld || !session?.user?.id) return;
    const { data, error } = await supabase.from('campaigns').insert([{ world_id: selectedWorld.id, owner_id: session.user.id, name, description }]).select();
    if (error) { alert("Erro ao criar campanha: " + error.message); return; }
    await fetchCampaigns(); if(data) setSelectedCampaign(data[0]);
  }, [selectedWorld, session, fetchCampaigns]);

  const handleDeleteCampaign = useCallback(async (campaignId: string) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) throw error;
    await fetchCampaigns(); if (selectedCampaign?.id === campaignId) setSelectedCampaign(null);
  }, [selectedCampaign, fetchCampaigns]);

  const generateInviteCode = useCallback(async (campaignId: string, maxUses: number = 1): Promise<ICampaignInvite | null> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `${part1}-${part2}`;
    const { data, error } = await supabase.from('campaign_invites').insert([{ campaign_id: campaignId, invite_code: code, max_uses: maxUses }]).select();
    if (error) { alert("Erro ao gerar convite"); return null; }
    await fetchInvites(campaignId); return data ? data[0] : null;
  }, [fetchInvites]);

  const revokeInvite = useCallback(async (inviteId: string) => {
    await supabase.from('campaign_invites').delete().eq('id', inviteId);
    if(selectedCampaign) fetchInvites(selectedCampaign.id);
  }, [selectedCampaign, fetchInvites]);

  const handleApproveMember = useCallback(async (memberId: string) => {
    const { error } = await supabase.from('campaign_members').update({ status: 'approved' }).eq('id', memberId);
    if (error) alert("Erro ao aprovar: " + error.message);
    else if (selectedCampaign) fetchCampaignMembers(selectedCampaign.id);
  }, [selectedCampaign, fetchCampaignMembers]);

  const handleRejectMember = useCallback(async (memberId: string) => {
    const { error } = await supabase.from('campaign_members').delete().eq('id', memberId);
    if (error) alert("Erro ao rejeitar: " + error.message);
    else if (selectedCampaign) fetchCampaignMembers(selectedCampaign.id);
  }, [selectedCampaign, fetchCampaignMembers]);

  const joinCampaignWithCode = useCallback(async (inviteCode: string, displayName: string): Promise<string> => {
    if (!session?.user?.id) throw new Error("Precisa estar autenticado.");
    const { data: invite, error: inviteErr } = await supabase.from('campaign_invites').select('*, campaigns(*)').eq('invite_code', inviteCode.toUpperCase()).single();
    if (inviteErr || !invite) throw new Error("Convite inválido ou expirado.");
    if (invite.uses_count >= invite.max_uses) throw new Error("Este convite atingiu o limite de usos.");
    
    const colors = ['#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#d946ef', '#f59e0b', '#06b6d4'];
    const { error: joinErr } = await supabase.from('campaign_members').insert([{
      campaign_id: invite.campaign_id, user_id: session.user.id, invite_id: invite.id,
      display_name: displayName, avatar_color: colors[Math.floor(Math.random() * colors.length)], role: 'player', status: 'pending'
    }]);
    if (joinErr && !joinErr.message.includes('duplicate key')) throw new Error("Erro ao entrar.");
    return invite.campaigns.world_id;
  }, [session]);

  // --- VISIBILIDADE & PERMISSÕES ---
  const fetchEntityPermissions = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase.from('entity_permissions').select('*').eq('campaign_id', campaignId);
    if (!error && data) setEntityPermissions(data);
  }, []);

  const updateEntityPermission = useCallback(async (campaignId: string, entityId: string, memberId: string, canView: boolean, revealedFields: string[]) => {
    const existing = entityPermissions.find(p => p.campaign_id === campaignId && p.entity_id === entityId && p.member_id === memberId);
    const newPerm = { id: existing?.id || 'temp', campaign_id: campaignId, entity_id: entityId, member_id: memberId, can_view: canView, revealed_fields: revealedFields };
    setEntityPermissions(prev => { const filtered = prev.filter(p => !(p.entity_id === entityId && p.member_id === memberId)); return [...filtered, newPerm]; });
    if (existing) { await supabase.from('entity_permissions').update({ can_view: canView, revealed_fields: revealedFields }).eq('id', existing.id); } 
    else { await supabase.from('entity_permissions').insert([{ campaign_id: campaignId, entity_id: entityId, member_id: memberId, can_view: canView, revealed_fields: revealedFields }]); }
  }, [entityPermissions]);

  useEffect(() => {
    if (selectedCampaign) fetchEntityPermissions(selectedCampaign.id);
  }, [selectedCampaign, fetchEntityPermissions]);

  const getVisibleEntities = useCallback(() => {
    if (isGM) return characters;
    if (!currentMember) return [];
    const visibleIds = entityPermissions.filter(p => p.member_id === currentMember.id && p.can_view).map(p => p.entity_id);
    return characters.filter(c => visibleIds.includes(c.id) || c.is_public);
  }, [isGM, characters, entityPermissions, currentMember]);

  const getRevealedFields = useCallback((entityId: string) => {
    if (isGM) return ['biography', 'attributes', 'avatar', 'tags', 'relations'];
    const entity = characters.find(c => c.id === entityId);
    if (entity?.is_public) return ['biography', 'attributes', 'avatar', 'tags', 'relations'];
    if (!currentMember) return [];
    const perm = entityPermissions.find(p => p.member_id === currentMember.id && p.entity_id === entityId);
    return perm?.revealed_fields || [];
  }, [isGM, entityPermissions, currentMember, characters]);

  // --- NOTAS DOS JOGADORES ---
  const fetchPlayerNotes = useCallback(async (campaignId: string, entityId: string) => {
    const { data, error } = await supabase.from('player_notes').select('*').eq('campaign_id', campaignId).eq('entity_id', entityId).order('created_at', { ascending: false });
    if (!error && data) setPlayerNotes(data);
  }, []);

  const createPlayerNote = useCallback(async (campaignId: string, entityId: string, content: string, isPrivate: boolean) => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from('player_notes').insert([{ campaign_id: campaignId, entity_id: entityId, author_id: session.user.id, content, is_private: isPrivate }]);
    if (!error) fetchPlayerNotes(campaignId, entityId);
  }, [session, fetchPlayerNotes]);

  const deletePlayerNote = useCallback(async (noteId: string, campaignId: string, entityId: string) => {
    await supabase.from('player_notes').delete().eq('id', noteId);
    fetchPlayerNotes(campaignId, entityId);
  }, [fetchPlayerNotes]);

  // --- MÉTODOS DO MUNDO (CRUD) ---
  const fetchWorlds = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data: members } = await supabase.from('campaign_members').select('campaign_id').eq('user_id', session.user.id).eq('status', 'approved');
      const campaignIds = members?.map(m => m.campaign_id) || [];
      let worldIds: string[] = [];
      if (campaignIds.length > 0) {
        const { data: camps } = await supabase.from('campaigns').select('world_id').in('id', campaignIds);
        worldIds = camps?.map(c => c.world_id) || [];
      }
      let query = supabase.from('worlds').select('*');
      if (worldIds.length > 0) {
        const uniqueIds = [...new Set(worldIds)].join(',');
        query = query.or(`owner_id.eq.${session.user.id},id.in.(${uniqueIds})`);
      } else {
        query = query.eq('owner_id', session.user.id);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setWorlds(data || []); 
      if (data && data.length > 0 && !selectedWorld) setSelectedWorld(data[0]); 
    } catch (err: any) { console.error("Erro ao buscar mundos:", err.message); }
  }, [session, selectedWorld]);

  useEffect(() => { if (session?.user?.id) fetchWorlds(); }, [session?.user?.id]);

  const handleCreateWorld = useCallback(async (name: string, description?: string, genre?: string) => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase.from('worlds').insert([{ name, description, genre, owner_id: session.user.id }]).select();
    if (!error && data) { await fetchWorlds(); setSelectedWorld(data[0]); }
  }, [fetchWorlds, session]);

  const handleDeleteWorld = useCallback(async (worldId: string) => {
    if (!session?.user?.id) return;
    const prev = [...worlds]; setWorlds(worlds.filter(w => w.id !== worldId));
    const { error } = await supabase.from('worlds').delete().eq('id', worldId).eq('owner_id', session.user.id);
    if (error) { setWorlds(prev); alert(error.message); }
    else if (selectedWorld?.id === worldId) setSelectedWorld(null);
  }, [session, worlds, selectedWorld]);

  const fetchCharacters = useCallback(async (worldId: string) => {
    const { data, error } = await supabase.from('characters').select('*').eq('world_id', worldId).order('created_at', { ascending: false });
    if (!error && data) { setCharacters(data); updateCounts(data); }
  }, []);

  useEffect(() => { 
    if (selectedWorld) { setSelectedCharacter(null); setCharBio(''); setAvatarUrl(null); fetchCharacters(selectedWorld.id); } 
    else { setCharacters([]); updateCounts([]); }
  }, [selectedWorld, fetchCharacters]);

  const loadCharacterData = useCallback((char: ICharacter) => {
    setSelectedCharacter(char.id); setCharBio(char.biography || ''); setAvatarUrl(char.avatar_url || null);
    setEntityAttributes(char.attributes || {}); setEntityTags(char.tags || []); setIsPublic(char.is_public || false); setSortOrder(char.sort_order || 0);
  }, []);

  const handleCreateEntity = useCallback(async (name: string, type: string, mode: 'livre' | 'molde', preformattedBio?: string): Promise<ICharacter | null> => {
    if (!selectedWorld || !session?.user?.id) return null;
    const initialBio = preformattedBio ? preformattedBio : TEMPLATE_LIVRE;
    const initialAttrs: Record<string, string> = WIKI_ATTRIBUTES[type] ? { ...WIKI_ATTRIBUTES[type] } : {};
    const { data, error } = await supabase.from('characters').insert([{ world_id: selectedWorld.id, owner_id: session.user.id, name, biography: initialBio, role: type, category: type, attributes: initialAttrs }]).select();
    if (!error && data) { setCharacters([data[0], ...characters]); updateCounts([data[0], ...characters]); loadCharacterData(data[0]); return data[0]; } 
    return null;
  }, [selectedWorld, session, characters, loadCharacterData]);

  const duplicateEntity = useCallback(async (entityId: string): Promise<ICharacter | null> => {
    if (!selectedWorld || !session?.user?.id) return null;
    const original = characters.find(c => c.id === entityId);
    if (!original) return null;
    const { data, error } = await supabase.from('characters').insert([{ world_id: selectedWorld.id, owner_id: session.user.id, name: `${original.name} (Cópia)`, biography: original.biography, avatar_url: original.avatar_url, role: original.role, category: original.category, attributes: original.attributes, tags: original.tags, is_public: false, sort_order: 0, }]).select();
    if (!error && data) { setCharacters([data[0], ...characters]); updateCounts([data[0], ...characters]); loadCharacterData(data[0]); return data[0]; }
    return null;
  }, [selectedWorld, session, characters, loadCharacterData]);

  const handleDeleteEntity = useCallback(async (entityId: string) => {
    if (!session?.user?.id) return;
    const entityToDelete = characters.find(c => c.id === entityId);
    const prev = [...characters]; setCharacters(characters.filter(c => c.id !== entityId));
    const { error } = await supabase.from('characters').delete().eq('id', entityId).eq('owner_id', session.user.id);
    if (error) { setCharacters(prev); alert(error.message); }
    else {
      if (selectedCharacter === entityId) setSelectedCharacter(null);
      if (entityToDelete?.avatar_url) {
         const fileName = entityToDelete.avatar_url.split('/').pop();
         if (fileName) await supabase.storage.from('avatars').remove([`${session.user.id}/${fileName}`]);
      }
    }
  }, [session, selectedCharacter, characters]);

  const handleSaveCharacterInfo = useCallback(async () => {
    if (!selectedCharacter) return; setIsSavingChar(true);
    try {
      const { error } = await supabase.from('characters').update({ biography: charBio, avatar_url: avatarUrl, attributes: entityAttributes, tags: entityTags, is_public: isPublic, sort_order: sortOrder }).eq('id', selectedCharacter);
      if (!error) setCharacters(prev => prev.map(c => c.id === selectedCharacter ? { ...c, biography: charBio, avatar_url: avatarUrl, attributes: entityAttributes, tags: entityTags, is_public: isPublic, sort_order: sortOrder } : c));
    } catch (err: any) { alert(err.message); } finally { setIsSavingChar(false); }
  }, [selectedCharacter, charBio, avatarUrl, entityAttributes, entityTags, isPublic, sortOrder]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true); const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) throw new Error("Máximo 5MB.");
      if (avatarUrl) {
         const oldFileName = avatarUrl.split('/').pop();
         if (oldFileName) await supabase.storage.from('avatars').remove([`${session.user.id}/${oldFileName}`]);
      }
      const filePath = `${session?.user?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('avatars').upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath); setAvatarUrl(data.publicUrl);
    } catch (error: any) { alert(error.message); } finally { setIsUploading(false); }
  }, [session, avatarUrl]);

  const fetchRelations = useCallback(async (entityId: string): Promise<IRelation[]> => {
    const { data, error } = await supabase.from('entity_relations').select('*, from_entity:characters!from_entity_id(id, name, avatar_url, role), to_entity:characters!to_entity_id(id, name, avatar_url, role)').or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`).order('created_at', { ascending: false });
    return data || [];
  }, []);

  const createRelation = useCallback(async (fromId: string, toId: string, label: string) => {
    if (!selectedWorld || !session?.user?.id) return;
    await supabase.from('entity_relations').insert([{ world_id: selectedWorld.id, owner_id: session.user.id, from_entity_id: fromId, to_entity_id: toId, relation_label: label }]);
  }, [selectedWorld, session]);

  const deleteRelation = useCallback(async (id: string) => {
    await supabase.from('entity_relations').delete().eq('id', id);
  }, []);

  const filteredCharacters = characters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.category?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()));
  const currentCharacterData = characters.find(c => c.id === selectedCharacter);

  return (
    <WorldContext.Provider value={{
      session, worlds, selectedWorld, setSelectedWorld, fetchWorlds, handleCreateWorld, handleDeleteWorld, characters, selectedCharacter, setSelectedCharacter, currentCharacterData, charBio, setCharBio, avatarUrl, setAvatarUrl, entityAttributes, setEntityAttributes, entityTags, setEntityTags, isPublic, setIsPublic, sortOrder, setSortOrder, wikiCounts, loadCharacterData, handleSaveCharacterInfo, handleAvatarUpload, handleCreateEntity, handleDeleteEntity, duplicateEntity, isSavingChar, isUploading, fileInputRef, searchQuery, setSearchQuery, filteredCharacters, fetchRelations, createRelation, deleteRelation,
      campaigns, selectedCampaign, setSelectedCampaign, fetchCampaigns, handleCreateCampaign, handleDeleteCampaign, campaignInvites, generateInviteCode, revokeInvite, campaignMembers, handleApproveMember, handleRejectMember, joinCampaignWithCode, isGM, currentMember,
      entityPermissions, fetchEntityPermissions, updateEntityPermission, getVisibleEntities, getRevealedFields,
      playerNotes, fetchPlayerNotes, createPlayerNote, deletePlayerNote
    }}>
      {children}
    </WorldContext.Provider>
  );
}