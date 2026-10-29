"use client";
import { useCallback, useEffect, useState } from "react";
import { Building2, RefreshCw, Search } from "lucide-react";
import { rowsOf } from "../model/management";
import { useRemote } from "./useManagement";
import {
  Badge,
  Button,
  Field,
  PageNav,
  QueryState,
  Select,
} from "./ManagementUi";
import s from "./iam.module.css";

export default function TenantPicker({
  api,
  value = "",
  onChange,
  label = "Empresa para o vínculo",
  activeOnly = true,
  autoSelectSingle = false,
  name,
  revision = 0,
}) {
  const [draft, setDraft] = useState(""),
    [term, setTerm] = useState(""),
    [page, setPage] = useState(0),
    [status, setStatus] = useState(activeOnly ? "ACTIVE" : "ALL");
  const query = useRemote(
    useCallback(() => {
      void revision;
      return api.tenants({ q: term, status, page, size: 10 });
    }, [api, term, status, page, revision]),
  );
  const selected = useRemote(
    useCallback(() => {
      void revision;
      return value ? api.tenant(value) : Promise.resolve(null);
    }, [api, value, revision]),
  );
  useEffect(() => {
    if (
      !autoSelectSingle ||
      value ||
      draft ||
      term ||
      page ||
      query.loading ||
      query.data?.total !== 1
    )
      return;
    const tenant = rowsOf(query.data)[0];
    if (!tenant || tenant.status !== "ACTIVE") return;
    const timer = setTimeout(() => onChange(tenant.id), 0);
    return () => clearTimeout(timer);
  }, [
    autoSelectSingle,
    value,
    draft,
    term,
    page,
    query.loading,
    query.data,
    onChange,
  ]);
  function search() {
    setPage(0);
    setTerm(draft.trim());
    if (draft.trim() === term && page === 0) query.reload();
  }
  return (
    <div className={s.tenantPicker}>
      <div className={s.sectionHeader}>
        <div>
          <h3>{label}</h3>
          <p className={s.muted}>
            {activeOnly
              ? "Selecione uma empresa ativa pelo nome ou código."
              : "Encontre a empresa pelo nome ou código e abra sua gestão."}
          </p>
        </div>
        <Button
          aria-label="Atualizar empresas"
          onClick={() => {
            query.reload();
            selected.reload();
          }}
          disabled={query.loading}
        >
          <RefreshCw size={15} />
        </Button>
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className={s.fieldRow}>
        <Field
          label="Buscar empresa por nome ou código"
          type="search"
          value={draft}
          maxLength={150}
          placeholder="Ex.: Imarui"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button onClick={search}>
          <Search size={15} />
          Buscar empresas
        </Button>
        {term ? (
          <Button
            onClick={() => {
              setDraft("");
              setTerm("");
              setPage(0);
            }}
          >
            Limpar busca
          </Button>
        ) : null}
        {!activeOnly ? (
          <Select
            label="Situação das empresas"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="ALL">Todas</option>
            <option value="ACTIVE">Ativas</option>
            <option value="PENDING">Pendentes</option>
            <option value="DISABLED">Desabilitadas</option>
          </Select>
        ) : null}
      </div>
      {value ? (
        <QueryState query={selected}>
          {selected.data ? (
            <div className={s.tenantSelection}>
              <Building2 size={20} />
              <div>
                <strong>Empresa selecionada: {selected.data.name}</strong>
                <small>{selected.data.code}</small>
              </div>
              <Badge value={selected.data.status} />
              {activeOnly && selected.data.status !== "ACTIVE" ? (
                <p role="alert">
                  Esta empresa precisa ser ativada antes de associar o cadastro.
                </p>
              ) : null}
            </div>
          ) : null}
        </QueryState>
      ) : null}
      <QueryState query={query}>
        <div className={s.tenantOptions} aria-label={label}>
          {rowsOf(query.data).map((tenant) => (
            <button
              className={s.tenantOption}
              type="button"
              key={tenant.id}
              aria-pressed={value === tenant.id}
              disabled={activeOnly && tenant.status !== "ACTIVE"}
              onClick={() => onChange(tenant.id)}
            >
              <Building2 size={18} />
              <span>
                <strong>{tenant.name}</strong>
                <small>{tenant.code}</small>
              </span>
              <Badge value={tenant.status} />
              <b>{value === tenant.id ? "Selecionada" : "Selecionar"}</b>
            </button>
          ))}
          {!rowsOf(query.data).length ? (
            <p className={s.callout}>
              {term
                ? "Nenhuma empresa corresponde à busca no seu acesso. Ajuste o nome ou código."
                : activeOnly
                  ? "Nenhuma empresa ativa disponível no seu acesso. Confira a ativação na aba Empresas."
                  : "Nenhuma empresa disponível no seu acesso."}
            </p>
          ) : null}
        </div>
        <PageNav
          page={page}
          size={10}
          total={query.data?.total || 0}
          onChange={setPage}
          disabled={query.loading}
        />
      </QueryState>
    </div>
  );
}
