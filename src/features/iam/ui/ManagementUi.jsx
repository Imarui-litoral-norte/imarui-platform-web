"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Inbox,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { dateOf, filterRows, labelOf } from "../model/management";
import s from "./iam.module.css";

export function Button({
  children,
  primary,
  danger,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`${s.button} ${primary ? s.primary : ""} ${danger ? s.danger : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({ label, hint, ...props }) {
  const id = useId();
  return (
    <label className={s.field} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </label>
  );
}
export function Select({ label, children, ...props }) {
  return (
    <label className={s.field}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function Reason({ value, onChange }) {
  return (
    <label className={s.field}>
      <span>
        Motivo da alteração <span className={s.required}>Obrigatório</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        maxLength={500}
        rows={2}
        placeholder="Registre a justificativa para a auditoria"
      />
      <small>{value.length}/500 caracteres</small>
    </label>
  );
}
export function Badge({ value, children }) {
  const tone = ["ACTIVE", "APPROVED", "ALLOWED", "COMPLETED"].includes(value)
    ? "positive"
    : ["DISABLED", "REJECTED", "DENY", "EXPLICIT_DENY", "REVOKED"].includes(
          value,
        )
      ? "negative"
      : value === "PENDING"
        ? "warning"
        : "neutral";
  return (
    <span className={s.badge} data-tone={tone}>
      <span aria-hidden="true" />
      {children || labelOf(value)}
    </span>
  );
}
export function Feedback({ error, notice, busy }) {
  return (
    <div aria-live="polite">
      {error ? (
        <p role="alert" className={`${s.message} ${s.error}`}>
          <CircleAlert size={18} />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className={`${s.message} ${s.success}`}>
          <Check size={18} />
          {notice}
        </p>
      ) : null}
      {busy ? (
        <p className={s.loading} role="status">
          <LoaderCircle size={16} className={s.spin} />
          Processando…
        </p>
      ) : null}
    </div>
  );
}
export function QueryState({
  query,
  children,
  empty = "Nenhum registro encontrado.",
}) {
  if (query.loading)
    return (
      <div className={s.empty} role="status">
        <LoaderCircle className={s.spin} />
        <strong>Consultando os registros…</strong>
      </div>
    );
  if (query.error)
    return (
      <div className={s.empty} role="alert">
        <CircleAlert />
        <strong>Não foi possível consultar</strong>
        <p>{query.error}</p>
        <Button onClick={query.reload}>Tentar novamente</Button>
      </div>
    );
  if (query.data === null)
    return (
      <div className={s.empty}>
        <Inbox />
        <p>{empty}</p>
      </div>
    );
  return children;
}
export function Section({ title, description, action, children }) {
  return (
    <section className={s.card}>
      <div className={s.sectionHeader}>
        <div>
          <h2>{title}</h2>
          {description ? <p className={s.muted}>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Subnav({ items, value, onChange }) {
  return (
    <nav className={s.subnav} aria-label="Áreas de gestão">
      {items.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          type="button"
          aria-current={id === value ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          {Icon ? <Icon size={17} /> : null}
          <span>{label}</span>
          {count !== undefined ? <b>{count}</b> : null}
        </button>
      ))}
    </nav>
  );
}
export function Metrics({ items }) {
  return (
    <div className={s.metrics}>
      {items.map(({ label, value, hint, icon: Icon }) => (
        <div key={label} className={s.metric}>
          <div>
            <span>{label}</span>
            {Icon ? <Icon size={18} /> : null}
          </div>
          <strong>{value ?? "—"}</strong>
          {hint ? <small>{hint}</small> : null}
        </div>
      ))}
    </div>
  );
}
export function Facts({ items }) {
  return (
    <dl className={s.facts}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function DateValue({ value }) {
  return <time dateTime={value || undefined}>{dateOf(value)}</time>;
}
export function CopyValue({ value, label = "Copiar identificador" }) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <span className={s.copyValue}>
      <code>{value || "—"}</code>
      {value ? (
        <button
          type="button"
          aria-label={label}
          title={copied ? "Copiado" : label}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setFailed(false);
            } catch {
              setFailed(true);
            }
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      ) : null}
      {failed ? (
        <small role="status">Selecione o texto para copiar.</small>
      ) : null}
    </span>
  );
}
export function Person({ name, email, id }) {
  return (
    <div className={s.person}>
      <span className={s.avatar} aria-hidden="true">
        {String(name || "?")
          .split(/\s+/)
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase()}
      </span>
      <div>
        <strong>{name || "Identidade"}</strong>
        {email ? <small>{email}</small> : null}
        {id ? <CopyValue value={id} /> : null}
      </div>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
  wide = false,
}) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${wide ? s.wideDialog : ""}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={s.dialogHeader}>
        <div>
          <p className={s.eyebrow}>Gestão do IIAM</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <Button
          autoFocus
          aria-label="Fechar janela"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      {description ? (
        <p className={s.muted} id={`${id}-description`}>
          {description}
        </p>
      ) : null}
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  description,
  onClose,
  onConfirm,
  operation,
  reasonRequired = false,
  children,
  danger = true,
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      busy={operation.busy}
    >
      <Feedback {...operation} />
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          await onConfirm(reason);
        }}
      >
        {children}
        {reasonRequired ? <Reason value={reason} onChange={setReason} /> : null}
        <div className={s.dialogActions}>
          <Button onClick={onClose} disabled={operation.busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            danger={danger}
            primary={!danger}
            disabled={operation.busy}
          >
            Confirmar {title.toLocaleLowerCase("pt-BR")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function PageNav({
  page,
  size = 20,
  total,
  hasNext,
  onChange,
  disabled = false,
}) {
  return (
    <div className={s.pagination}>
      <span>
        {total === undefined
          ? `Página ${page + 1}`
          : `${total} registro${total === 1 ? "" : "s"} · Página ${page + 1} de ${Math.max(1, Math.ceil(total / size))}`}
      </span>
      <div className={s.actions}>
        <Button
          disabled={disabled || page === 0}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
          Anterior
        </Button>
        <Button
          disabled={
            disabled ||
            (total === undefined ? !hasNext : (page + 1) * size >= total)
          }
          onClick={() => onChange(page + 1)}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
// Client filters are only used on fully loaded collections or explicitly labelled server pages.
export function DataTable({
  rows,
  columns,
  label,
  searchText,
  statuses = [],
  empty = "Nenhum registro encontrado.",
  searchable = true,
  paginate = true,
  toolbar,
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState(null);
  let filtered = filterRows(rows, search, status, searchText);
  if (sort) {
    const column = columns.find((c) => c.label === sort.key);
    if (column?.sort)
      filtered = [...filtered].sort(
        (a, b) =>
          String(column.sort(a) ?? "").localeCompare(
            String(column.sort(b) ?? ""),
            "pt-BR",
            { numeric: true },
          ) * sort.direction,
      );
  }
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 10) - 1),
  );
  const visible = paginate
    ? filtered.slice(currentPage * 10, currentPage * 10 + 10)
    : filtered;
  return (
    <div className={s.dataTable}>
      {searchable ? (
        <div className={s.toolbar}>
          <label className={s.search}>
            <Search size={17} />
            <input
              type="search"
              aria-label={`Buscar em ${label}`}
              placeholder="Buscar nos registros desta consulta…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          {statuses.length ? (
            <Select
              label="Situação"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas as situações</option>
              {statuses.map((value) => (
                <option value={value} key={value}>
                  {labelOf(value)}
                </option>
              ))}
            </Select>
          ) : null}
          {search || status ? (
            <Button
              onClick={() => {
                setSearch("");
                setStatus("");
                setPage(0);
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
          {toolbar}
        </div>
      ) : (
        toolbar
      )}
      <div className={s.scroll} tabIndex={0} role="region" aria-label={label}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={
                    sort?.key === c.label
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {c.sort ? (
                    <button
                      className={s.sort}
                      onClick={() =>
                        setSort({
                          key: c.label,
                          direction:
                            sort?.key === c.label ? -sort.direction : 1,
                        })
                      }
                    >
                      {c.label}
                      {sort?.key === c.label && sort.direction === -1 ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.id || row.sid || row.code || row.serviceCode || i}>
                {columns.map((c) => (
                  <td key={c.label}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? (
        <div className={s.empty}>
          <Inbox size={27} />
          <strong>
            {search || status ? "Nenhum resultado para os filtros" : empty}
          </strong>
          {search || status ? (
            <p>Ajuste a busca ou limpe os filtros para ver outros registros.</p>
          ) : null}
        </div>
      ) : null}
      {paginate ? (
        <PageNav
          page={currentPage}
          size={10}
          total={filtered.length}
          onChange={setPage}
        />
      ) : null}
    </div>
  );
}
