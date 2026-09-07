import { Building2, Mail, Pencil, Plus, ShieldCheck, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetRankingsQueryKey,
  getListStoresQueryKey,
  getListTeamMembersQueryKey,
  useCreateStore,
  useCreateTeamMember,
  useDeleteStore,
  useDeleteTeamMember,
  useListStores,
  useListTeamMembers,
  useUpdateStore,
  useUpdateTeamMember,
} from '@workspace/api-client-react';
import type { Store, TeamMember, TeamMemberRole } from '@workspace/api-client-react';
import { ErrorState, LoadingBlocks, SearchEmpty } from '@/components/ui-kit';

type Tab = 'stores' | 'team';
type StoreDraft = { name: string; city: string; region: string; manager: string; supervisor: string };
type MemberDraft = { name: string; email: string; phone: string; role: TeamMemberRole; storeId: string | null };

const emptyStore: StoreDraft = { name: '', city: '', region: '', manager: '', supervisor: '' };
const emptyMember: MemberDraft = { name: '', email: '', phone: '', role: 'manager', storeId: null };

function FormModal({ children, title, eyebrow, onClose }: { children: React.ReactNode; title: string; eyebrow: string; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal">
      <div className="modal-head"><div><div className="eyebrow">{eyebrow}</div><div className="modal-title">{title}</div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar" data-testid="button-close-admin-modal"><X size={16} /></button></div>
      {children}
    </div>
  </div>;
}

function StoreForm({ initial, onClose, stores, members }: { initial?: Store; onClose: () => void; stores: Store[]; members: TeamMember[] }) {
  const client = useQueryClient();
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const [draft, setDraft] = useState<StoreDraft>(initial ? { name: initial.name, city: initial.city, region: initial.region, manager: initial.manager, supervisor: initial.supervisor } : emptyStore);
  const [notice, setNotice] = useState('');
  const mutation = initial ? updateStore : createStore;
  const set = (key: keyof StoreDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.city.trim() || !draft.region.trim()) {
      setNotice('Preencha nome, cidade e região.');
      return;
    }
    const data = { ...draft };
    if (initial) {
      updateStore.mutate({ id: initial.id, data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListStoresQueryKey() }); client.invalidateQueries({ queryKey: getGetRankingsQueryKey() }); onClose(); }, onError: () => setNotice('Não foi possível atualizar a loja.') });
    } else {
      createStore.mutate({ data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListStoresQueryKey() }); client.invalidateQueries({ queryKey: getGetRankingsQueryKey() }); onClose(); }, onError: () => setNotice('Não foi possível cadastrar a loja.') });
    }
  };
  const managers = members.filter((member) => member.role === 'manager' && member.active);
  const supervisors = members.filter((member) => member.role === 'supervisor' && member.active);
  return <FormModal title={initial ? 'Editar loja' : 'Cadastrar loja'} eyebrow={initial ? 'Atualização cadastral' : 'Nova unidade'} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field full"><label htmlFor="store-name">Nome da loja</label><input id="store-name" className="input" value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Loja Pampulha" data-testid="input-store-name" /></div>
        <div className="field"><label htmlFor="store-city">Cidade</label><input id="store-city" className="input" value={draft.city} onChange={(event) => set('city', event.target.value)} placeholder="Belo Horizonte" data-testid="input-store-city" /></div>
        <div className="field"><label htmlFor="store-region">Região</label><input id="store-region" className="input" value={draft.region} onChange={(event) => set('region', event.target.value)} placeholder="Centro-Sul" data-testid="input-store-region" /></div>
        <div className="field"><label htmlFor="store-manager">Gerente responsável</label><select id="store-manager" className="select" value={draft.manager} onChange={(event) => set('manager', event.target.value)} data-testid="select-store-manager"><option value="">Ainda não definido</option>{managers.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select><span className="field-hint">{managers.length ? 'Selecione um gerente já cadastrado.' : 'Cadastre um gerente primeiro.'}</span></div>
        <div className="field"><label htmlFor="store-supervisor">Supervisor responsável</label><select id="store-supervisor" className="select" value={draft.supervisor} onChange={(event) => set('supervisor', event.target.value)} data-testid="select-store-supervisor"><option value="">Ainda não definido</option>{supervisors.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select><span className="field-hint">{supervisors.length ? 'Pode ser atualizado depois.' : 'Cadastre um supervisor primeiro.'}</span></div>
      </div>
      {notice && <div className="form-notice error">{notice}</div>}
      <div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose} data-testid="button-cancel-store">Cancelar</button><button type="submit" className="button button-primary" disabled={mutation.isPending} data-testid="button-save-store"><Plus size={15} />{mutation.isPending ? 'Salvando...' : initial ? 'Salvar alterações' : 'Cadastrar loja'}</button></div>
    </form>
  </FormModal>;
}

function MemberForm({ initial, onClose, stores }: { initial?: TeamMember; onClose: () => void; stores: Store[] }) {
  const client = useQueryClient();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const [draft, setDraft] = useState<MemberDraft>(initial ? { name: initial.name, email: initial.email, phone: initial.phone, role: initial.role, storeId: initial.storeId } : emptyMember);
  const [notice, setNotice] = useState('');
  const mutation = initial ? updateMember : createMember;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.email.trim()) {
      setNotice('Preencha nome e e-mail.');
      return;
    }
    const data = { ...draft };
    if (initial) {
      updateMember.mutate({ id: initial.id, data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }); client.invalidateQueries({ queryKey: getListStoresQueryKey() }); onClose(); }, onError: () => setNotice('Não foi possível atualizar o colaborador.') });
    } else {
      createMember.mutate({ data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }); client.invalidateQueries({ queryKey: getListStoresQueryKey() }); onClose(); }, onError: () => setNotice('Não foi possível cadastrar o colaborador.') });
    }
  };
  return <FormModal title={initial ? 'Editar colaborador' : 'Cadastrar colaborador'} eyebrow={initial ? 'Atualização de acesso' : 'Nova pessoa'} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field full"><label htmlFor="member-name">Nome completo</label><input id="member-name" className="input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Daniela Souza" data-testid="input-member-name" /></div>
        <div className="field"><label htmlFor="member-email">E-mail</label><input id="member-email" type="email" className="input" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} placeholder="daniela@empresa.com" data-testid="input-member-email" /></div>
        <div className="field"><label htmlFor="member-phone">Telefone</label><input id="member-phone" className="input" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="(31) 99999-0000" data-testid="input-member-phone" /></div>
        <div className="field"><label htmlFor="member-role">Perfil</label><select id="member-role" className="select" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as TeamMemberRole, storeId: event.target.value === 'supervisor' ? null : current.storeId }))} data-testid="select-member-role"><option value="manager">Gerente de loja</option><option value="supervisor">Supervisor</option></select></div>
        <div className="field"><label htmlFor="member-store">Loja principal</label><select id="member-store" className="select" value={draft.storeId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, storeId: event.target.value || null }))} disabled={draft.role === 'supervisor'} data-testid="select-member-store"><option value="">Sem loja definida</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select><span className="field-hint">{draft.role === 'supervisor' ? 'Supervisores podem acompanhar mais de uma loja.' : 'A loja principal do gerente.'}</span></div>
      </div>
      {notice && <div className="form-notice error">{notice}</div>}
      <div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose} data-testid="button-cancel-member">Cancelar</button><button type="submit" className="button button-primary" disabled={mutation.isPending} data-testid="button-save-member"><Plus size={15} />{mutation.isPending ? 'Salvando...' : initial ? 'Salvar alterações' : 'Cadastrar pessoa'}</button></div>
    </form>
  </FormModal>;
}

export default function AdministrationPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('stores');
  const [search, setSearch] = useState('');
  const [storeForm, setStoreForm] = useState<Store | 'new' | null>(null);
  const [memberForm, setMemberForm] = useState<TeamMember | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const membersQuery = useListTeamMembers(undefined, { query: { queryKey: getListTeamMembersQueryKey() } });
  const deleteStore = useDeleteStore();
  const deleteMember = useDeleteTeamMember();
  const stores = storesQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const filteredStores = useMemo(() => stores.filter((store) => `${store.name} ${store.city} ${store.region} ${store.manager} ${store.supervisor}`.toLowerCase().includes(search.toLowerCase())), [stores, search]);
  const filteredMembers = useMemo(() => members.filter((member) => `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(search.toLowerCase())), [members, search]);
  const storeName = (storeId: string | null) => stores.find((store) => store.id === storeId)?.name ?? 'Sem loja definida';
  const removeStore = (store: Store) => {
    if (!window.confirm(`Excluir ${store.name}?`)) return;
    deleteStore.mutate({ id: store.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListStoresQueryKey() }); setNotice('Loja excluída.'); }, onError: () => setNotice('Esta loja não pode ser excluída porque possui tarefas vinculadas.') });
  };
  const removeMember = (member: TeamMember) => {
    if (!window.confirm(`Desativar ${member.name}?`)) return;
    deleteMember.mutate({ id: member.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }); setNotice('Colaborador desativado.'); }, onError: () => setNotice('Não foi possível desativar o colaborador.') });
  };
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">Administração</div><h1 className="page-title">Cadastros</h1><p className="page-intro">Organize as unidades e as pessoas que fazem a operação acontecer.</p></div><div className="admin-summary"><div><strong>{stores.length}</strong><span>lojas</span></div><div><strong>{members.filter((member) => member.active).length}</strong><span>pessoas ativas</span></div></div></div>
    <div className="admin-tabs" role="tablist" aria-label="Cadastros"><button className={tab === 'stores' ? 'admin-tab active' : 'admin-tab'} onClick={() => { setTab('stores'); setSearch(''); }} role="tab" aria-selected={tab === 'stores'} data-testid="tab-stores"><Building2 size={15} /> Lojas</button><button className={tab === 'team' ? 'admin-tab active' : 'admin-tab'} onClick={() => { setTab('team'); setSearch(''); }} role="tab" aria-selected={tab === 'team'} data-testid="tab-team"><UsersRound size={15} /> Gerentes e supervisores</button></div>
    <div className="admin-toolbar"><div className="search-wrap"><Mail size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'stores' ? 'Buscar loja, cidade ou responsável' : 'Buscar nome ou e-mail'} aria-label="Buscar cadastros" data-testid="input-search-admin" /></div><button className="button button-primary" onClick={() => tab === 'stores' ? setStoreForm('new') : setMemberForm('new')} data-testid={tab === 'stores' ? 'button-new-store' : 'button-new-member'}><Plus size={15} /> {tab === 'stores' ? 'Nova loja' : 'Novo colaborador'}</button></div>
    {notice && <div className="form-notice success" data-testid="status-admin-notice">{notice}</div>}
    {tab === 'stores' ? storesQuery.isError ? <ErrorState onRetry={() => storesQuery.refetch()} /> : storesQuery.isLoading ? <LoadingBlocks rows={2} /> : filteredStores.length ? <div className="admin-list">{filteredStores.map((store) => <div className="admin-row" key={store.id} data-testid={`row-admin-store-${store.id}`}><div className="admin-row-icon"><Building2 size={17} /></div><div className="admin-row-main"><strong>{store.name}</strong><span>{store.city} · {store.region}</span></div><div className="admin-row-assignment"><span>Gerente <b>{store.manager || 'Não definido'}</b></span><span>Supervisor <b>{store.supervisor || 'Não definido'}</b></span></div><div className="admin-row-actions"><button className="icon-button" onClick={() => setStoreForm(store)} aria-label={`Editar ${store.name}`} data-testid={`button-edit-store-${store.id}`}><Pencil size={14} /></button><button className="icon-button" onClick={() => removeStore(store)} aria-label={`Excluir ${store.name}`} data-testid={`button-delete-store-${store.id}`}><Trash2 size={14} /></button></div></div>)}</div> : <div className="card"><SearchEmpty title="Nenhuma loja encontrada" /></div> : membersQuery.isError ? <ErrorState onRetry={() => membersQuery.refetch()} /> : membersQuery.isLoading ? <LoadingBlocks rows={2} /> : filteredMembers.length ? <div className="admin-list">{filteredMembers.map((member) => <div className={`admin-row ${member.active ? '' : 'inactive'}`} key={member.id} data-testid={`row-admin-member-${member.id}`}><div className="admin-row-icon"><UserRound size={17} /></div><div className="admin-row-main"><strong>{member.name}</strong><span>{member.email}{member.phone ? ` · ${member.phone}` : ''}</span></div><div className="admin-row-assignment"><span className={`role-badge role-${member.role}`}>{member.role === 'manager' ? 'Gerente' : 'Supervisor'}</span><span>{member.role === 'manager' ? storeName(member.storeId) : 'Rede'}</span></div><div className="admin-row-actions"><button className="icon-button" onClick={() => setMemberForm(member)} aria-label={`Editar ${member.name}`} data-testid={`button-edit-member-${member.id}`}><Pencil size={14} /></button>{member.active && <button className="icon-button" onClick={() => removeMember(member)} aria-label={`Desativar ${member.name}`} data-testid={`button-delete-member-${member.id}`}><ShieldCheck size={14} /></button>}</div></div>)}</div> : <div className="card"><SearchEmpty title="Nenhum colaborador encontrado" /></div>}
    {storeForm && <StoreForm initial={storeForm === 'new' ? undefined : storeForm} onClose={() => setStoreForm(null)} stores={stores} members={members} />}
    {memberForm && <MemberForm initial={memberForm === 'new' ? undefined : memberForm} onClose={() => setMemberForm(null)} stores={stores} />}
  </div>;
}