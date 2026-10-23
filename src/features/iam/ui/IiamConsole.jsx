"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLATFORM_SCOPE, uuid } from "../api/iiamApi";
import s from "./iam.module.css";
const tabs=[['identity','Identidade','/iam/identidade'],['authentication','Autenticação','/iam/autenticacao'],['authorization','Autorização','/iam/autorizacao']];
const list=value=>Array.isArray(value)?value:(value?.items||value?.content||[]);
const textError=error=>error?.status===403?'Seu acesso não permite esta operação.':error?.status===409?'Os dados mudaram ou há um conflito. Atualize a consulta antes de tentar novamente.':error?.message||'Não foi possível concluir a operação.';
function Button({children,...props}){return <button type="button" className={s.button} {...props}>{children}</button>;}
function Field({label,...props}){return <label>{label}<input {...props}/></label>;}
function Table({rows,columns,label}){return <div className={s.tableWrap}><table className={s.table} aria-label={label}><thead><tr>{columns.map(c=><th key={c[0]}>{c[0]}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.id||row.sid||index}>{columns.map(c=><td key={c[0]}>{c[1](row)}</td>)}</tr>)}</tbody></table>{!rows.length?<p className={s.muted}>Nenhum registro nesta consulta.</p>:null}</div>;}
export default function IiamConsole({area,api,profile,refreshSession,clearSession}){
  const [scope,setScope]=useState(PLATFORM_SCOPE),[scopeDraft,setScopeDraft]=useState(PLATFORM_SCOPE);
  const [data,setData]=useState({applications:[],roles:[],permissions:[],assignments:[],denies:[],sessions:[],adminSessions:[]});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [target,setTarget]=useState(''),[identity,setIdentity]=useState(null),[invite,setInvite]=useState('');
  const [tenantId,setTenantId]=useState(''),[tenant,setTenant]=useState(null),[application,setApplication]=useState(null);
  const [affiliation,setAffiliation]=useState(''),[registration,setRegistration]=useState('');
  const [reason,setReason]=useState(''),[selectedRole,setSelectedRole]=useState(null),[composition,setComposition]=useState([]);
  const [grantIdentity,setGrantIdentity]=useState(''),[grantRole,setGrantRole]=useState(''),[denyPermission,setDenyPermission]=useState('');
  const load=useCallback(async()=>{
    if(!profile?.identityId)return;
    setBusy(true);setError('');
    try{
      if(area==='identity'){
        const applications=await api.applications();setData(old=>({...old,applications:list(applications)}));
      } else if(area==='authentication'){
        const sessions=await api.sessions();setData(old=>({...old,sessions:list(sessions)}));
      } else {
        const [roles,permissions,assignments,denies]=await Promise.all([api.roles(scope),api.permissions(scope),api.assignments(scope),api.denies(scope)]);
        setData(old=>({...old,roles:list(roles),permissions:list(permissions),assignments:list(assignments),denies:list(denies)}));
      }
    }catch(e){setError(textError(e));}finally{setBusy(false);}
  },[api,area,scope,profile?.identityId]);
  useEffect(()=>{const timer=setTimeout(()=>{void load();},0);return()=>clearTimeout(timer);},[load]);
  async function run(action,message='Operação concluída.'){
    setBusy(true);setError('');setNotice('');
    try{await action();setNotice(message);await load();}catch(e){setError(textError(e));}finally{setBusy(false);}
  }
  async function inspectIdentity(id){uuid(id);setTarget(id);setIdentity(await api.identity(id));setInvite('');}
  const own=profile?.identityId;
  const currentIdentity=identity||profile?.identity;
  return <div className={s.root}>
    <header className={s.header}><p className={s.eyebrow}>IIAM · Identidades e acessos</p><div className={s.row}><h1>{tabs.find(t=>t[0]===area)?.[1]}</h1><Button disabled={busy} onClick={()=>void load()}>Atualizar consulta</Button></div>
      <p className={s.muted}>{profile?.userName} · {own}</p><nav className={s.tabs}>{tabs.map(t=><Link key={t[0]} href={t[2]} aria-current={t[0]===area?'page':undefined}>{t[1]}</Link>)}</nav></header>
    {error?<p role="alert" className={`${s.message} ${s.error}`}>{error}</p>:null}{notice?<p role="status" className={s.message}>{notice}</p>:null}{busy?<p role="status">Consultando o IIAM…</p>:null}
    {area==='identity'?<>
      <section className={s.card}><h2>Consultar identidade</h2><form className={s.fieldRow} onSubmit={e=>{e.preventDefault();void run(()=>inspectIdentity(target),'Identidade consultada.');}}><Field label="UUID da identidade" value={target} onChange={e=>setTarget(e.target.value)} required/><Button type="submit" disabled={busy}>Consultar</Button><Button disabled={busy} onClick={()=>void run(()=>inspectIdentity(own),'Seu cadastro foi consultado.')}>Meu cadastro</Button></form>
        {currentIdentity?<div className={s.metrics}><div className={s.metric}><span>Apelido</span><strong>{currentIdentity.nickname}</strong></div><div className={s.metric}><span>Tipo</span><strong>{currentIdentity.kind}</strong></div><div className={s.metric}><span>Situação</span><strong>{currentIdentity.status}</strong></div><div className={s.metric}><span>Contato</span><strong>{currentIdentity.primaryEmail}</strong></div></div>:null}
        {currentIdentity?<div className={s.actions}><Button disabled={busy} onClick={()=>void run(async()=>{const value=await api.invitation(currentIdentity.id);setInvite(`${window.location.origin}/first-access#token=${encodeURIComponent(value.invitation)}`);},'Convite gerado para entrega ao titular.')}>Gerar convite de primeiro acesso</Button>
          <Button disabled={busy||currentIdentity.status!=='ACTIVE'} onClick={()=>{if(window.confirm(`Desabilitar ${currentIdentity.nickname} e revogar seu acesso?`))void run(async()=>{setIdentity(await api.identityAction(currentIdentity.id,'disable'));});}}>Desabilitar</Button>
          <Button disabled={busy||currentIdentity.status!=='DISABLED'} onClick={()=>void run(async()=>{setIdentity(await api.identityAction(currentIdentity.id,'reactivate'));})}>Reativar</Button></div>:null}
        {invite?<div className={s.form}><Field label="Convite de uso único" value={invite} readOnly/><Button onClick={()=>void navigator.clipboard.writeText(invite)}>Copiar convite</Button><p className={s.muted}>O titular define a senha ao abrir o convite. O link fica somente nesta tela.</p></div>:null}
      </section>
      <section className={s.card}><h2>Empresa para aprovação</h2><form className={s.fieldRow} onSubmit={e=>{e.preventDefault();void run(async()=>setTenant(await api.tenant(tenantId)),'Empresa consultada.');}}><Field label="UUID do Tenant" value={tenantId} onChange={e=>{setTenantId(e.target.value);setTenant(null);}} required/><Button type="submit" disabled={busy}>Consultar empresa</Button></form>
        {tenant?<p>{tenant.name} · {tenant.code} · {tenant.status} {tenant.status==='PENDING'?<Button disabled={busy} onClick={()=>void run(async()=>setTenant(await api.tenantAction(tenant.id,'activate')))}>Ativar empresa</Button>:null}</p>:null}
        <details><summary>Criar empresa</summary><form className={s.form} onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const values=new FormData(form);void run(async()=>{const created=await api.createTenant(String(values.get('code')),String(values.get('name')));setTenant(created);setTenantId(created.id);form.reset();},'Empresa criada pendente de ativação.');}}><Field label="Código" name="code" required minLength={3} maxLength={50}/><Field label="Nome" name="name" required maxLength={150}/><Button type="submit" disabled={busy}>Criar empresa pendente</Button></form></details>
      </section>
      <section className={s.card}><h2>Solicitações de identidade</h2><p className={s.muted}>Revise o cadastro, consulte uma empresa ativa e escolha o vínculo antes de aprovar.</p>
        <Table label="Solicitações de identidade" rows={data.applications} columns={[
          ['Apelido',a=>a.nickname],['Tipo',a=>a.type],['Contato',a=>a.email],['Situação',a=>a.status],['Ações',a=><div className={s.actions}>{a.status==='PENDING'?<><Button disabled={busy} onClick={()=>{setApplication(a);setAffiliation('');setRegistration('');}}>Revisar</Button><Button disabled={busy} onClick={()=>{const rejection=window.prompt('Motivo da rejeição:');if(rejection?.trim())void run(()=>api.reject(a.id,rejection));}}>Rejeitar</Button></>:null}{a.resolvedIdentityId?<Button disabled={busy} onClick={()=>void run(()=>inspectIdentity(a.resolvedIdentityId),'Identidade consultada.')}>Ver identidade</Button>:null}</div>] ]}/>
        {application?<form className={s.form} onSubmit={e=>{e.preventDefault();void run(async()=>{if(tenant?.id!==uuid(tenantId)||tenant.status!=='ACTIVE')throw new Error('Consulte uma empresa ativa antes de aprovar.');const selection={type:affiliation};if(affiliation==='EMPLOYEE')selection.registration=registration;if(affiliation==='CUSTOMER')selection.customerCode=registration;if(affiliation==='SUPPLIER')selection.supplierCode=registration;const approved=await api.approve(application.id,tenantId,selection);setApplication(null);await inspectIdentity(approved.resolvedIdentityId);},'Solicitação aprovada. A identidade aguarda primeiro acesso.');}}>
          <h3>Revisão de {application.nickname}</h3>
          <p>Nome: {application.details?.fullName||application.details?.legalName||application.details?.name||'—'}</p>
          <p>Documento: {application.details?.cpf||application.details?.cnpj||'Não se aplica'}</p>
          <p>Contato: {application.email}</p>
          <label>Classificação do vínculo<select value={affiliation} onChange={e=>setAffiliation(e.target.value)} required><option value="">Selecione o vínculo</option>{[['EMPLOYEE','Funcionário'],['CUSTOMER','Cliente'],['SUPPLIER','Fornecedor'],['PARTNER','Parceiro'],['EXTERNAL','Externo']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          {['EMPLOYEE','CUSTOMER','SUPPLIER'].includes(affiliation)?<Field label={affiliation==='EMPLOYEE'?'Matrícula':affiliation==='CUSTOMER'?'Código do cliente':'Código do fornecedor'} value={registration} onChange={e=>setRegistration(e.target.value)} required/>:null}
          <p className={s.muted}>Empresa selecionada: {tenant?.name||'Nenhuma empresa consultada'} · {tenant?.status||'—'}</p><div className={s.actions}><Button type="submit" disabled={busy}>Aprovar com este vínculo</Button><Button onClick={()=>setApplication(null)}>Cancelar revisão</Button></div>
        </form>:null}
      </section>
    </>:null}
    {area==='authentication'?<>
      <section className={s.card}><div className={s.row}><h2>Minhas sessões</h2><Button disabled={busy} onClick={()=>void run(()=>refreshSession(),'Sessão renovada.')}>Renovar acesso</Button></div>
        <Table label="Minhas sessões" rows={data.sessions} columns={[
          ['Sessão',r=>r.sid],['Criada em',r=>r.createdAt?new Date(r.createdAt).toLocaleString('pt-BR'):'—'],['Expira em',r=>r.expiresAt?new Date(r.expiresAt).toLocaleString('pt-BR'):'—'],['Situação',r=>r.status],['Ação',r=><Button disabled={busy||r.status!=='ACTIVE'} onClick={()=>{if(window.confirm('Encerrar esta sessão?'))void run(()=>api.endSession(r.sid));}}>Encerrar</Button>] ]}/>
      </section>
      <section className={s.card}><h2>Alterar minha senha</h2><form className={s.form} onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);const current=String(form.get('currentPassword'));const next=String(form.get('newPassword'));void run(async()=>{if(new TextEncoder().encode(next).length>72)throw new Error('A senha deve ter no máximo 72 bytes UTF-8.');await api.changePassword(current,next);clearSession();window.location.assign('/login');},'Senha alterada. Entre novamente.');}}><Field label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" required/><Field label="Nova senha" name="newPassword" type="password" autoComplete="new-password" required minLength={12}/><Button type="submit" disabled={busy}>Alterar senha e encerrar sessões</Button></form></section>
      <section className={s.card}><div className={s.row}><h2>Sessões administrativas</h2><Button disabled={busy} onClick={()=>void run(async()=>setData(old=>({...old,adminSessions:[]}))) }>Limpar consulta</Button><Button disabled={busy} onClick={()=>void run(async()=>{const rows=await api.adminSessions();setData(old=>({...old,adminSessions:list(rows)}));},'Sessões administrativas consultadas.')}>Consultar sessões</Button></div>
        <Table label="Sessões administrativas" rows={data.adminSessions} columns={[
          ['ID técnico',r=>r.id],['Identidade',r=>r.identityId||'—'],['Situação',r=>r.status||'—'],['Ação',r=><Button disabled={busy} onClick={()=>{if(window.confirm(`Encerrar sessão administrativa ${r.id}?`))void run(()=>api.endAdminSession(r.id));}}>Encerrar</Button>] ]}/>
      </section>
    </>:null}
    {area==='authorization'?<>
      <section className={s.card}><h2>Contexto de autorização</h2><form className={s.fieldRow} onSubmit={e=>{e.preventDefault();try{setScope(uuid(scopeDraft));}catch(e){setError(textError(e));}}}><Field label="UUID do escopo" value={scopeDraft} onChange={e=>setScopeDraft(e.target.value)} required/><Button type="submit" disabled={busy}>Consultar contexto</Button></form><div className={s.form}><Field label="Motivo para as alterações" value={reason} onChange={e=>setReason(e.target.value)} required maxLength={500}/></div></section>
      <section className={s.card}><h2>Perfis de acesso</h2><Table label="Perfis" rows={data.roles} columns={[
        ['Perfil',r=>r.name],['Propriedade',r=>r.ownership],['Situação',r=>r.status],['Ações',r=><div className={s.actions}><Button disabled={busy} onClick={()=>void run(async()=>{setSelectedRole(r);setComposition(await api.rolePermissions(r.id));},'Composição consultada.')}>Permissões</Button><Button disabled={busy||r.status==='ARCHIVED'} onClick={()=>void run(()=>api.roleLifecycle(r,r.status==='ACTIVE'?'INACTIVE':'ACTIVE',reason))}>{r.status==='ACTIVE'?'Inativar':'Ativar'}</Button><Button disabled={busy} onClick={()=>{if(window.confirm(`Excluir o perfil ${r.name}?`))void run(()=>api.deleteRole(r,reason));}}>Excluir</Button></div>] ]}/>
        {selectedRole?<form className={s.form} onSubmit={e=>{e.preventDefault();void run(async()=>{await api.saveRolePermissions(selectedRole,composition,reason);setSelectedRole(null);});}}><h3>Permissões de {selectedRole.name}</h3><div className="grid max-h-80 gap-2 overflow-auto">{data.permissions.map(p=><label key={p.code} className={s.permission}><input type="checkbox" checked={composition.includes(p.code)} onChange={e=>setComposition(old=>e.target.checked?[...old,p.code]:old.filter(code=>code!==p.code))}/>{p.description} · {p.code}</label>)}</div><div className={s.actions}><Button type="submit" disabled={busy}>Salvar composição versionada</Button><Button onClick={()=>setSelectedRole(null)}>Cancelar</Button></div></form>:null}
        <details><summary>Criar perfil</summary><form className={s.form} onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const values=new FormData(form);void run(async()=>{await api.createRole(String(values.get('name')),String(values.get('ownership')),scope,String(values.get('tenantId')||''),[],reason);form.reset();},'Perfil criado. Selecione suas permissões antes de atribuí-lo.');}}><Field name="name" label="Nome do perfil" required maxLength={100}/><label>Propriedade<select name="ownership"><option value="GLOBAL">Global</option><option value="SCOPE">Escopo atual</option><option value="TENANT">Empresa</option></select></label><Field name="tenantId" label="UUID do Tenant, quando o perfil pertence a uma empresa"/><Button type="submit" disabled={busy}>Criar perfil sem permissões</Button></form></details>
      </section>
      <section className={s.card}><h2>Atribuições de perfis</h2><form className={s.form} onSubmit={e=>{e.preventDefault();void run(()=>api.assign(grantIdentity,grantRole,scope,reason));}}><Field label="UUID da identidade" value={grantIdentity} onChange={e=>setGrantIdentity(e.target.value)} required/><label>Perfil<select value={grantRole} onChange={e=>setGrantRole(e.target.value)} required><option value="">Selecione</option>{data.roles.filter(r=>r.status==='ACTIVE').map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label><Button type="submit" disabled={busy}>Atribuir no escopo consultado</Button></form>
        <Table label="Atribuições" rows={data.assignments} columns={[
          ['Identidade',a=>a.identityId],['Perfil',a=>data.roles.find(r=>r.id===a.roleId)?.name||a.roleId],['Escopo',a=>a.scopeId],['Situação',a=>a.active?'Ativa':'Revogada'],['Ação',a=><Button disabled={busy||!a.active} onClick={()=>{if(window.confirm('Revogar esta atribuição?'))void run(()=>api.revokeAssignment(a,reason));}}>Revogar</Button>] ]}/>
      </section>
      <section className={s.card}><h2>Negações explícitas</h2><form className={s.form} onSubmit={e=>{e.preventDefault();void run(()=>api.deny(grantIdentity,denyPermission,scope,reason));}}><Field label="UUID da identidade" value={grantIdentity} onChange={e=>setGrantIdentity(e.target.value)} required/><label>Permissão<select value={denyPermission} onChange={e=>setDenyPermission(e.target.value)} required><option value="">Selecione</option>{data.permissions.map(p=><option key={p.code} value={p.code}>{p.code}</option>)}</select></label><Button type="submit" disabled={busy}>Negar no escopo consultado</Button></form>
        <Table label="Negações" rows={data.denies} columns={[
          ['Identidade',d=>d.identityId],['Permissão',d=>d.permission],['Escopo',d=>d.scopeId],['Ação',d=><Button disabled={busy||!d.active} onClick={()=>{if(window.confirm('Revogar esta negação?'))void run(()=>api.revokeDeny(d,reason));}}>Revogar negação</Button>] ]}/>
      </section>
    </>:null}
  </div>;
}
